'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import NotificationManager from '@/components/NotificationManager';
import { createClient } from '@/lib/supabase-client';

export default function AnalysisPostsPage() {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<string>('user');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [form, setForm] = useState({
        symbol: '',
        title: '',
        content: '',
        image_url: ''
    });

    const supabase = createClient();

    useEffect(() => {
        checkAuth();
        loadPosts();
    }, []);

    const checkAuth = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        setUser(user);
        if (user) {
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            if (data) setRole(data.role);
        }
    };

    const loadPosts = async () => {
        try {
            const res = await fetch('/api/analysis-posts');
            if (res.ok) {
                const data = await res.json();
                setPosts(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/analysis-posts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form)
            });

            if (res.ok) {
                setForm({ symbol: '', title: '', content: '', image_url: '' });
                loadPosts();
                alert('Đăng bài phân tích thành công!');
            } else {
                alert('Có lỗi xảy ra khi lưu bài phân tích');
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <NotificationManager />
            <Header user={user} />

            <main className="max-w-5xl mx-auto px-6 py-10">
                <div className="mb-10">
                    <h2 className="text-4xl font-extrabold tracking-tight mb-2 text-slate-900">Bài Phân Tích</h2>
                    <p className="text-slate-500 font-medium">Báo cáo & góc nhìn chuyên sâu về các mã cổ phiếu</p>
                </div>

                {(user && (role === 'admin' || role === 'member')) && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-10">
                        <h3 className="text-lg font-bold mb-4">Tạo Bài Phân Tích Mới</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mã CP (ví dụ: FPT)</label>
                                    <input
                                        required
                                        value={form.symbol}
                                        onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })}
                                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-accent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu Đề</label>
                                    <input
                                        required
                                        value={form.title}
                                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                                        className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-accent"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Link Ảnh Minh Hoạ (Tuỳ chọn)</label>
                                <input
                                    value={form.image_url}
                                    onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                                    placeholder="https://"
                                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-accent"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nội dung (Phân tích kĩ thuật, cơ bản...)</label>
                                <textarea
                                    required
                                    rows={5}
                                    value={form.content}
                                    onChange={(e) => setForm({ ...form, content: e.target.value })}
                                    className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-accent"
                                ></textarea>
                            </div>
                            <button
                                disabled={isSubmitting}
                                type="submit"
                                className="px-6 py-2 bg-accent text-white font-bold rounded-lg hover:bg-accent/90 disabled:opacity-50"
                            >
                                {isSubmitting ? 'ĐANG LƯU...' : 'ĐĂNG BÀI'}
                            </button>
                        </form>
                    </div>
                )}

                <div className="space-y-6">
                    {loading ? (
                        <div className="text-center py-10 text-slate-500">Đang tải các bài viết...</div>
                    ) : posts.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                            <p className="text-slate-500">Chưa có bài phân tích nào.</p>
                        </div>
                    ) : (
                        posts.map(post => (
                            <article key={post.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
                                {post.image_url && (
                                    <div className="md:w-1/3 bg-slate-100 flex-shrink-0">
                                        <img src={post.image_url} alt="" className="w-full h-full object-cover min-h-[200px]" />
                                    </div>
                                )}
                                <div className="p-6 md:w-2/3 flex flex-col justify-center">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="font-black bg-accent/10 text-accent px-2 py-0.5 rounded text-xs uppercase tracking-wider">{post.symbol}</span>
                                        <span className="text-xs text-slate-400 font-medium">{new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                    <h3 className="text-2xl font-bold mb-3">{post.title}</h3>
                                    <p className="text-slate-600 mb-4 whitespace-pre-wrap">{post.content}</p>
                                    <div className="text-xs text-slate-400 font-medium flex items-center gap-2">
                                        Đăng bởi: {post.profiles?.email?.split('@')[0] || 'Unknown User'}
                                    </div>
                                </div>
                            </article>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
