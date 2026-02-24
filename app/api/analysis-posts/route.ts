import { NextRequest, NextResponse } from 'next/server';
import { getServerClient } from '@/lib/supabase-server';

export async function GET(req: NextRequest) {
    const supabase = await getServerClient();
    const { data: posts, error } = await supabase
        .from('analysis_posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!posts || posts.length === 0) {
        return NextResponse.json([]);
    }

    // Lấy thông tin tác giả bằng quyền Service Client để vòng qua RLS của Auth Profile
    const { createServiceClient } = await import('@/lib/supabase-server');
    const serviceClient = createServiceClient();

    const authorIds = [...new Set(posts.map(p => p.author_id))];
    const { data: profiles } = await serviceClient
        .from('profiles')
        .select('id, email, role')
        .in('id', authorIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));

    const merged = posts.map(post => ({
        ...post,
        profiles: profileMap.get(post.author_id) || null
    }));

    return NextResponse.json(merged);
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
    const { symbol, title, content, image_url, sentiment } = body;

    const { data, error } = await supabase
        .from('analysis_posts')
        .insert({
            symbol: symbol.toUpperCase(),
            title,
            content,
            image_url,
            sentiment: sentiment || 'NEUTRAL',
            author_id: user.id
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
}
