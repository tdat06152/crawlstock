
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

export default function AlertsPage() {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        checkAuthAndLoad();
    }, []);

    const checkAuthAndLoad = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
            return;
        }
        setUser(user);

        const { data } = await supabase
            .from('alerts')
            .select('*')
            .eq('user_id', user.id)
            .order('scan_date', { ascending: false })
            .order('created_at', { ascending: false });

        if (data) setAlerts(data);
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <Header user={user} />
            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8">
                    <h2 className="text-3xl font-extrabold tracking-tight mb-2">Lịch Sử Cảnh Báo</h2>
                    <p className="text-slate-500">Các tín hiệu đã được tạo cho danh mục theo dõi của bạn.</p>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center p-20">
                        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <div className="bg-white rounded-3xl border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                        {alerts.length === 0 ? (
                            <div className="p-20 text-center">
                                <div className="text-5xl mb-4 grayscale opacity-20">🔔</div>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Chưa có cảnh báo nào</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-50">
                                {alerts.map((alert) => (
                                    <div key={alert.id} className="p-6 hover:bg-slate-50 transition-all flex items-start gap-4 group">
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shrink-0 shadow-sm border ${getAlertIconStyles(alert)}`}>
                                            {getAlertIcon(alert)}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-xl font-black text-slate-900 group-hover:text-accent transition-colors tracking-tight">{alert.symbol}</h3>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${alert.strategy === 'RSI' ? 'bg-indigo-100 text-indigo-600' :
                                                            alert.strategy === 'EMA200_MACD' ? 'bg-emerald-100 text-emerald-600' :
                                                                'bg-amber-100 text-amber-600'}`}>
                                                        {alert.strategy}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                                    {new Date(alert.scan_date).toLocaleDateString('vi-VN')}
                                                </span>
                                            </div>
                                            <p className="text-slate-600 font-bold mt-1 text-sm">{alert.message}</p>

                                            <div className="mt-3 flex flex-wrap gap-2">
                                                {alert.strategy === 'RSI' ? (
                                                    <>
                                                        <MetadataBadge label="RSI" value={alert.rsi} />
                                                        <MetadataBadge label="Slope" value={alert.slope_5} />
                                                    </>
                                                ) : alert.strategy === 'EMA200_MACD' ? (
                                                    <>
                                                        <MetadataBadge label="MACD" value={alert.macd?.toFixed(2)} />
                                                        <MetadataBadge label="Hist" value={alert.macd_hist?.toFixed(2)} />
                                                        <MetadataBadge label="EMA200" value={new Intl.NumberFormat('vi-VN').format((alert.ema200 || 0) * 1000)} />
                                                    </>
                                                ) : (
                                                    <>
                                                        <MetadataBadge label="VolRatio" value={`${alert.vol_ratio}x`} />
                                                        <MetadataBadge label="ADX" value={alert.adx14} />
                                                        <MetadataBadge label="Upper BB" value={alert.bb_upper} />
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}

function MetadataBadge({ label, value }: { label: string, value: any }) {
    return (
        <span className="inline-flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-black text-slate-500 border border-slate-200 shadow-sm">
            <span className="text-slate-400 uppercase tracking-tighter">{label}:</span>
            <span className="text-slate-700">{value}</span>
        </span>
    );
}

function getAlertIcon(alert: any) {
    if (alert.signal_type === 'BUY') return '🚀';
    if (alert.signal_type === 'SELL' || alert.signal_type === 'EXIT') return '⚠️';
    if (alert.state === 'OVERBOUGHT') return '📈';
    if (alert.state === 'OVERSOLD') return '📉';
    return '🔔';
}

function getAlertIconStyles(alert: any) {
    if (alert.signal_type === 'BUY' || alert.state === 'OVERSOLD') return 'bg-emerald-50 text-emerald-500 border-emerald-100';
    if (alert.signal_type === 'SELL' || alert.signal_type === 'EXIT' || alert.state === 'OVERBOUGHT') return 'bg-rose-50 text-rose-500 border-rose-100';
    return 'bg-blue-50 text-blue-500 border-blue-100';
}
