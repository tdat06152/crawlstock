'use client';

import { useState, useEffect } from 'react';
import { WatchlistWithPrice } from '@/lib/types';
import { isInZone } from '@/lib/alert-logic';

interface WatchlistTableProps {
    watchlists: WatchlistWithPrice[];
    onEdit: (watchlist: WatchlistWithPrice) => void;
    onDelete: (id: string) => void;
    onToggle: (id: string, enabled: boolean) => void;
}

export default function WatchlistTable({
    watchlists,
    onEdit,
    onDelete,
    onToggle
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

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-slate-500 border-b border-border">
                            <th
                                className="px-6 py-4 text-left font-bold uppercase tracking-wider cursor-pointer hover:text-accent transition-colors"
                                onClick={() => handleSort('symbol')}
                            >
                                Symbol {sortBy === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                className="px-6 py-4 text-left font-bold uppercase tracking-wider cursor-pointer hover:text-accent transition-colors"
                                onClick={() => handleSort('price')}
                            >
                                Latest (VND) {sortBy === 'price' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th
                                className="px-6 py-4 text-left font-bold uppercase tracking-wider cursor-pointer hover:text-accent transition-colors"
                                onClick={() => handleSort('updated')}
                            >
                                Updated {sortBy === 'updated' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </th>
                            <th className="px-6 py-4 text-left font-bold uppercase tracking-wider">
                                Buy Range
                            </th>
                            <th className="px-6 py-4 text-left font-bold uppercase tracking-wider">
                                Status
                            </th>
                            <th className="px-6 py-4 text-center font-bold uppercase tracking-wider">
                                Monitoring
                            </th>
                            <th className="px-6 py-4 text-right font-bold uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {filteredWatchlists.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-6 py-16 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <p className="text-slate-500 font-medium">
                                            {search ? `No results for "${search}"` : "You haven't added any symbols yet."}
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredWatchlists.map((item) => {
                                const inZone = item.latest_price
                                    ? isInZone(item.latest_price.price, item.buy_min, item.buy_max)
                                    : false;

                                return (
                                    <tr
                                        key={item.id}
                                        className="hover:bg-slate-50/80 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-8 bg-accent/10 rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <span className="font-mono font-black text-lg">
                                                    {item.symbol}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {item.latest_price ? (
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-base">
                                                        {item.latest_price.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                                    </span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase">VND</span>
                                                </div>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-1 bg-slate-100 text-slate-400 text-[10px] font-bold rounded uppercase tracking-wider">
                                                    Fetching...
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 text-xs font-medium">
                                            {formatTime(item.latest_price?.updated_at)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                {item.buy_min !== null || item.buy_max !== null ? (
                                                    <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold font-mono">
                                                        {item.buy_min !== null && item.buy_max !== null
                                                            ? `${item.buy_min} - ${item.buy_max}`
                                                            : item.buy_min !== null
                                                                ? `≥ ${item.buy_min}`
                                                                : `≤ ${item.buy_max}`}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Not configured</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black tracking-widest border shadow-sm ${inZone
                                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                : 'bg-slate-50 text-slate-400 border-slate-100'
                                                }`}>
                                                {inZone ? 'IN ZONE' : 'WAITING'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => onToggle(item.id, !item.enabled)}
                                                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-all ${item.enabled ? 'bg-accent' : 'bg-slate-200'
                                                    }`}
                                            >
                                                <span
                                                    className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${item.enabled ? 'translate-x-6' : 'translate-x-1'
                                                        }`}
                                                />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => onEdit(item)}
                                                    className="p-2 text-slate-400 hover:text-accent hover:bg-slate-100 rounded-lg transition-all"
                                                    title="Edit"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => onDelete(item.id)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                    title="Delete"
                                                >
                                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
