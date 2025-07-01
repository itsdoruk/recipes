export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          username: string | null
          full_name: string | null
          avatar_url: string | null
          bio: string | null
          show_email: boolean
          is_admin: boolean
          warnings: number
          banned: boolean
          ban_type: string | null
          ban_reason: string | null
          ban_expiry: string | null
          last_ban_date: string | null
          ban_count: number
          created_at: string
          updated_at: string
          email: string | null
          dietary_restrictions: string[] | null
          cooking_skill_level: string | null
        }
        Insert: {
          id?: string
          user_id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          show_email?: boolean
          is_admin?: boolean
          warnings?: number
          banned?: boolean
          ban_type?: string | null
          ban_reason?: string | null
          ban_expiry?: string | null
          last_ban_date?: string | null
          ban_count?: number
          created_at?: string
          updated_at?: string
          email?: string | null
          dietary_restrictions?: string[] | null
          cooking_skill_level?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          show_email?: boolean
          is_admin?: boolean
          warnings?: number
          banned?: boolean
          ban_type?: string | null
          ban_reason?: string | null
          ban_expiry?: string | null
          last_ban_date?: string | null
          ban_count?: number
          created_at?: string
          updated_at?: string
          email?: string | null
          dietary_restrictions?: string[] | null
          cooking_skill_level?: string | null
        }
      }
      recipes: {
        Row: {
          id: string
          created_at: string
          title: string
          description: string
          ingredients: string[]
          instructions: string[]
          nutrition: {
            calories: string
            protein: string
            fat: string
            carbohydrates: string
          }
          cuisine_type: string
          diet_type: string
          cooking_time: string
          cooking_time_value?: number
          recipe_type: 'user' | 'spoonacular' | 'ai'
          user_id: string
          is_starred: boolean
          spoonacular_id?: string
          image_url?: string | null
        }
        Insert: {
          id: string
          created_at?: string
          title: string
          description: string
          ingredients: string[]
          instructions: string[]
          nutrition: {
            calories: string
            protein: string
            fat: string
            carbohydrates: string
          }
          cuisine_type: string
          diet_type: string
          cooking_time: string
          cooking_time_value?: number
          recipe_type: 'user' | 'spoonacular' | 'ai'
          user_id: string
          is_starred?: boolean
          spoonacular_id?: string
          image_url?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          description?: string
          ingredients?: string[]
          instructions?: string[]
          nutrition?: {
            calories: string
            protein: string
            fat: string
            carbohydrates: string
          }
          cuisine_type?: string
          diet_type?: string
          cooking_time?: string
          cooking_time_value?: number
          recipe_type?: 'user' | 'spoonacular' | 'ai'
          user_id?: string
          is_starred?: boolean
          spoonacular_id?: string
          image_url?: string | null
        }
      }
      starred_recipes: {
        Row: {
          id: string
          created_at: string
          user_id: string
          recipe_id: string
          recipe_type: 'user' | 'spoonacular' | 'ai'
        }
        Insert: {
          id?: string
          created_at?: string
          user_id: string
          recipe_id: string
          recipe_type: 'user' | 'spoonacular' | 'ai'
        }
        Update: {
          id?: string
          created_at?: string
          user_id?: string
          recipe_id?: string
          recipe_type?: 'user' | 'spoonacular' | 'ai'
        }
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
  }
}

export interface Report {
  id: string;
  reported_user_id: string;
  reported_username: string | null;
  reported_avatar_url: string | null;
  reported_bio: string | null;
  reported_show_email: boolean;
  reported_is_admin: boolean;
  reported_full_name: string | null;
  reporter_username: string | null;
  reporter_avatar_url: string | null;
  status: string;
  warnings: number;
  ban_type: 'temporary' | 'permanent' | 'warning' | null;
  ban_reason: string | null;
  ban_expiry: string | null;
  last_ban_date: string | null;
  ban_count: number;
  created_at: string;
  updated_at: string;
  email: string | null;
  admin_id: string | null;
  reason: string;
  details: any;
  admin_notes?: string;
  recipe_type?: string;
  recipe_id?: string;
  title?: string;
  reviewed_by?: string;
  reviewer_username?: string;
  reviewed_at?: string;
}

export interface Profile {
  id: string;
  user_id: string;
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  show_email: boolean;
  is_admin: boolean;
  warnings: number;
  banned: boolean;
  ban_type: 'temporary' | 'permanent' | 'warning' | null;
  ban_reason: string | null;
  ban_expiry: string | null;
  last_ban_date: string | null;
  ban_count: number;
  created_at: string;
  updated_at: string;
  email: string | null;
  followers_count?: number;
  following_count?: number;
  dietary_restrictions: string[] | null;
  cooking_skill_level: string | null;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface ExtendedConversation extends Conversation {
  other_user: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  };
  last_message: Message | null;
}
