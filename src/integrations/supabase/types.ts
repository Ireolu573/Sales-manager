export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
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
      credit_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          note: string | null
          payment_method: string
          received_at: string
          received_by: string
          sale_id: string
          tenant_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          note?: string | null
          payment_method?: string
          received_at?: string
          received_by: string
          sale_id: string
          tenant_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          note?: string | null
          payment_method?: string
          received_at?: string
          received_by?: string
          sale_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          base_unit_quantity: number
          created_at: string | null
          id: string
          product_id: string | null
          unit_label: string
          unit_price: number | null
          updated_at: string | null
        }
        Insert: {
          base_unit_quantity?: number
          created_at?: string | null
          id?: string
          product_id?: string | null
          unit_label: string
          unit_price?: number | null
          updated_at?: string | null
        }
        Update: {
          base_unit_quantity?: number
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
          id: string
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
          base_quantity: number | null
          clerk_user_id: string | null
          cogs_amount: number
          created_at: string | null
          customer_name: string | null
          id: string
          inventory_override: boolean
          item_name: string
          notes: string | null
          override_reason: string | null
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
          user_id: string | null
        }
        Insert: {
          base_quantity?: number | null
          clerk_user_id?: string | null
          cogs_amount?: number
          created_at?: string | null
          customer_name?: string | null
          id?: string
          inventory_override?: boolean
          item_name: string
          notes?: string | null
          override_reason?: string | null
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
          user_id?: string | null
        }
        Update: {
          base_quantity?: number | null
          clerk_user_id?: string | null
          cogs_amount?: number
          created_at?: string | null
          customer_name?: string | null
          id?: string
          inventory_override?: boolean
          item_name?: string
          notes?: string | null
          override_reason?: string | null
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
          user_id?: string | null
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
          base_cost: number | null
          base_quantity: number | null
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
          base_cost?: number | null
          base_quantity?: number | null
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
          base_cost?: number | null
          base_quantity?: number | null
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
      create_business: {
        Args: {
          p_app_name: string
          p_brand_color: string
          p_logo_emoji: string
          p_name: string
        }
        Returns: string
      }
      current_tenant_id: { Args: never; Returns: string }
      delete_sales_transaction: {
        Args: { p_sale_id: string }
        Returns: undefined
      }
      get_inventory_summary: {
        Args: { p_tenant_id: string }
        Returns: {
          available_base_quantity: number
          available_stock: number
          item_name: string
          product_id: string
          status: string
          total_sold: number
          total_stock: number
        }[]
      }
      is_tenant_admin: { Args: never; Returns: boolean }
      join_business: { Args: { p_invite_code: string }; Returns: string }
      record_credit_payment: {
        Args: {
          p_amount: number
          p_note?: string
          p_payment_method: string
          p_sale_id: string
        }
        Returns: {
          amount: number
          created_at: string
          id: string
          note: string | null
          payment_method: string
          received_at: string
          received_by: string
          sale_id: string
          tenant_id: string
        }
        SetofOptions: {
          from: "*"
          to: "credit_payments"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_sales_transaction: {
        Args: {
          p_allow_override?: boolean
          p_customer_name?: string
          p_items: Json
          p_notes?: string
          p_override_reason?: string
          p_payment_method?: string
          p_sale_date?: string
          p_tenant_id: string
          p_transaction_id?: string
        }
        Returns: {
          id: string
          total_amount: number
          transaction_id: string
        }[]
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
