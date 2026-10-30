'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound } from 'lucide-react';
import { useT } from '@/lib/i18n/client';

/**
 * SÜPER ADMİN ŞİFRESİNİ YENİLE — konsol yerine düz form.
 * Uç: /api/setup/create-superadmin (SETUP_SECRET ister, IP başına sınırlı).
 * Hesap varsa SİLİNMEZ: kimlik, rol ve geçmiş kalır, yalnız şifre değişir.
 */
export default function SifreKurtarSayfasi() {
  const sz = useT();
  const k = sz.superAdmin.kurtar;
  const [f, setF] = useState({ secret: '', email: '', password: '', ikiAdimSifirla: false });
  const [mesgul, setMesgul] = useState(false);
  const [sonuc, setSonuc] = useState<{ ok: boolean; metin: string } | null>(null);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setMesgul(true); setSonuc(null);
    try {
      const r = await fetch('/api/setup/create-superadmin', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok) {
        setSonuc({ ok: true, metin: j.durum === 'HESAP_ACILDI' ? k.acildi : k.yenilendi });
        setF({ ...f, secret: '', password: '' });
      } else {
        setSonuc({ ok: false, metin: j.error || k.hata });
      }
    } catch {
      setSonuc({ ok: false, metin: sz.superAdmin.girisHata.SUNUCU_HATASI });
    } finally {
      setMesgul(false);
    }
  };

  const girdi = 'w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500';
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6 text-center">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mb-4"><KeyRound className="w-7 h-7" /></div>
          <h1 className="text-xl font-bold text-gray-900">{k.baslik}</h1>
          <p className="text-gray-500 text-sm mt-2">{k.alt}</p>
        </div>
        <form onSubmit={gonder} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          {sonuc && (
            <div role={sonuc.ok ? 'status' : 'alert'} className={`text-sm px-4 py-3 rounded-xl border ${sonuc.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-100 border-red-200 text-red-700'}`}>{sonuc.metin}</div>
          )}
          <label className="block text-xs text-gray-500">{k.anahtar}
            <input type="password" autoComplete="off" className={`${girdi} mt-1.5`} value={f.secret} onChange={(e) => setF({ ...f, secret: e.target.value })} required />
          </label>
          <label className="block text-xs text-gray-500">{sz.superAdmin.eposta}
            <input type="email" autoComplete="username" className={`${girdi} mt-1.5`} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required />
          </label>
          <label className="block text-xs text-gray-500">{k.yeniSifre}
            <input type="password" autoComplete="new-password" minLength={12} className={`${girdi} mt-1.5`} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700 min-h-[40px]">
            <input type="checkbox" className="h-4 w-4" checked={f.ikiAdimSifirla} onChange={(e) => setF({ ...f, ikiAdimSifirla: e.target.checked })} />
            {k.ikiAdim}
          </label>
          <button type="submit" disabled={mesgul} className="w-full min-h-[44px] rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-500 disabled:opacity-50">{k.dugme}</button>
        </form>
        <p className="text-center mt-4"><Link href="/super-admin/login" className="text-sm text-gray-600 hover:text-gray-900">← {k.girise}</Link></p>
      </div>
    </div>
  );
}
