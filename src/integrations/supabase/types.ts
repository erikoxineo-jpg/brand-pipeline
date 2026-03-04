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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string
          id: string
          inactivity_days: number
          name: string
          optout_keywords: string
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          inactivity_days?: number
          name: string
          optout_keywords?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          inactivity_days?: number
          name?: string
          optout_keywords?: string
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string | null
          plan: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug?: string | null
          plan?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string | null
          plan?: string
          created_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: Database["public"]["Enums"]["workspace_role"]
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: Database["public"]["Enums"]["workspace_role"]
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
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
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          id: string
          workspace_id: string
          name: string | null
          phone: string | null
          email: string | null
          last_purchase: string | null
          days_inactive: number | null
          stage: string
          opt_out: boolean
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name?: string | null
          phone?: string | null
          email?: string | null
          last_purchase?: string | null
          days_inactive?: number | null
          stage?: string
          opt_out?: boolean
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string | null
          phone?: string | null
          email?: string | null
          last_purchase?: string | null
          days_inactive?: number | null
          stage?: string
          opt_out?: boolean
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      imports: {
        Row: {
          id: string
          workspace_id: string
          filename: string
          total: number
          new_leads: number
          duplicates: number
          status: string
          error_message: string | null
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          filename: string
          total?: number
          new_leads?: number
          duplicates?: number
          status?: string
          error_message?: string | null
          created_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          filename?: string
          total?: number
          new_leads?: number
          duplicates?: number
          status?: string
          error_message?: string | null
          created_by?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "imports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          id: string
          workspace_id: string
          name: string
          status: string
          message_template: string | null
          survey_questions: Json | null
          offer_type: string | null
          offer_value: string | null
          offer_rule: string | null
          target_stages: string[] | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          status?: string
          message_template?: string | null
          survey_questions?: Json | null
          offer_type?: string | null
          offer_value?: string | null
          offer_rule?: string | null
          target_stages?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          status?: string
          message_template?: string | null
          survey_questions?: Json | null
          offer_type?: string | null
          offer_value?: string | null
          offer_rule?: string | null
          target_stages?: string[] | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatches: {
        Row: {
          id: string
          workspace_id: string
          lead_id: string
          campaign_id: string | null
          whatsapp_message_id: string | null
          status: string
          sent_at: string | null
          delivered_at: string | null
          read_at: string | null
          replied_at: string | null
          error_message: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          lead_id: string
          campaign_id?: string | null
          whatsapp_message_id?: string | null
          status?: string
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          replied_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          lead_id?: string
          campaign_id?: string | null
          whatsapp_message_id?: string | null
          status?: string
          sent_at?: string | null
          delivered_at?: string | null
          read_at?: string | null
          replied_at?: string | null
          error_message?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatches_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatches_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_config: {
        Row: {
          id: string
          workspace_id: string
          phone_number_id: string | null
          waba_id: string | null
          access_token: string | null
          verify_token: string | null
          webhook_secret: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          phone_number_id?: string | null
          waba_id?: string | null
          access_token?: string | null
          verify_token?: string | null
          webhook_secret?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          phone_number_id?: string | null
          waba_id?: string | null
          access_token?: string | null
          verify_token?: string | null
          webhook_secret?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_config_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_brand_ids: { Args: { _user_id: string }; Returns: string[] }
      get_user_role_for_brand: {
        Args: { _brand_id: string; _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_brand_access: {
        Args: { _brand_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { ws_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "gestor" | "operador"
      workspace_role: "owner" | "admin" | "member"
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
      app_role: ["admin", "gestor", "operador"],
    },
  },
} as const
