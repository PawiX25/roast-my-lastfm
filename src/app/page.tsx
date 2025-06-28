'use client';

import { useState, useEffect } from "react";

export default function Home() {
  const [authUrl, setAuthUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchAuthUrl = async () => {
      try {
        const response = await fetch('/api/get-auth-url');
        const data = await response.json();
        if (data.error) {
          setError(data.error);
        } else {
          setAuthUrl(data.authUrl);
        }
      } catch (err) {
        setError('Failed to retrieve authentication URL.');
      }
    };
    fetchAuthUrl();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <main className="flex flex-col items-center justify-center flex-1 px-4 text-center">
        <h1 className="text-6xl font-bold animate-fade-in-down">
          Roast My <span className="text-[var(--premium-red-text)]">Last.fm</span>
        </h1>

        <p className="mt-4 text-xl text-neutral-600">
          Get your music taste judged by a snobby AI.
        </p>

        {error ? (
          <p className="mt-8 text-[var(--premium-red-text)]">{error}</p>
        ) : (
          <a
            href={authUrl}
            className={`mt-12 px-8 py-4 bg-[var(--premium-red)] text-white font-bold rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 ease-in-out ${!authUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-disabled={!authUrl}
          >
            Connect Last.fm to get started
          </a>
        )}
      </main>

      <footer className="w-full py-6 text-center text-neutral-500 text-sm">
        <p>Powered by a love of good music (and judging yours)</p>
      </footer>
    </div>
  );
}
