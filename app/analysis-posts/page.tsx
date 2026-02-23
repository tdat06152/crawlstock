'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import NotificationManager from '@/components/NotificationManager';
import { createClient } from '@/lib/supabase-client';
import ReactMarkdown from 'react-markdown';

export default function AnalysisPostsPage() {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<string>('user');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPost, setSelectedPost] = useState<any>(null);

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
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nội dung (Hỗ trợ Markdown: **In Đậm**, # Tiêu Đề lớn, - Gạch đầu dòng...)</label>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {loading ? (
                        <div className="col-span-full text-center py-10 text-slate-500">Đang tải các bài viết...</div>
                    ) : posts.length === 0 ? (
                        <div className="col-span-full text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                            <p className="text-slate-500">Chưa có bài phân tích nào.</p>
                        </div>
                    ) : (
                        posts.map(post => (
                            <article
                                key={post.id}
                                onClick={() => setSelectedPost(post)}
                                className="cursor-pointer bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all group"
                            >
                                {post.image_url && (
                                    <div className="w-full h-48 bg-slate-100 relative overflow-hidden">
                                        <img
                                            src={post.image_url}
                                            alt=""
                                            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                        />
                                    </div>
                                )}
                                <div className="p-6 flex flex-col flex-1">
                                    <div className="flex items-center gap-2 mb-3">
                                        <span className="font-black bg-accent/10 text-accent px-2.5 py-1 rounded text-[10px] uppercase tracking-widest">{post.symbol}</span>
                                        <span className="text-xs text-slate-400 font-medium">{new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
                                    </div>
                                    <h3 className="text-xl font-bold mb-3 line-clamp-2 text-slate-900 leading-snug group-hover:text-accent transition-colors">{post.title}</h3>
                                    <p className="text-sm text-slate-500 mb-6 line-clamp-3 leading-relaxed">
                                        {post.content}
                                    </p>
                                    <div className="mt-auto text-xs text-slate-400 font-medium pt-4 border-t border-slate-100 flex items-center justify-between">
                                        <span>Bởi: {post.profiles?.email?.split('@')[0] || 'Unknown User'}</span>
                                        <span className="text-accent font-bold group-hover:underline">Đọc tiếp &rarr;</span>
                                    </div>
                                </div>
                            </article>
                        ))
                    )}
                </div>

                {/* Modal Chi Tiết Bài Phân Tích */}
                {selectedPost && (
                    <div className="fixed inset-0 z-50 flex justify-center items-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm">
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-300 relative flex flex-col">
                            {/* Nút đóng */}
                            <button
                                onClick={() => setSelectedPost(null)}
                                className="absolute top-4 right-4 z-20 w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-slate-900 border border-slate-200 hover:bg-white hover:scale-110 active:scale-95 transition-all shadow-sm"
                            >
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>

                            <div className="overflow-y-auto w-full h-full flex flex-col">
                                {selectedPost.image_url && (
                                    <div className="w-full bg-slate-100 relative shrink-0 h-64 sm:h-80 md:h-[400px]">
                                        <img
                                            src={selectedPost.image_url}
                                            alt=""
                                            className="absolute inset-0 w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                                        <div className="absolute bottom-6 left-6 right-6 text-white md:bottom-10 md:left-10 md:right-10 drop-shadow-lg">
                                            <span className="inline-block font-black bg-accent text-white px-3 py-1 rounded-lg text-xs uppercase tracking-widest mb-3 shadow-lg">{selectedPost.symbol}</span>
                                            <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">{selectedPost.title}</h2>
                                        </div>
                                    </div>
                                )}

                                <div className="p-6 md:p-10 grow">
                                    {!selectedPost.image_url && (
                                        <div className="mb-8">
                                            <span className="inline-block font-black bg-accent/10 text-accent px-3 py-1 rounded-lg text-xs uppercase tracking-widest mb-3">{selectedPost.symbol}</span>
                                            <h2 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight">{selectedPost.title}</h2>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 mb-10 text-sm font-medium text-slate-500 pb-6 border-b border-slate-100">
                                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold uppercase">
                                            {selectedPost.profiles?.email?.charAt(0) || 'U'}
                                        </div>
                                        <div>
                                            <div className="text-slate-900 font-bold">{selectedPost.profiles?.email?.split('@')[0] || 'Unknown User'}</div>
                                            <div>{new Date(selectedPost.created_at).toLocaleDateString('vi-VN')} lúc {new Date(selectedPost.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </div>
                                    </div>

                                    <div className="prose prose-slate prose-lg md:prose-xl max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-accent prose-img:rounded-2xl">
                                        <ReactMarkdown>{selectedPost.content}</ReactMarkdown>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
