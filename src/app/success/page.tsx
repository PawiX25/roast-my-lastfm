'use client'

import { useSearchParams } from 'next/navigation'
import { useState } from 'react';

export default function SuccessPage() {
  const searchParams = useSearchParams()
  const userName = searchParams.get('user')
  const [roastData, setRoastData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/get-roast-data?user=${userName}`);
      const data = await response.json();
      if(data.error) {
        setError(data.error);
      } else {
        setRoastData(data);
      }
    } catch (err) {
        setError("Failed to fetch roast data.");
    } finally {
        setIsLoading(false);
    }
  };


  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-neutral-100 font-sans">
      <main className="flex flex-col items-center justify-center flex-1 px-4 text-center py-10">
        <h1 className="text-4xl font-bold">
          Authentication Successful!
        </h1>
        <p className="mt-3 text-xl text-neutral-400">
          Welcome, <span className="font-bold text-red-500">{userName}</span>!
        </p>
        <p className="mt-8 text-lg text-neutral-300">
            Ready to face the music?
        </p>
        <button
            onClick={handleFetchData}
            disabled={isLoading}
            className="mt-6 px-6 py-3 bg-red-500 text-white font-semibold rounded-lg hover:bg-red-600 disabled:bg-neutral-600 transition-colors"
        >
            {isLoading ? 'Getting Data...' : 'Roast Me!'}
        </button>

        {error && (
            <div className="mt-8 p-4 bg-neutral-800 border border-red-500/50 rounded-lg text-left text-sm max-w-4xl w-full">
                <p className="font-bold text-red-500">Error:</p>
                <p className="mt-2 text-neutral-300">{error}</p>
            </div>
        )}

        {roastData && (
            <div className="mt-8 w-full max-w-4xl">
              <p className="text-left font-semibold text-neutral-300 mb-2">Here is your data:</p>
              <pre className="p-4 bg-neutral-800 rounded-lg text-left text-sm overflow-auto w-full">
                  {JSON.stringify(roastData, null, 2)}
              </pre>
            </div>
        )}
      </main>
    </div>
  )
} 