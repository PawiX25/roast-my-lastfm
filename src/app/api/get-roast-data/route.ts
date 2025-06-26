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
            if (['image', 'similar', 'streamable', 'ontour', 'url'].includes(key)) {
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

const cleanForLLM = (obj: any): any => {
    if (Array.isArray(obj)) {
        return obj.map(item => cleanForLLM(item));
    }
    if (obj && typeof obj === 'object') {
        const newObj: { [key: string]: any } = {};
        for (const key in obj) {
            if (['image', 'similar', 'streamable', 'mbid', 'ontour', 'url', 'duration'].includes(key)) {
                continue;
            }
            newObj[key] = cleanForLLM(obj[key]);
        }
        return newObj;
    }
    return obj;
};

const questionModules: { [key: string]: (roastData: any) => Promise<any> | any } = {
    'guilty_pleasure': (roastData: any) => {
        const topAlbums = roastData.topAlbums?.album;
        if (!topAlbums || topAlbums.length < 4) return null;
        
        const sortedAlbums = [...topAlbums].sort((a: any, b: any) => parseInt(b.playcount) - parseInt(a.playcount));
        const guiltyPleasure = sortedAlbums[0];
        const otherAlbums = sortedAlbums.slice(1, 4).sort(() => 0.5 - Math.random()); 
        const choices = [guiltyPleasure, ...otherAlbums].sort(() => 0.5 - Math.random());

        return {
            nextStep: 'handle_guilty_pleasure',
            botMessage: "Alright, time for a confession. Which one of these is your real guilty pleasure? No one's watching. (Except me).",
            choices: choices.map((album: any) => {
                const imageUrl = album.image?.find((img: any) => img.size === 'extralarge')?.['#text'] || album.image?.find((img: any) => img.size === 'large')?.['#text'] || '';
                return {
                    text: `${album.name} by ${album.artist.name}`,
                    value: album.mbid,
                    imageUrl: imageUrl
                }
            })
        };
    },
    'mcq': async (roastData: any) => {
        const topTrack = roastData.topTracks?.track?.[Math.floor(Math.random() * 10)];
        if (!topTrack) return null;

        const fallback = {
             nextStep: 'handle_mcq_confession',
            botMessage: `You listen to '${topTrack.name}' by ${topTrack.artist.name} a lot. What's the usual vibe?`,
            choices: [
                { text: "Staring dramatically out a rainy window.", value: "A" },
                { text: "The main character in my own sad music video.", value: "B" },
                { text: "It's for my 'deep thoughts' playlist.", value: "C" },
                { text: "I just like the beat, I swear.", value: "D" },
            ]
        };

        try {
            const systemPrompt = `You are JudgeBot. A user listens to the song "${topTrack.name}" by ${topTrack.artist.name} a lot. Generate a snarky, condescending, multiple-choice question about WHY they listen to this specific song. Then, generate 4 funny, plausible, and self-incriminating choices. Format your entire response *only* as a valid JSON object with the keys "question" and "choices" (which is an array of 4 strings). Example: {"question": "Why...", "choices": ["A...", "B..."]}`;

            const aiResponse = await fetch('https://ai.hackclub.com/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    response_format: { type: "json_object" },
                    messages: [{ "role": "system", "content": systemPrompt }]
                })
            });

            if (!aiResponse.ok) return fallback;
            
            try {
                const aiData = await aiResponse.json();
                const content = JSON.parse(aiData.choices[0].message.content);

                if (!content.question || !content.choices || content.choices.length !== 4) {
                    return fallback;
                }

                return {
                    nextStep: 'handle_mcq_confession',
                    botMessage: content.question,
                    choices: content.choices.map((choice: string, index: number) => ({
                        text: choice,
                        value: String.fromCharCode(65 + index)
                    }))
                };
            } catch (e) {
                return fallback;
            }
        } catch (e) {
            return fallback;
        }
    },
    'slider': async (roastData: any) => {
        const topArtist = roastData.topArtists?.artist?.[0];
        if (!topArtist) return null;

        const fallback = {
            type: 'slider',
            nextStep: 'handle_fan_o_meter_slider',
            botMessage: `So you listen to ${topArtist.name} a lot. On a scale of 0 to 100, how deep does your fandom *really* go?`,
            choices: [
                { text: `0: I only know their most popular song`, value: '0' },
                { text: `100: I have a tattoo of their face`, value: '100' },
            ]
        };

        try {
            const systemPrompt = `You are JudgeBot. A user's top artist is ${topArtist.name}. Your goal is to create a snarky "Fan-O-Meter" slider question to gauge how much of a true fan they are. Generate a question and two labels for the slider's endpoints (0 and 100). The 0 label should represent a casual, "bandwagon" fan, and the 100 label should represent an obsessive, "gatekeeping" fan. Format your response as a valid JSON object with keys "question", "label_0", and "label_100".`;

            const aiResponse = await fetch('https://ai.hackclub.com/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    response_format: { type: "json_object" },
                    messages: [{ "role": "system", "content": systemPrompt }]
                })
            });

            if (!aiResponse.ok) return fallback;

            const aiData = await aiResponse.json();
            const content = JSON.parse(aiData.choices[0].message.content);

            if (!content.question || !content.label_0 || !content.label_100) {
                return fallback;
            }

            return {
                type: 'slider',
                nextStep: 'handle_fan_o_meter_slider',
                botMessage: content.question,
                choices: [
                    { text: content.label_0, value: '0' },
                    { text: content.label_100, value: '100' },
                ]
            };
        } catch(e) {
            return fallback;
        }
    }
};

const questionViabilityChecks: { [key: string]: (roastData: any) => boolean } = {
    'guilty_pleasure': (roastData) => roastData.topAlbums?.album?.length >= 4,
    'mcq': (roastData) => roastData.topTracks?.track?.length >= 1,
    'slider': (roastData) => roastData.topArtists?.artist?.length >= 1,
};

async function getNextQuestion(questionQueue: string[], roastData: any) {
    while (questionQueue.length > 0) {
        const nextQuestionKey = questionQueue.shift()!;
        const module = questionModules[nextQuestionKey];
        if (module) {
            const questionData = await module(roastData);
            if (questionData) {
                return { ...questionData, questionQueue };
            }
        }
    }
    return null;
}

async function getFinalRoast(roastData: any, history: any, initialResponse: string) {
    const systemPrompt = `You are "JudgeBot", a snarky, satirical, and brutally honest AI that judges people's music taste. Your tone is condescending, witty, and a bit of an elitist music snob. You make fun of genres, artist names, and track titles. Keep your responses short, punchy, and under 2-3 sentences. Do not use hashtags. Your responses must be plain text only.`;
    const cleanedData = cleanForLLM(roastData);
    const userPrompt = `Based on this data, give a final, devastating roast. End with a 1-10 rating of their taste. Data: ${JSON.stringify(cleanedData)}. Conversation History: ${JSON.stringify(history)}.`;

    const aiResponse = await fetch('https://ai.hackclub.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": `My canned response to their last choice was: "${initialResponse}". Now, use the data and this context to give the final roast.`},
                { "role": "user", "content": userPrompt }
            ]
        })
    });
    if (!aiResponse.ok) throw new Error('AI API Error');
    const aiData = await aiResponse.json();
    return aiData.choices[0].message.content;
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const { step, choice, user, roastData, history, questionQueue } = body;

    if (!user || !roastData) {
        return NextResponse.json({ error: 'User and roastData are required.' }, { status: 400 });
    }

    try {
        if (step === 'ready' && choice === 'start') {
            return NextResponse.json({
                nextStep: 'typing_intro',
                botMessage: "Analyzing your listening history... lol... omg... okay hold up.",
                choices: [], 
            });
        }
        
        if (step === 'typing_intro') {
            const sliderModule = questionModules['slider'];
            const sliderQuestion = await sliderModule(roastData);

            if (!sliderQuestion) {
                 return NextResponse.json({
                    nextStep: 'final',
                    botMessage: "You know what, I can't even be bothered to roast you properly. Just go.",
                    choices: [{ text: "Ouch.", value: "end" }]
                });
            }
            
            return NextResponse.json(sliderQuestion);
        }

        let cannedResponse = "";
        let nextStepIsFinal = true;
        let currentQuestionQueue = questionQueue || [];

        if (step === 'handle_guilty_pleasure' || step === 'handle_mcq_confession') {
            nextStepIsFinal = currentQuestionQueue.length === 0;
            if (step === 'handle_guilty_pleasure') {
                const topAlbum = roastData.topAlbums?.album?.find((a:any) => a['@attr']?.rank === '1') || roastData.topAlbums?.album?.[0];
                if (topAlbum) {
                    cannedResponse = choice === topAlbum.mbid
                        ? "AHA! I KNEW IT! All that other stuff is just a front for your love of pure, unadulterated pop trash."
                        : "Oh, playing coy? I don't believe you. You definitely cry to that other album in secret. Whatever.";
                }
            } else {
                const responses: { [key: string]: string } = {
                    "A": "Staring out a window? How original. I'm sure the rain is very impressed with your profound sadness.",
                    "B": "The main character, huh? Let me guess, the movie's a low-budget indie film that only you understand. Groundbreaking.",
                    "C": "'Deep thoughts'? You mean rehearsing arguments in the shower? We all know what that playlist is for.",
                    "D": "Sure, 'just the beat'. That's what they all say. That's the musical equivalent of 'I read Playboy for the articles'."
                };
                cannedResponse = responses[choice] || "I see you're trying to be clever. You're not.";
            }
        }

        if (step === 'handle_fan_o_meter_slider') {
            nextStepIsFinal = false;
            const value = parseInt(choice, 10);
            if (value <= 30) {
                cannedResponse = "A bandwagon fan, I see. You probably just heard them on TikTok. How dreadfully predictable.";
            } else if (value <= 70) {
                cannedResponse = "The casual listener. You enjoy the music, but you're not about to, you know, put in any effort. Commendable laziness.";
            } else {
                cannedResponse = "Wow, a true devotee. It must be exhausting defending their mediocre early albums to anyone who will listen.";
            }
            const remainingKeys = ['guilty_pleasure', 'mcq', 'mcq'].filter(key => {
                const check = questionViabilityChecks[key];
                return check ? check(roastData) : false;
            });
            currentQuestionQueue = remainingKeys.sort(() => 0.5 - Math.random());
        }
        
        if (cannedResponse) {
            if (nextStepIsFinal) {
                const finalRoast = await getFinalRoast(roastData, history, cannedResponse);
                return NextResponse.json({
                    nextStep: 'final',
                    botMessage: `${cannedResponse}\n\n${finalRoast}`,
                    choices: [{text: "I... I need a moment.", value: "end"}]
                });
            } else {
                const nextQuestion = await getNextQuestion(currentQuestionQueue, roastData);
                 if (!nextQuestion) {
                    const finalRoast = await getFinalRoast(roastData, history, cannedResponse);
                     return NextResponse.json({
                        nextStep: 'final',
                        botMessage: `${cannedResponse}\n\n${finalRoast}`,
                        choices: [{text: "I... I need a moment.", value: "end"}]
                    });
                }
                return NextResponse.json({
                    ...nextQuestion,
                    botMessage: `${cannedResponse}\n\n${nextQuestion.botMessage}`,
                });
            }
        }

        if (step === 'final') {
             return NextResponse.json({
                nextStep: 'complete',
                botMessage: "That's right. Now go think about what you've done.",
                choices: []
            });
        }

        return NextResponse.json({ error: 'Invalid step or choice' }, { status: 400 });

    } catch (error: any) {
        console.error("Error in POST /api/get-roast-data:", error);
        return NextResponse.json({ error: error.message || 'Failed to process roast step.' }, { status: 500 });
    }
} 