
/**
 * RSI Calculation Logic
 * Uses Wilder's Smoothing Method
 */

export interface OHLC {
    t: number; // timestamp in seconds
    o: number; // open
    c: number; // close price
    h: number; // high
    l: number; // low
    v: number; // volume
}

export interface RSIResult {
    value: number | null;
    slope_5: number | null;
    state: 'OVERSOLD' | 'OVERBOUGHT' | 'NEUTRAL';
    near_flag: 'NEAR_OVERSOLD' | 'NEAR_OVERBOUGHT' | 'none';
    distance_to_30: number | null;
    distance_to_70: number | null;
}

export interface RSISettings {
    period: number;
    overbought: number;
    oversold: number;
    near_overbought_from: number;
    near_oversold_to: number;
}

export const DEFAULT_RSI_SETTINGS: RSISettings = {
    period: 14,
    overbought: 70,
    oversold: 30,
    near_overbought_from: 65,
    near_oversold_to: 35
};

export function calculateRSIArray(closes: number[], period: number = 14): (number | null)[] {
    if (closes.length < period + 1) {
        return new Array(closes.length).fill(null);
    }

    const rsiArray: (number | null)[] = new Array(closes.length).fill(null);
    let avgGain = 0;
    let avgLoss = 0;

    // First RSI Calculation
    // 1. Calculate sum of gains and losses for first 'period' days
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) avgGain += change;
        else avgLoss += Math.abs(change);
    }

    avgGain /= period;
    avgLoss /= period;

    // Initial RSI
    if (avgLoss === 0) rsiArray[period] = 100;
    else if (avgGain === 0) rsiArray[period] = 0;
    else {
        const rs = avgGain / avgLoss;
        rsiArray[period] = 100 - (100 / (1 + rs));
    }

    // Subsequent calculations (Wilder's Smoothing)
    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        const gain = change > 0 ? change : 0;
        const loss = change < 0 ? Math.abs(change) : 0;

        avgGain = ((avgGain * (period - 1)) + gain) / period;
        avgLoss = ((avgLoss * (period - 1)) + loss) / period;

        if (avgLoss === 0) rsiArray[i] = 100;
        else if (avgGain === 0) rsiArray[i] = 0;
        else {
            const rs = avgGain / avgLoss;
            rsiArray[i] = 100 - (100 / (1 + rs));
        }
    }

    return rsiArray;
}

export function analyzeRSI(
    rsiSeries: (number | null)[],
    settings: RSISettings = DEFAULT_RSI_SETTINGS
): RSIResult {
    const currentRSI = rsiSeries[rsiSeries.length - 1];

    if (currentRSI === null || currentRSI === undefined) {
        return {
            value: null,
            slope_5: null,
            state: 'NEUTRAL',
            near_flag: 'none',
            distance_to_30: null,
            distance_to_70: null
        };
    }

    // State Logic
    let state: RSIResult['state'] = 'NEUTRAL';
    if (currentRSI > settings.overbought) state = 'OVERBOUGHT';
    else if (currentRSI < settings.oversold) state = 'OVERSOLD';

    // Near Flag Logic
    let near_flag: RSIResult['near_flag'] = 'none';
    if (state === 'NEUTRAL') {
        if (currentRSI >= settings.near_overbought_from && currentRSI < settings.overbought) {
            near_flag = 'NEAR_OVERBOUGHT';
        } else if (currentRSI > settings.oversold && currentRSI <= settings.near_oversold_to) {
            near_flag = 'NEAR_OVERSOLD';
        }
    }

    // Slope 5 days
    // RSI_today - RSI_5days_ago / 5;
    let slope_5: number | null = null;
    const index5DaysAgo = rsiSeries.length - 1 - 5;
    if (index5DaysAgo >= 0 && rsiSeries[index5DaysAgo] !== null) {
        slope_5 = (currentRSI - rsiSeries[index5DaysAgo]!) / 5;
    }

    return {
        value: parseFloat(currentRSI.toFixed(2)),
        slope_5: slope_5 ? parseFloat(slope_5.toFixed(2)) : null,
        state,
        near_flag,
        distance_to_30: parseFloat((currentRSI - 30).toFixed(2)),
        distance_to_70: parseFloat((currentRSI - 70).toFixed(2))
    };
}
