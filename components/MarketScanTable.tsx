
'use client';

import { useState, useMemo } from 'react';

interface ScanRow {
    symbol: string;
    close: number;
    // RSI
    rsi: number;
    state: string;
    near_flag: string;
    slope_5: number | null;
    distance_to_30: number | null;
    distance_to_70: number | null;
    // EMA/MACD
    ema200: number | null;
    distance_to_ema200_pct: number | null;
    macd: number | null;
    macd_signal: number | null;
    macd_hist: number | null;
    macd_cross: string;
    ema200_macd_state: string;
}

const RSI_FILTER_LABELS: Record<string, string> = {
    'ALL': 'Tất cả',
    'OVERSOLD': 'Vùng mua',
    'OVERBOUGHT': 'Vùng bán',
    'POTENTIAL_BUY': 'Tín hiệu hồi phục'
};

const EMA_MACD_FILTER_LABELS: Record<string, string> = {
    'ALL': 'Tất cả',
    'BUY': 'Điểm mua',
    'SELL': 'Điểm bán',
    'BULL': 'Xu hướng tăng',
    'NEAR_EMA': 'Gần EMA200'
};

export default function MarketScanTable({ data }: { data: ScanRow[] }) {
    const [activeTab, setActiveTab] = useState<'RSI' | 'EMA_MACD'>('RSI');
    const [filter, setFilter] = useState('ALL');
    const [sort, setSort] = useState<string>('DEFAULT');
    const [search, setSearch] = useState('');

    const filteredData = useMemo(() => {
        let res = [...data];

        // Search filter
        if (search) {
            res = res.filter(r => r.symbol.toLowerCase().includes(search.toLowerCase()));
        }

        // Strategy-specific filters
        if (activeTab === 'RSI') {
            if (filter === 'OVERSOLD') res = res.filter(r => r.state === 'OVERSOLD' || r.near_flag === 'NEAR_OVERSOLD');
            if (filter === 'OVERBOUGHT') res = res.filter(r => r.state === 'OVERBOUGHT' || r.near_flag === 'NEAR_OVERBOUGHT');
            if (filter === 'POTENTIAL_BUY') res = res.filter(r => (r.rsi || 0) < 40 && (r.slope_5 || 0) > 0);

            // Sort RSI
            if (sort === 'VAL_ASC') res.sort((a, b) => a.rsi - b.rsi);
            if (sort === 'VAL_DESC') res.sort((a, b) => b.rsi - a.rsi);
            if (sort === 'SLOPE_DESC') res.sort((a, b) => (b.slope_5 || 0) - (a.slope_5 || 0));
        } else {
            if (filter === 'BUY') res = res.filter(r => r.ema200_macd_state === 'EMA200_MACD_BUY');
            if (filter === 'SELL') res = res.filter(r => r.ema200_macd_state === 'EMA200_MACD_SELL');
            if (filter === 'BULL') res = res.filter(r => r.ema200_macd_state === 'EMA200_MACD_BULL_NO_SIGNAL' || r.ema200_macd_state === 'EMA200_MACD_BUY');
            if (filter === 'NEAR_EMA') res = res.filter(r => Math.abs(r.distance_to_ema200_pct || 999) <= 2.5);

            // Sort EMA/MACD
            if (sort === 'VAL_ASC') res.sort((a, b) => (a.distance_to_ema200_pct || 0) - (b.distance_to_ema200_pct || 0));
            if (sort === 'HIST_DESC') res.sort((a, b) => (b.macd_hist || 0) - (a.macd_hist || 0));
        }

        return res;
    }, [data, filter, sort, search, activeTab]);

    const currentFilterLabels = activeTab === 'RSI' ? RSI_FILTER_LABELS : EMA_MACD_FILTER_LABELS;

    const handleTabChange = (tab: 'RSI' | 'EMA_MACD') => {
        setActiveTab(tab);
        setFilter('ALL');
        setSort('DEFAULT');
    };

    return (
        <div className="space-y-6">
            {/* Strategy Selection Tabs */}
            <div className="flex bg-slate-200/50 p-1.5 rounded-2xl w-fit border border-slate-200 shadow-inner">
                <button
                    onClick={() => handleTabChange('RSI')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'RSI'
                        ? 'bg-white text-accent shadow-md translate-y-[-1px]'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    ⚡ RSI SCAN
                </button>
                <button
                    onClick={() => handleTabChange('EMA_MACD')}
                    className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'EMA_MACD'
                        ? 'bg-white text-accent shadow-md translate-y-[-1px]'
                        : 'text-slate-500 hover:text-slate-700'
                        }`}
                >
                    📈 EMA200 + MACD
                </button>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-slate-100 shadow-lg shadow-slate-200/50">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-xs">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Mã cổ phiếu..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-accent/10 focus:border-accent transition-all font-semibold"
                        />
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar">
                        {Object.keys(currentFilterLabels).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${filter === f
                                    ? 'bg-white text-accent shadow-sm'
                                    : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                {currentFilterLabels[f]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Sắp xếp</label>
                    <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value)}
                        className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:ring-4 focus:ring-accent/10 hover:border-slate-300 transition-colors"
                    >
                        <option value="DEFAULT">Mặc định</option>
                        {activeTab === 'RSI' ? (
                            <>
                                <option value="VAL_ASC">RSI Thấp nhất</option>
                                <option value="VAL_DESC">RSI Cao nhất</option>
                                <option value="SLOPE_DESC">Đà tăng mạnh nhất</option>
                            </>
                        ) : (
                            <>
                                <option value="VAL_ASC">Gần EMA200 nhất</option>
                                <option value="HIST_DESC">Histogram cao nhất</option>
                            </>
                        )}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl shadow-slate-200/40 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                                <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Mã CP</th>
                                <th className="px-6 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Giá (₫)</th>
                                {activeTab === 'RSI' ? (
                                    <>
                                        <th className="px-6 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">RSI(14)</th>
                                        <th className="px-6 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Khuyến nghị</th>
                                        <th className="px-8 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Đà RSI</th>
                                    </>
                                ) : (
                                    <>
                                        <th className="px-6 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">EMA200 / Cách</th>
                                        <th className="px-6 py-6 text-center text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">MACD / Histogram</th>
                                        <th className="px-8 py-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Trạng thái EMA+MACD</th>
                                    </>
                                )}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredData.map((row) => (
                                <tr key={row.symbol} className="hover:bg-slate-50/80 transition-all group">
                                    <td className="px-8 py-5">
                                        <div className="font-black text-slate-900 group-hover:text-accent transition-colors text-lg tracking-tight">{row.symbol}</div>
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="font-mono font-bold text-slate-700">
                                            {new Intl.NumberFormat('vi-VN').format(row.close * 1000)}
                                        </div>
                                    </td>
                                    {activeTab === 'RSI' ? (
                                        <>
                                            <td className="px-6 py-5 text-center">
                                                <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-xl font-black text-white text-xs shadow-lg shadow-slate-200"
                                                    style={{ backgroundColor: getRSIColor(Number(row.rsi) || 0) }}
                                                >
                                                    {typeof row.rsi === 'number' ? row.rsi.toFixed(1) : (Number(row.rsi) ? Number(row.rsi).toFixed(1) : '--')}
                                                </div>
                                            </td>
                                            <td className="px-6 py-5">
                                                <div className={`inline-flex px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm border ${getRSIActionStyles(row.state, row.near_flag)}`}>
                                                    {getRSIActionText(row.state, row.near_flag)}
                                                </div>
                                            </td>
                                            <td className="px-8 py-5 text-right">
                                                <div className={`flex items-center justify-end gap-2 font-black text-xs ${(Number(row.slope_5) || 0) > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    <span className="text-[10px]">{(Number(row.slope_5) || 0) > 0 ? '▲' : '▼'}</span>
                                                    {typeof row.slope_5 === 'number' ? Math.abs(row.slope_5).toFixed(2) : (Number(row.slope_5) ? Math.abs(Number(row.slope_5)).toFixed(2) : '0.00')}
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="px-6 py-5 text-right">
                                                <div className="text-xs font-bold text-slate-600 block mb-0.5">
                                                    {new Intl.NumberFormat('vi-VN').format((Number(row.ema200) || 0) * 1000)}
                                                </div>
                                                <div className={`text-[10px] font-black ${(Number(row.distance_to_ema200_pct) || 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                    {(Number(row.distance_to_ema200_pct) || 0) > 0 ? '+' : ''}
                                                    {typeof row.distance_to_ema200_pct === 'number' ? row.distance_to_ema200_pct.toFixed(2) : (row.distance_to_ema200_pct && !isNaN(Number(row.distance_to_ema200_pct)) ? Number(row.distance_to_ema200_pct).toFixed(2) : '0.00')}%
                                                </div>
                                            </td>
                                            <td className="px-6 py-5 text-center">
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className="text-[10px] font-bold text-slate-400">
                                                        M: <span className="text-slate-600">{typeof row.macd === 'number' ? row.macd.toFixed(2) : (row.macd && !isNaN(Number(row.macd)) ? Number(row.macd).toFixed(2) : '--')}</span> / S: <span className="text-slate-600">{typeof row.macd_signal === 'number' ? row.macd_signal.toFixed(2) : (row.macd_signal && !isNaN(Number(row.macd_signal)) ? Number(row.macd_signal).toFixed(2) : '--')}</span>
                                                    </div>
                                                    <div className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-black ${(Number(row.macd_hist) || 0) >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                                        H: {typeof row.macd_hist === 'number' ? row.macd_hist.toFixed(2) : (row.macd_hist && !isNaN(Number(row.macd_hist)) ? Number(row.macd_hist).toFixed(2) : '--')}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-5">
                                                <div className={`inline-flex px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-sm border ${getEMAMACDStyles(row.ema200_macd_state, row.macd_cross)}`}>
                                                    {getEMAMACDText(row.ema200_macd_state, row.macd_cross)}
                                                </div>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}

                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={activeTab === 'RSI' ? 5 : 5} className="px-8 py-32 text-center">
                                        <div className="text-5xl mb-6 grayscale opacity-20">🔎</div>
                                        <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Không tìm thấy mã nào phù hợp</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

function getRSIColor(rsi: number) {
    if (rsi >= 70) return '#f43f5e'; // Rose
    if (rsi >= 60) return '#fb923c'; // Orange
    if (rsi <= 30) return '#10b981'; // Emerald
    if (rsi <= 40) return '#a3e635'; // Lime
    return '#94a3b8'; // Slate
}

function getRSIActionText(state: string, nearFlag: string) {
    if (state === 'OVERBOUGHT') return 'Chốt lời / Bán';
    if (state === 'OVERSOLD') return 'Mua ngay';
    if (nearFlag === 'NEAR_OVERBOUGHT') return 'Canh bán';
    if (nearFlag === 'NEAR_OVERSOLD') return 'Canh mua';
    return 'Theo dõi';
}

function getRSIActionStyles(state: string, nearFlag: string) {
    if (state === 'OVERBOUGHT') return 'bg-rose-500 text-white border-rose-600';
    if (state === 'OVERSOLD') return 'bg-emerald-500 text-white border-emerald-600';
    if (nearFlag === 'NEAR_OVERBOUGHT') return 'bg-rose-50 text-rose-600 border-rose-100';
    if (nearFlag === 'NEAR_OVERSOLD') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    return 'bg-slate-50 text-slate-400 border-slate-100';
}

function getEMAMACDText(state: string, cross: string) {
    if (state === 'EMA200_MACD_BUY') return 'Tín Hiệu Mua';
    if (state === 'EMA200_MACD_SELL') {
        return cross === 'cross_down' ? 'Tín Hiệu Bán' : 'Gãy EMA200 (BÁN)';
    }
    if (state === 'EMA200_MACD_BULL_NO_SIGNAL') return 'Xh Hướng Tăng';
    if (state === 'EMA200_MACD_BEAR') return 'Xu Hướng Giảm';
    return 'Theo dõi';
}

function getEMAMACDStyles(state: string, cross: string) {
    if (state === 'EMA200_MACD_BUY') return 'bg-emerald-500 text-white border-emerald-600';
    if (state === 'EMA200_MACD_SELL') return 'bg-rose-500 text-white border-rose-600';
    if (state === 'EMA200_MACD_BULL_NO_SIGNAL') return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    if (state === 'EMA200_MACD_BEAR') return 'bg-slate-50 text-slate-400 border-slate-100';
    return 'bg-slate-50 text-slate-400 border-slate-100';
}

