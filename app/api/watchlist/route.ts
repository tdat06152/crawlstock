import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerClient } from '@/lib/supabase-server';
import { VNMarketClient } from '@/lib/vn-market';

export async function GET(request: NextRequest) {
    const supabase = await getServerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch watchlists
    const { data: watchlists, error: watchlistError } = await supabase
        .from('watchlists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

    if (watchlistError) {
        console.error('Watchlist fetch error:', watchlistError);
        return NextResponse.json({ error: watchlistError.message }, { status: 500 });
    }

    if (!watchlists || watchlists.length === 0) {
        return NextResponse.json([]);
    }

    // Fetch latest prices separately to avoid join issues
    const symbols = Array.from(new Set(watchlists.map(w => w.symbol)));
    const { data: prices, error: priceError } = await supabase
        .from('latest_prices')
        .select('*')
        .in('symbol', symbols);

    if (priceError) {
        console.error('Price fetch error:', priceError);
        // We can still return watchlists without prices
        return NextResponse.json(watchlists.map(w => ({ ...w, latest_price: null })));
    }

    const priceMap = new Map(prices?.map(p => [p.symbol, p]) || []);
    const watchlistsWithPrices = watchlists.map(w => ({
        ...w,
        latest_price: priceMap.get(w.symbol) || null
    }));

    return NextResponse.json(watchlistsWithPrices);
}

export async function POST(request: NextRequest) {
    const supabase = await getServerClient();
    const serviceClient = createServiceClient();
    const vnMarket = new VNMarketClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    // Handle both snake_case and camelCase just in case
    const symbol = body.symbol;
    const buy_min = body.buy_min !== undefined ? body.buy_min : body.buyMin;
    const buy_max = body.buy_max !== undefined ? body.buy_max : body.buyMax;
    const cooldown_minutes = body.cooldown_minutes !== undefined ? body.cooldown_minutes : (body.cooldown || 60);

    // Validate input
    if (!symbol || typeof symbol !== 'string') {
        return NextResponse.json({ error: 'Invalid symbol' }, { status: 400 });
    }

    const cleanSymbol = symbol.toUpperCase();

    // Insert watchlist
    const { data, error } = await supabase
        .from('watchlists')
        .insert({
            user_id: user.id,
            symbol: cleanSymbol,
            buy_min: buy_min !== undefined ? buy_min : null,
            buy_max: buy_max !== undefined ? buy_max : null,
            cooldown_minutes: cooldown_minutes,
            enabled: true
        })
        .select()
        .single();

    if (error) {
        console.error('Watchlist insert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Attempt immediate price fetch
    try {
        const priceData = await vnMarket.getLatestPrice(cleanSymbol);
        if (priceData) {
            await serviceClient.from('latest_prices').upsert({
                symbol: priceData.symbol,
                price: priceData.price,
                ts: priceData.timestamp,
                updated_at: new Date().toISOString()
            });
        }
    } catch (err) {
        console.error('Failed immediate price fetch:', err);
    }

    return NextResponse.json(data, { status: 201 });
}

export async function PUT(request: NextRequest) {
    const supabase = await getServerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, symbol, enabled } = body;
    const buy_min = body.buy_min !== undefined ? body.buy_min : body.buyMin;
    const buy_max = body.buy_max !== undefined ? body.buy_max : body.buyMax;
    const cooldown_minutes = body.cooldown_minutes !== undefined ? body.cooldown_minutes : body.cooldown;

    if (!id) {
        return NextResponse.json({ error: 'Missing watchlist ID' }, { status: 400 });
    }

    // Update watchlist
    const { data, error } = await supabase
        .from('watchlists')
        .update({
            symbol: symbol ? symbol.toUpperCase() : undefined,
            buy_min: buy_min !== undefined ? buy_min : undefined,
            buy_max: buy_max !== undefined ? buy_max : undefined,
            enabled: enabled !== undefined ? enabled : undefined,
            cooldown_minutes: cooldown_minutes !== undefined ? cooldown_minutes : undefined
        })
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

    if (error) {
        console.error('Watchlist update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
    const supabase = await getServerClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'Missing watchlist ID' }, { status: 400 });
    }

    // Delete watchlist
    const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
