
import { NextRequest, NextResponse } from 'next/server';
import { getSymbolHistory } from '@/lib/market-data';
import { analyzeMediumTerm } from '@/lib/medium-term-strategy';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');

    if (!symbol) {
        return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
    }

    try {
        // Fetch Daily Data (need at least 250 days for EMA 200 + buffer)
        const ohlc = await getSymbolHistory(symbol, 300);

        if (ohlc.length < 200) {
            return NextResponse.json({
                symbol,
                trend: 'NEUTRAL',
                setup: 'NONE',
                recommendation: 'WAIT',
                confidence: 0,
                details: ['Not enough historical data'],
                metrics: null
            });
        }

        const analysis = analyzeMediumTerm(symbol, ohlc);

        return NextResponse.json(analysis);
    } catch (error) {
        console.error('Analysis error:', error);
        return NextResponse.json({ error: 'Failed to analyze symbol' }, { status: 500 });
    }
}
