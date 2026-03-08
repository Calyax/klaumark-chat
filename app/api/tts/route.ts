import { NextRequest } from 'next/server';
import { corsHeaders, handleOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  return handleOptions(origin);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';

  // Allow browser requests from klaumark.com (CORS check).
  // Also allow server-to-server calls (no Origin header) — no CORS check needed.
  const headers = origin ? corsHeaders(origin) : {};
  if (origin && !headers['Access-Control-Allow-Origin']) {
    return new Response('Forbidden', { status: 403 });
  }

  let text: string;
  let lang: string;
  try {
    const body = await req.json();
    text = body.text;
    lang = body.lang ?? 'pl';
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  if (!text || typeof text !== 'string' || text.length > 5000) {
    return new Response('Bad Request', { status: 400 });
  }

  // ELEVENLABS_VOICE_ID: confirmed Hanna Polish voice.
  // Fallback ID NacdHGUYR1k3M0FAbAia was documented in research.
  // IMPORTANT: Verify this ID via `curl -H "xi-api-key: $ELEVENLABS_API_KEY"
  // https://api.elevenlabs.io/v1/voices | jq '.voices[] | select(.labels.language=="polish")'`
  // once ELEVENLABS_API_KEY is added to .env.local, then update ELEVENLABS_VOICE_ID accordingly.
  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? 'NacdHGUYR1k3M0FAbAia';
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    console.error('[tts] ELEVENLABS_API_KEY not set');
    return new Response('TTS service not configured', { status: 503 });
  }

  const ttsResp = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_flash_v2_5',
        output_format: 'mp3_44100_128',
        language_code: lang === 'pl' ? 'pl' : 'en',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, speed: 1.0 },
      }),
    },
  );

  if (!ttsResp.ok) {
    const err = await ttsResp.text();
    console.error('ElevenLabs TTS error:', ttsResp.status, err);
    return new Response('TTS error', { status: 502 });
  }

  // Pipe the audio stream directly back to the caller.
  return new Response(ttsResp.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-store',
      ...(origin && headers['Access-Control-Allow-Origin']
        ? { 'Access-Control-Allow-Origin': headers['Access-Control-Allow-Origin'] }
        : {}),
    },
  });
}
