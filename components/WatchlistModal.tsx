'use client';

import { useState, useEffect } from 'react';
import { WatchlistWithPrice } from '@/lib/types';

interface WatchlistModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: {
        symbol: string;
        buy_min: number | null;
        buy_max: number | null;
        cooldown_minutes: number;
    }) => void;
    editItem?: WatchlistWithPrice | null;
}

export default function WatchlistModal({
    isOpen,
    onClose,
    onSave,
    editItem
}: WatchlistModalProps) {
    const [symbol, setSymbol] = useState('');
    const [buyMin, setBuyMin] = useState('');
    const [buyMax, setBuyMax] = useState('');
    const [cooldown, setCooldown] = useState('60');

    useEffect(() => {
        if (editItem) {
            setSymbol(editItem.symbol);
            setBuyMin(editItem.buy_min?.toString() || '');
            setBuyMax(editItem.buy_max?.toString() || '');
            setCooldown(editItem.cooldown_minutes.toString());
        } else {
            setSymbol('');
            setBuyMin('');
            setBuyMax('');
            setCooldown('60');
        }
    }, [editItem, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        onSave({
            symbol: symbol.toUpperCase(),
            buy_min: buyMin ? parseFloat(buyMin) : null,
            buy_max: buyMax ? parseFloat(buyMax) : null,
            cooldown_minutes: parseInt(cooldown) || 60
        });

        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-all animate-in fade-in duration-300">
            <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden transform animate-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-900">
                            {editItem ? 'Edit Asset' : 'New Monitor'}
                        </h2>
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Configure alert zones for VN Market stocks.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div>
                        <label htmlFor="symbol" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                            Tracking Symbol
                        </label>
                        <input
                            id="symbol"
                            type="text"
                            value={symbol}
                            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent transition-all uppercase font-mono font-bold text-lg"
                            placeholder="VND / FPT / HPG"
                            required
                            disabled={!!editItem}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="buyMin" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                                Buy Floor (VND)
                            </label>
                            <input
                                id="buyMin"
                                type="number"
                                step="1"
                                value={buyMin}
                                onChange={(e) => setBuyMin(e.target.value)}
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent transition-all font-bold"
                                placeholder="Min price"
                            />
                        </div>

                        <div>
                            <label htmlFor="buyMax" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                                Buy Ceiling (VND)
                            </label>
                            <input
                                id="buyMax"
                                type="number"
                                step="1"
                                value={buyMax}
                                onChange={(e) => setBuyMax(e.target.value)}
                                className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent transition-all font-bold"
                                placeholder="Max price"
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="cooldown" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2">
                            Alert Interval (min)
                        </label>
                        <input
                            id="cooldown"
                            type="number"
                            value={cooldown}
                            onChange={(e) => setCooldown(e.target.value)}
                            className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent transition-all font-bold"
                            placeholder="60"
                            required
                        />
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 border border-slate-200 text-slate-500 rounded-2xl font-bold hover:bg-slate-50 transition-all active:scale-[0.98]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 px-6 py-4 bg-accent text-white rounded-2xl font-bold hover:bg-slate-800 shadow-lg shadow-accent/20 transition-all active:scale-[0.98]"
                        >
                            {editItem ? 'Save Changes' : 'Start Tracking'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
