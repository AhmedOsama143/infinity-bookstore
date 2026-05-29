-- 023_arabic_search_normalization.sql
--
-- Fix: searching for "خالد" returned 0 books / 0 teachers even though a book
-- titled "خالد صقر ..." by teacher "خالد صقر" exists. Cause: stored Arabic
-- text and user input use different Unicode forms of visually-identical
-- letters (alif: ا/أ/إ/آ/ٱ, ya: ي/ى, ta marbuta: ه/ة, plus tashkeel and
-- tatweel). Neither ILIKE nor trigram (`%`) treat those as equal.
--
-- This migration adds an IMMUTABLE normalize_ar() function, rebuilds the
-- search RPCs to compare normalized values on both sides, and replaces the
-- raw trigram indexes with expression indexes on the normalized columns so
-- the GIN trgm index is still usable.

CREATE OR REPLACE FUNCTION public.normalize_ar(s text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(
    regexp_replace(
      translate(
        coalesce(s, ''),
        -- alif variants → ا, alif maksura → ي, ta marbuta → ه,
        -- waw-hamza → و, ya-hamza → ي, tatweel (stripped via short to-set)
        E'أإآٱىةؤئـ',
        E'اااايهوي'
      ),
      -- strip tashkeel (fatha..sukun, shadda, etc.) and superscript alef
      E'[ً-ْٰ]',
      '',
      'g'
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.normalize_ar(text) TO anon, authenticated;

-- Replace raw-text trigram indexes with normalized expression indexes.
DROP INDEX IF EXISTS public.books_title_ar_trgm_idx;
DROP INDEX IF EXISTS public.idx_books_title_trgm;
DROP INDEX IF EXISTS public.teachers_name_ar_trgm_idx;
DROP INDEX IF EXISTS public.teachers_subject_trgm_idx;

CREATE INDEX IF NOT EXISTS books_title_ar_norm_trgm_idx
  ON public.books USING GIN (public.normalize_ar(title_ar) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS books_description_norm_trgm_idx
  ON public.books USING GIN (public.normalize_ar(description) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS teachers_name_ar_norm_trgm_idx
  ON public.teachers USING GIN (public.normalize_ar(name_ar) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS teachers_subject_norm_trgm_idx
  ON public.teachers USING GIN (public.normalize_ar(subject) gin_trgm_ops);

-- Books search: also match by teacher name so "خالد" finds books authored by
-- "خالد صقر" even if the title itself does not contain the query.
CREATE OR REPLACE FUNCTION public.search_books(q text, lim integer DEFAULT 24)
RETURNS SETOF public.books
LANGUAGE sql
STABLE
AS $$
  WITH nq AS (SELECT public.normalize_ar(q) AS v)
  SELECT b.*
  FROM public.books b
  LEFT JOIN public.teachers t ON t.id = b.teacher_id
  CROSS JOIN nq
  WHERE b.is_active = true
    AND nq.v <> ''
    AND (
      public.normalize_ar(b.title_ar) % nq.v
      OR public.normalize_ar(b.title_ar) ILIKE '%' || nq.v || '%'
      OR public.normalize_ar(coalesce(b.description, '')) ILIKE '%' || nq.v || '%'
      OR public.normalize_ar(coalesce(t.name_ar, '')) ILIKE '%' || nq.v || '%'
      OR public.normalize_ar(coalesce(t.name_ar, '')) % nq.v
    )
  ORDER BY GREATEST(
    similarity(public.normalize_ar(b.title_ar), nq.v),
    similarity(public.normalize_ar(coalesce(t.name_ar, '')), nq.v) * 0.9,
    similarity(public.normalize_ar(coalesce(b.description, '')), nq.v) * 0.5
  ) DESC
  LIMIT lim;
$$;

CREATE OR REPLACE FUNCTION public.search_teachers(q text, lim integer DEFAULT 12)
RETURNS SETOF public.teachers
LANGUAGE sql
STABLE
AS $$
  WITH nq AS (SELECT public.normalize_ar(q) AS v)
  SELECT t.*
  FROM public.teachers t
  CROSS JOIN nq
  WHERE t.is_active = true
    AND nq.v <> ''
    AND (
      public.normalize_ar(t.name_ar) % nq.v
      OR public.normalize_ar(t.name_ar) ILIKE '%' || nq.v || '%'
      OR public.normalize_ar(coalesce(t.subject, '')) % nq.v
      OR public.normalize_ar(coalesce(t.subject, '')) ILIKE '%' || nq.v || '%'
    )
  ORDER BY GREATEST(
    similarity(public.normalize_ar(t.name_ar), nq.v),
    similarity(public.normalize_ar(coalesce(t.subject, '')), nq.v) * 0.7
  ) DESC
  LIMIT lim;
$$;

GRANT EXECUTE ON FUNCTION public.search_books(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_teachers(text, integer) TO anon, authenticated;
