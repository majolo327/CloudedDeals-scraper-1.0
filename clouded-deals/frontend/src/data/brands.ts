/**
 * Complete brand list — source of truth is BRANDS in clouded_logic.py.
 *
 * Every brand that appears in dispensary menus is included here so the
 * Browse Brands UI is comprehensive.  Brands from clouded_logic.py are
 * supplemented with tier/category metadata; brands that existed in the
 * previous frontend config but aren't in clouded_logic are retained at
 * the bottom so we don't lose historical data.
 */
import type { Brand, BrandTier, Category } from '@/types';

function b(name: string, tier: BrandTier, categories: Category[]): Brand {
  return {
    id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    tier,
    categories,
  };
}

export const BRANDS: Brand[] = [
  // ===================================================================
  // CLOUDED_LOGIC.PY SOURCE-OF-TRUTH BRANDS  (alphabetical)
  // Duplicates removed: FloraVega (=Flora Vega), Hustlers Ambition
  // (=Hustler's Ambition), Uncle Arnies (=Uncle Arnie's)
  // ===================================================================

  // &
  b('&Shine', 'established', ['vape', 'concentrate']),

  // A
  b('Advanced Vapor Devices', 'value', []),
  b('Airo', 'established', ['vape']),
  b('Alien Labs', 'premium', ['flower', 'preroll']),
  b('AMA', 'established', ['flower']),
  b('Avexia', 'premium', ['edible', 'concentrate']),

  // B
  b('Backpack Boyz', 'premium', ['flower']),
  b('Bad Batch', 'established', ['flower']),
  b('Bad Boy', 'local', ['flower']),
  b('Ballers', 'local', ['flower']),
  b('Bear Quartz', 'value', []),
  b('Bic', 'value', []),
  b('Big Chief Extracts', 'established', ['vape']),
  b('BirthJays', 'value', ['preroll']),
  b('Bits', 'local', ['edible']),
  b('Blazer', 'value', []),
  b('Blazy Susan', 'value', []),
  b('Blink', 'value', []),
  b('BLUEBIRDS', 'local', ['flower']),
  b('BLVD', 'local', ['flower']),
  b('Bonanza Cannabis', 'established', ['flower']),
  b('Boom Town', 'local', ['flower']),
  b('Bounti', 'premium', ['flower', 'concentrate']),
  b('Brass Knuckles', 'established', ['vape']),
  b('Bud Bandz', 'local', ['flower']),

  // C
  b('Cake', 'established', ['vape', 'edible']),
  b('Cali Traditional', 'local', ['flower']),
  b('Camino', 'premium', ['edible']),
  b('Camo', 'value', []),
  b('CAMP', 'local', ['flower']),
  b('Cannafornia', 'local', ['flower']),
  b('Cannabreezy', 'local', ['flower']),
  b('Cannavative', 'established', ['flower', 'concentrate']),
  b('Cannavore', 'local', ['edible']),
  b('Cannalean', 'local', ['edible']),
  b('Cannavore Confections', 'local', ['edible']),
  b('Caviar Gold', 'established', ['flower', 'preroll']),
  b('Cheeba Chews', 'established', ['edible']),
  b('Church', 'established', ['flower']),
  b('Circle S Farms', 'established', ['flower']),
  b('City Trees', 'established', ['concentrate', 'vape', 'edible']),
  b('Claybourne Co.', 'premium', ['flower', 'preroll']),
  b('Clout King', 'established', ['flower']),
  b('Connected', 'premium', ['flower', 'preroll']),
  b('Cookies', 'premium', ['flower', 'preroll', 'vape']),
  b('Cotton Mouth', 'local', ['preroll']),

  // D
  b('Dabwoods', 'established', ['vape']),
  b('DADiRRi', 'local', ['flower']),
  b('Dazed!', 'local', ['edible']),
  b('Deep Roots', 'established', ['flower', 'concentrate', 'preroll']),
  b('Desert Blaze', 'local', ['flower']),
  b('Desert Bloom', 'local', ['flower', 'preroll']),
  b('Dimension Engineering LLC', 'value', []),
  b('Dime Industries', 'established', ['vape']),
  b('Dipper', 'value', []),
  b("Doctor Solomon's", 'premium', ['edible']),
  b('Dogwalkers', 'established', ['preroll']),
  b('Doinks', 'local', ['preroll']),
  b('Dope Dope', 'local', ['preroll']),
  b('Dr. Dabber', 'value', []),
  b('Dreamland', 'local', ['flower']),
  b('Dreamland Chocolates', 'local', ['edible']),
  b('Drink Loud', 'established', ['edible']),

  // E
  b('Edie Parker', 'premium', ['flower', 'preroll']),
  b('Element', 'established', ['vape']),
  b('Emperors Choice', 'established', ['flower']),
  b('Encore', 'established', ['edible']),
  b('Encore Edibles', 'established', ['edible']),
  b('Entourage', 'established', ['flower']),
  b('EPC', 'local', ['flower']),
  b('Escape Pod', 'established', ['edible']),
  b('Essence', 'established', ['flower', 'vape']),
  b('EVOL', 'established', ['concentrate']),
  b('Eyce', 'value', []),

  // F
  b('Featured Farms', 'premium', ['flower', 'concentrate']),
  b('Find.', 'established', ['flower']),
  b('Flora Vega', 'established', ['flower', 'concentrate']),
  b('Fuze Extracts', 'established', ['concentrate']),

  // G
  b('GB Sciences', 'established', ['concentrate']),
  b('Golden Savvy', 'established', ['concentrate']),
  b('Golden State Banana', 'premium', ['flower']),
  b('Good Green', 'established', ['flower']),
  b('Good Tide', 'established', ['flower']),
  b('GRAV Labs', 'value', []),
  b('Green Life Productions', 'local', ['flower']),
  b('Greenway LV', 'established', ['flower']),

  // H
  b('HaHa Edibles', 'established', ['edible']),
  b('Hamilton Devices', 'value', []),
  b('Haze', 'established', ['flower']),
  b('High Hemp', 'value', []),
  b('Hippies Peaces', 'local', ['flower']),
  b('Hits Blunt', 'local', ['preroll']),
  b('Huni Badger', 'value', []),
  b("Hustler's Ambition", 'established', ['flower']),

  // J
  b('Jasper', 'established', ['flower']),

  // K
  b('KANHA', 'premium', ['edible']),
  b('Khalifa Kush', 'premium', ['flower', 'preroll']),
  b('Khalifa Yellow', 'premium', ['flower']),
  b('Kiva', 'premium', ['edible']),
  b('Kiva Lost Farm', 'premium', ['edible']),
  b('Kynd', 'established', ['flower', 'concentrate', 'preroll']),

  // L
  b('Later Days', 'local', ['flower']),
  b('LAVI', 'established', ['flower']),
  b('LEVEL', 'established', ['vape']),
  b('LIT', 'local', ['preroll', 'flower']),
  b('Lost Farm', 'premium', ['edible']),
  b('LP Exotics', 'established', ['flower']),

  // M
  b('Matrix', 'established', ['concentrate', 'vape']),
  b('Medizin', 'premium', ['flower', 'concentrate', 'preroll']),
  b('Moxie', 'premium', ['concentrate', 'vape']),
  b('Mystic Timbers', 'established', ['flower']),

  // N
  b("Nature's Chemistry", 'premium', ['flower', 'concentrate']),
  b('No Brand Name', 'local', ['flower']),
  b('Nordic Goddess', 'established', ['flower']),

  // O
  b('OCB Rolling Papers & Cones', 'value', []),
  b('Old Pal', 'value', ['flower', 'preroll']),
  b('OMG THC', 'established', ['flower']),

  // P
  b('Phantom Farms', 'established', ['flower']),
  b('Pheno Exotics', 'established', ['flower']),
  b('Pis WMS', 'local', ['flower']),
  b('Planet 13', 'established', ['flower', 'preroll']),
  b('Poke a Bowl', 'value', []),
  b('Prospectors', 'established', ['flower']),

  // R
  b('Raw Garden', 'premium', ['concentrate', 'vape']),
  b('REEFORM', 'established', ['flower', 'vape']),
  b('Rove', 'premium', ['vape']),
  b('Royalesque', 'established', ['flower']),
  b('Ruby Pearl Co.', 'value', []),

  // S
  b('Savvy', 'established', ['concentrate']),
  b('SELECT', 'premium', ['vape', 'edible']),
  b('Sin City', 'established', ['flower', 'preroll']),
  b('Smokiez Edibles', 'premium', ['edible']),
  b('Special Blue', 'value', []),
  b('StackHouse NV', 'established', ['flower']),
  b('State Flower', 'established', ['flower']),
  b('STIIIZY', 'premium', ['vape', 'flower', 'edible']),
  b('Storz & Bickel', 'value', []),
  b('Sundae Co.', 'established', ['flower']),
  b('Super Good', 'established', ['flower']),

  // T
  b('Tahoe Hydro', 'premium', ['flower', 'concentrate']),
  b('The Bank', 'local', ['flower']),
  b('The Dispensary', 'established', ['flower', 'preroll']),
  b('The Essence', 'established', ['flower']),
  b('The Grower Circle', 'premium', ['flower', 'concentrate']),
  b('Toker Poker', 'value', []),
  b('Tsunami Labs', 'established', ['concentrate']),
  b('Twisted Hemp', 'value', []),
  b('Tyson 2.0', 'premium', ['flower', 'preroll', 'vape']),

  // U
  b("Uncle Arnie's", 'established', ['edible']),

  // V
  b('VERT Unlimited', 'established', ['flower']),
  b('Vegas Valley Growers', 'established', ['flower']),
  b('Vlasic Labs', 'established', ['concentrate']),

  // W
  b('Wyld', 'premium', ['edible']),

  // Y
  b('Your Highness', 'established', ['flower']),

  // ===================================================================
  // ADDITIONAL BRANDS (from previous frontend config, not in
  // clouded_logic.py — retained for historical deal matching)
  // ===================================================================

  // A
  b('Ae Valley', 'local', ['flower', 'preroll']),
  b('Aether Gardens', 'established', ['flower']),
  b('Airgraft', 'premium', ['vape']),
  b('Alchemy', 'established', ['concentrate', 'vape']),
  b('Altus', 'established', ['edible']),
  b('Amber', 'local', ['concentrate']),
  b('AMP', 'local', ['flower', 'preroll']),
  b('Apothecanna', 'established', ['edible']),
  b('Aura', 'local', ['flower']),

  // B
  b('Bam', 'value', ['preroll', 'flower']),
  b('Bhang', 'premium', ['edible', 'vape']),
  b('Binske', 'premium', ['flower', 'edible', 'concentrate']),
  b('Black Label', 'established', ['flower', 'concentrate']),
  b('Bloom', 'established', ['vape']),
  b('Body and Mind', 'established', ['flower', 'concentrate', 'vape']),
  b('Botanist', 'local', ['flower']),

  // C
  b('Cannabella', 'local', ['flower', 'preroll']),
  b('Cannabiotix', 'premium', ['flower', 'concentrate', 'preroll']),
  b('Canvas', 'local', ['vape']),
  b('Cheers', 'value', ['edible']),
  b('ClearGold', 'local', ['concentrate']),
  b('Crest', 'local', ['flower']),
  b('CRU', 'premium', ['flower', 'preroll']),
  b('Curaleaf', 'established', ['flower', 'vape', 'edible', 'concentrate']),

  // D
  b('Deep Roots Harvest', 'established', ['flower', 'concentrate', 'preroll']),
  b('Defonce', 'premium', ['edible']),
  b('Desert Grown Farms', 'established', ['flower', 'preroll']),
  b('Dgf', 'local', ['flower']),
  b('Dixie', 'premium', ['edible']),
  b('Dope', 'value', ['preroll']),
  b('Dutchie', 'value', ['flower', 'preroll']),

  // E
  b('Eclipse', 'local', ['vape']),
  b('Effex', 'local', ['edible']),
  b('Eighth Brother', 'value', ['flower', 'preroll']),
  b('Essential Brand', 'local', ['concentrate']),
  b('Evergreen Organix', 'established', ['edible', 'concentrate']),

  // F
  b('Fade Co', 'established', ['flower']),
  b('FlavRx', 'established', ['vape', 'concentrate']),
  b('Fleur', 'local', ['flower', 'preroll']),
  b('Fresh Baked', 'value', ['flower']),

  // G
  b('Garden of Weeden', 'local', ['flower']),
  b('GB Extracts', 'established', ['concentrate']),
  b('Gold Label', 'premium', ['flower']),
  b('Good Chemistry', 'established', ['flower', 'preroll']),
  b('Gorilla Grillz', 'value', ['flower', 'preroll']),
  b('Graffiti', 'local', ['vape']),
  b('GT Flowers', 'local', ['flower']),
  b('GreenMart', 'value', ['flower', 'preroll']),

  // H
  b('Haha Gummies', 'value', ['edible']),
  b('Halara', 'local', ['flower']),
  b('Heavy Hitters', 'premium', ['vape', 'preroll']),
  b('Herbal Wellness', 'local', ['flower']),
  b('Hidden Hills', 'local', ['edible']),
  b('High Garden', 'established', ['flower']),
  b('Highway 95', 'local', ['flower', 'preroll']),
  b('House Weed', 'value', ['flower', 'preroll']),
  b('HSH', 'local', ['concentrate']),
  b('Huni Labs', 'established', ['concentrate']),

  // I
  b('Illicit Gardens', 'local', ['flower']),
  b('Incredibles', 'premium', ['edible']),
  b('Indo', 'local', ['flower']),
  b('Infused Innovations', 'local', ['edible']),

  // J
  b('Jacks', 'value', ['flower']),
  b('Jenns', 'local', ['edible']),
  b('Jetty Extracts', 'premium', ['vape', 'concentrate']),
  b('Just Herbs', 'value', ['flower']),

  // K
  b('KAMI', 'established', ['flower', 'concentrate']),
  b('Korova', 'premium', ['edible', 'flower']),

  // L
  b('La Bomba', 'value', ['preroll']),
  b('Leaf and Vine', 'local', ['flower']),
  b('Local Cannabis', 'local', ['flower']),
  b('Lollipop', 'value', ['edible']),
  b('Loud', 'local', ['flower', 'preroll']),

  // M
  b('Manzanita', 'established', ['vape']),
  b('Mother Herb', 'local', ['flower']),
  b('MPX', 'premium', ['concentrate']),
  b('Mynt', 'local', ['flower', 'vape']),

  // N
  b('Nature & Nurture', 'local', ['flower']),
  b('Nevada Made Marijuana', 'established', ['flower', 'preroll']),
  b('New Standard', 'local', ['flower']),
  b('NuLeaf', 'established', ['flower', 'vape']),

  // O
  b('One Plant', 'established', ['flower']),
  b('Ozone', 'established', ['flower', 'vape']),

  // P
  b('Pacific Stone', 'value', ['flower', 'preroll']),
  b('Palms', 'established', ['preroll']),
  b('PANNA', 'established', ['concentrate']),
  b('Pearl Pharma', 'premium', ['flower', 'concentrate']),
  b('Polaris', 'established', ['flower', 'concentrate']),
  b('Provisions', 'value', ['flower']),
  b('Pure Haze', 'local', ['flower']),
  b('Pure Sun Farms', 'value', ['flower', 'preroll']),

  // Q
  b('Qualcan', 'established', ['flower', 'concentrate']),
  b('Queen City', 'local', ['flower']),

  // R
  b('Reina', 'established', ['flower', 'preroll']),
  b('Remedy', 'established', ['flower', 'concentrate']),
  b('Ryse', 'local', ['flower']),

  // S
  b('Shango', 'established', ['flower', 'concentrate']),
  b('Simply Herb', 'value', ['flower', 'preroll']),
  b('Srene', 'established', ['flower', 'concentrate']),
  b('SVC', 'local', ['concentrate']),

  // T
  b('Terra', 'established', ['edible']),
  b('Tumbleweed Extracts', 'local', ['concentrate']),
  b('TWE', 'local', ['flower', 'preroll']),

  // U
  b('Udoze', 'local', ['edible']),
  b('Ultra Health', 'local', ['flower']),

  // V
  b('Vapure', 'established', ['vape', 'concentrate']),
  b('Verano', 'premium', ['flower', 'vape', 'edible']),
  b('Virtue', 'established', ['flower', 'concentrate']),
  b('VPF', 'local', ['flower']),

  // W
  b('Waveseer', 'local', ['flower']),
  b('Weed Nap', 'value', ['preroll']),
  b('White Cloud', 'established', ['flower', 'concentrate']),
  b('White Lvbel', 'local', ['flower']),
  b('Wicked Sour', 'value', ['edible']),

  // X
  b('Xeno', 'local', ['flower']),

  // Y
  b('Yellowstone', 'local', ['flower']),

  // Z
  b('Zen Leaf', 'established', ['flower', 'vape']),
  b('Zing', 'value', ['edible']),
];
