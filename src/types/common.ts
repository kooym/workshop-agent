export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Timestamped {
  created_at: string
  updated_at: string
}

export interface Entity {
  id: string
}
