
-- Update User Scan Settings for Bollinger Breakout
ALTER TABLE public.user_scan_settings 
ADD COLUMN IF NOT EXISTS enable_bb_breakout boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS bb_period int DEFAULT 20,
ADD COLUMN IF NOT EXISTS bb_std_mult numeric DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS vol_ma_period int DEFAULT 20,
ADD COLUMN IF NOT EXISTS vol_ratio_min numeric DEFAULT 1.30,
ADD COLUMN IF NOT EXISTS adx_period int DEFAULT 14,
ADD COLUMN IF NOT EXISTS adx_min numeric DEFAULT 20,
ADD COLUMN IF NOT EXISTS require_adx_rising boolean DEFAULT true;

-- Update Alerts table for Bollinger Breakout
ALTER TABLE public.alerts 
ADD COLUMN IF NOT EXISTS bb_upper numeric,
ADD COLUMN IF NOT EXISTS bb_mid numeric,
ADD COLUMN IF NOT EXISTS bb_lower numeric,
ADD COLUMN IF NOT EXISTS adx14 numeric,
ADD COLUMN IF NOT EXISTS vol_ratio numeric;

-- Refresh schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
