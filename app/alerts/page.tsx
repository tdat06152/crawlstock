'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { Alert } from '@/lib/types';

export default function AlertsPage() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        checkAuth();
        loadAlerts();

        // Refresh alerts every 30 seconds
        const interval = setInterval(loadAlerts, 30000);
        return () => clearInterval(interval);
    }, []);

    const checkAuth = async () => {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            router.push('/login');
        }
    };

    const loadAlerts = async () => {
        try {
            const response = await fetch('/api/alerts');
            if (response.ok) {
                const data = await response.json();
                setAlerts(data);
            }
        } catch (error) {
            console.error('Error loading alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatTime = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
                <div className="text-white text-xl">Loading...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header */}
            <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
                <div className="max-w-4xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => router.push('/')}
                                className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 rounded-full transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <h1 className="text-xl font-black tracking-tight">Alerts History</h1>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                            Last 50 events
                        </span>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-4xl mx-auto px-6 py-10">
                <div className="space-y-4">
                    {alerts.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100 shadow-sm">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">No alerts triggered yet</h3>
                            <p className="text-slate-500 max-w-xs mx-auto text-sm mt-2">
                                We'll notify you here as soon as a stock enters your defined buy range.
                            </p>
                        </div>
                    ) : (
                        alerts.map((alert) => (
                            <div
                                key={alert.id}
                                className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-md transition-all group"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="font-mono font-black text-xl tracking-tighter text-slate-900">
                                                {alert.symbol}
                                            </span>
                                            <div className="w-1 h-1 bg-slate-300 rounded-full" />
                                            <span className="text-base font-bold text-emerald-600">
                                                {alert.price.toLocaleString()} VND
                                            </span>
                                        </div>
                                        <p className="text-slate-600 font-medium leading-relaxed">{alert.reason}</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-accent transition-colors">
                                            {formatTime(alert.triggered_at)}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>
        </div>
    );
}
