
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import Header from '@/components/Header';
import MarketScanTable from '@/components/MarketScanTable';
import { createClient } from '@/lib/supabase-client';
import { useRouter } from 'next/navigation';

export default function MarketScanPage() {
    // Logic: 
    // 1. Check Auth
    // 2. Fetch snapshot (default today)

    const [date, setDate] = useState('');
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    const supabase = createClient();
    const router = useRouter();

    useEffect(() => {
        // Auth Check
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (!user) router.push('/login');
            setUser(user);
        });

        // Đặt ngày mặc định dựa trên giờ địa phương (trước 15:30 lấy hôm qua)
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();

        let targetDate = new Date();
        if (hour < 15 || (hour === 15 && minute < 30)) {
            targetDate.setDate(targetDate.getDate() - 1);
        }

        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const day = String(targetDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        setDate(dateStr);
    }, []);

    useEffect(() => {
        // Only load data if date is set (after initial useEffect)
        if (date) {
            loadData(date);
        }
    }, [date]);

    const loadData = async (targetDate: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/market-scan?date=${targetDate}`);
            if (res.ok) {
                const json = await res.json();
                if (Array.isArray(json)) {
                    setData(json);
                } else {
                    setData([]);
                }
            } else {
                // Failed, maybe empty for today, try yesterday automatically if this is first load?
                // For now just empty.
                setData([]);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 text-slate-800">
            <Header user={user} />

            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Tín Hiệu Thị Trường</h2>
                        <p className="text-slate-500">
                            Phân tích RSI hằng ngày và phát hiện điểm mua tiềm năng.
                        </p>
                        <p className="text-[10px] font-bold text-accent uppercase tracking-wider mt-1 opacity-80">
                            🕒 Dữ liệu được cập nhật vào 15h30 các ngày trong tuần
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm font-semibold text-slate-600">Ngày quét:</label>
                        <input
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="px-4 py-2 border border-slate-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-accent"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center p-20">
                        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        {data.length === 0 ? (
                            <div className="bg-white p-10 rounded-2xl text-center border border-slate-200">
                                <div className="text-4xl mb-4">📂</div>
                                <p className="text-slate-500 font-medium">Chưa có dữ liệu cho ngày {date}</p>
                                <p className="text-xs text-slate-400 mt-2">Hãy thử chọn một ngày trước đó.</p>
                                <button
                                    onClick={() => {
                                        const y = new Date();
                                        y.setDate(y.getDate() - 1);
                                        setDate(y.toISOString().split('T')[0]);
                                    }}
                                    className="mt-4 text-accent text-sm font-bold hover:underline"
                                >
                                    Xem Hôm Qua
                                </button>
                            </div>
                        ) : (
                            <MarketScanTable data={data} />
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
