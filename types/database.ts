/**
 * Hand-written Supabase database types, derived from supabase/schema.sql and
 * supabase/migrations/*. Keep in sync when the schema changes.
 *
 * Note: programs / program_days / template_exercises exist in the live
 * database but are not yet captured in schema.sql; their shapes are derived
 * from app usage.
 */

export type ExerciseCategory = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'other'
export type BodyPart = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'full_body'
export type SetType = 'warmup' | 'working'
export type DistanceUnit = 'miles' | 'km'
export type CardioIntensity = 'low' | 'medium' | 'high'
export type BjjKind = 'class' | 'drilling' | 'open_mat'
// schema.sql declares ('light','moderate','intense') but the app reads and
// writes 'low'|'medium'|'high', so the live DB no longer has that check.
export type BjjIntensity = string

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string | null
          unit: string
          weekly_goal: number | null
          bjj_weekly_goal: number | null
          cardio_weekly_goal: number | null
          coach_context: string | null
          created_at: string | null
        }
        Insert: {
          id: string
          display_name?: string | null
          unit?: string
          weekly_goal?: number | null
          bjj_weekly_goal?: number | null
          cardio_weekly_goal?: number | null
          coach_context?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          display_name?: string | null
          unit?: string
          weekly_goal?: number | null
          bjj_weekly_goal?: number | null
          cardio_weekly_goal?: number | null
          coach_context?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      exercises: {
        Row: {
          id: string
          name: string
          category: ExerciseCategory | null
          body_part: BodyPart | null
          is_global: boolean
          owner: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          category?: ExerciseCategory | null
          body_part?: BodyPart | null
          is_global?: boolean
          owner?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          category?: ExerciseCategory | null
          body_part?: BodyPart | null
          is_global?: boolean
          owner?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      workouts: {
        Row: {
          id: string
          user_id: string
          performed_at: string
          title: string | null
          note: string | null
          location: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          performed_at?: string
          title?: string | null
          note?: string | null
          location?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          performed_at?: string
          title?: string | null
          note?: string | null
          location?: string | null
          created_at?: string | null
        }
        Relationships: []
      }
      workout_exercises: {
        Row: {
          id: string
          workout_id: string
          exercise_id: string
          display_name: string
          order_index: number | null
        }
        Insert: {
          id?: string
          workout_id: string
          exercise_id: string
          display_name: string
          order_index?: number | null
        }
        Update: {
          id?: string
          workout_id?: string
          exercise_id?: string
          display_name?: string
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'workout_exercises_workout_id_fkey'
            columns: ['workout_id']
            isOneToOne: false
            referencedRelation: 'workouts'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workout_exercises_exercise_id_fkey'
            columns: ['exercise_id']
            isOneToOne: false
            referencedRelation: 'exercises'
            referencedColumns: ['id']
          },
        ]
      }
      sets: {
        Row: {
          id: string
          workout_exercise_id: string
          set_index: number
          weight: number
          reps: number
          set_type: SetType
          completed: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          workout_exercise_id: string
          set_index?: number
          weight?: number
          reps?: number
          set_type?: SetType
          completed?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          workout_exercise_id?: string
          set_index?: number
          weight?: number
          reps?: number
          set_type?: SetType
          completed?: boolean
          created_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sets_workout_exercise_id_fkey'
            columns: ['workout_exercise_id']
            isOneToOne: false
            referencedRelation: 'workout_exercises'
            referencedColumns: ['id']
          },
        ]
      }
      cardio_sessions: {
        Row: {
          id: string
          user_id: string
          activity: string
          duration_minutes: number | null
          distance: number | null
          distance_unit: DistanceUnit | null
          intensity: CardioIntensity | null
          calories: number | null
          notes: string | null
          performed_at: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          activity: string
          duration_minutes?: number | null
          distance?: number | null
          distance_unit?: DistanceUnit | null
          intensity?: CardioIntensity | null
          calories?: number | null
          notes?: string | null
          performed_at?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          activity?: string
          duration_minutes?: number | null
          distance?: number | null
          distance_unit?: DistanceUnit | null
          intensity?: CardioIntensity | null
          calories?: number | null
          notes?: string | null
          performed_at?: string
          created_at?: string | null
        }
        Relationships: []
      }
      bjj_sessions: {
        Row: {
          id: string
          user_id: string
          kind: BjjKind
          duration_min: number
          intensity: BjjIntensity | null
          notes: string | null
          performed_at: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          kind?: BjjKind
          duration_min: number
          intensity?: BjjIntensity | null
          notes?: string | null
          performed_at?: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          kind?: BjjKind
          duration_min?: number
          intensity?: BjjIntensity | null
          notes?: string | null
          performed_at?: string
          created_at?: string | null
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          id: string
          user_id: string
          insight_type: string
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          insight_type?: string
          content: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          insight_type?: string
          content?: string
          created_at?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          weight: number
          reps: number
          estimated_1rm: number
          achieved_at: string
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          exercise_id: string
          weight: number
          reps: number
          estimated_1rm: number
          achieved_at: string
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          exercise_id?: string
          weight?: number
          reps?: number
          estimated_1rm?: number
          achieved_at?: string
          created_at?: string | null
        }
        Relationships: []
      }
      programs: {
        Row: {
          id: string
          user_id: string
          name: string
          is_active: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          is_active?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          is_active?: boolean
          created_at?: string | null
        }
        Relationships: []
      }
      program_days: {
        Row: {
          id: string
          program_id: string
          name: string
          dows: number[] | null
          order_index: number | null
        }
        Insert: {
          id?: string
          program_id: string
          name: string
          dows?: number[] | null
          order_index?: number | null
        }
        Update: {
          id?: string
          program_id?: string
          name?: string
          dows?: number[] | null
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'program_days_program_id_fkey'
            columns: ['program_id']
            isOneToOne: false
            referencedRelation: 'programs'
            referencedColumns: ['id']
          },
        ]
      }
      template_exercises: {
        Row: {
          id: string
          program_day_id: string
          exercise_id: string
          display_name: string
          default_sets: number | null
          default_reps: number | null
          // Written by the program builder but never read back.
          set_type: string | null
          order_index: number | null
        }
        Insert: {
          id?: string
          program_day_id: string
          exercise_id: string
          display_name: string
          default_sets?: number | null
          default_reps?: number | null
          set_type?: string | null
          order_index?: number | null
        }
        Update: {
          id?: string
          program_day_id?: string
          exercise_id?: string
          display_name?: string
          default_sets?: number | null
          default_reps?: number | null
          set_type?: string | null
          order_index?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'template_exercises_program_day_id_fkey'
            columns: ['program_day_id']
            isOneToOne: false
            referencedRelation: 'program_days'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'template_exercises_exercise_id_fkey'
            columns: ['exercise_id']
            isOneToOne: false
            referencedRelation: 'exercises'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      get_history_flat: {
        Args: Record<string, never>
        Returns: {
          id: string
          performed_at: string
          name: string
          weight: number
          reps: number
        }[]
      }
      get_volume_by_dow: {
        Args: Record<string, never>
        Returns: {
          dow: string
          volume: number
        }[]
      }
      delete_my_data: {
        Args: Record<string, never>
        Returns: undefined
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']
