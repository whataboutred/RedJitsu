/**
 * App-level aliases for database rows. Import these instead of redefining
 * per-page copies of Workout/BJJ/Cardio shapes.
 */
import type { Tables } from './database'

export type Profile = Tables<'profiles'>
export type Workout = Tables<'workouts'>
export type WorkoutExercise = Tables<'workout_exercises'>
export type WorkoutSet = Tables<'sets'>
export type BjjSession = Tables<'bjj_sessions'>
export type CardioSession = Tables<'cardio_sessions'>
export type Exercise = Tables<'exercises'>
export type Program = Tables<'programs'>
export type ProgramDay = Tables<'program_days'>
export type TemplateExercise = Tables<'template_exercises'>
