create table if not exists public.analysis_posts (
    id uuid default gen_random_uuid() primary key,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    symbol text not null,
    title text not null,
    content text not null,
    image_url text,
    author_id uuid references auth.users not null
);

alter table public.analysis_posts enable row level security;
create policy "Enable read access for all users" on public.analysis_posts for select using (true);
create policy "Enable insert for authenticated users only" on public.analysis_posts for insert with check (auth.uid() = author_id);
create policy "Enable update for authors" on public.analysis_posts for update using (auth.uid() = author_id);
create policy "Enable delete for authors" on public.analysis_posts for delete using (auth.uid() = author_id);
