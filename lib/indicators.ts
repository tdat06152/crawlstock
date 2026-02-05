
/**
 * Technical Indicators Calculation Logic
 */

/**
 * Calculate Exponential Moving Average (EMA)
 * @param data Array of closing prices
 * @param period EMA period (e.g., 200)
 */
export function calculateEMA(data: number[], period: number): (number | null)[] {
    if (data.length < period) {
        return new Array(data.length).fill(null);
    }

    const ema: (number | null)[] = new Array(data.length).fill(null);
    const alpha = 2 / (period + 1);

    // Initial EMA: Simplified - use first data point or SMA
    // Option A: Use SMA of first N periods to initialize
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    let initialSMA = sum / period;
    ema[period - 1] = initialSMA;

    // Subsequent values
    for (let i = period; i < data.length; i++) {
        ema[i] = data[i] * alpha + ema[i - 1]! * (1 - alpha);
    }

    return ema;
}

export interface MACDResult {
    macd: (number | null)[];
    signal: (number | null)[];
    histogram: (number | null)[];
}

/**
 * Calculate MACD (12, 26, 9)
 */
export function calculateMACD(
    data: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9
): MACDResult {
    const emaFast = calculateEMA(data, fastPeriod);
    const emaSlow = calculateEMA(data, slowPeriod);

    const macd: (number | null)[] = new Array(data.length).fill(null);
    for (let i = 0; i < data.length; i++) {
        if (emaFast[i] !== null && emaSlow[i] !== null) {
            macd[i] = emaFast[i]! - emaSlow[i]!;
        }
    }

    // Signal line is EMA of MACD
    // We need to filter out nulls to calculate EMA, then map back?
    // Or just pass the macd array with nulls and handle inside calculateEMA.
    // Let's modify calculateEMA to handle starting from the first non-null.

    const macdValidValues = macd.filter((v): v is number => v !== null);
    const signalValid = calculateEMA(macdValidValues, signalPeriod);

    const signal: (number | null)[] = new Array(data.length).fill(null);
    const histogram: (number | null)[] = new Array(data.length).fill(null);

    // Map back valid signal values to original indices
    let validIdx = 0;
    for (let i = 0; i < data.length; i++) {
        if (macd[i] !== null) {
            if (signalValid[validIdx] !== null) {
                signal[i] = signalValid[validIdx];
                histogram[i] = macd[i]! - signal[i]!;
            }
            validIdx++;
        }
    }

    return { macd, signal, histogram };
}

export type EMAMACDState = 'EMA200_MACD_BUY' | 'EMA200_MACD_SELL' | 'EMA200_MACD_BULL_NO_SIGNAL' | 'EMA200_MACD_BEAR';

export interface EMAMACDAnalysis {
    ema200: number | null;
    distance_to_ema200_pct: number | null;
    macd: number | null;
    macd_signal: number | null;
    macd_hist: number | null;
    macd_cross: 'cross_up' | 'cross_down' | 'none';
    state: EMAMACDState;
}

export function analyzeEMAMACD(
    closes: number[],
    emaPeriod: number = 200,
    macdFast: number = 12,
    macdSlow: number = 26,
    macdSignal: number = 9,
    nearEmaPct: number = 2.0
): EMAMACDAnalysis {
    const emas = calculateEMA(closes, emaPeriod);
    const { macd, signal, histogram } = calculateMACD(closes, macdFast, macdSlow, macdSignal);

    const i = closes.length - 1;
    const currentClose = closes[i];
    const currentEma = emas[i];
    const currentMacd = macd[i];
    const currentSignal = signal[i];
    const currentHist = histogram[i];

    const prevHist = i > 0 ? histogram[i - 1] : null;

    if (currentEma === null || currentMacd === null || currentSignal === null || currentHist === null) {
        return {
            ema200: currentEma,
            distance_to_ema200_pct: null,
            macd: currentMacd,
            macd_signal: currentSignal,
            macd_hist: currentHist,
            macd_cross: 'none',
            state: 'EMA200_MACD_BEAR'
        };
    }

    const distancePct = ((currentClose - currentEma) / currentEma) * 100;
    const isTrendBull = currentClose >= currentEma;

    let macdCross: 'cross_up' | 'cross_down' | 'none' = 'none';
    if (prevHist !== null) {
        if (currentHist > 0 && prevHist <= 0) macdCross = 'cross_up';
        else if (currentHist < 0 && prevHist >= 0) macdCross = 'cross_down';
    }

    let state: EMAMACDState = isTrendBull ? 'EMA200_MACD_BULL_NO_SIGNAL' : 'EMA200_MACD_BEAR';

    // Entry Logic
    if (isTrendBull && macdCross === 'cross_up') {
        state = 'EMA200_MACD_BUY';
    }

    // Exit Logic
    if (macdCross === 'cross_down' || (currentClose < currentEma && i > 0 && closes[i - 1] >= emas[i - 1]!)) {
        // Only trigger SELL if we were bull or if macd crosses down
        if (macdCross === 'cross_down' || currentClose < currentEma) {
            state = 'EMA200_MACD_SELL';
        }
    }

    // Refinement: If it's already BEAR, keep it BEAR unless it's a new SELL signal? 
    // Actually the enum should represent the current standing.
    if (!isTrendBull && state !== 'EMA200_MACD_SELL') {
        state = 'EMA200_MACD_BEAR';
    }

    return {
        ema200: parseFloat(currentEma.toFixed(2)),
        distance_to_ema200_pct: parseFloat(distancePct.toFixed(2)),
        macd: parseFloat(currentMacd.toFixed(2)),
        macd_signal: parseFloat(currentSignal.toFixed(2)),
        macd_hist: parseFloat(currentHist.toFixed(2)),
        macd_cross: macdCross,
        state: state
    };
}
