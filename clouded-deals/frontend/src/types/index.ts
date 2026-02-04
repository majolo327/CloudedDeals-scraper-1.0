export type Zone = 'strip' | 'downtown' | 'local' | 'henderson' | 'north';

export type Tier = 'verified' | 'premium' | 'standard';

export type BrandTier = 'premium' | 'established' | 'local' | 'value';

export type Category = 'flower' | 'preroll' | 'vape' | 'edible' | 'concentrate';

export type Page = 'home' | 'browse' | 'saved';

export type DealSource = 'dutchie' | 'curaleaf' | 'jane';

export type DealStatus = 'active' | 'expired' | 'used';

export interface Dispensary {
  id: string;
  name: string;
  slug: string;
  zone: Zone;
  tier: Tier;
  address: string;
  menu_url: string;
  platform: DealSource;
  is_active: boolean;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  tier: BrandTier;
  categories: Category[];
  logo_url?: string;
}

export interface Deal {
  id: string;
  product_name: string;
  category: Category;
  weight: string;
  original_price: number | null;
  deal_price: number;
  dispensary: { id: string; name: string };
  brand: { id: string; name: string };
  deal_score: number;
  is_top_pick: boolean;
  is_staff_pick: boolean;
  is_featured: boolean;
  is_verified: boolean;
  is_pinned?: boolean;
  pinned_position?: number | null;
  source: DealSource;
  status: DealStatus;
  created_at: string;
}
