-- Add banned and ban_expiry columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ban_expiry TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS ban_type TEXT CHECK (ban_type IN ('temporary', 'permanent', 'warning')),
ADD COLUMN IF NOT EXISTS last_ban_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS ban_count INTEGER DEFAULT 0;

-- Add warnings column if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS warnings INTEGER DEFAULT 0;

-- Drop warnings table if it exists to ensure clean recreation
DROP TABLE IF EXISTS warnings CASCADE;

-- Create warnings table
CREATE TABLE warnings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    severity INTEGER CHECK (severity BETWEEN 1 AND 3),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Drop ban_history table if it exists to ensure clean recreation
DROP TABLE IF EXISTS ban_history CASCADE;

-- Create ban_history table
CREATE TABLE ban_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    ban_type TEXT NOT NULL CHECK (ban_type IN ('temporary', 'permanent', 'warning')),
    reason TEXT NOT NULL,
    ban_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ban_end TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Drop admin_audit_log table if it exists to ensure clean recreation
DROP TABLE IF EXISTS admin_audit_log CASCADE;

-- Create admin_audit_log table
CREATE TABLE admin_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_banned ON profiles(banned);
CREATE INDEX IF NOT EXISTS idx_profiles_ban_expiry ON profiles(ban_expiry);
CREATE INDEX IF NOT EXISTS idx_warnings_user_id ON warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_warnings_expires_at ON warnings(expires_at);
CREATE INDEX IF NOT EXISTS idx_ban_history_user_id ON ban_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ban_history_ban_end ON ban_history(ban_end);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);

-- Add RLS policies
ALTER TABLE warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ban_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view warnings
CREATE POLICY "Admins can view warnings" ON warnings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Only admins can insert warnings
CREATE POLICY "Admins can insert warnings" ON warnings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Only admins can view ban history
CREATE POLICY "Admins can view ban history" ON ban_history
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Only admins can insert ban history
CREATE POLICY "Admins can insert ban history" ON ban_history
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Only admins can view audit log
CREATE POLICY "Admins can view audit log" ON admin_audit_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Only admins can insert audit log
CREATE POLICY "Admins can insert audit log" ON admin_audit_log
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.user_id = auth.uid()
            AND profiles.is_admin = true
        )
    );

-- Create function to automatically update ban_count
CREATE OR REPLACE FUNCTION update_ban_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.banned = true AND (OLD.banned = false OR OLD.banned IS NULL) THEN
        NEW.ban_count = COALESCE(OLD.ban_count, 0) + 1;
        NEW.last_ban_date = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for ban_count
CREATE TRIGGER update_ban_count_trigger
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_ban_count();
