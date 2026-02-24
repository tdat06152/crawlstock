-- Add updated_at column to analysis_posts table
alter table public.analysis_posts
    add column if not exists updated_at timestamp with time zone;

-- Drop old restrictive RLS policies and replace with permissive ones
-- that allow service_role (used by admin API) to update/delete any post.
drop policy if exists "Enable update for authors" on public.analysis_posts;
drop policy if exists "Enable delete for authors" on public.analysis_posts;

-- Allow authors to update/delete their own posts.
-- The API layer handles admin overrides via service_role which bypasses RLS.
create policy "Enable update for authors or service role" on public.analysis_posts
    for update
    using (auth.uid() = author_id OR auth.role() = 'service_role');

create policy "Enable delete for authors or service role" on public.analysis_posts
    for delete
    using (auth.uid() = author_id OR auth.role() = 'service_role');
