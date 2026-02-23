-- Update role check constraint to include 'member'
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'user', 'pro', 'member'));

-- Comment for confirmation
COMMENT ON COLUMN profiles.role IS 'User role: admin, user, pro, or member';
