'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';

export default function AnalysisPostDetailPage({ params }: { params: { id: string } }) {
    const [post, setPost] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const loadUser = async () => {
            const { createClient } = await import('@/lib/supabase-client');
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
        };
        loadUser();

        const loadPost = async () => {
            try {
                const res = await fetch(`/api/analysis-posts/${params.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setPost(data);
                } else {
                    setError('Không tìm thấy bài viết');
                }
            } catch (err) {
                setError('Lỗi khi tải bài viết');
            } finally {
                setLoading(false);
            }
        };
        loadPost();
    }, [params.id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
            </div>
        );
    }

    if (error || !post) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
                <h1 className="text-2xl font-bold text-slate-900 mb-4">{error || 'Bài viết không tồn tại'}</h1>
                <Link href="/analysis-posts" className="text-accent font-bold hover:underline">
                    &larr; Quay lại danh sách
                </Link>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <Header user={user} />
            <main className="max-w-4xl mx-auto px-6 py-10">
                <Link href="/analysis-posts" className="inline-flex items-center text-sm font-bold text-slate-500 hover:text-accent mb-8 transition-colors">
                    &larr; QUAY LẠI DANH SÁCH
                </Link>

                <article className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden">
                    {post.image_url && (
                        <div className="w-full h-64 sm:h-80 md:h-[400px] relative">
                            <img
                                src={post.image_url}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                            <div className="absolute bottom-6 left-6 right-6 text-white drop-shadow-lg">
                                <span className="inline-block font-black bg-accent text-white px-3 py-1 rounded-lg text-xs uppercase tracking-widest mb-3 shadow-lg">{post.symbol}</span>
                                <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight">{post.title}</h1>
                            </div>
                        </div>
                    )}

                    <div className="p-6 md:p-10">
                        {!post.image_url && (
                            <div className="mb-8">
                                <span className="inline-block font-black bg-accent/10 text-accent px-3 py-1 rounded-lg text-xs uppercase tracking-widest mb-3">{post.symbol}</span>
                                <h1 className="text-3xl md:text-5xl font-extrabold text-slate-900 leading-tight">{post.title}</h1>
                            </div>
                        )}

                        <div className="flex items-center gap-3 mb-10 text-sm font-medium text-slate-500 pb-6 border-b border-slate-100">
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold uppercase">
                                {post.profiles?.email?.charAt(0) || 'U'}
                            </div>
                            <div>
                                <div className="text-slate-900 font-bold">{post.profiles?.email?.split('@')[0] || 'Unknown User'}</div>
                                <div>{new Date(post.created_at).toLocaleDateString('vi-VN')} lúc {new Date(post.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                            </div>
                        </div>

                        <div className="prose prose-slate prose-lg md:prose-xl max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-a:text-accent prose-img:rounded-2xl">
                            <ReactMarkdown>{post.content}</ReactMarkdown>
                        </div>
                    </div>
                </article>
            </main>
        </div>
    );
}
