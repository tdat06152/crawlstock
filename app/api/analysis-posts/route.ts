import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const supabase = await getServerClient();
    const { data, error } = await supabase
        .from('analysis_posts')
        .select(`
            *,
            profiles:author_id (email, role)
        `)
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
    const supabase = await getServerClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'member')) {
        return NextResponse.json({ error: 'Forbidden. Only Admins and Members can post.' }, { status: 403 });
    }

    const body = await req.json();
    const { symbol, title, content, image_url } = body;

    const { data, error } = await supabase
        .from('analysis_posts')
        .insert({
            symbol: symbol.toUpperCase(),
            title,
            content,
            image_url,
            author_id: user.id
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
}
