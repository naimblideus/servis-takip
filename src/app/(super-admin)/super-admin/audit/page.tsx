'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';

interface Kayit {
  id: string; tarih: string; bayi: string; islem: string; varlik: string;
  kim: string; kimTipi: string; ip: string | null;
  oncesi: string | null; sonrasi: string | null;
}
interface Zincir { saglam: boolean; incelenen: number; sebepKod?: 'ZINCIR_KOPUK' | 'HASH_UYUSMUYOR' }

export default function AuditPage() {
  const sz = useT();
  const bic = useBicim();
  const z = sz.superAdmin.denetim;
  const [items, setItems] = useState<Kayit[]>([]);
  const [zincir, setZincir] = useState<Zincir | null>(null);
  const [bayiler, setBayiler] = useState<{ id: string; name: string }[]>([]);
  const [bayi, setBayi] = useState('');
  const [yukleniyor, setYukleniyor] = useState(true);
  const [acik, setAcik] = useState<string | null>(null);

  const yukle = useCallback((dogrula = false) => {
    setYukleniyor(true);
    const q = new URLSearchParams();
    if (bayi) q.set('tenantId', bayi);
    if (dogrula) q.set('dogrula', '1');
    fetch(`/api/super-admin/audit?${q}`)
      .then(r => r.json())
      .then(d => { setItems(d.items || []); if (d.zincir) setZincir(d.zincir); })
      .catch(() => {}).finally(() => setYukleniyor(false));
  }, [bayi]);

  useEffect(() => { setZincir(null); yukle(); }, [yukle]);
  useEffect(() => {
    // limit=500: liste sayfalı, varsayılan 20'de kesilirse açılır kutuda bayi eksik kalır
    fetch('/api/super-admin/tenants?limit=500').then(r => r.json())
      .then(d => setBayiler((Array.isArray(d) ? d : d.tenants ?? []).map((t: any) => ({ id: t.id, name: t.name }))))
      .catch(() => {});
  }, []);

  const tarih = (iso: string) => bic.tarihSaat(iso);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <div className="border-b border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-6 py-5">
          <Link href="/super-admin/dashboard" className="text-xs text-gray-500 hover:text-gray-900">{z.panelDon}</Link>
          <h1 className="text-2xl font-bold mt-1">{z.baslik}</h1>
          <p className="text-xs text-gray-500 mt-1">{z.alt}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="flex items-center gap-3 flex-wrap mb-5">
          <select value={bayi} onChange={e => setBayi(e.target.value)}
            className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm">
            <option value="">{z.tumBayiler}</option>
            {bayiler.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>

          {/* Zincir doğrulama kiracı bazlı — zincir de öyle kuruluyor */}
          <button onClick={() => yukle(true)} disabled={!bayi}
            title={bayi ? '' : z.onceBayiSec}
            className="px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm hover:bg-gray-100 disabled:opacity-40">
            {z.zinciriDogrula}
          </button>

          {zincir && (
            <span className={`text-xs font-semibold rounded-full px-3 py-1.5 border ${
              zincir.saglam
                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                : 'text-red-700 bg-red-50 border-red-200'}`}>
              {zincir.saglam
                ? doldur(z.zincirSaglam, { n: zincir.incelenen })
                : doldur(z.zincirBozuk, { sebep: zincir.sebepKod ? z.sebep[zincir.sebepKod] : '' })}
            </span>
          )}
        </div>

        {yukleniyor && <div className="text-gray-500 text-sm">{z.yukleniyor}</div>}

        {!yukleniyor && items.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <div className="font-semibold">{z.kayitYok}</div>
            <p className="text-xs text-gray-500 mt-2">{z.kayitYokAlt}</p>
          </div>
        )}

        <div className="space-y-2">
          {items.map(k => (
            <div key={k.id} className="bg-white border border-gray-200 rounded-xl p-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <span className="font-semibold text-sm">{k.islem}</span>
                  <span className="text-xs text-gray-500 ml-2">{k.varlik}</span>
                </div>
                <div className="text-xs text-gray-500">{tarih(k.tarih)}</div>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {k.bayi} · {k.kim}
                <span className="ml-1 opacity-60">({k.kimTipi})</span>
                {k.ip && <span className="ml-1 opacity-60">· {k.ip}</span>}
              </div>

              {(k.oncesi || k.sonrasi) && (
                <button onClick={() => setAcik(acik === k.id ? null : k.id)}
                  className="text-[11px] text-blue-700 hover:text-blue-800 mt-2">
                  {acik === k.id ? z.ayrintiGizle : z.ayrinti}
                </button>
              )}
              {acik === k.id && (
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {k.oncesi && (
                    <pre className="text-[11px] bg-gray-50 border border-gray-100 rounded-lg p-2 overflow-auto max-h-48 whitespace-pre-wrap">
                      <span className="text-gray-500">{z.oncesi}</span>{'\n'}{k.oncesi}
                    </pre>
                  )}
                  {k.sonrasi && (
                    <pre className="text-[11px] bg-gray-50 border border-gray-100 rounded-lg p-2 overflow-auto max-h-48 whitespace-pre-wrap">
                      <span className="text-gray-500">{z.sonrasi}</span>{'\n'}{k.sonrasi}
                    </pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
