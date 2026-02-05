
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

/**
 * Calculate Simple Moving Average (SMA)
 */
export function calculateSMA(data: number[], period: number): (number | null)[] {
    if (data.length < period) {
        return new Array(data.length).fill(null);
    }

    const sma: (number | null)[] = new Array(data.length).fill(null);
    let sum = 0;
    for (let i = 0; i < period; i++) {
        sum += data[i];
    }
    sma[period - 1] = sum / period;

    for (let i = period; i < data.length; i++) {
        sum = sum - data[i - period] + data[i];
        sma[i] = sum / period;
    }

    return sma;
}

/**
 * Calculate Standard Deviation
 */
export function calculateStdDev(data: number[], period: number, smas: (number | null)[]): (number | null)[] {
    if (data.length < period) {
        return new Array(data.length).fill(null);
    }

    const stdDev: (number | null)[] = new Array(data.length).fill(null);

    for (let i = period - 1; i < data.length; i++) {
        const mean = smas[i];
        if (mean === null) continue;

        let sumSqDiff = 0;
        for (let j = i - period + 1; j <= i; j++) {
            sumSqDiff += Math.pow(data[j] - mean, 2);
        }
        stdDev[i] = Math.sqrt(sumSqDiff / period);
    }

    return stdDev;
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

    // Exit Logic: Cross down OR Price breaks below EMA200
    const prevClose = i > 0 ? closes[i - 1] : null;
    const prevEma = i > 0 ? emas[i - 1] : null;
    const priceBrokeDown = currentClose < currentEma && prevClose !== null && prevEma !== null && prevClose >= prevEma;

    if (macdCross === 'cross_down' || priceBrokeDown) {
        state = 'EMA200_MACD_SELL';
    }

    // Final check for Bear state
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

/**
 * Bollinger Breakout Strategy
 */
export type BBState = 'BB_BREAKOUT_BUY' | 'BB_BREAKOUT_EXIT' | 'BB_BREAKOUT_WEAK' | 'BB_NEUTRAL';

export interface BBResult {
    mid: (number | null)[];
    upper: (number | null)[];
    lower: (number | null)[];
}

export function calculateBB(data: number[], period: number = 20, multiplier: number = 2): BBResult {
    const mid = calculateSMA(data, period);
    const stdDev = calculateStdDev(data, period, mid);

    const upper: (number | null)[] = new Array(data.length).fill(null);
    const lower: (number | null)[] = new Array(data.length).fill(null);

    for (let i = 0; i < data.length; i++) {
        if (mid[i] !== null && stdDev[i] !== null) {
            upper[i] = mid[i]! + multiplier * stdDev[i]!;
            lower[i] = mid[i]! - multiplier * stdDev[i]!;
        }
    }

    return { mid, upper, lower };
}

export interface ADXResult {
    adx: (number | null)[];
    plusDI: (number | null)[];
    minusDI: (number | null)[];
}

/**
 * Calculate ADX(14) using Wilder's Smoothing
 */
export function calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): ADXResult {
    const n = closes.length;
    const adx: (number | null)[] = new Array(n).fill(null);
    const plusDI: (number | null)[] = new Array(n).fill(null);
    const minusDI: (number | null)[] = new Array(n).fill(null);

    if (n < period * 2) return { adx, plusDI, minusDI };

    const tr: number[] = new Array(n).fill(0);
    const plusDM: number[] = new Array(n).fill(0);
    const minusDM: number[] = new Array(n).fill(0);

    for (let i = 1; i < n; i++) {
        const h = highs[i];
        const l = lows[i];
        const pc = closes[i - 1];

        tr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));

        const upMove = h - highs[i - 1];
        const downMove = lows[i - 1] - l;

        plusDM[i] = (upMove > downMove && upMove > 0) ? upMove : 0;
        minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
    }

    const trSmooth: number[] = new Array(n).fill(0);
    const plusDMSmooth: number[] = new Array(n).fill(0);
    const minusDMSmooth: number[] = new Array(n).fill(0);

    // Initial smoothing (sum of first 'period' values)
    let trSum = 0, pDMSum = 0, mDMSum = 0;
    for (let i = 1; i <= period; i++) {
        trSum += tr[i];
        pDMSum += plusDM[i];
        mDMSum += minusDM[i];
    }
    trSmooth[period] = trSum;
    plusDMSmooth[period] = pDMSum;
    minusDMSmooth[period] = mDMSum;

    // Wilder's Smoothing
    for (let i = period + 1; i < n; i++) {
        trSmooth[i] = trSmooth[i - 1] - (trSmooth[i - 1] / period) + tr[i];
        plusDMSmooth[i] = plusDMSmooth[i - 1] - (plusDMSmooth[i - 1] / period) + plusDM[i];
        minusDMSmooth[i] = minusDMSmooth[i - 1] - (minusDMSmooth[i - 1] / period) + minusDM[i];
    }

    const dx: (number | null)[] = new Array(n).fill(null);
    for (let i = period; i < n; i++) {
        plusDI[i] = 100 * (plusDMSmooth[i] / trSmooth[i]);
        minusDI[i] = 100 * (minusDMSmooth[i] / trSmooth[i]);
        const diff = Math.abs(plusDI[i]! - minusDI[i]!);
        const sum = plusDI[i]! + minusDI[i]!;
        dx[i] = sum === 0 ? 0 : 100 * (diff / sum);
    }

    // ADX is the smoothed DX
    let dxSum = 0;
    for (let i = period; i < period * 2; i++) {
        dxSum += dx[i]!;
    }
    adx[period * 2 - 1] = dxSum / period;

    for (let i = period * 2; i < n; i++) {
        adx[i] = (adx[i - 1]! * (period - 1) + dx[i]!) / period;
    }

    return { adx, plusDI, minusDI };
}

export interface BBBreakoutAnalysis {
    mid: number | null;
    upper: number | null;
    lower: number | null;
    bandwidth_pct: number | null;
    vol_ma20: number | null;
    vol_ratio: number | null;
    adx14: number | null;
    plus_di14: number | null;
    minus_di14: number | null;
    state: BBState;
}

export function analyzeBBBreakout(
    highs: number[],
    lows: number[],
    closes: number[],
    volumes: number[],
    params: {
        bbPeriod?: number,
        bbStdMult?: number,
        volRatioMin?: number,
        adxMin?: number,
        requireAdxRising?: boolean
    } = {}
): BBBreakoutAnalysis {
    const {
        bbPeriod = 20,
        bbStdMult = 2,
        volRatioMin = 1.3,
        adxMin = 20,
        requireAdxRising = true
    } = params;

    const { mid, upper, lower } = calculateBB(closes, bbPeriod, bbStdMult);
    const { adx, plusDI, minusDI } = calculateADX(highs, lows, closes, 14);
    const volMA = calculateSMA(volumes, 20);

    const i = closes.length - 1;
    const currentClose = closes[i];
    const currentUpper = upper[i];
    const currentMid = mid[i];
    const currentVol = volumes[i];
    const currentVolMA = volMA[i];
    const currentADX = adx[i];
    const prevADX = i > 0 ? adx[i - 1] : null;

    const analysis: BBBreakoutAnalysis = {
        mid: currentMid,
        upper: currentUpper,
        lower: lower[i],
        bandwidth_pct: (currentUpper && lower[i] && currentMid) ? (currentUpper - lower[i]!) / currentMid * 100 : null,
        vol_ma20: currentVolMA,
        vol_ratio: (currentVol && currentVolMA) ? currentVol / currentVolMA : null,
        adx14: currentADX,
        plus_di14: plusDI[i],
        minus_di14: minusDI[i],
        state: 'BB_NEUTRAL'
    };

    if (!currentUpper || !currentMid || !currentVolMA || !currentADX) {
        return analysis;
    }

    const isBreakoutUp = currentClose > currentUpper;
    const volConfirm = analysis.vol_ratio! >= volRatioMin;
    const adxRising = prevADX !== null ? currentADX > prevADX : true;
    const adxConfirm = currentADX >= adxMin && (!requireAdxRising || adxRising);

    if (isBreakoutUp) {
        if (volConfirm && adxConfirm) {
            analysis.state = 'BB_BREAKOUT_BUY';
        } else {
            analysis.state = 'BB_BREAKOUT_WEAK';
        }
    } else if (currentClose < currentMid) {
        analysis.state = 'BB_BREAKOUT_EXIT';
    }

    // Rounds
    if (analysis.mid) analysis.mid = parseFloat(analysis.mid.toFixed(2));
    if (analysis.upper) analysis.upper = parseFloat(analysis.upper.toFixed(2));
    if (analysis.lower) analysis.lower = parseFloat(analysis.lower.toFixed(2));
    if (analysis.bandwidth_pct) analysis.bandwidth_pct = parseFloat(analysis.bandwidth_pct.toFixed(2));
    if (analysis.vol_ma20) analysis.vol_ma20 = parseFloat(analysis.vol_ma20.toFixed(2));
    if (analysis.vol_ratio) analysis.vol_ratio = parseFloat(analysis.vol_ratio.toFixed(2));
    if (analysis.adx14) analysis.adx14 = parseFloat(analysis.adx14.toFixed(2));
    if (analysis.plus_di14) analysis.plus_di14 = parseFloat(analysis.plus_di14.toFixed(2));
    if (analysis.minus_di14) analysis.minus_di14 = parseFloat(analysis.minus_di14.toFixed(2));

    return analysis;
}
