
import { NextRequest, NextResponse } from 'next/server';
import { runMarketScan } from '@/lib/market-scanner';

export const maxDuration = 300;

export async function GET(req: NextRequest) {
    const authHeader = req.headers.get('authorization');
    const xCronSecret = req.headers.get('x-cron-secret');
    const secret = process.env.CRON_SECRET;

    if (!secret) {
        return NextResponse.json({ error: 'Configuration Error' }, { status: 500 });
    }

    if (authHeader !== `Bearer ${secret}` && xCronSecret !== secret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await runMarketScan();
        return NextResponse.json(result);
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
