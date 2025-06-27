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
            if (['similar', 'streamable', 'ontour', 'url'].includes(key)) {
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
    'image_choice': async (roastData: any) => {
        const topAlbums = roastData.topAlbums?.album;
        if (!topAlbums || topAlbums.length < 4) return null;

        const choices = [...topAlbums].sort(() => 0.5 - Math.random()).slice(0, 4);
        const albumForPrompt = choices.map(a => `"${a.name}" by ${a.artist.name}`).join(', ');

        const fallback = {
            type: 'image_choice',
            nextStep: 'handle_question',
            botMessage: `I see you listen to these albums. Which one is your secret shame?`,
            choices: choices.map((album: any) => ({
                text: `${album.name} by ${album.artist.name}`,
                value: album.name,
                imageUrl: album.image?.find((img: any) => img.size === 'extralarge')?.['#text'] || ''
            }))
        };

        try {
            const systemPrompt = `You are JudgeBot. A user listens to these albums: ${albumForPrompt}. Generate a snarky, condescending, multiple-choice question that forces the user to pick one. The choices are the albums themselves. Format your response *only* as a valid JSON object with the key "question". Example: {"question": "Which of these masterpieces of bad taste do you secretly cherish?"}`;
            
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

            if (!content.question) return fallback;

            return {
                type: 'image_choice',
                nextStep: 'handle_question',
                botMessage: content.question,
                choices: choices.map((album: any) => ({
                    text: `${album.name} by ${album.artist.name}`,
                    value: album.name,
                    imageUrl: album.image?.find((img: any) => img.size === 'extralarge')?.['#text'] || ''
                }))
            };
        } catch (e) {
            return fallback;
        }
    },
    'mcq': async (roastData: any) => {
        const topTrack = roastData.topTracks?.track?.[Math.floor(Math.random() * 10)];
        if (!topTrack) return null;

        const fallback = {
            type: 'mcq',
            nextStep: 'handle_question',
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
                    type: 'mcq',
                    nextStep: 'handle_question',
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
            nextStep: 'handle_question',
            botMessage: `So you listen to ${topArtist.name} a lot. On a scale of 0 to 100, how deep does your fandom *really* go?`,
            choices: [
                { text: `0: Casual Listener`, value: '0' },
                { text: `100: Superfan`, value: '100' },
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
                nextStep: 'handle_question',
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
    'image_choice': (roastData) => roastData.topAlbums?.album?.length >= 4,
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

async function getIntroMessage(roastData: any) {
    const fallback = "Analyzing your listening history... lol... omg... okay hold up.";
    try {
        const systemPrompt = `You are "JudgeBot", a snarky, satirical, and brutally honest AI that judges people's music taste. You are about to analyze a user's listening history. Generate a short, funny, "I'm looking at your data now" message to the user. Keep it to a single, punchy sentence. For example: "Firing up my judgment machine...", "Accessing your questionable life choices...", or "Let's see what we're working with here...". Do not use hashtags. Your response must be plain text only.`;
        const cleanedData = cleanForLLM(roastData);
        const userPrompt = `Here is the user's data, just for context (you don't need to reference it directly): ${JSON.stringify(cleanedData)}. Now, give me that intro message.`;
    
        const aiResponse = await fetch('https://ai.hackclub.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [
                    { "role": "system", "content": systemPrompt },
                    { "role": "user", "content": userPrompt }
                ]
            })
        });
        if (!aiResponse.ok) return fallback;
        const aiData = await aiResponse.json();
        const message = aiData.choices[0].message.content;
        return message || fallback;
    } catch(e) {
        return fallback;
    }
}

async function getNoQuestionsMessage() {
    const fallback = "You know what, I can't even be bothered to roast you properly. Just go.";
    try {
        const systemPrompt = `You are "JudgeBot", a snarky AI. A user's music data is so empty or basic that you can't even generate a single question to make fun of them. Generate a short, witty, dismissive message telling them to come back when they have more interesting taste. Keep it to 1-2 sentences. Your response must be plain text only.`;
        
        const aiResponse = await fetch('https://ai.hackclub.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ "role": "system", "content": systemPrompt }]
            })
        });
        if (!aiResponse.ok) return fallback;
        const aiData = await aiResponse.json();
        return aiData.choices[0].message.content || fallback;
    } catch (e) {
        return fallback;
    }
}

async function getCompleteMessage() {
    const fallback = "That's right. Now go think about what you've done.";
    try {
        const systemPrompt = `You are "JudgeBot", a snarky AI. You have just delivered your final, devastating roast of a user's music taste. They have acknowledged their shame. Generate a final, one-sentence, dismissive "get out of my sight" type of message. For example: "That's right. Now go think about what you've done.", or "Don't let the door hit you on the way out." Your response must be plain text only.`;
        
        const aiResponse = await fetch('https://ai.hackclub.com/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ "role": "system", "content": systemPrompt }]
            })
        });
        if (!aiResponse.ok) return fallback;
        const aiData = await aiResponse.json();
        return aiData.choices[0].message.content || fallback;
    } catch (e) {
        return fallback;
    }
}

async function getAIResponse(history: any[], roastData: any, lastQuestion: any, lastAnswer: any) {
    const systemPrompt = `You are "JudgeBot", a snarky, satirical, and brutally honest AI that judges people's music taste. Your tone is condescending, witty, and a bit of an elitist music snob. You make fun of genres, artist names, and track titles. Keep your responses short, punchy, and under 2-3 sentences. Do not use hashtags. Your responses must be plain text only.`;
    const cleanedData = cleanForLLM(roastData);
    const userPrompt = `My last interaction was: I was asked "${lastQuestion.botMessage}", and I answered with "${lastAnswer}". Based on my answer, the context of our conversation so far, and my music taste data, give me a response. My music data: ${JSON.stringify(cleanedData)}. Conversation History: ${JSON.stringify(history)}.`;
    
    const aiResponse = await fetch('https://ai.hackclub.com/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            messages: [
                { "role": "system", "content": systemPrompt },
                { "role": "user", "content": userPrompt }
            ]
        })
    });
    if (!aiResponse.ok) return "Wow, I'm speechless. And not in a good way.";
    const aiData = await aiResponse.json();
    return aiData.choices[0].message.content;
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
            const introMessage = await getIntroMessage(roastData);
            return NextResponse.json({
                nextStep: 'typing_intro',
                botMessage: introMessage,
                choices: [],
            });
        }
        
        if (step === 'typing_intro') {
            const availableQuestions = Object.keys(questionModules).filter(key => {
                const check = questionViabilityChecks[key];
                return check ? check(roastData) : true;
            });
            
            const questionQueue = availableQuestions.sort(() => 0.5 - Math.random());
            const nextQuestion = await getNextQuestion(questionQueue, roastData);
            
            if (!nextQuestion) {
                 const noQuestionsMessage = await getNoQuestionsMessage();
                 return NextResponse.json({
                    nextStep: 'final',
                    botMessage: noQuestionsMessage,
                    choices: [{ text: "Ouch.", value: "end" }]
                });
            }
            
            return NextResponse.json(nextQuestion);
        }

        if (step === 'handle_question') {
            const lastQuestion = history[history.length - 1];
            let answerText = choice;
            if (lastQuestion.choices) {
                 const choiceObject = lastQuestion.choices.find((c:any) => c.value === choice);
                 if (choiceObject) answerText = choiceObject.text;
            }

            const aiResponse = await getAIResponse(history, roastData, lastQuestion, answerText);
            
            if (questionQueue.length === 0) {
                 const finalRoast = await getFinalRoast(roastData, history, aiResponse);
                 return NextResponse.json({
                    nextStep: 'final',
                    botMessage: `${aiResponse}\n\n${finalRoast}`,
                    choices: [{text: "I... I need a moment.", value: "end"}]
                });
            }

            const nextQuestion = await getNextQuestion(questionQueue, roastData);
             if (!nextQuestion) {
                const finalRoast = await getFinalRoast(roastData, history, aiResponse);
                 return NextResponse.json({
                    nextStep: 'final',
                    botMessage: `${aiResponse}\n\n${finalRoast}`,
                    choices: [{text: "I... I need a moment.", value: "end"}]
                });
            }

            return NextResponse.json({
                ...nextQuestion,
                botMessage: `${aiResponse}\n\n${nextQuestion.botMessage}`,
            });
        }
        
        if (step === 'final') {
             const completeMessage = await getCompleteMessage();
             return NextResponse.json({
                nextStep: 'complete',
                botMessage: completeMessage,
                choices: []
            });
        }

        return NextResponse.json({ error: 'Invalid step or choice' }, { status: 400 });

    } catch (error: any) {
        console.error("Error in POST /api/get-roast-data:", error);
        return NextResponse.json({ error: error.message || 'Failed to process roast step.' }, { status: 500 });
    }
} 