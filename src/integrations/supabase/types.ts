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
      admin_users: {
        Row: {
          created_at: string
          email: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          content: string
          created_at: string
          featured_image_url: string | null
          id: string
          meta_description: string
          published: boolean
          published_at: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          featured_image_url?: string | null
          id?: string
          meta_description?: string
          published?: boolean
          published_at?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          featured_image_url?: string | null
          id?: string
          meta_description?: string
          published?: boolean
          published_at?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      class_checkins: {
        Row: {
          added_manually: boolean
          antaris_client_id: string | null
          checked_in_at: string
          class_day: string
          class_name: string
          class_time: string
          id: string
          name: string
          notes: string | null
          phone: string
          verified: boolean
        }
        Insert: {
          added_manually?: boolean
          antaris_client_id?: string | null
          checked_in_at?: string
          class_day: string
          class_name: string
          class_time: string
          id?: string
          name: string
          notes?: string | null
          phone: string
          verified?: boolean
        }
        Update: {
          added_manually?: boolean
          antaris_client_id?: string | null
          checked_in_at?: string
          class_day?: string
          class_name?: string
          class_time?: string
          id?: string
          name?: string
          notes?: string | null
          phone?: string
          verified?: boolean
        }
        Relationships: []
      }
      class_sessions: {
        Row: {
          canceled_reason: string | null
          class_name: string
          created_at: string
          id: string
          session_date: string
          status: string
        }
        Insert: {
          canceled_reason?: string | null
          class_name: string
          created_at?: string
          id?: string
          session_date: string
          status?: string
        }
        Update: {
          canceled_reason?: string | null
          class_name?: string
          created_at?: string
          id?: string
          session_date?: string
          status?: string
        }
        Relationships: []
      }
      day_pass_pending_checkins: {
        Row: {
          approved_at: string | null
          email: string
          id: string
          lead_id: string | null
          name: string
          payment_method: string
          phone: string
          rejected_at: string | null
          requested_at: string
          status: string
        }
        Insert: {
          approved_at?: string | null
          email: string
          id?: string
          lead_id?: string | null
          name: string
          payment_method?: string
          phone: string
          rejected_at?: string | null
          requested_at?: string
          status?: string
        }
        Update: {
          approved_at?: string | null
          email?: string
          id?: string
          lead_id?: string | null
          name?: string
          payment_method?: string
          phone?: string
          rejected_at?: string | null
          requested_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_pass_pending_checkins_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      leads: {
        Row: {
          became_member: boolean
          converted_at: string | null
          created_at: string
          crm_status: string | null
          day_pass_price: number | null
          email: string
          followup_count: number
          id: string
          interest: string | null
          last_contact_method: string | null
          last_contacted_at: string | null
          last_response_at: string | null
          last_sms_at: string | null
          lead_score: number
          lead_type: string
          membership_start_date: string | null
          message: string | null
          name: string
          next_action: string | null
          next_follow_up_date: string | null
          notes: string | null
          payment_method: string | null
          payment_status: string | null
          phone: string | null
          primary_goal: string | null
          referral_code: string | null
          referred_by: string | null
          sequence_status: string | null
          should_notify: boolean
          sms_opted_out: boolean
          source: string
          spam_reason: string | null
          status: string | null
          tour_completed: boolean
          tour_date: string | null
          tour_scheduled: boolean
        }
        Insert: {
          became_member?: boolean
          converted_at?: string | null
          created_at?: string
          crm_status?: string | null
          day_pass_price?: number | null
          email: string
          followup_count?: number
          id?: string
          interest?: string | null
          last_contact_method?: string | null
          last_contacted_at?: string | null
          last_response_at?: string | null
          last_sms_at?: string | null
          lead_score?: number
          lead_type?: string
          membership_start_date?: string | null
          message?: string | null
          name: string
          next_action?: string | null
          next_follow_up_date?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          phone?: string | null
          primary_goal?: string | null
          referral_code?: string | null
          referred_by?: string | null
          sequence_status?: string | null
          should_notify?: boolean
          sms_opted_out?: boolean
          source: string
          spam_reason?: string | null
          status?: string | null
          tour_completed?: boolean
          tour_date?: string | null
          tour_scheduled?: boolean
        }
        Update: {
          became_member?: boolean
          converted_at?: string | null
          created_at?: string
          crm_status?: string | null
          day_pass_price?: number | null
          email?: string
          followup_count?: number
          id?: string
          interest?: string | null
          last_contact_method?: string | null
          last_contacted_at?: string | null
          last_response_at?: string | null
          last_sms_at?: string | null
          lead_score?: number
          lead_type?: string
          membership_start_date?: string | null
          message?: string | null
          name?: string
          next_action?: string | null
          next_follow_up_date?: string | null
          notes?: string | null
          payment_method?: string | null
          payment_status?: string | null
          phone?: string | null
          primary_goal?: string | null
          referral_code?: string | null
          referred_by?: string | null
          sequence_status?: string | null
          should_notify?: boolean
          sms_opted_out?: boolean
          source?: string
          spam_reason?: string | null
          status?: string | null
          tour_completed?: boolean
          tour_date?: string | null
          tour_scheduled?: boolean
        }
        Relationships: []
      }
      monthly_snapshots: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: string
          metrics: Json
          month: string
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          metrics?: Json
          month: string
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          metrics?: Json
          month?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          email_sent: boolean
          email_sent_at: string | null
          email_status: string
          friend_contact: string | null
          friend_email: string | null
          friend_name: string
          id: string
          normalized_referrer_email: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          referral_code: string
          referrer_contact: string | null
          referrer_email: string | null
          referrer_name: string
          status: string
        }
        Insert: {
          created_at?: string
          email_sent?: boolean
          email_sent_at?: string | null
          email_status?: string
          friend_contact?: string | null
          friend_email?: string | null
          friend_name: string
          id?: string
          normalized_referrer_email?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          referral_code: string
          referrer_contact?: string | null
          referrer_email?: string | null
          referrer_name: string
          status?: string
        }
        Update: {
          created_at?: string
          email_sent?: boolean
          email_sent_at?: string | null
          email_status?: string
          friend_contact?: string | null
          friend_email?: string | null
          friend_name?: string
          id?: string
          normalized_referrer_email?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          referral_code?: string
          referrer_contact?: string | null
          referrer_email?: string | null
          referrer_name?: string
          status?: string
        }
        Relationships: []
      }
      sms_conversation_log: {
        Row: {
          body: string
          created_at: string
          direction: string
          from_ai: boolean
          id: string
          lead_id: string | null
          metadata: Json | null
          phone: string
          provider_message_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          direction: string
          from_ai?: boolean
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          phone: string
          provider_message_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          direction?: string
          from_ai?: boolean
          id?: string
          lead_id?: string | null
          metadata?: Json | null
          phone?: string
          provider_message_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sms_conversation_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "staff"
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
      app_role: ["admin", "staff"],
    },
  },
} as const
