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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          is_public: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          is_public?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          is_public?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      categories: {
        Row: {
          has_condition: boolean
          icon: string | null
          id: number
          is_active: boolean
          name: string
          parent_id: number | null
          price_period: Database["public"]["Enums"]["price_period"]
          price_required: boolean
          slug: string
          sort_order: number
        }
        Insert: {
          has_condition?: boolean
          icon?: string | null
          id?: never
          is_active?: boolean
          name: string
          parent_id?: number | null
          price_period?: Database["public"]["Enums"]["price_period"]
          price_required?: boolean
          slug: string
          sort_order?: number
        }
        Update: {
          has_condition?: boolean
          icon?: string | null
          id?: never
          is_active?: boolean
          name?: string
          parent_id?: number | null
          price_period?: Database["public"]["Enums"]["price_period"]
          price_required?: boolean
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      category_attributes: {
        Row: {
          category_id: number
          id: number
          is_filterable: boolean
          is_required: boolean
          key: string
          label: string
          options: Json | null
          sort_order: number
          type: Database["public"]["Enums"]["attribute_type"]
          unit: string | null
        }
        Insert: {
          category_id: number
          id?: never
          is_filterable?: boolean
          is_required?: boolean
          key: string
          label: string
          options?: Json | null
          sort_order?: number
          type: Database["public"]["Enums"]["attribute_type"]
          unit?: string | null
        }
        Update: {
          category_id?: number
          id?: never
          is_filterable?: boolean
          is_required?: boolean
          key?: string
          label?: string
          options?: Json | null
          sort_order?: number
          type?: Database["public"]["Enums"]["attribute_type"]
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "category_attributes_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      cities: {
        Row: {
          id: number
          is_active: boolean
          name: string
          slug: string
          sort_order: number
        }
        Insert: {
          id?: never
          is_active?: boolean
          name: string
          slug: string
          sort_order?: number
        }
        Update: {
          id?: never
          is_active?: boolean
          name?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      plan_prices: {
        Row: {
          is_active: boolean
          months: number
          plan_id: string
          price_xaf: number
        }
        Insert: {
          is_active?: boolean
          months: number
          plan_id: string
          price_xaf: number
        }
        Update: {
          is_active?: boolean
          months?: number
          plan_id?: string
          price_xaf?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_prices_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          auto_renew: boolean
          has_store: boolean
          id: string
          is_featured: boolean
          listing_duration_days: number
          max_active_listings: number
          max_photos: number
          updated_at: string
        }
        Insert: {
          auto_renew?: boolean
          has_store?: boolean
          id: string
          is_featured?: boolean
          listing_duration_days: number
          max_active_listings: number
          max_photos: number
          updated_at?: string
        }
        Update: {
          auto_renew?: boolean
          has_store?: boolean
          id?: string
          is_featured?: boolean
          listing_duration_days?: number
          max_active_listings?: number
          max_photos?: number
          updated_at?: string
        }
        Relationships: []
      }
      profile_private: {
        Row: {
          email_verified_at: string | null
          notify_email: boolean
          notify_push: boolean
          phone: string
          phone_verified_at: string | null
          role: Database["public"]["Enums"]["user_role"]
          show_whatsapp: boolean
          suspended_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          email_verified_at?: string | null
          notify_email?: boolean
          notify_push?: boolean
          phone: string
          phone_verified_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          show_whatsapp?: boolean
          suspended_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          email_verified_at?: string | null
          notify_email?: boolean
          notify_push?: boolean
          phone?: string
          phone_verified_at?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          show_whatsapp?: boolean
          suspended_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          city_id: number | null
          created_at: string
          display_name: string
          id: string
          premium_until: string | null
          response_time_minutes: number | null
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          username: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          city_id?: number | null
          created_at?: string
          display_name: string
          id: string
          premium_until?: string | null
          response_time_minutes?: number | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          city_id?: number | null
          created_at?: string
          display_name?: string
          id?: string
          premium_until?: string | null
          response_time_minutes?: number | null
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          cover_path: string | null
          created_at: string
          description: string | null
          logo_path: string | null
          name: string
          opening_hours: string | null
          slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string | null
          logo_path?: string | null
          name: string
          opening_hours?: string | null
          slug: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string | null
          logo_path?: string | null
          name?: string
          opening_hours?: string | null
          slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_plan: {
        Args: { p_user_id: string }
        Returns: {
          auto_renew: boolean
          has_store: boolean
          id: string
          is_featured: boolean
          listing_duration_days: number
          max_active_listings: number
          max_photos: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "plans"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      f_unaccent: { Args: { "": string }; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_premium: { Args: { p_user_id: string }; Returns: boolean }
      is_reserved_username: { Args: { p_username: string }; Returns: boolean }
      resolve_login_email: { Args: { p_identifier: string }; Returns: string }
    }
    Enums: {
      account_status: "active" | "suspended" | "banned"
      attribute_type: "text" | "number" | "select" | "boolean"
      price_period: "total" | "month"
      user_role: "user" | "admin"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_status: ["active", "suspended", "banned"],
      attribute_type: ["text", "number", "select", "boolean"],
      price_period: ["total", "month"],
      user_role: ["user", "admin"],
    },
  },
} as const
