'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import { WatchlistWithPrice } from '@/lib/types';
import WatchlistTable from '@/components/WatchlistTable';
import WatchlistModal from '@/components/WatchlistModal';
import NotificationManager from '@/components/NotificationManager';

export default function Dashboard() {
  const [watchlists, setWatchlists] = useState<WatchlistWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<WatchlistWithPrice | null>(null);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    checkAuth();
    loadWatchlists();

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleViewAlerts = () => {
    router.push('/alerts');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-accent selection:text-accent-foreground">
      <NotificationManager />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center shadow-lg shadow-accent/20">
                <svg className="w-6 h-6 text-accent-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">StockMonitor</h1>
                <p className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                  {user?.email?.split('@')[0]} • REAL-TIME INSIGHTS
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleViewAlerts}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-accent transition-colors"
              >
                Alerts History
              </button>
              <button
                onClick={handleSignOut}
                className="px-4 py-2 text-sm font-semibold border border-red-200 text-red-600 rounded-full hover:bg-red-50 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h2 className="text-4xl font-extrabold tracking-tight mb-2">My Watchlist</h2>
            <p className="text-slate-500 font-medium">
              Monitoring {watchlists.length} {watchlists.length === 1 ? 'security' : 'securities'} in VN Market
            </p>
          </div>
          <button
            onClick={handleAdd}
            className="px-8 py-3 bg-accent text-accent-foreground rounded-full font-bold shadow-xl shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            + New Tracking Symbol
          </button>
        </div>

        <div className="bg-card rounded-3xl border border-border shadow-sm overflow-hidden">
          <WatchlistTable
            watchlists={watchlists}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onToggle={handleToggle}
          />
        </div>

        {/* Info Banner */}
        <div className="mt-8 flex items-center gap-3 p-4 bg-slate-100 border border-slate-200 rounded-2xl">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-sm">
            <span className="text-lg">💡</span>
          </div>
          <p className="text-sm font-medium text-slate-600">
            Prices are sourced from <span className="text-accent font-bold underline decoration-slate-300">Entrade</span> (VN Market) and update automatically every 15 minutes.
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
