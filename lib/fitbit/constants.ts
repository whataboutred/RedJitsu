// Google Health API + OAuth endpoints and app-level constants.
// (The provider is now the Google Health API — the Fitbit Web API successor.
// We keep the "fitbit" file/route/table names since the device is still a Fitbit;
// only the API behind it changed.)

// Standard Google OAuth 2.0 endpoints
export const GH_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GH_TOKEN_URL = 'https://oauth2.googleapis.com/token'
export const GH_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

// Google Health REST API
export const GH_API_BASE = 'https://health.googleapis.com/v4'
// Exercise sessions bundle their own time-in-HR-zone durations, so this single
// scope covers everything we import.
export const GH_SCOPE = 'https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly'

// Cookie that carries the PKCE verifier + CSRF state between /connect and
// /callback. Short-lived, httpOnly.
export const FITBIT_OAUTH_COOKIE = 'rj_fitbit_oauth'

// Everything imports as cardio EXCEPT what the user excludes (chips below),
// plus two built-in rules:
// - Strength sessions never import as cardio — they correlate to logged
//   workouts as metadata instead (workout_metrics).
// - Walks only import when they earned it: at least
//   WALK_MIN_MODERATE_MINUTES of total time in the moderate-or-higher HR zone.
export const FITBIT_ACTIVITY_OPTIONS = [
  'Running',
  'Walking',
  'Biking',
  'Cycling',
  'Spinning',
  'Treadmill',
  'Elliptical',
  'Swimming',
  'Hiking',
  'Rowing',
  'Workout',
  'Interval Training',
  'Aerobic Workout',
  'Sport',
  'Yoga',
] as const

// Total moderate+vigorous+peak zone minutes a walk needs to count as cardio.
// (Google reports total zone time, not contiguous stretches — same basis as
// Fitbit's own Active Zone Minutes.)
export const WALK_MIN_MODERATE_MINUTES = 15

// How far a workout's logged time may sit outside the Fitbit session interval
// and still be considered the same training session.
export const METRICS_MATCH_TOLERANCE_MS = 30 * 60 * 1000
