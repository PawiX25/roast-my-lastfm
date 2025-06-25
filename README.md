# Roast My Last.fm

This project is a web application that humorously roasts a user's music taste based on their Last.fm listening history.

## How it works

1.  **Authentication**: Users log in with their Last.fm account to grant the application read-only access to their listening data.
2.  **Data Fetching**: The application fetches the user's top artists, tracks, and other listening statistics from the Last.fm API.
3.  **The Roast**: An "AI" (currently a set of logic on the backend) analyzes the data and generates a humorous, judgmental critique of the user's music preferences.

## Getting Started

To run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Prerequisites

You will need a Last.fm API key and shared secret. Create a `.env.local` file in the root of the project and add the following:

```
NEXT_PUBLIC_LASTFM_API_KEY=your_api_key_here
LASTFM_SHARED_SECRET=your_shared_secret_here
```

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
