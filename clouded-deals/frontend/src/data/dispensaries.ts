import type { Dispensary, Tier, DealSource, DispensaryZone } from '@/types';

/**
 * All CCB-licensed Southern NV dispensaries (current as of 1/08/2026).
 *
 * Scraped dispensaries (`scraped: true`) have matching slugs in
 * `scraper/config/dispensaries.py` — deals flow from Supabase.
 *
 * Listed-only dispensaries (`scraped: false`) appear in Browse for
 * completeness but show "no deals today" with a CTA.
 *
 * Source: https://ccb.nv.gov/list-of-licensees/
 */

/** Scraped dispensary — we have live deals. */
function d(
  id: string,
  name: string,
  tier: Tier,
  address: string,
  zone: DispensaryZone,
  platform: DealSource,
  menu_url: string,
  lat?: number,
  lng?: number,
): Dispensary {
  return { id, name, slug: id, tier, address, zone, menu_url, platform, is_active: true, scraped: true, latitude: lat, longitude: lng };
}

/** Listed-only dispensary — CCB-licensed, no deals yet. */
function listed(
  id: string,
  name: string,
  address: string,
  zone: DispensaryZone,
  lat?: number,
  lng?: number,
): Dispensary {
  return { id, name, slug: id, tier: 'standard', address, zone, menu_url: '', platform: 'dutchie', is_active: true, scraped: false, latitude: lat, longitude: lng };
}

export const DISPENSARIES: Dispensary[] = [
  // ==================================================================
  // SCRAPED — DUTCHIE (10)
  // Coordinates from Google Maps geocoding of each address
  // ==================================================================
  d('td-gibson',           'The Dispensary - Gibson',    'premium',  '50 N Gibson Rd, Suite 170 & 175',              'local',    'dutchie', 'https://thedispensarynv.com/shop-gibson/?dtche%5Bpath%5D=specials',    36.0308, -115.0354),
  d('td-decatur',          'The Dispensary - Decatur',   'premium',  '5347 S Decatur Blvd',                          'local',    'dutchie', 'https://thedispensarynv.com/shop-decatur/?dtche%5Bpath%5D=specials',   36.0741, -115.2076),
  d('planet13',            'Planet 13',                  'verified', '2548 W Desert Inn Rd',                         'strip',    'dutchie', 'https://planet13.com/stores/planet-13-dispensary/specials',            36.1264, -115.1711),
  d('medizin',             'Medizin',                    'verified', '4850 W Sunset Rd, Suite 130',                  'local',    'dutchie', 'https://planet13.com/stores/medizin-dispensary/specials',              36.0713, -115.2395),
  d('greenlight-downtown', 'Greenlight Downtown',        'verified', '823 S 3rd St',                                 'downtown', 'dutchie', 'https://greenlightdispensary.com/downtown-las-vegas-menu/?dtche%5Bpath%5D=specials', 36.1624, -115.1465),
  d('greenlight-paradise', 'Greenlight Paradise',        'verified', '2244 Paradise Rd',                             'local',    'dutchie', 'https://greenlightdispensary.com/paradise-menu/?dtche%5Bpath%5D=specials', 36.1454, -115.1389),
  d('the-grove',           'The Grove',                  'verified', '4647 University Center Dr',                    'strip',    'dutchie', 'https://www.thegrovenv.com/lasvegas/?dtche%5Bpath%5D=specials',       36.1110, -115.1394),
  d('mint-paradise',       'Mint Cannabis - Paradise',   'verified', '4503 Paradise Rd',                             'local',    'dutchie', 'https://mintdeals.com/paradise-lv/menu/?dtche%5Bpath%5D=specials',    36.1149, -115.1389),
  d('mint-rainbow',        'Mint Cannabis - Rainbow',    'verified', '6332 S Rainbow Blvd, Suite 105',               'local',    'dutchie', 'https://mintdeals.com/rainbow-lv/menu/?dtche%5Bpath%5D=specials',     36.0562, -115.2427),

  // ==================================================================
  // SCRAPED — CURALEAF (4)
  // ==================================================================
  d('curaleaf-western',   'Curaleaf - Western',    'verified', '2320 Western Ave',                            'downtown', 'curaleaf', 'https://curaleaf.com/stores/curaleaf-las-vegas-western-ave/specials',  36.1527, -115.1949),
  d('curaleaf-cheyenne',  'Curaleaf - Cheyenne',   'verified', '1370 W Cheyenne Ave, Suite 1',                'local',    'curaleaf', 'https://curaleaf.com/stores/curaleaf-north-las-vegas/specials',       36.2121, -115.1508),
  d('curaleaf-strip',     'Curaleaf - The Strip',   'verified', '1736 S Las Vegas Blvd',                       'strip',    'curaleaf', 'https://curaleaf.com/stores/curaleaf-nv-las-vegas/specials',          36.1579, -115.1531),
  d('curaleaf-the-reef',  'Curaleaf - The Reef',    'verified', '3400 Western Ave',                            'strip',    'curaleaf', 'https://curaleaf.com/stores/reef-dispensary-las-vegas-strip/specials', 36.1381, -115.1949),

  // ==================================================================
  // SCRAPED — JANE (13)
  // ==================================================================
  d('oasis',                  'Oasis Cannabis',                  'verified', '1800 Industrial Rd, Suite 180',              'strip',    'jane', 'https://oasiscannabis.com/shop/menu/specials',                           36.1473, -115.1649),
  d('deep-roots-cheyenne',    'Deep Roots Harvest - Cheyenne',   'verified', '5991 W Cheyenne Ave',                      'local',    'jane', 'https://www.deeprootsharvest.com/cheyenne',                             36.2121, -115.2460),
  d('deep-roots-craig',       'Deep Roots Harvest - Craig',      'verified', '1306 W Craig Rd, Suite A',                 'local',    'jane', 'https://www.deeprootsharvest.com/craig',                                36.2353, -115.1545),
  d('deep-roots-blue-diamond','Deep Roots Harvest - Blue Diamond','verified', '3725 Blue Diamond Rd',                    'local',    'jane', 'https://www.deeprootsharvest.com/blue-diamond',                         36.0506, -115.2125),
  d('deep-roots-parkson',     'Deep Roots Harvest - Parkson',    'verified', '580 Parkson Rd',                            'local',    'jane', 'https://www.deeprootsharvest.com/parkson',                              36.0279, -115.0396),
  d('cultivate-spring',       'Cultivate - Spring Mountain',     'verified', '3615 Spring Mountain Rd',                   'strip',    'jane', 'https://cultivatelv.com/online-menu/',                                  36.1268, -115.1918),
  d('cultivate-durango',      'Cultivate - Durango',             'verified', '7105 N Durango Dr, Suite 120',              'local',    'jane', 'https://cultivatelv.com/online-menu-durango/',                          36.2457, -115.2797),
  d('thrive-sahara',          'Thrive - Sahara',                 'verified', '3500 W Sahara Ave',                         'local',    'jane', 'https://thrivenevada.com/west-sahara-weed-dispensary-menu/',             36.1441, -115.1976),
  d('thrive-cheyenne',        'Thrive - Cheyenne',              'verified', '2755 W Cheyenne Ave',                        'local',    'jane', 'https://thrivenevada.com/north-las-vegas-dispensary-menu/',              36.2121, -115.1709),
  d('thrive-strip',           'Thrive - Sammy Davis Jr',         'verified', '2975 Sammy Davis Jr Dr',                    'strip',    'jane', 'https://thrivenevada.com/las-vegas-strip-dispensary-menu/',              36.1321, -115.1643),
  d('thrive-main',            'Thrive - Main St',                'verified', '1317 S Main St',                            'downtown', 'jane', 'https://thrivenevada.com/art-district/',                                36.1571, -115.1531),
  d('beyond-hello-sahara',    'Beyond/Hello - Sahara',           'verified', '7885 W Sahara Ave, Suite 111-112',           'local',    'jane', 'https://beyond-hello.com/nevada-dispensaries/las-vegas-sahara/adult-use-menu/', 36.1441, -115.2900),
  d('beyond-hello-twain',     'Beyond/Hello - Twain',            'verified', '430 E Twain Ave',                            'strip',    'jane', 'https://nuleafnv.com/dispensaries/las-vegas/menu/',                     36.1285, -115.1441),

  // ==================================================================
  // LISTED ONLY — CCB-licensed, not yet scraped
  // All addresses from official CCB list (current as of 1/08/2026)
  // ==================================================================
  listed('canna-starz',           'Canna Starz',                      '631 S Las Vegas Blvd',                         'strip'),
  listed('the-cannabis-co',       'The Cannabis Co.',                  '200 E Charleston Blvd',                        'downtown'),
  listed('cookies-strip',         'Cookies',                           '2307 S Las Vegas Blvd',                        'strip'),
  listed('cookies-flamingo',      'Cookies Las Vegas',                 '4240 W Flamingo Rd, Suite 100',                'strip'),
  listed('deep-roots-willis',     'Deep Roots Harvest - Willis Carrier', '195 Willis Carrier Canyon',                 'local'),
  listed('td-eastern',            'The Dispensary - Eastern',          '5765 S Eastern Ave',                           'local'),
  listed('euphoria-wellness',     'Euphoria Wellness',                 '7780 S Jones Blvd, Suite 105',                 'local'),
  listed('green-hualapai',        'Green.',                            '4510 S Hualapai Way',                          'local'),
  listed('green-eastern',         'Green.',                            '10420 S Eastern Ave, Suite 100',               'local'),
  listed('green-rainbow',         'Green.',                            '101 S Rainbow Blvd, Suite 1-5',               'local'),
  listed('the-grove-basin',       'The Grove',                         '1541 E Basin Ave',                             'local'),
  listed('the-grove-strip',       'The Grove',                         '1600 S Las Vegas Blvd, Suite 150',             'strip'),
  listed('inyo',                  'Inyo Fine Cannabis',                '2520 S Maryland Pkwy, Suite 2',                'strip'),
  listed('jade-desert-inn',       'Jade Cannabis Co.',                 '1130 E Desert Inn Rd',                         'strip'),
  listed('jade-skypointe',        'Jade Cannabis Co.',                 '6050 Sky Pointe Ave, Suite 150',               'local'),
  listed('jardin',                'Jardin',                            '2900 E Desert Inn Rd, Suite 102',              'strip'),
  listed('jennys',                'Jenny\'s Dispensary',               '5530 N Decatur Blvd',                          'local'),
  listed('livfree',               'LivFree Wellness',                  '8605 S Eastern Ave',                           'local'),
  listed('nv-made-cactus',        'Nevada Made Marijuana',             '1675 E Cactus Ave',                            'local'),
  listed('nv-made-charleston',    'Nevada Made Marijuana',             '3915 E Charleston Blvd',                       'local'),
  listed('nv-made-warm-springs',  'Nevada Made Marijuana',             '95 E Warm Springs Rd',                         'local'),
  listed('nv-made-w-charleston',  'Nevada Made Marijuana',             '7650 W Charleston Blvd',                       'local'),
  listed('nv-wellness',           'Nevada Wellness Center',            '3200 S Valley View Blvd',                      'local'),
  listed('nwc-west',              'NWC West',                          '9030 W Flamingo Rd, Suite 180',                'local'),
  listed('pisos',                 'Pisos',                             '4110 S Maryland Pkwy, Suite 1',                'local'),
  d('rise-sunset',    'RISE Henderson (Sunset)', 'local', '4300 E Sunset Rd, Suite A2-A3',  'local', 'jane', 'https://risecannabis.com/dispensaries/nevada/henderson/887/pickup-menu/',                36.0721, -115.0621),
  d('rise-tropicana', 'RISE Tropicana',          'local', '5765 W Tropicana Ave',           'strip', 'jane', 'https://risecannabis.com/dispensaries/nevada/las-vegas-west-tropicana/886/pickup-menu/', 36.0993, -115.2245),
  d('rise-rainbow',   'RISE Rainbow',            'local', '7260 S Rainbow Blvd, Suite 104', 'local', 'jane', 'https://risecannabis.com/dispensaries/nevada/las-vegas-south-rainbow/1718/pickup-menu/', 36.0565, -115.2437),
  d('rise-nellis',    'RISE Nellis',             'local', '871 N Nellis Blvd, Suite 9',     'local', 'jane', 'https://risecannabis.com/dispensaries/nevada/las-vegas-nellis/5267/pickup-menu/',        36.1755, -115.0628),
  d('rise-boulder',   'RISE Henderson (Boulder)','local', '1000 S Boulder Hwy',             'local', 'jane', 'https://risecannabis.com/dispensaries/nevada/henderson-boulder/6211/pickup-menu/',       36.1512, -114.9816),
  d('rise-durango',   'RISE Durango',            'local', '6410 S Durango Dr',              'local', 'jane', 'https://risecannabis.com/dispensaries/nevada/las-vegas-south-durango/1885/pickup-menu/', 36.0643, -115.2790),
  d('rise-craig',     'RISE Craig',              'local', '3930 W Craig Rd, Suite 101-104', 'local', 'jane', 'https://risecannabis.com/dispensaries/nevada/las-vegas-craig-rd/5429/pickup-menu/',      36.2358, -115.2007),
  listed('sahara-wellness',       'Sahara Wellness',                   '420 E Sahara Ave',                             'strip'),
  listed('sanctuary-3rd',         'The Sanctuary',                     '1324 S 3rd St',                                'downtown'),
  listed('sanctuary-lv-blvd',     'The Sanctuary',                     '2113 N Las Vegas Blvd',                        'local'),
  listed('the-spot',              'The Spot',                          '4310 W Flamingo Rd',                           'strip'),
  listed('slv',                   'SLV Dispensary',                    '4380 S Boulder Hwy',                           'local'),
  listed('showgrow',              'ShowGrow',                          '4850 S Fort Apache Rd, Suite 100',             'local'),
  listed('silver-sage',           'Silver Sage Wellness',              '4626 W Charleston Blvd',                       'local'),
  listed('the-source-eastern',    'The Source',                        '9480 S Eastern Ave, Suite 185 & 190',          'local'),
  listed('the-source-rainbow',    'The Source',                        '2550 S Rainbow Blvd',                          'local'),
  listed('the-source-deer-springs','The Source',                       '420 E Deer Springs Way, Suite 100',            'local'),
  listed('the-source-homestead',  'The Source',                        '2370 & 2380 Homestead Rd',                     'local'),
  listed('thrive-cactus',         'Thrive',                            '3698 W Cactus Ave, Suite 107-109',             'local'),
  listed('top-notch',             'Top Notch THC',                     '5630 Stephanie St',                            'local'),
  listed('treehouse',             'The Treehouse Vegas',               '4660 S Decatur Blvd',                          'local'),
  listed('tree-of-life-jones',    'Tree of Life',                      '1437 N Jones Blvd',                            'local'),
  listed('tree-of-life-centennial','Tree of Life',                     '150 E Centennial Pkwy, Suite 114',             'local'),
  listed('wallflower-bd',         'Wallflower Cannabis House',         '6540 Blue Diamond Rd',                         'local'),
  listed('wallflower-volunteer',  'Wallflower Cannabis House',         '3485 Volunteer Blvd',                          'local'),
  listed('zen-leaf-fort-apache',  'Zen Leaf',                          '5335 S Fort Apache Rd',                        'local'),
  listed('zen-leaf-flamingo',     'Zen Leaf',                          '5940 W Flamingo Rd',                           'local'),
  listed('zen-leaf-nlv',          'Zen Leaf North Las Vegas',          '4444 Craig Rd',                                'local'),
];
