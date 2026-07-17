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
      company_settings: {
        Row: {
          admin_clerk_user_id: string | null
          admin_id: string | null
          app_name: string
          brand_color: string
          business_category: string | null
          company_name: string
          created_at: string | null
          id: string
          logo_emoji: string
          onboarding_complete: boolean
          onboarding_step: number
          tenant_id: string | null
          updated_at: string | null
        }
        Insert: {
          admin_clerk_user_id?: string | null
          admin_id?: string | null
          app_name?: string
          brand_color?: string
          business_category?: string | null
          company_name?: string
          created_at?: string | null
          id?: string
          logo_emoji?: string
          onboarding_complete?: boolean
          onboarding_step?: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Update: {
          admin_clerk_user_id?: string | null
          admin_id?: string | null
          app_name?: string
          brand_color?: string
          business_category?: string | null
          company_name?: string
          created_at?: string | null
          id?: string
          logo_emoji?: string
          onboarding_complete?: boolean
          onboarding_step?: number
          tenant_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          description: string | null
          expense_date: string | null
          id: string
          tenant_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          description?: string | null
          expense_date?: string | null
          id?: string
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          description?: string | null
          expense_date?: string | null
          id?: string
          tenant_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          unit_label: string
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          unit_label: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          unit_label?: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          tenant_id: string | null
          unit_label: string | null
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          tenant_id?: string | null
          unit_label?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          tenant_id?: string | null
          unit_label?: string | null
          unit_price?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          clerk_user_id: string | null
          created_at: string | null
          email: string | null
          id: string
          is_admin: boolean | null
          permissions: Json | null
          tenant_id: string | null
        }
        Insert: {
          clerk_user_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean | null
          permissions?: Json | null
          tenant_id?: string | null
        }
        Update: {
          clerk_user_id?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_admin?: boolean | null
          permissions?: Json | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          clerk_user_id: string | null
          created_at: string | null
          customer_name: string | null
          id: string
          item_name: string
          notes: string | null
          paid_at: string | null
          paid_via: string | null
          payment_method: string | null
          product_id: string | null
          quantity: number
          sale_date: string | null
          tenant_id: string | null
          total_amount: number | null
          transaction_id: string | null
          unit_label: string | null
          unit_price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clerk_user_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string
          item_name: string
          notes?: string | null
          paid_at?: string | null
          paid_via?: string | null
          payment_method?: string | null
          product_id?: string | null
          quantity: number
          sale_date?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          transaction_id?: string | null
          unit_label?: string | null
          unit_price: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clerk_user_id?: string | null
          created_at?: string | null
          customer_name?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          paid_at?: string | null
          paid_via?: string | null
          payment_method?: string | null
          product_id?: string | null
          quantity?: number
          sale_date?: string | null
          tenant_id?: string | null
          total_amount?: number | null
          transaction_id?: string | null
          unit_label?: string | null
          unit_price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_records: {
        Row: {
          clerk_user_id: string | null
          cost_price: number
          created_at: string | null
          id: string
          item_name: string
          notes: string | null
          product_id: string | null
          quantity: number
          stock_date: string | null
          tenant_id: string | null
          total_cost: number | null
          unit_label: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          clerk_user_id?: string | null
          cost_price: number
          created_at?: string | null
          id?: string
          item_name: string
          notes?: string | null
          product_id?: string | null
          quantity: number
          stock_date?: string | null
          tenant_id?: string | null
          total_cost?: number | null
          unit_label?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          clerk_user_id?: string | null
          cost_price?: number
          created_at?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          product_id?: string | null
          quantity?: number
          stock_date?: string | null
          tenant_id?: string | null
          total_cost?: number | null
          unit_label?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_records_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_records_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          clerk_org_id: string | null
          created_at: string | null
          created_by: string | null
          created_by_clerk_user_id: string | null
          id: string
          invite_code: string | null
          monthly_sales_limit: number | null
          name: string
          plan: string | null
          updated_at: string | null
        }
        Insert: {
          clerk_org_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_clerk_user_id?: string | null
          id?: string
          invite_code?: string | null
          monthly_sales_limit?: number | null
          name: string
          plan?: string | null
          updated_at?: string | null
        }
        Update: {
          clerk_org_id?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_clerk_user_id?: string | null
          id?: string
          invite_code?: string | null
          monthly_sales_limit?: number | null
          name?: string
          plan?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
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
