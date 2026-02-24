-- Add sentiment column to analysis_posts table
alter table public.analysis_posts
    add column if not exists sentiment text check (sentiment in ('GOOD', 'BAD', 'NEUTRAL')) default 'NEUTRAL';
