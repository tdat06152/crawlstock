
'use client';

import { useState, useMemo } from 'react';

interface ScanRow {
    symbol: string;
    close: number;
    rsi: number;
    state: string;
    near_flag: string;
    slope_5: number | null;
    distance_to_30: number | null;
    distance_to_70: number | null;
}

const FILTER_LABELS: Record<string, string> = {
    'ALL': 'Tất cả',
    'OVERSOLD': 'Vùng mua',
    'OVERBOUGHT': 'Vùng bán',
    'POTENTIAL_BUY': 'Tín hiệu mua'
};

export default function MarketScanTable({ data }: { data: ScanRow[] }) {
    const [filter, setFilter] = useState('ALL');
    const [sort, setSort] = useState<'RSI_ASC' | 'RSI_DESC' | 'SLOPE_ASC'>('RSI_ASC');
    const [search, setSearch] = useState('');

    const filteredData = useMemo(() => {
        let res = [...data];

        // Search filter
        if (search) {
            res = res.filter(r => r.symbol.toLowerCase().includes(search.toLowerCase()));
        }

        // Logic filters
        if (filter === 'OVERSOLD') res = res.filter(r => r.state === 'OVERSOLD' || r.near_flag === 'NEAR_OVERSOLD');
        if (filter === 'OVERBOUGHT') res = res.filter(r => r.state === 'OVERBOUGHT' || r.near_flag === 'NEAR_OVERBOUGHT');
        if (filter === 'POTENTIAL_BUY') res = res.filter(r => r.rsi < 40 && (r.slope_5 || 0) > 0);

        // Sort
        if (sort === 'RSI_ASC') res.sort((a, b) => a.rsi - b.rsi);
        if (sort === 'RSI_DESC') res.sort((a, b) => b.rsi - a.rsi);
        if (sort === 'SLOPE_ASC') res.sort((a, b) => (b.slope_5 || 0) - (a.slope_5 || 0)); // High slope first

        return res;
    }, [data, filter, sort, search]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center gap-4 flex-1">
                    <div className="relative flex-1 max-w-xs">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
                        <input
                            type="text"
                            placeholder="Tìm mã (ví dụ: VCB...)"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                        />
                    </div>

                    <div className="flex bg-slate-100 p-1 rounded-xl">
                        {Object.keys(FILTER_LABELS).map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${filter === f
                                    ? 'bg-white text-accent shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                    }`}
                            >
                                {FILTER_LABELS[f]}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sắp xếp:</label>
                    <select
                        value={sort}
                        onChange={(e) => setSort(e.target.value as any)}
                        className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20"
                    >
                        <option value="RSI_ASC">RSI Thấp nhất</option>
                        <option value="RSI_DESC">RSI Cao nhất</option>
                        <option value="SLOPE_ASC">Đà tăng mạnh nhất</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50/50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mã CP</th>
                                <th className="px-6 py-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Giá</th>
                                <th className="px-6 py-5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">RSI</th>
                                <th className="px-6 py-5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-widest">Khuyến nghị</th>
                                <th className="px-6 py-5 text-right text-[10px] font-bold text-slate-400 uppercase tracking-widest">Xu hướng (5đ)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredData.map((row) => (
                                <tr key={row.symbol} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 group-hover:text-accent transition-colors">{row.symbol}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="font-mono font-semibold text-slate-600">
                                            {new Intl.NumberFormat('vi-VN').format(row.close * 1000)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="inline-flex items-center justify-center px-3 py-1 rounded-lg font-bold text-white text-xs shadow-sm"
                                            style={{
                                                backgroundColor: getRSIColor(row.rsi)
                                            }}
                                        >
                                            {row.rsi.toFixed(1)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className={`inline-flex px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider shadow-sm ${getActionStyles(row.state, row.near_flag)}`}>
                                            {getActionText(row.state, row.near_flag)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`flex items-center justify-end gap-1.5 font-bold text-xs ${(row.slope_5 || 0) > 0 ? 'text-green-600' : 'text-red-500'
                                            }`}>
                                            {(row.slope_5 || 0) > 0 ? '▲' : '▼'}
                                            {Math.abs(row.slope_5 || 0).toFixed(2)}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="text-3xl mb-2">🔍</div>
                                        <p className="text-slate-400 font-medium">Không tìm thấy mã nào phù hợp</p>
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
    if (rsi >= 70) return '#f43f5e'; // Rose 500
    if (rsi >= 60) return '#f97316'; // Orange 500
    if (rsi <= 30) return '#10b981'; // Emerald 500
    if (rsi <= 40) return '#84cc16'; // Lime 500
    return '#64748b'; // Slate 500
}

function getActionText(state: string, nearFlag: string) {
    if (state === 'OVERBOUGHT') return 'Chốt lời / Bán';
    if (state === 'OVERSOLD') return 'Mua ngay';
    if (nearFlag === 'NEAR_OVERBOUGHT') return 'Canh bán';
    if (nearFlag === 'NEAR_OVERSOLD') return 'Canh mua';
    return 'Theo dõi';
}

function getActionStyles(state: string, nearFlag: string) {
    if (state === 'OVERBOUGHT') return 'bg-rose-500 text-white';
    if (state === 'OVERSOLD') return 'bg-emerald-500 text-white';
    if (nearFlag === 'NEAR_OVERBOUGHT') return 'bg-rose-50 text-rose-600 border border-rose-100';
    if (nearFlag === 'NEAR_OVERSOLD') return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
    return 'bg-slate-50 text-slate-500 border border-slate-100';
}

