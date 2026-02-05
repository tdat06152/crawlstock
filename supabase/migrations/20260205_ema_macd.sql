
-- Update User Scan Settings
ALTER TABLE public.user_scan_settings 
ADD COLUMN IF NOT EXISTS enable_ema200_macd boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS ema_period int DEFAULT 200,
ADD COLUMN IF NOT EXISTS macd_fast int DEFAULT 12,
ADD COLUMN IF NOT EXISTS macd_slow int DEFAULT 26,
ADD COLUMN IF NOT EXISTS macd_signal int DEFAULT 9,
ADD COLUMN IF NOT EXISTS near_ema200_pct numeric DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS entry_mode text DEFAULT 'hist_cross'; -- 'hist_cross' | 'macd_gt_signal'

-- Update Alerts table
ALTER TABLE public.alerts 
ADD COLUMN IF NOT EXISTS strategy text DEFAULT 'RSI',
ADD COLUMN IF NOT EXISTS signal_type text DEFAULT 'INFO', -- BUY | SELL | INFO
ADD COLUMN IF NOT EXISTS ema200 numeric,
ADD COLUMN IF NOT EXISTS macd numeric,
ADD COLUMN IF NOT EXISTS macd_signal numeric,
ADD COLUMN IF NOT EXISTS macd_hist numeric;

-- Update unique index for alerts to support multiple strategies
DROP INDEX IF EXISTS idx_alerts_user_symbol_date_state; -- Old index if it existed
-- Note: The previous migration didn't explicitly name a unique index constraint besides the primary key.
-- But it had unique(user_id, symbol, scan_date, state) implicitly if we added one or were about to.
-- Let's add a proper unique constraint for deduplication.
ALTER TABLE public.alerts DROP CONSTRAINT IF EXISTS alerts_deduplication_idx;
ALTER TABLE public.alerts ADD CONSTRAINT alerts_deduplication_idx UNIQUE (user_id, symbol, scan_date, strategy, signal_type);

-- Refresh schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
