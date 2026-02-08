/**
 * Cannabis legalization status by US state.
 * Data as of early 2025 — 24 states + DC have recreational.
 */

export type CannabisStatus = 'recreational' | 'medical_only' | 'no_legal';

export const RECREATIONAL_STATES = [
  'AK', 'AZ', 'CA', 'CO', 'CT', 'DE', 'IL', 'MA', 'MD', 'ME',
  'MI', 'MN', 'MO', 'MT', 'NJ', 'NM', 'NV', 'NY', 'OH', 'OR',
  'RI', 'VA', 'VT', 'WA', 'DC',
] as const;

export const MEDICAL_ONLY_STATES = [
  'AL', 'AR', 'FL', 'HI', 'KY', 'LA', 'MS', 'NH', 'ND',
  'OK', 'PA', 'SD', 'UT', 'WV',
] as const;

export const NO_LEGAL_STATES = [
  'GA', 'ID', 'IN', 'IA', 'KS', 'NE', 'NC', 'SC', 'TN', 'TX',
  'WI', 'WY',
] as const;

export function getCannabisStatus(stateCode: string): CannabisStatus {
  if ((RECREATIONAL_STATES as readonly string[]).includes(stateCode)) return 'recreational';
  if ((MEDICAL_ONLY_STATES as readonly string[]).includes(stateCode)) return 'medical_only';
  return 'no_legal';
}

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma',
  OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'Washington D.C.',
};
