'use client'

import { useSearchParams } from 'next/navigation'
import { useState, useEffect, useRef } from 'react';
import { TypeAnimation } from 'react-type-animation';
import { motion, AnimatePresence } from 'framer-motion';

type Choice = {
    text: string;
    value: string;
    imageUrl?: string;
};

type ScannableItem = {
    name: string;
    artist: string;
    imageUrl: string;
}

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
    const [showChoices, setShowChoices] = useState(false);

    const [scannableItems, setScannableItems] = useState<ScannableItem[]>([]);
    const [currentItemIndex, setCurrentItemIndex] = useState(0);
    const [snarkyComment, setSnarkyComment] = useState('');
    const [isScanning, setIsScanning] = useState(false);
    const scannerRef = useRef<HTMLDivElement>(null);
    const [finalTransform, setFinalTransform] = useState<string | undefined>(undefined);

    const isTypingStep = useRef(false);

    useEffect(() => {
        if (conversation.botMessage) {
            setShowChoices(false);
        }
    }, [conversation.botMessage]);

    useEffect(() => {
        const choicesWithImages = conversation.choices.filter(c => c.imageUrl);
        if (choicesWithImages.length > 0) {
            choicesWithImages.forEach(choice => {
                if (choice.imageUrl) {
                    const img = new Image();
                    img.src = choice.imageUrl;
                }
            });
        }
    }, [conversation.choices]);

    const startScanner = (data: any) => {
        const placeholderUrlPart = '2a96cbd8b46e442fc41c2b86b821562f';
        const topAlbums = data.topAlbums?.album || [];
        const recentTracks = data.recentTracks?.track || [];
        
        const validItems = [...topAlbums, ...recentTracks]
            .map((item: any) => ({
                name: item.name,
                artist: item.artist?.name || item.artist?.['#text'] || 'Unknown Artist',
                imageUrl: (item.image?.find((img: any) => img.size === 'extralarge')?.[
                    '#text'
                ] || '').trim(),
            }))
            .filter(item => item.imageUrl && !item.imageUrl.includes(placeholderUrlPart));
        
        const uniqueItems = Array.from(new Map(validItems.map(item => [item.imageUrl, item])).values());
        const shuffledItems = uniqueItems.sort(() => 0.5 - Math.random());
        const itemsToScan = shuffledItems.slice(0, 6);

        if (itemsToScan.length < 1) {
             setConversation(prev => ({ ...prev, step: 'ready' }));
             return;
        }

        setScannableItems([...itemsToScan, ...itemsToScan, ...itemsToScan]);
        setConversation(prev => ({ ...prev, step: 'scanning' }));
        setIsScanning(true);
        setCurrentItemIndex(itemsToScan.length);
    };

    useEffect(() => {
        if (!isScanning) return;

        const realItemCount = scannableItems.length / 3;
        if (currentItemIndex >= realItemCount * 2) return;

        const currentItem = scannableItems[currentItemIndex];
        if (!currentItem) return;
        
        const fetchComment = async () => {
            setSnarkyComment('');
            try {
                const response = await fetch('/api/get-roast-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: currentItem.name, artist: currentItem.artist }),
                });
                const data = await response.json();
                if (data.comment) {
                    setSnarkyComment(data.comment);
                } else {
                    setSnarkyComment("I'm speechless. And not in a good way.");
                }
            } catch (e) {
                setSnarkyComment('Is this supposed to be good?');
            }
        };
        
        fetchComment();

    }, [isScanning, currentItemIndex, scannableItems]);

    const handleInitialFetch = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await fetch(`/api/get-roast-data?user=${userName}`);
            const data = await response.json();
            if (data.error) {
                setError(data.error);
            } else {
                setConversation(prev => ({ ...prev, roastData: data }));
                startScanner(data);
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
        const motionProps = {
            initial: { opacity: 0, y: 20 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -20 },
            transition: { duration: 0.4 }
        };

        if (isLoading && conversation.step === 'initial') {
            return (
                <motion.div key="loading" {...motionProps}>
                    <p>Getting your data... this better be good.</p>
                </motion.div>
            );
        }
        if (error) {
            return (
                <motion.div key="error" {...motionProps} className="mt-8 p-4 bg-[var(--cool-gray)] border border-[var(--premium-red)]/50 rounded-lg text-left text-sm max-w-4xl w-full">
                    <p className="font-bold text-[var(--premium-red-text)]">Error:</p>
                    <p className="mt-2 text-neutral-700">{error}</p>
                </motion.div>
            );
        }

        if (conversation.step === 'scanning') {
            const itemWidth = 256;
            const gap = 16;
            const scrollAmount = (currentItemIndex * (itemWidth + gap));

            const handleTypingDone = () => {
                const realItemCount = scannableItems.length / 3;
                const nextItemIndex = currentItemIndex + 1;

                if (nextItemIndex >= realItemCount * 2) {
                    setIsScanning(false);
                    const finalScrollAmount = (currentItemIndex * (itemWidth + gap));
                    const finalTx = `translateX(calc(-${itemWidth / 2}px - ${finalScrollAmount}px))`;
                    setFinalTransform(finalTx);
                    
                    setTimeout(() => {
                        setConversation(prev => ({ ...prev, step: 'ready' }));
                    }, 2000);
                } else {
                    setCurrentItemIndex(nextItemIndex);
                }
            };

            return (
                <motion.div 
                    key="scanning" 
                    {...motionProps} 
                    className="relative w-full h-80 overflow-hidden"
                >
                    <div className="absolute inset-0 z-10 w-full flex items-center justify-center pointer-events-none">
                        <div className="absolute bottom-0 mb-4 w-full max-w-lg min-h-[4rem] p-2 bg-[var(--cool-gray)] rounded-lg flex items-center justify-center">
                           {snarkyComment ? (
                                <TypeAnimation
                                    key={snarkyComment}
                                    sequence={[
                                        snarkyComment,
                                        1000,
                                        handleTypingDone
                                    ]}
                                    wrapper="p"
                                    speed={80}
                                    className="text-center text-neutral-800 text-sm"
                                    cursor={false}
                                />
                           ) : (
                                <p className="text-center text-neutral-800 text-sm animate-pulse">...</p>
                           )}
                        </div>
                    </div>
                     <div 
                        ref={scannerRef}
                        className="absolute top-8 left-1/2 flex items-center gap-4"
                        style={{
                             transform: isScanning ? `translateX(calc(-${itemWidth / 2}px - ${scrollAmount}px))` : finalTransform,
                             transition: isScanning ? 'transform 2.5s cubic-bezier(0.65, 0, 0.35, 1)' : 'transform 0.5s ease-out',
                        }}
                    >
                        {scannableItems.map((item, index) => {
                            const isInFocus = index === currentItemIndex;
                            return (
                                <div 
                                    key={index} 
                                    className="flex-shrink-0 w-64 h-64 rounded-lg transition-all duration-500"
                                    style={{
                                        boxShadow: isInFocus ? '0 0 0 2px var(--premium-red)' : 'none',
                                        transform: isInFocus ? 'scale(1)' : 'scale(0.9)',
                                        opacity: isInFocus ? 1 : 0.5,
                                    }}
                                >
                                     <img
                                        src={item.imageUrl}
                                        alt={`${item.name} by ${item.artist}`}
                                        className="w-full h-full object-cover rounded-lg"
                                        style={{
                                            filter: isInFocus ? 'blur(0px)' : 'blur(4px)',
                                        }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            );
        }
        
        if (conversation.step === 'ready') {
            return (
                <motion.div key="ready" {...motionProps} className="flex flex-col items-center">
                    <p className="mt-8 text-lg text-neutral-700">
                        Alright, I've seen your data. Ready to face the music?
                    </p>
                    <button
                        onClick={() => handleChoice('start')}
                        disabled={isLoading}
                        className="mt-6 px-6 py-3 bg-[var(--premium-red)] text-white font-semibold rounded-lg hover:bg-opacity-90 disabled:bg-neutral-400 transition-colors"
                    >
                        {isLoading ? 'Thinking of a good one...' : 'Roast Me!'}
                    </button>
                </motion.div>
            )
        }
        
        if (conversation.step === 'complete') {
             return (
                 <motion.div key="complete" {...motionProps} className="p-6 bg-[var(--cool-gray)] rounded-lg text-center text-xl w-full max-w-3xl shadow-md">
                    <p className="text-neutral-800">{conversation.botMessage}</p>
                </motion.div>
             )
        }
        
        if (conversation.botMessage) {
            const hasImageChoices = conversation.choices.some(c => c.imageUrl);

            const onTypingDone = () => {
                if (conversation.step === 'typing_intro') {
                    handleChoice('next');
                } else {
                    setShowChoices(true);
                }
            };

            return (
                 <motion.div key="conversation" {...motionProps} className="w-full max-w-4xl flex flex-col items-center gap-6">
                    <div className="p-4 bg-[var(--cool-gray)] rounded-lg text-center text-lg w-full min-h-[6rem] flex items-center justify-center">
                        <TypeAnimation
                            key={conversation.botMessage}
                            sequence={[
                                conversation.botMessage || '',
                                500,
                                onTypingDone
                            ]}
                            wrapper="p"
                            speed={70}
                            className="whitespace-pre-wrap"
                            cursor={true}
                        />
                    </div>

                    {isLoading && <div className="mt-6">...</div>}

                    {!isLoading && showChoices && conversation.type === 'slider' && conversation.choices.length === 2 && (
                        <div className="flex flex-col items-center gap-6 w-full pt-4">
                            <p 
                                className="text-8xl font-black text-[var(--premium-red-text)] tabular-nums"
                                style={{textShadow: '0 0 25px rgba(185, 49, 79, 0.4)'}}
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
                                    className="w-full h-4 bg-[var(--cool-gray)] rounded-full appearance-none cursor-pointer accent-[var(--premium-red)]"
                                />
                                <div className="flex justify-between text-sm text-neutral-500 mt-2">
                                    <span className="w-2/5 text-left">{conversation.choices[0].text}</span>
                                    <span className="w-2/fiv'e text-right">{conversation.choices[1].text}</span>
                                </div>
                            </div>
                            <button
                                onClick={() => handleChoice(sliderValue.toString())}
                                className="px-12 py-4 text-xl font-bold text-white rounded-full bg-[var(--premium-red)] shadow-lg hover:shadow-red-500/30 transform hover:scale-105 transition-all duration-300"
                            >
                                Submit Judgment
                            </button>
                        </div>
                    )}

                    {!isLoading && showChoices && conversation.type !== 'slider' && conversation.choices.length > 0 && (
                        <div className={`mt-6 flex justify-center gap-4 ${hasImageChoices ? 'flex-row flex-wrap items-baseline' : 'flex-col sm:flex-row'}`}>
                            {conversation.choices.map((choice, index) => (
                                hasImageChoices ? (
                                    <div 
                                        key={choice.value} 
                                        className="flex flex-col items-center gap-2"
                                        style={{ animationDelay: `${index * 100}ms`, opacity: 0 }}
                                    >
                                        {choice.imageUrl ? (
                                            <img 
                                                src={choice.imageUrl} 
                                                alt={choice.text}
                                                className="w-40 h-40 object-cover rounded-md border-2 border-transparent hover:border-[var(--premium-red)] cursor-pointer transition-all"
                                                onClick={() => handleChoice(choice.value)}
                                            />
                                        ) : (
                                            <div 
                                                className="w-40 h-40 bg-neutral-200 rounded-md border-2 border-transparent hover:border-[var(--premium-red)] cursor-pointer transition-all flex items-center justify-center text-center p-2"
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
                                        className="px-5 py-2 bg-neutral-300 text-neutral-800 font-semibold rounded-lg hover:bg-neutral-400 disabled:bg-neutral-200 transition-colors"
                                        style={{ animationDelay: `${index * 100}ms`, opacity: 0 }}
                                    >
                                        {choice.text}
                                    </button>
                                )
                            ))}
                        </div>
                    )}
                </motion.div>
            )
        }
        
        return null;
    }

    return (
        <main className="flex flex-col items-center justify-center min-h-screen p-4">
            <div className="flex flex-col items-center justify-center text-center gap-8 w-full flex-1">
                {conversation.step !== 'complete' && (
                    <h1 className="text-4xl font-bold">
                        Welcome, <span className="font-bold text-[var(--premium-red-text)]">{userName}</span>
                    </h1>
                )}
                <AnimatePresence mode="wait">
                    {renderContent()}
                </AnimatePresence>
            </div>
        </main>
    )
} 