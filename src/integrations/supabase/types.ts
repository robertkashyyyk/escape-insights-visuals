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
      bank_statement_imports: {
        Row: {
          bank: string
          created_at: string
          file_name: string | null
          id: string
          period_end: string | null
          period_start: string | null
          row_count: number
          status: string
          uploaded_by: string | null
        }
        Insert: {
          bank?: string
          created_at?: string
          file_name?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          row_count?: number
          status?: string
          uploaded_by?: string | null
        }
        Update: {
          bank?: string
          created_at?: string
          file_name?: string | null
          id?: string
          period_end?: string | null
          period_start?: string | null
          row_count?: number
          status?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      bank_statement_txns: {
        Row: {
          amount: number
          bill_id: string | null
          classification: string
          created_at: string
          description: string | null
          details_type: string | null
          direction: string | null
          external_id: string | null
          id: string
          import_id: string | null
          matched_owner_id: string | null
          payee_name: string | null
          payer_name: string | null
          reference: string | null
          status: string
          txn_date: string | null
        }
        Insert: {
          amount: number
          bill_id?: string | null
          classification?: string
          created_at?: string
          description?: string | null
          details_type?: string | null
          direction?: string | null
          external_id?: string | null
          id?: string
          import_id?: string | null
          matched_owner_id?: string | null
          payee_name?: string | null
          payer_name?: string | null
          reference?: string | null
          status?: string
          txn_date?: string | null
        }
        Update: {
          amount?: number
          bill_id?: string | null
          classification?: string
          created_at?: string
          description?: string | null
          details_type?: string | null
          direction?: string | null
          external_id?: string | null
          id?: string
          import_id?: string | null
          matched_owner_id?: string | null
          payee_name?: string | null
          payer_name?: string | null
          reference?: string | null
          status?: string
          txn_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bank_statement_txns_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills_on_behalf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_txns_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bank_statement_txns_matched_owner_id_fkey"
            columns: ["matched_owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_types: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          id: string
          laundry_cost: number
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          id?: string
          laundry_cost?: number
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          id?: string
          laundry_cost?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      bill_allocations: {
        Row: {
          amount: number
          bill_id: string
          created_at: string
          id: string
          listing_id: string
          ratio_pct: number | null
        }
        Insert: {
          amount: number
          bill_id: string
          created_at?: string
          id?: string
          listing_id: string
          ratio_pct?: number | null
        }
        Update: {
          amount?: number
          bill_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          ratio_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_allocations_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills_on_behalf"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_allocations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_payee_rules: {
        Row: {
          action: string
          cost_line_type_id: string | null
          created_at: string
          created_by: string | null
          default_description: string | null
          hit_count: number
          id: string
          payee_key: string
          sample_payee: string | null
          target_communal_group_id: string | null
          target_listing_id: string | null
          target_region: string | null
          target_type: string | null
          updated_at: string
        }
        Insert: {
          action: string
          cost_line_type_id?: string | null
          created_at?: string
          created_by?: string | null
          default_description?: string | null
          hit_count?: number
          id?: string
          payee_key: string
          sample_payee?: string | null
          target_communal_group_id?: string | null
          target_listing_id?: string | null
          target_region?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          cost_line_type_id?: string | null
          created_at?: string
          created_by?: string | null
          default_description?: string | null
          hit_count?: number
          id?: string
          payee_key?: string
          sample_payee?: string | null
          target_communal_group_id?: string | null
          target_listing_id?: string | null
          target_region?: string | null
          target_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_payee_rules_cost_line_type_id_fkey"
            columns: ["cost_line_type_id"]
            isOneToOne: false
            referencedRelation: "cost_line_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payee_rules_target_communal_group_id_fkey"
            columns: ["target_communal_group_id"]
            isOneToOne: false
            referencedRelation: "communal_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_payee_rules_target_listing_id_fkey"
            columns: ["target_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      bills_on_behalf: {
        Row: {
          amount: number
          bill_date: string
          cost_line_type_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          import_id: string | null
          payee_name: string | null
          receipt_url: string | null
          target_communal_group_id: string | null
          target_region: string | null
          target_type: string
          txn_id: string | null
        }
        Insert: {
          amount: number
          bill_date: string
          cost_line_type_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          import_id?: string | null
          payee_name?: string | null
          receipt_url?: string | null
          target_communal_group_id?: string | null
          target_region?: string | null
          target_type: string
          txn_id?: string | null
        }
        Update: {
          amount?: number
          bill_date?: string
          cost_line_type_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          import_id?: string | null
          payee_name?: string | null
          receipt_url?: string | null
          target_communal_group_id?: string | null
          target_region?: string | null
          target_type?: string
          txn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bills_on_behalf_cost_line_type_id_fkey"
            columns: ["cost_line_type_id"]
            isOneToOne: false
            referencedRelation: "cost_line_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_on_behalf_import_id_fkey"
            columns: ["import_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_on_behalf_target_communal_group_id_fkey"
            columns: ["target_communal_group_id"]
            isOneToOne: false
            referencedRelation: "communal_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bills_on_behalf_txn_id_fkey"
            columns: ["txn_id"]
            isOneToOne: false
            referencedRelation: "bank_statement_txns"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_requests: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          quantity: number
          request_id: string
          reservation_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          quantity?: number
          request_id: string
          reservation_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          quantity?: number
          request_id?: string
          reservation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_requests_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_requests_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
      }
      clean_checklist_items: {
        Row: {
          category: string
          check_all: boolean
          checked: boolean
          checked_at: string | null
          checked_by: string | null
          checked_by_member: string | null
          clean_task_id: string
          created_at: string
          flagged: boolean
          id: string
          label: string
          photo_url: string | null
          ref_id: string | null
          requires_photo: boolean
          room_index: number | null
          room_type: string | null
          updated_at: string
        }
        Insert: {
          category: string
          check_all?: boolean
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          checked_by_member?: string | null
          clean_task_id: string
          created_at?: string
          flagged?: boolean
          id?: string
          label: string
          photo_url?: string | null
          ref_id?: string | null
          requires_photo?: boolean
          room_index?: number | null
          room_type?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          check_all?: boolean
          checked?: boolean
          checked_at?: string | null
          checked_by?: string | null
          checked_by_member?: string | null
          clean_task_id?: string
          created_at?: string
          flagged?: boolean
          id?: string
          label?: string
          photo_url?: string | null
          ref_id?: string | null
          requires_photo?: boolean
          room_index?: number | null
          room_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clean_checklist_items_clean_task_id_fkey"
            columns: ["clean_task_id"]
            isOneToOne: false
            referencedRelation: "clean_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      clean_issues: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          claimed_at: string | null
          claimed_by: string | null
          clean_task_id: string | null
          completed_at: string | null
          completed_by: string | null
          completion_note: string | null
          created_at: string
          description: string
          handoff_at: string | null
          handoff_note: string | null
          handoff_to: string | null
          id: string
          issue_type: string
          listing_id: string
          maintenance_stage: string
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
          claimed_at?: string | null
          claimed_by?: string | null
          clean_task_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          created_at?: string
          description: string
          handoff_at?: string | null
          handoff_note?: string | null
          handoff_to?: string | null
          id?: string
          issue_type: string
          listing_id: string
          maintenance_stage?: string
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
          claimed_at?: string | null
          claimed_by?: string | null
          clean_task_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          completion_note?: string | null
          created_at?: string
          description?: string
          handoff_at?: string | null
          handoff_note?: string | null
          handoff_to?: string | null
          id?: string
          issue_type?: string
          listing_id?: string
          maintenance_stage?: string
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
      clean_state_resets: {
        Row: {
          id: string
          listing_id: string
          new_state: string
          note: string | null
          previous_state: string | null
          reason: string | null
          reset_at: string
          reset_by: string | null
        }
        Insert: {
          id?: string
          listing_id: string
          new_state: string
          note?: string | null
          previous_state?: string | null
          reason?: string | null
          reset_at?: string
          reset_by?: string | null
        }
        Update: {
          id?: string
          listing_id?: string
          new_state?: string
          note?: string | null
          previous_state?: string | null
          reason?: string | null
          reset_at?: string
          reset_by?: string | null
        }
        Relationships: []
      }
      clean_tasks: {
        Row: {
          assigned_cleaner_id: string | null
          checkin_time: string | null
          checkout_time: string | null
          cleaning_duration_minutes: number
          completed_at: string | null
          completed_by_member: string | null
          created_at: string
          estimated_start_time: string | null
          id: string
          is_same_day_turnaround: boolean | null
          listing_id: string
          not_required: boolean
          notes: string | null
          overloaded: boolean
          override_assignment: boolean
          priority: string
          priority_level: number
          reservation_id: string | null
          route_order: number | null
          scheduled_date: string
          source: string
          started_at: string | null
          started_by_member: string | null
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
          completed_by_member?: string | null
          created_at?: string
          estimated_start_time?: string | null
          id?: string
          is_same_day_turnaround?: boolean | null
          listing_id: string
          not_required?: boolean
          notes?: string | null
          overloaded?: boolean
          override_assignment?: boolean
          priority?: string
          priority_level?: number
          reservation_id?: string | null
          route_order?: number | null
          scheduled_date: string
          source?: string
          started_at?: string | null
          started_by_member?: string | null
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
          completed_by_member?: string | null
          created_at?: string
          estimated_start_time?: string | null
          id?: string
          is_same_day_turnaround?: boolean | null
          listing_id?: string
          not_required?: boolean
          notes?: string | null
          overloaded?: boolean
          override_assignment?: boolean
          priority?: string
          priority_level?: number
          reservation_id?: string | null
          route_order?: number | null
          scheduled_date?: string
          source?: string
          started_at?: string | null
          started_by_member?: string | null
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
      cleaner_members: {
        Row: {
          active: boolean
          cleaner_id: string
          created_at: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          cleaner_id: string
          created_at?: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          cleaner_id?: string
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_members_cleaner_id_fkey"
            columns: ["cleaner_id"]
            isOneToOne: false
            referencedRelation: "cleaners"
            referencedColumns: ["id"]
          },
        ]
      }
      cleaner_working_exceptions: {
        Row: {
          cleaner_id: string
          created_at: string
          id: string
          work_date: string
        }
        Insert: {
          cleaner_id: string
          created_at?: string
          id?: string
          work_date: string
        }
        Update: {
          cleaner_id?: string
          created_at?: string
          id?: string
          work_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "cleaner_working_exceptions_cleaner_id_fkey"
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
          is_team: boolean
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
          is_team?: boolean
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
          is_team?: boolean
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
      communal_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      consumable_charges: {
        Row: {
          amount: number
          charge_date: string
          clean_task_id: string
          created_at: string
          id: string
          listing_id: string
          rate_id: string | null
          type: string | null
        }
        Insert: {
          amount: number
          charge_date: string
          clean_task_id: string
          created_at?: string
          id?: string
          listing_id: string
          rate_id?: string | null
          type?: string | null
        }
        Update: {
          amount?: number
          charge_date?: string
          clean_task_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          rate_id?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consumable_charges_clean_task_id_fkey"
            columns: ["clean_task_id"]
            isOneToOne: false
            referencedRelation: "clean_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumable_charges_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumable_charges_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "consumable_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      consumable_rates: {
        Row: {
          active: boolean
          amount: number
          communal_group_id: string | null
          created_at: string
          id: string
          listing_id: string | null
          name: string
          region: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          communal_group_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          name: string
          region?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          communal_group_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          name?: string
          region?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumable_rates_communal_group_id_fkey"
            columns: ["communal_group_id"]
            isOneToOne: false
            referencedRelation: "communal_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consumable_rates_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      consumables: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          id: string
          listing_id: string | null
          name: string
          room_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          id?: string
          listing_id?: string | null
          name: string
          room_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          id?: string
          listing_id?: string | null
          name?: string
          room_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consumables_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_line_types: {
        Row: {
          code: string
          default_target_pct: number | null
          display_name: string
          id: string
          is_settlement_cost: boolean
          sort_order: number
          source_category: Database["public"]["Enums"]["report_source_category"]
        }
        Insert: {
          code: string
          default_target_pct?: number | null
          display_name: string
          id?: string
          is_settlement_cost?: boolean
          sort_order?: number
          source_category: Database["public"]["Enums"]["report_source_category"]
        }
        Update: {
          code?: string
          default_target_pct?: number | null
          display_name?: string
          id?: string
          is_settlement_cost?: boolean
          sort_order?: number
          source_category?: Database["public"]["Enums"]["report_source_category"]
        }
        Relationships: []
      }
      expense_consumables: {
        Row: {
          allocation_type: string
          created_at: string
          id: string
          listing_id: string | null
          notes: string | null
          payer: string
          purchase_date: string
          purchased_by_name: string | null
          purchased_by_user_id: string | null
          receipt_path: string | null
          receipt_value: number
          region: string | null
          reimbursed: boolean
          reimbursed_at: string | null
          supplier: string
        }
        Insert: {
          allocation_type: string
          created_at?: string
          id?: string
          listing_id?: string | null
          notes?: string | null
          payer: string
          purchase_date: string
          purchased_by_name?: string | null
          purchased_by_user_id?: string | null
          receipt_path?: string | null
          receipt_value: number
          region?: string | null
          reimbursed?: boolean
          reimbursed_at?: string | null
          supplier: string
        }
        Update: {
          allocation_type?: string
          created_at?: string
          id?: string
          listing_id?: string | null
          notes?: string | null
          payer?: string
          purchase_date?: string
          purchased_by_name?: string | null
          purchased_by_user_id?: string | null
          receipt_path?: string | null
          receipt_value?: number
          region?: string | null
          reimbursed?: boolean
          reimbursed_at?: string | null
          supplier?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_consumables_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_laundry_allocations: {
        Row: {
          allocated_amount: number
          allocation_pct: number
          bedrooms: number
          bill_id: string
          bookings_in_period: number
          created_at: string
          id: string
          listing_id: string
          listing_name: string
          rooms_let: number
        }
        Insert: {
          allocated_amount?: number
          allocation_pct?: number
          bedrooms?: number
          bill_id: string
          bookings_in_period?: number
          created_at?: string
          id?: string
          listing_id: string
          listing_name: string
          rooms_let?: number
        }
        Update: {
          allocated_amount?: number
          allocation_pct?: number
          bedrooms?: number
          bill_id?: string
          bookings_in_period?: number
          created_at?: string
          id?: string
          listing_id?: string
          listing_name?: string
          rooms_let?: number
        }
        Relationships: [
          {
            foreignKeyName: "expense_laundry_allocations_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "expense_laundry_bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_laundry_allocations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_laundry_bills: {
        Row: {
          bill_date: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          period_end: string
          period_start: string
          receipt_path: string | null
          supplier: string
          total_amount: number
        }
        Insert: {
          bill_date: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_end: string
          period_start: string
          receipt_path?: string | null
          supplier?: string
          total_amount: number
        }
        Update: {
          bill_date?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          period_end?: string
          period_start?: string
          receipt_path?: string | null
          supplier?: string
          total_amount?: number
        }
        Relationships: []
      }
      laundry_charges: {
        Row: {
          amount: number
          charge_date: string
          clean_task_id: string
          created_at: string
          id: string
          listing_id: string
          rate_id: string | null
          region: string | null
        }
        Insert: {
          amount: number
          charge_date: string
          clean_task_id: string
          created_at?: string
          id?: string
          listing_id: string
          rate_id?: string | null
          region?: string | null
        }
        Update: {
          amount?: number
          charge_date?: string
          clean_task_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          rate_id?: string | null
          region?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "laundry_charges_clean_task_id_fkey"
            columns: ["clean_task_id"]
            isOneToOne: true
            referencedRelation: "clean_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_charges_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "laundry_charges_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "laundry_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_rate_regions: {
        Row: {
          id: string
          rate_id: string
          region: string
        }
        Insert: {
          id?: string
          rate_id: string
          region: string
        }
        Update: {
          id?: string
          rate_id?: string
          region?: string
        }
        Relationships: [
          {
            foreignKeyName: "laundry_rate_regions_rate_id_fkey"
            columns: ["rate_id"]
            isOneToOne: false
            referencedRelation: "laundry_rates"
            referencedColumns: ["id"]
          },
        ]
      }
      laundry_rates: {
        Row: {
          active: boolean
          amount: number
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      line_adjustments: {
        Row: {
          adjusted_by: string | null
          amount: number
          cost_line_type_id: string | null
          created_at: string
          id: string
          listing_id: string | null
          reason: string
          report_period_id: string
          target: Database["public"]["Enums"]["adjustment_target"]
        }
        Insert: {
          adjusted_by?: string | null
          amount: number
          cost_line_type_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          reason: string
          report_period_id: string
          target: Database["public"]["Enums"]["adjustment_target"]
        }
        Update: {
          adjusted_by?: string | null
          amount?: number
          cost_line_type_id?: string | null
          created_at?: string
          id?: string
          listing_id?: string | null
          reason?: string
          report_period_id?: string
          target?: Database["public"]["Enums"]["adjustment_target"]
        }
        Relationships: [
          {
            foreignKeyName: "line_adjustments_cost_line_type_id_fkey"
            columns: ["cost_line_type_id"]
            isOneToOne: false
            referencedRelation: "cost_line_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_adjustments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "line_adjustments_report_period_id_fkey"
            columns: ["report_period_id"]
            isOneToOne: false
            referencedRelation: "report_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_aliases: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          listing_id: string
          platform: Database["public"]["Enums"]["ota_platform"]
          raw_name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          listing_id: string
          platform: Database["public"]["Enums"]["ota_platform"]
          raw_name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          listing_id?: string
          platform?: Database["public"]["Enums"]["ota_platform"]
          raw_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_aliases_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          access_details: string | null
          address: string | null
          amenities: Json
          archived_at: string | null
          base_rate: number | null
          bathrooms: number | null
          bedrooms: number | null
          bundle_components: Json | null
          city: string | null
          cleaning_duration_minutes: number | null
          cleaning_fee: number | null
          communal_group_id: string | null
          communal_ratio_pct: number | null
          country: string | null
          created_at: string
          deep_fee: number | null
          default_check_in_time: string | null
          default_check_out_time: string | null
          google_place_id: string | null
          has_ev_charger: boolean
          has_hot_tub: boolean
          hostaway_listing_id: number | null
          id: string
          image_url: string | null
          internal_name: string | null
          is_archived: boolean
          is_bundle: boolean
          is_clean: boolean
          is_communal: boolean
          is_suspended: boolean
          kitchens: number
          latitude: number | null
          location_group: string | null
          longitude: number | null
          management_flat_fee: number | null
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
          archived_at?: string | null
          base_rate?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          bundle_components?: Json | null
          city?: string | null
          cleaning_duration_minutes?: number | null
          cleaning_fee?: number | null
          communal_group_id?: string | null
          communal_ratio_pct?: number | null
          country?: string | null
          created_at?: string
          deep_fee?: number | null
          default_check_in_time?: string | null
          default_check_out_time?: string | null
          google_place_id?: string | null
          has_ev_charger?: boolean
          has_hot_tub?: boolean
          hostaway_listing_id?: number | null
          id?: string
          image_url?: string | null
          internal_name?: string | null
          is_archived?: boolean
          is_bundle?: boolean
          is_clean?: boolean
          is_communal?: boolean
          is_suspended?: boolean
          kitchens?: number
          latitude?: number | null
          location_group?: string | null
          longitude?: number | null
          management_flat_fee?: number | null
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
          archived_at?: string | null
          base_rate?: number | null
          bathrooms?: number | null
          bedrooms?: number | null
          bundle_components?: Json | null
          city?: string | null
          cleaning_duration_minutes?: number | null
          cleaning_fee?: number | null
          communal_group_id?: string | null
          communal_ratio_pct?: number | null
          country?: string | null
          created_at?: string
          deep_fee?: number | null
          default_check_in_time?: string | null
          default_check_out_time?: string | null
          google_place_id?: string | null
          has_ev_charger?: boolean
          has_hot_tub?: boolean
          hostaway_listing_id?: number | null
          id?: string
          image_url?: string | null
          internal_name?: string | null
          is_archived?: boolean
          is_bundle?: boolean
          is_clean?: boolean
          is_communal?: boolean
          is_suspended?: boolean
          kitchens?: number
          latitude?: number | null
          location_group?: string | null
          longitude?: number | null
          management_flat_fee?: number | null
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
            foreignKeyName: "listings_communal_group_id_fkey"
            columns: ["communal_group_id"]
            isOneToOne: false
            referencedRelation: "communal_groups"
            referencedColumns: ["id"]
          },
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
      maintenance_tasks: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          billable: boolean | null
          communal_group_id: string | null
          completed_at: string | null
          completed_by: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          listing_id: string | null
          postpone_reason: string | null
          postponed_until: string | null
          reservation_id: string | null
          scope: string
          source: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          billable?: boolean | null
          communal_group_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          listing_id?: string | null
          postpone_reason?: string | null
          postponed_until?: string | null
          reservation_id?: string | null
          scope?: string
          source?: string
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          billable?: boolean | null
          communal_group_id?: string | null
          completed_at?: string | null
          completed_by?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          listing_id?: string | null
          postpone_reason?: string | null
          postponed_until?: string | null
          reservation_id?: string | null
          scope?: string
          source?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_tasks_communal_group_id_fkey"
            columns: ["communal_group_id"]
            isOneToOne: false
            referencedRelation: "communal_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maintenance_tasks_reservation_id_fkey"
            columns: ["reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
        ]
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
      ota_attribution_decisions: {
        Row: {
          allocated_listing_id: string | null
          decided_at: string
          decided_by: string | null
          id: string
          ota_transaction_id: string
          outcome: Database["public"]["Enums"]["ota_attribution_outcome"]
          reason: string | null
        }
        Insert: {
          allocated_listing_id?: string | null
          decided_at?: string
          decided_by?: string | null
          id?: string
          ota_transaction_id: string
          outcome: Database["public"]["Enums"]["ota_attribution_outcome"]
          reason?: string | null
        }
        Update: {
          allocated_listing_id?: string | null
          decided_at?: string
          decided_by?: string | null
          id?: string
          ota_transaction_id?: string
          outcome?: Database["public"]["Enums"]["ota_attribution_outcome"]
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ota_attribution_decisions_allocated_listing_id_fkey"
            columns: ["allocated_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ota_attribution_decisions_ota_transaction_id_fkey"
            columns: ["ota_transaction_id"]
            isOneToOne: false
            referencedRelation: "ota_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ota_import_batches: {
        Row: {
          id: string
          inferred_period_end: string | null
          inferred_period_start: string | null
          platform: Database["public"]["Enums"]["ota_platform"]
          row_count: number
          source_filename: string
          status: Database["public"]["Enums"]["ota_batch_status"]
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          id?: string
          inferred_period_end?: string | null
          inferred_period_start?: string | null
          platform: Database["public"]["Enums"]["ota_platform"]
          row_count?: number
          source_filename: string
          status?: Database["public"]["Enums"]["ota_batch_status"]
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          id?: string
          inferred_period_end?: string | null
          inferred_period_start?: string | null
          platform?: Database["public"]["Enums"]["ota_platform"]
          row_count?: number
          source_filename?: string
          status?: Database["public"]["Enums"]["ota_batch_status"]
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      ota_transactions: {
        Row: {
          batch_id: string
          bookingcom_property_id: string | null
          check_in: string | null
          check_out: string | null
          collection_model:
            | Database["public"]["Enums"]["ota_collection_model"]
            | null
          commission_amount: number | null
          commission_pct: number | null
          confirmation_code: string | null
          created_at: string
          currency: string
          external_txn_id: string | null
          gross_amount: number | null
          guest_name: string | null
          id: string
          is_revenue: boolean
          match_confidence: number | null
          match_method: Database["public"]["Enums"]["ota_match_method"]
          matched_reservation_id: string | null
          net_amount: number | null
          nights: number | null
          payment_fee_amount: number | null
          platform: Database["public"]["Enums"]["ota_platform"]
          property_name_raw: string | null
          raw_row: Json | null
          recon_status: Database["public"]["Enums"]["ota_recon_status"]
          reference_number: string | null
          resolved_listing_id: string | null
          statement_descriptor: string | null
          tax: number | null
          txn_type: Database["public"]["Enums"]["ota_txn_type"]
          vat: number | null
        }
        Insert: {
          batch_id: string
          bookingcom_property_id?: string | null
          check_in?: string | null
          check_out?: string | null
          collection_model?:
            | Database["public"]["Enums"]["ota_collection_model"]
            | null
          commission_amount?: number | null
          commission_pct?: number | null
          confirmation_code?: string | null
          created_at?: string
          currency?: string
          external_txn_id?: string | null
          gross_amount?: number | null
          guest_name?: string | null
          id?: string
          is_revenue?: boolean
          match_confidence?: number | null
          match_method?: Database["public"]["Enums"]["ota_match_method"]
          matched_reservation_id?: string | null
          net_amount?: number | null
          nights?: number | null
          payment_fee_amount?: number | null
          platform: Database["public"]["Enums"]["ota_platform"]
          property_name_raw?: string | null
          raw_row?: Json | null
          recon_status?: Database["public"]["Enums"]["ota_recon_status"]
          reference_number?: string | null
          resolved_listing_id?: string | null
          statement_descriptor?: string | null
          tax?: number | null
          txn_type: Database["public"]["Enums"]["ota_txn_type"]
          vat?: number | null
        }
        Update: {
          batch_id?: string
          bookingcom_property_id?: string | null
          check_in?: string | null
          check_out?: string | null
          collection_model?:
            | Database["public"]["Enums"]["ota_collection_model"]
            | null
          commission_amount?: number | null
          commission_pct?: number | null
          confirmation_code?: string | null
          created_at?: string
          currency?: string
          external_txn_id?: string | null
          gross_amount?: number | null
          guest_name?: string | null
          id?: string
          is_revenue?: boolean
          match_confidence?: number | null
          match_method?: Database["public"]["Enums"]["ota_match_method"]
          matched_reservation_id?: string | null
          net_amount?: number | null
          nights?: number | null
          payment_fee_amount?: number | null
          platform?: Database["public"]["Enums"]["ota_platform"]
          property_name_raw?: string | null
          raw_row?: Json | null
          recon_status?: Database["public"]["Enums"]["ota_recon_status"]
          reference_number?: string | null
          resolved_listing_id?: string | null
          statement_descriptor?: string | null
          tax?: number | null
          txn_type?: Database["public"]["Enums"]["ota_txn_type"]
          vat?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ota_transactions_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "ota_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ota_transactions_matched_reservation_id_fkey"
            columns: ["matched_reservation_id"]
            isOneToOne: false
            referencedRelation: "reservations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ota_transactions_resolved_listing_id_fkey"
            columns: ["resolved_listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_notification_prefs: {
        Row: {
          created_at: string
          last_monthly_sent: string | null
          last_weekly_sent: string | null
          notify_bookings: boolean
          notify_orin: boolean
          orin_frequency: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          last_monthly_sent?: string | null
          last_weekly_sent?: string | null
          notify_bookings?: boolean
          notify_orin?: boolean
          orin_frequency?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          last_monthly_sent?: string | null
          last_weekly_sent?: string | null
          notify_bookings?: boolean
          notify_orin?: boolean
          orin_frequency?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "owner_notification_prefs_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
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
      property_beds: {
        Row: {
          bed_type_id: string
          bedroom_label: string
          created_at: string
          id: string
          listing_id: string
          quantity: number
          sort_order: number
        }
        Insert: {
          bed_type_id: string
          bedroom_label: string
          created_at?: string
          id?: string
          listing_id: string
          quantity?: number
          sort_order?: number
        }
        Update: {
          bed_type_id?: string
          bedroom_label?: string
          created_at?: string
          id?: string
          listing_id?: string
          quantity?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_beds_bed_type_id_fkey"
            columns: ["bed_type_id"]
            isOneToOne: false
            referencedRelation: "bed_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_beds_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      property_booking_sources: {
        Row: {
          amount: number
          channel: Database["public"]["Enums"]["report_booking_channel"]
          id: string
          listing_id: string
          report_period_id: string
        }
        Insert: {
          amount?: number
          channel: Database["public"]["Enums"]["report_booking_channel"]
          id?: string
          listing_id: string
          report_period_id: string
        }
        Update: {
          amount?: number
          channel?: Database["public"]["Enums"]["report_booking_channel"]
          id?: string
          listing_id?: string
          report_period_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_booking_sources_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_booking_sources_report_period_id_fkey"
            columns: ["report_period_id"]
            isOneToOne: false
            referencedRelation: "report_periods"
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
      property_cost_benchmarks: {
        Row: {
          cost_line_type_id: string
          created_at: string
          effective_from: string
          id: string
          listing_id: string
          target_pct: number
        }
        Insert: {
          cost_line_type_id: string
          created_at?: string
          effective_from: string
          id?: string
          listing_id: string
          target_pct: number
        }
        Update: {
          cost_line_type_id?: string
          created_at?: string
          effective_from?: string
          id?: string
          listing_id?: string
          target_pct?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_cost_benchmarks_cost_line_type_id_fkey"
            columns: ["cost_line_type_id"]
            isOneToOne: false
            referencedRelation: "cost_line_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_cost_benchmarks_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      property_costs: {
        Row: {
          actual_amount: number
          cost_line_type_id: string
          created_at: string
          id: string
          listing_id: string
          report_period_id: string
          source: Database["public"]["Enums"]["report_source_category"]
          source_ref: string | null
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          cost_line_type_id: string
          created_at?: string
          id?: string
          listing_id: string
          report_period_id: string
          source?: Database["public"]["Enums"]["report_source_category"]
          source_ref?: string | null
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          cost_line_type_id?: string
          created_at?: string
          id?: string
          listing_id?: string
          report_period_id?: string
          source?: Database["public"]["Enums"]["report_source_category"]
          source_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_costs_cost_line_type_id_fkey"
            columns: ["cost_line_type_id"]
            isOneToOne: false
            referencedRelation: "cost_line_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_costs_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_costs_report_period_id_fkey"
            columns: ["report_period_id"]
            isOneToOne: false
            referencedRelation: "report_periods"
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
      property_equipment: {
        Row: {
          active: boolean
          created_at: string
          id: string
          listing_id: string
          name: string
          requires_photo: boolean
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          listing_id: string
          name: string
          requires_photo?: boolean
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          listing_id?: string
          name?: string
          requires_photo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "property_equipment_listing_id_fkey"
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
          flat_portfolio_fee: number | null
          id: string
          management_fee_method: Database["public"]["Enums"]["management_fee_method"]
          management_rate_pct: number | null
          name: string
          notes: string | null
          opening_balance: number
          phone: string | null
          revenue_recognition: Database["public"]["Enums"]["revenue_recognition"]
          settlement_method: Database["public"]["Enums"]["settlement_method"]
          updated_at: string
          user_id: string | null
          vat_inclusive: boolean
          weekly_rr_amount: number | null
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          flat_portfolio_fee?: number | null
          id?: string
          management_fee_method?: Database["public"]["Enums"]["management_fee_method"]
          management_rate_pct?: number | null
          name: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          revenue_recognition?: Database["public"]["Enums"]["revenue_recognition"]
          settlement_method?: Database["public"]["Enums"]["settlement_method"]
          updated_at?: string
          user_id?: string | null
          vat_inclusive?: boolean
          weekly_rr_amount?: number | null
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          flat_portfolio_fee?: number | null
          id?: string
          management_fee_method?: Database["public"]["Enums"]["management_fee_method"]
          management_rate_pct?: number | null
          name?: string
          notes?: string | null
          opening_balance?: number
          phone?: string | null
          revenue_recognition?: Database["public"]["Enums"]["revenue_recognition"]
          settlement_method?: Database["public"]["Enums"]["settlement_method"]
          updated_at?: string
          user_id?: string | null
          vat_inclusive?: boolean
          weekly_rr_amount?: number | null
        }
        Relationships: []
      }
      property_targets: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          listing_id: string
          target_adr: number | null
          target_airbnb_max_pct: number | null
          target_bookingcom_max_pct: number | null
          target_direct_min_pct: number | null
          target_length_of_stay: number | null
          target_occupancy_pct: number | null
          target_revenue: number | null
        }
        Insert: {
          created_at?: string
          effective_from: string
          id?: string
          listing_id: string
          target_adr?: number | null
          target_airbnb_max_pct?: number | null
          target_bookingcom_max_pct?: number | null
          target_direct_min_pct?: number | null
          target_length_of_stay?: number | null
          target_occupancy_pct?: number | null
          target_revenue?: number | null
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          listing_id?: string
          target_adr?: number | null
          target_airbnb_max_pct?: number | null
          target_bookingcom_max_pct?: number | null
          target_direct_min_pct?: number | null
          target_length_of_stay?: number | null
          target_occupancy_pct?: number | null
          target_revenue?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_targets_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      report_periods: {
        Row: {
          cost_total: number | null
          created_at: string
          finalised_at: string | null
          generated_at: string | null
          id: string
          net_settlement_balance: number | null
          net_total: number | null
          opening_balance: number
          owner_id: string
          period_end: string
          period_start: string
          revenue_total: number | null
          settlement_due: number | null
          status: Database["public"]["Enums"]["report_status"]
          weekly_rr_total: number
        }
        Insert: {
          cost_total?: number | null
          created_at?: string
          finalised_at?: string | null
          generated_at?: string | null
          id?: string
          net_settlement_balance?: number | null
          net_total?: number | null
          opening_balance?: number
          owner_id: string
          period_end: string
          period_start: string
          revenue_total?: number | null
          settlement_due?: number | null
          status?: Database["public"]["Enums"]["report_status"]
          weekly_rr_total?: number
        }
        Update: {
          cost_total?: number | null
          created_at?: string
          finalised_at?: string | null
          generated_at?: string | null
          id?: string
          net_settlement_balance?: number | null
          net_total?: number | null
          opening_balance?: number
          owner_id?: string
          period_end?: string
          period_start?: string
          revenue_total?: number | null
          settlement_due?: number | null
          status?: Database["public"]["Enums"]["report_status"]
          weekly_rr_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "report_periods_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "property_owners"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          active: boolean
          created_at: string
          display_order: number
          icon: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_order?: number
          icon?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          booking_lead_days: number | null
          channel_commission: number | null
          channel_reservation_code: string | null
          check_in: string
          check_in_time: string | null
          check_out: string
          check_out_time: string | null
          cleaning_fee: number | null
          created_at: string
          custom_fields: Json
          day_of_week: number | null
          guest_fees: number | null
          guest_name: string
          guest_note: string | null
          host_note: string | null
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
          channel_reservation_code?: string | null
          check_in: string
          check_in_time?: string | null
          check_out: string
          check_out_time?: string | null
          cleaning_fee?: number | null
          created_at?: string
          custom_fields?: Json
          day_of_week?: number | null
          guest_fees?: number | null
          guest_name: string
          guest_note?: string | null
          host_note?: string | null
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
          channel_reservation_code?: string | null
          check_in?: string
          check_in_time?: string | null
          check_out?: string
          check_out_time?: string | null
          cleaning_fee?: number | null
          created_at?: string
          custom_fields?: Json
          day_of_week?: number | null
          guest_fees?: number | null
          guest_name?: string
          guest_note?: string | null
          host_note?: string | null
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
      seasons: {
        Row: {
          created_at: string
          display_order: number
          end_day: number
          end_month: number
          id: string
          name: string
          spend_threshold: number
          start_day: number
          start_month: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          end_day: number
          end_month: number
          id?: string
          name: string
          spend_threshold?: number
          start_day: number
          start_month: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          end_day?: number
          end_month?: number
          id?: string
          name?: string
          spend_threshold?: number
          start_day?: number
          start_month?: number
          updated_at?: string
        }
        Relationships: []
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
      user_area_permissions: {
        Row: {
          area_key: string
          level: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_key: string
          level: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area_key?: string
          level?: string
          updated_at?: string
          user_id?: string
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
      utility_expense_allocations: {
        Row: {
          amount: number
          attribution_pct: number
          created_at: string
          expense_date: string
          id: string
          listing_id: string
          utility_expense_id: string
        }
        Insert: {
          amount: number
          attribution_pct: number
          created_at?: string
          expense_date: string
          id?: string
          listing_id: string
          utility_expense_id: string
        }
        Update: {
          amount?: number
          attribution_pct?: number
          created_at?: string
          expense_date?: string
          id?: string
          listing_id?: string
          utility_expense_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "utility_expense_allocations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "utility_expense_allocations_utility_expense_id_fkey"
            columns: ["utility_expense_id"]
            isOneToOne: false
            referencedRelation: "utility_expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      utility_expenses: {
        Row: {
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          notes: string | null
          type: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expense_date: string
          id?: string
          notes?: string | null
          type: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          notes?: string | null
          type?: string
          updated_at?: string
          value?: number
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
      communal_group_ratio_sum: {
        Args: { p_group_id: string }
        Returns: number
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
      adjustment_target: "revenue" | "cost_line" | "settlement"
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
      app_role:
        | "super"
        | "senior"
        | "admin"
        | "client"
        | "cleaner"
        | "maintenance"
      management_fee_method:
        | "percent_per_property"
        | "flat_per_property"
        | "flat_per_portfolio"
      ota_attribution_outcome: "management_report" | "company_retention"
      ota_batch_status: "parsed" | "reconciled" | "partial"
      ota_collection_model: "channel" | "host"
      ota_match_method: "code" | "composite" | "manual" | "none"
      ota_platform: "airbnb" | "bookingcom" | "stripe" | "vrbo"
      ota_recon_status:
        | "auto_matched"
        | "needs_recon"
        | "matched"
        | "unmatched"
        | "excluded"
      ota_txn_type: "reservation" | "payout" | "resolution" | "adjustment"
      report_booking_channel: "bookingcom" | "airbnb" | "direct"
      report_source_category:
        | "integration"
        | "platform_engine"
        | "derived"
        | "manual"
      report_status: "draft" | "finalised"
      revenue_recognition: "prorate_by_nights" | "whole_in_attributed_month"
      settlement_method: "pay_on_generation" | "weekly_draw"
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
      adjustment_target: ["revenue", "cost_line", "settlement"],
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
      app_role: [
        "super",
        "senior",
        "admin",
        "client",
        "cleaner",
        "maintenance",
      ],
      management_fee_method: [
        "percent_per_property",
        "flat_per_property",
        "flat_per_portfolio",
      ],
      ota_attribution_outcome: ["management_report", "company_retention"],
      ota_batch_status: ["parsed", "reconciled", "partial"],
      ota_collection_model: ["channel", "host"],
      ota_match_method: ["code", "composite", "manual", "none"],
      ota_platform: ["airbnb", "bookingcom", "stripe", "vrbo"],
      ota_recon_status: [
        "auto_matched",
        "needs_recon",
        "matched",
        "unmatched",
        "excluded",
      ],
      ota_txn_type: ["reservation", "payout", "resolution", "adjustment"],
      report_booking_channel: ["bookingcom", "airbnb", "direct"],
      report_source_category: [
        "integration",
        "platform_engine",
        "derived",
        "manual",
      ],
      report_status: ["draft", "finalised"],
      revenue_recognition: ["prorate_by_nights", "whole_in_attributed_month"],
      settlement_method: ["pay_on_generation", "weekly_draw"],
    },
  },
} as const
