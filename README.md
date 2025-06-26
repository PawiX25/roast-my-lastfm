# Roast My Last.fm

A brutally honest AI that judges your music taste based on your Last.fm listening history. Think you have good taste? Think again.

## What is this?

This is a web application that connects to your Last.fm account and delivers a personalized, snarky roast of your music preferences. Inspired by [Pudding.cool's "Judge My Music"](https://pudding.cool/2021/10/judge-my-music/) but with extra sass and AI-powered burns.

Unlike generic music recommendation engines that try to be nice, this app is designed to be your worst music critic - the kind that makes you question your life choices and wonder if you really *do* have terrible taste.

## How it works

1. **Last.fm Authentication**: Connect your Last.fm account to grant read-only access to your listening data
2. **Data Analysis**: The app fetches your top artists, tracks, albums, recent plays, loved tracks, and listening patterns
3. **Interactive Roasting**: A conversational AI asks you probing questions about your music habits
4. **The Verdict**: Get a final, devastating assessment of your taste with a brutal 1-10 rating

## Features

- **Full Last.fm Integration**: Comprehensive data fetching including top artists/tracks/albums, recent plays, loved tracks, weekly charts, and user tags
- **Interactive Conversation**: Multi-step roasting process with different question types:
  - **Guilty Pleasure Detection**: Pick your most embarrassing album from your top plays
  - **Multiple Choice Confessions**: Answer probing questions about why you listen to certain songs
  - **Fan-O-Meter Slider**: Rate how deep your fandom really goes for your top artists
- **AI-Powered Roasts**: Uses AI to generate personalized, witty burns based on your specific listening data
- **Beautiful UI**: Modern, dark interface with smooth animations and engaging interactions
- **Secure**: Session-based authentication with httpOnly cookies

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes with secure Last.fm authentication
- **AI**: Hackclub AI API for generating personalized roasts
- **Authentication**: Last.fm OAuth with MD5 signature verification
- **Styling**: Tailwind CSS with custom dark theme and smooth animations

## Getting Started

### Prerequisites

You'll need a Last.fm API account:
1. Go to [Last.fm API](https://www.last.fm/api/account/create)
2. Create an application to get your API key and shared secret

### Installation

1. Clone the repository:
```bash
git clone https://github.com/PawiX25/roast-my-lastfm.git
cd roast-my-lastfm
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file in the root directory:
```env
LASTFM_API_KEY=your_api_key_here
LASTFM_SHARED_SECRET=your_shared_secret_here
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## How the Roasting Works

The app uses a sophisticated multi-step process:

1. **Data Collection**: Fetches 10+ different data points from Last.fm including top artists with detailed info, tracks, albums, recent plays, loved tracks, weekly charts, and user tags

2. **Question Generation**: AI generates contextual questions based on your specific artists and songs, making each roast unique

3. **Interactive Elements**: 
   - Image-based choices for album selection
   - Slider interactions for rating fandom levels
   - Multiple choice questions about listening habits

4. **Final Roast**: AI analyzes all your data and conversation responses to deliver a personalized, savage critique with a numerical rating

## Why This Exists

Because [Pudding.cool's music judge](https://pudding.cool/2021/10/judge-my-music/) doesn't work (at least for me using Spotify).
