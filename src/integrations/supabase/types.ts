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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      cleaners: {
        Row: {
          active: boolean
          created_at: string
          daily_working_hours: number
          email: string | null
          id: string
          location_groups: string[] | null
          name: string
          non_working_days: string[] | null
          phone: string | null
          rate_per_clean: number | null
          region: string
          updated_at: string
          workload_share: Json | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_working_hours?: number
          email?: string | null
          id?: string
          location_groups?: string[] | null
          name: string
          non_working_days?: string[] | null
          phone?: string | null
          rate_per_clean?: number | null
          region?: string
          updated_at?: string
          workload_share?: Json | null
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_working_hours?: number
          email?: string | null
          id?: string
          location_groups?: string[] | null
          name?: string
          non_working_days?: string[] | null
          phone?: string | null
          rate_per_clean?: number | null
          region?: string
          updated_at?: string
          workload_share?: Json | null
        }
        Relationships: []
      }
      listings: {
        Row: {
          access_details: string | null
          address: string | null
          base_rate: number | null
          bathrooms: number | null
          bedrooms: number | null
          city: string | null
          cleaning_duration_minutes: number | null
          country: string | null
          created_at: string
          google_place_id: string | null
          hostaway_listing_id: number | null
          id: string
          image_url: string | null
          latitude: number | null
          location_group: string | null
          longitude: number | null
          management_rate_override: number | null
          max_guests: number | null
          min_rate: number | null
          name: string
          nightly_rate: number | null
          operational_notes: string | null
          owner_id: string | null
          postcode: string | null
          primary_cleaner: string | null
          property_type: string | null
          status: string
          tags: string | null
          troubleshooting_notes: string | null
          updated_at: string
        }
        Insert: {
          access_details?: string | null
          address?: string | null
          base_rate?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          cleaning_duration_minutes?: number | null
          country?: string | null
          created_at?: string
          google_place_id?: string | null
          hostaway_listing_id?: number | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          location_group?: string | null
          longitude?: number | null
          management_rate_override?: number | null
          max_guests?: number | null
          min_rate?: number | null
          name: string
          nightly_rate?: number | null
          operational_notes?: string | null
          owner_id?: string | null
          postcode?: string | null
          primary_cleaner?: string | null
          property_type?: string | null
          status?: string
          tags?: string | null
          troubleshooting_notes?: string | null
          updated_at?: string
        }
        Update: {
          access_details?: string | null
          address?: string | null
          base_rate?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          city?: string | null
          cleaning_duration_minutes?: number | null
          country?: string | null
          created_at?: string
          google_place_id?: string | null
          hostaway_listing_id?: number | null
          id?: string
          image_url?: string | null
          latitude?: number | null
          location_group?: string | null
          longitude?: number | null
          management_rate_override?: number | null
          max_guests?: number | null
          min_rate?: number | null
          name?: string
          nightly_rate?: number | null
          operational_notes?: string | null
          owner_id?: string | null
          postcode?: string | null
          primary_cleaner?: string | null
          property_type?: string | null
          status?: string
          tags?: string | null
          troubleshooting_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listings_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      property_owners: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          id: string
          management_rate_pct: number | null
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
          vat_inclusive: boolean
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          management_rate_pct?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          vat_inclusive?: boolean
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          id?: string
          management_rate_pct?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
          vat_inclusive?: boolean
        }
        Relationships: []
      }
      reservations: {
        Row: {
          booking_lead_days: number | null
          check_in: string
          check_out: string
          created_at: string
          day_of_week: number | null
          guest_fees: number | null
          guest_name: string
          hostaway_reservation_id: number | null
          id: string
          listing_id: string
          month: number | null
          owner_payout: number | null
          platform: string | null
          quarter: number | null
          reservation_date: string | null
          status: string
          total_amount: number | null
          week_number: number | null
          year: number | null
        }
        Insert: {
          booking_lead_days?: number | null
          check_in: string
          check_out: string
          created_at?: string
          day_of_week?: number | null
          guest_fees?: number | null
          guest_name: string
          hostaway_reservation_id?: number | null
          id?: string
          listing_id: string
          month?: number | null
          owner_payout?: number | null
          platform?: string | null
          quarter?: number | null
          reservation_date?: string | null
          status?: string
          total_amount?: number | null
          week_number?: number | null
          year?: number | null
        }
        Update: {
          booking_lead_days?: number | null
          check_in?: string
          check_out?: string
          created_at?: string
          day_of_week?: number | null
          guest_fees?: number | null
          guest_name?: string
          hostaway_reservation_id?: number | null
          id?: string
          listing_id?: string
          month?: number | null
          owner_payout?: number | null
          platform?: string | null
          quarter?: number | null
          reservation_date?: string | null
          status?: string
          total_amount?: number | null
          week_number?: number | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reservations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          completed_at: string | null
          errors: Json | null
          id: string
          listings_synced: number | null
          reservations_skipped: number | null
          reservations_synced: number | null
          started_at: string
          status: string
          sync_type: string
          triggered_by: string | null
        }
        Insert: {
          completed_at?: string | null
          errors?: Json | null
          id?: string
          listings_synced?: number | null
          reservations_skipped?: number | null
          reservations_synced?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          triggered_by?: string | null
        }
        Update: {
          completed_at?: string | null
          errors?: Json | null
          id?: string
          listings_synced?: number | null
          reservations_skipped?: number | null
          reservations_synced?: number | null
          started_at?: string
          status?: string
          sync_type?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      upload_batches: {
        Row: {
          created_at: string
          file_name: string
          id: string
          row_count: number | null
          status: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          row_count?: number | null
          status?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          row_count?: number | null
          status?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      manage_hostaway_cron: {
        Args: {
          anon_key?: string
          interval_hours: number
          supabase_url?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super" | "senior" | "admin" | "client"
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
    Enums: {
      app_role: ["super", "senior", "admin", "client"],
    },
  },
} as const
