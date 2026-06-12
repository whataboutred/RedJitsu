# Database Migration Instructions

## Required Migration

A database migration is required to add missing columns and indexes to your Supabase database.

### Migration File Location
`supabase/migrations/20250101_add_missing_columns.sql`

### What This Migration Does
- Adds `location` column to `workouts` table (for location-based suggestions)
- Adds `completed` column to `sets` table (for tracking set completion)
- Creates index on `workouts(user_id, location, performed_at)` for faster location-based queries
- Creates unique constraint on `workout_exercises(workout_id, exercise_id)` to prevent duplicate exercises

### How to Apply

#### Option 1: Supabase Dashboard (Recommended)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the migration file at `supabase/migrations/20250101_add_missing_columns.sql`
4. Copy the entire SQL content
5. Paste it into the SQL Editor
6. Click **Run** to execute the migration

#### Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
# Make sure you're linked to your project
supabase link --project-ref your-project-ref

# Apply the migration
supabase db push
```

#### Option 3: Programmatic Application

If you prefer to apply the migration programmatically, you can uncomment and run the migration script:

```bash
npm run migrate
```

(Note: You'll need to configure your Supabase credentials in the environment)

### Verification

After applying the migration, verify it was successful by running this query in the SQL Editor:

```sql
-- Check if location column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'workouts' AND column_name = 'location';

-- Check if completed column exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sets' AND column_name = 'completed';
```

Both queries should return results. If they do, the migration was successful!

### Rollback (if needed)

If you need to rollback this migration for any reason:

```sql
-- Remove the added columns
ALTER TABLE public.workouts DROP COLUMN IF EXISTS location;
ALTER TABLE public.sets DROP COLUMN IF EXISTS completed;

-- Remove the indexes
DROP INDEX IF EXISTS idx_workouts_user_location_date;
DROP INDEX IF EXISTS idx_workout_exercises_unique;
```

## Next Steps

After applying the migration:

1. **Clear your browser's local storage** (to ensure draft auto-save starts fresh)
2. **Refresh the application** to start using the new features
3. **Test creating a new workout** to verify everything works correctly

The app will now:
- Auto-save workout drafts every 30 seconds to localStorage
- Offer to restore unsaved drafts when you return
- Use optimized queries for workout suggestions
- Prevent duplicate exercises in the same workout
- Support location-based workout filtering
