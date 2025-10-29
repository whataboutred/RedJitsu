-- Add location column to workouts table
-- Run this in your Supabase SQL Editor

ALTER TABLE workouts
ADD COLUMN IF NOT EXISTS location TEXT;

-- Add an index for faster queries by location
CREATE INDEX IF NOT EXISTS idx_workouts_location ON workouts(location);

-- Optional: Add a comment
COMMENT ON COLUMN workouts.location IS 'Gym location where the workout was performed';
