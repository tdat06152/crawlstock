export interface Watchlist {
    id: string;
    user_id: string;
    symbol: string;
    buy_min: number | null;
    buy_max: number | null;
    enabled: boolean;
    cooldown_minutes: number;
    created_at: string;
}

export interface LatestPrice {
    symbol: string;
    price: number;
    ts: string;
    updated_at: string;
}

export interface WatchlistState {
    watchlist_id: string;
    last_in_zone: boolean;
    last_price: number | null;
    last_ts: string | null;
    last_alert_at: string | null;
}

export interface Alert {
    id: string;
    user_id: string;
    watchlist_id: string;
    symbol: string;
    price: number;
    triggered_at: string;
    reason: string;
}

export interface WatchlistWithPrice extends Watchlist {
    latest_price?: LatestPrice;
    in_zone?: boolean;
}
