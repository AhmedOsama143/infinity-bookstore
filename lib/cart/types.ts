export interface CartItem {
  book_id: number;
  title_ar: string;
  cover_url: string | null;
  unit_price: number;
  quantity: number;
  teacher_name?: string | null;
}
