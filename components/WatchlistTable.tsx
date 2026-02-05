'use client';

import { useState, useEffect } from 'react';
import { WatchlistWithPrice } from '@/lib/types';
import { isInZone } from '@/lib/alert-logic';

interface WatchlistTableProps {
    watchlists: WatchlistWithPrice[];
    onEdit: (watchlist: WatchlistWithPrice) => void;
    onDelete: (id: string) => void;
    onToggle: (id: string, enabled: boolean) => void;
    scanData?: Map<string, any>;
}

export default function WatchlistTable({
    watchlists,
    onEdit,
    onDelete,
    onToggle,
    scanData
}: WatchlistTableProps) {
    const [search, setSearch] = useState('');
    const [sortBy, setSortBy] = useState<'symbol' | 'price' | 'updated'>('symbol');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const filteredWatchlists = watchlists
        .filter(w => w.symbol.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
            let comparison = 0;

            if (sortBy === 'symbol') {
                comparison = a.symbol.localeCompare(b.symbol);
            } else if (sortBy === 'price') {
                const priceA = a.latest_price?.price || 0;
                const priceB = b.latest_price?.price || 0;
                comparison = priceA - priceB;
            } else if (sortBy === 'updated') {
                const timeA = a.latest_price?.updated_at ? new Date(a.latest_price.updated_at).getTime() : 0;
                const timeB = b.latest_price?.updated_at ? new Date(b.latest_price.updated_at).getTime() : 0;
                comparison = timeA - timeB;
            }

            return sortOrder === 'asc' ? comparison : -comparison;
        });

    const handleSort = (column: typeof sortBy) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('asc');
        }
    };

    const formatTime = (timestamp: string | undefined) => {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (inZone: boolean) => {
        return inZone
            ? 'text-green-400 bg-green-500/10 border-green-500/20'
            : 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    };

    return (
        <div className="space-y-6">
            {/* Search Bar */}
            <div className="px-6 py-4 border-b border-border bg-slate-50/50">
                <div className="relative max-w-md">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </span>
                    <input
                        type="text"
                        placeholder="Search symbols..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="block w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-accent/5 focus:border-accent transition-all"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-slate-500 border-b border-border bg-slate-50/30">
                            <th
                                className="px-6 py-5 text-left font-black uppercase tracking-[0.1em] text-[10px] cursor-pointer hover:text-accent transition-colors"
                                onClick={() => handleSort('symbol')}
                            >
                                Mã {sortBy === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                className="px-6 py-5 text-left font-black uppercase tracking-[0.1em] text-[10px] cursor-pointer hover:text-accent transition-colors"
                                onClick={() => handleSort('price')}
                            >
                                Giá Latest {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-5 text-center font-black uppercase tracking-[0.1em] text-[10px]">
                                RSI (Daily)
                            </th>
                            <th className="px-6 py-5 text-center font-black uppercase tracking-[0.1em] text-[10px]">
                                EMA200 / MACD
                            </th>
                            <th className="px-6 py-5 text-left font-black uppercase tracking-[0.1em] text-[10px]">
                                Vùng Mua
                            </th>
                            <th className="px-6 py-5 text-left font-black uppercase tracking-[0.1em] text-[10px]">
                                Trạng Thái
                            </th>
                            <th className="px-6 py-5 text-right font-black uppercase tracking-[0.1em] text-[10px]">
                                Sửa/Xóa
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredWatchlists.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-24 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="text-5xl opacity-20 grayscale">📂</div>
                                        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">
                                            {search ? `Không tìm thấy "${search}"` : "Danh mục trống"}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredWatchlists.map((item) => {
                                const inZone = item.latest_price
                                    ? isInZone(item.latest_price.price, item.buy_min, item.buy_max)
                                    : false;

                                const sData = scanData?.get(item.symbol);

                                return (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-slate-50/50 transition-all group"
                                    >
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col">
                                                <span className="font-black text-lg tracking-tight group-hover:text-accent transition-colors">
                                                    {item.symbol}
                                                </span>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                                                    {formatTime(item.latest_price?.updated_at)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            {item.latest_price ? (
                                                <div className="flex flex-col">
                                                    <span className="font-mono font-black text-base text-slate-900 leading-none">
                                                        {item.latest_price.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 font-bold uppercase mt-1">VND</span>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 bg-slate-50 text-slate-400 text-[9px] font-black rounded uppercase tracking-widest border border-slate-100">
                                                    FETCHING
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {sData ? (
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <span className={`font-black px-2.5 py-1 rounded-lg text-white text-[10px] shadow-sm ${(sData.rsi >= 70) ? 'bg-rose-500' :
                                                        (sData.rsi <= 30) ? 'bg-emerald-500' :
                                                            (sData.rsi <= 40) ? 'bg-lime-500' : 'bg-slate-400'
                                                        }`}>
                                                        {sData.rsi.toFixed(1)}
                                                    </span>
                                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                                                        {sData.state === 'NEUTRAL'
                                                            ? (sData.near_flag !== 'none' ? sData.near_flag.replace('NEAR_', '~') : 'NEUT')
                                                            : sData.state.substr(0, 4)}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-200">--</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {sData && sData.ema200 ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <div className={`text-[10px] font-black ${(sData.distance_to_ema200_pct >= 0) ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                        {sData.distance_to_ema200_pct > 0 ? '+' : ''}{sData.distance_to_ema200_pct.toFixed(1)}%
                                                    </div>
                                                    <div className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter ${sData.ema200_macd_state.includes('BUY') ? 'bg-emerald-500 text-white' :
                                                            sData.ema200_macd_state.includes('SELL') ? 'bg-rose-500 text-white' :
                                                                sData.ema200_macd_state.includes('BULL') ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                                                        }`}>
                                                        {sData.ema200_macd_state === 'EMA200_MACD_BUY' ? 'BUY' :
                                                            sData.ema200_macd_state === 'EMA200_MACD_SELL' ? 'SELL' :
                                                                sData.ema200_macd_state === 'EMA200_MACD_BULL_NO_SIGNAL' ? 'BULL' : 'BEAR'}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-200">--</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5">
                                            {item.buy_min !== null || item.buy_max !== null ? (
                                                <div className="flex flex-col">
                                                    <div className="text-[10px] font-black font-mono text-slate-600">
                                                        {item.buy_min !== null && item.buy_max !== null
                                                            ? `${item.buy_min} - ${item.buy_max}`
                                                            : item.buy_min !== null
                                                                ? `≥ ${item.buy_min}`
                                                                : `≤ ${item.buy_max}`}
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">TARGET (K)</div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 text-[10px] font-bold uppercase italic">N/A</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex flex-col items-start gap-2">
                                                <span className={`inline-flex items-center px-3 py-1 rounded-xl text-[9px] font-black tracking-[0.1em] border shadow-sm ${inZone
                                                    ? 'bg-emerald-500 text-white border-emerald-600'
                                                    : 'bg-slate-50 text-slate-400 border-slate-100'
                                                    }`}>
                                                    {inZone ? 'IN ZONE' : 'WAITING'}
                                                </span>
                                                <button
                                                    onClick={() => onToggle(item.id, !item.enabled)}
                                                    className={`relative inline-flex h-4 w-8 items-center rounded-full transition-all ${item.enabled ? 'bg-accent' : 'bg-slate-200'}`}
                                                >
                                                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${item.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    onClick={() => onEdit(item)}
                                                    className="p-2 text-slate-400 hover:text-accent hover:bg-accent/5 rounded-xl transition-all"
                                                    title="Sửa"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => onDelete(item.id)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                                    title="Xóa"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
