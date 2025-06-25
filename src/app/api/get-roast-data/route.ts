import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { cookies } from 'next/headers';

const apiKey = process.env.LASTFM_API_KEY;
const sharedSecret = process.env.LASTFM_SHARED_SECRET;
const lastFmApiUrl = "https://ws.audioscrobbler.com/2.0/";

const createApiSig = (params: { [key: string]: string }) => {
    const sortedKeys = Object.keys(params).sort();
    let stringToSign = '';
    for (const key of sortedKeys) {
        if (params[key] !== undefined && params[key] !== null) {
            stringToSign += key + params[key];
        }
    }
    stringToSign += sharedSecret;
    return createHash('md5').update(stringToSign, 'utf-8').digest('hex');
};

const removeUnwantedFieldsRecursively = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(item => removeUnwantedFieldsRecursively(item));
    }
    if (obj && typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (['image', 'similar', 'streamable', 'mbid', 'ontour', 'url'].includes(key)) {
                continue;
            }

            const value = obj[key];
            if (key === 'bio' && value && typeof value === 'object') {
                const { content, ...restOfBio } = value as any;
                newObj[key] = removeUnwantedFieldsRecursively(restOfBio);
            } else if ((key === 'tags' || key === 'toptags') && value && value.tag && Array.isArray(value.tag)) {
                newObj[key] = value.tag.slice(0, 15).map((t: any) => t.name).join(', ');
            } else if (key === 'summary' && typeof value === 'string') {
                newObj[key] = value.replace(/<a href="[^"]*">Read more on Last\.fm<\/a>/, '').trim();
            } else {
                newObj[key] = removeUnwantedFieldsRecursively(value);
            }
        }
        return newObj;
    }
    return obj;
};

const makeApiCall = async (params: { [key: string]: any }, isSigned = false) => {
    const queryParams: { [key: string]: any } = { ...params };

    if (isSigned) {
        const signatureParams: { [key: string]: string } = {};
        for (const key in params) {
            if (key !== 'format') {
                signatureParams[key] = params[key];
            }
        }
        queryParams.api_sig = createApiSig(signatureParams);
    }
    
    const searchParams = new URLSearchParams(queryParams);
    const url = `${lastFmApiUrl}?${searchParams.toString()}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
        console.error(`Last.fm API error for method ${params.method}:`, data.message);
        throw new Error(data.message);
    }
    return removeUnwantedFieldsRecursively(data);
}

export async function GET(request: NextRequest) {
    const cookieStore = await cookies();
    const sessionKey = cookieStore.get('sessionKey')?.value;
    const { searchParams } = new URL(request.url);
    const user = searchParams.get("user");

    if (!user) {
        return NextResponse.json({ error: 'Unauthorized: Missing user.' }, { status: 401 });
    }
     if (!sessionKey) {
        return NextResponse.json({ error: 'Unauthorized: Missing session key.' }, { status: 401 });
    }

    try {
        const commonParams = {
            user,
            api_key: apiKey,
            format: 'json',
        };

        const signedParams = {
            ...commonParams,
            sk: sessionKey,
        }

        const userInfoPromise = makeApiCall({ ...commonParams, method: 'user.getInfo' });
        const topArtistsPromise = makeApiCall({ ...commonParams, method: 'user.getTopArtists', limit: '10' });
        const topTracksPromise = makeApiCall({ ...commonParams, method: 'user.getTopTracks', limit: '20' });
        const topAlbumsPromise = makeApiCall({ ...commonParams, method: 'user.getTopAlbums', limit: '10' });
        const lovedTracksPromise = makeApiCall({ ...commonParams, method: 'user.getLovedTracks', limit: '20' });
        const recentTracksPromise = makeApiCall({ ...commonParams, method: 'user.getRecentTracks', limit: '20', extended: '1' });
        const userTopTagsPromise = makeApiCall({ ...commonParams, method: 'user.getTopTags', limit: '10' });
        const weeklyAlbumChartPromise = makeApiCall({ ...commonParams, method: 'user.getWeeklyAlbumChart' });
        const weeklyArtistChartPromise = makeApiCall({ ...commonParams, method: 'user.getWeeklyArtistChart' });
        const weeklyTrackChartPromise = makeApiCall({ ...commonParams, method: 'user.getWeeklyTrackChart' });

        const [
            userInfo,
            topArtistsData,
            topTracksData,
            topAlbumsData,
            lovedTracksData,
            recentTracksData,
            userTopTagsData,
            weeklyAlbumChart,
            weeklyArtistChart,
            weeklyTrackChart,
        ] = await Promise.all([
            userInfoPromise,
            topArtistsPromise,
            topTracksPromise,
            topAlbumsPromise,
            lovedTracksPromise,
            recentTracksPromise,
            userTopTagsPromise,
            weeklyAlbumChartPromise,
            weeklyArtistChartPromise,
            weeklyTrackChartPromise,
        ]);

        const topArtists = topArtistsData.topartists.artist;
        const artistDetailsPromises = topArtists.slice(0, 5).map((artist: any) => {
            const artistParams = {
                artist: artist.name,
                api_key: apiKey,
                format: 'json'
            };
            const infoPromise = makeApiCall({ ...artistParams, method: 'artist.getInfo' });
            const tagsPromise = makeApiCall({ ...artistParams, method: 'artist.getTopTags' });
            return Promise.all([infoPromise, tagsPromise]);
        });
        
        const artistDetailsResponses = await Promise.all(artistDetailsPromises);

        const artistsWithDetails = topArtists.slice(0, 5).map((artist: any, index: number) => {
            const details = artistDetailsResponses[index][0]?.artist;
            const tagsData = artistDetailsResponses[index][1];
            
            const finalArtist = {
                ...artist,
                ...details,
                playcount: artist.playcount, 
            };
            
            if (finalArtist && tagsData?.toptags) {
                finalArtist.tags = tagsData.toptags;
            }

            return finalArtist;
        });

        const roastData = {
            userInfo: userInfo.user,
            topArtists: { ...topArtistsData.topartists, artist: artistsWithDetails },
            topTracks: topTracksData.toptracks,
            topAlbums: topAlbumsData.topalbums,
            lovedTracks: lovedTracksData.lovedtracks,
            recentTracks: recentTracksData.recenttracks,
            userTopTags: userTopTagsData.toptags,
            weeklyAlbumChart: weeklyAlbumChart.weeklyalbumchart,
            weeklyArtistChart: weeklyArtistChart.weeklyartistchart,
            weeklyTrackChart: weeklyTrackChart.weeklytrackchart
        };

        return NextResponse.json(roastData);

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Failed to fetch data from Last.fm' }, { status: 500 });
    }
} 