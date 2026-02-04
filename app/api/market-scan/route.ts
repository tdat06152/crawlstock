
import { NextRequest, NextResponse } from 'next/server';
import { getScanSnapshot } from '@/lib/sheets-client';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    if (!date) {
        return NextResponse.json({ error: 'Date required' }, { status: 400 });
    }

    try {
        const data = await getScanSnapshot(date);
        return NextResponse.json(data);
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch snapshot' }, { status: 500 });
    }
}
