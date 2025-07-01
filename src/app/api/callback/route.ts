import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

const apiKey = process.env.LASTFM_API_KEY;
const sharedSecret = process.env.LASTFM_SHARED_SECRET;
const lastFmApiUrl = "https://ws.audioscrobbler.com/2.0/";

const createApiSig = (params: { [key: string]: string }) => {
    const sortedKeys = Object.keys(params).sort();
    let stringToSign = '';
    for (const key of sortedKeys) {
        stringToSign += key + params[key];
    }
    stringToSign += sharedSecret;
    return createHash('md5').update(stringToSign, 'utf-8').digest('hex');
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=auth_failed", request.url));
  }

  const params = {
    api_key: apiKey!,
    method: "auth.getSession",
    token: token,
  };

  const apiSig = createApiSig(params);

  const url = `${lastFmApiUrl}?method=auth.getSession&api_key=${apiKey}&token=${token}&api_sig=${apiSig}&format=json`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.error) {
      console.error("Last.fm API error:", data.message);
      return NextResponse.redirect(new URL(`/?error=${data.message}`, request.url));
    }

    const sessionKey = data.session.key;
    const userName = data.session.name;
    
    const redirectUrl = new URL("/success", request.url);
    redirectUrl.searchParams.set("user", userName);
    
    const nextResponse = NextResponse.redirect(redirectUrl);
    
    const hostHeader = request.headers.get("host") || "";
    const isLocalhost = hostHeader.startsWith("localhost") || hostHeader.startsWith("127.0.0.1");
    nextResponse.cookies.set("sessionKey", sessionKey, {
        httpOnly: true,
        secure: !isLocalhost,
        maxAge: 60 * 60 * 24 * 7, // 1 week
        path: "/",
    });

    return nextResponse;

  } catch (error) {
    console.error("Error fetching session key:", error);
    return NextResponse.redirect(new URL("/?error=session_fetch_failed", request.url));
  }
} 