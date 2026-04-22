import Link from 'next/link';
import Image from 'next/image';
import type { BookWithTeacher } from '@/lib/types';
import { fallbackCover, formatPrice, gradeLabelAr } from '@/lib/utils';

interface Props {
  book: BookWithTeacher;
  inStockBranches?: number;
}

export default function BookCard({ book, inStockBranches }: Props) {
  const cover = book.cover_url ?? fallbackCover(book.title_ar);
  const hasDiscount = book.discount_pct > 0;

  return (
    <div className="card card-hover overflow-hidden relative flex flex-col">
      {hasDiscount && (
        <span className="absolute top-3 right-3 bg-accent text-white px-3 py-1 rounded-pill text-xs font-bold z-10">
          خصم {book.discount_pct}%
        </span>
      )}

      <Link href={`/books/${book.id}`} className="block">
        <div className="relative w-full h-64 bg-bg-light">
          <Image
            src={cover}
            alt={book.title_ar}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
            unoptimized={cover.startsWith('data:')}
          />
        </div>
      </Link>

      <div className="p-4 flex-1 flex flex-col">
        <span className="inline-block self-start bg-primary-light text-primary-dark px-3 py-0.5 rounded-pill text-xs font-semibold mb-2">
          {gradeLabelAr[book.grade_level]}
        </span>
        <Link href={`/books/${book.id}`}>
          <h3 className="text-base font-bold leading-normal mb-1 hover:text-primary transition-colors line-clamp-2">
            {book.title_ar}
          </h3>
        </Link>
        {book.teacher && (
          <Link
            href={`/teachers/${book.teacher.id}`}
            className="text-[#888] text-sm mb-2 hover:text-primary transition-colors"
          >
            {book.teacher.name_ar}
          </Link>
        )}

        <div className="mt-auto">
          <div className="text-[1.15rem] font-extrabold text-accent-dark mb-1">
            {formatPrice(book.final_price)}
            {hasDiscount && (
              <span className="text-sm font-normal text-[#999] line-through mr-2">
                {formatPrice(book.price)}
              </span>
            )}
          </div>
          {inStockBranches !== undefined && (
            <p className="text-xs text-[#666]">
              {inStockBranches > 0 ? (
                <>
                  <i className="fa-solid fa-circle-check text-success ml-1" />
                  متوفر في {inStockBranches} {inStockBranches === 1 ? 'فرع' : 'فروع'}
                </>
              ) : (
                <>
                  <i className="fa-solid fa-circle-xmark text-danger ml-1" />
                  نفدت الكمية
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 pt-0 flex gap-2">
        <Link href={`/books/${book.id}`} className="btn btn-primary flex-1 text-center text-sm py-2">
          التفاصيل
        </Link>
      </div>
    </div>
  );
}
