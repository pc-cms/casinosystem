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
      casinos: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
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
      dealers: {
        Row: {
          casino_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
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
          created_at: string
          first_name: string
          id: string
          last_name: string
          nickname: string
          phone: string
          photo_url: string | null
          status: Database["public"]["Enums"]["player_status"]
          updated_at: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          first_name: string
          id?: string
          last_name: string
          nickname?: string
          phone?: string
          photo_url?: string | null
          status?: Database["public"]["Enums"]["player_status"]
          updated_at?: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          nickname?: string
          phone?: string
          photo_url?: string | null
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
          pin_hash: string | null
          rfid_tag: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          casino_id: string
          created_at?: string
          display_name: string
          id?: string
          pin_hash?: string | null
          rfid_tag?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          casino_id?: string
          created_at?: string
          display_name?: string
          id?: string
          pin_hash?: string | null
          rfid_tag?: string | null
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
          casino_id: string
          closed_at: string | null
          closed_by: string | null
          closing_cash: Json | null
          closing_count: Json | null
          created_at: string
          exchange_rates: Json
          id: string
          notes: string | null
          opened_at: string
          opened_by: string
          opening_float: Json | null
          status: string
        }
        Insert: {
          casino_id: string
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: Json | null
          closing_count?: Json | null
          created_at?: string
          exchange_rates?: Json
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by: string
          opening_float?: Json | null
          status?: string
        }
        Update: {
          casino_id?: string
          closed_at?: string | null
          closed_by?: string | null
          closing_cash?: Json | null
          closing_count?: Json | null
          created_at?: string
          exchange_rates?: Json
          id?: string
          notes?: string | null
          opened_at?: string
          opened_by?: string
          opening_float?: Json | null
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
      get_user_casino_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      card_type: "manual" | "rfid"
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
      player_status: "active" | "blacklist"
      shift_type: "M" | "N" | "A" | "S" | "E"
      table_status: "open" | "closed"
      transaction_type: "buy" | "cashout"
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
      ],
      card_type: ["manual", "rfid"],
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
      player_status: ["active", "blacklist"],
      shift_type: ["M", "N", "A", "S", "E"],
      table_status: ["open", "closed"],
      transaction_type: ["buy", "cashout"],
    },
  },
} as const
