import type { Dispensary, Tier, DealSource } from '@/types';

/**
 * Static dispensary data for Browse and Search pages.
 *
 * IMPORTANT: These 27 entries are the dispensaries we actively scrape.
 * Their `id` and `slug` fields MUST match the scraper config slugs in
 * `scraper/config/dispensaries.py` so that search results link correctly
 * to deals fetched from Supabase.
 */

function d(
  id: string,
  name: string,
  tier: Tier,
  address: string,
  platform: DealSource,
  menu_url: string
): Dispensary {
  return { id, name, slug: id, tier, address, menu_url, platform, is_active: true };
}

export const DISPENSARIES: Dispensary[] = [
  // ==================================================================
  // DUTCHIE  (10)
  // ==================================================================
  d('td-gibson',           'The Dispensary - Gibson',    'premium',  '50 N Gibson Rd, Henderson, NV 89014',          'dutchie', 'https://thedispensarynv.com/shop-gibson/?dtche%5Bpath%5D=specials'),
  d('td-eastern',          'The Dispensary - Eastern',   'premium',  '5765 S Eastern Ave, Las Vegas, NV 89119',      'dutchie', 'https://thedispensarynv.com/shop-eastern/?dtche%5Bpath%5D=specials'),
  d('td-decatur',          'The Dispensary - Decatur',   'premium',  '5347 S Decatur Blvd, Las Vegas, NV 89118',     'dutchie', 'https://thedispensarynv.com/shop-decatur/?dtche%5Bpath%5D=specials'),
  d('planet13',            'Planet 13',                  'verified', '2548 W Desert Inn Rd, Las Vegas, NV 89109',    'dutchie', 'https://planet13.com/stores/planet-13-dispensary/specials'),
  d('medizin',             'Medizin',                    'verified', '4850 W Sunset Rd, Las Vegas, NV 89118',        'dutchie', 'https://planet13.com/stores/medizin-dispensary/specials'),
  d('greenlight-downtown', 'Greenlight Downtown',        'verified', '200 S Main St, Las Vegas, NV 89101',           'dutchie', 'https://greenlightdispensary.com/downtown-las-vegas-menu/?dtche%5Bpath%5D=specials'),
  d('greenlight-paradise', 'Greenlight Paradise',        'verified', '4155 S Buffalo Dr, Las Vegas, NV 89147',       'dutchie', 'https://greenlightdispensary.com/paradise-menu/?dtche%5Bpath%5D=specials'),
  d('the-grove',           'The Grove',                  'verified', '4647 Swenson St, Las Vegas, NV 89119',         'dutchie', 'https://www.thegrovenv.com/lasvegas/?dtche%5Bpath%5D=specials'),
  d('mint-paradise',       'Mint Paradise',              'verified', '4811 E Flamingo Rd, Las Vegas, NV 89121',      'dutchie', 'https://mintdeals.com/paradise-lv/menu/?dtche%5Bpath%5D=specials'),
  d('mint-rainbow',        'Mint Rainbow',               'verified', '1021 S Rainbow Blvd, Las Vegas, NV 89145',     'dutchie', 'https://mintdeals.com/rainbow-lv/menu/?dtche%5Bpath%5D=specials'),

  // ==================================================================
  // CURALEAF  (4)
  // ==================================================================
  d('curaleaf-western',   'Curaleaf Western',   'verified', '1736 S Las Vegas Blvd, Las Vegas, NV 89104',  'curaleaf', 'https://curaleaf.com/stores/curaleaf-las-vegas-western-ave/specials'),
  d('curaleaf-north-lv',  'Curaleaf North LV',  'verified', '1736 N Rancho Dr, Las Vegas, NV 89106',      'curaleaf', 'https://curaleaf.com/stores/curaleaf-north-las-vegas/specials'),
  d('curaleaf-strip',     'Curaleaf Strip',      'verified', '1736 S Las Vegas Blvd, Las Vegas, NV 89104', 'curaleaf', 'https://curaleaf.com/stores/curaleaf-nv-las-vegas/specials'),
  d('curaleaf-the-reef',  'Curaleaf The Reef',   'verified', '3400 Western Ave, Las Vegas, NV 89109',      'curaleaf', 'https://curaleaf.com/stores/reef-dispensary-las-vegas-strip/specials'),

  // ==================================================================
  // JANE  (13)
  // ==================================================================
  d('oasis',              'Oasis Cannabis',                       'verified', '1800 Industrial Rd, Las Vegas, NV 89102',      'jane', 'https://www.oasiscannabis.com/las-vegas-cannabis-dispensary'),
  d('planet-13',          'Planet 13',                            'verified', '2548 W Desert Inn Rd, Las Vegas, NV 89109',    'jane', 'https://planet13lasvegas.com/menu/'),
  d('reef',               'Reef Dispensaries',                    'premium',  '3400 Western Ave, Las Vegas, NV 89109',        'jane', 'https://www.reefdispensaries.com/las-vegas-menu/'),
  d('showgrow',           'ShowGrow',                             'standard', '4850 W Sunset Rd, Las Vegas, NV 89118',        'jane', 'https://showgrow.com/las-vegas-menu/'),
  d('zen-leaf-lv',        'Zen Leaf - Las Vegas',                 'premium',  '3375 Pepper Ln, Las Vegas, NV 89120',          'jane', 'https://zenleafdispensaries.com/locations/nevada/las-vegas/menu/'),
  d('nuwu',               'NuWu Cannabis Marketplace',            'premium',  '1235 Paiute Cir, Las Vegas, NV 89106',         'jane', 'https://nuwucannabis.com/menu/'),
  d('acres',              'Acres Cannabis',                       'standard', '2320 Western Ave, Las Vegas, NV 89102',        'jane', 'https://acrescannabis.com/menu/'),
  d('jennys-henderson',   "Jenny's Dispensary - Henderson",       'standard', '10420 S Eastern Ave, Henderson, NV 89052',     'jane', 'https://jennysdispensary.com/henderson-menu/'),
  d('jennys-north-lv',    "Jenny's Dispensary - North Las Vegas", 'standard', '8560 W Sunset Rd, Las Vegas, NV 89113',        'jane', 'https://jennysdispensary.com/north-las-vegas-menu/'),
  d('silver-sage',        'Silver Sage Wellness',                 'standard', '3420 Spring Mountain Rd, Las Vegas, NV 89102', 'jane', 'https://silversagewellness.com/menu/'),
  d('pisos',              'Pisos',                                'premium',  '4110 S Maryland Pkwy, Las Vegas, NV 89119',    'jane', 'https://pisoslv.com/menu/'),
  d('green-therapeutics', 'Green Therapeutics',                    'standard', '4850 W Sunset Rd, Las Vegas, NV 89118',        'jane', 'https://greentherapeutics.com/menu/'),
  d('lv-releaf',          'Las Vegas ReLeaf',                     'standard', '2244 Paradise Rd, Las Vegas, NV 89104',        'jane', 'https://lasvegasreleaf.com/menu/'),
];
