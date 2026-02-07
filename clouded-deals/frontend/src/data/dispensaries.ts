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
  d('oasis',                  'Oasis Cannabis',                   'verified', '1800 Industrial Rd, Las Vegas, NV 89102',        'jane', 'https://oasiscannabis.com/shop/menu/specials'),
  d('deep-roots-cheyenne',    'Deep Roots Harvest Cheyenne',      'verified', '3400 Western Ave, Las Vegas, NV 89109',         'jane', 'https://www.deeprootsharvest.com/cheyenne'),
  d('deep-roots-craig',       'Deep Roots Harvest Craig',          'verified', '1489 W Craig Rd, North Las Vegas, NV 89032',   'jane', 'https://www.deeprootsharvest.com/craig'),
  d('deep-roots-blue-diamond','Deep Roots Harvest Blue Diamond',   'verified', '6750 Blue Diamond Rd, Las Vegas, NV 89178',    'jane', 'https://www.deeprootsharvest.com/blue-diamond'),
  d('deep-roots-parkson',     'Deep Roots Harvest Parkson',        'verified', '1542 Parkson Rd, Henderson, NV 89014',         'jane', 'https://www.deeprootsharvest.com/parkson'),
  d('cultivate-spring',       'Cultivate Spring Mountain',         'verified', '3615 Spring Mountain Rd, Las Vegas, NV 89102', 'jane', 'https://cultivatelv.com/online-menu/'),
  d('cultivate-durango',      'Cultivate Durango',                 'verified', '4560 N Durango Dr, Las Vegas, NV 89129',       'jane', 'https://cultivatelv.com/online-menu-durango/'),
  d('thrive-sahara',          'Thrive Sahara',                     'verified', '2755 W Sahara Ave, Las Vegas, NV 89102',       'jane', 'https://thrivenevada.com/west-sahara-weed-dispensary-menu/'),
  d('thrive-cheyenne',        'Thrive Cheyenne',                   'verified', '1112 N Nellis Blvd, Las Vegas, NV 89110',      'jane', 'https://thrivenevada.com/north-las-vegas-dispensary-menu/'),
  d('thrive-strip',           'Thrive Strip',                      'verified', '2440 S Las Vegas Blvd, Las Vegas, NV 89104',   'jane', 'https://thrivenevada.com/las-vegas-strip-dispensary-menu/'),
  d('thrive-main',            'Thrive Main',                       'verified', '1535 S Main St, Las Vegas, NV 89104',          'jane', 'https://thrivenevada.com/art-district/'),
  d('beyond-hello-sahara',    'Beyond/Hello Sahara',                'verified', '1921 W Sahara Ave, Las Vegas, NV 89102',      'jane', 'https://beyond-hello.com/nevada-dispensaries/las-vegas-sahara/adult-use-menu/'),
  d('beyond-hello-twain',     'Beyond/Hello Twain',                 'verified', '1200 E Twain Ave, Las Vegas, NV 89169',       'jane', 'https://nuleafnv.com/dispensaries/las-vegas/menu/'),
];
