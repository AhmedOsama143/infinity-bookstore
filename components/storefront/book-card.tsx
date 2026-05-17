import Link from 'next/link';
import Image from 'next/image';
import type { BookWithTeacher } from '@/lib/types';
import { fallbackCover, formatPrice, gradeLabelAr } from '@/lib/utils';
import AddToCartButton from '@/components/cart/add-to-cart-button';

interface Props {
  book: BookWithTeacher;
  inStockBranches?: number;
  // Accepted for caller compatibility (getAvailabilitySummary). Not rendered:
  // we only show binary available / not-available, no copy counts.
  minQty?: number | null;
  minQtyBranchName?: string | null;
}

export default function BookCard({ book, inStockBranches }: Props) {
  const cover = book.cover_url ?? fallbackCover(book.title_ar);
  const hasDiscount = book.discount_pct > 0;
  const outOfStock = inStockBranches !== undefined && inStockBranches === 0;

  return (
    <div className="card card-hover overflow-hidden relative flex flex-col h-full">
      {hasDiscount && (
        <span className="absolute top-3 right-3 bg-accent text-white px-3 py-1 rounded-pill text-xs font-bold z-10 shadow-card">
          خصم {book.discount_pct}%
        </span>
      )}

      <Link href={`/books/${book.id}`} className="block">
        <div className="relative w-full aspect-[3/4] bg-bg-light">
          <Image
            src={cover}
            alt={book.title_ar}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
            unoptimized={cover.startsWith('data:')}
          />
        </div>
      </Link>

      <div className="p-4 flex-1 flex flex-col">
        <span className="inline-block self-start bg-primary-light text-primary-dark px-3 py-0.5 rounded-pill text-[0.7rem] font-semibold mb-2">
          {gradeLabelAr[book.grade_level]}
        </span>

        <Link href={`/books/${book.id}`}>
          <h3 className="text-[0.95rem] font-bold leading-snug mb-1 hover:text-primary transition-colors line-clamp-2 min-h-[2.6em]">
            {book.title_ar}
          </h3>
        </Link>

        {book.teacher && (
          <Link
            href={`/teachers/${book.teacher.id}`}
            className="inline-flex items-center gap-1 text-[#888] text-[0.78rem] mb-3 hover:text-primary transition-colors line-clamp-1 self-start"
          >
            <i className="fa-solid fa-chalkboard-user text-[0.7rem] opacity-70" aria-hidden />
            <span className="truncate">{book.teacher.name_ar}</span>
          </Link>
        )}

        <div className="mt-auto flex items-baseline gap-2 flex-wrap">
          <span className="text-[1.2rem] sm:text-[1.25rem] font-extrabold text-accent-dark whitespace-nowrap leading-none">
            {formatPrice(book.final_price)}
          </span>
          {hasDiscount && (
            <span className="text-xs font-normal text-[#999] line-through whitespace-nowrap leading-none">
              {formatPrice(book.price)}
            </span>
          )}
        </div>

        {inStockBranches !== undefined && (
          <p className="text-[0.7rem] mt-1 line-clamp-1">
            {inStockBranches > 0 ? (
              <span className="text-success font-semibold">
                <i className="fa-solid fa-circle-check ml-1" />
                متوفر
              </span>
            ) : (
              <span className="text-danger font-semibold">
                <i className="fa-solid fa-circle-xmark ml-1" />
                غير متوفر
              </span>
            )}
          </p>
        )}
      </div>

      <div className="p-3 sm:p-4 pt-0 flex gap-1.5 sm:gap-2">
        <Link
          href={`/books/${book.id}`}
          className="btn btn-outline flex-1 text-center text-[0.7rem] sm:text-[0.78rem] py-1.5 sm:py-2 px-1.5 sm:px-2 leading-tight whitespace-nowrap"
        >
          التفاصيل
        </Link>
        <div className="flex-1">
          <AddToCartButton
            full
            compact
            disabled={outOfStock}
            disabledReason={outOfStock ? 'نفدت' : undefined}
            item={{
              book_id: book.id,
              title_ar: book.title_ar,
              cover_url: book.cover_url,
              unit_price: book.final_price,
              teacher_name: book.teacher?.name_ar ?? null,
            }}
          />
        </div>
      </div>
    </div>
  );
}
