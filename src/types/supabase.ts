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
      recipes: {
        Row: {
          id: string
          created_at: string
          title: string
          description: string
          image_url: string | null
          user_id: string
          cuisine_type: string | null
          cooking_time: number | null
          diet_type: string | null
          ingredients: string[]
          instructions: string[]
          calories: number | null
          protein: number | null
          fat: number | null
          carbohydrates: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          title: string
          description: string
          image_url?: string | null
          user_id: string
          cuisine_type?: string | null
          cooking_time?: number | null
          diet_type?: string | null
          ingredients: string[]
          instructions: string[]
          calories?: number | null
          protein?: number | null
          fat?: number | null
          carbohydrates?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          title?: string
          description?: string
          image_url?: string | null
          user_id?: string
          cuisine_type?: string | null
          cooking_time?: number | null
          diet_type?: string | null
          ingredients?: string[]
          instructions?: string[]
          calories?: number | null
          protein?: number | null
          fat?: number | null
          carbohydrates?: number | null
        }
      }
      blocked_users: {
        Row: {
          id: string
          user_id: string
          blocked_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          blocked_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          blocked_user_id?: string
          created_at?: string
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