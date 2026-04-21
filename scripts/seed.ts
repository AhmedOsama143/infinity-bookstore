/**
 * Phase 1 dynamic seed.
 *
 * Parses teachers.md + books.md, uploads images to Supabase Storage,
 * and inserts 22 teachers, 47 books, and 3 × 47 branch_stock rows
 * (evenly split across branches; admin can adjust later).
 *
 * Run: npx tsx scripts/seed.ts
 */

import { readFile, readdir } from 'node:fs/promises';
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

// ============================================================================
// Storage bucket setup
// ============================================================================
async function ensureBuckets() {
  const needed = [
    { id: 'teacher-photos', public: true },
    { id: 'book-covers', public: true },
    { id: 'banners', public: true },
  ];
  const { data: existing } = await supa.storage.listBuckets();
  const existingIds = new Set((existing ?? []).map((b) => b.id));
  for (const b of needed) {
    if (!existingIds.has(b.id)) {
      const { error } = await supa.storage.createBucket(b.id, { public: b.public });
      if (error) throw error;
      console.log(`  ✓ created bucket: ${b.id}`);
    } else {
      console.log(`  = bucket exists: ${b.id}`);
    }
  }
}

async function uploadAsset(
  bucket: string,
  localPath: string,
  remoteName: string
): Promise<string | null> {
  if (!existsSync(localPath)) return null;
  const buffer = await readFile(localPath);
  const ext = localPath.split('.').pop() ?? 'jpg';
  const contentType =
    ext === 'png' ? 'image/png' : ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'application/octet-stream';
  const { error } = await supa.storage.from(bucket).upload(remoteName, buffer, {
    contentType,
    upsert: true,
  });
  if (error) {
    console.warn(`    ! upload failed ${remoteName}: ${error.message}`);
    return null;
  }
  const { data } = supa.storage.from(bucket).getPublicUrl(remoteName);
  return data.publicUrl;
}

// ============================================================================
// teachers.md parser
// ============================================================================
interface Teacher {
  id: number;
  name_ar: string;
  governorate: string | null;
  subject: string | null;
  description: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
}

async function parseTeachers(): Promise<Teacher[]> {
  const md = await readFile('teachers.md', 'utf-8');
  const sections = md.split(/^### /m).slice(1); // skip preamble
  const teachers: Teacher[] = [];

  for (const section of sections) {
    const idMatch = section.match(/\(ID:\s*(\d+)\)/);
    if (!idMatch) continue;
    const id = parseInt(idMatch[1], 10);

    const nameMatch = section.match(/\*\*الاسم:\*\*\s*(.+)/);
    const govMatch = section.match(/\*\*المحافظة:\*\*\s*([^(]+)/);
    const fbMatch = section.match(/\*\*facebookUrl:\*\*\s*(\S+)/);
    const ytMatch = section.match(/\*\*instagramUrl.*?\*\*\s*(\S+)/);
    const webMatch = section.match(/\*\*tiktokUrl.*?\*\*\s*(\S+)/);

    // Subject is in the "الوصف / التخصص" block
    const descMatch = section.match(/\*\*الوصف \/ التخصص:\*\*\s*\n\s*>\s*([\s\S]*?)(?=\n\n-|\n- \*\*الحالة)/);
    const descRaw = descMatch ? descMatch[1].replace(/^\s*>\s*/gm, '').trim() : null;

    teachers.push({
      id,
      name_ar: (nameMatch?.[1] ?? '').trim(),
      governorate: govMatch?.[1]?.trim() || null,
      subject: descRaw?.split('\n')[0]?.slice(0, 200) || null,
      description: descRaw,
      facebook_url: fbMatch?.[1]?.trim() || null,
      youtube_url: ytMatch?.[1]?.trim() || null,
      website_url: webMatch?.[1]?.trim() || null,
    });
  }
  return teachers;
}

// ============================================================================
// books.md parser
// ============================================================================
interface Book {
  id: number;
  title_ar: string;
  teacher_id: number | null;
  grade_level: 'first_secondary' | 'second_secondary' | 'third_secondary';
  book_type: 'external_ar' | 'online_ar';
  price: number;
  discount_pct: number;
  weight_grams: number | null;
  publish_year: number | null;
  initial_stock: number;           // raw from md, may be negative
  needs_review: boolean;
}

function mapGrade(raw: string): Book['grade_level'] {
  if (raw.includes('الثالث')) return 'third_secondary';
  if (raw.includes('الثاني')) return 'second_secondary';
  return 'first_secondary';
}

function mapType(raw: string): Book['book_type'] {
  return raw.includes('اونلاين') ? 'online_ar' : 'external_ar';
}

async function parseBooks(teacherMap: Map<string, number>): Promise<Book[]> {
  const md = await readFile('books.md', 'utf-8');
  // The table is "| # | الاسم | الصف | النوع | السعر | الخصم | السعر النهائي | المخزون | الوزن (جم) | سنة النشر | نشط |"
  const tableLines = md
    .split('\n')
    .filter((l) => /^\|\s*\d+/.test(l)); // data rows only

  const books: Book[] = [];

  for (const line of tableLines) {
    const cells = line.split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 10) continue;

    const id = parseInt(cells[0], 10);
    const title = cells[1];
    const grade = mapGrade(cells[2]);
    const type = mapType(cells[3]);
    const price = parseFloat(cells[4]);
    const discountAmount = parseFloat(cells[5]);
    const discountPct = price > 0 ? Math.round((discountAmount / price) * 100 * 100) / 100 : 0;
    const stockRaw = parseInt(cells[7], 10);
    const weight = cells[8] && cells[8] !== '' ? parseFloat(cells[8]) : null;
    const year = cells[9] && cells[9] !== '' ? parseInt(cells[9], 10) : null;

    // Best-effort teacher match: look for teacher name as prefix of title
    let teacher_id: number | null = null;
    for (const [name, tid] of teacherMap.entries()) {
      if (title.includes(name)) {
        teacher_id = tid;
        break;
      }
    }

    books.push({
      id,
      title_ar: title,
      teacher_id,
      grade_level: grade,
      book_type: type,
      price,
      discount_pct: isFinite(discountPct) ? discountPct : 0,
      weight_grams: weight,
      publish_year: year,
      initial_stock: Number.isFinite(stockRaw) ? stockRaw : 0,
      needs_review: stockRaw < 0,
    });
  }
  return books;
}

// ============================================================================
// Main
// ============================================================================
async function main() {
  console.log('=== Phase 1 seed ===\n');

  console.log('1. Ensuring storage buckets...');
  await ensureBuckets();

  console.log('\n2. Parsing teachers.md...');
  const teachers = await parseTeachers();
  console.log(`   parsed ${teachers.length} teachers`);

  console.log('\n3. Uploading teacher photos + inserting rows...');
  const teacherRows: any[] = [];
  for (const t of teachers) {
    const localDir = 'assets/teachers';
    const files = await readdir(localDir);
    const match = files.find((f) => new RegExp(`^teacher_${t.id}\\.`).test(f));
    const photo_url = match
      ? await uploadAsset('teacher-photos', join(localDir, match), match)
      : null;
    teacherRows.push({ ...t, photo_url });
    process.stdout.write(`   ${t.id} ${t.name_ar.padEnd(24)} ${photo_url ? '📷' : '  '}\n`);
  }
  const { error: tErr } = await supa.from('teachers').upsert(teacherRows, { onConflict: 'id' });
  if (tErr) throw tErr;
  console.log(`   ✓ inserted ${teacherRows.length} teachers`);

  console.log('\n4. Parsing books.md...');
  const teacherNameToId = new Map(teachers.map((t) => [t.name_ar, t.id]));
  const books = await parseBooks(teacherNameToId);
  console.log(`   parsed ${books.length} books (${books.filter((b) => b.needs_review).length} flagged for review)`);

  console.log('\n5. Uploading book covers + inserting rows...');
  const bookLocalDir = 'assets/books';
  const bookFiles = await readdir(bookLocalDir);
  const bookRows: any[] = [];
  for (const b of books) {
    const match = bookFiles.find((f) => new RegExp(`^book_${b.id}\\.`).test(f));
    const cover_url = match
      ? await uploadAsset('book-covers', join(bookLocalDir, match), match)
      : null;
    bookRows.push({
      id: b.id,
      title_ar: b.title_ar,
      teacher_id: b.teacher_id,
      grade_level: b.grade_level,
      book_type: b.book_type,
      price: b.price,
      discount_pct: b.discount_pct,
      weight_grams: b.weight_grams,
      publish_year: b.publish_year,
      cover_url,
      needs_review: b.needs_review,
    });
  }
  const { error: bErr } = await supa.from('books').upsert(bookRows, { onConflict: 'id' });
  if (bErr) throw bErr;
  console.log(`   ✓ inserted ${bookRows.length} books`);

  console.log('\n6. Seeding branch_stock (even split across 3 branches)...');
  const { data: branches, error: brErr } = await supa.from('branches').select('id, slug');
  if (brErr) throw brErr;
  if (!branches || branches.length === 0) throw new Error('No branches found — run migrations first');

  const stockRows: any[] = [];
  for (const b of books) {
    const total = Math.max(0, b.initial_stock); // clamp negatives
    const perBranch = Math.floor(total / branches.length);
    const remainder = total - perBranch * branches.length;
    branches.forEach((br, i) => {
      stockRows.push({
        branch_id: br.id,
        book_id: b.id,
        quantity: perBranch + (i < remainder ? 1 : 0),
        reserved_quantity: 0,
      });
    });
  }
  const { error: sErr } = await supa
    .from('branch_stock')
    .upsert(stockRows, { onConflict: 'branch_id,book_id' });
  if (sErr) throw sErr;
  console.log(`   ✓ inserted ${stockRows.length} branch_stock rows`);

  console.log('\n=== Done ===');
  console.log(`Teachers:     ${teacherRows.length}`);
  console.log(`Books:        ${bookRows.length} (${bookRows.filter((b) => b.needs_review).length} flagged)`);
  console.log(`Branch stock: ${stockRows.length} rows (3 branches × ${books.length} books)`);
}

main().catch((err) => {
  console.error('\n💥 Seed failed:', err);
  process.exit(1);
});
