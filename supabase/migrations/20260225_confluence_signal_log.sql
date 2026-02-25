-- Bảng lưu lịch sử gửi tín hiệu đồng thuận 3 mẫu hình
-- Mục đích: Tránh gửi trùng lặp trong cùng 1 ngày cho cùng 1 mã + cùng loại tín hiệu

CREATE TABLE IF NOT EXISTS confluence_signal_log (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol        TEXT NOT NULL,
    signal        TEXT NOT NULL,          -- 'BUY' hoặc 'SELL'
    scan_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (symbol, signal, scan_date)    -- đảm bảo mỗi mã chỉ gửi 1 lần/ngày/loại tín hiệu
);

-- Index để query nhanh theo ngày
CREATE INDEX IF NOT EXISTS idx_confluence_signal_log_date
    ON confluence_signal_log (scan_date, symbol, signal);

-- RLS: chỉ service role mới được write
ALTER TABLE confluence_signal_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all" ON confluence_signal_log;
CREATE POLICY "service_role_all" ON confluence_signal_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);
