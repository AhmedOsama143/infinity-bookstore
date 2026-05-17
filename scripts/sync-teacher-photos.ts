/**
 * Re-upload selected teacher photos to Supabase Storage and update
 * teachers.photo_url. Does NOT touch teachers row data, books, or stock.
 *
 * Run: npx tsx scripts/sync-teacher-photos.ts
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SR_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SR_KEY) {
  console.error('Missing SUPABASE env vars');
  process.exit(1);
}

const supa = createClient(SUPA_URL, SR_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// IDs whose photos were replaced locally on 2026-05-13 (new logo).
const TEACHER_IDS = [2, 3, 4, 5, 9, 10, 14, 15, 16];
const LOCAL_DIR = 'assets/teachers';
const BUCKET = 'teacher-photos';

async function syncOne(id: number) {
  const fileName = `teacher_${id}.jpeg`;
  const localPath = join(LOCAL_DIR, fileName);
  if (!existsSync(localPath)) {
    console.warn(`  ! ${id} missing local file ${localPath}`);
    return;
  }

  const buffer = await readFile(localPath);
  const { error: upErr } = await supa.storage.from(BUCKET).upload(fileName, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '3600',
  });
  if (upErr) {
    console.warn(`  ! ${id} upload failed: ${upErr.message}`);
    return;
  }

  const { data } = supa.storage.from(BUCKET).getPublicUrl(fileName);
  // Cache-bust so CDN/browsers fetch the new image instead of the cached old one.
  const photo_url = `${data.publicUrl}?v=${Date.now()}`;

  const { error: dbErr } = await supa
    .from('teachers')
    .update({ photo_url })
    .eq('id', id);
  if (dbErr) {
    console.warn(`  ! ${id} db update failed: ${dbErr.message}`);
    return;
  }

  console.log(`  ✓ ${id}  uploaded + photo_url set`);
}

async function main() {
  console.log(`Syncing ${TEACHER_IDS.length} teacher photos to ${BUCKET}...\n`);
  for (const id of TEACHER_IDS) {
    await syncOne(id);
  }
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('\n💥 Sync failed:', err);
  process.exit(1);
});
