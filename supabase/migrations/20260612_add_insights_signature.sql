-- Fingerprint of the data an insight was generated from. When the user's
-- training data or coach context changes, the signature stops matching and
-- the API regenerates the insight automatically (after the cooldown).
ALTER TABLE public.ai_insights
ADD COLUMN IF NOT EXISTS data_signature TEXT;
