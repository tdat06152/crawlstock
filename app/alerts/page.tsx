
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
                    <div className="text-center p-10">Loading...</div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                        {alerts.length === 0 ? (
                            <div className="p-10 text-center text-slate-500">Chưa có cảnh báo nào.</div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {alerts.map((alert) => (
                                    <div key={alert.id} className="p-6 hover:bg-slate-50 transition-colors flex items-start gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0 ${alert.state.includes('OVER') ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'
                                            }`}>
                                            {alert.state.includes('OVERSOLD') ? '📉' : '📈'}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between items-start">
                                                <h3 className="text-lg font-bold text-slate-800">{alert.symbol}</h3>
                                                <span className="text-xs font-semibold text-slate-400">
                                                    {new Date(alert.scan_date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p className="text-slate-600 font-medium mt-1">{alert.message}</p>
                                            <div className="mt-2 flex gap-2">
                                                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">
                                                    RSI: {alert.rsi}
                                                </span>
                                                <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500">
                                                    Slope: {alert.slope_5}
                                                </span>
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
