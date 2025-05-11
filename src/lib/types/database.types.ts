interface Database {
  public: {
    Tables: {
      blocks: {
        Row: {
          blocker_id: string;
          blocked_user_id: string;
          created_at: string;
        };
        Insert: {
          blocker_id: string;
          blocked_user_id: string;
          created_at?: string;
        };
        Update: {
          blocker_id?: string;
          blocked_user_id?: string;
          created_at?: string;
        };
      };
    };
  };
}
