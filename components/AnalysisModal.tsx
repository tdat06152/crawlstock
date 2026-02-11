'use client';

import { useState } from 'react';

interface AnalysisModalProps {
    symbol: string;
    isOpen: boolean;
    onClose: () => void;
}

export default function AnalysisModal({ symbol, isOpen, onClose }: AnalysisModalProps) {
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const runAnalysis = async () => {
        setLoading(true);
        setError(null);
        setAnalysis(null);
        try {
            const res = await fetch(`/api/analysis?symbol=${symbol}`);
            const data = await res.json();
            if (res.ok) {
                setAnalysis(data.analysis);
            } else {
                setError(data.error || 'Failed to fetch analysis');
            }
        } catch (err) {
            setError('An error occurred during analysis');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">AI Phân Tích Chiến Lược</h3>
                        <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mt-1">Mã cổ phiếu: <span className="text-accent">{symbol}</span></p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-slate-400 hover:text-slate-900 shadow-sm border border-transparent hover:border-slate-200">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                    {!analysis && !loading && !error && (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <div className="w-20 h-20 bg-accent/5 rounded-full flex items-center justify-center mb-6 text-4xl">🤖</div>
                            <h4 className="text-xl font-bold text-slate-900 mb-2">Bắt đầu phân tích báo cáo</h4>
                            <p className="text-slate-500 max-w-sm mb-8">AI Gemini Flash sẽ phân tích 1 tuần dữ liệu gần nhất dựa trên 3 mẫu hình: RSI, EMA/MACD, Bollinger Bands.</p>
                            <button
                                onClick={runAnalysis}
                                className="px-10 py-4 bg-accent text-accent-foreground rounded-full font-black text-sm uppercase tracking-widest shadow-xl shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
                            >
                                Chạy Phân Tích Ngay
                            </button>
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-20">
                            <div className="w-12 h-12 border-4 border-slate-100 border-t-accent rounded-full animate-spin mb-6"></div>
                            <p className="font-black text-slate-400 text-xs uppercase tracking-[0.2em] animate-pulse">Đang quét dữ liệu & phân tích...</p>
                        </div>
                    )}

                    {error && (
                        <div className="bg-rose-50 border border-rose-100 text-rose-600 p-6 rounded-2xl flex items-start gap-4">
                            <span className="text-xl">⚠️</span>
                            <div>
                                <h5 className="font-bold mb-1">Đã xảy ra lỗi</h5>
                                <p className="text-sm opacity-80">{error}</p>
                                <button onClick={runAnalysis} className="mt-4 text-xs font-black uppercase tracking-widest border-b-2 border-rose-200 hover:border-rose-400 pb-0.5 transition-all">Thử lại</button>
                            </div>
                        </div>
                    )}

                    {analysis && (
                        <div className="prose prose-slate max-w-none prose-headings:font-black prose-headings:tracking-tight prose-headings:text-slate-900 prose-p:text-slate-600 prose-p:leading-relaxed prose-strong:text-slate-900 prose-ul:list-disc prose-li:text-slate-600 prose-hr:border-slate-100 prose-blockquote:border-accent prose-blockquote:bg-accent/5 prose-blockquote:rounded-r-2xl prose-blockquote:py-1 prose-blockquote:px-6">
                            {/* Render AI content here - simple markdown-like display */}
                            <div dangerouslySetInnerHTML={{ __html: analysis.replace(/\n/g, '<br/>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/### (.*?)/g, '<h3>$1</h3>').replace(/## (.*?)/g, '<h2>$1</h2>').replace(/# (.*?)/g, '<h1>$1</h1>') }} />

                            <hr />
                            <div className="flex justify-center pt-8">
                                <button
                                    onClick={runAnalysis}
                                    className="px-8 py-3 bg-slate-900 text-white rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg"
                                >
                                    Cập Nhật Lại Phân Tích
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
