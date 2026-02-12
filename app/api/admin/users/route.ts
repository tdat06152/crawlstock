import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient, getServerClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
    const supabase = await getServerClient();
    const serviceClient = createServiceClient();

    // 1. Verify user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 2. Verify admin
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 3. Fetch users from AUTH (The source of truth)
    const { data: { users }, error: authError } = await serviceClient.auth.admin.listUsers();
    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

    // 4. Fetch profiles to get roles and expiry
    const { data: profiles } = await supabase.from('profiles').select('*');
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

    // 5. Merge data
    const combined = users.map(u => ({
        id: u.id,
        email: u.email,
        role: profileMap.get(u.id)?.role || 'user',
        expires_at: profileMap.get(u.id)?.expires_at || null,
        created_at: u.created_at
    }));

    return NextResponse.json(combined);
}


export async function POST(request: NextRequest) {
    const supabase = await getServerClient();
    const serviceClient = createServiceClient();

    // 1. Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 2. Extract data
    const { email, password, role, expires_at } = await request.json();
    if (!email || !password) return NextResponse.json({ error: 'Email and password required' }, { status: 400 });

    // 3. Create Auth User
    const { data: authData, error: authError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true
    });

    if (authError) return NextResponse.json({ error: authError.message }, { status: 500 });

    // 4. Use upsert to be safe (it will create or update)
    const { data: profileData, error: profileError } = await serviceClient
        .from('profiles')
        .upsert({
            id: authData.user.id,
            email: email,
            role: role || 'user',
            expires_at: expires_at || null,
            updated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (profileError) {
        console.error('Profile creation error:', profileError);
        return NextResponse.json({ error: profileError.message }, { status: 500 });
    }


    return NextResponse.json(profileData);
}

export async function PUT(request: NextRequest) {
    const supabase = await getServerClient();
    const serviceClient = createServiceClient();

    // 1. Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    // 2. Update profile
    const { id, role, expires_at, password } = await request.json();
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    const updates: any = {};
    if (role) updates.role = role;
    if (expires_at !== undefined) updates.expires_at = expires_at;

    const { data, error } = await serviceClient
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 3. Optional password reset
    if (password) {
        const { error: passError } = await serviceClient.auth.admin.updateUserById(id, {
            password: password
        });
        if (passError) return NextResponse.json({ error: 'Profile updated, but password reset failed: ' + passError.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
    const supabase = await getServerClient();
    const serviceClient = createServiceClient();

    // 1. Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

    // 2. Delete Auth User (RLS/Cascade will handle profile)
    const { error: deleteError } = await serviceClient.auth.admin.deleteUser(id);
    if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

    return NextResponse.json({ success: true });
}
