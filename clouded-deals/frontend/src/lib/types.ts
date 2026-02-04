export type Category =
  | "flower"
  | "preroll"
  | "vape"
  | "edible"
  | "concentrate";

export type Platform = "dutchie" | "curaleaf" | "jane";

export interface Dispensary {
  id: string;
  name: string;
  url: string;
  platform: Platform;
  address: string | null;
  city: string | null;
  state: string | null;
  is_active: boolean;
}

export interface Product {
  id: string;
  dispensary_id: string;
  name: string;
  brand: string | null;
  category: Category | null;
  original_price: number | null;
  sale_price: number | null;
  discount_percent: number | null;
  weight_value: number | null;
  weight_unit: string | null;
  thc_percent: number | null;
  cbd_percent: number | null;
  raw_text: string | null;
  scraped_at: string;
}

export interface Deal {
  id: string;
  product_id: string;
  dispensary_id: string;
  deal_score: number;
  is_posted: boolean;
  posted_at: string | null;
  created_at: string;
  // Joined fields from the query
  product?: Product;
  dispensary?: Dispensary;
}

export interface DealFilters {
  category: Category | "all";
  dispensary_id: string | "all";
  min_price: number;
  max_price: number;
  min_discount: number;
}

export const DEFAULT_FILTERS: DealFilters = {
  category: "all",
  dispensary_id: "all",
  min_price: 0,
  max_price: 100,
  min_discount: 20,
};

export const CATEGORY_LABELS: Record<Category | "all", string> = {
  all: "All Categories",
  flower: "Flower",
  preroll: "Pre-Rolls",
  vape: "Vape",
  edible: "Edibles",
  concentrate: "Concentrates",
};
