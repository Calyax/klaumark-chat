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
import { generateText, tool, zodSchema, stepCountIs } from 'ai';
import { z } from 'zod';
import { findRelevantContent } from '@/lib/upstash';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { PACKAGES, FAQS } from '@/lib/knowledge-base';

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
  if (!secret || secret !== process.env.VAPI_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  // ── Parse body ────────────────────────────────────────────────────────────
  let messages: z.infer<typeof VapiMessageSchema>[];
  try {
    const raw = await req.json();
    const parsed = VapiBodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response('Bad Request', { status: 400 });
    }
    // Filter out 'system' role — we supply our own system prompt
    messages = parsed.data.messages.filter((m) => m.role !== 'system');
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // ── RAG on last user message (phone = always Polish) ─────────────────────
  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  let context = '';
  try {
    context = await findRelevantContent(lastUserMsg, 'pl');
  } catch (err) {
    console.error('Upstash query failed for /api/voice:', err);
  }

  // ── Tools ─────────────────────────────────────────────────────────────────
  const tools = {
    getPackageInfo: tool({
      description:
        'Returns pricing and features for a specific Klaumark smart home package.',
      inputSchema: zodSchema(
        z.object({
          packageName: z
            .string()
            .describe('Package name, e.g. "eco", "safe", "komfort"'),
        }),
      ),
      execute: async (input) => {
        const normalized = input.packageName.toLowerCase();
        const pkg = PACKAGES.find(
          (p) =>
            p.names.pl.toLowerCase().includes(normalized) ||
            p.names.en.toLowerCase().includes(normalized) ||
            p.id.includes(normalized),
        );
        if (!pkg) {
          return {
            found: false,
            message: `Nie znaleziono pakietu "${input.packageName}".`,
          };
        }
        return {
          found: true,
          id: pkg.id,
          name: pkg.names.pl,
          servicePrice: pkg.servicePrice,
          devicesPrice: pkg.devicesPrice,
          advantages: pkg.advantages.pl,
        };
      },
    }),
    getFAQ: tool({
      description: 'Returns a specific FAQ answer by topic keyword.',
      inputSchema: zodSchema(
        z.object({
          topic: z
            .string()
            .describe(
              'Topic keyword, e.g. "installation", "cost", "ecosystem"',
            ),
        }),
      ),
      execute: async (input) => {
        const normalized = input.topic.toLowerCase();
        const faq = FAQS.find((f) =>
          f.topic.toLowerCase().includes(normalized),
        );
        if (!faq) {
          return {
            found: false,
            message: `Nie znaleziono FAQ dla tematu "${input.topic}".`,
          };
        }
        return {
          found: true,
          topic: faq.topic,
          question: faq.q.pl,
          answer: faq.a.pl,
        };
      },
    }),
  };

  // ── Call Claude Haiku — generateText (non-streaming, returns plain JSON) ──
  let responseText = '';
  try {
    const result = await generateText({
      model: anthropic('claude-haiku-4-5'),
      system: buildSystemPrompt(context, 'pl'),
      messages: messages as Array<{ role: 'user' | 'assistant'; content: string }>,
      maxOutputTokens: 300, // phone responses must be concise
      tools,
      stopWhen: stepCountIs(5),
    });
    responseText = result.text;
  } catch (err) {
    console.error('/api/voice Claude error:', err);
    responseText =
      'Przepraszam, mam chwilowy problem techniczny. Proszę spróbować ponownie.';
  }

  // ── Return OpenAI chat completions format ─────────────────────────────────
  return Response.json({
    id: 'chatcmpl-' + Date.now(),
    object: 'chat.completion',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: responseText },
        finish_reason: 'stop',
      },
    ],
  });
}
