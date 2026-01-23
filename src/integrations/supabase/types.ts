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
      ad_metrics: {
        Row: {
          campaign_name: string | null
          clicks: number | null
          company_id: string
          conversas: number | null
          created_at: string
          date: string
          id: string
          impressions: number | null
          leads: number | null
          link_clicks: number | null
          platform: string
          reach: number | null
          spend: number | null
          updated_at: string
        }
        Insert: {
          campaign_name?: string | null
          clicks?: number | null
          company_id: string
          conversas?: number | null
          created_at?: string
          date?: string
          id?: string
          impressions?: number | null
          leads?: number | null
          link_clicks?: number | null
          platform?: string
          reach?: number | null
          spend?: number | null
          updated_at?: string
        }
        Update: {
          campaign_name?: string | null
          clicks?: number | null
          company_id?: string
          conversas?: number | null
          created_at?: string
          date?: string
          id?: string
          impressions?: number | null
          leads?: number | null
          link_clicks?: number | null
          platform?: string
          reach?: number | null
          spend?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_metrics_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_logs: {
        Row: {
          automation_id: string
          company_id: string
          details: Json | null
          id: string
          lead_id: string
          success: boolean
          triggered_at: string
        }
        Insert: {
          automation_id: string
          company_id: string
          details?: Json | null
          id?: string
          lead_id: string
          success?: boolean
          triggered_at?: string
        }
        Update: {
          automation_id?: string
          company_id?: string
          details?: Json | null
          id?: string
          lead_id?: string
          success?: boolean
          triggered_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "funnel_automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "funnel_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flow_edges: {
        Row: {
          company_id: string
          created_at: string
          flow_id: string
          id: string
          label: string | null
          source_handle: string | null
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          flow_id: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id: string
          target_node_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          flow_id?: string
          id?: string
          label?: string | null
          source_handle?: string | null
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flow_edges_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_edges_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flow_executions: {
        Row: {
          company_id: string
          completed_at: string | null
          contact_id: string | null
          context: Json | null
          current_node_id: string | null
          flow_id: string
          id: string
          is_human_takeover: boolean
          lead_id: string | null
          next_action_at: string | null
          started_at: string
          status: string
        }
        Insert: {
          company_id: string
          completed_at?: string | null
          contact_id?: string | null
          context?: Json | null
          current_node_id?: string | null
          flow_id: string
          id?: string
          is_human_takeover?: boolean
          lead_id?: string | null
          next_action_at?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          contact_id?: string | null
          context?: Json | null
          current_node_id?: string | null
          flow_id?: string
          id?: string
          is_human_takeover?: boolean
          lead_id?: string | null
          next_action_at?: string | null
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flow_executions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_executions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_executions_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_executions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "funnel_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flow_logs: {
        Row: {
          action: string
          company_id: string
          created_at: string
          details: Json | null
          execution_id: string
          id: string
          node_id: string | null
          node_type: string | null
        }
        Insert: {
          action: string
          company_id: string
          created_at?: string
          details?: Json | null
          execution_id: string
          id?: string
          node_id?: string | null
          node_type?: string | null
        }
        Update: {
          action?: string
          company_id?: string
          created_at?: string
          details?: Json | null
          execution_id?: string
          id?: string
          node_id?: string | null
          node_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flow_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_logs_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flow_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_logs_node_id_fkey"
            columns: ["node_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flow_nodes: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          flow_id: string
          id: string
          node_type: string
          position_x: number
          position_y: number
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          flow_id: string
          id?: string
          node_type: string
          position_x?: number
          position_y?: number
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          flow_id?: string
          id?: string
          node_type?: string
          position_x?: number
          position_y?: number
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flow_nodes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_flow_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flows: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          trigger_keywords: string[] | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          trigger_keywords?: string[] | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          trigger_keywords?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          cnpj: string | null
          created_at: string
          id: string
          name: string
          slug: string
          updated_at: string
          whatsapp_mode: string | null
          whatsapp_phone_number_id: string | null
          whatsapp_waba_id: string | null
        }
        Insert: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          name: string
          slug: string
          updated_at?: string
          whatsapp_mode?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_waba_id?: string | null
        }
        Update: {
          address?: string | null
          cnpj?: string | null
          created_at?: string
          id?: string
          name?: string
          slug?: string
          updated_at?: string
          whatsapp_mode?: string | null
          whatsapp_phone_number_id?: string | null
          whatsapp_waba_id?: string | null
        }
        Relationships: []
      }
      email_campaigns: {
        Row: {
          campaign_type: string
          company_id: string
          content: Json
          created_at: string
          id: string
          list_id: string | null
          name: string
          preheader: string | null
          scheduled_at: string | null
          sent_at: string | null
          status: string
          subject: string
          template: string
          total_clicked: number | null
          total_opened: number | null
          total_recipients: number | null
          total_sent: number | null
          updated_at: string
        }
        Insert: {
          campaign_type?: string
          company_id: string
          content?: Json
          created_at?: string
          id?: string
          list_id?: string | null
          name: string
          preheader?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject: string
          template: string
          total_clicked?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Update: {
          campaign_type?: string
          company_id?: string
          content?: Json
          created_at?: string
          id?: string
          list_id?: string | null
          name?: string
          preheader?: string | null
          scheduled_at?: string | null
          sent_at?: string | null
          status?: string
          subject?: string
          template?: string
          total_clicked?: number | null
          total_opened?: number | null
          total_recipients?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_contacts: {
        Row: {
          company_id: string
          created_at: string
          email: string
          id: string
          is_subscribed: boolean | null
          lead_id: string | null
          list_id: string | null
          name: string | null
          phone: string | null
          source: string | null
          tags: string[] | null
          unsubscribed_at: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          id?: string
          is_subscribed?: boolean | null
          lead_id?: string | null
          list_id?: string | null
          name?: string | null
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          is_subscribed?: boolean | null
          lead_id?: string | null
          list_id?: string | null
          name?: string | null
          phone?: string | null
          source?: string | null
          tags?: string[] | null
          unsubscribed_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_contacts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "funnel_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "email_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_lists: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_lists_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_automations: {
        Row: {
          action_config: Json
          action_type: string
          company_id: string
          conditions: Json
          created_at: string
          description: string | null
          funnel_id: string
          id: string
          is_active: boolean
          name: string
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type: string
          company_id: string
          conditions?: Json
          created_at?: string
          description?: string | null
          funnel_id: string
          id?: string
          is_active?: boolean
          name: string
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          company_id?: string
          conditions?: Json
          created_at?: string
          description?: string | null
          funnel_id?: string
          id?: string
          is_active?: boolean
          name?: string
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_automations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_automations_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_leads: {
        Row: {
          company_id: string
          created_at: string
          custom_fields: Json | null
          email: string | null
          id: string
          is_reentry: boolean | null
          last_contact_at: string | null
          name: string
          notes: string | null
          phone: string | null
          position: number | null
          source: string | null
          stage_id: string
          tags: string[] | null
          updated_at: string
          value: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          is_reentry?: boolean | null
          last_contact_at?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: number | null
          source?: string | null
          stage_id: string
          tags?: string[] | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          is_reentry?: boolean | null
          last_contact_at?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: number | null
          source?: string | null
          stage_id?: string
          tags?: string[] | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funnel_leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          funnel_id: string
          id: string
          name: string
          position: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          funnel_id: string
          id?: string
          name: string
          position?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          funnel_id?: string
          id?: string
          name?: string
          position?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          color: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          position: number | null
          updated_at: string
        }
        Insert: {
          color?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          position?: number | null
          updated_at?: string
        }
        Update: {
          color?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          position?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          company_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          token: string
        }
        Insert: {
          accepted_at?: string | null
          company_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          token?: string
        }
        Update: {
          accepted_at?: string | null
          company_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_configs: {
        Row: {
          company_id: string
          created_at: string
          default_funnel_id: string | null
          default_stage_id: string | null
          id: string
          is_active: boolean
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_funnel_id?: string | null
          default_stage_id?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          webhook_secret?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_funnel_id?: string | null
          default_stage_id?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_configs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_configs_default_funnel_id_fkey"
            columns: ["default_funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_configs_default_stage_id_fkey"
            columns: ["default_stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contacts: {
        Row: {
          company_id: string
          created_at: string
          id: string
          is_group: boolean
          last_message_at: string | null
          name: string | null
          normalized_phone: string | null
          phone: string
          profile_picture: string | null
          tags: string[] | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          is_group?: boolean
          last_message_at?: string | null
          name?: string | null
          normalized_phone?: string | null
          phone: string
          profile_picture?: string | null
          tags?: string[] | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          is_group?: boolean
          last_message_at?: string | null
          name?: string | null
          normalized_phone?: string | null
          phone?: string
          profile_picture?: string | null
          tags?: string[] | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          company_id: string
          contact_id: string
          content: string
          created_at: string
          id: string
          is_from_me: boolean
          media_url: string | null
          message_id: string | null
          message_type: string
          sent_at: string
          status: string
        }
        Insert: {
          company_id: string
          contact_id: string
          content: string
          created_at?: string
          id?: string
          is_from_me?: boolean
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          sent_at?: string
          status?: string
        }
        Update: {
          company_id?: string
          contact_id?: string
          content?: string
          created_at?: string
          id?: string
          is_from_me?: boolean
          media_url?: string | null
          message_id?: string | null
          message_type?: string
          sent_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_sessions: {
        Row: {
          company_id: string
          created_at: string
          id: string
          last_connected_at: string | null
          phone_number: string | null
          qr_code: string | null
          session_data: Json | null
          status: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          last_connected_at?: string | null
          phone_number?: string | null
          qr_code?: string | null
          session_data?: Json | null
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          last_connected_at?: string | null
          phone_number?: string | null
          qr_code?: string | null
          session_data?: Json | null
          status?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_company_id: { Args: { user_uuid: string }; Returns: string }
      increment_unread_count: {
        Args: { contact_uuid: string }
        Returns: undefined
      }
      is_admin_or_owner: { Args: { user_uuid: string }; Returns: boolean }
      is_admin_or_owner_safe: {
        Args: { check_user_id: string }
        Returns: boolean
      }
      is_owner_safe: { Args: { check_user_id: string }; Returns: boolean }
      normalize_whatsapp_phone: { Args: { input: string }; Returns: string }
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
