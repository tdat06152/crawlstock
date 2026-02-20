
'use client';

import { useState } from 'react';
import Header from '@/components/Header';
import NotificationManager from '@/components/NotificationManager';
import { createClient } from '@/lib/supabase-client';

interface AnalysisResult {
    symbol: string;
    trend: 'UPTREND' | 'DOWNTREND' | 'NEUTRAL';
    setup: 'PULLBACK' | 'BREAKOUT' | 'NONE';
    recommendation: 'BUY_PULLBACK' | 'BUY_BREAKOUT' | 'WAIT' | 'NO_TRADE' | 'EXIT';
    stopLoss: number | null;
    target: number | null;
    confidence: number;
    details: string[];
    metrics: {
        price: number;
        ema20: number;
        ema50: number;
        ema200: number;
        rsi: number;
        vol: number;
        volMa20: number;
    } | null;
}

export default function MediumTermPage() {
    const [symbol, setSymbol] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [error, setError] = useState('');

    const supabase = createClient();
    const [user, setUser] = useState<any>(null);

    const [userRole, setUserRole] = useState<string | null>(null);

    // Check auth
    useState(() => {
        supabase.auth.getUser().then(async ({ data }) => {
            setUser(data.user);
            if (data.user) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', data.user.id)
                    .single();
                setUserRole(profile?.role || 'user');
            }
        });
    });

    const handleAnalyze = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!symbol) return;

        if (userRole !== 'pro' && userRole !== 'admin') {
            setError('Tính năng này chỉ dành cho tài khoản PRO. Vui lòng liên hệ Admin để nâng cấp.');
            return;
        }

        setLoading(true);
        setResult(null);
        setError('');

        try {
            const res = await fetch(`/api/medium-term-analysis?symbol=${symbol.toUpperCase()}`);
            if (!res.ok) throw new Error('Failed to fetch analysis');
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            setResult(data);
        } catch (err: any) {
            setError(err.message || 'Error occurred');
        } finally {
            setLoading(false);
        }
    };

    const getRecColor = (rec: string) => {
        if (rec.startsWith('BUY')) return 'text-emerald-600 bg-emerald-50 border-emerald-200';
        if (rec === 'NO_TRADE' || rec === 'EXIT') return 'text-red-600 bg-red-50 border-red-200';
        return 'text-amber-600 bg-amber-50 border-amber-200';
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <NotificationManager />
            <Header user={user} />

            <main className="max-w-4xl mx-auto px-6 py-10">
                <div className="mb-10 text-center">
                    <h2 className="text-3xl font-extrabold tracking-tight mb-2 text-slate-900">Xác Định Xu Hướng</h2>
                    <p className="text-slate-500 font-medium">
                        Công cụ chuyên sâu dành cho tài khoản Pro - Phân tích xu hướng và điểm vào lệnh tối ưu.
                    </p>
                </div>

                {userRole && userRole !== 'pro' && userRole !== 'admin' ? (
                    <div className="bg-white p-12 rounded-3xl shadow-xl border border-slate-200 text-center max-w-2xl mx-auto flex flex-col items-center gap-6">
                        <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m11 3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9l6 6m0-6l-6 6" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-2">Truy cập bị giới hạn</h3>
                            <p className="text-slate-500">
                                Tính năng <b>Xác định xu hướng</b> chỉ dành cho người dùng <b>PRO</b>.
                                Vui lòng liên hệ quản trị viên để nâng cấp tài khoản của bạn.
                            </p>
                        </div>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:scale-105 transition-all"
                        >
                            Quay lại Trang chủ
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Improved Search Bar */}
                        <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100 mb-8 max-w-xl mx-auto">
                            <form onSubmit={handleAnalyze} className="flex gap-3">
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        value={symbol}
                                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                                        placeholder="Nhập mã cổ phiếu (VD: HPG, FPT...)"
                                        className="w-full pl-5 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-bold text-lg uppercase placeholder:normal-case"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading || !symbol}
                                    className="px-6 py-3 bg-accent text-white rounded-2xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20 disabled:opacity-50 disabled:scale-100"
                                >
                                    {loading ? 'Đang quét...' : 'Phân Tích'}
                                </button>
                            </form>
                        </div>
                    </>
                )}

                {error && (
                    <div className="max-w-xl mx-auto p-4 bg-red-50 text-red-600 rounded-2xl border border-red-100 font-medium text-center mb-8">
                        {error}
                    </div>
                )}

                {result && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Recommendation Banner */}
                        <div className={`p-6 rounded-3xl border mb-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-sm ${getRecColor(result.recommendation)}`}>
                            <div className="text-center md:text-left">
                                <div className="text-sm font-bold opacity-80 uppercase tracking-widest mb-1">Khuyến Nghị</div>
                                <div className="text-3xl font-black tracking-tight flex items-center gap-3">
                                    {result.recommendation === 'BUY_PULLBACK' && 'MUA (PULLBACK)'}
                                    {result.recommendation === 'BUY_BREAKOUT' && 'MUA (BREAKOUT)'}
                                    {result.recommendation === 'WAIT' && 'CHỜ ĐỢI'}
                                    {result.recommendation === 'NO_TRADE' && 'KHÔNG GIAO DỊCH'}
                                    {result.recommendation === 'EXIT' && 'THOÁT VỊ THẾ'}
                                </div>
                            </div>

                            <div className="flex items-center gap-8">
                                <div className="text-center">
                                    <div className="text-xs font-bold opacity-70 uppercase mb-1">Độ Tin Cậy</div>
                                    <div className="text-2xl font-black">{result.confidence}/100</div>
                                </div>
                                {result.stopLoss && (
                                    <div className="flex gap-6 border-l border-current/20 pl-8">
                                        <div className="text-center">
                                            <div className="text-xs font-bold opacity-70 uppercase mb-1">Stop Loss</div>
                                            <div className="text-2xl font-black">{result.stopLoss.toLocaleString()}</div>
                                        </div>
                                        {result.target && (
                                            <div className="text-center border-l border-current/20 pl-6">
                                                <div className="text-xs font-bold opacity-70 uppercase mb-1">Target (2R)</div>
                                                <div className="text-2xl font-black">{result.target.toLocaleString()}</div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Technical Overview */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <span>📊</span> Thông Số Kỹ Thuật
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                        <span className="text-slate-500 font-medium">Giá hiện tại</span>
                                        <span className="font-bold text-slate-900">{result.metrics?.price.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                        <span className="text-slate-500 font-medium">Xu Hướng (Trend)</span>
                                        <span className={`font-bold px-2 py-1 rounded-lg text-xs uppercase ${result.trend === 'UPTREND' ? 'bg-green-100 text-green-700' :
                                            result.trend === 'DOWNTREND' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {result.trend}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                        <span className="text-slate-500 font-medium">Mô Hình (Setup)</span>
                                        <span className="font-bold text-slate-900">{result.setup}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-2 border-b border-slate-50">
                                        <span className="text-slate-500 font-medium">RSI (14)</span>
                                        <span className={`font-bold ${(result.metrics?.rsi || 0) > 70 ? 'text-red-500' :
                                            (result.metrics?.rsi || 0) < 30 ? 'text-green-500' : 'text-slate-900'
                                            }`}>
                                            {result.metrics?.rsi}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center py-2">
                                        <span className="text-slate-500 font-medium">Volume vs MA20</span>
                                        <span className={`font-bold ${(result.metrics?.vol || 0) > (result.metrics?.volMa20 || 0) ? 'text-green-600' : 'text-slate-400'
                                            }`}>
                                            {((result.metrics?.vol || 0) / (result.metrics?.volMa20 || 1) * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Analysis Details */}
                            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                                    <span>📝</span> Chi Tiết Phân Tích
                                </h3>
                                <ul className="space-y-3">
                                    {result.details.map((detail, idx) => (
                                        <li key={idx} className="flex items-start gap-3 text-slate-600 font-medium text-sm">
                                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0"></span>
                                            {detail}
                                        </li>
                                    ))}
                                </ul>

                                {result.trend === 'UPTREND' && result.setup === 'NONE' && (
                                    <div className="mt-6 p-4 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold border border-blue-100">
                                        💡 Giá đang trong xu hướng tăng nhưng chưa có điểm vào lệnh an toàn theo chiến lược (Pullback về EMA20-50 hoặc Breakout nền giá).
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-6 text-center">
                            <p className="text-xs text-slate-400 font-medium italic">
                                * Khuyến nghị chỉ mang tính chất tham khảo dựa trên thuật toán kỹ thuật. Không phải lời khuyên đầu tư tài chính.
                            </p>
                        </div>
                    </div>
                )
                }
            </main >
        </div >
    );
}
