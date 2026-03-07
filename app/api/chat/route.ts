import { anthropic } from '@ai-sdk/anthropic';
import { streamText, tool, zodSchema, stepCountIs } from 'ai';
import { z } from 'zod';
import { NextRequest } from 'next/server';
import { findRelevantContent } from '@/lib/upstash';
import { buildSystemPrompt } from '@/lib/system-prompt';
import { corsHeaders, handleOptions } from '@/lib/cors';
import { PACKAGES, FAQS } from '@/lib/knowledge-base';

export const runtime = 'nodejs'; // NOT edge — Upstash Vector SDK needs Node
export const maxDuration = 300; // Vercel Pro: 300s max

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

  let messages: Array<{ role: string; content: string }>;
  let lang: 'en' | 'pl';

  try {
    const body = await req.json();
    messages = body.messages;
    lang = body.lang === 'pl' ? 'pl' : 'en';
  } catch {
    return new Response('Bad Request', { status: 400, headers });
  }

  if (!messages?.length) {
    return new Response('Bad Request: messages required', { status: 400, headers });
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
  // Tools pull from in-memory PACKAGES/FAQS (already seeded in 03-02) to avoid
  // extra Upstash calls. Model invokes these when it needs exact pricing or a
  // specific FAQ answer rather than a semantic search result.
  // AI SDK v6: tool() uses inputSchema (not parameters), execute takes (input, options)
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

  // AI SDK v6: maxOutputTokens replaces maxTokens
  // maxSteps: model can call a tool (step 1) then generate text response (step 2)
  const result = streamText({
    model: anthropic('claude-haiku-4-5'),
    system: buildSystemPrompt(context, lang),
    messages: messages as any,
    maxOutputTokens: 400,
    tools,
    stopWhen: stepCountIs(5),
  });

  // AI SDK v6: toTextStreamResponse() replaces toDataStreamResponse()
  // CORS headers must be on the streaming response itself (not just OPTIONS)
  return result.toTextStreamResponse({ headers });
}
