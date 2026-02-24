import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerClient } from '@/lib/supabase-server';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = await params;
    const serviceClient = createServiceClient();

    // Fetch post first
    const { data: post, error } = await serviceClient
        .from('analysis_posts')
        .select('*')
        .eq('id', id)
        .single();

    if (error || !post) {
        console.error('Post fetch error:', error);
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Separately fetch the author profile to avoid FK join issues
    let profileData = null;
    if (post.author_id) {
        const { data: profile } = await serviceClient
            .from('profiles')
            .select('id, email, role')
            .eq('id', post.author_id)
            .single();
        profileData = profile;
    }

    return NextResponse.json({ ...post, profiles: profileData });
}

export async function PUT(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = await params;
    const supabase = await getServerClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'member')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the post to verify ownership
    const serviceClient = createServiceClient();
    const { data: post } = await serviceClient.from('analysis_posts').select('author_id').eq('id', id).single();
    if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Member can only edit their own posts; admin can edit any
    if (profile.role === 'member' && post.author_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden: bạn chỉ có thể chỉnh sửa bài của mình' }, { status: 403 });
    }

    const body = await req.json();
    const { symbol, title, content, image_url, sentiment } = body;

    const { data, error } = await serviceClient
        .from('analysis_posts')
        .update({
            symbol: symbol?.toUpperCase(),
            title,
            content,
            image_url,
            sentiment: sentiment || 'NEUTRAL',
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(data);
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = await params;
    const supabase = await getServerClient();

    // Check auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'member')) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch the post to verify ownership
    const serviceClient = createServiceClient();
    const { data: post } = await serviceClient.from('analysis_posts').select('author_id').eq('id', id).single();
    if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Member can only delete their own posts; admin can delete any
    if (profile.role === 'member' && post.author_id !== user.id) {
        return NextResponse.json({ error: 'Forbidden: bạn chỉ có thể xoá bài của mình' }, { status: 403 });
    }

    const { error } = await serviceClient.from('analysis_posts').delete().eq('id', id);
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
}
