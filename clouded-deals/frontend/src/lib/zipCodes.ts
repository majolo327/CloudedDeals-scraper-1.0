/**
 * Clark County, Nevada ZIP code validation.
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
