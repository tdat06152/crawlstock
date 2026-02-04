
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

export default function MarketScanTable({ data }: { data: ScanRow[] }) {
    const [filter, setFilter] = useState('ALL');
    const [sort, setSort] = useState<'RSI_ASC' | 'RSI_DESC' | 'SLOPE_ASC'>('RSI_ASC');

    const filteredData = useMemo(() => {
        let res = [...data];
        if (filter === 'OVERSOLD') res = res.filter(r => r.state === 'OVERSOLD' || r.near_flag === 'NEAR_OVERSOLD');
        if (filter === 'OVERBOUGHT') res = res.filter(r => r.state === 'OVERBOUGHT' || r.near_flag === 'NEAR_OVERBOUGHT');
        if (filter === 'POTENTIAL_BUY') res = res.filter(r => r.rsi < 40 && (r.slope_5 || 0) > 0);

        // Sort
        if (sort === 'RSI_ASC') res.sort((a, b) => a.rsi - b.rsi);
        if (sort === 'RSI_DESC') res.sort((a, b) => b.rsi - a.rsi);
        if (sort === 'SLOPE_ASC') res.sort((a, b) => (b.slope_5 || 0) - (a.slope_5 || 0)); // High slope first

        return res;
    }, [data, filter, sort]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex bg-slate-100 p-1 rounded-xl">
                    {['ALL', 'OVERSOLD', 'OVERBOUGHT', 'POTENTIAL_BUY'].map((f) => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${filter === f
                                    ? 'bg-white text-accent shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {f.replace('_', ' ')}
                        </button>
                    ))}
                </div>

                <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as any)}
                    className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20"
                >
                    <option value="RSI_ASC">Lowest RSI (Oversold)</option>
                    <option value="RSI_DESC">Highest RSI (Overbought)</option>
                    <option value="SLOPE_ASC">Strongest Momentum (Slope)</option>
                </select>
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Symbol</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Close</th>
                                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">RSI (14)</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">State</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Slope (5d)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredData.map((row) => (
                                <tr key={row.symbol} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 font-bold text-slate-700">{row.symbol}</td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-600">
                                        {new Intl.NumberFormat('vi-VN').format(row.close * 1000)}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="inline-flex items-center justify-center w-12 h-8 rounded-lg font-bold text-white shadow-sm"
                                            style={{
                                                backgroundColor: getRSIColor(row.rsi)
                                            }}
                                        >
                                            {row.rsi.toFixed(0)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${getStateStyles(row.state, row.near_flag)}`}>
                                            {row.near_flag !== 'none' ? row.near_flag.replace('NEAR_', 'NEAR ') : row.state}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`flex items-center justify-end gap-1 font-medium ${(row.slope_5 || 0) > 0 ? 'text-green-600' : 'text-red-500'
                                            }`}>
                                            {(row.slope_5 || 0) > 0 ? '↗' : '↘'}
                                            {Math.abs(row.slope_5 || 0).toFixed(2)}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                        No symbols match criteria
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
    if (rsi >= 70) return '#ef4444'; // Red
    if (rsi >= 60) return '#f97316'; // Orange
    if (rsi <= 30) return '#22c55e'; // Green
    if (rsi <= 40) return '#84cc16'; // Lime
    return '#94a3b8'; // Slate
}

function getStateStyles(state: string, nearFlag: string) {
    if (state === 'OVERBOUGHT') return 'bg-red-100 text-red-700';
    if (state === 'OVERSOLD') return 'bg-green-100 text-green-700';
    if (nearFlag === 'NEAR_OVERBOUGHT') return 'bg-orange-100 text-orange-700';
    if (nearFlag === 'NEAR_OVERSOLD') return 'bg-lime-100 text-lime-700';
    return 'bg-slate-100 text-slate-600';
}
