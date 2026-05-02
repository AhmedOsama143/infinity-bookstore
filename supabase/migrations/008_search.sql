-- Trigram-backed fuzzy search across books and teachers (Arabic-aware).
-- pg_trgm is already enabled in 001_initial_schema.sql.

-- Indexes accelerate the % operator and similarity() ranking.
CREATE INDEX IF NOT EXISTS books_title_ar_trgm_idx
  ON public.books USING GIN (title_ar gin_trgm_ops);

CREATE INDEX IF NOT EXISTS teachers_name_ar_trgm_idx
  ON public.teachers USING GIN (name_ar gin_trgm_ops);

CREATE INDEX IF NOT EXISTS teachers_subject_trgm_idx
  ON public.teachers USING GIN (subject gin_trgm_ops);

-- Lower trigram threshold a bit so partial Arabic words match.
-- (Default is 0.3; we want broader matching for short queries.)
-- Note: this is set at session level, no GUC change needed here.

-- Search books by trigram similarity, ordered by best match.
CREATE OR REPLACE FUNCTION public.search_books(q text, lim integer DEFAULT 24)
RETURNS SETOF public.books
LANGUAGE sql
STABLE
AS $$
  SELECT b.*
  FROM public.books b
  WHERE b.is_active = true
    AND (
      b.title_ar % q
      OR b.title_ar ILIKE '%' || q || '%'
      OR b.description ILIKE '%' || q || '%'
    )
  ORDER BY GREATEST(
    similarity(b.title_ar, q),
    similarity(COALESCE(b.description, ''), q) * 0.5
  ) DESC
  LIMIT lim;
$$;

-- Search teachers by name or subject.
CREATE OR REPLACE FUNCTION public.search_teachers(q text, lim integer DEFAULT 12)
RETURNS SETOF public.teachers
LANGUAGE sql
STABLE
AS $$
  SELECT t.*
  FROM public.teachers t
  WHERE t.is_active = true
    AND (
      t.name_ar % q
      OR t.name_ar ILIKE '%' || q || '%'
      OR t.subject % q
      OR t.subject ILIKE '%' || q || '%'
    )
  ORDER BY GREATEST(
    similarity(t.name_ar, q),
    similarity(COALESCE(t.subject, ''), q) * 0.7
  ) DESC
  LIMIT lim;
$$;

-- Allow public roles to call the search RPCs.
GRANT EXECUTE ON FUNCTION public.search_books(text, integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_teachers(text, integer) TO anon, authenticated;
