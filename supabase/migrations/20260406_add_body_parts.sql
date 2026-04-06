-- Add body_part column to exercises table for accurate classification
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS body_part text
  CHECK (body_part IN ('chest','back','shoulders','arms','legs','core','full_body'));

-- Populate built-in exercises with correct body parts
UPDATE exercises SET body_part = 'legs' WHERE name IN (
  'Barbell Back Squat', 'Barbell Front Squat',
  'Leg Press Machine', 'Leg Extension Machine', 'Leg Curl Machine',
  'Dumbbell Romanian Deadlift'
) AND is_global = true;

UPDATE exercises SET body_part = 'chest' WHERE name IN (
  'Barbell Bench Press', 'Barbell Incline Bench Press',
  'Dumbbell Bench Press', 'Dumbbell Incline Press',
  'Chest Press Machine (Flat)', 'Chest Press Machine (Incline)',
  'Cable Fly'
) AND is_global = true;

UPDATE exercises SET body_part = 'back' WHERE name IN (
  'Barbell Row', 'Dumbbell Row',
  'Lat Pulldown (Cable)', 'Seated Cable Row',
  'Lat Pulldown Machine', 'Row Machine (Plate-Loaded)'
) AND is_global = true;

UPDATE exercises SET body_part = 'shoulders' WHERE name IN (
  'Barbell Overhead Press', 'Dumbbell Shoulder Press',
  'Face Pull (Cable)'
) AND is_global = true;

UPDATE exercises SET body_part = 'arms' WHERE name IN (
  'Triceps Pushdown (Cable)'
) AND is_global = true;

UPDATE exercises SET body_part = 'full_body' WHERE name IN (
  'Barbell Deadlift'
) AND is_global = true;
