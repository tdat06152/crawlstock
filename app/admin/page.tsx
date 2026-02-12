'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-client';
import Header from '@/components/Header';

interface Profile {
    id: string;
    email: string;
    role: string;
    expires_at: string | null;
    created_at: string;
}

export default function AdminPage() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState({
        id: '',
        email: '',
        password: '',
        role: 'user',
        expires_at: ''
    });
    const [isEdit, setIsEdit] = useState(false);

    const router = useRouter();
    const supabase = createClient();

    useEffect(() => {
        checkAdmin();
        loadProfiles();
    }, []);

    const checkAdmin = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            router.push('/login');
            return;
        }
        setUser(user);

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (!profile || profile.role !== 'admin') {
            router.push('/');
        }
    };

    const loadProfiles = async () => {
        try {
            const res = await fetch('/api/admin/users');
            if (res.ok) {
                const data = await res.json();
                setProfiles(data);
            }
        } catch (e) {
            console.error('Failed to load profiles', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        const method = isEdit ? 'PUT' : 'POST';
        const body = isEdit
            ? { id: modalData.id, email: modalData.email, role: modalData.role, expires_at: modalData.expires_at || null, password: modalData.password || undefined }
            : { email: modalData.email, password: modalData.password, role: modalData.role, expires_at: modalData.expires_at || null };

        try {
            const res = await fetch('/api/admin/users', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                setIsModalOpen(false);
                loadProfiles();
            } else {
                const err = await res.json();
                alert(err.error || 'Xảy ra lỗi');
            }
        } catch (e) {
            alert('Lỗi kết nối');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa tài khoản này?')) return;
        try {
            const res = await fetch(`/api/admin/users?id=${id}`, { method: 'DELETE' });
            if (res.ok) loadProfiles();
        } catch (e) { }
    };

    const openCreateModal = () => {
        setIsEdit(false);
        setModalData({ id: '', email: '', password: '', role: 'user', expires_at: '' });
        setIsModalOpen(true);
    };

    const openEditModal = (p: Profile) => {
        setIsEdit(true);
        setModalData({
            id: p.id,
            email: p.email,
            password: '',
            role: p.role,
            expires_at: p.expires_at ? p.expires_at.split('T')[0] : ''
        });
        setIsModalOpen(true);
    };

    if (loading) return <div className="p-10 font-bold text-slate-500">Đang tải...</div>;

    return (
        <div className="min-h-screen bg-slate-50">
            <Header user={user} />

            <main className="max-w-7xl mx-auto px-6 py-10">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Quản lý Hệ thống</h2>
                        <p className="text-slate-500 mt-1 font-medium">Quản lý người dùng, quyền hạn và thời hạn sử dụng</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="px-6 py-3 bg-accent text-accent-foreground rounded-2xl font-bold shadow-lg shadow-accent/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2"
                    >
                        <span>+ Thêm Người Dùng</span>
                    </button>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-200">
                            <tr>
                                <th className="px-8 py-5 font-bold text-slate-800 text-sm uppercase tracking-wider">Email</th>
                                <th className="px-8 py-5 font-bold text-slate-800 text-sm uppercase tracking-wider">Quyền</th>
                                <th className="px-8 py-5 font-bold text-slate-800 text-sm uppercase tracking-wider">Hết hạn</th>
                                <th className="px-8 py-5 font-bold text-slate-800 text-sm uppercase tracking-wider text-right">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {profiles.map((p) => (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-8 py-5">
                                        <div className="font-semibold text-slate-900">{p.email}</div>
                                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">{p.id}</div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${p.role === 'admin' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {p.role}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        {p.expires_at ? (
                                            <div className={`font-medium ${new Date(p.expires_at) < new Date() ? 'text-red-500' : 'text-slate-600'}`}>
                                                {new Date(p.expires_at).toLocaleDateString('vi-VN')}
                                            </div>
                                        ) : (
                                            <span className="text-slate-300 italic text-sm">Vĩnh viễn</span>
                                        )}
                                    </td>
                                    <td className="px-8 py-5 text-right space-x-2">
                                        <button
                                            onClick={() => openEditModal(p)}
                                            className="p-2 text-slate-400 hover:text-accent hover:bg-slate-100 rounded-xl transition-all"
                                            title="Sửa / Reset Pass"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p.id)}
                                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-slate-100 rounded-xl transition-all"
                                            title="Xóa người dùng"
                                        >
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-bold text-slate-900">
                                {isEdit ? 'Chỉnh sửa tài khoản' : 'Thêm người dùng mới'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            {!isEdit && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Email</label>
                                    <input
                                        type="email"
                                        value={modalData.email}
                                        onChange={(e) => setModalData({ ...modalData, email: e.target.value })}
                                        className="w-full bg-slate-100 border-none rounded-2xl px-5 py-4 text-slate-900 focus:ring-2 focus:ring-accent outline-none"
                                        placeholder="user@example.com"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">
                                    {isEdit ? 'Mật khẩu mới (Để trống nếu không đổi)' : 'Mật khẩu'}
                                </label>
                                <input
                                    type="password"
                                    value={modalData.password}
                                    onChange={(e) => setModalData({ ...modalData, password: e.target.value })}
                                    className="w-full bg-slate-100 border-none rounded-2xl px-5 py-4 text-slate-900 focus:ring-2 focus:ring-accent outline-none"
                                    placeholder="••••••••"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Quyền</label>
                                    <select
                                        value={modalData.role}
                                        onChange={(e) => setModalData({ ...modalData, role: e.target.value })}
                                        className="w-full bg-slate-100 border-none rounded-2xl px-5 py-4 text-slate-900 focus:ring-2 focus:ring-accent outline-none appearance-none"
                                    >
                                        <option value="user">User</option>
                                        <option value="admin">Admin</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Ngày hết hạn</label>
                                    <input
                                        type="date"
                                        value={modalData.expires_at}
                                        onChange={(e) => setModalData({ ...modalData, expires_at: e.target.value })}
                                        className="w-full bg-slate-100 border-none rounded-2xl px-5 py-4 text-slate-900 focus:ring-2 focus:ring-accent outline-none"
                                    />
                                    <button
                                        onClick={() => setModalData({ ...modalData, expires_at: '' })}
                                        className="text-[10px] text-accent mt-1 font-bold active:opacity-50"
                                    >
                                        Gỡ giới hạn ngày
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-4 text-slate-600 font-bold hover:bg-slate-200 rounded-2xl transition-all"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-slate-900/10"
                            >
                                {isEdit ? 'Lưu thay đổi' : 'Tạo mới'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
