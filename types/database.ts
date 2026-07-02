/**
 * Supabase database types, generated from the live schema
 * (supabase gen types / MCP generate_typescript_types). Regenerate after
 * applying migrations — do not hand-edit.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_insights: {
        Row: {
          content: string
          created_at: string
          data_signature: string | null
          id: string
          insight_type: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          data_signature?: string | null
          id?: string
          insight_type?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          data_signature?: string | null
          id?: string
          insight_type?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage: {
        Row: {
          count: number
          day: string
          user_id: string
        }
        Insert: {
          count?: number
          day?: string
          user_id: string
        }
        Update: {
          count?: number
          day?: string
          user_id?: string
        }
        Relationships: []
      }
      bjj_sessions: {
        Row: {
          created_at: string
          duration_min: number
          id: string
          intensity: string | null
          kind: string
          notes: string | null
          performed_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_min: number
          id?: string
          intensity?: string | null
          kind: string
          notes?: string | null
          performed_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_min?: number
          id?: string
          intensity?: string | null
          kind?: string
          notes?: string | null
          performed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cardio_sessions: {
        Row: {
          activity: string
          calories: number | null
          created_at: string | null
          distance: number | null
          distance_unit: string | null
          duration_minutes: number | null
          external_id: string | null
          id: string
          intensity: string | null
          notes: string | null
          performed_at: string
          source: string
          user_id: string
        }
        Insert: {
          activity: string
          calories?: number | null
          created_at?: string | null
          distance?: number | null
          distance_unit?: string | null
          duration_minutes?: number | null
          external_id?: string | null
          id?: string
          intensity?: string | null
          notes?: string | null
          performed_at?: string
          source?: string
          user_id: string
        }
        Update: {
          activity?: string
          calories?: number | null
          created_at?: string | null
          distance?: number | null
          distance_unit?: string | null
          duration_minutes?: number | null
          external_id?: string | null
          id?: string
          intensity?: string | null
          notes?: string | null
          performed_at?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          body_part: string | null
          category: string | null
          created_at: string | null
          id: string
          is_global: boolean
          name: string
          owner: string | null
        }
        Insert: {
          body_part?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_global?: boolean
          name: string
          owner?: string | null
        }
        Update: {
          body_part?: string | null
          category?: string | null
          created_at?: string | null
          id?: string
          is_global?: boolean
          name?: string
          owner?: string | null
        }
        Relationships: []
      }
      fitbit_connections: {
        Row: {
          access_token_enc: string | null
          allowed_activities: string[]
          created_at: string
          excluded_activities: string[]
          expires_at: string | null
          fitbit_user_id: string | null
          last_error: string | null
          last_sync_at: string | null
          refresh_token_enc: string | null
          scopes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_enc?: string | null
          allowed_activities?: string[]
          created_at?: string
          excluded_activities?: string[]
          expires_at?: string | null
          fitbit_user_id?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          refresh_token_enc?: string | null
          scopes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_enc?: string | null
          allowed_activities?: string[]
          created_at?: string
          excluded_activities?: string[]
          expires_at?: string | null
          fitbit_user_id?: string | null
          last_error?: string | null
          last_sync_at?: string | null
          refresh_token_enc?: string | null
          scopes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          achieved_at: string
          created_at: string | null
          estimated_1rm: number
          exercise_id: string
          id: string
          reps: number
          user_id: string
          weight: number
        }
        Insert: {
          achieved_at: string
          created_at?: string | null
          estimated_1rm: number
          exercise_id: string
          id?: string
          reps: number
          user_id: string
          weight: number
        }
        Update: {
          achieved_at?: string
          created_at?: string | null
          estimated_1rm?: number
          exercise_id?: string
          id?: string
          reps?: number
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bjj_weekly_goal: number
          cardio_weekly_goal: number | null
          coach_context: string | null
          created_at: string | null
          display_name: string | null
          id: string
          unit: string
          weekly_goal: number
        }
        Insert: {
          bjj_weekly_goal?: number
          cardio_weekly_goal?: number | null
          coach_context?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          unit?: string
          weekly_goal?: number
        }
        Update: {
          bjj_weekly_goal?: number
          cardio_weekly_goal?: number | null
          coach_context?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          unit?: string
          weekly_goal?: number
        }
        Relationships: []
      }
      program_days: {
        Row: {
          dows: number[]
          id: string
          name: string
          order_index: number | null
          program_id: string
        }
        Insert: {
          dows?: number[]
          id?: string
          name: string
          order_index?: number | null
          program_id: string
        }
        Update: {
          dows?: number[]
          id?: string
          name?: string
          order_index?: number | null
          program_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_days_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      programs: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      sets: {
        Row: {
          completed: boolean | null
          created_at: string | null
          id: string
          reps: number
          set_index: number
          set_type: string
          weight: number
          workout_exercise_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          reps?: number
          set_index?: number
          set_type?: string
          weight?: number
          workout_exercise_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          id?: string
          reps?: number
          set_index?: number
          set_type?: string
          weight?: number
          workout_exercise_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sets_workout_exercise_id_fkey"
            columns: ["workout_exercise_id"]
            isOneToOne: false
            referencedRelation: "workout_exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      template_exercises: {
        Row: {
          default_reps: number
          default_sets: number
          display_name: string
          exercise_id: string
          id: string
          order_index: number | null
          program_day_id: string
          set_type: string
        }
        Insert: {
          default_reps?: number
          default_sets?: number
          display_name: string
          exercise_id: string
          id?: string
          order_index?: number | null
          program_day_id: string
          set_type?: string
        }
        Update: {
          default_reps?: number
          default_sets?: number
          display_name?: string
          exercise_id?: string
          id?: string
          order_index?: number | null
          program_day_id?: string
          set_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "template_exercises_program_day_id_fkey"
            columns: ["program_day_id"]
            isOneToOne: false
            referencedRelation: "program_days"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_exercises: {
        Row: {
          display_name: string
          exercise_id: string
          id: string
          order_index: number | null
          workout_id: string
        }
        Insert: {
          display_name: string
          exercise_id: string
          id?: string
          order_index?: number | null
          workout_id: string
        }
        Update: {
          display_name?: string
          exercise_id?: string
          id?: string
          order_index?: number | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_exercises_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_metrics: {
        Row: {
          active_minutes: number | null
          avg_hr: number | null
          calories: number | null
          created_at: string | null
          external_id: string
          id: string
          source: string
          updated_at: string | null
          user_id: string
          workout_id: string
        }
        Insert: {
          active_minutes?: number | null
          avg_hr?: number | null
          calories?: number | null
          created_at?: string | null
          external_id: string
          id?: string
          source?: string
          updated_at?: string | null
          user_id: string
          workout_id: string
        }
        Update: {
          active_minutes?: number | null
          avg_hr?: number | null
          calories?: number | null
          created_at?: string | null
          external_id?: string
          id?: string
          source?: string
          updated_at?: string | null
          user_id?: string
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_metrics_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          client_id: string | null
          created_at: string | null
          id: string
          location: string | null
          note: string | null
          performed_at: string
          title: string | null
          user_id: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          note?: string | null
          performed_at?: string
          title?: string | null
          user_id: string
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          id?: string
          location?: string | null
          note?: string | null
          performed_at?: string
          title?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_ai_generation: { Args: { p_limit?: number }; Returns: boolean }
      delete_my_data: { Args: never; Returns: undefined }
      reseed_demo: { Args: never; Returns: undefined }
      reseed_demo_full: { Args: never; Returns: undefined }
      save_workout: { Args: { p_payload: Json }; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
