'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import NotificationManager from '@/components/NotificationManager';
import { createClient } from '@/lib/supabase-client';
import ReactMarkdown from 'react-markdown';

type SentimentType = 'GOOD' | 'BAD' | 'NEUTRAL';

const SENTIMENT_CONFIG: Record<SentimentType, { label: string; className: string }> = {
    GOOD: { label: '👍 TÍCH CỰC', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    BAD: { label: '👎 TIÊU CỰC', className: 'bg-rose-100 text-rose-700 border-rose-200' },
    NEUTRAL: { label: '➡️ TRUNG LẬP', className: 'bg-slate-100 text-slate-600 border-slate-200' },
};

function AnalysisPostsContent() {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [role, setRole] = useState<string>('user');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedPost, setSelectedPost] = useState<any>(null);

    // Edit state
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        symbol: '',
        title: '',
        content: '',
        image_url: '',
        sentiment: 'NEUTRAL' as SentimentType,
    });
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    // Delete state
    const [deleteTarget, setDeleteTarget] = useState<any>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const searchParams = useSearchParams();
    const router = useRouter();

    const [form, setForm] = useState({
        symbol: '',
        title: '',
        content: '',
        image_url: '',
        sentiment: 'NEUTRAL' as SentimentType,
    });

    const supabase = createClient();

    useEffect(() => {
        checkAuth();
        loadPosts();
    }, []);

    // Nếu có query param ?id=xxx thì mở modal bài viết tương ứng
    useEffect(() => {
        const postId = searchParams.get('id');
        if (postId && posts.length > 0) {
            const found = posts.find(p => p.id === postId);
            if (found) {
                setSelectedPost(found);
            }
        }
    }, [searchParams, posts]);

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
                setForm({ symbol: '', title: '', content: '', image_url: '', sentiment: 'NEUTRAL' });
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

    const handleOpenPost = (post: any) => {
        setSelectedPost(post);
        setIsEditing(false);
        router.replace(`/analysis-posts?id=${post.id}`, { scroll: false });
    };

    const handleClosePost = () => {
        setSelectedPost(null);
        setIsEditing(false);
        router.replace('/analysis-posts', { scroll: false });
    };

    // ─── Kiểm tra quyền chỉnh sửa/xoá ─────────────────────────────────
    const canEditPost = (post: any) => {
        if (!user) return false;
        if (role === 'admin') return true;
        if (role === 'member' && post.author_id === user.id) return true;
        return false;
    };

    // ─── Chỉnh sửa bài viết ────────────────────────────────────────────
    const handleStartEdit = (post: any) => {
        setEditForm({
            symbol: post.symbol || '',
            title: post.title || '',
            content: post.content || '',
            image_url: post.image_url || '',
            sentiment: (post.sentiment as SentimentType) || 'NEUTRAL',
        });
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        if (!selectedPost) return;
        setIsSavingEdit(true);
        try {
            const res = await fetch(`/api/analysis-posts/${selectedPost.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            if (res.ok) {
                const updated = await res.json();
                // Cập nhật posts list & selectedPost
                const updatedWithProfile = { ...updated, profiles: selectedPost.profiles };
                setPosts(prev => prev.map(p => p.id === updated.id ? updatedWithProfile : p));
                setSelectedPost(updatedWithProfile);
                setIsEditing(false);
            } else {
                const err = await res.json();
                alert(err.error || 'Có lỗi khi lưu bài viết.');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsSavingEdit(false);
        }
    };

    // ─── Xoá bài viết ──────────────────────────────────────────────────
    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            const res = await fetch(`/api/analysis-posts/${deleteTarget.id}`, { method: 'DELETE' });
            if (res.ok) {
                setPosts(prev => prev.filter(p => p.id !== deleteTarget.id));
                setDeleteTarget(null);
                if (selectedPost?.id === deleteTarget.id) {
                    handleClosePost();
                }
            } else {
                const err = await res.json();
                alert(err.error || 'Có lỗi khi xoá bài viết.');
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <NotificationManager />
            <Header user={user} />

            <main className="max-w-5xl mx-auto px-6 py-10">
                <div className="mb-10">
                    <h2 className="text-4xl font-extrabold tracking-tight mb-2 text-slate-900">Bài Phân Tích</h2>
                    <p className="text-slate-500 font-medium">Báo cáo &amp; góc nhìn chuyên sâu về các mã cổ phiếu</p>
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

                            {/* Trường Tính Chất (Sentiment) */}
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tính Chất Bài Phân Tích</label>
                                <div className="flex gap-3">
                                    {(Object.entries(SENTIMENT_CONFIG) as [SentimentType, typeof SENTIMENT_CONFIG[SentimentType]][]).map(([key, cfg]) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => setForm({ ...form, sentiment: key })}
                                            className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition-all ${form.sentiment === key
                                                ? `${cfg.className} border-current ring-2 ring-offset-1 ring-current/30 scale-[1.02]`
                                                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                                }`}
                                        >
                                            {cfg.label}
                                        </button>
                                    ))}
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
                        posts.map(post => {
                            const sentiment = (post.sentiment as SentimentType) || 'NEUTRAL';
                            const sentCfg = SENTIMENT_CONFIG[sentiment];
                            return (
                                <article
                                    key={post.id}
                                    className="relative cursor-pointer bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all group"
                                >
                                    {/* Action buttons on card - chỉ hiện khi có quyền */}
                                    {canEditPost(post) && (
                                        <div className="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleOpenPost(post); handleStartEdit(post); }}
                                                title="Chỉnh sửa bài viết"
                                                className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L7.5 19.213l-4 1 1-4 12.362-12.726z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setDeleteTarget(post); }}
                                                title="Xoá bài viết"
                                                className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m4-3h2a1 1 0 011 1v1H8V5a1 1 0 011-1h2" />
                                                </svg>
                                            </button>
                                        </div>
                                    )}

                                    <div onClick={() => handleOpenPost(post)} className="flex flex-col flex-1">
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
                                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                                                <span className="font-black bg-accent/10 text-accent px-2.5 py-1 rounded text-[10px] uppercase tracking-widest">{post.symbol}</span>
                                                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${sentCfg.className}`}>
                                                    {sentCfg.label}
                                                </span>
                                                <span className="text-xs text-slate-400 font-medium ml-auto">{new Date(post.created_at).toLocaleDateString('vi-VN')}</span>
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
                                    </div>
                                </article>
                            );
                        })
                    )}
                </div>

                {/* ─── Modal Chi Tiết Bài Phân Tích ─────────────────────────── */}
                {selectedPost && (
                    <div
                        className="fixed inset-0 z-50 flex justify-center items-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm"
                        onClick={(e) => { if (e.target === e.currentTarget) handleClosePost(); }}
                    >
                        <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-300 relative flex flex-col">
                            {/* Top action bar */}
                            <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                                {/* Nút Edit */}
                                {canEditPost(selectedPost) && !isEditing && (
                                    <button
                                        onClick={() => handleStartEdit(selectedPost)}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-white/80 backdrop-blur-md rounded-full text-xs font-bold text-blue-600 border border-blue-200 hover:bg-blue-50 hover:scale-105 active:scale-95 transition-all shadow-sm"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.25 2.25 0 113.182 3.182L7.5 19.213l-4 1 1-4 12.362-12.726z" />
                                        </svg>
                                        Chỉnh sửa
                                    </button>
                                )}
                                {/* Nút Delete */}
                                {canEditPost(selectedPost) && !isEditing && (
                                    <button
                                        onClick={() => setDeleteTarget(selectedPost)}
                                        className="flex items-center gap-1.5 px-3 py-2 bg-white/80 backdrop-blur-md rounded-full text-xs font-bold text-rose-600 border border-rose-200 hover:bg-rose-50 hover:scale-105 active:scale-95 transition-all shadow-sm"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7h6m2 0H7m4-3h2a1 1 0 011 1v1H8V5a1 1 0 011-1h2" />
                                        </svg>
                                        Xoá
                                    </button>
                                )}
                                {/* Nút Đóng */}
                                <button
                                    onClick={handleClosePost}
                                    className="w-10 h-10 bg-white/50 backdrop-blur-md rounded-full flex items-center justify-center text-slate-900 border border-slate-200 hover:bg-white hover:scale-110 active:scale-95 transition-all shadow-sm"
                                >
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            <div className="overflow-y-auto w-full h-full flex flex-col">
                                {/* ── CHẾ ĐỘ ĐỌC ──────────────────────────────── */}
                                {!isEditing && (
                                    <>
                                        {selectedPost.image_url && (
                                            <div className="w-full bg-slate-100 relative shrink-0 h-64 sm:h-80 md:h-[400px]">
                                                <img
                                                    src={selectedPost.image_url}
                                                    alt=""
                                                    className="absolute inset-0 w-full h-full object-cover"
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                                                <div className="absolute bottom-6 left-6 right-6 text-white md:bottom-10 md:left-10 md:right-10 drop-shadow-lg">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="inline-block font-black bg-accent text-white px-3 py-1 rounded-lg text-xs uppercase tracking-widest shadow-lg">{selectedPost.symbol}</span>
                                                        {(() => {
                                                            const s = (selectedPost.sentiment as SentimentType) || 'NEUTRAL';
                                                            const c = SENTIMENT_CONFIG[s];
                                                            return <span className={`text-[9px] font-bold px-2.5 py-1 rounded-lg border ${c.className}`}>{c.label}</span>;
                                                        })()}
                                                    </div>
                                                    <h2 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">{selectedPost.title}</h2>
                                                </div>
                                            </div>
                                        )}

                                        <div className="p-6 md:p-10 grow">
                                            {!selectedPost.image_url && (
                                                <div className="mb-8">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <span className="inline-block font-black bg-accent/10 text-accent px-3 py-1 rounded-lg text-xs uppercase tracking-widest">{selectedPost.symbol}</span>
                                                        {(() => {
                                                            const s = (selectedPost.sentiment as SentimentType) || 'NEUTRAL';
                                                            const c = SENTIMENT_CONFIG[s];
                                                            return <span className={`text-xs font-bold px-3 py-1 rounded-lg border ${c.className}`}>{c.label}</span>;
                                                        })()}
                                                    </div>
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
                                                {selectedPost.updated_at && selectedPost.updated_at !== selectedPost.created_at && (
                                                    <span className="ml-auto text-xs text-slate-400 italic">Đã chỉnh sửa {new Date(selectedPost.updated_at).toLocaleDateString('vi-VN')}</span>
                                                )}
                                            </div>

                                            <div className="prose prose-slate prose-lg md:prose-xl max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-accent prose-img:rounded-2xl">
                                                <ReactMarkdown>{selectedPost.content}</ReactMarkdown>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* ── CHẾ ĐỘ CHỈNH SỬA ────────────────────────── */}
                                {isEditing && (
                                    <div className="p-6 md:p-10">
                                        <h3 className="text-2xl font-extrabold text-slate-900 mb-6">✏️ Chỉnh Sửa Bài Phân Tích</h3>
                                        <div className="space-y-5">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mã CP</label>
                                                    <input
                                                        value={editForm.symbol}
                                                        onChange={(e) => setEditForm({ ...editForm, symbol: e.target.value.toUpperCase() })}
                                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-accent focus:outline-none text-slate-800 font-medium"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tiêu Đề</label>
                                                    <input
                                                        value={editForm.title}
                                                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                                                        className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-accent focus:outline-none text-slate-800 font-medium"
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Tính Chất</label>
                                                <div className="flex gap-3">
                                                    {(Object.entries(SENTIMENT_CONFIG) as [SentimentType, typeof SENTIMENT_CONFIG[SentimentType]][]).map(([key, cfg]) => (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => setEditForm({ ...editForm, sentiment: key })}
                                                            className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition-all ${editForm.sentiment === key
                                                                ? `${cfg.className} border-current ring-2 ring-offset-1 ring-current/30 scale-[1.02]`
                                                                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                                                }`}
                                                        >
                                                            {cfg.label}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Link Ảnh Minh Hoạ</label>
                                                <input
                                                    value={editForm.image_url}
                                                    onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })}
                                                    placeholder="https://"
                                                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-accent focus:outline-none text-slate-800"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nội Dung (Markdown)</label>
                                                <textarea
                                                    rows={10}
                                                    value={editForm.content}
                                                    onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                                                    className="w-full border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-accent focus:outline-none text-slate-800 font-mono text-sm leading-relaxed"
                                                ></textarea>
                                            </div>

                                            <div className="flex items-center gap-3 pt-2">
                                                <button
                                                    onClick={handleSaveEdit}
                                                    disabled={isSavingEdit}
                                                    className="px-6 py-2.5 bg-accent text-white font-bold rounded-xl hover:bg-accent/90 disabled:opacity-50 transition-all"
                                                >
                                                    {isSavingEdit ? 'Đang lưu...' : '💾 Lưu thay đổi'}
                                                </button>
                                                <button
                                                    onClick={() => setIsEditing(false)}
                                                    className="px-6 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                                                >
                                                    Huỷ
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── Dialog Xác Nhận Xoá ───────────────────────────────────── */}
                {deleteTarget && (
                    <div
                        className="fixed inset-0 z-[60] flex justify-center items-center p-4 bg-slate-900/70 backdrop-blur-sm"
                        onClick={(e) => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
                    >
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 animate-in fade-in zoom-in duration-200">
                            <div className="w-14 h-14 bg-rose-100 rounded-2xl flex items-center justify-center mx-auto mb-5">
                                <svg className="w-7 h-7 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-extrabold text-slate-900 text-center mb-2">Xác nhận xoá bài?</h3>
                            <p className="text-sm text-slate-500 text-center mb-1">Bạn sắp xoá bài phân tích:</p>
                            <p className="text-sm font-bold text-slate-800 text-center mb-6 px-2 line-clamp-2">"{deleteTarget.title}"</p>
                            <p className="text-xs text-rose-500 text-center mb-6 font-medium">⚠️ Hành động này không thể hoàn tác.</p>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                                >
                                    Huỷ
                                </button>
                                <button
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                    className="flex-1 py-2.5 bg-rose-600 text-white font-bold rounded-xl hover:bg-rose-700 disabled:opacity-50 transition-all"
                                >
                                    {isDeleting ? 'Đang xoá...' : '🗑️ Xoá bài'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}

export default function AnalysisPostsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div></div>}>
            <AnalysisPostsContent />
        </Suspense>
    );
}
