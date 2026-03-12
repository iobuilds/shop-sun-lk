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
      banners: {
        Row: {
          created_at: string | null
          id: string
          image_url: string
          is_active: boolean | null
          link_url: string | null
          sort_order: number | null
          subtitle: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          image_url: string
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          subtitle?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          subtitle?: string | null
          title?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          parent_id: string | null
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
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
      combo_pack_items: {
        Row: {
          combo_id: string
          created_at: string | null
          id: string
          product_id: string
          quantity: number
        }
        Insert: {
          combo_id: string
          created_at?: string | null
          id?: string
          product_id: string
          quantity?: number
        }
        Update: {
          combo_id?: string
          created_at?: string | null
          id?: string
          product_id?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "combo_pack_items_combo_id_fkey"
            columns: ["combo_id"]
            isOneToOne: false
            referencedRelation: "combo_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "combo_pack_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      combo_packs: {
        Row: {
          combo_price: number
          created_at: string | null
          description: string | null
          id: string
          images: string[] | null
          is_active: boolean
          is_featured: boolean | null
          name: string
          original_price: number
          slug: string
          updated_at: string | null
        }
        Insert: {
          combo_price?: number
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          is_featured?: boolean | null
          name: string
          original_price?: number
          slug: string
          updated_at?: string | null
        }
        Update: {
          combo_price?: number
          created_at?: string | null
          description?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean
          is_featured?: boolean | null
          name?: string
          original_price?: number
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          is_read: boolean
          message: string
          name: string
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_read?: boolean
          message: string
          name: string
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_read?: boolean
          message?: string
          name?: string
          subject?: string
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          reminder_sent: boolean
          sender_id: string
          sender_type: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          reminder_sent?: boolean
          sender_id: string
          sender_type?: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          reminder_sent?: boolean
          sender_id?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coupon_assignments: {
        Row: {
          coupon_id: string
          created_at: string
          id: string
          phone: string
          used: boolean
          user_id: string | null
        }
        Insert: {
          coupon_id: string
          created_at?: string
          id?: string
          phone: string
          used?: boolean
          user_id?: string | null
        }
        Update: {
          coupon_id?: string
          created_at?: string
          id?: string
          phone?: string
          used?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupon_assignments_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          id: string
          order_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          id?: string
          order_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          id?: string
          order_id?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usage_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          category_scope: string
          code: string
          coupon_type: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount_cap: number | null
          max_uses: number | null
          min_order_amount: number | null
          name: string | null
          per_user_limit: number | null
          starts_at: string | null
          used_count: number
          valid_category_ids: string[] | null
        }
        Insert: {
          category_scope?: string
          code: string
          coupon_type?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_cap?: number | null
          max_uses?: number | null
          min_order_amount?: number | null
          name?: string | null
          per_user_limit?: number | null
          starts_at?: string | null
          used_count?: number
          valid_category_ids?: string[] | null
        }
        Update: {
          category_scope?: string
          code?: string
          coupon_type?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount_cap?: number | null
          max_uses?: number | null
          min_order_amount?: number | null
          name?: string | null
          per_user_limit?: number | null
          starts_at?: string | null
          used_count?: number
          valid_category_ids?: string[] | null
        }
        Relationships: []
      }
      daily_deals: {
        Row: {
          created_at: string | null
          deal_price: number | null
          discount_percent: number
          ends_at: string
          id: string
          is_active: boolean | null
          product_id: string
          starts_at: string | null
        }
        Insert: {
          created_at?: string | null
          deal_price?: number | null
          discount_percent?: number
          ends_at: string
          id?: string
          is_active?: boolean | null
          product_id: string
          starts_at?: string | null
        }
        Update: {
          created_at?: string | null
          deal_price?: number | null
          discount_percent?: number
          ends_at?: string
          id?: string
          is_active?: boolean | null
          product_id?: string
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      db_backup_logs: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          created_by_email: string | null
          file_name: string
          file_size: number | null
          id: string
          note: string | null
        }
        Insert: {
          action: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          note?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          note?: string | null
        }
        Relationships: []
      }
      moderator_permissions: {
        Row: {
          can_manage_orders: boolean
          can_manage_pcb_orders: boolean
          can_manage_preorders: boolean
          can_view_contacts: boolean
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          can_manage_orders?: boolean
          can_manage_pcb_orders?: boolean
          can_manage_preorders?: boolean
          can_view_contacts?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          can_manage_orders?: boolean
          can_manage_pcb_orders?: boolean
          can_manage_preorders?: boolean
          can_view_contacts?: boolean
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          product_id: string
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          product_id: string
          quantity?: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          product_id?: string
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          courier_name: string | null
          created_at: string
          expected_delivery: string | null
          id: string
          note: string | null
          order_id: string
          status: string
          tracking_link: string | null
          tracking_number: string | null
        }
        Insert: {
          changed_by?: string | null
          courier_name?: string | null
          created_at?: string
          expected_delivery?: string | null
          id?: string
          note?: string | null
          order_id: string
          status: string
          tracking_link?: string | null
          tracking_number?: string | null
        }
        Update: {
          changed_by?: string | null
          courier_name?: string | null
          created_at?: string
          expected_delivery?: string | null
          id?: string
          note?: string | null
          order_id?: string
          status?: string
          tracking_link?: string | null
          tracking_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          coupon_code: string | null
          courier_name: string | null
          created_at: string | null
          delivery_note: string | null
          discount_amount: number
          expected_delivery: string | null
          id: string
          notes: string | null
          payment_method: string
          payment_status: string
          receipt_url: string | null
          shipping_address: Json | null
          shipping_fee: number
          status: string
          subtotal: number
          total: number
          tracking_link: string | null
          tracking_number: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          coupon_code?: string | null
          courier_name?: string | null
          created_at?: string | null
          delivery_note?: string | null
          discount_amount?: number
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          payment_status?: string
          receipt_url?: string | null
          shipping_address?: Json | null
          shipping_fee?: number
          status?: string
          subtotal?: number
          total?: number
          tracking_link?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          coupon_code?: string | null
          courier_name?: string | null
          created_at?: string | null
          delivery_note?: string | null
          discount_amount?: number
          expected_delivery?: string | null
          id?: string
          notes?: string | null
          payment_method?: string
          payment_status?: string
          receipt_url?: string | null
          shipping_address?: Json | null
          shipping_fee?: number
          status?: string
          subtotal?: number
          total?: number
          tracking_link?: string | null
          tracking_number?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      otp_verifications: {
        Row: {
          attempts: number
          created_at: string
          expires_at: string
          id: string
          locked_until: string | null
          otp_code: string
          phone: string
          verified: boolean
        }
        Insert: {
          attempts?: number
          created_at?: string
          expires_at: string
          id?: string
          locked_until?: string | null
          otp_code: string
          phone: string
          verified?: boolean
        }
        Update: {
          attempts?: number
          created_at?: string
          expires_at?: string
          id?: string
          locked_until?: string | null
          otp_code?: string
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      pages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          is_published: boolean | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          content?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      pcb_order_requests: {
        Row: {
          admin_notes: string | null
          arrival_payment_status: string
          arrival_shipping_fee: number | null
          arrival_slip_url: string | null
          arrival_tax_amount: number | null
          board_thickness: string
          created_at: string
          customer_note: string | null
          gerber_file_name: string | null
          gerber_file_url: string | null
          grand_total: number | null
          id: string
          layer_count: number
          payment_status: string
          pcb_color: string
          quantity: number
          quoted_at: string | null
          shipping_fee: number | null
          slip_url: string | null
          status: string
          surface_finish: string
          tax_amount: number | null
          unit_cost_total: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          arrival_payment_status?: string
          arrival_shipping_fee?: number | null
          arrival_slip_url?: string | null
          arrival_tax_amount?: number | null
          board_thickness?: string
          created_at?: string
          customer_note?: string | null
          gerber_file_name?: string | null
          gerber_file_url?: string | null
          grand_total?: number | null
          id?: string
          layer_count?: number
          payment_status?: string
          pcb_color?: string
          quantity?: number
          quoted_at?: string | null
          shipping_fee?: number | null
          slip_url?: string | null
          status?: string
          surface_finish?: string
          tax_amount?: number | null
          unit_cost_total?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          arrival_payment_status?: string
          arrival_shipping_fee?: number | null
          arrival_slip_url?: string | null
          arrival_tax_amount?: number | null
          board_thickness?: string
          created_at?: string
          customer_note?: string | null
          gerber_file_name?: string | null
          gerber_file_url?: string | null
          grand_total?: number | null
          id?: string
          layer_count?: number
          payment_status?: string
          pcb_color?: string
          quantity?: number
          quoted_at?: string | null
          shipping_fee?: number | null
          slip_url?: string | null
          status?: string
          surface_finish?: string
          tax_amount?: number | null
          unit_cost_total?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      preorder_items: {
        Row: {
          created_at: string
          expected_date: string | null
          external_url: string | null
          id: string
          notes: string | null
          preorder_id: string
          product_id: string | null
          product_name: string
          quantity: number
          unit_price: number | null
        }
        Insert: {
          created_at?: string
          expected_date?: string | null
          external_url?: string | null
          id?: string
          notes?: string | null
          preorder_id: string
          product_id?: string | null
          product_name: string
          quantity?: number
          unit_price?: number | null
        }
        Update: {
          created_at?: string
          expected_date?: string | null
          external_url?: string | null
          id?: string
          notes?: string | null
          preorder_id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "preorder_items_preorder_id_fkey"
            columns: ["preorder_id"]
            isOneToOne: false
            referencedRelation: "preorder_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "preorder_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      preorder_requests: {
        Row: {
          admin_notes: string | null
          arrival_payment_status: string
          arrival_shipping_fee: number | null
          arrival_slip_url: string | null
          arrival_tax_amount: number | null
          conversation_id: string | null
          created_at: string
          customer_note: string | null
          grand_total: number | null
          id: string
          payment_status: string
          quoted_at: string | null
          shipping_fee: number | null
          slip_url: string | null
          status: string
          stripe_session_id: string | null
          tax_amount: number | null
          unit_cost_total: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          arrival_payment_status?: string
          arrival_shipping_fee?: number | null
          arrival_slip_url?: string | null
          arrival_tax_amount?: number | null
          conversation_id?: string | null
          created_at?: string
          customer_note?: string | null
          grand_total?: number | null
          id?: string
          payment_status?: string
          quoted_at?: string | null
          shipping_fee?: number | null
          slip_url?: string | null
          status?: string
          stripe_session_id?: string | null
          tax_amount?: number | null
          unit_cost_total?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          arrival_payment_status?: string
          arrival_shipping_fee?: number | null
          arrival_slip_url?: string | null
          arrival_tax_amount?: number | null
          conversation_id?: string | null
          created_at?: string
          customer_note?: string | null
          grand_total?: number | null
          id?: string
          payment_status?: string
          quoted_at?: string | null
          shipping_fee?: number | null
          slip_url?: string | null
          status?: string
          stripe_session_id?: string | null
          tax_amount?: number | null
          unit_cost_total?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preorder_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      product_external_links: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string
          link_type: string
          product_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          link_type?: string
          product_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          link_type?: string
          product_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_external_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_similar_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          relation_type: string
          similar_product_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          relation_type?: string
          similar_product_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          relation_type?: string
          similar_product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_similar_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_similar_items_similar_product_id_fkey"
            columns: ["similar_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          attachments: Json | null
          category_id: string | null
          cost_price: number | null
          created_at: string | null
          datasheet_url: string | null
          description: string | null
          discount_price: number | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          price: number
          rating: number | null
          review_count: number | null
          sku: string | null
          slug: string
          specifications: Json | null
          stock_quantity: number | null
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          attachments?: Json | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          datasheet_url?: string | null
          description?: string | null
          discount_price?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          price?: number
          rating?: number | null
          review_count?: number | null
          sku?: string | null
          slug: string
          specifications?: Json | null
          stock_quantity?: number | null
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          attachments?: Json | null
          category_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          datasheet_url?: string | null
          description?: string | null
          discount_price?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          price?: number
          rating?: number | null
          review_count?: number | null
          sku?: string | null
          slug?: string
          specifications?: Json | null
          stock_quantity?: number | null
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          avatar_url: string | null
          city: string | null
          created_at: string | null
          full_name: string | null
          id: string
          is_suspended: boolean
          phone: string | null
          phone_verified: boolean | null
          postal_code: string | null
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_suspended?: boolean
          phone?: string | null
          phone_verified?: boolean | null
          postal_code?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          avatar_url?: string | null
          city?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          is_suspended?: boolean
          phone?: string | null
          phone_verified?: boolean | null
          postal_code?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      promo_banners: {
        Row: {
          badge_text: string | null
          created_at: string | null
          description: string | null
          gradient_from: string | null
          id: string
          image_url: string
          is_active: boolean | null
          link_url: string | null
          sort_order: number | null
          subtitle: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          badge_text?: string | null
          created_at?: string | null
          description?: string | null
          gradient_from?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          subtitle?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          badge_text?: string | null
          created_at?: string | null
          description?: string | null
          gradient_from?: string | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          link_url?: string | null
          sort_order?: number | null
          subtitle?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string
          product_id: string
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id: string
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          id?: string
          product_id?: string
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      sms_logs: {
        Row: {
          created_at: string
          id: string
          message: string
          order_id: string | null
          phone: string
          provider_response: Json | null
          status: string
          template_key: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          order_id?: string | null
          phone: string
          provider_response?: Json | null
          status?: string
          template_key?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          order_id?: string | null
          phone?: string
          provider_response?: Json | null
          status?: string
          template_key?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sms_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          message_template: string
          name: string
          template_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_template: string
          name: string
          template_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          message_template?: string
          name?: string
          template_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_receipts: {
        Row: {
          buy_date: string
          buy_price: number | null
          created_at: string
          created_by: string | null
          id: string
          lcsc_part_number: string | null
          mpn: string | null
          notes: string | null
          order_reference: string | null
          product_id: string
          qty_received: number
        }
        Insert: {
          buy_date?: string
          buy_price?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          lcsc_part_number?: string | null
          mpn?: string | null
          notes?: string | null
          order_reference?: string | null
          product_id: string
          qty_received?: number
        }
        Update: {
          buy_date?: string
          buy_price?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          lcsc_part_number?: string | null
          mpn?: string | null
          notes?: string | null
          order_reference?: string | null
          product_id?: string
          qty_received?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_receipts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link_url: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link_url?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          order_id: string | null
          reason: string
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          reason: string
          type?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          order_id?: string | null
          reason?: string
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
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
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
