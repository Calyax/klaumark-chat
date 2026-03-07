import { Index } from '@upstash/vector';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env.local for local execution
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

interface Chunk {
  id: string;
  lang: string;
  topic: string;
  text: string;
}

async function seedIndex(
  url: string,
  token: string,
  label: string,
  chunks: Chunk[]
) {
  const index = new Index({ url, token });

  console.log(`Seeding ${label} with ${chunks.length} chunks...`);

  // Process in batches of 10 to avoid rate limits
  const BATCH = 10;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const vectors = await Promise.all(
      batch.map(async (chunk) => {
        const { embedding } = await embed({
          model: openai.embedding('text-embedding-3-small'),
          value: chunk.text,
        });
        return {
          id: chunk.id,
          vector: embedding,
          metadata: {
            text: chunk.text,
            lang: chunk.lang,
            topic: chunk.topic,
          },
        };
      })
    );
    await index.upsert(vectors);
    console.log(`  Upserted batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(chunks.length / BATCH)}`);
  }
  console.log(`Done seeding ${label}.`);
}

async function main() {
  const kbPath = path.join(__dirname, 'knowledge-base.json');
  const chunks: Chunk[] = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));

  console.log(`Loaded ${chunks.length} chunks from knowledge-base.json`);

  // Seed production index
  const prodUrl = process.env.UPSTASH_VECTOR_REST_URL!;
  const prodToken = process.env.UPSTASH_VECTOR_REST_TOKEN!;
  if (!prodUrl || !prodToken) {
    throw new Error(
      'Missing UPSTASH_VECTOR_REST_URL or UPSTASH_VECTOR_REST_TOKEN. ' +
      'Add them to .env.local before running this script.'
    );
  }

  await seedIndex(prodUrl, prodToken, 'PROD', chunks);

  // Seed dev index (if configured separately)
  const devUrl = process.env.UPSTASH_VECTOR_REST_URL_DEV;
  const devToken = process.env.UPSTASH_VECTOR_REST_TOKEN_DEV;
  if (devUrl && devToken) {
    await seedIndex(devUrl, devToken, 'DEV', chunks);
  } else {
    console.log('No DEV index env vars set — skipping dev seed.');
  }

  console.log('All indexes seeded successfully.');
}

main().catch((err) => {
  console.error('Seed script failed:', err.message);
  process.exit(1);
});
