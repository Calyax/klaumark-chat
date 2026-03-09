/**
 * VAPI ASSISTANT SETUP (run once in VAPI dashboard or via API):
 *
 * Dashboard: https://dashboard.vapi.ai → Assistants → Create New
 *
 * Assistant JSON config:
 * {
 *   "name": "Klaudio Phone",
 *   "firstMessage": "Dzień dobry! Jestem Klaudio, asystent firmy Klaumark. W czym mogę pomóc?",
 *   "model": {
 *     "provider": "custom-llm",
 *     "url": "https://chat.klaumark.com/api/voice",
 *     "model": "claude-haiku-4-5",
 *     "messages": []
 *   },
 *   "voice": {
 *     "provider": "11labs",
 *     "voiceId": "{{ELEVENLABS_VOICE_ID}}",
 *     "model": "eleven_flash_v2_5"
 *   },
 *   "transcriber": {
 *     "provider": "deepgram",
 *     "language": "pl"
 *   },
 *   "serverMessages": ["tool-calls"],
 *   "serverUrl": "https://chat.klaumark.com/api/lead",
 *   "serverUrlSecret": "{{VAPI_WEBHOOK_SECRET}}",
 *   "tools": [{
 *     "type": "function",
 *     "function": {
 *       "name": "capture_lead",
 *       "description": "Capture customer name and email when they express interest in a quote or installation",
 *       "parameters": {
 *         "type": "object",
 *         "properties": {
 *           "name": { "type": "string", "description": "Customer full name" },
 *           "email": { "type": "string", "description": "Customer email address" }
 *         },
 *         "required": ["name", "email"]
 *       }
 *     }
 *   }]
 * }
 *
 * TWILIO SETUP (to get Polish +48 number):
 * 1. Buy a +48 number in Twilio Console → Phone Numbers → Buy
 * 2. In VAPI dashboard → Phone Numbers → Import → Twilio
 *    Enter: Account SID + Auth Token from Twilio Console → Dashboard
 * 3. Assign the imported number to the "Klaudio Phone" assistant
 *
 * ENV VARS required in Vercel (chat.klaumark.com project):
 *   ELEVENLABS_API_KEY  — from ElevenLabs dashboard → Profile → API Keys
 *   ELEVENLABS_VOICE_ID — confirmed Hanna voice ID (see /api/tts route for verification steps)
 *   VAPI_WEBHOOK_SECRET — any strong random string; also set in VAPI Assistant → Advanced → Server Secret
 */

import { NextRequest } from 'next/server';
import { anthropic } from '@ai-sdk/anthropic';
import { streamText } from 'ai';
import { z } from 'zod';
import { findRelevantContent } from '@/lib/upstash';
import { buildVoiceSystemPrompt } from '@/lib/system-prompt';

export const runtime = 'nodejs';
export const maxDuration = 60; // phone call turn — 60s ample

// ── VAPI message schema ───────────────────────────────────────────────────────
const VapiMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.string(),
});

const VapiBodySchema = z.object({
  messages: z.array(VapiMessageSchema).min(1).max(50),
  model: z.string().optional(),
  stream: z.boolean().optional(),
  temperature: z.number().optional(),
});

export async function POST(req: NextRequest) {
  // ── Auth: VAPI webhook secret ─────────────────────────────────────────────
  const secret = req.headers.get('x-vapi-secret');
  if (process.env.VAPI_WEBHOOK_SECRET && secret !== process.env.VAPI_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let messages: z.infer<typeof VapiMessageSchema>[];
  let requestedStream = false;
  try {
    const raw = await req.json();
    const parsed = VapiBodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response('Bad Request', { status: 400 });
    }
    // Filter out 'system' role — we supply our own system prompt
    messages = parsed.data.messages.filter((m) => m.role !== 'system');
    requestedStream = parsed.data.stream === true;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // ── RAG with timeout — fall back to inline KB if Upstash is slow ─────────
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  let ragContext = '';
  try {
    ragContext = await Promise.race([
      findRelevantContent(lastUserMsg, 'pl'),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1500)),
    ]);
  } catch {
    // Upstash timed out or failed — VOICE_KNOWLEDGE fallback is in the system prompt
  }

  // ── Call Claude Sonnet — streams tokens to VAPI as they arrive ───────────
  const id = 'chatcmpl-' + Date.now();
  const encoder = new TextEncoder();

  let result;
  try {
    result = streamText({
      model: anthropic('claude-sonnet-4-5'),
      system: buildVoiceSystemPrompt(ragContext),
      messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
      maxOutputTokens: 300, // full KB in system prompt — no tools needed, answers directly
    });
  } catch (err) {
    console.error('/api/voice streamText init error:', err);
    // Fall back to error message as single SSE chunk
    const errorStream = new ReadableStream({
      start(controller) {
        const chunk = { id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { role: 'assistant', content: 'Przepraszam, mam chwilowy problem techniczny. Proszę spróbować ponownie.' }, finish_reason: null }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    return new Response(errorStream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
  }

  // Stream tokens to VAPI as SSE deltas — VAPI chunks by punctuation boundary
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const delta of result.textStream) {
          const chunk = {
            id,
            object: 'chat.completion.chunk',
            choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
        }
      } catch (err) {
        console.error('/api/voice stream error:', err);
        const errChunk = { id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: 'Przepraszam, wystąpił błąd.' }, finish_reason: null }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errChunk)}\n\n`));
      } finally {
        const done = { id, object: 'chat.completion.chunk', choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(done)}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
