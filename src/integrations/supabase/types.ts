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
      breaklist: {
        Row: {
          casino_id: string
          created_at: string
          created_by: string
          date: string
          dealer_id: string
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
          dealer_id: string
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
          dealer_id?: string
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
            foreignKeyName: "breaklist_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
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
            foreignKeyName: "breaklist_logs_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
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
      casinos: {
        Row: {
          breaklist_lock: string
          cage_float: number
          code: string
          created_at: string
          float_locked: boolean
          id: string
          name: string
          shift_end: string
          shift_start: string
          slug: string | null
          tables_open: string
          timezone: string
        }
        Insert: {
          breaklist_lock?: string
          cage_float?: number
          code: string
          created_at?: string
          float_locked?: boolean
          id?: string
          name: string
          shift_end?: string
          shift_start?: string
          slug?: string | null
          tables_open?: string
          timezone?: string
        }
        Update: {
          breaklist_lock?: string
          cage_float?: number
          code?: string
          created_at?: string
          float_locked?: boolean
          id?: string
          name?: string
          shift_end?: string
          shift_start?: string
          slug?: string | null
          tables_open?: string
          timezone?: string
        }
        Relationships: []
      }
      cctv_observations: {
        Row: {
          casino_id: string
          content: string
          created_at: string
          id: string
          observation_type: string
          observer_id: string
          shift_id: string | null
        }
        Insert: {
          casino_id: string
          content: string
          created_at?: string
          id?: string
          observation_type?: string
          observer_id: string
          shift_id?: string | null
        }
        Update: {
          casino_id?: string
          content?: string
          created_at?: string
          id?: string
          observation_type?: string
          observer_id?: string
          shift_id?: string | null
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
            foreignKeyName: "cctv_observations_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
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
          dealer_id: string
          id: string
          recorded_by: string
          updated_at: string
          value: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          date: string
          dealer_id: string
          id?: string
          recorded_by: string
          updated_at?: string
          value?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          date?: string
          dealer_id?: string
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
            foreignKeyName: "dealer_attendance_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
        ]
      }
      dealers: {
        Row: {
          casino_id: string
          category: Database["public"]["Enums"]["dealer_category"]
          contract_end: string | null
          contract_start: string | null
          created_at: string
          id: string
          is_active: boolean
          is_pit_boss: boolean
          name: string
          onboarding_date: string | null
          salary: number | null
        }
        Insert: {
          casino_id: string
          category?: Database["public"]["Enums"]["dealer_category"]
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_pit_boss?: boolean
          name: string
          onboarding_date?: string | null
          salary?: number | null
        }
        Update: {
          casino_id?: string
          category?: Database["public"]["Enums"]["dealer_category"]
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_pit_boss?: boolean
          name?: string
          onboarding_date?: string | null
          salary?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dealers_casino_id_fkey"
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
          casino_id: string
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          description: string
          id: string
          player_id: string | null
          shift_id: string | null
        }
        Insert: {
          amount: number
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          casino_id: string
          category: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by: string
          description?: string
          id?: string
          player_id?: string | null
          shift_id?: string | null
        }
        Update: {
          amount?: number
          approved?: boolean
          approved_at?: string | null
          approved_by?: string | null
          casino_id?: string
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string
          description?: string
          id?: string
          player_id?: string | null
          shift_id?: string | null
        }
        Relationships: [
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
      local_servers: {
        Row: {
          casino_id: string
          id: string
          is_online: boolean
          last_sync_at: string | null
          linked_at: string
          linked_by: string
          server_ip: string
          server_name: string
          sync_secret: string
        }
        Insert: {
          casino_id: string
          id?: string
          is_online?: boolean
          last_sync_at?: string | null
          linked_at?: string
          linked_by: string
          server_ip: string
          server_name?: string
          sync_secret?: string
        }
        Update: {
          casino_id?: string
          id?: string
          is_online?: boolean
          last_sync_at?: string | null
          linked_at?: string
          linked_by?: string
          server_ip?: string
          server_name?: string
          sync_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "local_servers_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: true
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
          dealer_id: string
          id: string
          shift: Database["public"]["Enums"]["shift_type"]
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by: string
          date: string
          dealer_id: string
          id?: string
          shift: Database["public"]["Enums"]["shift_type"]
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string
          date?: string
          dealer_id?: string
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
            foreignKeyName: "pit_rota_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
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
      player_tags: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          player_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          player_id: string
          tag: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          player_id?: string
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
      profiles: {
        Row: {
          casino_id: string
          created_at: string
          display_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          display_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          casino_id?: string
          created_at?: string
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
      shifts: {
        Row: {
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
        }
        Insert: {
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
        }
        Update: {
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
          id: string
          recorded_by: string
          staff_id: string
          updated_at: string
          value: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          date: string
          id?: string
          recorded_by: string
          staff_id: string
          updated_at?: string
          value?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          date?: string
          id?: string
          recorded_by?: string
          staff_id?: string
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
            foreignKeyName: "staff_attendance_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          casino_id: string
          contract_end: string | null
          contract_start: string | null
          created_at: string
          department: Database["public"]["Enums"]["staff_department"]
          id: string
          is_active: boolean
          name: string
          onboarding_date: string | null
          salary: number | null
        }
        Insert: {
          casino_id: string
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          department: Database["public"]["Enums"]["staff_department"]
          id?: string
          is_active?: boolean
          name: string
          onboarding_date?: string | null
          salary?: number | null
        }
        Update: {
          casino_id?: string
          contract_end?: string | null
          contract_start?: string | null
          created_at?: string
          department?: Database["public"]["Enums"]["staff_department"]
          id?: string
          is_active?: boolean
          name?: string
          onboarding_date?: string | null
          salary?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "casinos"
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
          id: string
          shift: string
          staff_id: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          created_by: string
          date: string
          id?: string
          shift?: string
          staff_id: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          created_by?: string
          date?: string
          id?: string
          shift?: string
          staff_id?: string
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
            foreignKeyName: "staff_rota_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
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
      transactions: {
        Row: {
          amount: number
          casino_id: string
          chips: Json | null
          created_at: string
          id: string
          operator_id: string
          player_id: string
          shift_id: string | null
          table_id: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Insert: {
          amount: number
          casino_id: string
          chips?: Json | null
          created_at?: string
          id?: string
          operator_id: string
          player_id: string
          shift_id?: string | null
          table_id?: string | null
          type: Database["public"]["Enums"]["transaction_type"]
        }
        Update: {
          amount?: number
          casino_id?: string
          chips?: Json | null
          created_at?: string
          id?: string
          operator_id?: string
          player_id?: string
          shift_id?: string | null
          table_id?: string | null
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
    }
    Views: {
      player_economy: {
        Row: {
          casino_id: string | null
          first_name: string | null
          last_name: string | null
          nickname: string | null
          player_id: string | null
          real_result: number | null
          status: Database["public"]["Enums"]["player_status"] | null
          total_cashout: number | null
          total_drop: number | null
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
    }
    Functions: {
      generate_card_number: { Args: never; Returns: string }
      get_business_date_for_casino: {
        Args: { _casino_id: string }
        Returns: string
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
      get_user_casino_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      lookup_rfid_user: {
        Args: { rfid: string }
        Returns: {
          casino_id: string
          display_name: string
          user_id: string
        }[]
      }
      player_active_visit_casino: {
        Args: { _player_id: string }
        Returns: {
          casino_id: string
          casino_name: string
          checked_in_at: string
        }[]
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
        | "security"
        | "super_admin"
        | "hr"
      card_type: "manual" | "rfid"
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
      expense_category:
        | "food"
        | "alcohol"
        | "taxi"
        | "hotel"
        | "flight"
        | "other"
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
      player_category: "diamond" | "platinum" | "gold" | "guest"
      player_status: "active" | "blacklist"
      player_type: "slots" | "table" | "mix"
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
      transaction_type: "buy" | "cashout"
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
        "security",
        "super_admin",
        "hr",
      ],
      card_type: ["manual", "rfid"],
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
      ],
      expense_category: ["food", "alcohol", "taxi", "hotel", "flight", "other"],
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
      player_category: ["diamond", "platinum", "gold", "guest"],
      player_status: ["active", "blacklist"],
      player_type: ["slots", "table", "mix"],
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
      transaction_type: ["buy", "cashout"],
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
      ],
    },
  },
} as const
