'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface NewsItem {
    title: string;
    link: string;
}

export default function NewsCell({ symbol }: { symbol: string }) {
    const [news, setNews] = useState<NewsItem | null>(null);
    const [sentiment, setSentiment] = useState<'GOOD' | 'BAD' | 'NEUTRAL' | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchNews = async () => {
            try {
                const res = await fetch(`/api/news/evaluate?symbol=${symbol}`);
                if (res.ok) {
                    const data = await res.json();
                    if (isMounted) {
                        setNews(data.news);
                        setSentiment(data.sentiment);
                    }
                }
            } catch (error) {
                console.error('Failed to fetch news sentiment:', error);
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchNews();
        return () => { isMounted = false; };
    }, [symbol]);

    if (loading) {
        return <div className="animate-pulse space-y-1 w-32">
            <div className="h-2 bg-slate-200 rounded"></div>
            <div className="h-2 bg-slate-200 rounded w-2/3"></div>
        </div>;
    }

    if (!news) {
        return <span className="text-xs text-slate-400 italic">Không có tin đáng chú ý</span>;
    }

    const sentimentConfig = {
        GOOD: { label: '👍 TÍCH CỰC', className: 'bg-emerald-100 text-emerald-700' },
        BAD: { label: '👎 TIÊU CỰC', className: 'bg-rose-100 text-rose-700' },
        NEUTRAL: { label: '➡️ TRUNG LẬP', className: 'bg-slate-100 text-slate-600' },
    };

    const config = sentiment ? sentimentConfig[sentiment] : sentimentConfig.NEUTRAL;
    // Convert /analysis-posts/{id} links to use query param format for modal support
    const rawLink = news.link.startsWith('/analysis-posts/') && !news.link.includes('?')
        ? `/analysis-posts?id=${news.link.replace('/analysis-posts/', '')}`
        : news.link;
    const isInternal = rawLink.startsWith('/');

    return (
        <div className="flex flex-col gap-1 max-w-[200px]">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 w-fit rounded ${config.className}`}>
                {config.label}
            </span>
            {isInternal ? (
                <Link
                    href={rawLink}
                    className="text-xs text-slate-700 line-clamp-2 leading-tight hover:text-accent hover:underline transition-all"
                    title={news.title}
                >
                    {news.title}
                </Link>
            ) : (
                <a
                    href={rawLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-700 line-clamp-2 leading-tight hover:text-accent hover:underline transition-all"
                    title={news.title}
                >
                    {news.title}
                </a>
            )}
        </div>
    );
}
