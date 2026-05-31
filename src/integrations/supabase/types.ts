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
      activity_logs: {
        Row: {
          action: string
          casino_id: string
          category: Database["public"]["Enums"]["log_category"]
          created_at: string
          details: Json
          id: string
          operator_id: string
        }
        Insert: {
          action: string
          casino_id: string
          category: Database["public"]["Enums"]["log_category"]
          created_at?: string
          details?: Json
          id?: string
          operator_id: string
        }
        Update: {
          action?: string
          casino_id?: string
          category?: Database["public"]["Enums"]["log_category"]
          created_at?: string
          details?: Json
          id?: string
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_logs_archive: {
        Row: {
          action: string
          casino_id: string
          category: Database["public"]["Enums"]["log_category"]
          created_at: string
          details: Json
          id: string
          operator_id: string
        }
        Insert: {
          action: string
          casino_id: string
          category: Database["public"]["Enums"]["log_category"]
          created_at?: string
          details?: Json
          id?: string
          operator_id: string
        }
        Update: {
          action?: string
          casino_id?: string
          category?: Database["public"]["Enums"]["log_category"]
          created_at?: string
          details?: Json
          id?: string
          operator_id?: string
        }
        Relationships: []
      }
      attendance_holidays: {
        Row: {
          casino_id: string
          created_at: string
          created_by: string | null
          date: string
          id: string
          multiplier: number
          name: string
          updated_at: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          multiplier?: number
          name?: string
          updated_at?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          multiplier?: number
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_holidays_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_hours: {
        Row: {
          casino_id: string
          created_at: string
          date: string
          employee_id: string
          hours: number
          id: string
          note: string | null
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          date: string
          employee_id: string
          hours?: number
          id?: string
          note?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          date?: string
          employee_id?: string
          hours?: number
          id?: string
          note?: string | null
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_hours_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_hours_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_checks: {
        Row: {
          amount: number
          approval_code: string
          bank: string
          card_masked: string
          casino_id: string
          check_date: string
          check_time: string | null
          created_at: string
          created_by: string
          currency: string
          discrepancy: number
          expected_balance: number
          id: string
          is_balanced: boolean
          merchant: string
          note: string
          photo_url: string | null
          receipt_no: string
          updated_at: string
        }
        Insert: {
          amount: number
          approval_code?: string
          bank?: string
          card_masked?: string
          casino_id: string
          check_date: string
          check_time?: string | null
          created_at?: string
          created_by: string
          currency?: string
          discrepancy?: number
          expected_balance?: number
          id?: string
          is_balanced?: boolean
          merchant?: string
          note?: string
          photo_url?: string | null
          receipt_no?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approval_code?: string
          bank?: string
          card_masked?: string
          casino_id?: string
          check_date?: string
          check_time?: string | null
          created_at?: string
          created_by?: string
          currency?: string
          discrepancy?: number
          expected_balance?: number
          id?: string
          is_balanced?: boolean
          merchant?: string
          note?: string
          photo_url?: string | null
          receipt_no?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_checks_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      breaklist: {
        Row: {
          casino_id: string
          created_at: string
          created_by: string
          date: string
          employee_id: string
          id: string
          is_locked: boolean
          locked_by: string | null
          role: Database["public"]["Enums"]["dealer_role"]
          table_id: string | null
          time_slot: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by: string
          date: string
          employee_id: string
          id?: string
          is_locked?: boolean
          locked_by?: string | null
          role?: Database["public"]["Enums"]["dealer_role"]
          table_id?: string | null
          time_slot: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string
          date?: string
          employee_id?: string
          id?: string
          is_locked?: boolean
          locked_by?: string | null
          role?: Database["public"]["Enums"]["dealer_role"]
          table_id?: string | null
          time_slot?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "breaklist_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaklist_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaklist_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      breaklist_logs: {
        Row: {
          action: string
          breaklist_id: string | null
          casino_id: string
          created_at: string
          date: string
          dealer_id: string
          id: string
          new_role: string | null
          new_table_id: string | null
          old_role: string | null
          old_table_id: string | null
          operator_id: string
          time_slot: string
        }
        Insert: {
          action: string
          breaklist_id?: string | null
          casino_id: string
          created_at?: string
          date: string
          dealer_id: string
          id?: string
          new_role?: string | null
          new_table_id?: string | null
          old_role?: string | null
          old_table_id?: string | null
          operator_id: string
          time_slot: string
        }
        Update: {
          action?: string
          breaklist_id?: string | null
          casino_id?: string
          created_at?: string
          date?: string
          dealer_id?: string
          id?: string
          new_role?: string | null
          new_table_id?: string | null
          old_role?: string | null
          old_table_id?: string | null
          operator_id?: string
          time_slot?: string
        }
        Relationships: [
          {
            foreignKeyName: "breaklist_logs_breaklist_id_fkey"
            columns: ["breaklist_id"]
            isOneToOne: false
            referencedRelation: "breaklist"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaklist_logs_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaklist_logs_new_table_id_fkey"
            columns: ["new_table_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "breaklist_logs_old_table_id_fkey"
            columns: ["old_table_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      breaklist_logs_archive: {
        Row: {
          action: string
          breaklist_id: string | null
          casino_id: string
          created_at: string
          date: string
          dealer_id: string
          id: string
          new_role: string | null
          new_table_id: string | null
          old_role: string | null
          old_table_id: string | null
          operator_id: string
          time_slot: string
        }
        Insert: {
          action: string
          breaklist_id?: string | null
          casino_id: string
          created_at?: string
          date: string
          dealer_id: string
          id?: string
          new_role?: string | null
          new_table_id?: string | null
          old_role?: string | null
          old_table_id?: string | null
          operator_id: string
          time_slot: string
        }
        Update: {
          action?: string
          breaklist_id?: string | null
          casino_id?: string
          created_at?: string
          date?: string
          dealer_id?: string
          id?: string
          new_role?: string | null
          new_table_id?: string | null
          old_role?: string | null
          old_table_id?: string | null
          operator_id?: string
          time_slot?: string
        }
        Relationships: []
      }
      budget_categories: {
        Row: {
          casino_id: string
          created_at: string
          created_by: string
          expense_mapping: string | null
          id: string
          name: string
          parent_group: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by: string
          expense_mapping?: string | null
          id?: string
          name: string
          parent_group: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string
          expense_mapping?: string | null
          id?: string
          name?: string
          parent_group?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_categories_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_items: {
        Row: {
          actual_amount: number
          casino_id: string
          category_id: string
          created_at: string
          id: string
          item_name: string
          logic_type: string
          monthly_amount: number
          period_id: string
          reserved_amount: number
          status: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number
          casino_id: string
          category_id: string
          created_at?: string
          id?: string
          item_name: string
          logic_type: string
          monthly_amount?: number
          period_id: string
          reserved_amount?: number
          status?: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number
          casino_id?: string
          category_id?: string
          created_at?: string
          id?: string
          item_name?: string
          logic_type?: string
          monthly_amount?: number
          period_id?: string
          reserved_amount?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_items_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "budget_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_items_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_logs: {
        Row: {
          action: string
          casino_id: string
          created_at: string
          details: Json
          id: string
          item_id: string | null
          operator_id: string
          period_id: string | null
        }
        Insert: {
          action: string
          casino_id: string
          created_at?: string
          details?: Json
          id?: string
          item_id?: string | null
          operator_id: string
          period_id?: string | null
        }
        Update: {
          action?: string
          casino_id?: string
          created_at?: string
          details?: Json
          id?: string
          item_id?: string | null
          operator_id?: string
          period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "budget_logs_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_logs_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "budget_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_logs_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "budget_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_periods: {
        Row: {
          casino_id: string
          created_at: string
          id: string
          is_locked: boolean
          locked_by: string | null
          month: string
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_by?: string | null
          month: string
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          id?: string
          is_locked?: boolean
          locked_by?: string | null
          month?: string
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_periods_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      business_day_closures: {
        Row: {
          business_date: string
          casino_id: string
          closed_at: string
          closed_by: string | null
          closed_method: string
          id: string
          snapshot: Json
        }
        Insert: {
          business_date: string
          casino_id: string
          closed_at?: string
          closed_by?: string | null
          closed_method: string
          id?: string
          snapshot?: Json
        }
        Update: {
          business_date?: string
          casino_id?: string
          closed_at?: string
          closed_by?: string | null
          closed_method?: string
          id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "business_day_closures_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      cage_slots_cards: {
        Row: {
          cage_slots_shift_id: string
          card_balance_effect_tzs: number | null
          card_deposit_value_tzs: number
          casino_id: string
          closing_card_count: number | null
          created_at: string
          id: string
          miss_card_count: number | null
          opening_card_count: number
          updated_at: string
        }
        Insert: {
          cage_slots_shift_id: string
          card_balance_effect_tzs?: number | null
          card_deposit_value_tzs?: number
          casino_id: string
          closing_card_count?: number | null
          created_at?: string
          id?: string
          miss_card_count?: number | null
          opening_card_count?: number
          updated_at?: string
        }
        Update: {
          cage_slots_shift_id?: string
          card_balance_effect_tzs?: number | null
          card_deposit_value_tzs?: number
          casino_id?: string
          closing_card_count?: number | null
          created_at?: string
          id?: string
          miss_card_count?: number | null
          opening_card_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cage_slots_cards_cage_slots_shift_id_fkey"
            columns: ["cage_slots_shift_id"]
            isOneToOne: true
            referencedRelation: "cage_slots_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_slots_cards_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      cage_slots_cash_counts: {
        Row: {
          cage_slots_shift_id: string
          casino_id: string
          count_type: Database["public"]["Enums"]["cage_slots_count_type"]
          counted_by: string
          created_at: string
          denominations: Json
          id: string
          note: string | null
          total_tzs: number
        }
        Insert: {
          cage_slots_shift_id: string
          casino_id: string
          count_type: Database["public"]["Enums"]["cage_slots_count_type"]
          counted_by: string
          created_at?: string
          denominations?: Json
          id?: string
          note?: string | null
          total_tzs?: number
        }
        Update: {
          cage_slots_shift_id?: string
          casino_id?: string
          count_type?: Database["public"]["Enums"]["cage_slots_count_type"]
          counted_by?: string
          created_at?: string
          denominations?: Json
          id?: string
          note?: string | null
          total_tzs?: number
        }
        Relationships: [
          {
            foreignKeyName: "cage_slots_cash_counts_cage_slots_shift_id_fkey"
            columns: ["cage_slots_shift_id"]
            isOneToOne: false
            referencedRelation: "cage_slots_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_slots_cash_counts_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      cage_slots_cash_inventory: {
        Row: {
          cage_slots_shift_id: string
          casino_id: string
          created_at: string
          created_by: string | null
          currency_code: string
          denomination: number
          id: string
          inventory_type: Database["public"]["Enums"]["cage_slots_inventory_type"]
          quantity: number
          rate_to_tzs: number
          total_currency: number
          total_tzs: number
          updated_at: string
        }
        Insert: {
          cage_slots_shift_id: string
          casino_id: string
          created_at?: string
          created_by?: string | null
          currency_code: string
          denomination: number
          id?: string
          inventory_type: Database["public"]["Enums"]["cage_slots_inventory_type"]
          quantity?: number
          rate_to_tzs?: number
          total_currency?: number
          total_tzs?: number
          updated_at?: string
        }
        Update: {
          cage_slots_shift_id?: string
          casino_id?: string
          created_at?: string
          created_by?: string | null
          currency_code?: string
          denomination?: number
          id?: string
          inventory_type?: Database["public"]["Enums"]["cage_slots_inventory_type"]
          quantity?: number
          rate_to_tzs?: number
          total_currency?: number
          total_tzs?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cage_slots_cash_inventory_cage_slots_shift_id_fkey"
            columns: ["cage_slots_shift_id"]
            isOneToOne: false
            referencedRelation: "cage_slots_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_slots_cash_inventory_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      cage_slots_comments: {
        Row: {
          cage_slots_shift_id: string
          casino_id: string
          comment_text: string
          comment_type: Database["public"]["Enums"]["cage_slots_comment_type"]
          created_at: string
          created_by: string
          id: string
        }
        Insert: {
          cage_slots_shift_id: string
          casino_id: string
          comment_text: string
          comment_type: Database["public"]["Enums"]["cage_slots_comment_type"]
          created_at?: string
          created_by: string
          id?: string
        }
        Update: {
          cage_slots_shift_id?: string
          casino_id?: string
          comment_text?: string
          comment_type?: Database["public"]["Enums"]["cage_slots_comment_type"]
          created_at?: string
          created_by?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cage_slots_comments_cage_slots_shift_id_fkey"
            columns: ["cage_slots_shift_id"]
            isOneToOne: false
            referencedRelation: "cage_slots_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_slots_comments_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      cage_slots_exchange_rates: {
        Row: {
          cage_slots_shift_id: string
          casino_id: string
          created_at: string
          currency_code: string
          id: string
          rate_to_tzs: number
          updated_at: string
        }
        Insert: {
          cage_slots_shift_id: string
          casino_id: string
          created_at?: string
          currency_code: string
          id?: string
          rate_to_tzs: number
          updated_at?: string
        }
        Update: {
          cage_slots_shift_id?: string
          casino_id?: string
          created_at?: string
          currency_code?: string
          id?: string
          rate_to_tzs?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cage_slots_exchange_rates_cage_slots_shift_id_fkey"
            columns: ["cage_slots_shift_id"]
            isOneToOne: false
            referencedRelation: "cage_slots_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_slots_exchange_rates_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      cage_slots_settings: {
        Row: {
          card_deposit_value_tzs: number
          casino_id: string
          created_at: string
          id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          card_deposit_value_tzs?: number
          casino_id: string
          created_at?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          card_deposit_value_tzs?: number
          casino_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cage_slots_settings_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: true
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      cage_slots_shifts: {
        Row: {
          actual_cage_result: number | null
          balance: number | null
          business_date: string
          cards_miss: number | null
          cash_desk_result: number | null
          cashier_id: string
          cashier_note: string | null
          cashless_final: number
          cashless_final_providers: Json
          cashless_in_providers: Json
          cashless_out_providers: Json
          casino_id: string
          client_uuid: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          difference_amount: number | null
          id: string
          manager_comment: string | null
          opened_at: string
          opened_by: string
          reverses_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shift_type: Database["public"]["Enums"]["cage_slots_shift_type"]
          slots_result: number | null
          status: Database["public"]["Enums"]["cage_slots_status"]
          submitted_at: string | null
          system_shift_result: number | null
          updated_at: string
        }
        Insert: {
          actual_cage_result?: number | null
          balance?: number | null
          business_date: string
          cards_miss?: number | null
          cash_desk_result?: number | null
          cashier_id: string
          cashier_note?: string | null
          cashless_final?: number
          cashless_final_providers?: Json
          cashless_in_providers?: Json
          cashless_out_providers?: Json
          casino_id: string
          client_uuid?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          difference_amount?: number | null
          id?: string
          manager_comment?: string | null
          opened_at?: string
          opened_by: string
          reverses_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_type: Database["public"]["Enums"]["cage_slots_shift_type"]
          slots_result?: number | null
          status?: Database["public"]["Enums"]["cage_slots_status"]
          submitted_at?: string | null
          system_shift_result?: number | null
          updated_at?: string
        }
        Update: {
          actual_cage_result?: number | null
          balance?: number | null
          business_date?: string
          cards_miss?: number | null
          cash_desk_result?: number | null
          cashier_id?: string
          cashier_note?: string | null
          cashless_final?: number
          cashless_final_providers?: Json
          cashless_in_providers?: Json
          cashless_out_providers?: Json
          casino_id?: string
          client_uuid?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          difference_amount?: number | null
          id?: string
          manager_comment?: string | null
          opened_at?: string
          opened_by?: string
          reverses_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_type?: Database["public"]["Enums"]["cage_slots_shift_type"]
          slots_result?: number | null
          status?: Database["public"]["Enums"]["cage_slots_status"]
          submitted_at?: string | null
          system_shift_result?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cage_slots_shifts_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_slots_shifts_reverses_id_fkey"
            columns: ["reverses_id"]
            isOneToOne: false
            referencedRelation: "cage_slots_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      cage_slots_tips_cd: {
        Row: {
          amount: number
          cage_slots_shift_id: string
          casino_id: string
          created_at: string
          id: string
          note: string
          operator_id: string
        }
        Insert: {
          amount: number
          cage_slots_shift_id: string
          casino_id: string
          created_at?: string
          id?: string
          note?: string
          operator_id: string
        }
        Update: {
          amount?: number
          cage_slots_shift_id?: string
          casino_id?: string
          created_at?: string
          id?: string
          note?: string
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cage_slots_tips_cd_cage_slots_shift_id_fkey"
            columns: ["cage_slots_shift_id"]
            isOneToOne: false
            referencedRelation: "cage_slots_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      cage_slots_transfers: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string
          approved_by_user: string | null
          cage_slots_shift_id: string
          casino_id: string
          counterpart_lg_shift_id: string | null
          counterpart_lg_transfer_id: string | null
          created_at: string
          direction: string
          id: string
          note: string
          operator_id: string
          requires_approval: boolean
          transfer_type: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by: string
          approved_by_user?: string | null
          cage_slots_shift_id: string
          casino_id: string
          counterpart_lg_shift_id?: string | null
          counterpart_lg_transfer_id?: string | null
          created_at?: string
          direction: string
          id?: string
          note?: string
          operator_id: string
          requires_approval?: boolean
          transfer_type: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string
          approved_by_user?: string | null
          cage_slots_shift_id?: string
          casino_id?: string
          counterpart_lg_shift_id?: string | null
          counterpart_lg_transfer_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          note?: string
          operator_id?: string
          requires_approval?: boolean
          transfer_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cage_slots_transfers_cage_slots_shift_id_fkey"
            columns: ["cage_slots_shift_id"]
            isOneToOne: false
            referencedRelation: "cage_slots_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_slots_transfers_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_slots_transfers_counterpart_lg_shift_id_fkey"
            columns: ["counterpart_lg_shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_slots_transfers_counterpart_lg_transfer_id_fkey"
            columns: ["counterpart_lg_transfer_id"]
            isOneToOne: false
            referencedRelation: "cage_transfers"
            referencedColumns: ["id"]
          },
        ]
      }
      cage_transfers: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string
          approved_by_user: string | null
          casino_id: string
          chips: Json | null
          counterpart_slots_transfer_id: string | null
          created_at: string
          direction: string
          id: string
          note: string
          operator_id: string
          requires_approval: boolean
          shift_id: string
          table_id: string | null
          transfer_type: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by: string
          approved_by_user?: string | null
          casino_id: string
          chips?: Json | null
          counterpart_slots_transfer_id?: string | null
          created_at?: string
          direction: string
          id?: string
          note?: string
          operator_id: string
          requires_approval?: boolean
          shift_id: string
          table_id?: string | null
          transfer_type: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string
          approved_by_user?: string | null
          casino_id?: string
          chips?: Json | null
          counterpart_slots_transfer_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          note?: string
          operator_id?: string
          requires_approval?: boolean
          shift_id?: string
          table_id?: string | null
          transfer_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cage_transfers_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_transfers_counterpart_slots_transfer_id_fkey"
            columns: ["counterpart_slots_transfer_id"]
            isOneToOne: false
            referencedRelation: "cage_slots_transfers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_transfers_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cage_transfers_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_count_snapshots: {
        Row: {
          casino_id: string
          counted_by: string
          created_at: string
          currency: string
          denominations: Json
          discrepancy: number
          exchange_rate: number
          expected_balance: number
          id: string
          note: string
          physical_total: number
          physical_total_tzs: number
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          casino_id: string
          counted_by: string
          created_at?: string
          currency?: string
          denominations?: Json
          discrepancy?: number
          exchange_rate?: number
          expected_balance?: number
          id?: string
          note?: string
          physical_total?: number
          physical_total_tzs?: number
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          casino_id?: string
          counted_by?: string
          created_at?: string
          currency?: string
          denominations?: Json
          discrepancy?: number
          exchange_rate?: number
          expected_balance?: number
          id?: string
          note?: string
          physical_total?: number
          physical_total_tzs?: number
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_count_snapshots_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_counts: {
        Row: {
          casino_id: string
          count_type: string
          counted_by: string
          created_at: string
          currency: string
          denominations: Json
          id: string
          shift_id: string
          total: number
        }
        Insert: {
          casino_id: string
          count_type: string
          counted_by: string
          created_at?: string
          currency?: string
          denominations?: Json
          id?: string
          shift_id: string
          total?: number
        }
        Update: {
          casino_id?: string
          count_type?: string
          counted_by?: string
          created_at?: string
          currency?: string
          denominations?: Json
          id?: string
          shift_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_counts_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_counts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      cashless_transactions: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          business_date: string
          cage_slots_shift_id: string | null
          cage_type: string
          casino_id: string
          created_at: string
          currency: string
          direction: string
          id: string
          note: string
          operator_id: string
          player_id: string | null
          player_name: string
          provider: string
          reference: string
          source_module: string | null
          status: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          business_date: string
          cage_slots_shift_id?: string | null
          cage_type?: string
          casino_id: string
          created_at?: string
          currency?: string
          direction: string
          id?: string
          note?: string
          operator_id: string
          player_id?: string | null
          player_name?: string
          provider: string
          reference?: string
          source_module?: string | null
          status?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          business_date?: string
          cage_slots_shift_id?: string | null
          cage_type?: string
          casino_id?: string
          created_at?: string
          currency?: string
          direction?: string
          id?: string
          note?: string
          operator_id?: string
          player_id?: string | null
          player_name?: string
          provider?: string
          reference?: string
          source_module?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashless_transactions_cage_slots_shift_id_fkey"
            columns: ["cage_slots_shift_id"]
            isOneToOne: false
            referencedRelation: "cage_slots_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashless_transactions_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashless_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "cashless_transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      casino_servers: {
        Row: {
          casino_id: string
          created_at: string
          display_name: string | null
          id: string
          local_url: string | null
          node_id: string | null
          role: Database["public"]["Enums"]["casino_server_role"]
        }
        Insert: {
          casino_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          local_url?: string | null
          node_id?: string | null
          role?: Database["public"]["Enums"]["casino_server_role"]
        }
        Update: {
          casino_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          local_url?: string | null
          node_id?: string | null
          role?: Database["public"]["Enums"]["casino_server_role"]
        }
        Relationships: []
      }
      casino_visits: {
        Row: {
          casino_id: string
          checked_in_at: string
          checked_in_by: string
          checked_out_at: string | null
          date: string
          id: string
          player_id: string
          position: string
        }
        Insert: {
          casino_id: string
          checked_in_at?: string
          checked_in_by: string
          checked_out_at?: string | null
          date?: string
          id?: string
          player_id: string
          position?: string
        }
        Update: {
          casino_id?: string
          checked_in_at?: string
          checked_in_by?: string
          checked_out_at?: string | null
          date?: string
          id?: string
          player_id?: string
          position?: string
        }
        Relationships: [
          {
            foreignKeyName: "casino_visits_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "casino_visits_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "casino_visits_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      casino_visits_archive: {
        Row: {
          casino_id: string
          checked_in_at: string
          checked_in_by: string
          checked_out_at: string | null
          date: string
          id: string
          player_id: string
          position: string
        }
        Insert: {
          casino_id: string
          checked_in_at?: string
          checked_in_by: string
          checked_out_at?: string | null
          date?: string
          id?: string
          player_id: string
          position?: string
        }
        Update: {
          casino_id?: string
          checked_in_at?: string
          checked_in_by?: string
          checked_out_at?: string | null
          date?: string
          id?: string
          player_id?: string
          position?: string
        }
        Relationships: []
      }
      casinos: {
        Row: {
          brand_accent_hsl: string | null
          brand_primary_hsl: string | null
          breaklist_lock: string
          breaklist_lock_pending: string | null
          breaklist_lock_pending_from: string | null
          cage_float: number
          chip_conservation_mode: string
          code: string
          created_at: string
          float_locked: boolean
          id: string
          logo_url: string | null
          name: string
          shift_end: string
          shift_end_pending: string | null
          shift_end_pending_from: string | null
          shift_start: string
          slug: string | null
          tables_open: string
          timezone: string
        }
        Insert: {
          brand_accent_hsl?: string | null
          brand_primary_hsl?: string | null
          breaklist_lock?: string
          breaklist_lock_pending?: string | null
          breaklist_lock_pending_from?: string | null
          cage_float?: number
          chip_conservation_mode?: string
          code: string
          created_at?: string
          float_locked?: boolean
          id?: string
          logo_url?: string | null
          name: string
          shift_end?: string
          shift_end_pending?: string | null
          shift_end_pending_from?: string | null
          shift_start?: string
          slug?: string | null
          tables_open?: string
          timezone?: string
        }
        Update: {
          brand_accent_hsl?: string | null
          brand_primary_hsl?: string | null
          breaklist_lock?: string
          breaklist_lock_pending?: string | null
          breaklist_lock_pending_from?: string | null
          cage_float?: number
          chip_conservation_mode?: string
          code?: string
          created_at?: string
          float_locked?: boolean
          id?: string
          logo_url?: string | null
          name?: string
          shift_end?: string
          shift_end_pending?: string | null
          shift_end_pending_from?: string | null
          shift_start?: string
          slug?: string | null
          tables_open?: string
          timezone?: string
        }
        Relationships: []
      }
      cctv_observations: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          casino_id: string
          content: string
          created_at: string
          id: string
          observation_type: string
          observer_id: string
          player_id: string | null
          shift_id: string | null
          subject_type: string
          table_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          casino_id: string
          content: string
          created_at?: string
          id?: string
          observation_type?: string
          observer_id: string
          player_id?: string | null
          shift_id?: string | null
          subject_type?: string
          table_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          casino_id?: string
          content?: string
          created_at?: string
          id?: string
          observation_type?: string
          observer_id?: string
          player_id?: string | null
          shift_id?: string | null
          subject_type?: string
          table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cctv_observations_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cctv_observations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "cctv_observations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cctv_observations_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cctv_observations_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_baseline: {
        Row: {
          casino_id: string
          denomination: number
          expected_quantity: number
          id: string
          location_id: string | null
          location_type: string
        }
        Insert: {
          casino_id: string
          denomination: number
          expected_quantity?: number
          id?: string
          location_id?: string | null
          location_type: string
        }
        Update: {
          casino_id?: string
          denomination?: number
          expected_quantity?: number
          id?: string
          location_id?: string | null
          location_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chip_baseline_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_color_settings: {
        Row: {
          bg_color: string
          casino_id: string
          created_at: string
          denomination: number
          edge_color: string
          id: string
          text_color: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          bg_color: string
          casino_id: string
          created_at?: string
          denomination: number
          edge_color?: string
          id?: string
          text_color?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          bg_color?: string
          casino_id?: string
          created_at?: string
          denomination?: number
          edge_color?: string
          id?: string
          text_color?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chip_color_settings_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_emissions: {
        Row: {
          casino_id: string
          created_at: string
          denomination: number
          id: string
          operator_id: string
          quantity_added: number
          reason: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          denomination: number
          id?: string
          operator_id: string
          quantity_added: number
          reason: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          denomination?: number
          id?: string
          operator_id?: string
          quantity_added?: number
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "chip_emissions_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_initial_baseline: {
        Row: {
          casino_id: string
          created_at: string
          created_by: string | null
          denomination: number
          id: string
          initial_quantity: number
          updated_at: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by?: string | null
          denomination: number
          id?: string
          initial_quantity?: number
          updated_at?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string | null
          denomination?: number
          id?: string
          initial_quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chip_initial_baseline_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_inventory: {
        Row: {
          casino_id: string
          denomination: number
          id: string
          location_id: string | null
          location_type: string
          quantity: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          casino_id: string
          denomination: number
          id?: string
          location_id?: string | null
          location_type: string
          quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          casino_id?: string
          denomination?: number
          id?: string
          location_id?: string | null
          location_type?: string
          quantity?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chip_inventory_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chip_inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_snapshots: {
        Row: {
          actual_quantity: number
          casino_id: string
          created_at: string
          date: string
          denomination: number
          expected_quantity: number
          id: string
          location_id: string | null
          location_type: string
          miss: number | null
          recorded_by: string
        }
        Insert: {
          actual_quantity?: number
          casino_id: string
          created_at?: string
          date: string
          denomination: number
          expected_quantity?: number
          id?: string
          location_id?: string | null
          location_type: string
          miss?: number | null
          recorded_by: string
        }
        Update: {
          actual_quantity?: number
          casino_id?: string
          created_at?: string
          date?: string
          denomination?: number
          expected_quantity?: number
          id?: string
          location_id?: string | null
          location_type?: string
          miss?: number | null
          recorded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "chip_snapshots_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chip_snapshots_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      chip_transfers: {
        Row: {
          amount: number
          business_date: string | null
          casino_id: string
          chips: Json | null
          counterparty_player_id: string
          created_at: string
          direction: string
          id: string
          note: string
          operator_id: string
          pair_id: string
          player_id: string
          shift_id: string
          table_id: string | null
        }
        Insert: {
          amount: number
          business_date?: string | null
          casino_id: string
          chips?: Json | null
          counterparty_player_id: string
          created_at?: string
          direction: string
          id?: string
          note?: string
          operator_id: string
          pair_id: string
          player_id: string
          shift_id: string
          table_id?: string | null
        }
        Update: {
          amount?: number
          business_date?: string | null
          casino_id?: string
          chips?: Json | null
          counterparty_player_id?: string
          created_at?: string
          direction?: string
          id?: string
          note?: string
          operator_id?: string
          pair_id?: string
          player_id?: string
          shift_id?: string
          table_id?: string | null
        }
        Relationships: []
      }
      client_sessions: {
        Row: {
          avg_bet: number
          bet_changed_at: string | null
          casino_id: string
          created_at: string
          created_by: string
          duration_minutes: number
          hands_played: number
          id: string
          player_id: string
          started_at: string
          stopped_at: string | null
          table_id: string
          total_bet: number
        }
        Insert: {
          avg_bet?: number
          bet_changed_at?: string | null
          casino_id: string
          created_at?: string
          created_by: string
          duration_minutes?: number
          hands_played?: number
          id?: string
          player_id: string
          started_at?: string
          stopped_at?: string | null
          table_id: string
          total_bet?: number
        }
        Update: {
          avg_bet?: number
          bet_changed_at?: string | null
          casino_id?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number
          hands_played?: number
          id?: string
          player_id?: string
          started_at?: string
          stopped_at?: string | null
          table_id?: string
          total_bet?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_sessions_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "client_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      client_sessions_archive: {
        Row: {
          avg_bet: number
          bet_changed_at: string | null
          casino_id: string
          created_at: string
          created_by: string
          duration_minutes: number
          hands_played: number
          id: string
          player_id: string
          started_at: string
          stopped_at: string | null
          table_id: string
          total_bet: number
        }
        Insert: {
          avg_bet?: number
          bet_changed_at?: string | null
          casino_id: string
          created_at?: string
          created_by: string
          duration_minutes?: number
          hands_played?: number
          id?: string
          player_id: string
          started_at?: string
          stopped_at?: string | null
          table_id: string
          total_bet?: number
        }
        Update: {
          avg_bet?: number
          bet_changed_at?: string | null
          casino_id?: string
          created_at?: string
          created_by?: string
          duration_minutes?: number
          hands_played?: number
          id?: string
          player_id?: string
          started_at?: string
          stopped_at?: string | null
          table_id?: string
          total_bet?: number
        }
        Relationships: []
      }
      cloud_connection: {
        Row: {
          casino_id: string | null
          cloud_url: string | null
          connected_at: string | null
          id: number
          last_error: string | null
          last_polled_at: string | null
          pairing_code: string | null
          pairing_expires_at: string | null
          pairing_id: string | null
          status: string
          sync_secret: string | null
          updated_at: string
        }
        Insert: {
          casino_id?: string | null
          cloud_url?: string | null
          connected_at?: string | null
          id?: number
          last_error?: string | null
          last_polled_at?: string | null
          pairing_code?: string | null
          pairing_expires_at?: string | null
          pairing_id?: string | null
          status?: string
          sync_secret?: string | null
          updated_at?: string
        }
        Update: {
          casino_id?: string | null
          cloud_url?: string | null
          connected_at?: string | null
          id?: number
          last_error?: string | null
          last_polled_at?: string | null
          pairing_code?: string | null
          pairing_expires_at?: string | null
          pairing_id?: string | null
          status?: string
          sync_secret?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cron_run_log: {
        Row: {
          created_at: string
          details: Json | null
          duration_ms: number | null
          id: number
          job_name: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: number
          job_name: string
          status: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: number
          job_name?: string
          status?: string
        }
        Relationships: []
      }
      cutover_sessions: {
        Row: {
          casino_id: string
          completed_at: string | null
          delta_rows: number
          drain_ms: number | null
          id: string
          initiated_by: string | null
          notes: string | null
          rollback_window_until: string | null
          seed_rows: number
          source_node_id: string | null
          started_at: string
          state: string
          target_node_id: string | null
          updated_at: string
        }
        Insert: {
          casino_id: string
          completed_at?: string | null
          delta_rows?: number
          drain_ms?: number | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          rollback_window_until?: string | null
          seed_rows?: number
          source_node_id?: string | null
          started_at?: string
          state?: string
          target_node_id?: string | null
          updated_at?: string
        }
        Update: {
          casino_id?: string
          completed_at?: string | null
          delta_rows?: number
          drain_ms?: number | null
          id?: string
          initiated_by?: string | null
          notes?: string | null
          rollback_window_until?: string | null
          seed_rows?: number
          source_node_id?: string | null
          started_at?: string
          state?: string
          target_node_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cutover_sessions_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_summaries: {
        Row: {
          casino_id: string
          comment: string
          confirmed: boolean
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          date: string
          id: string
          slots_result: number
          tables_result: number
          total_expenses: number
          total_result: number
          updated_at: string
        }
        Insert: {
          casino_id: string
          comment?: string
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          date: string
          id?: string
          slots_result?: number
          tables_result?: number
          total_expenses?: number
          total_result?: number
          updated_at?: string
        }
        Update: {
          casino_id?: string
          comment?: string
          confirmed?: boolean
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          date?: string
          id?: string
          slots_result?: number
          tables_result?: number
          total_expenses?: number
          total_result?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_summaries_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_attendance: {
        Row: {
          casino_id: string
          created_at: string
          date: string
          employee_id: string
          id: string
          recorded_by: string
          updated_at: string
          value: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          date: string
          employee_id: string
          id?: string
          recorded_by: string
          updated_at?: string
          value?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          recorded_by?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "dealer_attendance_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_seed_log: {
        Row: {
          casino_id: string
          created_at: string
          id: number
          row_id: string
          table_name: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          id?: number
          row_id: string
          table_name: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          id?: number
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      employee_bank_accounts: {
        Row: {
          account_number: string
          bank_code: string
          bank_name: string
          branch_code: string
          created_at: string
          employee_id: string
          id: string
          is_primary: boolean
        }
        Insert: {
          account_number?: string
          bank_code?: string
          bank_name?: string
          branch_code?: string
          created_at?: string
          employee_id: string
          id?: string
          is_primary?: boolean
        }
        Update: {
          account_number?: string
          bank_code?: string
          bank_name?: string
          branch_code?: string
          created_at?: string
          employee_id?: string
          id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "employee_bank_accounts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_role_history: {
        Row: {
          created_at: string
          dealer_category: string | null
          department: string
          effective_from: string
          employee_id: string
          id: string
          is_pit_boss: boolean
          position: string
        }
        Insert: {
          created_at?: string
          dealer_category?: string | null
          department?: string
          effective_from: string
          employee_id: string
          id?: string
          is_pit_boss?: boolean
          position?: string
        }
        Update: {
          created_at?: string
          dealer_category?: string | null
          department?: string
          effective_from?: string
          employee_id?: string
          id?: string
          is_pit_boss?: boolean
          position?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_role_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          annual_leave_earned: number
          annual_leave_sold: number
          annual_leave_used: number
          basic_salary: number
          birthday: string | null
          casino_id: string
          confidentiality_agreement: boolean
          contract_end: string | null
          contract_start: string | null
          contract_type: string | null
          corporate_mail: string | null
          created_at: string
          created_by: string | null
          dealer_category: string | null
          department: string
          disciplinary_acknowledged: boolean
          employment_date: string | null
          first_name: string
          full_name: string
          gender: string | null
          general_details: string | null
          gepf_number: string | null
          id: string
          intro_to_work: boolean
          is_pit_boss: boolean
          job_description: string | null
          last_name: string
          license_available: boolean
          license_pass_date: string | null
          license_type: string | null
          nationality: string | null
          nssf_number: string | null
          onboarding_date: string | null
          payroll_status: string
          phone: string | null
          photo_url: string | null
          position: string
          source_table: string | null
          staff_rules_acknowledged: boolean
          tax_id: string | null
          uniform_issued: boolean
          updated_at: string
        }
        Insert: {
          annual_leave_earned?: number
          annual_leave_sold?: number
          annual_leave_used?: number
          basic_salary?: number
          birthday?: string | null
          casino_id: string
          confidentiality_agreement?: boolean
          contract_end?: string | null
          contract_start?: string | null
          contract_type?: string | null
          corporate_mail?: string | null
          created_at?: string
          created_by?: string | null
          dealer_category?: string | null
          department?: string
          disciplinary_acknowledged?: boolean
          employment_date?: string | null
          first_name?: string
          full_name: string
          gender?: string | null
          general_details?: string | null
          gepf_number?: string | null
          id?: string
          intro_to_work?: boolean
          is_pit_boss?: boolean
          job_description?: string | null
          last_name?: string
          license_available?: boolean
          license_pass_date?: string | null
          license_type?: string | null
          nationality?: string | null
          nssf_number?: string | null
          onboarding_date?: string | null
          payroll_status?: string
          phone?: string | null
          photo_url?: string | null
          position?: string
          source_table?: string | null
          staff_rules_acknowledged?: boolean
          tax_id?: string | null
          uniform_issued?: boolean
          updated_at?: string
        }
        Update: {
          annual_leave_earned?: number
          annual_leave_sold?: number
          annual_leave_used?: number
          basic_salary?: number
          birthday?: string | null
          casino_id?: string
          confidentiality_agreement?: boolean
          contract_end?: string | null
          contract_start?: string | null
          contract_type?: string | null
          corporate_mail?: string | null
          created_at?: string
          created_by?: string | null
          dealer_category?: string | null
          department?: string
          disciplinary_acknowledged?: boolean
          employment_date?: string | null
          first_name?: string
          full_name?: string
          gender?: string | null
          general_details?: string | null
          gepf_number?: string | null
          id?: string
          intro_to_work?: boolean
          is_pit_boss?: boolean
          job_description?: string | null
          last_name?: string
          license_available?: boolean
          license_pass_date?: string | null
          license_type?: string | null
          nationality?: string | null
          nssf_number?: string | null
          onboarding_date?: string | null
          payroll_status?: string
          phone?: string | null
          photo_url?: string | null
          position?: string
          source_table?: string | null
          staff_rules_acknowledged?: boolean
          tax_id?: string | null
          uniform_issued?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      endpoint_health_checks: {
        Row: {
          checked_at: string
          duration_ms: number | null
          endpoint: string
          error: string | null
          http_code: number | null
          id: string
          status: string
        }
        Insert: {
          checked_at?: string
          duration_ms?: number | null
          endpoint: string
          error?: string | null
          http_code?: number | null
          id?: string
          status: string
        }
        Update: {
          checked_at?: string
          duration_ms?: number | null
          endpoint?: string
          error?: string | null
          http_code?: number | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          active: boolean
          casino_id: string
          code: string
          created_at: string
          id: string
          label: string
          scope: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          casino_id: string
          code: string
          created_at?: string
          id?: string
          label: string
          scope?: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          casino_id?: string
          code?: string
          created_at?: string
          id?: string
          label?: string
          scope?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_categories_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          approved: boolean
          approved_at: string | null
          approved_by: string | null
          business_date: string | null
          cage_slots_shift_id: string | null
          cage_type: string
          casino_id: string
          category: Database["public"]["Enums"]["expense_category"]
          category_code: string | null
          created_at: string
          created_by: string
          description: string
          id: string
          player_id: string | null
          player_name: string
          shift_id: string | null
          source: string
        }
        Insert: {
          amount: number
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          business_date?: string | null
          cage_slots_shift_id?: string | null
          cage_type?: string
          casino_id: string
          category: Database["public"]["Enums"]["expense_category"]
          category_code?: string | null
          created_at?: string
          created_by: string
          description?: string
          id?: string
          player_id?: string | null
          player_name?: string
          shift_id?: string | null
          source?: string
        }
        Update: {
          amount?: number
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          business_date?: string | null
          cage_slots_shift_id?: string | null
          cage_type?: string
          casino_id?: string
          category?: Database["public"]["Enums"]["expense_category"]
          category_code?: string | null
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          player_id?: string | null
          player_name?: string
          shift_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_cage_slots_shift_id_fkey"
            columns: ["cage_slots_shift_id"]
            isOneToOne: false
            referencedRelation: "cage_slots_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "expenses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_wallets: {
        Row: {
          casino_id: string
          created_at: string
          current_balance: number
          id: string
          updated_at: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Insert: {
          casino_id: string
          created_at?: string
          current_balance?: number
          id?: string
          updated_at?: string
          wallet_type: Database["public"]["Enums"]["wallet_type"]
        }
        Update: {
          casino_id?: string
          created_at?: string
          current_balance?: number
          id?: string
          updated_at?: string
          wallet_type?: Database["public"]["Enums"]["wallet_type"]
        }
        Relationships: [
          {
            foreignKeyName: "financial_wallets_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      gaming_tables: {
        Row: {
          casino_id: string
          closing_chips: Json | null
          closing_result: number | null
          created_at: string
          denominations: number[]
          display_order: number
          float_amount: number
          game: string
          id: string
          is_archived: boolean
          name: string
          status: Database["public"]["Enums"]["table_status"]
        }
        Insert: {
          casino_id: string
          closing_chips?: Json | null
          closing_result?: number | null
          created_at?: string
          denominations?: number[]
          display_order?: number
          float_amount?: number
          game: string
          id?: string
          is_archived?: boolean
          name: string
          status?: Database["public"]["Enums"]["table_status"]
        }
        Update: {
          casino_id?: string
          closing_chips?: Json | null
          closing_result?: number | null
          created_at?: string
          denominations?: number[]
          display_order?: number
          float_amount?: number
          game?: string
          id?: string
          is_archived?: boolean
          name?: string
          status?: Database["public"]["Enums"]["table_status"]
        }
        Relationships: [
          {
            foreignKeyName: "gaming_tables_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          left_at: string | null
          player_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          left_at?: string | null
          player_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          left_at?: string | null
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "player_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "group_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          business_date: string | null
          casino_id: string
          cctv_observer: string | null
          comments: string | null
          created_at: string
          created_by: string | null
          dealer_name: string | null
          department: string | null
          employees: string | null
          id: string
          incident: string
          incident_date: string
          incident_time: string
          inspector_name: string | null
          manager: string | null
          outcome: string | null
          photo_url: string | null
          points: number
          table_name: string | null
          violation_type: string | null
        }
        Insert: {
          business_date?: string | null
          casino_id: string
          cctv_observer?: string | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          dealer_name?: string | null
          department?: string | null
          employees?: string | null
          id?: string
          incident: string
          incident_date: string
          incident_time: string
          inspector_name?: string | null
          manager?: string | null
          outcome?: string | null
          photo_url?: string | null
          points?: number
          table_name?: string | null
          violation_type?: string | null
        }
        Update: {
          business_date?: string | null
          casino_id?: string
          cctv_observer?: string | null
          comments?: string | null
          created_at?: string
          created_by?: string | null
          dealer_name?: string | null
          department?: string | null
          employees?: string | null
          id?: string
          incident?: string
          incident_date?: string
          incident_time?: string
          inspector_name?: string | null
          manager?: string | null
          outcome?: string | null
          photo_url?: string | null
          points?: number
          table_name?: string | null
          violation_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "incidents_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents_audit: {
        Row: {
          casino_id: string
          changes: Json
          edited_at: string
          edited_by: string | null
          id: string
          incident_id: string
        }
        Insert: {
          casino_id: string
          changes: Json
          edited_at?: string
          edited_by?: string | null
          id?: string
          incident_id: string
        }
        Update: {
          casino_id?: string
          changes?: Json
          edited_at?: string
          edited_by?: string | null
          id?: string
          incident_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_audit_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      initial_sync_jobs: {
        Row: {
          casino_id: string
          created_at: string
          current_table: string | null
          error: string | null
          finished_at: string | null
          id: string
          local_server_id: string
          requested_by: string | null
          rows_done: number
          rows_total: number
          started_at: string | null
          status: string
          tables_done: number
          tables_total: number
          updated_at: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          current_table?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          local_server_id: string
          requested_by?: string | null
          rows_done?: number
          rows_total?: number
          started_at?: string | null
          status?: string
          tables_done?: number
          tables_total?: number
          updated_at?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          current_table?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          local_server_id?: string
          requested_by?: string | null
          rows_done?: number
          rows_total?: number
          started_at?: string | null
          status?: string
          tables_done?: number
          tables_total?: number
          updated_at?: string
        }
        Relationships: []
      }
      inter_casino_transfers: {
        Row: {
          amount: number
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          currency: string
          description: string
          from_casino_id: string
          id: string
          initiated_by: string
          rejected_reason: string | null
          status: string
          to_casino_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          description?: string
          from_casino_id: string
          id?: string
          initiated_by: string
          rejected_reason?: string | null
          status?: string
          to_casino_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          currency?: string
          description?: string
          from_casino_id?: string
          id?: string
          initiated_by?: string
          rejected_reason?: string | null
          status?: string
          to_casino_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inter_casino_transfers_from_casino_id_fkey"
            columns: ["from_casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inter_casino_transfers_to_casino_id_fkey"
            columns: ["to_casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      mirror_cutover_state: {
        Row: {
          casino_id: string
          freeze_started_at: string | null
          freeze_started_by: string | null
          last_parity_at: string | null
          last_parity_ok: boolean | null
          last_parity_summary: Json | null
          promoted_by: string | null
          promoted_to_local_at: string | null
          updated_at: string
          write_freeze: boolean
        }
        Insert: {
          casino_id: string
          freeze_started_at?: string | null
          freeze_started_by?: string | null
          last_parity_at?: string | null
          last_parity_ok?: boolean | null
          last_parity_summary?: Json | null
          promoted_by?: string | null
          promoted_to_local_at?: string | null
          updated_at?: string
          write_freeze?: boolean
        }
        Update: {
          casino_id?: string
          freeze_started_at?: string | null
          freeze_started_by?: string | null
          last_parity_at?: string | null
          last_parity_ok?: boolean | null
          last_parity_summary?: Json | null
          promoted_by?: string | null
          promoted_to_local_at?: string | null
          updated_at?: string
          write_freeze?: boolean
        }
        Relationships: []
      }
      monthly_tips_entries: {
        Row: {
          bonus_points: number
          casino_id: string
          created_at: string
          employee_id: string
          extra_override: number | null
          id: string
          period_start: string
          updated_at: string
        }
        Insert: {
          bonus_points?: number
          casino_id: string
          created_at?: string
          employee_id: string
          extra_override?: number | null
          id?: string
          period_start: string
          updated_at?: string
        }
        Update: {
          bonus_points?: number
          casino_id?: string
          created_at?: string
          employee_id?: string
          extra_override?: number | null
          id?: string
          period_start?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_tips_entries_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_tips_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_tips_pools: {
        Row: {
          calculated_at: string | null
          calculated_by: string | null
          casino_id: string
          created_at: string
          currency: string
          id: string
          is_calculated: boolean
          period_start: string
          pool_amount: number
          updated_at: string
        }
        Insert: {
          calculated_at?: string | null
          calculated_by?: string | null
          casino_id: string
          created_at?: string
          currency?: string
          id?: string
          is_calculated?: boolean
          period_start: string
          pool_amount?: number
          updated_at?: string
        }
        Update: {
          calculated_at?: string | null
          calculated_by?: string | null
          casino_id?: string
          created_at?: string
          currency?: string
          id?: string
          is_calculated?: boolean
          period_start?: string
          pool_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_tips_pools_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      node_commands: {
        Row: {
          action: string
          completed_at: string | null
          id: string
          issued_at: string
          issued_by: string | null
          popped_at: string | null
          result_text: string | null
          status: string
          target_node_id: string
        }
        Insert: {
          action: string
          completed_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          popped_at?: string | null
          result_text?: string | null
          status?: string
          target_node_id: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          popped_at?: string | null
          result_text?: string | null
          status?: string
          target_node_id?: string
        }
        Relationships: []
      }
      node_identity: {
        Row: {
          created_at: string
          display_name: string
          id: boolean
          node_id: string
          node_kind: string
          owned_casino_ids: string[]
          schema_version: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id?: boolean
          node_id?: string
          node_kind?: string
          owned_casino_ids?: string[]
          schema_version?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: boolean
          node_id?: string
          node_kind?: string
          owned_casino_ids?: string[]
          schema_version?: string
          updated_at?: string
        }
        Relationships: []
      }
      node_modes: {
        Row: {
          casino_id: string
          mode: string
          notes: string | null
          promoted_at: string | null
          promoted_by: string | null
          updated_at: string
        }
        Insert: {
          casino_id: string
          mode?: string
          notes?: string | null
          promoted_at?: string | null
          promoted_by?: string | null
          updated_at?: string
        }
        Update: {
          casino_id?: string
          mode?: string
          notes?: string | null
          promoted_at?: string | null
          promoted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "node_modes_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: true
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      onprem_channel_migrations: {
        Row: {
          applied_at: string
          channel_id: string
          error: string | null
          id: string
          ok: boolean
          sql_hash: string
          version: string
        }
        Insert: {
          applied_at?: string
          channel_id: string
          error?: string | null
          id?: string
          ok?: boolean
          sql_hash: string
          version: string
        }
        Update: {
          applied_at?: string
          channel_id?: string
          error?: string | null
          id?: string
          ok?: boolean
          sql_hash?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "onprem_channel_migrations_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "onprem_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      onprem_channels: {
        Row: {
          casino_id: string
          cf_tunnel_id: string | null
          created_at: string
          hmac_secret_hash: string
          id: string
          last_seen_at: string | null
          outbox_lag: number | null
          paired_at: string | null
          paired_by: string | null
          pairing_code: string | null
          pairing_expires_at: string | null
          slug: string
          status: string
          tunnel_hostname: string
          updated_at: string
          version: string | null
        }
        Insert: {
          casino_id: string
          cf_tunnel_id?: string | null
          created_at?: string
          hmac_secret_hash: string
          id?: string
          last_seen_at?: string | null
          outbox_lag?: number | null
          paired_at?: string | null
          paired_by?: string | null
          pairing_code?: string | null
          pairing_expires_at?: string | null
          slug: string
          status?: string
          tunnel_hostname: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          casino_id?: string
          cf_tunnel_id?: string | null
          created_at?: string
          hmac_secret_hash?: string
          id?: string
          last_seen_at?: string | null
          outbox_lag?: number | null
          paired_at?: string | null
          paired_by?: string | null
          pairing_code?: string | null
          pairing_expires_at?: string | null
          slug?: string
          status?: string
          tunnel_hostname?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onprem_channels_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          casino_id: string
          created_at: string
          details: Json
          id: string
          period_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          casino_id: string
          created_at?: string
          details?: Json
          id?: string
          period_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          casino_id?: string
          created_at?: string
          details?: Json
          id?: string
          period_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_audit_log_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_entries: {
        Row: {
          cash_shortage: number
          casino_id: string
          created_at: string
          deductions_missing_days: number
          employee_id: string | null
          gepf_employee: number
          gepf_loan: number
          gross_salary: number
          hrs_worked_on_holiday: number
          id: string
          missing_days: number
          net_salary: number
          night_allowance: number
          night_allowance_hours: number
          night_days: number
          nssf_employee: number
          nssf_employer: number
          off_days: number
          off_days_hours: number
          off_days_total: number
          paye: number
          period_id: string
          public_holiday_earned: number
          public_holiday_worked: number
          salary_advances: number
          sdl_amount: number
          snapshot_account_number: string
          snapshot_bank_code: string
          snapshot_basic_salary: number
          snapshot_branch_code: string
          snapshot_full_name: string
          snapshot_position: string
          taxable_pay: number
          updated_at: string
          wcf_amount: number
        }
        Insert: {
          cash_shortage?: number
          casino_id: string
          created_at?: string
          deductions_missing_days?: number
          employee_id?: string | null
          gepf_employee?: number
          gepf_loan?: number
          gross_salary?: number
          hrs_worked_on_holiday?: number
          id?: string
          missing_days?: number
          net_salary?: number
          night_allowance?: number
          night_allowance_hours?: number
          night_days?: number
          nssf_employee?: number
          nssf_employer?: number
          off_days?: number
          off_days_hours?: number
          off_days_total?: number
          paye?: number
          period_id: string
          public_holiday_earned?: number
          public_holiday_worked?: number
          salary_advances?: number
          sdl_amount?: number
          snapshot_account_number?: string
          snapshot_bank_code?: string
          snapshot_basic_salary?: number
          snapshot_branch_code?: string
          snapshot_full_name: string
          snapshot_position?: string
          taxable_pay?: number
          updated_at?: string
          wcf_amount?: number
        }
        Update: {
          cash_shortage?: number
          casino_id?: string
          created_at?: string
          deductions_missing_days?: number
          employee_id?: string | null
          gepf_employee?: number
          gepf_loan?: number
          gross_salary?: number
          hrs_worked_on_holiday?: number
          id?: string
          missing_days?: number
          net_salary?: number
          night_allowance?: number
          night_allowance_hours?: number
          night_days?: number
          nssf_employee?: number
          nssf_employer?: number
          off_days?: number
          off_days_hours?: number
          off_days_total?: number
          paye?: number
          period_id?: string
          public_holiday_earned?: number
          public_holiday_worked?: number
          salary_advances?: number
          sdl_amount?: number
          snapshot_account_number?: string
          snapshot_bank_code?: string
          snapshot_basic_salary?: number
          snapshot_branch_code?: string
          snapshot_full_name?: string
          snapshot_position?: string
          taxable_pay?: number
          updated_at?: string
          wcf_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_paye_brackets: {
        Row: {
          base_tax: number
          casino_id: string
          created_at: string
          effective_from: string
          id: string
          lower_bound: number
          ord: number
          rate_pct: number
          upper_bound: number | null
        }
        Insert: {
          base_tax?: number
          casino_id: string
          created_at?: string
          effective_from?: string
          id?: string
          lower_bound: number
          ord: number
          rate_pct?: number
          upper_bound?: number | null
        }
        Update: {
          base_tax?: number
          casino_id?: string
          created_at?: string
          effective_from?: string
          id?: string
          lower_bound?: number
          ord?: number
          rate_pct?: number
          upper_bound?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_paye_brackets_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_periods: {
        Row: {
          branch_label: string | null
          casino_id: string
          created_at: string
          created_by: string | null
          hr_approved_at: string | null
          hr_approved_by: string | null
          id: string
          locked_at: string | null
          manager_approved_at: string | null
          manager_approved_by: string | null
          month: number
          paid_at: string | null
          paid_by: string | null
          payment_description: string | null
          status: string
          unlock_reason: string | null
          unlocked_at: string | null
          unlocked_by: string | null
          updated_at: string
          year: number
        }
        Insert: {
          branch_label?: string | null
          casino_id: string
          created_at?: string
          created_by?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          locked_at?: string | null
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          month: number
          paid_at?: string | null
          paid_by?: string | null
          payment_description?: string | null
          status?: string
          unlock_reason?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          branch_label?: string | null
          casino_id?: string
          created_at?: string
          created_by?: string | null
          hr_approved_at?: string | null
          hr_approved_by?: string | null
          id?: string
          locked_at?: string | null
          manager_approved_at?: string | null
          manager_approved_by?: string | null
          month?: number
          paid_at?: string | null
          paid_by?: string | null
          payment_description?: string | null
          status?: string
          unlock_reason?: string | null
          unlocked_at?: string | null
          unlocked_by?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_periods_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_settings: {
        Row: {
          casino_id: string
          created_at: string
          default_payment_description: string | null
          effective_from: string
          gepf_pct: number
          hours_per_month: number
          id: string
          night_hours_per_day: number
          night_rate_pct: number
          nssf_employee_pct: number
          nssf_employer_pct: number
          off_day_multiplier: number
          sdl_pct: number
          wcf_pct: number
          working_days: number
        }
        Insert: {
          casino_id: string
          created_at?: string
          default_payment_description?: string | null
          effective_from: string
          gepf_pct?: number
          hours_per_month?: number
          id?: string
          night_hours_per_day?: number
          night_rate_pct?: number
          nssf_employee_pct?: number
          nssf_employer_pct?: number
          off_day_multiplier?: number
          sdl_pct?: number
          wcf_pct?: number
          working_days?: number
        }
        Update: {
          casino_id?: string
          created_at?: string
          default_payment_description?: string | null
          effective_from?: string
          gepf_pct?: number
          hours_per_month?: number
          id?: string
          night_hours_per_day?: number
          night_rate_pct?: number
          nssf_employee_pct?: number
          nssf_employer_pct?: number
          off_day_multiplier?: number
          sdl_pct?: number
          wcf_pct?: number
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_settings_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      peer_bootstrap_tokens: {
        Row: {
          consumed_at: string | null
          consumed_by_casino_id: string | null
          consumed_by_slug: string | null
          created_at: string
          description: string | null
          expires_at: string | null
          token: string
        }
        Insert: {
          consumed_at?: string | null
          consumed_by_casino_id?: string | null
          consumed_by_slug?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          token: string
        }
        Update: {
          consumed_at?: string | null
          consumed_by_casino_id?: string | null
          consumed_by_slug?: string | null
          created_at?: string
          description?: string | null
          expires_at?: string | null
          token?: string
        }
        Relationships: []
      }
      peer_links: {
        Row: {
          created_at: string
          display_name: string
          id: string
          last_pull_cursor: number
          last_pull_error: string | null
          last_push_cursor: number
          last_push_error: string | null
          last_seen_at: string | null
          peer_node_id: string | null
          peer_node_kind: string | null
          peer_url: string
          schema_version: string | null
          status: string
          sync_secret: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          last_pull_cursor?: number
          last_pull_error?: string | null
          last_push_cursor?: number
          last_push_error?: string | null
          last_seen_at?: string | null
          peer_node_id?: string | null
          peer_node_kind?: string | null
          peer_url: string
          schema_version?: string | null
          status?: string
          sync_secret: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          last_pull_cursor?: number
          last_pull_error?: string | null
          last_push_cursor?: number
          last_push_error?: string | null
          last_seen_at?: string | null
          peer_node_id?: string | null
          peer_node_kind?: string | null
          peer_url?: string
          schema_version?: string | null
          status?: string
          sync_secret?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_server_registrations: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_casino_id: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          hostname: string | null
          id: string
          pairing_code: string
          rejected_reason: string | null
          seed_token: string | null
          seed_token_expires_at: string | null
          server_ip: string | null
          server_name: string
          server_slug: string | null
          status: string
          sync_secret: string | null
          system_info: Json | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_casino_id?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          hostname?: string | null
          id?: string
          pairing_code: string
          rejected_reason?: string | null
          seed_token?: string | null
          seed_token_expires_at?: string | null
          server_ip?: string | null
          server_name: string
          server_slug?: string | null
          status?: string
          sync_secret?: string | null
          system_info?: Json | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_casino_id?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          hostname?: string | null
          id?: string
          pairing_code?: string
          rejected_reason?: string | null
          seed_token?: string | null
          seed_token_expires_at?: string | null
          server_ip?: string | null
          server_name?: string
          server_slug?: string | null
          status?: string
          sync_secret?: string | null
          system_info?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_server_registrations_approved_casino_id_fkey"
            columns: ["approved_casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      pit_rota: {
        Row: {
          casino_id: string
          created_at: string
          created_by: string
          date: string
          employee_id: string
          id: string
          shift: Database["public"]["Enums"]["shift_type"]
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by: string
          date: string
          employee_id: string
          id?: string
          shift: Database["public"]["Enums"]["shift_type"]
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string
          date?: string
          employee_id?: string
          id?: string
          shift?: Database["public"]["Enums"]["shift_type"]
        }
        Relationships: [
          {
            foreignKeyName: "pit_rota_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pit_rota_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      player_cards: {
        Row: {
          card_number: string
          card_type: Database["public"]["Enums"]["card_type"]
          id: string
          is_active: boolean
          issued_at: string
          issued_by: string | null
          player_id: string
          rfid_uid: string | null
        }
        Insert: {
          card_number: string
          card_type?: Database["public"]["Enums"]["card_type"]
          id?: string
          is_active?: boolean
          issued_at?: string
          issued_by?: string | null
          player_id: string
          rfid_uid?: string | null
        }
        Update: {
          card_number?: string
          card_type?: Database["public"]["Enums"]["card_type"]
          id?: string
          is_active?: boolean
          issued_at?: string
          issued_by?: string | null
          player_id?: string
          rfid_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_cards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_cards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_chip_adjustments: {
        Row: {
          business_date: string
          casino_id: string
          chip_in: number
          chip_out: number
          created_at: string
          id: string
          note: string
          operator_id: string
          player_id: string
        }
        Insert: {
          business_date?: string
          casino_id: string
          chip_in?: number
          chip_out?: number
          created_at?: string
          id?: string
          note?: string
          operator_id: string
          player_id: string
        }
        Update: {
          business_date?: string
          casino_id?: string
          chip_in?: number
          chip_out?: number
          created_at?: string
          id?: string
          note?: string
          operator_id?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_chip_adjustments_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_chip_adjustments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_chip_adjustments_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_crm: {
        Row: {
          birthday_card_sent_year: number | null
          casino_id: string
          custom_tags: string[]
          host_user_id: string | null
          last_contact_at: string | null
          last_contact_note: string
          player_id: string
          segment: Database["public"]["Enums"]["player_crm_segment"]
          segment_locked: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          birthday_card_sent_year?: number | null
          casino_id: string
          custom_tags?: string[]
          host_user_id?: string | null
          last_contact_at?: string | null
          last_contact_note?: string
          player_id: string
          segment?: Database["public"]["Enums"]["player_crm_segment"]
          segment_locked?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          birthday_card_sent_year?: number | null
          casino_id?: string
          custom_tags?: string[]
          host_user_id?: string | null
          last_contact_at?: string | null
          last_contact_note?: string
          player_id?: string
          segment?: Database["public"]["Enums"]["player_crm_segment"]
          segment_locked?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_crm_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_crm_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_crm_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_daily_avg_bet_changes: {
        Row: {
          business_date: string
          casino_id: string
          changed_at: string
          changed_by: string | null
          game_group: string
          id: string
          player_id: string
          value: number
        }
        Insert: {
          business_date: string
          casino_id: string
          changed_at?: string
          changed_by?: string | null
          game_group: string
          id?: string
          player_id: string
          value: number
        }
        Update: {
          business_date?: string
          casino_id?: string
          changed_at?: string
          changed_by?: string | null
          game_group?: string
          id?: string
          player_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_daily_avg_bet_changes_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_daily_avg_bet_changes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_daily_avg_bet_changes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_daily_avg_bets: {
        Row: {
          avg_bet_ar: number | null
          avg_bet_bj: number | null
          avg_bet_poker: number | null
          business_date: string
          casino_id: string
          created_at: string
          id: string
          player_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          avg_bet_ar?: number | null
          avg_bet_bj?: number | null
          avg_bet_poker?: number | null
          business_date: string
          casino_id: string
          created_at?: string
          id?: string
          player_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          avg_bet_ar?: number | null
          avg_bet_bj?: number | null
          avg_bet_poker?: number | null
          business_date?: string
          casino_id?: string
          created_at?: string
          id?: string
          player_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_daily_avg_bets_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_daily_avg_bets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_daily_avg_bets_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_groups: {
        Row: {
          casino_id: string
          created_at: string
          created_by: string
          id: string
          name: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by: string
          id?: string
          name: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_groups_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      player_notes: {
        Row: {
          casino_id: string
          content: string
          created_at: string
          created_by: string
          id: string
          note_type: string
          player_id: string
        }
        Insert: {
          casino_id: string
          content: string
          created_at?: string
          created_by: string
          id?: string
          note_type?: string
          player_id: string
        }
        Update: {
          casino_id?: string
          content?: string
          created_at?: string
          created_by?: string
          id?: string
          note_type?: string
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_notes_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_notes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_position_history: {
        Row: {
          casino_id: string
          created_at: string
          created_by: string | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          player_id: string
          position: string
          started_at: string
          table_id: string | null
          visit_id: string | null
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          player_id: string
          position: string
          started_at?: string
          table_id?: string | null
          visit_id?: string | null
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          player_id?: string
          position?: string
          started_at?: string
          table_id?: string | null
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "player_position_history_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_position_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_position_history_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_position_history_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_position_history_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "casino_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      player_tags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          player_id: string
          source: string
          tag: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          player_id: string
          source?: string
          tag: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          player_id?: string
          source?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_tags_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "player_tags_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          birth_date: string | null
          casino_id: string
          category: Database["public"]["Enums"]["player_category"]
          created_at: string
          first_name: string
          id: string
          id_document_url: string | null
          id_number: string
          last_name: string
          nickname: string
          phone: string
          photo_url: string | null
          player_type: Database["public"]["Enums"]["player_type"]
          status: Database["public"]["Enums"]["player_status"]
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          casino_id: string
          category?: Database["public"]["Enums"]["player_category"]
          created_at?: string
          first_name: string
          id?: string
          id_document_url?: string | null
          id_number?: string
          last_name: string
          nickname?: string
          phone?: string
          photo_url?: string | null
          player_type?: Database["public"]["Enums"]["player_type"]
          status?: Database["public"]["Enums"]["player_status"]
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          casino_id?: string
          category?: Database["public"]["Enums"]["player_category"]
          created_at?: string
          first_name?: string
          id?: string
          id_document_url?: string | null
          id_number?: string
          last_name?: string
          nickname?: string
          phone?: string
          photo_url?: string | null
          player_type?: Database["public"]["Enums"]["player_type"]
          status?: Database["public"]["Enums"]["player_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_comp_budget_overrides: {
        Row: {
          amount_tzs: number
          casino_id: string
          created_at: string
          id: string
          manager_user_id: string
          month_start: string
          reason: string
          tab_id: string
        }
        Insert: {
          amount_tzs: number
          casino_id: string
          created_at?: string
          id?: string
          manager_user_id: string
          month_start: string
          reason: string
          tab_id: string
        }
        Update: {
          amount_tzs?: number
          casino_id?: string
          created_at?: string
          id?: string
          manager_user_id?: string
          month_start?: string
          reason?: string
          tab_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_comp_budget_overrides_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_comp_budget_overrides_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "pos_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_comp_budgets: {
        Row: {
          casino_id: string
          created_at: string
          created_by: string | null
          id: string
          limit_tzs: number
          month_start: string
          note: string
          updated_at: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          limit_tzs: number
          month_start: string
          note?: string
          updated_at?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          limit_tzs?: number
          month_start?: string
          note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_comp_budgets_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_inventory_movements: {
        Row: {
          created_at: string
          delta: number
          id: string
          item_id: string
          reason: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delta: number
          id?: string
          item_id: string
          reason: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delta?: number
          id?: string
          item_id?: string
          reason?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pos_menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_menu_categories: {
        Row: {
          casino_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      pos_menu_items: {
        Row: {
          avg_cost_tzs: number
          bottle_size_ml: number | null
          casino_id: string
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          last_purchase_at: string | null
          last_purchase_cost_tzs: number | null
          low_threshold: number | null
          name: string
          price_round_step_tzs: number
          price_tzs: number
          serving_size_ml: number | null
          stock_qty: number | null
          updated_at: string
        }
        Insert: {
          avg_cost_tzs?: number
          bottle_size_ml?: number | null
          casino_id: string
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_purchase_at?: string | null
          last_purchase_cost_tzs?: number | null
          low_threshold?: number | null
          name: string
          price_round_step_tzs?: number
          price_tzs: number
          serving_size_ml?: number | null
          stock_qty?: number | null
          updated_at?: string
        }
        Update: {
          avg_cost_tzs?: number
          bottle_size_ml?: number | null
          casino_id?: string
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_purchase_at?: string | null
          last_purchase_cost_tzs?: number | null
          low_threshold?: number | null
          name?: string
          price_round_step_tzs?: number
          price_tzs?: number
          serving_size_ml?: number | null
          stock_qty?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_menu_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pos_menu_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_menu_price_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          item_id: string
          new_price_tzs: number
          old_price_tzs: number | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          item_id: string
          new_price_tzs: number
          old_price_tzs?: number | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          item_id?: string
          new_price_tzs?: number
          old_price_tzs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_menu_price_history_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pos_menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_order_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_name: string
          line_total_tzs: number
          order_id: string
          qty: number
          unit_price_tzs: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_name: string
          line_total_tzs: number
          order_id: string
          qty: number
          unit_price_tzs: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_name?: string
          line_total_tzs?: number
          order_id?: string
          qty?: number
          unit_price_tzs?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_order_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pos_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "pos_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_orders: {
        Row: {
          business_date: string | null
          casino_id: string
          created_at: string
          id: string
          ready_at: string | null
          served_at: string | null
          shift_id: string | null
          source: string
          status: Database["public"]["Enums"]["pos_order_status"]
          tab_id: string
          total_tzs: number
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
          waiter_user_id: string
        }
        Insert: {
          business_date?: string | null
          casino_id: string
          created_at?: string
          id?: string
          ready_at?: string | null
          served_at?: string | null
          shift_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["pos_order_status"]
          tab_id: string
          total_tzs?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
          waiter_user_id: string
        }
        Update: {
          business_date?: string | null
          casino_id?: string
          created_at?: string
          id?: string
          ready_at?: string | null
          served_at?: string | null
          shift_id?: string | null
          source?: string
          status?: Database["public"]["Enums"]["pos_order_status"]
          tab_id?: string
          total_tzs?: number
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
          waiter_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pos_orders_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_orders_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: false
            referencedRelation: "pos_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_player_charges: {
        Row: {
          amount_tzs: number
          business_date: string
          casino_id: string
          created_at: string
          id: string
          player_id: string
          settled_at: string | null
          settled_by: string | null
          settlement_ref: string | null
          status: string
          tab_id: string
          updated_at: string
          void_reason: string | null
        }
        Insert: {
          amount_tzs: number
          business_date: string
          casino_id: string
          created_at?: string
          id?: string
          player_id: string
          settled_at?: string | null
          settled_by?: string | null
          settlement_ref?: string | null
          status?: string
          tab_id: string
          updated_at?: string
          void_reason?: string | null
        }
        Update: {
          amount_tzs?: number
          business_date?: string
          casino_id?: string
          created_at?: string
          id?: string
          player_id?: string
          settled_at?: string | null
          settled_by?: string | null
          settlement_ref?: string | null
          status?: string
          tab_id?: string
          updated_at?: string
          void_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_player_charges_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_player_charges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pos_player_charges_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_player_charges_tab_id_fkey"
            columns: ["tab_id"]
            isOneToOne: true
            referencedRelation: "pos_tabs"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_purchase_items: {
        Row: {
          created_at: string
          id: string
          item_id: string
          line_total_tzs: number
          purchase_id: string
          qty: number
          unit_cost_tzs: number
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          line_total_tzs: number
          purchase_id: string
          qty: number
          unit_cost_tzs: number
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          line_total_tzs?: number
          purchase_id?: string
          qty?: number
          unit_cost_tzs?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_purchase_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pos_menu_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "pos_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_purchases: {
        Row: {
          bartender_user_id: string
          business_date: string | null
          casino_id: string
          created_at: string
          expense_id: string | null
          id: string
          notes: string
          purchase_type: string
          supplier: string | null
          total_tzs: number
        }
        Insert: {
          bartender_user_id: string
          business_date?: string | null
          casino_id: string
          created_at?: string
          expense_id?: string | null
          id?: string
          notes?: string
          purchase_type: string
          supplier?: string | null
          total_tzs?: number
        }
        Update: {
          bartender_user_id?: string
          business_date?: string | null
          casino_id?: string
          created_at?: string
          expense_id?: string | null
          id?: string
          notes?: string
          purchase_type?: string
          supplier?: string | null
          total_tzs?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_purchases_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_purchases_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_shifts: {
        Row: {
          business_date: string | null
          casino_id: string
          closed_at: string | null
          closing_cash: number | null
          created_at: string
          handover_from_shift_id: string | null
          id: string
          opened_at: string
          opening_cash: number
          shift_type: string
          waiter_user_id: string
          z_report: Json | null
        }
        Insert: {
          business_date?: string | null
          casino_id: string
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string
          handover_from_shift_id?: string | null
          id?: string
          opened_at?: string
          opening_cash?: number
          shift_type?: string
          waiter_user_id: string
          z_report?: Json | null
        }
        Update: {
          business_date?: string | null
          casino_id?: string
          closed_at?: string | null
          closing_cash?: number | null
          created_at?: string
          handover_from_shift_id?: string | null
          id?: string
          opened_at?: string
          opening_cash?: number
          shift_type?: string
          waiter_user_id?: string
          z_report?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_shifts_handover_from_shift_id_fkey"
            columns: ["handover_from_shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_stock_count_items: {
        Row: {
          count_id: string
          counted_qty: number
          created_at: string
          expected_qty: number
          id: string
          item_id: string
          unit_cost_tzs: number
          variance_qty: number | null
          variance_value_tzs: number
        }
        Insert: {
          count_id: string
          counted_qty: number
          created_at?: string
          expected_qty: number
          id?: string
          item_id: string
          unit_cost_tzs?: number
          variance_qty?: number | null
          variance_value_tzs?: number
        }
        Update: {
          count_id?: string
          counted_qty?: number
          created_at?: string
          expected_qty?: number
          id?: string
          item_id?: string
          unit_cost_tzs?: number
          variance_qty?: number | null
          variance_value_tzs?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_stock_count_items_count_id_fkey"
            columns: ["count_id"]
            isOneToOne: false
            referencedRelation: "pos_stock_counts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_stock_count_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "pos_menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_stock_counts: {
        Row: {
          casino_id: string
          count_type: string
          counted_by: string
          counted_by_name: string | null
          created_at: string
          id: string
          items_count: number
          notes: string | null
          shift_id: string | null
          total_variance_value_tzs: number
        }
        Insert: {
          casino_id: string
          count_type: string
          counted_by: string
          counted_by_name?: string | null
          created_at?: string
          id?: string
          items_count?: number
          notes?: string | null
          shift_id?: string | null
          total_variance_value_tzs?: number
        }
        Update: {
          casino_id?: string
          count_type?: string
          counted_by?: string
          counted_by_name?: string | null
          created_at?: string
          id?: string
          items_count?: number
          notes?: string | null
          shift_id?: string | null
          total_variance_value_tzs?: number
        }
        Relationships: [
          {
            foreignKeyName: "pos_stock_counts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      pos_tabs: {
        Row: {
          business_date: string | null
          casino_id: string
          closed_at: string | null
          closed_by_user_id: string | null
          comp_override_id: string | null
          created_at: string
          expense_id: string | null
          id: string
          opened_at: string
          opened_by_user_id: string
          payment_split: Json | null
          player_id: string | null
          player_name: string | null
          shift_id: string
          status: string
          total_tzs: number
          updated_at: string
          void_reason: string | null
          walkin_label: string | null
        }
        Insert: {
          business_date?: string | null
          casino_id: string
          closed_at?: string | null
          closed_by_user_id?: string | null
          comp_override_id?: string | null
          created_at?: string
          expense_id?: string | null
          id?: string
          opened_at?: string
          opened_by_user_id: string
          payment_split?: Json | null
          player_id?: string | null
          player_name?: string | null
          shift_id: string
          status?: string
          total_tzs?: number
          updated_at?: string
          void_reason?: string | null
          walkin_label?: string | null
        }
        Update: {
          business_date?: string | null
          casino_id?: string
          closed_at?: string | null
          closed_by_user_id?: string | null
          comp_override_id?: string | null
          created_at?: string
          expense_id?: string | null
          id?: string
          opened_at?: string
          opened_by_user_id?: string
          payment_split?: Json | null
          player_id?: string | null
          player_name?: string | null
          shift_id?: string
          status?: string
          total_tzs?: number
          updated_at?: string
          void_reason?: string | null
          walkin_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pos_tabs_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_tabs_comp_override_id_fkey"
            columns: ["comp_override_id"]
            isOneToOne: false
            referencedRelation: "pos_comp_budget_overrides"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_tabs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "pos_tabs_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pos_tabs_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "pos_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          casino_id: string
          created_at: string
          disabled_at: string | null
          disabled_by: string | null
          display_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          display_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          disabled_at?: string | null
          disabled_by?: string | null
          display_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_campaign_expenses: {
        Row: {
          amount_tzs: number
          campaign_id: string
          casino_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          spent_on: string
          vendor: string | null
        }
        Insert: {
          amount_tzs: number
          campaign_id: string
          casino_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          spent_on?: string
          vendor?: string | null
        }
        Update: {
          amount_tzs?: number
          campaign_id?: string
          casino_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          spent_on?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_campaign_expenses_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_campaign_players: {
        Row: {
          attributed_on: string
          campaign_id: string
          casino_id: string
          created_at: string
          created_by: string | null
          id: string
          note: string | null
          player_id: string
        }
        Insert: {
          attributed_on?: string
          campaign_id: string
          casino_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          player_id: string
        }
        Update: {
          attributed_on?: string
          campaign_id?: string
          casino_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          note?: string | null
          player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_campaign_players_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "promo_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_campaigns: {
        Row: {
          budget_tzs: number
          campaign_type: Database["public"]["Enums"]["promo_campaign_type"]
          casino_id: string
          created_at: string
          created_by: string | null
          description: string | null
          ends_on: string | null
          id: string
          name: string
          starts_on: string
          status: Database["public"]["Enums"]["promo_campaign_status"]
          updated_at: string
        }
        Insert: {
          budget_tzs?: number
          campaign_type?: Database["public"]["Enums"]["promo_campaign_type"]
          casino_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string | null
          id?: string
          name: string
          starts_on: string
          status?: Database["public"]["Enums"]["promo_campaign_status"]
          updated_at?: string
        }
        Update: {
          budget_tzs?: number
          campaign_type?: Database["public"]["Enums"]["promo_campaign_type"]
          casino_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_on?: string | null
          id?: string
          name?: string
          starts_on?: string
          status?: Database["public"]["Enums"]["promo_campaign_status"]
          updated_at?: string
        }
        Relationships: []
      }
      role_module_defaults: {
        Row: {
          can_view: boolean
          can_write: boolean
          day_horizon: Database["public"]["Enums"]["day_horizon"]
          module_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_view?: boolean
          can_write?: boolean
          day_horizon?: Database["public"]["Enums"]["day_horizon"]
          module_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_view?: boolean
          can_write?: boolean
          day_horizon?: Database["public"]["Enums"]["day_horizon"]
          module_key?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      rota_locks: {
        Row: {
          casino_id: string
          locked_at: string
          locked_by: string
          month: string
          scope: string
        }
        Insert: {
          casino_id: string
          locked_at?: string
          locked_by: string
          month: string
          scope: string
        }
        Update: {
          casino_id?: string
          locked_at?: string
          locked_by?: string
          month?: string
          scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "rota_locks_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          balance: number | null
          cash_desk_result: number | null
          cash_result: number | null
          casino_id: string
          closed_at: string | null
          closed_by: string | null
          closing_cash: Json | null
          closing_count: Json | null
          created_at: string
          exchange_rates: Json
          id: string
          miss_total: number | null
          notes: string | null
          opened_at: string
          opened_by: string
          opening_float: Json | null
          shift_result: number | null
          status: string
          tables_result: number | null
        }
        Insert: {
          balance?: number | null
          cash_desk_result?: number | null
          cash_result?: number | null
          casino_id: string
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: Json | null
          closing_count?: Json | null
          created_at?: string
          exchange_rates?: Json
          id?: string
          miss_total?: number | null
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_float?: Json | null
          shift_result?: number | null
          status?: string
          tables_result?: number | null
        }
        Update: {
          balance?: number | null
          cash_desk_result?: number | null
          cash_result?: number | null
          casino_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: Json | null
          closing_count?: Json | null
          created_at?: string
          exchange_rates?: Json
          id?: string
          miss_total?: number | null
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_float?: Json | null
          shift_result?: number | null
          status?: string
          tables_result?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_attendance: {
        Row: {
          casino_id: string
          created_at: string
          date: string
          employee_id: string
          id: string
          recorded_by: string
          updated_at: string
          value: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          date: string
          employee_id: string
          id?: string
          recorded_by: string
          updated_at?: string
          value?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          recorded_by?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_attendance_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_attendance_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_rota: {
        Row: {
          casino_id: string
          created_at: string
          created_by: string
          date: string
          employee_id: string
          id: string
          shift: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by: string
          date: string
          employee_id: string
          id?: string
          shift?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string
          date?: string
          employee_id?: string
          id?: string
          shift?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_rota_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_rota_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_warnings: {
        Row: {
          business_date: string
          casino_id: string
          comment: string
          created_at: string
          created_by: string | null
          employee_id: string
          id: string
          kind: string
          source_table: string
          updated_at: string
        }
        Insert: {
          business_date: string
          casino_id: string
          comment?: string
          created_at?: string
          created_by?: string | null
          employee_id: string
          id?: string
          kind: string
          source_table?: string
          updated_at?: string
        }
        Update: {
          business_date?: string
          casino_id?: string
          comment?: string
          created_at?: string
          created_by?: string | null
          employee_id?: string
          id?: string
          kind?: string
          source_table?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_warnings_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_warnings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_apply_errors: {
        Row: {
          attempts: number
          error_code: string
          error_text: string | null
          first_seen_at: string
          id: number
          last_seen_at: string
          op: string | null
          payload_hash: string | null
          peer_link_id: string | null
          peer_name: string | null
          pk: Json | null
          resolution: string | null
          resolved_at: string | null
          source_outbox_id: number | null
          table_name: string
        }
        Insert: {
          attempts?: number
          error_code: string
          error_text?: string | null
          first_seen_at?: string
          id?: number
          last_seen_at?: string
          op?: string | null
          payload_hash?: string | null
          peer_link_id?: string | null
          peer_name?: string | null
          pk?: Json | null
          resolution?: string | null
          resolved_at?: string | null
          source_outbox_id?: number | null
          table_name: string
        }
        Update: {
          attempts?: number
          error_code?: string
          error_text?: string | null
          first_seen_at?: string
          id?: number
          last_seen_at?: string
          op?: string | null
          payload_hash?: string | null
          peer_link_id?: string | null
          peer_name?: string | null
          pk?: Json | null
          resolution?: string | null
          resolved_at?: string | null
          source_outbox_id?: number | null
          table_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_apply_errors_peer_link_id_fkey"
            columns: ["peer_link_id"]
            isOneToOne: false
            referencedRelation: "peer_links"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_exchange_logs: {
        Row: {
          batch_id: string | null
          created_at: string
          direction: string
          error_text: string | null
          id: number
          meta: Json | null
          peer_link_id: string | null
          peer_name: string | null
          peer_node_id: string | null
          row_count: number | null
          status: string
          table_name: string | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          direction: string
          error_text?: string | null
          id?: number
          meta?: Json | null
          peer_link_id?: string | null
          peer_name?: string | null
          peer_node_id?: string | null
          row_count?: number | null
          status: string
          table_name?: string | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          direction?: string
          error_text?: string | null
          id?: number
          meta?: Json | null
          peer_link_id?: string | null
          peer_name?: string | null
          peer_node_id?: string | null
          row_count?: number | null
          status?: string
          table_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_exchange_logs_peer_link_id_fkey"
            columns: ["peer_link_id"]
            isOneToOne: false
            referencedRelation: "peer_links"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_inbox_log: {
        Row: {
          applied_at: string
          casino_id: string
          error: string | null
          id: number
          local_id: number
          op: string
          retry_count: number
          table_name: string
        }
        Insert: {
          applied_at?: string
          casino_id: string
          error?: string | null
          id?: number
          local_id: number
          op: string
          retry_count?: number
          table_name: string
        }
        Update: {
          applied_at?: string
          casino_id?: string
          error?: string | null
          id?: number
          local_id?: number
          op?: string
          retry_count?: number
          table_name?: string
        }
        Relationships: []
      }
      sync_outbox: {
        Row: {
          casino_id: string | null
          changed_at: string
          id: number
          op: string
          origin_node_id: string | null
          payload: Json | null
          pk: Json
          sync_role: string
          table_name: string
        }
        Insert: {
          casino_id?: string | null
          changed_at?: string
          id?: number
          op: string
          origin_node_id?: string | null
          payload?: Json | null
          pk: Json
          sync_role?: string
          table_name: string
        }
        Update: {
          casino_id?: string | null
          changed_at?: string
          id?: number
          op?: string
          origin_node_id?: string | null
          payload?: Json | null
          pk?: Json
          sync_role?: string
          table_name?: string
        }
        Relationships: []
      }
      sync_peer_health: {
        Row: {
          apply_errors_count: number
          last_apply_ok_at: string | null
          last_error_code: string | null
          last_error_text: string | null
          last_heartbeat_at: string | null
          last_probe_at: string | null
          last_probe_latency_ms: number | null
          last_pull_ok_at: string | null
          last_push_ok_at: string | null
          peer_link_id: string
          peer_name: string | null
          peer_node_id: string | null
          pending_outbox_count: number
          remote_lag_seconds: number | null
          schema_version_local: string | null
          schema_version_remote: string | null
          state: string
          updated_at: string
        }
        Insert: {
          apply_errors_count?: number
          last_apply_ok_at?: string | null
          last_error_code?: string | null
          last_error_text?: string | null
          last_heartbeat_at?: string | null
          last_probe_at?: string | null
          last_probe_latency_ms?: number | null
          last_pull_ok_at?: string | null
          last_push_ok_at?: string | null
          peer_link_id: string
          peer_name?: string | null
          peer_node_id?: string | null
          pending_outbox_count?: number
          remote_lag_seconds?: number | null
          schema_version_local?: string | null
          schema_version_remote?: string | null
          state?: string
          updated_at?: string
        }
        Update: {
          apply_errors_count?: number
          last_apply_ok_at?: string | null
          last_error_code?: string | null
          last_error_text?: string | null
          last_heartbeat_at?: string | null
          last_probe_at?: string | null
          last_probe_latency_ms?: number | null
          last_pull_ok_at?: string | null
          last_push_ok_at?: string | null
          peer_link_id?: string
          peer_name?: string | null
          peer_node_id?: string | null
          pending_outbox_count?: number
          remote_lag_seconds?: number | null
          schema_version_local?: string | null
          schema_version_remote?: string | null
          state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_peer_health_peer_link_id_fkey"
            columns: ["peer_link_id"]
            isOneToOne: true
            referencedRelation: "peer_links"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_probe_events: {
        Row: {
          ack_at: string | null
          direction: string
          error_text: string | null
          id: string
          latency_ms: number | null
          peer_link_id: string | null
          sent_at: string
          status: string
        }
        Insert: {
          ack_at?: string | null
          direction: string
          error_text?: string | null
          id?: string
          latency_ms?: number | null
          peer_link_id?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          ack_at?: string | null
          direction?: string
          error_text?: string | null
          id?: string
          latency_ms?: number | null
          peer_link_id?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_probe_events_peer_link_id_fkey"
            columns: ["peer_link_id"]
            isOneToOne: false
            referencedRelation: "peer_links"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_probes: {
        Row: {
          details: Json
          echoed_at: string | null
          id: string
          latency_ms: number | null
          origin_casino_id: string
          origin_slug: string
          received_back_at: string | null
          sent_at: string
          status: string
        }
        Insert: {
          details?: Json
          echoed_at?: string | null
          id?: string
          latency_ms?: number | null
          origin_casino_id: string
          origin_slug: string
          received_back_at?: string | null
          sent_at?: string
          status?: string
        }
        Update: {
          details?: Json
          echoed_at?: string | null
          id?: string
          latency_ms?: number | null
          origin_casino_id?: string
          origin_slug?: string
          received_back_at?: string | null
          sent_at?: string
          status?: string
        }
        Relationships: []
      }
      sync_seed_marker: {
        Row: {
          casino_id: string
          completed_at: string
          row_count: number
          table_name: string
        }
        Insert: {
          casino_id: string
          completed_at?: string
          row_count?: number
          table_name: string
        }
        Update: {
          casino_id?: string
          completed_at?: string
          row_count?: number
          table_name?: string
        }
        Relationships: []
      }
      sync_snapshot_state: {
        Row: {
          casino_id: string
          checksum: string | null
          imported_at: string
          snapshot_id: string | null
          source: string | null
          source_created_at: string | null
          table_counts: Json
        }
        Insert: {
          casino_id: string
          checksum?: string | null
          imported_at?: string
          snapshot_id?: string | null
          source?: string | null
          source_created_at?: string | null
          table_counts?: Json
        }
        Update: {
          casino_id?: string
          checksum?: string | null
          imported_at?: string
          snapshot_id?: string | null
          source?: string | null
          source_created_at?: string | null
          table_counts?: Json
        }
        Relationships: []
      }
      sync_table_registry: {
        Row: {
          critical: boolean
          date_column: string | null
          notes: string | null
          parity_required: boolean
          scope: string
          table_name: string
          updated_at: string
        }
        Insert: {
          critical?: boolean
          date_column?: string | null
          notes?: string | null
          parity_required?: boolean
          scope: string
          table_name: string
          updated_at?: string
        }
        Update: {
          critical?: boolean
          date_column?: string | null
          notes?: string | null
          parity_required?: boolean
          scope?: string
          table_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      system_locks: {
        Row: {
          casino_id: string
          created_at: string
          created_by: string | null
          id: string
          locked_until: string
          reason: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          locked_until: string
          reason: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          locked_until?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_locks_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      table_daily_results: {
        Row: {
          casino_id: string
          close: number
          confirmed: boolean
          created_at: string
          created_by: string | null
          credit: number
          date: string
          drop_amount: number
          fill: number
          id: string
          open: number
          result: number
          source: string
          table_id: string
          updated_at: string
        }
        Insert: {
          casino_id: string
          close?: number
          confirmed?: boolean
          created_at?: string
          created_by?: string | null
          credit?: number
          date: string
          drop_amount?: number
          fill?: number
          id?: string
          open?: number
          result?: number
          source?: string
          table_id: string
          updated_at?: string
        }
        Update: {
          casino_id?: string
          close?: number
          confirmed?: boolean
          created_at?: string
          created_by?: string | null
          credit?: number
          date?: string
          drop_amount?: number
          fill?: number
          id?: string
          open?: number
          result?: number
          source?: string
          table_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_daily_results_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_daily_results_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      table_tracker: {
        Row: {
          casino_id: string
          created_at: string
          date: string
          id: string
          recorded_by: string
          table_id: string
          time_slot: string
          value: number
        }
        Insert: {
          casino_id: string
          created_at?: string
          date: string
          id?: string
          recorded_by: string
          table_id: string
          time_slot: string
          value?: number
        }
        Update: {
          casino_id?: string
          created_at?: string
          date?: string
          id?: string
          recorded_by?: string
          table_id?: string
          time_slot?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "table_tracker_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_tracker_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_conflicts: {
        Row: {
          id: string
          tag_a: string
          tag_b: string
        }
        Insert: {
          id?: string
          tag_a: string
          tag_b: string
        }
        Update: {
          id?: string
          tag_a?: string
          tag_b?: string
        }
        Relationships: []
      }
      tax_brackets: {
        Row: {
          base_tax: number
          bracket_order: number
          created_at: string
          effective_from: string
          id: string
          lower_bound: number
          rate_pct: number
          upper_bound: number | null
        }
        Insert: {
          base_tax?: number
          bracket_order: number
          created_at?: string
          effective_from: string
          id?: string
          lower_bound: number
          rate_pct: number
          upper_bound?: number | null
        }
        Update: {
          base_tax?: number
          bracket_order?: number
          created_at?: string
          effective_from?: string
          id?: string
          lower_bound?: number
          rate_pct?: number
          upper_bound?: number | null
        }
        Relationships: []
      }
      transaction_cancellations: {
        Row: {
          amount: number
          business_date: string | null
          cancelled_at: string
          cancelled_by: string
          casino_id: string
          id: string
          player_id: string
          reason: string
          shift_id: string | null
          transaction_id: string
          tx_type: string
        }
        Insert: {
          amount: number
          business_date?: string | null
          cancelled_at?: string
          cancelled_by: string
          casino_id: string
          id?: string
          player_id: string
          reason: string
          shift_id?: string | null
          transaction_id: string
          tx_type: string
        }
        Update: {
          amount?: number
          business_date?: string | null
          cancelled_at?: string
          cancelled_by?: string
          casino_id?: string
          id?: string
          player_id?: string
          reason?: string
          shift_id?: string | null
          transaction_id?: string
          tx_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_cancellations_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_cancellations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "transaction_cancellations_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_cancellations_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_cancellations_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          business_date: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          casino_id: string
          chips: Json | null
          created_at: string
          id: string
          operator_id: string
          player_id: string
          shift_id: string | null
          table_id: string | null
          tips_recipient_employee_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          business_date?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          casino_id: string
          chips?: Json | null
          created_at?: string
          id?: string
          operator_id: string
          player_id: string
          shift_id?: string | null
          table_id?: string | null
          tips_recipient_employee_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          business_date?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          casino_id?: string
          chips?: Json | null
          created_at?: string
          id?: string
          operator_id?: string
          player_id?: string
          shift_id?: string | null
          table_id?: string | null
          tips_recipient_employee_id?: string | null
          type?: Database["public"]["Enums"]["transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "transactions_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "transactions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_tips_recipient_employee_id_fkey"
            columns: ["tips_recipient_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      update_commands: {
        Row: {
          acknowledged_at: string | null
          applied_at: string | null
          auto_apply: boolean
          casino_id: string
          id: string
          issued_at: string
          issued_by: string
          status: string
          status_message: string | null
          target_version: string
        }
        Insert: {
          acknowledged_at?: string | null
          applied_at?: string | null
          auto_apply?: boolean
          casino_id: string
          id?: string
          issued_at?: string
          issued_by: string
          status?: string
          status_message?: string | null
          target_version: string
        }
        Update: {
          acknowledged_at?: string | null
          applied_at?: string | null
          auto_apply?: boolean
          casino_id?: string
          id?: string
          issued_at?: string
          issued_by?: string
          status?: string
          status_message?: string | null
          target_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "update_commands_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_casino_access: {
        Row: {
          casino_id: string
          granted_at: string
          granted_by: string
          id: string
          user_id: string
        }
        Insert: {
          casino_id: string
          granted_at?: string
          granted_by: string
          id?: string
          user_id: string
        }
        Update: {
          casino_id?: string
          granted_at?: string
          granted_by?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_casino_access_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_credentials: {
        Row: {
          id: string
          pin_hash: string | null
          rfid_tag: string | null
          user_id: string
        }
        Insert: {
          id?: string
          pin_hash?: string | null
          rfid_tag?: string | null
          user_id: string
        }
        Update: {
          id?: string
          pin_hash?: string | null
          rfid_tag?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_module_permissions: {
        Row: {
          can_view: boolean
          can_write: boolean | null
          created_at: string
          day_horizon: Database["public"]["Enums"]["day_horizon"] | null
          granted_by: string | null
          id: string
          module_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_view?: boolean
          can_write?: boolean | null
          created_at?: string
          day_horizon?: Database["public"]["Enums"]["day_horizon"] | null
          granted_by?: string | null
          id?: string
          module_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_view?: boolean
          can_write?: boolean | null
          created_at?: string
          day_horizon?: Database["public"]["Enums"]["day_horizon"] | null
          granted_by?: string | null
          id?: string
          module_key?: string
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
      wallet_transactions: {
        Row: {
          amount: number
          business_date: string | null
          casino_id: string
          created_at: string
          description: string
          expense_category:
            | Database["public"]["Enums"]["office_expense_category"]
            | null
          from_wallet: Database["public"]["Enums"]["wallet_type"] | null
          id: string
          operator_id: string
          to_wallet: Database["public"]["Enums"]["wallet_type"] | null
          tx_type: Database["public"]["Enums"]["wallet_tx_type"]
        }
        Insert: {
          amount: number
          business_date?: string | null
          casino_id: string
          created_at?: string
          description?: string
          expense_category?:
            | Database["public"]["Enums"]["office_expense_category"]
            | null
          from_wallet?: Database["public"]["Enums"]["wallet_type"] | null
          id?: string
          operator_id: string
          to_wallet?: Database["public"]["Enums"]["wallet_type"] | null
          tx_type: Database["public"]["Enums"]["wallet_tx_type"]
        }
        Update: {
          amount?: number
          business_date?: string | null
          casino_id?: string
          created_at?: string
          description?: string
          expense_category?:
            | Database["public"]["Enums"]["office_expense_category"]
            | null
          from_wallet?: Database["public"]["Enums"]["wallet_type"] | null
          id?: string
          operator_id?: string
          to_wallet?: Database["public"]["Enums"]["wallet_type"] | null
          tx_type?: Database["public"]["Enums"]["wallet_tx_type"]
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_bonus_entries: {
        Row: {
          bonus_points: number
          casino_id: string
          created_at: string
          employee_id: string
          extra_override: number | null
          id: string
          updated_at: string
          week_start: string
        }
        Insert: {
          bonus_points?: number
          casino_id: string
          created_at?: string
          employee_id: string
          extra_override?: number | null
          id?: string
          updated_at?: string
          week_start: string
        }
        Update: {
          bonus_points?: number
          casino_id?: string
          created_at?: string
          employee_id?: string
          extra_override?: number | null
          id?: string
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_bonus_entries_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_bonus_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_bonus_pools: {
        Row: {
          calculated_at: string | null
          calculated_by: string | null
          casino_id: string
          created_at: string
          currency: string
          id: string
          is_calculated: boolean
          pool_amount: number
          updated_at: string
          week_start: string
        }
        Insert: {
          calculated_at?: string | null
          calculated_by?: string | null
          casino_id: string
          created_at?: string
          currency?: string
          id?: string
          is_calculated?: boolean
          pool_amount?: number
          updated_at?: string
          week_start: string
        }
        Update: {
          calculated_at?: string | null
          calculated_by?: string | null
          casino_id?: string
          created_at?: string
          currency?: string
          id?: string
          is_calculated?: boolean
          pool_amount?: number
          updated_at?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_bonus_pools_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      chip_conservation_status: {
        Row: {
          archived_miss: number | null
          casino_id: string | null
          denomination: number | null
          in_locations: number | null
          initial_quantity: number | null
          live_floor: number | null
        }
        Insert: {
          archived_miss?: never
          casino_id?: string | null
          denomination?: number | null
          in_locations?: never
          initial_quantity?: number | null
          live_floor?: never
        }
        Update: {
          archived_miss?: never
          casino_id?: string | null
          denomination?: number | null
          in_locations?: never
          initial_quantity?: number | null
          live_floor?: never
        }
        Relationships: [
          {
            foreignKeyName: "chip_initial_baseline_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_job_health: {
        Row: {
          age: string | null
          is_unhealthy: boolean | null
          job_name: string | null
          last_details: Json | null
          last_duration_ms: number | null
          last_run_at: string | null
          last_status: string | null
        }
        Relationships: []
      }
      cron_recent_runs: {
        Row: {
          end_time: string | null
          jobname: string | null
          return_message: string | null
          start_time: string | null
          status: string | null
        }
        Relationships: []
      }
      payroll_bank_export_v: {
        Row: {
          account_number: string | null
          amount: number | null
          bank_code: string | null
          branch_code: string | null
          casino_id: string | null
          employee_id: string | null
          id: string | null
          name: string | null
          period_id: string | null
          warning: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_entries_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "payroll_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      player_economy: {
        Row: {
          casino_id: string | null
          first_name: string | null
          last_name: string | null
          nickname: string | null
          player_id: string | null
          real_result: number | null
          result: number | null
          status: Database["public"]["Enums"]["player_status"] | null
          total: number | null
          total_cashout: number | null
          total_drop: number | null
          total_drop_r: number | null
          total_drop_recycled: number | null
          total_expenses: number | null
        }
        Relationships: [
          {
            foreignKeyName: "players_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      player_session_drops: {
        Row: {
          casino_id: string | null
          drop_v: number | null
          player_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "client_sessions_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "client_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      player_session_stats: {
        Row: {
          bet_sum_by_avg: number | null
          casino_id: string | null
          first_session_at: string | null
          hands: number | null
          last_session_at: string | null
          minutes: number | null
          player_id: string | null
          session_count: number | null
          table_id: string | null
          total_bet_sum: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_sessions_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "player_economy"
            referencedColumns: ["player_id"]
          },
          {
            foreignKeyName: "client_sessions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_sessions_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "gaming_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions_total_bet_sum: {
        Row: {
          business_date: string | null
          casino_id: string | null
          total_bet: number | null
        }
        Relationships: [
          {
            foreignKeyName: "client_sessions_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_outbox_pending: {
        Row: {
          casino_id: string | null
          oldest_change_at: string | null
          oldest_minutes: number | null
          pending_count: number | null
          table_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _close_open_position: {
        Args: { _at: string; _casino_id: string; _player_id: string }
        Returns: undefined
      }
      activity_logs_purge: { Args: { p_days?: number }; Returns: number }
      apply_cage_shift_closing: { Args: { _shift_id: string }; Returns: Json }
      approve_expense_as_manager: {
        Args: { p_expense_id: string; p_manager_id: string }
        Returns: undefined
      }
      auto_close_business_day: { Args: never; Returns: Json }
      auto_close_forgotten_business_days: { Args: never; Returns: undefined }
      build_business_day_snapshot: {
        Args: { _business_date: string; _casino_id: string }
        Returns: Json
      }
      business_date_of: { Args: { _ts: string }; Returns: string }
      cancel_transaction: {
        Args: { p_reason: string; p_transaction_id: string }
        Returns: undefined
      }
      cleanup_old_data: { Args: never; Returns: Json }
      clear_stale_peer_links: { Args: never; Returns: number }
      clear_stale_peer_requests: { Args: never; Returns: number }
      clone_arusha_to_mbeya_demo: { Args: never; Returns: Json }
      close_business_day: {
        Args: {
          _casino_id: string
          _force_close_cycles?: boolean
          _method: string
        }
        Returns: Json
      }
      close_open_sessions_5am: { Args: never; Returns: Json }
      compute_cage_slots_balance: {
        Args: { p_shift_id: string }
        Returns: Json
      }
      compute_paye_for_amount: {
        Args: { _amount: number; _at: string }
        Returns: number
      }
      compute_player_drop_split: {
        Args: { _from?: string; _player_id: string; _to?: string }
        Returns: {
          drop_r: number
          drop_recycled: number
        }[]
      }
      compute_players_drop_split: {
        Args: { _casino_id: string; _from: string; _to: string }
        Returns: {
          drop_r: number
          drop_recycled: number
          player_id: string
        }[]
      }
      compute_shift_balance: { Args: { _shift_id: string }; Returns: Json }
      compute_shift_balance_from_row: {
        Args: { s: Database["public"]["Tables"]["shifts"]["Row"] }
        Returns: Json
      }
      compute_shift_close: { Args: { p_shift_id: string }; Returns: Json }
      compute_shift_table_results: {
        Args: { p_shift_id: string }
        Returns: {
          result: number
          table_id: string
        }[]
      }
      compute_shift_tables_result_total: {
        Args: { p_shift_id: string }
        Returns: number
      }
      compute_slots_shift_balance: {
        Args: { _shift_id: string }
        Returns: Json
      }
      compute_slots_shift_balance_from_row: {
        Args: { s: Database["public"]["Tables"]["cage_slots_shifts"]["Row"] }
        Returns: Json
      }
      compute_tables_drop_split: {
        Args: { _casino_id: string; _from: string; _to: string }
        Returns: {
          drop_r: number
          drop_recycled: number
          table_id: string
        }[]
      }
      create_chip_transfer_pair: {
        Args: {
          _amount: number
          _chips?: Json
          _from_player: string
          _note?: string
          _table_id?: string
          _to_player: string
        }
        Returns: Json
      }
      create_office_expense: {
        Args: {
          p_amount: number
          p_casino_id: string
          p_category_code: string
          p_description: string
        }
        Returns: string
      }
      crm_players_list: {
        Args: { _casino: string }
        Returns: {
          birth_date: string
          birthday_card_sent_year: number
          card_number: string
          category: Database["public"]["Enums"]["player_category"]
          created_at: string
          custom_tags: string[]
          first_name: string
          host_name: string
          host_user_id: string
          last_contact_at: string
          last_contact_note: string
          last_name: string
          last_visit: string
          nickname: string
          phone: string
          photo_url: string
          player_id: string
          segment: Database["public"]["Enums"]["player_crm_segment"]
          segment_locked: boolean
          status: Database["public"]["Enums"]["player_status"]
          visits_90d: number
          visits_total: number
        }[]
      }
      cron_health_overview: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          last_run_start: string
          last_runtime_ms: number
          last_status: string
          schedule: string
          total_failures_24h: number
        }[]
      }
      cs_can_approve: { Args: { _casino: string }; Returns: boolean }
      cs_can_view: { Args: { _casino: string }; Returns: boolean }
      cs_can_write: { Args: { _casino: string }; Returns: boolean }
      cutover_begin: {
        Args: { p_casino: string; p_target_node: string }
        Returns: string
      }
      cutover_freeze_cloud: { Args: { p_casino: string }; Returns: number }
      cutover_promote_local: { Args: { p_casino: string }; Returns: undefined }
      cutover_rollback: { Args: { p_session: string }; Returns: undefined }
      cutover_set_state: {
        Args: { p_notes?: string; p_session: string; p_state: string }
        Returns: undefined
      }
      demote_to_cloud_primary: { Args: { p_casino_id: string }; Returns: Json }
      edit_business_day_snapshot: {
        Args: { _closure_id: string; _patches: Json; _section: string }
        Returns: Json
      }
      effective_module_perms: {
        Args: { p_user_id: string }
        Returns: {
          can_view: boolean
          can_write: boolean
          day_horizon: Database["public"]["Enums"]["day_horizon"]
          module_key: string
        }[]
      }
      employee_roles_at: {
        Args: { _casino_id: string; _on_date: string }
        Returns: {
          dealer_category: string
          department: string
          employee_id: string
          is_pit_boss: boolean
          job_position: string
        }[]
      }
      export_full_schema_ddl: { Args: never; Returns: string }
      finalize_open_cycles_for_close: {
        Args: { _casino_id: string; _user: string }
        Returns: Json
      }
      finalize_player_daily_avg_bets: {
        Args: { p_business_date: string; p_casino_id: string }
        Returns: number
      }
      gc_pending_server_registrations: { Args: never; Returns: undefined }
      generate_card_number: { Args: never; Returns: string }
      get_business_date_for_casino: {
        Args: { _casino_id: string }
        Returns: string
      }
      get_current_business_date: {
        Args: { _casino_id: string }
        Returns: string
      }
      get_effective_shift_settings: {
        Args: { _casino_id: string }
        Returns: {
          breaklist_lock: string
          shift_end: string
        }[]
      }
      get_expected_chips:
        | {
            Args: {
              _casino_id: string
              _denomination: number
              _location_id: string
              _location_type: string
            }
            Returns: number
          }
        | {
            Args: {
              _casino_id: string
              _denomination: number
              _location_id: string
              _location_type: string
            }
            Returns: number
          }
      get_monthly_attendance: {
        Args: { p_casino_id: string; p_month: string }
        Returns: {
          auto_hours: number
          d: string
          dealer_category: string
          department: string
          effective_hours: number
          employee_id: string
          full_name: string
          holiday_multiplier: number
          is_holiday: boolean
          is_pit_boss: boolean
          job_position: string
          manual_hours: number
          photo_url: string
          raw_value: string
        }[]
      }
      get_user_casino_id: { Args: { _user_id: string }; Returns: string }
      has_any_pos_role: { Args: { _user: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_manager_op: { Args: { _uid: string }; Returns: boolean }
      is_super_admin: { Args: { _uid: string }; Returns: boolean }
      list_open_cycles_for_day: { Args: { _casino_id: string }; Returns: Json }
      local_servers_overview: {
        Args: never
        Returns: {
          casino_id: string
          containers_running: number
          containers_total: number
          current_version: string
          disk_used_pct: number
          health_updated_at: string
          id: string
          is_online: boolean
          last_sync_at: string
          minutes_since_sync: number
          server_ip: string
          server_name: string
          uptime_seconds: number
        }[]
      }
      lookup_rfid_user: {
        Args: { rfid: string }
        Returns: {
          casino_id: string
          display_name: string
          user_id: string
        }[]
      }
      mirror_freeze_writes: { Args: { p_casino_id: string }; Returns: Json }
      mirror_full_parity_snapshot: {
        Args: { p_casino_id: string }
        Returns: {
          critical: boolean
          ids_checksum: string
          max_change_ts: string
          row_count: number
          rows_checksum: string
          scope: string
          table_name: string
        }[]
      }
      mirror_parity_snapshot: {
        Args: { p_casino_id: string }
        Returns: {
          max_updated_at: string
          row_count: number
          table_name: string
        }[]
      }
      mirror_record_parity: {
        Args: { p_casino_id: string; p_ok: boolean; p_summary: Json }
        Returns: undefined
      }
      mirror_unfreeze_writes: { Args: { p_casino_id: string }; Returns: Json }
      payroll_approve_hr: { Args: { _period_id: string }; Returns: undefined }
      payroll_approve_manager: {
        Args: { _period_id: string }
        Returns: undefined
      }
      payroll_create_period: {
        Args: { _casino_id?: string; _month: number; _year: number }
        Returns: string
      }
      payroll_duplicate_period: {
        Args: { _month: number; _source_period_id: string; _year: number }
        Returns: string
      }
      payroll_mark_paid: { Args: { _period_id: string }; Returns: undefined }
      payroll_refresh_period: { Args: { _period_id: string }; Returns: Json }
      payroll_revert_to_draft: {
        Args: { _period_id: string; _reason?: string }
        Returns: undefined
      }
      payroll_unlock_period: {
        Args: { _period_id: string; _reason: string }
        Returns: undefined
      }
      peer_apply_change: {
        Args: {
          p_changed_at: string
          p_op: string
          p_origin_node_id: string
          p_payload: Json
          p_pk: Json
          p_table: string
        }
        Returns: undefined
      }
      player_active_visit_casino: {
        Args: { _player_id: string }
        Returns: {
          casino_id: string
          casino_name: string
          checked_in_at: string
        }[]
      }
      player_drop_split_lifetime: {
        Args: { _player_id: string }
        Returns: {
          drop_r: number
          drop_recycled: number
        }[]
      }
      player_segment_recalc: { Args: { _casino: string }; Returns: number }
      populate_table_daily_results_for_day: {
        Args: { _business_date: string; _casino_id: string; _user: string }
        Returns: number
      }
      pos_close_shift: {
        Args: { _closing_cash: number; _shift_id: string }
        Returns: Json
      }
      pos_comp_budget_status: {
        Args: { _casino_id: string; _month_start?: string }
        Returns: Json
      }
      pos_compute_z_report: { Args: { _shift_id: string }; Returns: Json }
      pos_create_purchase: { Args: { _payload: Json }; Returns: string }
      pos_handover_shift: {
        Args: {
          _closing_cash: number
          _closing_shift_id: string
          _new_shift_type: string
          _new_waiter_user_id: string
        }
        Returns: Json
      }
      pos_save_stock_count: {
        Args: {
          _count_type: string
          _items: Json
          _notes?: string
          _shift_id: string
        }
        Returns: string
      }
      pos_shift_reconciliation: {
        Args: { _casino_id: string; _from: string; _to: string }
        Returns: {
          business_date: string
          card_tzs: number
          cash_delta: number
          cash_tzs: number
          closed_at: string
          closing_cash: number
          comp_house_tzs: number
          comp_player_tzs: number
          expected_cash: number
          gross_tzs: number
          opened_at: string
          opening_cash: number
          outstanding_charges_tzs: number
          overrides_count: number
          shift_id: string
          shift_type: string
          status: string
          stock_variance_tzs: number
          waiter_name: string
          waiter_user_id: string
        }[]
      }
      pos_suggested_price: { Args: { _item_id: string }; Returns: number }
      pos_tabs_recompute_total: {
        Args: { _tab_id: string }
        Returns: undefined
      }
      promo_campaign_kpi: { Args: { _campaign_id: string }; Returns: Json }
      promote_to_local_primary: {
        Args: { p_casino_id: string; p_force?: boolean }
        Returns: Json
      }
      purge_endpoint_health_checks: { Args: never; Returns: undefined }
      purge_mbeya_demo: { Args: never; Returns: Json }
      recalc_shift_tables_result: {
        Args: { p_shift_id: string }
        Returns: number
      }
      refresh_chip_initial_baseline: {
        Args: { _casino_id: string }
        Returns: undefined
      }
      reimport_staff_master: { Args: { p_casino_id: string }; Returns: Json }
      reopen_shift: {
        Args: { _reason?: string; _shift_id: string }
        Returns: Json
      }
      replication_readiness: { Args: { p_casino_id: string }; Returns: Json }
      reset_operational_dashboards: {
        Args: { _casino_id: string }
        Returns: Json
      }
      rotate_local_server_secret: {
        Args: { _server_id: string }
        Returns: string
      }
      seed_export_auth_users: {
        Args: { p_casino_id: string }
        Returns: {
          aud: string
          created_at: string
          email: string
          email_confirmed_at: string
          encrypted_password: string
          id: string
          phone: string
          raw_app_meta_data: Json
          raw_user_meta_data: Json
          role: string
        }[]
      }
      set_player_category: {
        Args: { _category: string; _player_id: string }
        Returns: undefined
      }
      shift_miss_total_from_closing_count: {
        Args: { _closing_count: Json }
        Returns: number
      }
      staff_rota_scope: { Args: { _employee_id: string }; Returns: string }
      sync_apply_remote: {
        Args: {
          p_casino_id: string
          p_local_id: number
          p_op: string
          p_payload: Json
          p_pk: Json
          p_table: string
        }
        Returns: Json
      }
      sync_attach: { Args: { p_table: unknown }; Returns: undefined }
      sync_diagnostics_gc: { Args: never; Returns: undefined }
      sync_exchange_logs_gc: { Args: never; Returns: undefined }
      sync_inbox_health: {
        Args: never
        Returns: {
          casino_id: string
          errors_24h: number
          last_applied_at: string
          oldest_error_at: string
          total_24h: number
        }[]
      }
      sync_outbox_gc: { Args: never; Returns: undefined }
      sync_outbox_health: {
        Args: never
        Returns: {
          casino_id: string
          failed_count: number
          oldest_pending_at: string
          pending_count: number
        }[]
      }
      sync_outbox_per_table: {
        Args: never
        Returns: {
          casino_id: string
          oldest_change_at: string
          oldest_minutes: number
          pending_count: number
          table_name: string
        }[]
      }
      sync_promote_server: { Args: { p_server_id: string }; Returns: undefined }
      sync_record_apply_error: {
        Args: {
          p_error_code: string
          p_error_text: string
          p_op: string
          p_payload_hash: string
          p_peer_link_id: string
          p_pk: Json
          p_source_outbox_id: number
          p_table: string
        }
        Returns: number
      }
      sync_record_apply_ok: {
        Args: { p_peer_link_id: string }
        Returns: undefined
      }
      sync_record_health: {
        Args: {
          p_heartbeat_at?: string
          p_last_error_code?: string
          p_last_error_text?: string
          p_peer_link_id: string
          p_pending_outbox?: number
          p_remote_lag_seconds?: number
          p_schema_version_local?: string
          p_schema_version_remote?: string
          p_state: string
        }
        Returns: undefined
      }
      sync_record_probe_ack: {
        Args: { p_error_text?: string; p_probe_id: string; p_status?: string }
        Returns: undefined
      }
      sync_record_probe_sent: {
        Args: { p_direction?: string; p_peer_link_id: string }
        Returns: string
      }
      sync_record_pull_ok: {
        Args: { p_peer_link_id: string }
        Returns: undefined
      }
      sync_record_push_ok: {
        Args: { p_peer_link_id: string }
        Returns: undefined
      }
      sync_record_snapshot: {
        Args: {
          p_casino_id: string
          p_checksum: string
          p_snapshot_id: string
          p_source: string
          p_source_created_at: string
          p_table_counts: Json
        }
        Returns: undefined
      }
      sync_reset_outbox: {
        Args: { p_advance_cursors?: boolean; p_casino_id: string }
        Returns: Json
      }
      sync_resolve_apply_error: {
        Args: { p_id: number; p_resolution: string }
        Returns: undefined
      }
      sync_role_for_table: { Args: { p_table: string }; Returns: string }
      sync_roundtrip_probe: {
        Args: { p_origin_casino_id: string; p_origin_slug: string }
        Returns: string
      }
      sync_seed_from_existing: {
        Args: { p_casino_id: string }
        Returns: {
          inserted_count: number
          table_name: string
        }[]
      }
      sync_wipe_casino_data: {
        Args: { p_casino_id: string; p_confirm_slug: string }
        Returns: Json
      }
      update_user_roles: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: undefined
      }
      user_can_see_casino: {
        Args: { _casino: string; _user: string }
        Returns: boolean
      }
      user_has_casino_access: {
        Args: { _casino_id: string; _user_id: string }
        Returns: boolean
      }
      validate_chip_consistency: {
        Args: { _casino_id: string }
        Returns: {
          difference: number
          status: string
          total_actual: number
          total_expected: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "cashier"
        | "pit"
        | "manager"
        | "reception"
        | "finance_manager"
        | "surveillance"
        | "super_admin"
        | "hr"
        | "floor_manager"
        | "cashier_slots"
        | "pos_waiter"
        | "pos_bartender"
        | "pos_manager"
      cage_slots_comment_type:
        | "cashier_note"
        | "manager_comment"
        | "reversal_reason"
      cage_slots_count_type: "opening" | "check" | "closing"
      cage_slots_inventory_type: "opening" | "closing"
      cage_slots_shift_type: "day" | "night"
      cage_slots_status:
        | "draft"
        | "open"
        | "ready_for_review"
        | "approved"
        | "closed"
        | "reversed"
      card_type: "manual" | "rfid"
      casino_server_role: "primary" | "replica"
      day_horizon: "today" | "7d" | "30d" | "all"
      dealer_category:
        | "trainee"
        | "dealer"
        | "inspector"
        | "expert"
        | "pit_boss"
      dealer_role:
        | "BJ"
        | "BJi"
        | "AR1"
        | "AR1i"
        | "AR1c"
        | "BR"
        | "P"
        | "Pi"
        | "AR"
        | "ARi"
        | "ARc"
        | "S"
        | "TR"
        | "SRT"
        | "CLS"
        | "LT"
      expense_category:
        | "food"
        | "alcohol"
        | "taxi"
        | "hotel"
        | "flight"
        | "other"
        | "pos_comp"
        | "bar_charge"
      log_category:
        | "transaction"
        | "edit"
        | "lock"
        | "expense"
        | "player"
        | "system"
        | "breaklist"
        | "pit"
      office_expense_category:
        | "salary"
        | "bonus"
        | "fuel"
        | "transport"
        | "repairs"
        | "internet_it"
        | "security_expense"
        | "cleaning"
        | "rent"
        | "utilities"
        | "office"
        | "gaming_tax"
        | "fixed_tax"
        | "license"
        | "visa"
        | "machines"
        | "parts"
        | "debts"
        | "adjustments"
        | "other_office"
      player_category: "diamond" | "platinum" | "gold" | "normal"
      player_crm_segment: "vip" | "regular" | "new" | "dormant" | "custom"
      player_status: "active" | "blacklist"
      player_type: "slots" | "table" | "mix"
      pos_order_status: "pending" | "preparing" | "ready" | "served" | "void"
      pos_payment_mode: "cash" | "card" | "comp_player" | "comp_house"
      promo_campaign_status: "planned" | "active" | "completed" | "cancelled"
      promo_campaign_type:
        | "event"
        | "bonus"
        | "advertising"
        | "sponsorship"
        | "other"
      shift_type: "M" | "N" | "A" | "S" | "E" | "L"
      staff_department:
        | "security"
        | "cashier"
        | "bartender"
        | "hostess"
        | "waiter"
        | "cleaner"
        | "it"
        | "hr"
        | "driver"
        | "reception"
      table_status: "open" | "closed"
      transaction_type:
        | "buy"
        | "cashout"
        | "in"
        | "out"
        | "tips_live"
        | "tips_poker"
        | "tips_floor"
      wallet_tx_type:
        | "transfer"
        | "allocate_reserve"
        | "use_reserve"
        | "manual_expense"
        | "daily_result"
        | "initial_balance"
        | "collection"
        | "adjustment"
        | "external_income"
        | "pos_deposit"
      wallet_type:
        | "main_cash"
        | "office_safe"
        | "rent_reserve"
        | "license_reserve"
        | "tax_reserve"
        | "other_reserve"
        | "cage_slot"
        | "cage_table"
        | "mobile_money"
        | "bank_account"
        | "bar_cash"
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
      app_role: [
        "cashier",
        "pit",
        "manager",
        "reception",
        "finance_manager",
        "surveillance",
        "super_admin",
        "hr",
        "floor_manager",
        "cashier_slots",
        "pos_waiter",
        "pos_bartender",
        "pos_manager",
      ],
      cage_slots_comment_type: [
        "cashier_note",
        "manager_comment",
        "reversal_reason",
      ],
      cage_slots_count_type: ["opening", "check", "closing"],
      cage_slots_inventory_type: ["opening", "closing"],
      cage_slots_shift_type: ["day", "night"],
      cage_slots_status: [
        "draft",
        "open",
        "ready_for_review",
        "approved",
        "closed",
        "reversed",
      ],
      card_type: ["manual", "rfid"],
      casino_server_role: ["primary", "replica"],
      day_horizon: ["today", "7d", "30d", "all"],
      dealer_category: ["trainee", "dealer", "inspector", "expert", "pit_boss"],
      dealer_role: [
        "BJ",
        "BJi",
        "AR1",
        "AR1i",
        "AR1c",
        "BR",
        "P",
        "Pi",
        "AR",
        "ARi",
        "ARc",
        "S",
        "TR",
        "SRT",
        "CLS",
        "LT",
      ],
      expense_category: [
        "food",
        "alcohol",
        "taxi",
        "hotel",
        "flight",
        "other",
        "pos_comp",
        "bar_charge",
      ],
      log_category: [
        "transaction",
        "edit",
        "lock",
        "expense",
        "player",
        "system",
        "breaklist",
        "pit",
      ],
      office_expense_category: [
        "salary",
        "bonus",
        "fuel",
        "transport",
        "repairs",
        "internet_it",
        "security_expense",
        "cleaning",
        "rent",
        "utilities",
        "office",
        "gaming_tax",
        "fixed_tax",
        "license",
        "visa",
        "machines",
        "parts",
        "debts",
        "adjustments",
        "other_office",
      ],
      player_category: ["diamond", "platinum", "gold", "normal"],
      player_crm_segment: ["vip", "regular", "new", "dormant", "custom"],
      player_status: ["active", "blacklist"],
      player_type: ["slots", "table", "mix"],
      pos_order_status: ["pending", "preparing", "ready", "served", "void"],
      pos_payment_mode: ["cash", "card", "comp_player", "comp_house"],
      promo_campaign_status: ["planned", "active", "completed", "cancelled"],
      promo_campaign_type: [
        "event",
        "bonus",
        "advertising",
        "sponsorship",
        "other",
      ],
      shift_type: ["M", "N", "A", "S", "E", "L"],
      staff_department: [
        "security",
        "cashier",
        "bartender",
        "hostess",
        "waiter",
        "cleaner",
        "it",
        "hr",
        "driver",
        "reception",
      ],
      table_status: ["open", "closed"],
      transaction_type: [
        "buy",
        "cashout",
        "in",
        "out",
        "tips_live",
        "tips_poker",
        "tips_floor",
      ],
      wallet_tx_type: [
        "transfer",
        "allocate_reserve",
        "use_reserve",
        "manual_expense",
        "daily_result",
        "initial_balance",
        "collection",
        "adjustment",
        "external_income",
        "pos_deposit",
      ],
      wallet_type: [
        "main_cash",
        "office_safe",
        "rent_reserve",
        "license_reserve",
        "tax_reserve",
        "other_reserve",
        "cage_slot",
        "cage_table",
        "mobile_money",
        "bank_account",
        "bar_cash",
      ],
    },
  },
} as const
