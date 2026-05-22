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
      amenities: {
        Row: {
          added_by: string | null
          address: string | null
          category: Database["public"]["Enums"]["amenity_category"]
          created_at: string
          google_place_id: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          opening_hours: string | null
          phone: string | null
          postcode: string | null
          price_range: string | null
          rating: number | null
          tags: string[] | null
          updated_at: string
          website: string | null
        }
        Insert: {
          added_by?: string | null
          address?: string | null
          category?: Database["public"]["Enums"]["amenity_category"]
          created_at?: string
          google_place_id?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          opening_hours?: string | null
          phone?: string | null
          postcode?: string | null
          price_range?: string | null
          rating?: number | null
          tags?: string[] | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          added_by?: string | null
          address?: string | null
          category?: Database["public"]["Enums"]["amenity_category"]
          created_at?: string
          google_place_id?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          opening_hours?: string | null
          phone?: string | null
          postcode?: string | null
          price_range?: string | null
          rating?: number | null
          tags?: string[] | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
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
      automation_logs: {
        Row: {
          error_message: string | null
          id: string
          run_at: string
          status: string
          tasks_created: number
          tasks_unassigned: number
          triggered_by: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          run_at?: string
          status?: string
          tasks_created?: number
          tasks_unassigned?: number
          triggered_by?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          run_at?: string
          status?: string
          tasks_created?: number
          tasks_unassigned?: number
          triggered_by?: string | null
        }
        Relationships: []
      }
      clean_issues: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          clean_task_id: string | null
          created_at: string
          description: string
          id: string
          issue_type: string
          listing_id: string
          photo_paths: string[] | null
          reported_by_cleaner_id: string | null
          reported_by_user_id: string | null
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          updated_at: string
          urgency: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          clean_task_id?: string | null
          created_at?: string
          description: string
          id?: string
          issue_type: string
          listing_id: string
          photo_paths?: string[] | null
          reported_by_cleaner_id?: string | null
          reported_by_user_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          urgency?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          clean_task_id?: string | null
          created_at?: string
          description?: string
          id?: string
          issue_type?: string
          listing_id?: string
          photo_paths?: string[] | null
          reported_by_cleaner_id?: string | null
          reported_by_user_id?: string | null
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          updated_at?: string
          urgency?: string
        }
        Relationships: [
          {
            foreignKeyName: "clean_issues_clean_task_id_fkey"
            columns: ["clean_task_id"]
            isOneToOne: false
            referencedRelation: "clean_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clean_issues_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clean_issues_reported_by_cleaner_id_fkey"
            columns: ["reported_by_cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
        ]
      }
      clean_tasks: {
        Row: {
          assigned_cleaner_id: string | null
          checkin_time: string | null
          checkout_time: string | null
          cleaning_duration_minutes: number
          completed_at: string | null
          created_at: string
          estimated_start_time: string | null
          id: string
          is_same_day_turnaround: boolean | null
          listing_id: string
          notes: string | null
          overloaded: boolean
          override_assignment: boolean
          priority: string
          priority_level: number
          reservation_id: string | null
          route_order: number | null
          scheduled_date: string
          source: string
          status: string
          task_type: string
          travel_time_from_previous_minutes: number | null
          updated_at: string
          warning_reason: string | null
        }
        Insert: {
          assigned_cleaner_id?: string | null
          checkin_time?: string | null
          checkout_time?: string | null
          cleaning_duration_minutes?: number
          completed_at?: string | null
          created_at?: string
          estimated_start_time?: string | null
          id?: string
          is_same_day_turnaround?: boolean | null
          listing_id: string
          notes?: string | null
          overloaded?: boolean
          override_assignment?: boolean
          priority?: string
          priority_level?: number
          reservation_id?: string | null
          route_order?: number | null
          scheduled_date: string
          source?: string
          status?: string
          task_type?: string
          travel_time_from_previous_minutes?: number | null
          updated_at?: string
          warning_reason?: string | null
        }
        Update: {
          assigned_cleaner_id?: string | null
          checkin_time?: string | null
          checkout_time?: string | null
          cleaning_duration_minutes?: number
          completed_at?: string | null
          created_at?: string
          estimated_start_time?: string | null
          id?: string
          is_same_day_turnaround?: boolean | null
          listing_id?: string
          notes?: string | null
          overloaded?: boolean
          override_assignment?: boolean
          priority?: string
          priority_level?: number
          reservation_id?: string | null
          route_order?: number | null
          scheduled_date?: string
          source?: string
          status?: string
          task_type?: string
          travel_time_from_previous_minutes?: number | null
          updated_at?: string
          warning_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clean_tasks_assigned_cleaner_id_fkey"
            columns: ["assigned_cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clean_tasks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clean_tasks_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_holidays: {
        Row: {
          cleaner_id: string
          created_at: string
          created_by: string | null
          end_date: string
          id: string
          notes: string | null
          reason: string
          start_date: string
          updated_at: string
        }
        Insert: {
          cleaner_id: string
          created_at?: string
          created_by?: string | null
          end_date: string
          id?: string
          notes?: string | null
          reason?: string
          start_date: string
          updated_at?: string
        }
        Update: {
          cleaner_id?: string
          created_at?: string
          created_by?: string | null
          end_date?: string
          id?: string
          notes?: string | null
          reason?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_holidays_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaners: {
        Row: {
          active: boolean
          color: string | null
          created_at: string
          daily_working_hours: number
          email: string | null
          home_latitude: number | null
          home_longitude: number | null
          home_postcode: string | null
          id: string
          location_groups: string[] | null
          name: string
          non_working_days: string[] | null
          notify_email: boolean
          notify_whatsapp: boolean
          phone: string | null
          rate_per_clean: number | null
          region: string
          updated_at: string
          user_id: string | null
          workload_share: Json | null
        }
        Insert: {
          active?: boolean
          color?: string | null
          created_at?: string
          daily_working_hours?: number
          email?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          home_postcode?: string | null
          id?: string
          location_groups?: string[] | null
          name: string
          non_working_days?: string[] | null
          notify_email?: boolean
          notify_whatsapp?: boolean
          phone?: string | null
          rate_per_clean?: number | null
          region?: string
          updated_at?: string
          user_id?: string | null
          workload_share?: Json | null
        }
        Update: {
          active?: boolean
          color?: string | null
          created_at?: string
          daily_working_hours?: number
          email?: string | null
          home_latitude?: number | null
          home_longitude?: number | null
          home_postcode?: string | null
          id?: string
          location_groups?: string[] | null
          name?: string
          non_working_days?: string[] | null
          notify_email?: boolean
          notify_whatsapp?: boolean
          phone?: string | null
          rate_per_clean?: number | null
          region?: string
          updated_at?: string
          user_id?: string | null
          workload_share?: Json | null
        }
        Relationships: []
      }
      listings: {
        Row: {
          access_details: string | null
          address: string | null
          amenities: Json
          base_rate: number | null
          bathrooms: number | null
          bedrooms: number | null
          bundle_components: Json | null
          city: string | null
          cleaning_duration_minutes: number | null
          country: string | null
          created_at: string
          default_check_in_time: string | null
          default_check_out_time: string | null
          google_place_id: string | null
          has_ev_charger: boolean
          has_hot_tub: boolean
          hostaway_listing_id: number | null
          id: string
          image_url: string | null
          is_bundle: boolean
          is_clean: boolean
          latitude: number | null
          location_group: string | null
          longitude: number | null
          management_rate_override: number | null
          max_guests: number | null
          min_rate: number | null
          min_stay_nights: number
          name: string
          nightly_rate: number | null
          operational_notes: string | null
          owner_id: string | null
          pet_friendly: boolean
          postcode: string | null
          primary_cleaner: string | null
          property_type: string | null
          self_check_in: boolean
          slug: string | null
          status: string
          tags: string | null
          troubleshooting_notes: string | null
          updated_at: string
        }
        Insert: {
          access_details?: string | null
          address?: string | null
          amenities?: Json
          base_rate?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          bundle_components?: Json | null
          city?: string | null
          cleaning_duration_minutes?: number | null
          country?: string | null
          created_at?: string
          default_check_in_time?: string | null
          default_check_out_time?: string | null
          google_place_id?: string | null
          has_ev_charger?: boolean
          has_hot_tub?: boolean
          hostaway_listing_id?: number | null
          id?: string
          image_url?: string | null
          is_bundle?: boolean
          is_clean?: boolean
          latitude?: number | null
          location_group?: string | null
          longitude?: number | null
          management_rate_override?: number | null
          max_guests?: number | null
          min_rate?: number | null
          min_stay_nights?: number
          name: string
          nightly_rate?: number | null
          operational_notes?: string | null
          owner_id?: string | null
          pet_friendly?: boolean
          postcode?: string | null
          primary_cleaner?: string | null
          property_type?: string | null
          self_check_in?: boolean
          slug?: string | null
          status?: string
          tags?: string | null
          troubleshooting_notes?: string | null
          updated_at?: string
        }
        Update: {
          access_details?: string | null
          address?: string | null
          amenities?: Json
          base_rate?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          bundle_components?: Json | null
          city?: string | null
          cleaning_duration_minutes?: number | null
          country?: string | null
          created_at?: string
          default_check_in_time?: string | null
          default_check_out_time?: string | null
          google_place_id?: string | null
          has_ev_charger?: boolean
          has_hot_tub?: boolean
          hostaway_listing_id?: number | null
          id?: string
          image_url?: string | null
          is_bundle?: boolean
          is_clean?: boolean
          latitude?: number | null
          location_group?: string | null
          longitude?: number | null
          management_rate_override?: number | null
          max_guests?: number | null
          min_rate?: number | null
          min_stay_nights?: number
          name?: string
          nightly_rate?: number | null
          operational_notes?: string | null
          owner_id?: string | null
          pet_friendly?: boolean
          postcode?: string | null
          primary_cleaner?: string | null
          property_type?: string | null
          self_check_in?: boolean
          slug?: string | null
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
      location_groups: {
        Row: {
          archived: boolean
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      orin_briefs: {
        Row: {
          content: Json | null
          created_at: string
          generated_at: string | null
          id: string
          period_end: string
          period_label: string
          period_start: string
          period_type: string
          status: string
          updated_at: string
        }
        Insert: {
          content?: Json | null
          created_at?: string
          generated_at?: string | null
          id?: string
          period_end: string
          period_label: string
          period_start: string
          period_type: string
          status?: string
          updated_at?: string
        }
        Update: {
          content?: Json | null
          created_at?: string
          generated_at?: string | null
          id?: string
          period_end?: string
          period_label?: string
          period_start?: string
          period_type?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      orin_conversations: {
        Row: {
          content: string
          created_at: string
          current_page: string | null
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          current_page?: string | null
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          current_page?: string | null
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
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
      property_amenities: {
        Row: {
          amenity_id: string
          created_at: string
          directions_url: string | null
          display_order: number
          distance_km: number | null
          drive_time_mins: number | null
          id: string
          is_featured: boolean
          listing_id: string
          staff_note: string | null
          updated_at: string
          walk_time_mins: number | null
        }
        Insert: {
          amenity_id: string
          created_at?: string
          directions_url?: string | null
          display_order?: number
          distance_km?: number | null
          drive_time_mins?: number | null
          id?: string
          is_featured?: boolean
          listing_id: string
          staff_note?: string | null
          updated_at?: string
          walk_time_mins?: number | null
        }
        Update: {
          amenity_id?: string
          created_at?: string
          directions_url?: string | null
          display_order?: number
          distance_km?: number | null
          drive_time_mins?: number | null
          id?: string
          is_featured?: boolean
          listing_id?: string
          staff_note?: string | null
          updated_at?: string
          walk_time_mins?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_amenities_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      property_appliances: {
        Row: {
          common_issues: string | null
          created_at: string
          id: string
          instructions: string | null
          listing_id: string
          location: string | null
          manual_url: string | null
          model_number: string | null
          name: string
          updated_at: string
        }
        Insert: {
          common_issues?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          listing_id: string
          location?: string | null
          manual_url?: string | null
          model_number?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          common_issues?: string | null
          created_at?: string
          id?: string
          instructions?: string | null
          listing_id?: string
          location?: string | null
          manual_url?: string | null
          model_number?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_appliances_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      property_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          listing_id: string
          name: string
          notes: string | null
          phone: string | null
          role: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          listing_id: string
          name: string
          notes?: string | null
          phone?: string | null
          role?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          listing_id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_contacts_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          listing_id: string
          notes: string | null
          title: string
          type: string
          url: string | null
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          listing_id: string
          notes?: string | null
          title: string
          type?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          listing_id?: string
          notes?: string | null
          title?: string
          type?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      property_knowledge: {
        Row: {
          access_notes: string | null
          alarm_code: string | null
          appliances_info: string | null
          backup_network: string | null
          bin_collection_day: string | null
          bin_location: string | null
          bins_recycling: string | null
          boiler_location: string | null
          boiler_make_model: string | null
          boiler_reset_procedure: string | null
          checkout_instructions: string | null
          cleaning_duration_hours: number | null
          cleaning_notes: string | null
          cleaning_quirks: string | null
          cleaning_supplies_location: string | null
          completion_score: number
          created_at: string
          electric_meter_location: string | null
          emergency_contacts: string | null
          fusebox_location: string | null
          gas_meter_location: string | null
          gate_code: string | null
          general_notes: string | null
          guest_info: string | null
          has_hot_tub: boolean
          heating_notes: string | null
          heating_system_type: string | null
          hot_tub_chemical_schedule: string | null
          hot_tub_error_codes: Json | null
          hot_tub_filter_frequency: string | null
          hot_tub_last_service: string | null
          hot_tub_make_model: string | null
          hot_tub_notes: string | null
          hot_tub_supplier_contact: string | null
          hot_tub_target_temp: number | null
          hot_water_cylinder_location: string | null
          id: string
          immersion_heater_details: string | null
          key_features: string | null
          key_safe_code: string | null
          key_safe_location: string | null
          last_updated_by: string | null
          linen_storage_location: string | null
          listing_id: string
          local_area: string | null
          lock_type: string | null
          oil_supplier_contact: string | null
          oil_tank_location: string | null
          parking_info: string | null
          property_type: string | null
          recycling_notes: string | null
          router_location: string | null
          router_reset_procedure: string | null
          spare_key_location: string | null
          stopcock_location: string | null
          thermostat_location: string | null
          updated_at: string
          utility_notes: string | null
          water_pressure_notes: string | null
          wifi_info: string | null
          wifi_notes: string | null
          wifi_password: string | null
          wifi_ssid: string | null
        }
        Insert: {
          access_notes?: string | null
          alarm_code?: string | null
          appliances_info?: string | null
          backup_network?: string | null
          bin_collection_day?: string | null
          bin_location?: string | null
          bins_recycling?: string | null
          boiler_location?: string | null
          boiler_make_model?: string | null
          boiler_reset_procedure?: string | null
          checkout_instructions?: string | null
          cleaning_duration_hours?: number | null
          cleaning_notes?: string | null
          cleaning_quirks?: string | null
          cleaning_supplies_location?: string | null
          completion_score?: number
          created_at?: string
          electric_meter_location?: string | null
          emergency_contacts?: string | null
          fusebox_location?: string | null
          gas_meter_location?: string | null
          gate_code?: string | null
          general_notes?: string | null
          guest_info?: string | null
          has_hot_tub?: boolean
          heating_notes?: string | null
          heating_system_type?: string | null
          hot_tub_chemical_schedule?: string | null
          hot_tub_error_codes?: Json | null
          hot_tub_filter_frequency?: string | null
          hot_tub_last_service?: string | null
          hot_tub_make_model?: string | null
          hot_tub_notes?: string | null
          hot_tub_supplier_contact?: string | null
          hot_tub_target_temp?: number | null
          hot_water_cylinder_location?: string | null
          id?: string
          immersion_heater_details?: string | null
          key_features?: string | null
          key_safe_code?: string | null
          key_safe_location?: string | null
          last_updated_by?: string | null
          linen_storage_location?: string | null
          listing_id: string
          local_area?: string | null
          lock_type?: string | null
          oil_supplier_contact?: string | null
          oil_tank_location?: string | null
          parking_info?: string | null
          property_type?: string | null
          recycling_notes?: string | null
          router_location?: string | null
          router_reset_procedure?: string | null
          spare_key_location?: string | null
          stopcock_location?: string | null
          thermostat_location?: string | null
          updated_at?: string
          utility_notes?: string | null
          water_pressure_notes?: string | null
          wifi_info?: string | null
          wifi_notes?: string | null
          wifi_password?: string | null
          wifi_ssid?: string | null
        }
        Update: {
          access_notes?: string | null
          alarm_code?: string | null
          appliances_info?: string | null
          backup_network?: string | null
          bin_collection_day?: string | null
          bin_location?: string | null
          bins_recycling?: string | null
          boiler_location?: string | null
          boiler_make_model?: string | null
          boiler_reset_procedure?: string | null
          checkout_instructions?: string | null
          cleaning_duration_hours?: number | null
          cleaning_notes?: string | null
          cleaning_quirks?: string | null
          cleaning_supplies_location?: string | null
          completion_score?: number
          created_at?: string
          electric_meter_location?: string | null
          emergency_contacts?: string | null
          fusebox_location?: string | null
          gas_meter_location?: string | null
          gate_code?: string | null
          general_notes?: string | null
          guest_info?: string | null
          has_hot_tub?: boolean
          heating_notes?: string | null
          heating_system_type?: string | null
          hot_tub_chemical_schedule?: string | null
          hot_tub_error_codes?: Json | null
          hot_tub_filter_frequency?: string | null
          hot_tub_last_service?: string | null
          hot_tub_make_model?: string | null
          hot_tub_notes?: string | null
          hot_tub_supplier_contact?: string | null
          hot_tub_target_temp?: number | null
          hot_water_cylinder_location?: string | null
          id?: string
          immersion_heater_details?: string | null
          key_features?: string | null
          key_safe_code?: string | null
          key_safe_location?: string | null
          last_updated_by?: string | null
          linen_storage_location?: string | null
          listing_id?: string
          local_area?: string | null
          lock_type?: string | null
          oil_supplier_contact?: string | null
          oil_tank_location?: string | null
          parking_info?: string | null
          property_type?: string | null
          recycling_notes?: string | null
          router_location?: string | null
          router_reset_procedure?: string | null
          spare_key_location?: string | null
          stopcock_location?: string | null
          thermostat_location?: string | null
          updated_at?: string
          utility_notes?: string | null
          water_pressure_notes?: string | null
          wifi_info?: string | null
          wifi_notes?: string | null
          wifi_password?: string | null
          wifi_ssid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_knowledge_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      property_known_issues: {
        Row: {
          assigned_to: string | null
          created_at: string
          description: string | null
          id: string
          listing_id: string
          next_action: string | null
          next_action_date: string | null
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          listing_id: string
          next_action?: string | null
          next_action_date?: string | null
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          description?: string | null
          id?: string
          listing_id?: string
          next_action?: string | null
          next_action_date?: string | null
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_known_issues_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      property_maintenance_log: {
        Row: {
          action_taken: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          issue_description: string
          listing_id: string
          resolved_by: string | null
          status: string
        }
        Insert: {
          action_taken?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          issue_description: string
          listing_id: string
          resolved_by?: string | null
          status?: string
        }
        Update: {
          action_taken?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          issue_description?: string
          listing_id?: string
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_maintenance_log_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
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
          channel_commission: number | null
          check_in: string
          check_in_time: string | null
          check_out: string
          check_out_time: string | null
          cleaning_fee: number | null
          created_at: string
          day_of_week: number | null
          guest_fees: number | null
          guest_name: string
          host_payout: number | null
          hostaway_reservation_id: number | null
          id: string
          listing_id: string
          month: number | null
          owner_payout: number | null
          platform: string | null
          quarter: number | null
          reservation_date: string | null
          status: string
          tax_amount: number | null
          total_amount: number | null
          week_number: number | null
          year: number | null
        }
        Insert: {
          booking_lead_days?: number | null
          channel_commission?: number | null
          check_in: string
          check_in_time?: string | null
          check_out: string
          check_out_time?: string | null
          cleaning_fee?: number | null
          created_at?: string
          day_of_week?: number | null
          guest_fees?: number | null
          guest_name: string
          host_payout?: number | null
          hostaway_reservation_id?: number | null
          id?: string
          listing_id: string
          month?: number | null
          owner_payout?: number | null
          platform?: string | null
          quarter?: number | null
          reservation_date?: string | null
          status?: string
          tax_amount?: number | null
          total_amount?: number | null
          week_number?: number | null
          year?: number | null
        }
        Update: {
          booking_lead_days?: number | null
          channel_commission?: number | null
          check_in?: string
          check_in_time?: string | null
          check_out?: string
          check_out_time?: string | null
          cleaning_fee?: number | null
          created_at?: string
          day_of_week?: number | null
          guest_fees?: number | null
          guest_name?: string
          host_payout?: number | null
          hostaway_reservation_id?: number | null
          id?: string
          listing_id?: string
          month?: number | null
          owner_payout?: number | null
          platform?: string | null
          quarter?: number | null
          reservation_date?: string | null
          status?: string
          tax_amount?: number | null
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
      property_knowledge_cleaner: {
        Row: {
          access_notes: string | null
          bin_collection_day: string | null
          bin_location: string | null
          boiler_location: string | null
          cleaning_duration_hours: number | null
          cleaning_notes: string | null
          cleaning_quirks: string | null
          cleaning_supplies_location: string | null
          completion_score: number | null
          fusebox_location: string | null
          has_hot_tub: boolean | null
          hot_tub_chemical_schedule: string | null
          hot_tub_filter_frequency: string | null
          hot_tub_target_temp: number | null
          id: string | null
          key_features: string | null
          key_safe_location: string | null
          linen_storage_location: string | null
          listing_id: string | null
          lock_type: string | null
          property_type: string | null
          recycling_notes: string | null
          router_location: string | null
          spare_key_location: string | null
          stopcock_location: string | null
          updated_at: string | null
          wifi_ssid: string | null
        }
        Insert: {
          access_notes?: string | null
          bin_collection_day?: string | null
          bin_location?: string | null
          boiler_location?: string | null
          cleaning_duration_hours?: number | null
          cleaning_notes?: string | null
          cleaning_quirks?: string | null
          cleaning_supplies_location?: string | null
          completion_score?: number | null
          fusebox_location?: string | null
          has_hot_tub?: boolean | null
          hot_tub_chemical_schedule?: string | null
          hot_tub_filter_frequency?: string | null
          hot_tub_target_temp?: number | null
          id?: string | null
          key_features?: string | null
          key_safe_location?: string | null
          linen_storage_location?: string | null
          listing_id?: string | null
          lock_type?: string | null
          property_type?: string | null
          recycling_notes?: string | null
          router_location?: string | null
          spare_key_location?: string | null
          stopcock_location?: string | null
          updated_at?: string | null
          wifi_ssid?: string | null
        }
        Update: {
          access_notes?: string | null
          bin_collection_day?: string | null
          bin_location?: string | null
          boiler_location?: string | null
          cleaning_duration_hours?: number | null
          cleaning_notes?: string | null
          cleaning_quirks?: string | null
          cleaning_supplies_location?: string | null
          completion_score?: number | null
          fusebox_location?: string | null
          has_hot_tub?: boolean | null
          hot_tub_chemical_schedule?: string | null
          hot_tub_filter_frequency?: string | null
          hot_tub_target_temp?: number | null
          id?: string | null
          key_features?: string | null
          key_safe_location?: string | null
          linen_storage_location?: string | null
          listing_id?: string | null
          lock_type?: string | null
          property_type?: string | null
          recycling_notes?: string | null
          router_location?: string | null
          spare_key_location?: string | null
          stopcock_location?: string | null
          updated_at?: string | null
          wifi_ssid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_knowledge_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      property_knowledge_owner: {
        Row: {
          completion_score: number | null
          general_notes: string | null
          has_hot_tub: boolean | null
          hot_tub_make_model: string | null
          id: string | null
          key_features: string | null
          listing_id: string | null
          property_type: string | null
          router_location: string | null
          updated_at: string | null
          wifi_notes: string | null
          wifi_ssid: string | null
        }
        Insert: {
          completion_score?: number | null
          general_notes?: string | null
          has_hot_tub?: boolean | null
          hot_tub_make_model?: string | null
          id?: string | null
          key_features?: string | null
          listing_id?: string | null
          property_type?: string | null
          router_location?: string | null
          updated_at?: string | null
          wifi_notes?: string | null
          wifi_ssid?: string | null
        }
        Update: {
          completion_score?: number | null
          general_notes?: string | null
          has_hot_tub?: boolean | null
          hot_tub_make_model?: string | null
          id?: string | null
          key_features?: string | null
          listing_id?: string | null
          property_type?: string | null
          router_location?: string | null
          updated_at?: string | null
          wifi_notes?: string | null
          wifi_ssid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_knowledge_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      v_property_amenities: {
        Row: {
          address: string | null
          amenity_id: string | null
          category: Database["public"]["Enums"]["amenity_category"] | null
          created_at: string | null
          directions_url: string | null
          display_order: number | null
          distance_km: number | null
          drive_time_mins: number | null
          id: string | null
          is_active: boolean | null
          is_featured: boolean | null
          latitude: number | null
          listing_id: string | null
          longitude: number | null
          name: string | null
          opening_hours: string | null
          phone: string | null
          postcode: string | null
          price_range: string | null
          rating: number | null
          staff_note: string | null
          tags: string[] | null
          updated_at: string | null
          walk_time_mins: number | null
          website: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_amenities_amenity_id_fkey"
            columns: ["amenity_id"]
            isOneToOne: false
            referencedRelation: "amenities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_amenities_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      cleaner_assigned_to_listing: {
        Args: { _listing_id: string; _user_id: string }
        Returns: boolean
      }
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
      owner_owns_listing: {
        Args: { _listing_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      amenity_category:
        | "grocery"
        | "supermarket"
        | "petrol_station"
        | "ev_charging"
        | "restaurant"
        | "bar_pub"
        | "fast_food"
        | "cafe"
        | "golf_course"
        | "walkway_trail"
        | "park"
        | "castle_historic"
        | "beach"
        | "activity_centre"
        | "pharmacy"
        | "hospital_medical"
        | "atm_bank"
        | "tourist_attraction"
        | "accommodation"
        | "other"
      app_role: "super" | "senior" | "admin" | "client" | "cleaner"
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
      amenity_category: [
        "grocery",
        "supermarket",
        "petrol_station",
        "ev_charging",
        "restaurant",
        "bar_pub",
        "fast_food",
        "cafe",
        "golf_course",
        "walkway_trail",
        "park",
        "castle_historic",
        "beach",
        "activity_centre",
        "pharmacy",
        "hospital_medical",
        "atm_bank",
        "tourist_attraction",
        "accommodation",
        "other",
      ],
      app_role: ["super", "senior", "admin", "client", "cleaner"],
    },
  },
} as const
