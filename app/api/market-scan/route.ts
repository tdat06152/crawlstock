
import { NextRequest, NextResponse } from 'next/server';
import { getScanSnapshot } from '@/lib/sheets-client';
import { getServerClient } from '@/lib/supabase-server';
import { VN30_SYMBOLS } from '@/lib/constants';

export async function GET(req: NextRequest) {
    const supabase = await getServerClient();

    // 1. Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const date = searchParams.get('date');

    if (!date) {
        return NextResponse.json({ error: 'Date required' }, { status: 400 });
    }

    try {
        // 2. Fetch User Profile for Role
        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        const role = profile?.role || 'user';

        // 3. Fetch Scan Snapshot with fallback up to 5 days
        let allItems: any[] = [];
        let currentDate = new Date(date);

        for (let i = 0; i < 5; i++) {
            const formattedDate = currentDate.toISOString().split('T')[0];
            allItems = await getScanSnapshot(formattedDate);
            if (allItems && allItems.length > 0) {
                break;
            }
            // Go back 1 day
            currentDate.setDate(currentDate.getDate() - 1);
        }

        if (role === 'admin') {
            return NextResponse.json(allItems);
        }

        // 4. If regular user, filter by VN30 + their watchlist
        const { data: userWatchlist } = await supabase
            .from('watchlists')
            .select('symbol')
            .eq('user_id', user.id);

        const userSymbols = userWatchlist?.map(w => w.symbol?.toUpperCase().trim()) || [];
        const allowedSymbols = new Set([...VN30_SYMBOLS, ...userSymbols]);

        const filteredItems = allItems.filter((item: any) =>
            item.symbol && allowedSymbols.has(item.symbol.toUpperCase().trim())
        );

        return NextResponse.json(filteredItems);
    } catch (error) {
        console.error('Market scan API error:', error);
        return NextResponse.json({ error: 'Failed to fetch snapshot' }, { status: 500 });
    }
}
