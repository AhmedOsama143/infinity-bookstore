'use client';
import { useState, useTransition } from 'react';
import { bulkImportBooksCsv, type BulkImportResult } from '@/lib/admin/book-actions';

interface Props {
  branches: { slug: string; name_ar: string }[];
}

export default function BulkImportForm({ branches }: Props) {
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const stockCols = branches.map((b) => `stock_${b.slug}`).join(',');
  const headerLine = `title_ar,teacher_id,grade_level,book_type,price,discount_pct,weight_grams,publish_year,isbn,description${stockCols ? ',' + stockCols : ''}`;
  const sampleLine = `كتاب الفيزياء,1,third_secondary,external_ar,250,10,500,2026,,شرح وافٍ${branches.map(() => ',5').join('')}`;

  function downloadTemplate() {
    const csv = headerLine + '\n' + sampleLine + '\n';
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'books-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="card p-6 space-y-4">
        <h3 className="font-bold text-primary-dark">تعليمات</h3>
        <ul className="text-sm text-[#444] list-disc pr-5 space-y-1.5">
          <li>صيغة الملف: <code className="bg-bg-light px-1.5 py-0.5 rounded">CSV</code> مع ترميز <code className="bg-bg-light px-1.5 py-0.5 rounded">UTF-8</code></li>
          <li>الأعمدة المطلوبة: <code className="bg-bg-light px-1.5 py-0.5 rounded">title_ar, grade_level, book_type, price</code></li>
          <li><b>grade_level</b>: <code className="bg-bg-light px-1.5 py-0.5 rounded">first_secondary</code> | <code className="bg-bg-light px-1.5 py-0.5 rounded">second_secondary</code> | <code className="bg-bg-light px-1.5 py-0.5 rounded">third_secondary</code></li>
          <li><b>book_type</b>: <code className="bg-bg-light px-1.5 py-0.5 rounded">external_ar</code> | <code className="bg-bg-light px-1.5 py-0.5 rounded">online_ar</code></li>
          <li>أعمدة المخزون لكل فرع: {branches.map((b) => <code key={b.slug} className="bg-bg-light px-1.5 py-0.5 rounded mx-1">stock_{b.slug}</code>)}</li>
          <li>إذا تطابق العنوان مع كتاب موجود يتم تحديثه — وإلا يُنشأ كتاب جديد.</li>
        </ul>
        <button type="button" onClick={downloadTemplate} className="btn btn-outline text-sm">
          <i className="fa-solid fa-download ml-2" />
          تحميل قالب CSV جاهز
        </button>
      </div>

      <form
        className="card p-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setResult(null);
          const fd = new FormData(e.currentTarget);
          startTransition(async () => {
            const res = await bulkImportBooksCsv(fd);
            setResult(res);
          });
        }}
      >
        <div>
          <label className="block text-sm font-semibold mb-2">ملف الكتب (CSV)</label>
          <input
            type="file"
            name="csv"
            accept=".csv,text/csv"
            required
            className="block w-full text-sm file:ml-4 file:py-2 file:px-4 file:rounded-pill file:border-0 file:bg-primary-light file:text-primary-dark file:font-semibold hover:file:bg-primary hover:file:text-white"
          />
        </div>
        <button type="submit" disabled={isPending} className="btn btn-primary disabled:opacity-50">
          {isPending ? 'جاري الاستيراد...' : 'استيراد'}
        </button>
      </form>

      {result?.error && (
        <div className="card p-4 bg-danger/10 border border-danger/20 text-danger text-sm">
          <b>فشل:</b> {result.error}
        </div>
      )}

      {result?.ok && (
        <div className="card p-4 bg-success/10 border border-success/20 text-success text-sm">
          <b>تم بنجاح:</b> {result.ok.created} كتاب جديد، {result.ok.updated} كتاب محدّث
        </div>
      )}

      {result?.errors && result.errors.length > 0 && (
        <div className="card p-4 bg-accent/10 border border-accent/20 text-sm">
          <b className="text-accent-dark">تحذيرات على {result.errors.length} صف:</b>
          <ul className="list-disc pr-5 mt-2 space-y-0.5">
            {result.errors.slice(0, 20).map((e, i) => (
              <li key={i}>سطر {e.row}: {e.message}</li>
            ))}
            {result.errors.length > 20 && <li className="text-[#666]">... و {result.errors.length - 20} أخرى</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
