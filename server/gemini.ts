import { GoogleGenAI } from '@google/genai';

export const GEMINI_MODELS = {
  ARGON: 'gemini-4-argon',
  FAST_LITE: 'gemini-3.1-flash-lite',
  STANDARD: 'gemini-3.8-flash',
  IMAGE: 'gemini-3-pro-image-preview',
} as const;

export const FALLBACK_CHAT_REPLY = `Based on your active event parameters, here is my recommended action plan:

1. Budget & Vendor Leverage: Lock a 50% escrow deposit with your floral and culinary partners in exchange for waiving peak-hour setup surcharges (saves ~12–15% in INR).
2. 3D Spatial Flow: You can switch between Outdoor Garden, Indoor Ballroom, and Glasshouse, toggle Lighting Atmosphere (Sunset Warmth, Midnight Gala, Daylight Crisp), or rearrange tables into Radial, U-Shape, or Columns directly in the 3D Venue or by asking me here in chat.
3. Timeline Cushion: Add a 15-minute acoustic transition buffer between golden hour high-tea and the seated welcome toast.`;

export function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  maxRetries = 3,
  baseDelayMs = 600
): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, options);
    if (response.ok) {
      return response;
    }
    if ((response.status === 429 || response.status >= 500) && attempt < maxRetries) {
      const retryAfter = Number(response.headers.get('Retry-After'));
      const delay =
        !Number.isNaN(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : baseDelayMs * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    const errorBody = await response.text().catch(() => '');
    throw new Error(
      `HTTP ${response.status} (${response.statusText}) from ${url}: ${errorBody.slice(0, 300)}`
    );
  }
  throw new Error(`Exhausted retries for ${url}`);
}
