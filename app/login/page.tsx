'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const supabase = createClient();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            router.push('/');
            router.refresh();
        }
    };

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
        } else {
            setError('Check your email to confirm your account!');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
            <div className="w-full max-w-md">
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-accent rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-accent/20">
                        <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-black tracking-tight text-slate-900 mb-2">StockMonitor</h1>
                    <p className="text-slate-500 font-medium">Internal Team Access Portal</p>
                </div>

                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label htmlFor="email" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
                                Email Address
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent transition-all font-medium"
                                placeholder="name@company.com"
                                autoComplete="email"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="password" className="block text-xs font-black uppercase tracking-widest text-slate-400 mb-2 ml-1">
                                Security Password
                            </label>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-accent/5 focus:border-accent transition-all font-medium"
                                placeholder="••••••••"
                                autoComplete="current-password"
                                required
                            />
                        </div>

                        {error && (
                            <div className={`p-4 rounded-2xl text-sm font-bold flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${error.includes('Check your email')
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                                : 'bg-red-50 text-red-600 border border-red-100'
                                }`}>
                                <span className="text-lg">{error.includes('Check your email') ? '✅' : '⚠️'}</span>
                                {error}
                            </div>
                        )}

                        <div className="flex flex-col gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-accent text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-accent/20 hover:bg-slate-800 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {loading ? 'Authorizing...' : 'Sign In'}
                            </button>
                            <button
                                type="button"
                                onClick={handleSignup}
                                disabled={loading}
                                className="w-full bg-white text-slate-500 py-4 rounded-2xl font-bold border border-slate-200 hover:bg-slate-50 transition-all"
                            >
                                Create New Account
                            </button>
                        </div>
                    </form>
                </div>

                <p className="text-center mt-10 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    &copy; 2024 StockMonitor &bull; All Rights Reserved
                </p>
            </div>
        </div>
    );
}
