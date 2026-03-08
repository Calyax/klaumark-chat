import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Validate VAPI webhook secret
  const secret = req.headers.get('x-vapi-secret');
  if (!secret || secret !== process.env.VAPI_WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: {
    message?: {
      type?: string;
      toolCallList?: Array<{
        id: string;
        type: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  };
  try {
    body = await req.json();
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  // Extract tool call list from VAPI payload
  const toolCallList = body?.message?.toolCallList ?? [];
  const results = await Promise.all(
    toolCallList.map(
      async (tc: {
        id: string;
        type: string;
        function?: { name?: string; arguments?: string };
      }) => {
        const toolCallId = tc.id;
        const fnName = tc.function?.name;
        let args: Record<string, string> = {};
        try {
          args = JSON.parse(tc.function?.arguments ?? '{}');
        } catch {
          /* ignore malformed args */
        }

        if (fnName === 'capture_lead') {
          const { name, email } = args;
          // Log lead — console for now; extend to DB/email in a future phase
          console.log('[lead:phone]', {
            name,
            email,
            ts: new Date().toISOString(),
          });
          return {
            toolCallId,
            result:
              'Lead captured. Please thank the customer by name and let them know the Klaumark team will contact them within 24 hours.',
          };
        }

        return { toolCallId, result: 'Unknown tool.' };
      },
    ),
  );

  return Response.json({ results });
}
