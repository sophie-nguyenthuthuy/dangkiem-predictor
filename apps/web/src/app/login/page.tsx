'use client';

import { useState } from 'react';
import { api, setStoredAuth, ApiError } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('user@dangkiem.local');
  const [password, setPassword] = useState('demo1234');
  const [error, setError] = useState<string | null>(null);
  const [me, setMe] = useState<{ email: string; role: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await api.login({ email, password });
      setStoredAuth(res.accessToken, res.refreshToken);
      setMe({ email: res.user.email, role: res.user.role });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : (e as Error).message);
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Đăng nhập</h1>
      <form onSubmit={submit} className="card space-y-3">
        <label className="block text-sm">
          <span className="text-slate-700">Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="text-slate-700">Mật khẩu</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            required
          />
        </label>
        {error && <div className="text-sm text-danger">{error}</div>}
        <button className="btn-primary w-full">Đăng nhập</button>
      </form>
      {me && (
        <div className="card text-sm">
          <div className="font-semibold text-emerald-700">Đăng nhập thành công</div>
          <div className="mt-1 text-slate-600">
            {me.email} · vai trò {me.role}
          </div>
        </div>
      )}
      <p className="text-xs text-slate-500">
        Demo: user@dangkiem.local / demo1234 · fleet@dangkiem.local / demo1234
      </p>
    </div>
  );
}
