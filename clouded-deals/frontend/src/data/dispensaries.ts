import type { Dispensary, Zone, Tier, DealSource } from '@/types';

function d(
  name: string,
  zone: Zone,
  tier: Tier,
  address: string,
  platform: DealSource,
  menu_url: string
): Dispensary {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    zone,
    tier,
    address,
    menu_url,
    platform,
    is_active: true,
  };
}

export const DISPENSARIES: Dispensary[] = [
  // Strip
  d('Planet 13', 'strip', 'verified', '2548 W Desert Inn Rd, Las Vegas, NV 89109', 'jane', 'https://www.planet13lasvegas.com/menu'),
  d('The Dispensary West', 'strip', 'premium', '5347 S Decatur Blvd, Las Vegas, NV 89118', 'dutchie', 'https://thedispensarylv.com'),
  d('Reef Dispensaries (Strip)', 'strip', 'verified', '3400 Western Ave, Las Vegas, NV 89109', 'dutchie', 'https://reefdispensaries.com'),
  d('Essence (Strip)', 'strip', 'verified', '2307 S Las Vegas Blvd, Las Vegas, NV 89104', 'jane', 'https://essencevegas.com'),
  d('The Source+ (Strip)', 'strip', 'premium', '2550 S Rainbow Blvd, Las Vegas, NV 89146', 'dutchie', 'https://thesourcenv.com'),
  d('Curaleaf (Strip)', 'strip', 'verified', '1736 S Las Vegas Blvd, Las Vegas, NV 89104', 'curaleaf', 'https://curaleaf.com/shop/nevada'),
  d('MedMen (Strip)', 'strip', 'premium', '3025 S Las Vegas Blvd, Las Vegas, NV 89109', 'dutchie', 'https://medmen.com'),
  d('ShowGrow', 'strip', 'standard', '4850 W Sunset Rd, Las Vegas, NV 89118', 'dutchie', 'https://showgrow.com'),
  d('NuWu Cannabis', 'strip', 'premium', '1235 Paiute Cir, Las Vegas, NV 89106', 'jane', 'https://nuwucannabis.com'),
  d('Jardin', 'strip', 'verified', '2900 E Desert Inn Rd, Las Vegas, NV 89121', 'dutchie', 'https://jardincannabis.com'),
  d('Exhale Nevada', 'strip', 'premium', '4310 W Flamingo Rd, Las Vegas, NV 89103', 'dutchie', 'https://exhalenv.com'),
  d('Zen Leaf (Strip)', 'strip', 'premium', '3375 Pepper Ln, Las Vegas, NV 89120', 'dutchie', 'https://zenleafdispensaries.com'),
  d('Oasis Cannabis', 'strip', 'verified', '1800 Industrial Rd, Las Vegas, NV 89102', 'jane', 'https://oasisnv.com'),
  d('The Apothecary Shoppe', 'strip', 'premium', '4240 W Flamingo Rd, Las Vegas, NV 89103', 'dutchie', 'https://theapothecaryshopppe.com'),
  d('Acres Cannabis', 'strip', 'standard', '2320 Western Ave, Las Vegas, NV 89102', 'dutchie', 'https://acrescannabis.com'),

  // Downtown
  d('Thrive Cannabis', 'downtown', 'verified', '2020 Western Ave, Las Vegas, NV 89102', 'dutchie', 'https://thrivecannabis.com'),
  d('Inyo Fine Cannabis', 'downtown', 'premium', '2520 S Maryland Pkwy, Las Vegas, NV 89109', 'dutchie', 'https://inyocannabis.com'),
  d('NuLeaf (Downtown)', 'downtown', 'verified', '430 E Twain Ave, Las Vegas, NV 89169', 'jane', 'https://nuleafnv.com'),
  d('Essence (Downtown)', 'downtown', 'verified', '4347 W Flamingo Rd, Las Vegas, NV 89103', 'jane', 'https://essencevegas.com'),
  d('Green (Downtown)', 'downtown', 'standard', '3650 S Decatur Blvd, Las Vegas, NV 89103', 'dutchie', 'https://greendispensary.com'),
  d('Pisos', 'downtown', 'premium', '4110 S Maryland Pkwy, Las Vegas, NV 89119', 'dutchie', 'https://pisosclub.com'),
  d('The Grove', 'downtown', 'standard', '4647 Swenson St, Las Vegas, NV 89119', 'dutchie', 'https://thegrovenv.com'),
  d('Silver Sage Wellness', 'downtown', 'standard', '3420 Spring Mountain Rd, Las Vegas, NV 89102', 'dutchie', 'https://silversagewellness.com'),

  // Local (residential areas of Las Vegas)
  d('Greenmart', 'local', 'standard', '3650 S Decatur Blvd #7, Las Vegas, NV 89103', 'dutchie', 'https://greenmartlv.com'),
  d('The Dispensary Henderson', 'local', 'premium', '50 N Gibson Rd, Henderson, NV 89014', 'dutchie', 'https://thedispensarylv.com'),
  d('Shango (Decatur)', 'local', 'premium', '4380 S Decatur Blvd, Las Vegas, NV 89103', 'dutchie', 'https://goshango.com'),
  d('Shango (Eastern)', 'local', 'premium', '7885 S Eastern Ave, Las Vegas, NV 89123', 'dutchie', 'https://goshango.com'),
  d('Nevada Made Marijuana', 'local', 'standard', '7740 S Jones Blvd, Las Vegas, NV 89139', 'dutchie', 'https://nevadamademarijuana.com'),
  d('Jenny\'s Dispensary', 'local', 'standard', '8560 W Sunset Rd, Las Vegas, NV 89113', 'dutchie', 'https://jennysnv.com'),
  d('The Source+ (Sahara)', 'local', 'premium', '9480 S Eastern Ave #170, Las Vegas, NV 89123', 'dutchie', 'https://thesourcenv.com'),
  d('Sierra Well', 'local', 'standard', '3375 Pepper Ln, Las Vegas, NV 89120', 'dutchie', 'https://sierrawellnv.com'),
  d('Medizin', 'local', 'verified', '4850 W Sunset Rd, Las Vegas, NV 89118', 'dutchie', 'https://medizin.vegas'),
  d('MMJ America', 'local', 'standard', '4745 W Tropicana Ave, Las Vegas, NV 89103', 'dutchie', 'https://mmjamerica.com'),
  d('Euphoria Wellness', 'local', 'standard', '7780 S Jones Blvd, Las Vegas, NV 89139', 'dutchie', 'https://euphoriawellnesslv.com'),
  d('Jade Cannabis', 'local', 'standard', '1130 E Desert Inn Rd, Las Vegas, NV 89109', 'dutchie', 'https://jadecannabisco.com'),
  d('LivFree Wellness', 'local', 'standard', '1130 W Sunset Rd, Henderson, NV 89014', 'dutchie', 'https://livfreewellness.com'),
  d('Tree of Life', 'local', 'standard', '1740 E Tropicana Ave, Las Vegas, NV 89119', 'dutchie', 'https://treeoflifelv.com'),
  d('Top Notch the Dispensary', 'local', 'standard', '7885 W Sahara Ave #112, Las Vegas, NV 89117', 'dutchie', 'https://topnotchthed.com'),
  d('Cultivate', 'local', 'premium', '4055 S Buffalo Dr, Las Vegas, NV 89147', 'dutchie', 'https://cultivatenv.com'),
  d('Mynt Cannabis', 'local', 'standard', '3650 S Decatur Blvd, Las Vegas, NV 89103', 'dutchie', 'https://myntcannabis.com'),

  // Henderson
  d('The Dispensary (Henderson)', 'henderson', 'premium', '50 N Gibson Rd, Henderson, NV 89014', 'dutchie', 'https://thedispensarylv.com'),
  d('Zen Leaf (Henderson)', 'henderson', 'premium', '9130 S Las Vegas Blvd, Las Vegas, NV 89123', 'dutchie', 'https://zenleafdispensaries.com'),
  d('Essence (Henderson)', 'henderson', 'verified', '4300 E Sunset Rd #A1, Henderson, NV 89014', 'jane', 'https://essencevegas.com'),
  d('Deep Roots Henderson', 'henderson', 'premium', '1542 W Warm Springs Rd, Henderson, NV 89014', 'dutchie', 'https://deeprootsharvest.com'),
  d('Curaleaf (Henderson)', 'henderson', 'verified', '1736 W Horizon Ridge Pkwy, Henderson, NV 89012', 'curaleaf', 'https://curaleaf.com/shop/nevada'),
  d('Nevada Wellness Center', 'henderson', 'standard', '3200 N Tenaya Way, Las Vegas, NV 89129', 'dutchie', 'https://nevadawellnesscenter.com'),
  d('NuLeaf (Henderson)', 'henderson', 'verified', '1040 E Flamingo Rd, Las Vegas, NV 89119', 'jane', 'https://nuleafnv.com'),
  d('GreenMart (Henderson)', 'henderson', 'standard', '4550 S Fort Apache Rd, Las Vegas, NV 89147', 'dutchie', 'https://greenmartlv.com'),
  d('Las Vegas ReLeaf', 'henderson', 'standard', '2244 Paradise Rd, Las Vegas, NV 89104', 'dutchie', 'https://lvrealeaf.com'),
  d('Jenny\'s Henderson', 'henderson', 'standard', '10420 S Eastern Ave, Henderson, NV 89052', 'dutchie', 'https://jennysnv.com'),

  // North Las Vegas
  d('Thrive North', 'north', 'verified', '4440 N Rancho Dr, Las Vegas, NV 89130', 'dutchie', 'https://thrivecannabis.com'),
  d('Reef North', 'north', 'premium', '3900 N Rancho Dr, Las Vegas, NV 89130', 'dutchie', 'https://reefdispensaries.com'),
  d('Curaleaf (North)', 'north', 'verified', '1736 N Rancho Dr, Las Vegas, NV 89106', 'curaleaf', 'https://curaleaf.com/shop/nevada'),
  d('Deep Roots North', 'north', 'premium', '1542 N Las Vegas Blvd, North Las Vegas, NV 89030', 'dutchie', 'https://deeprootsharvest.com'),
  d('NuLeaf (North)', 'north', 'premium', '925 N Nellis Blvd, Las Vegas, NV 89110', 'jane', 'https://nuleafnv.com'),
  d('The Source+ (North)', 'north', 'premium', '2585 S Rainbow Blvd, Las Vegas, NV 89146', 'dutchie', 'https://thesourcenv.com'),
  d('Oasis North', 'north', 'standard', '1800 S Industrial Rd, Las Vegas, NV 89102', 'jane', 'https://oasisnv.com'),
  d('Essence (North)', 'north', 'verified', '5765 W Tropicana Ave, Las Vegas, NV 89103', 'jane', 'https://essencevegas.com'),
  d('MMJ North', 'north', 'standard', '4745 W Tropicana Ave, Las Vegas, NV 89103', 'dutchie', 'https://mmjamerica.com'),
  d('Blüm (Decatur)', 'north', 'standard', '1921 Western Ave, Las Vegas, NV 89102', 'dutchie', 'https://liveblum.com'),
];
