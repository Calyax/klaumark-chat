import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, zodSchema, stepCountIs } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { findRelevantContent } from '@/lib/upstash';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { PACKAGES, FAQS } from '@/lib/knowledge-base';

export const runtime = 'nodejs'; // NOT edge — Upstash Vector SDK needs Node
export const maxDuration = 300; // Vercel Pro: 300s max

// ── Rate limiter — 20 req/min per IP, fail-open if Redis not configured ──────
let ratelimit: Ratelimit | null = null;
try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    ratelimit = new Ratelimit({
      redis: new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      }),
      limiter: Ratelimit.slidingWindow(20, '1 m'),
      prefix: 'klaudio:rl',
    });
  }
} catch {
  // Fail-open: allow requests through if Redis is misconfigured
}

// ── Input schema (H2 + M4) ────────────────────────────────────────────────────
const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(4000),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(50),
  lang: z.enum(['en', 'pl']).optional(),
});

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  return handleOptions(origin);
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin') ?? '';
  const headers = corsHeaders(origin);

  // Reject disallowed origins
  if (!headers['Access-Control-Allow-Origin']) {
    return new Response('Forbidden', { status: 403 });
  }

  // ── Rate limiting (H1) ───────────────────────────────────────────────────
  if (ratelimit) {
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      req.headers.get('x-real-ip') ??
      'anonymous';
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return new Response('Too Many Requests', { status: 429, headers });
    }
  }

  // ── Parse & validate body (H2 + M4) ─────────────────────────────────────
  let messages: z.infer<typeof MessageSchema>[];
  let lang: 'en' | 'pl';

  try {
    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return new Response('Bad Request: ' + parsed.error.issues[0]?.message, {
        status: 400,
        headers,
      });
    }
    messages = parsed.data.messages;
    lang = parsed.data.lang === 'pl' ? 'pl' : 'en';
  } catch {
    return new Response('Bad Request', { status: 400, headers });
  }

  // RAG: embed last user message, retrieve relevant Klaumark content
  const lastUserMsg =
    [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';

  let context = '';
  try {
    context = await findRelevantContent(lastUserMsg, lang);
  } catch (err) {
    console.error('Upstash query failed:', err);
    // Proceed without RAG context rather than failing entirely
  }

  // AI SDK tool definitions — complement RAG with precise structured lookups.
  const tools = {
    getPackageInfo: tool({
      description:
        'Returns structured pricing and features for a specific Klaumark smart home package. ' +
        'Use this when the user asks about the price, devices, or details of a named package ' +
        '(e.g. "ECO", "SAFE HOME", "KOMFORT").',
      inputSchema: zodSchema(
        z.object({
          packageName: z
            .string()
            .describe('The package name or a partial match, e.g. "eco", "safe", "komfort"'),
        }),
      ),
      execute: async (input) => {
        const normalized = input.packageName.toLowerCase();
        const pkg = PACKAGES.find(
          (p) =>
            p.names.en.toLowerCase().includes(normalized) ||
            p.names.pl.toLowerCase().includes(normalized) ||
            p.id.includes(normalized),
        );
        if (!pkg) {
          return { found: false, message: `No package matching "${input.packageName}" found.` };
        }
        return {
          found: true,
          id: pkg.id,
          name: lang === 'pl' ? pkg.names.pl : pkg.names.en,
          servicePrice: pkg.servicePrice,
          devicesPrice: pkg.devicesPrice,
          advantages: lang === 'pl' ? pkg.advantages.pl : pkg.advantages.en,
        };
      },
    }),

    getFAQ: tool({
      description:
        'Returns a specific FAQ answer by topic keyword. ' +
        'Use this when the user asks a question that maps to a known FAQ topic ' +
        '(e.g. "installation", "cost", "ecosystem", "internet", "energy", "privacy").',
      inputSchema: zodSchema(
        z.object({
          topic: z
            .string()
            .describe(
              'Topic keyword matching a known FAQ, e.g. "installation", "cost", "ecosystem", "internet", "energy", "privacy", "renovation", "remote", "existing-devices"',
            ),
        }),
      ),
      execute: async (input) => {
        const normalized = input.topic.toLowerCase();
        const faq = FAQS.find((f) => f.topic.toLowerCase().includes(normalized));
        if (!faq) {
          return { found: false, message: `No FAQ matching topic "${input.topic}" found.` };
        }
        return {
          found: true,
          topic: faq.topic,
          question: lang === 'pl' ? faq.q.pl : faq.q.en,
          answer: lang === 'pl' ? faq.a.pl : faq.a.en,
        };
      },
    }),
  };

  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: buildSystemPrompt(context, lang),
    messages,
    maxOutputTokens: 400,
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toTextStreamResponse({ headers });
}
