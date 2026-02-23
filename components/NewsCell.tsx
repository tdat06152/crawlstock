'use client';

import { useState, useEffect } from 'react';

export default function NewsCell({ symbol }: { symbol: string }) {
    const [news, setNews] = useState<string | null>(null);
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

    return (
        <div className="flex flex-col gap-1 max-w-[200px]">
            <span
                className={`text-[9px] font-bold px-1.5 py-0.5 w-fit rounded ${sentiment === 'GOOD' ? 'bg-emerald-100 text-emerald-700' :
                        sentiment === 'BAD' ? 'bg-rose-100 text-rose-700' :
                            'bg-slate-100 text-slate-600'
                    }`}
            >
                {sentiment === 'GOOD' ? '👍 TÍCH CỰC' : sentiment === 'BAD' ? '👎 TIÊU CỰC' : 'TIN TỨC'}
            </span>
            <span className="text-xs text-slate-700 line-clamp-2 leading-tight" title={news}>
                {news}
            </span>
        </div>
    );
}
