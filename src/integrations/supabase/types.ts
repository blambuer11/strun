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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      challenges: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          max_progress: number
          title: string
          xp_reward: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          max_progress: number
          title: string
          xp_reward: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          max_progress?: number
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      competition_participants: {
        Row: {
          competition_id: string | null
          id: string
          joined_at: string | null
          rank: number | null
          score: number | null
          user_id: string | null
        }
        Insert: {
          competition_id?: string | null
          id?: string
          joined_at?: string | null
          rank?: number | null
          score?: number | null
          user_id?: string | null
        }
        Update: {
          competition_id?: string | null
          id?: string
          joined_at?: string | null
          rank?: number | null
          score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competition_participants_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "competitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competition_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      competitions: {
        Row: {
          created_at: string | null
          description: string | null
          end_date: string
          id: string
          image_url: string | null
          prize: string
          sponsor: string | null
          start_date: string
          title: string
          type: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          end_date: string
          id?: string
          image_url?: string | null
          prize: string
          sponsor?: string | null
          start_date: string
          title: string
          type?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          end_date?: string
          id?: string
          image_url?: string | null
          prize?: string
          sponsor?: string | null
          start_date?: string
          title?: string
          type?: string | null
        }
        Relationships: []
      }
      leaderboard_entries: {
        Row: {
          category: string
          country: string | null
          created_at: string | null
          id: string
          period: string
          previous_rank: number | null
          rank: number | null
          updated_at: string | null
          user_id: string | null
          value: number
        }
        Insert: {
          category: string
          country?: string | null
          created_at?: string | null
          id?: string
          period: string
          previous_rank?: number | null
          rank?: number | null
          updated_at?: string | null
          user_id?: string | null
          value: number
        }
        Update: {
          category?: string
          country?: string | null
          created_at?: string | null
          id?: string
          period?: string
          previous_rank?: number | null
          rank?: number | null
          updated_at?: string | null
          user_id?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaderboard_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lobby_participants: {
        Row: {
          area_completed: number | null
          distance_completed: number | null
          id: string
          joined_at: string | null
          lobby_id: string | null
          user_id: string | null
        }
        Insert: {
          area_completed?: number | null
          distance_completed?: number | null
          id?: string
          joined_at?: string | null
          lobby_id?: string | null
          user_id?: string | null
        }
        Update: {
          area_completed?: number | null
          distance_completed?: number | null
          id?: string
          joined_at?: string | null
          lobby_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lobby_participants_lobby_id_fkey"
            columns: ["lobby_id"]
            isOneToOne: false
            referencedRelation: "private_lobbies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobby_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lobby_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      private_lobbies: {
        Row: {
          code: string
          created_at: string | null
          creator_id: string | null
          end_time: string | null
          id: string
          name: string
          start_time: string | null
          status: string | null
          target_area: number | null
          target_distance: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          creator_id?: string | null
          end_time?: string | null
          id?: string
          name: string
          start_time?: string | null
          status?: string | null
          target_area?: number | null
          target_distance?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          creator_id?: string | null
          end_time?: string | null
          id?: string
          name?: string
          start_time?: string | null
          status?: string | null
          target_area?: number | null
          target_distance?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "private_lobbies_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "private_lobbies_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          email: string
          id: string
          level: number | null
          total_area: number | null
          total_distance: number | null
          updated_at: string | null
          user_id: string
          username: string
          wallet_address: string | null
          xp: number | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          email: string
          id?: string
          level?: number | null
          total_area?: number | null
          total_distance?: number | null
          updated_at?: string | null
          user_id: string
          username: string
          wallet_address?: string | null
          xp?: number | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          email?: string
          id?: string
          level?: number | null
          total_area?: number | null
          total_distance?: number | null
          updated_at?: string | null
          user_id?: string
          username?: string
          wallet_address?: string | null
          xp?: number | null
        }
        Relationships: []
      }
      regions: {
        Row: {
          area: number
          claimed_at: string | null
          color: string | null
          coordinates: Json
          created_at: string | null
          description: string | null
          id: string
          last_visited: string | null
          metadata: Json | null
          name: string
          nft_id: string | null
          owner_id: string | null
          rent_price: number | null
          total_earnings: number | null
          updated_at: string | null
          visitors: number | null
        }
        Insert: {
          area: number
          claimed_at?: string | null
          color?: string | null
          coordinates: Json
          created_at?: string | null
          description?: string | null
          id?: string
          last_visited?: string | null
          metadata?: Json | null
          name: string
          nft_id?: string | null
          owner_id?: string | null
          rent_price?: number | null
          total_earnings?: number | null
          updated_at?: string | null
          visitors?: number | null
        }
        Update: {
          area?: number
          claimed_at?: string | null
          color?: string | null
          coordinates?: Json
          created_at?: string | null
          description?: string | null
          id?: string
          last_visited?: string | null
          metadata?: Json | null
          name?: string
          nft_id?: string | null
          owner_id?: string | null
          rent_price?: number | null
          total_earnings?: number | null
          updated_at?: string | null
          visitors?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "regions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "regions_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          avg_pace: number | null
          calories_burned: number | null
          captured_area: Json | null
          created_at: string | null
          distance: number | null
          duration: number | null
          end_time: string | null
          id: string
          max_speed: number | null
          path: Json
          start_time: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
          weather: Json | null
          xp_earned: number | null
        }
        Insert: {
          avg_pace?: number | null
          calories_burned?: number | null
          captured_area?: Json | null
          created_at?: string | null
          distance?: number | null
          duration?: number | null
          end_time?: string | null
          id?: string
          max_speed?: number | null
          path: Json
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          weather?: Json | null
          xp_earned?: number | null
        }
        Update: {
          avg_pace?: number | null
          calories_burned?: number | null
          captured_area?: Json | null
          created_at?: string | null
          distance?: number | null
          duration?: number | null
          end_time?: string | null
          id?: string
          max_speed?: number | null
          path?: Json
          start_time?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
          weather?: Json | null
          xp_earned?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string | null
          from_user_id: string | null
          id: string
          metadata: Json | null
          region_id: string | null
          status: string | null
          to_user_id: string | null
          tx_hash: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          metadata?: Json | null
          region_id?: string | null
          status?: string | null
          to_user_id?: string | null
          tx_hash?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          from_user_id?: string | null
          id?: string
          metadata?: Json | null
          region_id?: string | null
          status?: string | null
          to_user_id?: string | null
          tx_hash?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_from_user_id_fkey"
            columns: ["from_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_to_user_id_fkey"
            columns: ["to_user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_challenges: {
        Row: {
          challenge_id: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          progress: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          challenge_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          progress?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          challenge_id?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          progress?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_challenges_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_challenges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "public_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          country: string | null
          country_code: string | null
          created_at: string | null
          id: string | null
          level: number | null
          total_area: number | null
          total_distance: number | null
          user_id: string | null
          username: string | null
          xp: number | null
        }
        Insert: {
          avatar_url?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string | null
          level?: number | null
          total_area?: number | null
          total_distance?: number | null
          user_id?: string | null
          username?: string | null
          xp?: number | null
        }
        Update: {
          avatar_url?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string | null
          level?: number | null
          total_area?: number | null
          total_distance?: number | null
          user_id?: string | null
          username?: string | null
          xp?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      [_ in never]: never
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
