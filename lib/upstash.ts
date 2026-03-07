import { Index } from '@upstash/vector';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';

const index = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

export async function findRelevantContent(
  query: string,
  lang: 'en' | 'pl',
  topK = 4
): Promise<string> {
  const { embedding } = await embed({
    model: openai.embedding('text-embedding-3-small'),
    value: query,
  });
  const results = await index.query({
    vector: embedding,
    topK,
    includeMetadata: true,
    filter: `lang = '${lang}'`,
  });
  return results
    .map((r) => (r.metadata as { text: string }).text)
    .join('\n\n');
}
