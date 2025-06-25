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
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-100 font-sans">
      <main className="flex flex-col items-center justify-center flex-1 px-4 text-center">
        <h1 className="text-5xl font-bold">
          Roast My <span className="text-red-500">Last.fm</span>
        </h1>

        <p className="mt-4 text-xl text-neutral-400">
          Get your music taste judged by a snobby AI.
        </p>

        {error ? (
          <p className="mt-8 text-red-500">{error}</p>
        ) : (
          <a
            href={authUrl}
            className={`mt-8 px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 transition-colors ${!authUrl ? 'opacity-50 cursor-not-allowed' : ''}`}
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
