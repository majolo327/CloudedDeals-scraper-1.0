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
  b('Avexia', 'premium', ['edible', 'concentrate']),

  // B
  b('Bam', 'value', ['preroll', 'flower']),
  b('Bhang', 'premium', ['edible', 'vape']),
  b('Binske', 'premium', ['flower', 'edible', 'concentrate']),
  b('Black Label', 'established', ['flower', 'concentrate']),
  b('Bloom', 'established', ['vape']),
  b('Body and Mind', 'established', ['flower', 'concentrate', 'vape']),
  b('Botanist', 'local', ['flower']),
  b('Bounti', 'premium', ['flower', 'concentrate']),

  // C
  b('Cannabella', 'local', ['flower', 'preroll']),
  b('Cannabiotix', 'premium', ['flower', 'concentrate', 'preroll']),
  b('Canvas', 'local', ['vape']),
  b('Cheers', 'value', ['edible']),
  b('City Trees', 'established', ['concentrate', 'vape', 'edible']),
  b('ClearGold', 'local', ['concentrate']),
  b('Cookies', 'premium', ['flower', 'preroll', 'vape']),
  b('Crest', 'local', ['flower']),
  b('CRU', 'premium', ['flower', 'preroll']),
  b('Curaleaf', 'established', ['flower', 'vape', 'edible', 'concentrate']),

  // D
  b('Dadirri', 'local', ['flower']),
  b('Deep Roots Harvest', 'established', ['flower', 'concentrate', 'preroll']),
  b('Defonce', 'premium', ['edible']),
  b('Desert Bloom', 'local', ['flower', 'preroll']),
  b('Desert Grown Farms', 'established', ['flower', 'preroll']),
  b('Dgf', 'local', ['flower']),
  b('Dixie', 'premium', ['edible']),
  b('Dogwalkers', 'established', ['preroll']),
  b('Dope', 'value', ['preroll']),
  b('Dreamland', 'local', ['flower']),
  b('Dutchie', 'value', ['flower', 'preroll']),

  // E
  b('Eclipse', 'local', ['vape']),
  b('Effex', 'local', ['edible']),
  b('Eighth Brother', 'value', ['flower', 'preroll']),
  b('Encore', 'established', ['edible']),
  b('Essential Brand', 'local', ['concentrate']),
  b('Evergreen Organix', 'established', ['edible', 'concentrate']),

  // F
  b('Fade Co', 'established', ['flower']),
  b('FlavRx', 'established', ['vape', 'concentrate']),
  b('Flora Vega', 'established', ['flower', 'concentrate']),
  b('Fleur', 'local', ['flower', 'preroll']),
  b('Fresh Baked', 'value', ['flower']),

  // G
  b('Garden of Weeden', 'local', ['flower']),
  b('GB Extracts', 'established', ['concentrate']),
  b('Gold Label', 'premium', ['flower']),
  b('Good Chemistry', 'established', ['flower', 'preroll']),
  b('Gorilla Grillz', 'value', ['flower', 'preroll']),
  b('Graffiti', 'local', ['vape']),
  b('Green Life Productions', 'local', ['flower']),
  b('GT Flowers', 'local', ['flower']),
  b('GreenMart', 'value', ['flower', 'preroll']),
  b('Growers Circle', 'premium', ['flower', 'concentrate']),

  // H
  b('Halara', 'local', ['flower']),
  b('Haha Gummies', 'value', ['edible']),
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
  b('Kanha', 'premium', ['edible']),
  b('Kiva', 'premium', ['edible']),
  b('Korova', 'premium', ['edible', 'flower']),
  b('Kynd', 'established', ['flower', 'concentrate', 'preroll']),

  // L
  b('La Bomba', 'value', ['preroll']),
  b('Leaf and Vine', 'local', ['flower']),
  b('Lit', 'value', ['preroll', 'flower']),
  b('Local Cannabis', 'local', ['flower']),
  b('Lollipop', 'value', ['edible']),
  b('Loud', 'local', ['flower', 'preroll']),

  // M
  b('Manzanita', 'established', ['vape']),
  b('Matrix', 'established', ['concentrate', 'vape']),
  b('Medizin', 'premium', ['flower', 'concentrate', 'preroll']),
  b('Mother Herb', 'local', ['flower']),
  b('MPX', 'premium', ['concentrate']),
  b('Mynt', 'local', ['flower', 'vape']),

  // N
  b('Nature & Nurture', 'local', ['flower']),
  b('Nature\'s Chemistry', 'premium', ['flower', 'concentrate']),
  b('Nevada Made Marijuana', 'established', ['flower', 'preroll']),
  b('New Standard', 'local', ['flower']),
  b('NuLeaf', 'established', ['flower', 'vape']),

  // O
  b('Old Pal', 'value', ['flower', 'preroll']),
  b('One Plant', 'established', ['flower']),
  b('Ozone', 'established', ['flower', 'vape']),

  // P
  b('Pacific Stone', 'value', ['flower', 'preroll']),
  b('Palms', 'established', ['preroll']),
  b('PANNA', 'established', ['concentrate']),
  b('Pearl Pharma', 'premium', ['flower', 'concentrate']),
  b('Pheno Exotic', 'established', ['flower']),
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
  b('Rove', 'premium', ['vape']),
  b('Ryse', 'local', ['flower']),

  // S
  b('Select', 'premium', ['vape', 'edible']),
  b('Shango', 'established', ['flower', 'concentrate']),
  b('Simply Herb', 'value', ['flower', 'preroll']),
  b('Stiiizy', 'premium', ['vape', 'flower', 'edible']),
  b('Srene', 'established', ['flower', 'concentrate']),
  b('State Flower', 'established', ['flower']),
  b('SVC', 'local', ['concentrate']),

  // T
  b('Tahoe Hydro', 'premium', ['flower', 'concentrate']),
  b('Terra', 'established', ['edible']),
  b('The Bank', 'local', ['flower']),
  b('The Grower Circle', 'premium', ['flower']),
  b('Tumbleweed Extracts', 'local', ['concentrate']),
  b('TWE', 'local', ['flower', 'preroll']),
  b('Tyson', 'premium', ['flower', 'preroll', 'vape']),

  // U
  b('Udoze', 'local', ['edible']),
  b('Ultra Health', 'local', ['flower']),

  // V
  b('Verano', 'premium', ['flower', 'vape', 'edible']),
  b('Virtue', 'established', ['flower', 'concentrate']),
  b('VPF', 'local', ['flower']),

  // W
  b('Waveseer', 'local', ['flower']),
  b('Weed Nap', 'value', ['preroll']),
  b('White Cloud', 'established', ['flower', 'concentrate']),
  b('White Lvbel', 'local', ['flower']),
  b('Wicked Sour', 'value', ['edible']),
  b('WYLD', 'premium', ['edible']),

  // X
  b('Xeno', 'local', ['flower']),

  // Y
  b('Yellowstone', 'local', ['flower']),

  // Z
  b('Zen Leaf', 'established', ['flower', 'vape']),
  b('Zing', 'value', ['edible']),
];
