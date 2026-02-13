import { Watchlist, LatestPrice, WatchlistState } from './types';

/**
 * Check if a price is within the buy zone
 */
export function isInZone(
    price: number,
    buyMin: number | null,
    buyMax: number | null
): boolean {
    // Both bounds required; if one is null, treat as open-ended
    if (buyMin !== null && price < buyMin) return false;
    if (buyMax !== null && price > buyMax) return false;

    // Must have at least one bound defined
    if (buyMin === null && buyMax === null) return false;

    return true;
}

/**
 * Check if an alert should be triggered (edge-triggered logic)
 */
export function shouldTriggerAlert(
    currentPrice: number,
    watchlist: Watchlist,
    state: WatchlistState | null
): boolean {
    const currentlyInZone = isInZone(currentPrice, watchlist.buy_min, watchlist.buy_max);

    // Not in zone now, no alert
    if (!currentlyInZone) return false;

    // No previous state, trigger if in zone
    if (!state) return true;

    // Was already in zone, don't retrigger
    if (state.last_in_zone) return false;

    // Was out of zone, now in zone -> trigger
    return true;
}

/**
 * Check if cooldown period has passed
 */
export function isCooldownExpired(
    lastAlertAt: string | null,
    cooldownMinutes: number
): boolean {
    if (!lastAlertAt) return true;

    const lastAlert = new Date(lastAlertAt);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastAlert.getTime()) / (1000 * 60);

    return diffMinutes >= cooldownMinutes;
}

/**
 * Generate alert reason text
 */
export function generateAlertReason(
    symbol: string,
    price: number,
    buyMin: number | null,
    buyMax: number | null
): string {
    const formattedPrice = price.toLocaleString('vi-VN');
    if (buyMin !== null && buyMax !== null) {
        return `${symbol} tiến vào vùng mua (Inzone): ${formattedPrice} (Vùng: ${buyMin.toLocaleString('vi-VN')} - ${buyMax.toLocaleString('vi-VN')})`;
    } else if (buyMin !== null) {
        return `${symbol} vượt mức tối thiểu: ${formattedPrice} (Tối thiểu: ${buyMin.toLocaleString('vi-VN')})`;
    } else if (buyMax !== null) {
        return `${symbol} dưới mức tối đa: ${formattedPrice} (Tối đa: ${buyMax.toLocaleString('vi-VN')})`;
    }
    return `${symbol} cập nhật giá: ${formattedPrice}`;
}
