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
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id?: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      conversations: {
        Row: {
          buyer_id: string | null
          buyer_last_read_at: string | null
          created_at: string
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          last_sender_id: string | null
          listing_id: string | null
          seller_id: string | null
          seller_last_read_at: string | null
        }
        Insert: {
          buyer_id?: string | null
          buyer_last_read_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_sender_id?: string | null
          listing_id?: string | null
          seller_id?: string | null
          seller_last_read_at?: string | null
        }
        Update: {
          buyer_id?: string | null
          buyer_last_read_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          last_sender_id?: string | null
          listing_id?: string | null
          seller_id?: string | null
          seller_last_read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_last_sender_id_fkey"
            columns: ["last_sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_verification_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_verification_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_images: {
        Row: {
          created_at: string
          format: string
          height: number
          id: string
          listing_id: string
          position: number
          storage_path: string
          width: number
        }
        Insert: {
          created_at?: string
          format?: string
          height: number
          id?: string
          listing_id: string
          position?: number
          storage_path: string
          width: number
        }
        Update: {
          created_at?: string
          format?: string
          height?: number
          id?: string
          listing_id?: string
          position?: number
          storage_path?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_images_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          attributes: Json
          category_id: number | null
          city_id: number | null
          code: string
          condition: Database["public"]["Enums"]["item_condition"] | null
          created_at: string
          deleted_at: string | null
          description: string | null
          expires_at: string | null
          first_published_at: string | null
          id: string
          is_negotiable: boolean
          moderation_reason: string | null
          neighborhood: string | null
          price_xaf: number | null
          published_at: string | null
          root_category_id: number | null
          search_vector: unknown
          sold_at: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string | null
          updated_at: string
          user_id: string
          view_count: number
        }
        Insert: {
          attributes?: Json
          category_id?: number | null
          city_id?: number | null
          code?: string
          condition?: Database["public"]["Enums"]["item_condition"] | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          first_published_at?: string | null
          id?: string
          is_negotiable?: boolean
          moderation_reason?: string | null
          neighborhood?: string | null
          price_xaf?: number | null
          published_at?: string | null
          root_category_id?: number | null
          search_vector?: unknown
          sold_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Update: {
          attributes?: Json
          category_id?: number | null
          city_id?: number | null
          code?: string
          condition?: Database["public"]["Enums"]["item_condition"] | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          expires_at?: string | null
          first_published_at?: string | null
          id?: string
          is_negotiable?: boolean
          moderation_reason?: string | null
          neighborhood?: string | null
          price_xaf?: number | null
          published_at?: string | null
          root_category_id?: number | null
          search_vector?: unknown
          sold_at?: string | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string | null
          updated_at?: string
          user_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_root_category_id_fkey"
            columns: ["root_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string | null
          conversation_id: string
          created_at: string
          id: number
          image_path: string | null
          sender_id: string | null
        }
        Insert: {
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: never
          image_path?: string | null
          sender_id?: string | null
        }
        Update: {
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: never
          image_path?: string | null
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      moderation_log: {
        Row: {
          action: string
          admin_id: string | null
          created_at: string
          id: number
          reason: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_id?: string | null
          created_at?: string
          id?: never
          reason?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string | null
          created_at?: string
          id?: never
          reason?: string | null
          target_id?: string | null
          target_type?: string
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
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string | null
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string | null
          user_id?: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count?: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          conversation_id: string | null
          created_at: string
          details: string | null
          id: string
          listing_id: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string | null
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          listing_id?: string | null
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id?: string | null
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          listing_id?: string | null
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_user_id?: string | null
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "reports_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listing_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      listing_cards: {
        Row: {
          category_id: number | null
          city_id: number | null
          code: string | null
          condition: Database["public"]["Enums"]["item_condition"] | null
          cover_format: string | null
          cover_path: string | null
          id: string | null
          is_negotiable: boolean | null
          neighborhood: string | null
          price_xaf: number | null
          published_at: string | null
          root_category_id: number | null
          seller_is_premium: boolean | null
          sold_at: string | null
          status: Database["public"]["Enums"]["listing_status"] | null
          title: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_root_category_id_fkey"
            columns: ["root_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      account_storage_objects: {
        Args: { p_user_id: string }
        Returns: {
          bucket_id: string
          name: string
        }[]
      }
      chat_assert_can_write: { Args: { p_user_id: string }; Returns: undefined }
      chat_rate_limit: {
        Args: {
          p_key: string
          p_scope: string
          p_user_id: string
          p_window_seconds: number
        }
        Returns: undefined
      }
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_seconds: number }
        Returns: boolean
      }
      compute_response_times: { Args: never; Returns: undefined }
      consume_email_verification_token: {
        Args: { p_token_hash: string }
        Returns: string
      }
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
      delete_listing: { Args: { p_listing_id: string }; Returns: undefined }
      enforce_plan_limits: { Args: never; Returns: number }
      expire_listings: { Args: never; Returns: number }
      f_unaccent: { Args: { "": string }; Returns: string }
      find_banned_term: { Args: { p_text: string }; Returns: string }
      generate_listing_code: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_blocked_between: {
        Args: { p_a: string; p_b: string }
        Returns: boolean
      }
      is_premium: { Args: { p_user_id: string }; Returns: boolean }
      is_reserved_username: { Args: { p_username: string }; Returns: boolean }
      listing_assert_can_activate: {
        Args: { p_listing_id: string; p_user_id: string }
        Returns: undefined
      }
      listing_for_owner: {
        Args: { p_listing_id: string }
        Returns: {
          attributes: Json
          category_id: number | null
          city_id: number | null
          code: string
          condition: Database["public"]["Enums"]["item_condition"] | null
          created_at: string
          deleted_at: string | null
          description: string | null
          expires_at: string | null
          first_published_at: string | null
          id: string
          is_negotiable: boolean
          moderation_reason: string | null
          neighborhood: string | null
          price_xaf: number | null
          published_at: string | null
          root_category_id: number | null
          search_vector: unknown
          sold_at: string | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string | null
          updated_at: string
          user_id: string
          view_count: number
        }
        SetofOptions: {
          from: "*"
          to: "listings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      listing_whatsapp_enabled: {
        Args: { p_listing_id: string }
        Returns: boolean
      }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      mark_listing_sold: { Args: { p_listing_id: string }; Returns: undefined }
      my_conversations: {
        Args: { p_conversation_id?: string; p_limit?: number; p_role?: string }
        Returns: {
          blocked_by_me: boolean
          blocked_me: boolean
          cover_format: string
          cover_path: string
          id: string
          last_message_at: string
          last_message_preview: string
          last_sender_is_me: boolean
          listing_category_id: number
          listing_city_id: number
          listing_code: string
          listing_id: string
          listing_is_negotiable: boolean
          listing_price_xaf: number
          listing_status: Database["public"]["Enums"]["listing_status"]
          listing_title: string
          other_display_name: string
          other_id: string
          other_is_premium: boolean
          other_last_read_at: string
          other_response_time_minutes: number
          other_username: string
          role: string
          unread_count: number
        }[]
      }
      my_favorites: {
        Args: { p_limit?: number }
        Returns: {
          availability: string
          category_id: number
          city_id: number
          code: string
          cover_format: string
          cover_path: string
          favorited_at: string
          is_negotiable: boolean
          listing_id: string
          neighborhood: string
          price_xaf: number
          published_at: string
          title: string
        }[]
      }
      pause_listing: { Args: { p_listing_id: string }; Returns: undefined }
      publish_listing: { Args: { p_listing_id: string }; Returns: undefined }
      reactivate_listing: { Args: { p_listing_id: string }; Returns: undefined }
      register_listing_view: {
        Args: { p_listing_id: string }
        Returns: undefined
      }
      renew_listing: { Args: { p_listing_id: string }; Returns: undefined }
      renew_premium_listings: { Args: never; Returns: number }
      report_conversation: {
        Args: {
          p_block?: boolean
          p_conversation_id: string
          p_details?: string
          p_reason: Database["public"]["Enums"]["report_reason"]
        }
        Returns: string
      }
      report_listing: {
        Args: {
          p_details?: string
          p_listing_id: string
          p_reason: Database["public"]["Enums"]["report_reason"]
        }
        Returns: string
      }
      report_rate_limit: { Args: { p_user_id: string }; Returns: undefined }
      resolve_login_email: { Args: { p_identifier: string }; Returns: string }
      search_listings: {
        Args: {
          p_attributes?: Json
          p_category_id?: number
          p_city_id?: number
          p_condition?: Database["public"]["Enums"]["item_condition"]
          p_limit?: number
          p_price_max?: number
          p_price_min?: number
          p_query?: string
          p_ranges?: Json
          p_sort?: string
        }
        Returns: {
          category_id: number
          city_id: number
          code: string
          condition: Database["public"]["Enums"]["item_condition"]
          cover_format: string
          cover_path: string
          id: string
          is_negotiable: boolean
          neighborhood: string
          price_xaf: number
          published_at: string
          seller_is_premium: boolean
          title: string
          total_count: number
        }[]
      }
      send_message: {
        Args: {
          p_body?: string
          p_conversation_id: string
          p_image_path?: string
        }
        Returns: {
          body: string | null
          conversation_id: string
          created_at: string
          id: number
          image_path: string | null
          sender_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "messages"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_listing_cover: { Args: { p_image_id: string }; Returns: undefined }
      start_conversation: { Args: { p_listing_id: string }; Returns: string }
      unread_count: { Args: never; Returns: number }
      whatsapp_contact: { Args: { p_listing_id: string }; Returns: string }
    }
    Enums: {
      account_status: "active" | "suspended" | "banned"
      attribute_type: "text" | "number" | "select" | "boolean"
      item_condition: "new" | "used"
      listing_status:
        | "draft"
        | "active"
        | "paused"
        | "sold"
        | "expired"
        | "under_review"
        | "blocked"
        | "deleted"
      price_period: "total" | "month"
      report_reason:
        | "scam"
        | "prohibited"
        | "duplicate"
        | "wrong_category"
        | "offensive"
        | "other"
      report_status: "open" | "resolved" | "dismissed"
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
      item_condition: ["new", "used"],
      listing_status: [
        "draft",
        "active",
        "paused",
        "sold",
        "expired",
        "under_review",
        "blocked",
        "deleted",
      ],
      price_period: ["total", "month"],
      report_reason: [
        "scam",
        "prohibited",
        "duplicate",
        "wrong_category",
        "offensive",
        "other",
      ],
      report_status: ["open", "resolved", "dismissed"],
      user_role: ["user", "admin"],
    },
  },
} as const
