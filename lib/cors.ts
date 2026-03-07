export const ALLOWED_ORIGINS = [
  'https://klaumark.com',
  'http://localhost:8000',
  'http://localhost:3000',
  'http://localhost',
];

export function corsHeaders(origin: string): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.some((o) => origin.startsWith(o));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

export function handleOptions(origin: string): Response {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
