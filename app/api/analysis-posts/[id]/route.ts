import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase-server';

export async function GET(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    const { id } = params;
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
