
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Header from '@/components/Header';
import NotificationManager from '@/components/NotificationManager';

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
        type: null,
        message: '',
    });
    const [updating, setUpdating] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            router.push('/login');
        } else {
            setUser(user);
        }
        setLoading(false);
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus({ type: null, message: '' });

        if (password !== confirmPassword) {
            setStatus({ type: 'error', message: 'Mật khẩu xác nhận không khớp.' });
            return;
        }

        if (password.length < 6) {
            setStatus({ type: 'error', message: 'Mật khẩu phải có ít nhất 6 ký tự.' });
            return;
        }

        setUpdating(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) {
                setStatus({ type: 'error', message: error.message });
            } else {
                setStatus({ type: 'success', message: 'Cập nhật mật khẩu thành công!' });
                setPassword('');
                setConfirmPassword('');
            }
        } catch (err: any) {
            setStatus({ type: 'error', message: 'Đã xảy ra lỗi không xác định.' });
        } finally {
            setUpdating(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <div className="text-slate-900 text-xl font-medium italic">Đang tải...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <NotificationManager />
            <Header user={user} />

            <main className="max-w-2xl mx-auto px-6 py-20">
                <div className="mb-10 text-center">
                    <h2 className="text-3xl font-extrabold tracking-tight mb-2 text-slate-900">Thông Tin Tài Khoản</h2>
                    <p className="text-slate-500 font-medium">
                        Quản lý mật khẩu và thông tin cá nhân của bạn
                    </p>
                </div>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden p-8">
                    <div className="mb-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                        <div className="text-sm text-slate-500 uppercase tracking-widest font-bold mb-1">Email Đăng Nhập</div>
                        <div className="text-lg font-bold text-slate-900">{user?.email}</div>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="space-y-6">
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                            Đổi Mật Khẩu
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Mật khẩu mới</label>
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Nhập ít nhất 6 ký tự..."
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all font-medium"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">Xác nhận mật khẩu mới</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Nhập lại mật khẩu mới..."
                                    className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition-all font-medium"
                                    required
                                />
                            </div>
                        </div>

                        {status.message && (
                            <div className={`p-4 rounded-2xl text-sm font-bold ${status.type === 'success' ? 'bg-green-50 text-green-700 border border-green-100' : 'bg-red-50 text-red-700 border border-red-100'
                                }`}>
                                {status.message}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={updating}
                            className="w-full py-4 bg-accent text-accent-foreground rounded-2xl font-bold shadow-xl shadow-accent/20 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:scale-100 transition-all text-lg"
                        >
                            {updating ? 'Đang cập nhật...' : 'Cập Nhật Mật Khẩu'}
                        </button>
                    </form>
                </div>

                <div className="mt-8 text-center">
                    <button
                        onClick={() => router.push('/')}
                        className="text-slate-500 hover:text-slate-900 font-bold transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Quay lại Trang Chủ
                    </button>
                </div>
            </main>
        </div>
    );
}
