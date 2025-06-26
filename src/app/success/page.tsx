'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react';

type Choice = {
    text: string;
    value: string;
    imageUrl?: string;
};

type Conversation = {
    step: string;
    botMessage: string | null;
    choices: Choice[];
    history: any[]; 
    roastData: any | null;
    type?: 'slider' | 'default';
    questionQueue?: string[];
};

export default function SuccessPage() {
    const searchParams = useSearchParams();
    const userName = searchParams.get('user');
    const [conversation, setConversation] = useState<Conversation>({
        step: 'initial',
        botMessage: null,
        choices: [],
        history: [],
        roastData: null,
        questionQueue: [],
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sliderValue, setSliderValue] = useState(50);
    
    const isTypingStep = useRef(false);

    useEffect(() => {
        if (conversation.step === 'typing_intro' && !isTypingStep.current) {
            isTypingStep.current = true;
            setTimeout(() => {
                handleChoice('next'); 
                isTypingStep.current = false;
            }, 2500);
        }
    }, [conversation.step]);

    const handleInitialFetch = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/get-roast-data?user=${userName}`);
            const data = await response.json();
            if (data.error) {
                setError(data.error);
            } else {
                setConversation(prev => ({ ...prev, step: 'ready', roastData: data }));
            }
        } catch (err) {
            setError("Failed to fetch initial user data.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleChoice = async (value: string) => {
        setIsLoading(true);
        setError(null);

        const payload = {
            step: conversation.step,
            choice: value,
            user: userName,
            roastData: conversation.roastData,
            history: conversation.history,
            questionQueue: conversation.questionQueue,
        };

        try {
            const response = await fetch('/api/get-roast-data', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();

            if (data.error) {
                setError(data.error);
            } else {
                setConversation(prev => ({
                    ...prev,
                    step: data.nextStep,
                    botMessage: data.botMessage,
                    choices: data.choices || [],
                    history: [...prev.history, { user: value, bot: data.botMessage }],
                    type: data.type || 'default',
                    questionQueue: data.questionQueue || [],
                }));
            }
        } catch (err) {
            setError("Failed to get response from JudgeBot.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (userName && conversation.step === 'initial') {
            handleInitialFetch();
        }
    }, [userName]);

    const renderContent = () => {
        if (isLoading && conversation.step === 'initial') {
            return <p>Getting your data... this better be good.</p>;
        }
        if (error) {
            return (
                <div className="mt-8 p-4 bg-neutral-800 border border-red-500/50 rounded-lg text-left text-sm max-w-4xl w-full">
                    <p className="font-bold text-red-500">Error:</p>
                    <p className="mt-2 text-neutral-300">{error}</p>
                </div>
            );
        }

        if (conversation.step === 'ready') {
            return (
                <>
                    <p className="mt-8 text-lg text-neutral-300">
                        Alright, I've seen your data. Ready to face the music?
                    </p>
                    <button
                        onClick={() => handleChoice('start')}
                        disabled={isLoading}
                        className="mt-6 px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 disabled:bg-neutral-600 transition-colors"
                    >
                        {isLoading ? 'Thinking of a good one...' : 'Roast Me!'}
                    </button>
                </>
            )
        }
        
        if (conversation.step === 'complete') {
             return (
                 <div className="p-4 bg-neutral-800 rounded-lg text-center text-lg w-full">
                    <p>{conversation.botMessage}</p>
                </div>
             )
        }
        
        if (conversation.botMessage) {
            const hasImageChoices = conversation.choices.some(c => c.imageUrl);

            return (
                 <div className="w-full max-w-4xl flex flex-col items-center gap-6">
                    <div className="p-4 bg-neutral-800 rounded-lg text-center text-lg w-full">
                        <p className="whitespace-pre-wrap">{conversation.botMessage}</p>
                    </div>

                    {isLoading && <div className="mt-6">...</div>}

                    {!isLoading && conversation.type === 'slider' && conversation.choices.length === 2 && (
                        <div className="flex flex-col items-center gap-6 w-full pt-4">
                            <p 
                                className="text-8xl font-black text-red-500 tabular-nums"
                                style={{textShadow: '0 0 25px rgba(239, 68, 68, 0.4)'}}
                            >
                                {sliderValue}
                            </p>
                            <div className="w-full max-w-md">
                                <input 
                                    type="range" 
                                    min="0" 
                                    max="100" 
                                    value={sliderValue}
                                    onChange={(e) => setSliderValue(parseInt(e.target.value, 10))}
                                    className="w-full h-4 bg-neutral-800 rounded-full appearance-none cursor-pointer accent-red-600"
                                />
                                <div className="flex justify-between text-sm text-neutral-400 mt-2">
                                    <span className="w-2/5 text-left">{conversation.choices[0].text}</span>
                                    <span className="w-2/5 text-right">{conversation.choices[1].text}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleChoice(sliderValue.toString())}
                                className="px-12 py-4 text-xl font-bold text-white rounded-full bg-gradient-to-r from-red-500 to-red-700 shadow-lg hover:shadow-red-500/30 transform hover:scale-105 transition-all duration-300"
                            >
                                Submit Judgment
                            </button>
                        </div>
                    )}

                    {!isLoading && conversation.type !== 'slider' && conversation.choices.length > 0 && (
                        <div className={`mt-6 flex justify-center gap-4 ${hasImageChoices ? 'flex-row flex-wrap items-end' : 'flex-col sm:flex-row'}`}>
                            {conversation.choices.map((choice) => (
                                hasImageChoices ? (
                                    <div key={choice.value} className="flex flex-col items-center gap-2">
                                        {choice.imageUrl ? (
                                            <img 
                                                src={choice.imageUrl} 
                                                alt={choice.text}
                                                className="w-40 h-40 object-cover rounded-md border-2 border-transparent hover:border-red-500 cursor-pointer transition-all"
                                                onClick={() => handleChoice(choice.value)}
                                            />
                                        ) : (
                                            <div 
                                                className="w-40 h-40 bg-neutral-700 rounded-md border-2 border-transparent hover:border-red-500 cursor-pointer transition-all flex items-center justify-center text-center p-2"
                                                onClick={() => handleChoice(choice.value)}
                                            >
                                                <span>No Cover Art</span>
                                            </div>
                                        )}
                                        <p className="text-xs text-center w-40">{choice.text}</p>
                                    </div>
                                ) : (
                                     <button
                                        key={choice.value}
                                        onClick={() => handleChoice(choice.value)}
                                        className="px-5 py-2 bg-neutral-700 text-white font-semibold rounded-lg hover:bg-neutral-600 disabled:bg-neutral-800 transition-colors"
                                    >
                                        {choice.text}
                                    </button>
                                )
                            ))}
                        </div>
                    )}
                </div>
            )
        }
        
        return null;
    }

    return (
        <main className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-100 font-sans p-4">
            <div className="flex flex-col items-center text-center gap-8 w-full">
                <h1 className="text-4xl font-bold">
                    Welcome, <span className="font-bold text-red-500">{userName}</span>
                </h1>
                {renderContent()}
            </div>
        </main>
    )
} 