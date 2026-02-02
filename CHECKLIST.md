# Project Checklist

## Core Requirements
- [x] Next.js 14 (App Router), TypeScript
- [x] TailwindCSS UI (compact "electronic board" table)
- [x] Supabase: Auth + Postgres + Row Level Security
- [x] Deployment target: Vercel
- [x] Background job: Vercel Cron

## Features
- [x] **Auth**: Email/password login, RLS enforced
- [x] **Watchlist**: CRUD, Upper case symbols, Buy zones (min/max), Cooldown
- [x] **Price Fetch**: 15-min cron, Alpha Vantage integration, Throttling/Caching
- [x] **Alert Logic**: Edge-triggered, Cooldown, Anti-spam
- [x] **Notifications**: In-app notifications page, Browser notifications (UI ready)
- [x] **UI**: Sortable table, Status indicators, Search

## Technical Details
- [x] **No Realtime Websocket**: Polling implemented
- [x] **Data Source**: Alpha Vantage TIME_SERIES_INTRADAY
- [x] **Security**: API routes protected by auth, Cron protected by secret header

## Deliverables
- [x] Complete Next.js code
- [x] Supabase SQL migrations (`supabase/migrations/20260202_initial_schema.sql`)
- [x] README with setup instructions
- [x] Minimal unit tests (`__tests__/alert-logic.test.ts`)
