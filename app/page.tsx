
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { WatchlistWithPrice } from '@/lib/types';
import WatchlistTable from '@/components/WatchlistTable';
import WatchlistModal from '@/components/WatchlistModal';
import NotificationManager from '@/components/NotificationManager';
import Header from '@/components/Header';

export default function Dashboard() {
  const [watchlists, setWatchlists] = useState<WatchlistWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<WatchlistWithPrice | null>(null);
  const [user, setUser] = useState<any>(null);
  const [scanData, setScanData] = useState<Map<string, any>>(new Map());

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAuth();
    loadWatchlists();
    loadScanData();

    // Refresh watchlists every 60 seconds
    const interval = setInterval(loadWatchlists, 60000);
    return () => clearInterval(interval);
  }, []);

  const checkAuth = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      router.push('/login');
    } else {
      setUser(user);
    }
  };

  const loadWatchlists = async () => {
    try {
      const response = await fetch('/api/watchlist');
      if (response.ok) {
        const data = await response.json();
        setWatchlists(data);
      }
    } catch (error) {
      console.error('Error loading watchlists:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadScanData = async () => {
    // Fetch latest (today)
    const date = new Date().toISOString().split('T')[0];
    try {
      const res = await fetch(`/api/market-scan?date=${date}`);
      if (res.ok) {
        const items = await res.json();
        if (Array.isArray(items)) {
          const map = new Map();
          items.forEach((i: any) => map.set(i.symbol, i));
          setScanData(map);
        }
      }
    } catch (e) {
      console.error("Failed to load scan data", e);
    }
  };

  const handleAdd = () => {
    setEditItem(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: WatchlistWithPrice) => {
    setEditItem(item);
    setIsModalOpen(true);
  };

  const handleSave = async (data: any) => {
    try {
      if (editItem) {
        // Update
        await fetch('/api/watchlist', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, id: editItem.id })
        });
      } else {
        // Create
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
      }
      loadWatchlists();
    } catch (error) {
      console.error('Error saving watchlist:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this watchlist item?')) return;

    try {
      await fetch(`/api/watchlist?id=${id}`, {
        method: 'DELETE'
      });
      loadWatchlists();
    } catch (error) {
      console.error('Error deleting watchlist:', error);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await fetch('/api/watchlist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled })
      });
      loadWatchlists();
    } catch (error) {
      console.error('Error toggling watchlist:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-white text-xl">Đang tải...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <NotificationManager />

      <Header user={user} />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight mb-2 text-slate-900">Danh Mục Theo Dõi</h2>
            <p className="text-slate-500 font-medium">
              Đang theo dõi {watchlists.length} {watchlists.length === 1 ? 'mã' : 'mã'} chứng khoán
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="px-8 py-3 bg-accent text-accent-foreground rounded-full font-bold shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            + Thêm Mã Mới
          </button>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <WatchlistTable
            watchlists={watchlists}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={handleToggle}
            scanData={scanData}
          />
        </div>

        {/* Info Banner */}
        <div className="mt-8 flex items-center gap-3 p-4 bg-slate-100 border border-slate-200 rounded-2xl">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
            <span className="text-lg">💡</span>
          </div>
          <p className="text-sm font-medium text-slate-600">
            Giá realtime từ Entrade. Phân tích RSI dựa trên giá đóng cửa hằng ngày.
          </p>
        </div>
      </main>

      <WatchlistModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editItem={editItem}
      />
    </div>
  );
}
