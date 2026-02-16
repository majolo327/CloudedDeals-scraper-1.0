/**
 * Centralized localStorage / sessionStorage key constants.
 * Import from here instead of using raw strings — prevents typos
 * and makes it trivial to audit what we persist.
 */
export const STORAGE = {
  // Onboarding
  AGE_VERIFIED: 'clouded_age_verified',
  FTUE_COMPLETED: 'clouded_ftue_completed',
  COACH_MARKS_SEEN: 'clouded_coach_marks_seen',
  CATEGORY_PREFS: 'clouded_category_prefs',

  // Location
  LOCATION_PERMISSION: 'clouded_location_permission',
  USER_COORDS: 'clouded_user_coords',
  ZIP: 'clouded_zip',

  // User engagement
  SMS_WAITLIST: 'clouded_sms_waitlist',
  CONTACT_CAPTURED: 'clouded_contact_captured',
  CONTACT_BANNER_DISMISSED: 'clouded_contact_banner_dismissed',

  // Search
  RECENT_SEARCHES: 'clouded_recent_searches',

  // Session-only
  REGION_DISMISSED: 'clouded_region_dismissed',
} as const;
