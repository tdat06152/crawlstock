
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function Header({ user }: { user: any }) {
    const router = useRouter();
    const supabase = createClient();
    const [role, setRole] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            fetchProfile();
        }
    }, [user]);

    const fetchProfile = async () => {
        const { data, error } = await supabase
            .from('profiles')
            .select('role, expires_at')
            .eq('id', user.id)
            .single();

        if (data) {
            setRole(data.role);

            // Check expiration
            if (data.expires_at) {
                const expiry = new Date(data.expires_at);
                const now = new Date();
                if (now > expiry) {
                    alert('Tài khoản của bạn đã hết hạn sử dụng. Vui lòng liên hệ Admin.');
                    handleSignOut();
                }
            }
        } else {
            setRole('user');
        }
    };



    const handleSignOut = async () => {
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => router.push('/')}>
                            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
                                <svg className="w-6 h-6 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">StockMonitor</h1>
                                <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                                    REAL-TIME INSIGHTS
                                </p>
                            </div>
                        </div>

                        <nav className="hidden md:flex items-center gap-1">
                            <NavLink href="/" label="Danh Mục" />
                            <NavLink href="/market-scan" label="Tín Hiệu Thị Trường" />
                            <NavLink href="/alerts" label="Cảnh Báo" />
                            {role === 'admin' && (
                                <NavLink href="/admin" label="Quản Trị" />
                            )}
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/profile')}
                            className="flex flex-col items-end hover:bg-slate-50 px-3 py-1.5 rounded-xl transition-colors"
                        >
                            <span className="hidden sm:inline text-xs font-bold text-slate-900">
                                {user?.email?.split('@')[0]}
                            </span>
                            {role && (
                                <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                                    {role}
                                </span>
                            )}
                        </button>
                        <button
                            onClick={handleSignOut}
                            className="px-4 py-2 text-sm font-semibold border border-red-200 text-red-600 rounded-full hover:bg-red-50 transition-colors"
                        >
                            Đăng Xuất
                        </button>
                    </div>
                </div>
            </div>
        </header>
    );
}


function NavLink({ href, label }: { href: string; label: string }) {
    const router = useRouter();
    // Use simple path check - in real app use usePathname
    const isActive = false; // Simplified

    return (
        <button
            onClick={() => router.push(href)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive
                ? 'bg-accent/10 text-accent'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
        >
            {label}
        </button>
    );
}
