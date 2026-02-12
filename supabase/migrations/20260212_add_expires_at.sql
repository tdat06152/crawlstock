-- Add expires_at to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add comment to expires_at
COMMENT ON COLUMN profiles.expires_at IS 'Date after which the user should not be able to access the system';
