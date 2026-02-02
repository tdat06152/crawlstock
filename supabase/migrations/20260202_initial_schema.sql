-- Create watchlists table
CREATE TABLE IF NOT EXISTS watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  buy_min NUMERIC,
  buy_max NUMERIC,
  enabled BOOLEAN DEFAULT true,
  cooldown_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT symbol_uppercase CHECK (symbol = UPPER(symbol))
);

-- Create latest_prices table
CREATE TABLE IF NOT EXISTS latest_prices (
  symbol TEXT PRIMARY KEY,
  price NUMERIC NOT NULL,
  ts TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create watchlist_state table for edge-trigger logic
CREATE TABLE IF NOT EXISTS watchlist_state (
  watchlist_id UUID PRIMARY KEY REFERENCES watchlists(id) ON DELETE CASCADE,
  last_in_zone BOOLEAN DEFAULT false,
  last_price NUMERIC,
  last_ts TIMESTAMPTZ,
  last_alert_at TIMESTAMPTZ
);

-- Create alerts table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  watchlist_id UUID NOT NULL REFERENCES watchlists(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  price NUMERIC NOT NULL,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_watchlists_user_id ON watchlists(user_id);
CREATE INDEX IF NOT EXISTS idx_watchlists_symbol ON watchlists(symbol);
CREATE INDEX IF NOT EXISTS idx_alerts_user_id_triggered_at ON alerts(user_id, triggered_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_symbol ON alerts(symbol);

-- Enable Row Level Security
ALTER TABLE watchlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE latest_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE watchlist_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for watchlists
CREATE POLICY "Users can view their own watchlists"
  ON watchlists FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own watchlists"
  ON watchlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watchlists"
  ON watchlists FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watchlists"
  ON watchlists FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for latest_prices (readable by all authenticated users)
CREATE POLICY "Authenticated users can view latest prices"
  ON latest_prices FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for watchlist_state
CREATE POLICY "Users can view their own watchlist state"
  ON watchlist_state FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM watchlists
      WHERE watchlists.id = watchlist_state.watchlist_id
      AND watchlists.user_id = auth.uid()
    )
  );

-- RLS Policies for alerts
CREATE POLICY "Users can view their own alerts"
  ON alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alerts"
  ON alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
