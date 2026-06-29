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

// Curated activity types the user can choose to import (matched case-insensitively
// against the exercise displayName / exerciseType). Sensible default = common cardio.
export const FITBIT_ACTIVITY_OPTIONS = [
  'Running',
  'Walking',
  'Biking',
  'Spinning',
  'Treadmill',
  'Elliptical',
  'Swimming',
  'Hiking',
  'Rowing',
  'Workout',
  'Interval Training',
  'Sport',
  'Yoga',
] as const

export const FITBIT_DEFAULT_ALLOWED = ['Running', 'Walking', 'Biking', 'Spinning', 'Treadmill', 'Elliptical', 'Swimming', 'Hiking', 'Rowing']
