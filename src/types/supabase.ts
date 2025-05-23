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
          is_private: boolean
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
        }
        Insert: {
          id?: string
          user_id: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          is_private?: boolean
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
        }
        Update: {
          id?: string
          user_id?: string
          username?: string | null
          full_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          is_private?: boolean
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

export type Profile = Database['public']['Tables']['profiles']['Row'];
