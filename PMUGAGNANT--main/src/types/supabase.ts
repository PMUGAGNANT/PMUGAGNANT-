export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          is_subscribed: boolean | null;
          subscription_status: string | null;
          premium_access_expires_at: string | null;
          referral_count: number | null;
          telegram_chat_id: string | null;
        };
        Insert: {
          id: string;
          is_subscribed?: boolean | null;
          subscription_status?: string | null;
          premium_access_expires_at?: string | null;
          referral_count?: number | null;
          telegram_chat_id?: string | null;
        };
        Update: {
          id?: string;
          is_subscribed?: boolean | null;
          subscription_status?: string | null;
          premium_access_expires_at?: string | null;
          referral_count?: number | null;
          telegram_chat_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      race_messages: {
        Row: {
          id: string;
          race_id: string;
          race_date: string;
          user_id: string | null;
          username: string;
          avatar_initials: string;
          is_pro: boolean;
          win_rate: number;
          winning_streak: number;
          content: string;
          created_at: string;
          banned_until: string | null;
        };
        Insert: {
          id?: string;
          race_id: string;
          race_date: string;
          user_id?: string | null;
          username: string;
          avatar_initials: string;
          is_pro?: boolean;
          win_rate?: number;
          winning_streak?: number;
          content: string;
          created_at?: string;
          banned_until?: string | null;
        };
        Update: {
          id?: string;
          race_id?: string;
          race_date?: string;
          user_id?: string | null;
          username?: string;
          avatar_initials?: string;
          is_pro?: boolean;
          win_rate?: number;
          winning_streak?: number;
          content?: string;
          created_at?: string;
          banned_until?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "race_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      race_message_reactions: {
        Row: {
          message_id: string;
          user_id: string;
          emoji: "🔥" | "👀" | "❌";
          created_at: string;
        };
        Insert: {
          message_id: string;
          user_id: string;
          emoji: "🔥" | "👀" | "❌";
          created_at?: string;
        };
        Update: {
          message_id?: string;
          user_id?: string;
          emoji?: "🔥" | "👀" | "❌";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "race_message_reactions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "race_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      race_chat_bans: {
        Row: {
          user_id: string;
          banned_until: string;
          reason: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          banned_until: string;
          reason?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          banned_until?: string;
          reason?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "race_chat_bans_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_streaks: {
        Row: {
          user_id: string;
          current_streak: number;
          best_streak: number;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          current_streak?: number;
          best_streak?: number;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          current_streak?: number;
          best_streak?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_streaks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
