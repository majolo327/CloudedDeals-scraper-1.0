/**
 * Clark County, Nevada ZIP code validation, city names, and coordinates.
 *
 * Covers Las Vegas, Henderson, North Las Vegas, Boulder City,
 * Mesquite, Laughlin, Moapa, and surrounding unincorporated areas.
 */

export const VEGAS_AREA_ZIPS: ReadonlySet<string> = new Set([
  // Las Vegas proper
  "89101", "89102", "89103", "89104", "89105", "89106", "89107", "89108",
  "89109", "89110", "89111", "89112", "89113", "89114", "89115", "89116",
  "89117", "89118", "89119", "89120", "89121", "89122", "89123", "89124",
  "89125", "89126", "89127", "89128", "89129", "89130", "89131", "89132",
  "89133", "89134", "89135", "89136", "89137", "89138", "89139", "89140",
  "89141", "89142", "89143", "89144", "89145", "89146", "89147", "89148",
  "89149", "89150", "89151", "89152", "89153", "89154", "89155", "89156",
  "89157", "89158", "89159", "89160", "89161", "89162", "89163", "89164",
  "89166", "89169", "89170", "89173", "89177", "89178", "89179", "89180",
  "89183", "89185", "89191", "89193", "89195", "89199",
  // Henderson
  "89002", "89009", "89011", "89012", "89014", "89015", "89016", "89044",
  "89052", "89053", "89074", "89077",
  // North Las Vegas
  "89030", "89031", "89032", "89033", "89036", "89081", "89084", "89085",
  "89086", "89087",
  // Boulder City
  "89005", "89006",
  // Mesquite
  "89024", "89027",
  // Laughlin
  "89028", "89029",
  // Jean / Primm
  "89019",
  // Moapa / Overton
  "89021", "89025", "89040",
  // Indian Springs / Pahrump (Nye but close)
  "89018", "89048", "89049", "89060", "89061",
]);

/**
 * Returns true if the given zip code is in the Las Vegas / Clark County
 * service area.
 */
export function isVegasArea(zip: string): boolean {
  return VEGAS_AREA_ZIPS.has(zip.trim());
}

// ---- City name mapping for Vegas metro ZIP codes ----

const HENDERSON_ZIPS = new Set([
  "89002", "89009", "89011", "89012", "89014", "89015", "89016",
  "89044", "89052", "89053", "89074", "89077",
]);

const NORTH_LV_ZIPS = new Set([
  "89030", "89031", "89032", "89033", "89036",
  "89081", "89084", "89085", "89086", "89087",
]);

const SUMMERLIN_ZIPS = new Set([
  "89128", "89134", "89135", "89138", "89144", "89145",
]);

const BOULDER_CITY_ZIPS = new Set(["89005", "89006"]);
const MESQUITE_ZIPS = new Set(["89024", "89027"]);
const LAUGHLIN_ZIPS = new Set(["89028", "89029"]);
const PAHRUMP_ZIPS = new Set(["89048", "89049", "89060", "89061"]);

/**
 * Returns the city name for a Vegas metro ZIP code.
 */
export function getVegasCityLabel(zip: string): string {
  const z = zip.trim();
  if (HENDERSON_ZIPS.has(z)) return 'Henderson';
  if (NORTH_LV_ZIPS.has(z)) return 'North Las Vegas';
  if (SUMMERLIN_ZIPS.has(z)) return 'Summerlin';
  if (BOULDER_CITY_ZIPS.has(z)) return 'Boulder City';
  if (MESQUITE_ZIPS.has(z)) return 'Mesquite';
  if (LAUGHLIN_ZIPS.has(z)) return 'Laughlin';
  if (PAHRUMP_ZIPS.has(z)) return 'Pahrump';
  return 'Las Vegas';
}

/**
 * Returns a display label suitable for the header.
 * Uses the specific city/community name (e.g. "Henderson", "Summerlin").
 */
export function getLocationDisplayLabel(zip: string): string {
  return getVegasCityLabel(zip);
}

// ---- ZIP code → approximate lat/lng for distance calculations ----

export interface ZipCoords {
  lat: number;
  lng: number;
}

/**
 * Approximate centroid coordinates for Vegas metro ZIP codes.
 * Used for distance-to-dispensary calculations.
 */
const ZIP_COORDINATES: Record<string, ZipCoords> = {
  // Henderson
  '89002': { lat: 35.9615, lng: -115.0388 },
  '89009': { lat: 36.0290, lng: -115.0170 },
  '89011': { lat: 36.0141, lng: -115.0047 },
  '89012': { lat: 36.0120, lng: -115.0686 },
  '89014': { lat: 36.0573, lng: -115.0621 },
  '89015': { lat: 36.0281, lng: -114.9697 },
  '89016': { lat: 36.0573, lng: -115.0621 },
  '89044': { lat: 35.9755, lng: -115.1085 },
  '89052': { lat: 36.0010, lng: -115.1046 },
  '89053': { lat: 36.0010, lng: -115.1046 },
  '89074': { lat: 36.0266, lng: -115.0683 },
  '89077': { lat: 36.0266, lng: -115.0683 },
  // North Las Vegas
  '89030': { lat: 36.2053, lng: -115.1168 },
  '89031': { lat: 36.2236, lng: -115.1638 },
  '89032': { lat: 36.2286, lng: -115.1326 },
  '89033': { lat: 36.2436, lng: -115.1131 },
  '89036': { lat: 36.2815, lng: -115.1247 },
  '89081': { lat: 36.2361, lng: -115.0889 },
  '89084': { lat: 36.2719, lng: -115.1747 },
  '89085': { lat: 36.2815, lng: -115.1528 },
  '89086': { lat: 36.3097, lng: -115.1247 },
  '89087': { lat: 36.2719, lng: -115.1747 },
  // Las Vegas core
  '89101': { lat: 36.1716, lng: -115.1391 },
  '89102': { lat: 36.1536, lng: -115.1767 },
  '89103': { lat: 36.1267, lng: -115.1930 },
  '89104': { lat: 36.1636, lng: -115.1124 },
  '89105': { lat: 36.1636, lng: -115.1391 },
  '89106': { lat: 36.1858, lng: -115.1602 },
  '89107': { lat: 36.1719, lng: -115.2028 },
  '89108': { lat: 36.1985, lng: -115.2134 },
  '89109': { lat: 36.1271, lng: -115.1541 },
  '89110': { lat: 36.1780, lng: -115.0625 },
  '89111': { lat: 36.0861, lng: -115.1667 },
  '89112': { lat: 36.1006, lng: -115.0388 },
  '89113': { lat: 36.0706, lng: -115.2570 },
  '89115': { lat: 36.2156, lng: -115.0564 },
  '89117': { lat: 36.1430, lng: -115.2740 },
  '89118': { lat: 36.0927, lng: -115.2055 },
  '89119': { lat: 36.0940, lng: -115.1370 },
  '89120': { lat: 36.0965, lng: -115.1024 },
  '89121': { lat: 36.1166, lng: -115.0789 },
  '89122': { lat: 36.1154, lng: -115.0314 },
  '89123': { lat: 36.0436, lng: -115.1428 },
  '89124': { lat: 36.0148, lng: -115.4238 },
  '89128': { lat: 36.1916, lng: -115.2671 },
  '89129': { lat: 36.2346, lng: -115.2671 },
  '89130': { lat: 36.2498, lng: -115.2130 },
  '89131': { lat: 36.2668, lng: -115.2130 },
  '89134': { lat: 36.2106, lng: -115.3100 },
  '89135': { lat: 36.1491, lng: -115.3297 },
  '89138': { lat: 36.1916, lng: -115.3297 },
  '89139': { lat: 36.0585, lng: -115.1768 },
  '89141': { lat: 36.0436, lng: -115.1768 },
  '89142': { lat: 36.1500, lng: -115.0500 },
  '89143': { lat: 36.2500, lng: -115.2900 },
  '89144': { lat: 36.1700, lng: -115.3100 },
  '89145': { lat: 36.1700, lng: -115.2600 },
  '89146': { lat: 36.1536, lng: -115.2200 },
  '89147': { lat: 36.1100, lng: -115.2700 },
  '89148': { lat: 36.0800, lng: -115.3000 },
  '89149': { lat: 36.2600, lng: -115.2900 },
  '89156': { lat: 36.1900, lng: -115.0300 },
  '89166': { lat: 36.2900, lng: -115.3200 },
  '89169': { lat: 36.1271, lng: -115.1541 },
  '89178': { lat: 36.0200, lng: -115.2500 },
  '89179': { lat: 35.9800, lng: -115.2200 },
  '89183': { lat: 36.0200, lng: -115.1400 },
  // Boulder City
  '89005': { lat: 35.9786, lng: -114.8306 },
  '89006': { lat: 35.9786, lng: -114.8306 },
  // Mesquite
  '89024': { lat: 36.8054, lng: -114.0672 },
  '89027': { lat: 36.8054, lng: -114.0672 },
  // Laughlin
  '89028': { lat: 35.1680, lng: -114.5729 },
  '89029': { lat: 35.1680, lng: -114.5729 },
  // Pahrump
  '89048': { lat: 36.2083, lng: -115.9839 },
  '89049': { lat: 36.2083, lng: -115.9839 },
  '89060': { lat: 36.2083, lng: -115.9839 },
  '89061': { lat: 36.2083, lng: -115.9839 },
};

/**
 * Returns approximate lat/lng for a Vegas metro ZIP code.
 * Returns null for unknown ZIPs.
 */
export function getZipCoordinates(zip: string): ZipCoords | null {
  return ZIP_COORDINATES[zip.trim()] ?? null;
}

/**
 * Get the user's stored zip code from localStorage.
 */
export function getStoredZip(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('clouded_zip');
}
