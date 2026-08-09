'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Onizleme {
  hedefBayi: string; kaynakFirma: string; yedekTarihi: string | null;
  yazilacak: Record<string, number>; silinecek: Record<string, number>;
  hedefBos: boolean; kullaniciSayisi: number;
  hatalar: string[]; uyarilar: string[];
  uygulandi: boolean; onayGerekli?: string; yazilan?: Record<string, number>; error?: string;
}

const ETIKET: Record<string, string> = {
  customers: 'Müşteri', devices: 'Cihaz', tickets: 'Servis fişi', readings: 'Sayaç okuması',
  parts: 'Parça', ticketParts: 'Fiş parçası', invoices: 'Fatura', invoiceLines: 'Fatura satırı',
  accountEntries: 'Cari hareket', payments: 'Tahsilat',
  musteri: 'Müşteri', cihaz: 'Cihaz', fis: 'Servis fişi', sayac: 'Sayaç okuması',
  fatura: 'Fatura', tahsilat: 'Tahsilat',
};

export default function GeriYuklePage() {
  const [bayiler, setBayiler] = useState<{ id: string; name: string }[]>([]);
  const [tenantId, setTenantId] = useState('');
  const [dosya, setDosya] = useState<any>(null);
  const [dosyaAdi, setDosyaAdi] = useState('');
  const [onizleme, setOnizleme] = useState<Onizleme | null>(null);
  const [onay, setOnay] = useState('');
  const [calisiyor, setCalisiyor] = useState(false);
  const [hata, setHata] = useState('');

  useEffect(() => {
    fetch('/api/super-admin/tenants?limit=500').then(r => r.json())
      .then(d => setBayiler((Array.isArray(d) ? d : d.tenants ?? []).map((t: any) => ({ id: t.id, name: t.name }))))
      .catch(() => {});
  }, []);

  const hedefAd = bayiler.find(b => b.id === tenantId)?.name ?? '';

  async function dosyaSec(f: File | null) {
    setOnizleme(null); setOnay(''); setHata('');
    if (!f) { setDosya(null); setDosyaAdi(''); return; }
    setDosyaAdi(f.name);
    try { setDosya(JSON.parse(await f.text())); }
    catch { setDosya(null); setHata('Dosya okunamadı — geçerli bir JSON değil.'); }
  }

  async function gonder(uygula: boolean) {
    if (!tenantId || !dosya) return;
    setCalisiyor(true); setHata('');
    try {
      const r = await fetch('/api/backup/restore', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, backup: dosya, ...(uygula ? { onay } : {}) }),
      });
      const d = await r.json();
      setOnizleme(d);
      if (d.error) setHata(d.error);
    } catch { setHata('İstek gönderilemedi.'); }
    finally { setCalisiyor(false); }
  }

  const satirlar = (o: Record<string, number>) =>
    Object.entries(o).filter(([, n]) => n > 0).map(([k, n]) => `${ETIKET[k] ?? k}: ${n}`);

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <div className="border-b border-white/10 bg-black/30">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <Link href="/super-admin/dashboard" className="text-xs text-gray-400 hover:text-white">← Panel</Link>
          <h1 className="text-2xl font-bold mt-1">Yedekten Geri Yükleme</h1>
          <p className="text-xs text-gray-400 mt-1">
            Bayinin panelinden indirdiği JSON yedeği geri yazar. Hedef bayinin mevcut
            verisi <strong className="text-red-300">silinir</strong> — bu bir kurtarma aracıdır.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
        <div className="bg-white/3 border border-white/10 rounded-2xl p-4 space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">1. Hedef bayi</label>
            <select value={tenantId} onChange={e => { setTenantId(e.target.value); setOnizleme(null); setOnay(''); }}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm">
              <option value="">Seçin…</option>
              {bayiler.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1.5">2. Yedek dosyası (.json)</label>
            <input type="file" accept="application/json,.json"
              onChange={e => dosyaSec(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-gray-300 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-white/10 file:text-white file:text-sm" />
            {dosyaAdi && <div className="text-xs text-gray-500 mt-1.5">{dosyaAdi}</div>}
          </div>

          <button onClick={() => gonder(false)} disabled={!tenantId || !dosya || calisiyor}
            className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm font-medium">
            {calisiyor ? 'Kontrol ediliyor…' : '3. Önizle (hiçbir şey değişmez)'}
          </button>
        </div>

        {hata && (
          <div className="bg-red-500/10 border border-red-400/30 text-red-200 rounded-xl p-3 text-sm">{hata}</div>
        )}

        {onizleme && (
          <div className="bg-white/3 border border-white/10 rounded-2xl p-4 space-y-4">
            {onizleme.uygulandi ? (
              <div className="bg-emerald-500/10 border border-emerald-400/30 rounded-xl p-3">
                <div className="font-semibold text-emerald-300 text-sm">Geri yükleme tamamlandı</div>
                <div className="text-xs text-gray-300 mt-1.5">{satirlar(onizleme.yazilan ?? {}).join(' · ') || 'Yazılan kayıt yok'}</div>
                {onizleme.kullaniciSayisi > 0 && (
                  <div className="text-xs text-amber-300 mt-2">
                    Kullanıcılar <strong>pasif ve şifresiz</strong> geri geldi — bayi yöneticisinin şifre ataması gerekir.
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="bg-black/30 border border-white/5 rounded-xl p-3">
                    <div className="text-xs text-gray-400 mb-1.5">Yazılacak (yedekten)</div>
                    <div className="text-sm">{satirlar(onizleme.yazilacak).join(' · ') || '—'}</div>
                    <div className="text-[11px] text-gray-500 mt-2">
                      Kaynak: {onizleme.kaynakFirma || '—'}
                      {onizleme.yedekTarihi && ` · ${new Date(onizleme.yedekTarihi).toLocaleString('tr-TR')}`}
                    </div>
                  </div>
                  <div className={`rounded-xl p-3 border ${onizleme.hedefBos ? 'bg-black/30 border-white/5' : 'bg-red-500/10 border-red-400/30'}`}>
                    <div className="text-xs text-gray-400 mb-1.5">Silinecek ({onizleme.hedefBayi})</div>
                    <div className="text-sm">
                      {onizleme.hedefBos
                        ? <span className="text-emerald-300">Hedef boş — silinecek veri yok</span>
                        : satirlar(onizleme.silinecek).join(' · ')}
                    </div>
                  </div>
                </div>

                {onizleme.hatalar.length > 0 && (
                  <ul className="text-xs text-red-300 space-y-1">
                    {onizleme.hatalar.map((h, i) => <li key={i}>• {h}</li>)}
                  </ul>
                )}
                {onizleme.uyarilar.length > 0 && (
                  <ul className="text-xs text-amber-300/90 space-y-1">
                    {onizleme.uyarilar.map((u, i) => <li key={i}>• {u}</li>)}
                  </ul>
                )}

                {onizleme.hatalar.length === 0 && (
                  <div className="border-t border-white/10 pt-4">
                    <label className="block text-xs text-gray-400 mb-1.5">
                      4. Onaylamak için firma adını birebir yazın: <strong className="text-white">{hedefAd}</strong>
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      <input value={onay} onChange={e => setOnay(e.target.value)} placeholder={hedefAd}
                        className="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm" />
                      <button onClick={() => gonder(true)} disabled={onay !== hedefAd || calisiyor}
                        className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-30 text-sm font-semibold">
                        {calisiyor ? 'Yükleniyor…' : 'Geri yükle'}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-2">
                      Tek işlemde yapılır: bir şey ters giderse hiçbir değişiklik kalmaz. İşlem denetim kaydına yazılır.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
