import { NextResponse } from 'next/server';

const apiKey = process.env.LASTFM_API_KEY;
const redirectUri = "https://roast-my-lastfm.vercel.app/api/callback";

export function GET() {
  if (!apiKey) {
    return NextResponse.json({ error: 'Last.fm API key is not configured.' }, { status: 500 });
  }
  
  const authUrl = `http://www.last.fm/api/auth/?api_key=${apiKey}&cb=${redirectUri}`;
  return NextResponse.json({ authUrl });
} 