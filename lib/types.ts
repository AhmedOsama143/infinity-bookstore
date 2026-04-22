// Types mirror the Supabase schema in supabase/migrations/001_initial_schema.sql.
// When the schema changes, update here (or regenerate via `supabase gen types`).

export type GradeLevel = 'first_secondary' | 'second_secondary' | 'third_secondary';
export type BookType = 'external_ar' | 'online_ar';
export type FulfillmentType = 'pickup' | 'delivery';
export type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'completed' | 'cancelled';
export type PaymentMethod = 'cod' | 'card' | 'wallet' | 'fawry' | 'instapay' | 'bank_transfer';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type ShippingAreaType =
  | 'alexandria_city'
  | 'alexandria_outskirts'
  | 'kafr_el_dawwar'
  | 'other_governorate';

export interface Branch {
  id: string;
  slug: string;
  name_ar: string;
  city: string;
  area: string | null;
  address_ar: string;
  phone: string;
  whatsapp: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface Teacher {
  id: number;
  name_ar: string;
  governorate: string | null;
  subject: string | null;
  description: string | null;
  photo_url: string | null;
  facebook_url: string | null;
  youtube_url: string | null;
  website_url: string | null;
  is_active: boolean;
}

export interface Book {
  id: number;
  title_ar: string;
  teacher_id: number | null;
  grade_level: GradeLevel;
  book_type: BookType;
  description: string | null;
  cover_url: string | null;
  price: number;
  discount_pct: number;
  final_price: number;
  weight_grams: number | null;
  publish_year: number | null;
  isbn: string | null;
  is_active: boolean;
  needs_review: boolean;
}

export interface BranchStock {
  branch_id: string;
  book_id: number;
  quantity: number;
  reserved_quantity: number;
  updated_at: string;
}

export interface ShippingRate {
  id: string;
  governorate_ar: string;
  area_type: ShippingAreaType;
  price: number;
  is_active: boolean;
}

export interface SiteSettings {
  id: number;
  free_shipping_threshold: number;
  free_shipping_enabled: boolean;
  announcement_bar_text_ar: string | null;
  announcement_bar_enabled: boolean;
  student_book_cap: number;
  abandoned_cart_enabled: boolean;
  reservation_hold_hours: number;
  support_phone: string | null;
  support_whatsapp: string | null;
  updated_at: string;
}

export interface SiteContent {
  key: string;
  title_ar: string | null;
  body_ar: string | null;
  updated_at: string;
}

// Derived/enriched types used across UI
export interface BookWithTeacher extends Book {
  teacher: Pick<Teacher, 'id' | 'name_ar' | 'photo_url'> | null;
}

export interface BookAvailability {
  book_id: number;
  branches_in_stock: Array<Pick<Branch, 'id' | 'slug' | 'name_ar'> & { quantity: number }>;
  total_available: number;
}
