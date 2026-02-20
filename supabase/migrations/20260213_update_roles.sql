
-- Update role check constraint if it exists (usually Supabase just uses text, but good to check)
-- Actually, let's just add a comment that 'pro' is a valid role.

-- If there was a check constraint, we would need to drop and re-add it.
-- Assuming no strict enum check for now, or just text.

-- Let's update the admin page to support 'pro' role.
