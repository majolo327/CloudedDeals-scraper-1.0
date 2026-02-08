export type Tier = 'verified' | 'premium' | 'standard';

export type BrandTier = 'premium' | 'established' | 'local' | 'value';

export type Category = 'flower' | 'preroll' | 'vape' | 'edible' | 'concentrate';

export type Page = 'home' | 'browse' | 'saved';

export type DealSource = 'dutchie' | 'curaleaf' | 'jane';

export type DealStatus = 'active' | 'expired' | 'used';

export type DispensaryZone = 'strip' | 'downtown' | 'local';

export interface Dispensary {
  id: string;
  name: string;
  slug: string;
  tier: Tier;
  address: string;
  menu_url: string;
  platform: DealSource;
  is_active: boolean;
  region?: string;
  zone?: DispensaryZone;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Brand {
  id: string;
  name: string;
  slug: string;
  tier: BrandTier;
  categories: Category[];
  logo_url?: string;
}

export type BadgeType = 'steal' | 'fire' | 'solid';

export interface Deal {
  id: string;
  product_name: string;
  category: Category;
  weight: string;
  original_price: number | null;
  deal_price: number;
  dispensary: Dispensary;
  brand: Brand;
  deal_score: number;
  is_verified: boolean;
  product_url?: string | null;
  editorial_note?: string;
  save_count?: number;
  created_at: Date;
  first_seen_at?: Date;
  updated_at?: Date;
  source?: DealSource;
  status?: DealStatus;
}
