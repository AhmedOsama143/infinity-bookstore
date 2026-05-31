/**
 * Unit tests for the JS side of the search feature (migration 023 ships the
 * Arabic normalization in SQL; this covers the TypeScript glue).
 *
 * The bug-prone bits here are: (a) searchBooks must preserve the RPC's
 * relevance ranking even though the follow-up `.in('id', …)` fetch returns
 * rows in arbitrary order, and (b) getAvailabilitySummary must aggregate
 * branch_stock rows into a per-book summary in a single batched pass.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { rpcMock, inMock, fromMock, createClientMock } = vi.hoisted(() => {
  const rpcMock = vi.fn();
  const inMock = vi.fn();
  const fromMock = vi.fn(() => ({ select: () => ({ in: inMock }) }));
  const createClientMock = vi.fn(async () => ({ rpc: rpcMock, from: fromMock }));
  return { rpcMock, inMock, fromMock, createClientMock };
});

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));

import { searchBooks, searchTeachers, getAvailabilitySummary } from '@/lib/data';

beforeEach(() => {
  rpcMock.mockReset();
  inMock.mockReset();
  fromMock.mockClear();
  createClientMock.mockClear();
});

describe('searchBooks', () => {
  it('returns [] for a blank query without touching the database', async () => {
    expect(await searchBooks('   ')).toEqual([]);
    expect(createClientMock).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('returns [] and skips the detail fetch when the RPC finds nothing', async () => {
    rpcMock.mockResolvedValueOnce({ data: [] });
    expect(await searchBooks('خالد')).toEqual([]);
    expect(rpcMock).toHaveBeenCalledWith('search_books', { q: 'خالد', lim: 24 });
    expect(inMock).not.toHaveBeenCalled();
  });

  it('preserves the RPC relevance order even when the detail fetch is unordered', async () => {
    // RPC ranks 3 > 1 > 2; the `.in()` fetch returns them in PK order.
    rpcMock.mockResolvedValueOnce({ data: [{ id: 3 }, { id: 1 }, { id: 2 }] });
    inMock.mockResolvedValueOnce({
      data: [
        { id: 1, title_ar: 'كتاب ١' },
        { id: 2, title_ar: 'كتاب ٢' },
        { id: 3, title_ar: 'كتاب ٣' },
      ],
    });

    const result = await searchBooks('جبر');
    expect(result.map((b) => b.id)).toEqual([3, 1, 2]);
    expect(inMock).toHaveBeenCalledWith('id', [3, 1, 2]);
  });

  it('honours a custom limit', async () => {
    rpcMock.mockResolvedValueOnce({ data: [] });
    await searchBooks('فيزياء', 5);
    expect(rpcMock).toHaveBeenCalledWith('search_books', { q: 'فيزياء', lim: 5 });
  });
});

describe('searchTeachers', () => {
  it('returns [] for a blank query', async () => {
    expect(await searchTeachers('')).toEqual([]);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('passes the query through to the RPC and returns its rows', async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ id: 7, name_ar: 'خالد صقر' }] });
    const teachers = await searchTeachers('خالد');
    expect(rpcMock).toHaveBeenCalledWith('search_teachers', { q: 'خالد', lim: 12 });
    expect(teachers).toEqual([{ id: 7, name_ar: 'خالد صقر' }]);
  });

  it('coerces a null RPC result to an empty array', async () => {
    rpcMock.mockResolvedValueOnce({ data: null });
    expect(await searchTeachers('nobody')).toEqual([]);
  });
});

describe('getAvailabilitySummary', () => {
  it('returns an empty map for no book ids without querying', async () => {
    const map = await getAvailabilitySummary([]);
    expect(map.size).toBe(0);
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('aggregates per-book: in-stock branch count, total, min qty + its branch', async () => {
    inMock.mockResolvedValueOnce({
      data: [
        { book_id: 1, quantity: 5, reserved_quantity: 0, branch: { name_ar: 'فرع أ' } },
        { book_id: 1, quantity: 3, reserved_quantity: 1, branch: { name_ar: 'فرع ب' } }, // avail 2
        { book_id: 2, quantity: 1, reserved_quantity: 1, branch: { name_ar: 'فرع ج' } }, // avail 0 → skipped
      ],
    });

    const map = await getAvailabilitySummary([1, 2, 3]);

    expect(map.get(1)).toEqual({
      in_stock_branches: 2,
      total_available: 7,
      min_qty: 2,
      min_qty_branch_name: 'فرع ب',
    });
    // Book 2 has only a zero-availability row → counts nothing.
    expect(map.get(2)).toEqual({
      in_stock_branches: 0,
      total_available: 0,
      min_qty: null,
      min_qty_branch_name: null,
    });
    // Book 3 had no rows at all → still present with defaults.
    expect(map.get(3)).toEqual({
      in_stock_branches: 0,
      total_available: 0,
      min_qty: null,
      min_qty_branch_name: null,
    });
  });

  it('handles Supabase returning the to-one branch relation as an array', async () => {
    inMock.mockResolvedValueOnce({
      data: [{ book_id: 9, quantity: 4, reserved_quantity: 0, branch: [{ name_ar: 'الفرع' }] }],
    });
    const map = await getAvailabilitySummary([9]);
    expect(map.get(9)?.min_qty_branch_name).toBe('الفرع');
  });

  it('coerces a null query result to all-default summaries', async () => {
    inMock.mockResolvedValueOnce({ data: null });
    const map = await getAvailabilitySummary([1]);
    expect(map.get(1)?.in_stock_branches).toBe(0);
  });
});
