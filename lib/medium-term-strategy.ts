
import { calculateEMA, calculateSMA } from './indicators';
import { calculateRSIArray, OHLC } from './rsi';

export interface MediumTermAnalysisResult {
    symbol: string;
    trend: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL';
    setup: 'PULLBACK' | 'BREAKOUT' | 'NONE';
    recommendation: 'BUY_PULLBACK' | 'BUY_BREAKOUT' | 'WAIT' | 'NO_TRADE' | 'EXIT';
    stopLoss: number | null;
    target: number | null;
    confidence: number;
    details: string[];
    metrics: {
        price: number;
        ema20: number;
        ema50: number;
        ema200: number;
        rsi: number;
        vol: number;
        volMa20: number;
    };
}

export function analyzeMediumTerm(symbol: string, ohlc: OHLC[]): MediumTermAnalysisResult {
    const closes = ohlc.map(c => c.c);
    const volumes = ohlc.map(c => c.v);
    const highs = ohlc.map(c => c.h);
    const lows = ohlc.map(c => c.l);
    const opens = ohlc.map((c, i) => c.o !== undefined ? c.o : (i > 0 ? closes[i - 1] : c.c));

    // Calculate Indicators
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const rsi = calculateRSIArray(closes, 14);
    const volMa20 = calculateSMA(volumes, 20);

    const idx = closes.length - 1;

    // Check data sufficiency
    if (idx < 200) {
        return {
            symbol,
            trend: 'NEUTRAL',
            setup: 'NONE',
            recommendation: 'WAIT',
            stopLoss: null,
            target: null,
            confidence: 0,
            details: ['Not enough data (need > 200 periods)'],
            metrics: { price: closes[idx], ema20: 0, ema50: 0, ema200: 0, rsi: 0, vol: 0, volMa20: 0 }
        };
    }

    const currentPrice = closes[idx];
    const cEma20 = ema20[idx] || 0;
    const cEma50 = ema50[idx] || 0;
    const cEma200 = ema200[idx] || 0;
    const cRsi = rsi[idx] || 0;
    const cVol = volumes[idx];
    const cVolMa = volMa20[idx] || 0;
    const prevEma50 = ema50[idx - 1] || 0;

    // --- 1. Identify Trend ---
    // Uptrend: Price > EMA200, EMA50 > EMA200, EMA50 Slope >= 0
    // Downtrend: Price < EMA200, EMA50 < EMA200, EMA50 Slope < 0

    const slope50 = cEma50 - prevEma50;
    let trend: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL' = 'NEUTRAL';

    if (currentPrice > cEma200 && cEma50 > cEma200 && slope50 >= 0) {
        trend = 'UPTREND';
    } else if (currentPrice < cEma200 && cEma50 < cEma200 && slope50 < 0) {
        trend = 'DOWNTREND';
    }

    // Initialize Result
    const result: MediumTermAnalysisResult = {
        symbol,
        trend,
        setup: 'NONE',
        recommendation: 'WAIT',
        stopLoss: null,
        target: null,
        confidence: 0,
        details: [`Trend: ${trend}`],
        metrics: {
            price: parseFloat(currentPrice.toFixed(2)),
            ema20: parseFloat(cEma20.toFixed(2)),
            ema50: parseFloat(cEma50.toFixed(2)),
            ema200: parseFloat(cEma200.toFixed(2)),
            rsi: parseFloat(cRsi.toFixed(2)),
            vol: cVol,
            volMa20: parseFloat(cVolMa.toFixed(2))
        }
    };

    if (trend === 'DOWNTREND') {
        result.recommendation = 'NO_TRADE';
        result.details.push('Price below EMA200 and bearish structure. Avoid long positions.');
        return result;
    }

    if (trend === 'NEUTRAL') {
        result.details.push('Market structure is mixed. Waiting for clear trend.');
        return result;
    }

    // --- 2. Analyze Setups (Only if UPTREND) ---

    // Setup A: PULLBACK
    // Logic: Price pulls back to EMA20-50 zone. 
    // We check if High/Low intersects [EMA50, EMA20] (assuming 20>50).
    const zoneTop = Math.max(cEma20, cEma50);
    const zoneBot = Math.min(cEma20, cEma50);
    const inZone = lows[idx] <= zoneTop && highs[idx] >= zoneBot;

    // RSI Condition > 40
    const rsiOk = cRsi > 40;

    // Rejection Candle
    // Pinbar: Lower wick >= 2 * body. Top half close.
    // Engulfing: Bullish Engulfing pattern.
    const open = opens[idx];
    const close = closes[idx];
    const high = highs[idx];
    const low = lows[idx];
    const body = Math.abs(close - open);
    const lowerWick = Math.min(open, close) - low;
    const upperWick = high - Math.max(open, close);

    const isGreen = close > open;
    const isPinbar = (lowerWick >= 2 * body) && (lowerWick > upperWick);

    // Engulfing Check
    let isEngulfing = false;
    const prevOpen = opens[idx - 1];
    const prevClose = closes[idx - 1];
    if (isGreen && prevClose < prevOpen) { // Prev was red
        if (close > prevOpen && open < prevClose) { // Wraps body
            isEngulfing = true;
        }
    }

    const isRejection = isPinbar || isEngulfing;

    // Volume Decreasing (vs Average / Previous days)
    // "Volume decreases during correction" -> Check avg volume of last 3 days < MA20 implies low volume pullback
    const avg3Vol = (volumes[idx] + volumes[idx - 1] + volumes[idx - 2]) / 3;
    const volDecreasing = avg3Vol < cVolMa;

    // Setup B: BREAKOUT
    // Consolidation 3-8 weeks (15-40 candles).
    // Breakout Candle: Close > Box High && Vol > VolMA20.

    const startLookback = idx - 15; // Min 3 weeks
    const endLookback = idx - 40;   // Max 8 weeks
    let isAccumulation = false;
    let boxHigh = 0;
    let boxLow = Infinity;

    // We search for a consolidation box ending yesterday (idx-1)
    // We check multiple potential box sizes between 15 and 40
    // Simplified: Check last 20 candles (approx 1 month) for tightness
    const consolidationLen = 20;
    let maxH = -Infinity;
    let minL = Infinity;
    let volSum = 0;

    for (let i = idx - consolidationLen; i < idx; i++) {
        if (highs[i] > maxH) maxH = highs[i];
        if (lows[i] < minL) minL = lows[i];
        volSum += volumes[i];
    }

    const range = (maxH - minL) / minL;
    const isTight = range < 0.15; // 15% box

    // Check volume decrease: 1st half vs 2nd half of consolidation
    let volSum1 = 0;
    let volSum2 = 0;
    const halfLen = Math.floor(consolidationLen / 2);
    for (let i = 0; i < halfLen; i++) {
        volSum1 += volumes[idx - consolidationLen + i];
        volSum2 += volumes[idx - halfLen + i];
    }
    const volDryUp = volSum2 < volSum1; // Volume lower in second half

    // Breakout Condition
    const breakout = close > maxH && cVol > cVolMa;

    // Logic Selection
    if (inZone && rsiOk && isRejection && volDecreasing) {
        result.setup = 'PULLBACK';
        result.stopLoss = Math.min(low, lows[idx - 1]) * 0.99; // Stop below swing low
        result.target = currentPrice + (currentPrice - result.stopLoss) * 2; // 2R
        result.recommendation = 'BUY_PULLBACK';
        result.confidence = 80;
        result.details.push('Confirmed Pullback to EMA20-50 zone.');
        if (isPinbar) result.details.push('Pinbar rejection candle detected.');
        if (isEngulfing) result.details.push('Bullish Engulfing pattern detected.');
    } else if (isTight && breakout && volDryUp) {
        result.setup = 'BREAKOUT';
        result.stopLoss = minL; // Stop at low of box
        result.target = currentPrice + (currentPrice - result.stopLoss) * 2; // 2R
        result.recommendation = 'BUY_BREAKOUT';
        result.confidence = 75;
        result.details.push(`Breakout from ${consolidationLen}-day consolidation.`);
        result.details.push(`Volume spike ${((cVol / cVolMa) * 100).toFixed(0)}% > average.`);
    } else {
        // Check if "Wait" or "Near setup"
        if (trend === 'UPTREND') {
            if (inZone) result.details.push('Price in Pullback zone. Waiting for rejection candle/volume.');
            else if (isTight) result.details.push('Price consolidating. Watch for breakout.');
            else result.details.push('Uptrend strong. Waiting for setup.');
        }
    }

    // Risk Check 1:2
    if (result.recommendation.startsWith('BUY')) {
        const risk = currentPrice - result.stopLoss!;
        const reward = result.target! - currentPrice;
        if (risk <= 0 || reward / risk < 2) {
            // If target is purely theoretical (2R), this check always passes.
            // But if stoploss is too close/far, we might adjust confidence.
            // Real check: Is StopLoss reasonable?
            const riskPct = (risk / currentPrice) * 100;
            if (riskPct > 12) { // Too wide stop
                result.recommendation = 'WAIT';
                result.details.push(`Stop Loss too wide (${riskPct.toFixed(1)}%). Risk/Reward unfavorable.`);
            }
        }
    }

    return result;
}
