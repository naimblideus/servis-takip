'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Lead {
  id: string; firma: string | null; yetkili: string | null; telefon: string | null;
  eposta: string | null; cihazSayisi: string | null; mesaj: string | null;
  kaynak: string | null; kampanya: string | null; crmDurum: string;
  okundu: boolean; createdAt: string;
}

export default function TaleplerPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bekleyen, setBekleyen] = useState(0);
  const [hepsi, setHepsi] = useState(false);
  const [yukleniyor, setYukleniyor] = useState(true);

  const yukle = useCallback(() => {
    setYukleniyor(true);
    fetch(`/api/super-admin/leads${hepsi ? '?hepsi=1' : ''}`)
      .then(r => r.json())
      .then(d => { setLeads(d.leads || []); setBekleyen(d.bekleyen || 0); })
      .catch(() => {})
      .finally(() => setYukleniyor(false));
  }, [hepsi]);

  useEffect(() => { yukle(); }, [yukle]);

  const isaretle = async (id: string, okundu: boolean) => {
    await fetch('/api/super-admin/leads', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, okundu }),
    });
    yukle();
  };

  const tarih = (iso: string) =>
    new Date(iso).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const telLink = (t: string | null) => (t ? 'tel:+9' + t.replace(/\D/g, '').replace(/^9?0?/, '0') : undefined);
  const waLink = (t: string | null) => {
    if (!t) return undefined;
    let d = t.replace(/\D/g, '');
    if (d.startsWith('0')) d = '90' + d.slice(1);
    else if (d.length === 10) d = '90' + d;
    return `https://wa.me/${d}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <div className="border-b border-white/10 bg-black/30">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <Link href="/super-admin/dashboard" className="text-xs text-gray-400 hover:text-white">← Panel</Link>
            <h1 className="text-2xl font-bold mt-1">Talepler</h1>
            <p className="text-xs text-gray-400 mt-1">
              Landing sayfasındaki formdan gelen demo/bilgi talepleri
              {bekleyen > 0 && <span className="text-amber-300 font-semibold"> · {bekleyen} bekliyor</span>}
            </p>
          </div>
          <button onClick={() => setHepsi(!hepsi)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10">
            {hepsi ? 'Sadece bekleyenler' : 'Tümünü göster'}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {yukleniyor && <div className="text-gray-400 text-sm">Yükleniyor…</div>}

        {!yukleniyor && leads.length === 0 && (
          <div className="bg-white/3 border border-white/10 rounded-2xl p-10 text-center">
            <div className="text-3xl mb-2">📭</div>
            <div className="font-semibold">{hepsi ? 'Hiç talep yok' : 'Bekleyen talep yok'}</div>
            <p className="text-xs text-gray-400 mt-2 max-w-md mx-auto">
              Landing sayfasındaki form doldurulduğunda talepler burada birikir.
              CRM bağlı olmasa bile hiçbir talep kaybolmaz.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {leads.map(l => (
            <div key={l.id}
              className={`bg-white/3 border rounded-2xl p-4 ${l.okundu ? 'border-white/10 opacity-60' : 'border-amber-500/30'}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="font-bold">{l.firma || l.yetkili || 'İsimsiz talep'}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {l.yetkili && l.firma ? `${l.yetkili} · ` : ''}
                    {l.cihazSayisi ? `${l.cihazSayisi} cihaz · ` : ''}
                    {tarih(l.createdAt)}
                    {l.kaynak ? ` · ${l.kaynak}` : ''}
                    {l.crmDurum === 'hata' && <span className="text-red-300"> · CRM'e iletilemedi</span>}
                  </div>
                </div>
                <button onClick={() => isaretle(l.id, !l.okundu)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10 shrink-0">
                  {l.okundu ? 'Geri al' : '✓ İlgilenildi'}
                </button>
              </div>

              {l.mesaj && (
                <p className="text-sm text-gray-200 mt-3 bg-black/20 border border-white/5 rounded-xl p-3 whitespace-pre-wrap">
                  {l.mesaj}
                </p>
              )}

              <div className="flex gap-2 mt-3 flex-wrap">
                {l.telefon && (
                  <>
                    <a href={waLink(l.telefon)} target="_blank" rel="noreferrer"
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500">
                      WhatsApp
                    </a>
                    <a href={telLink(l.telefon)}
                      className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10">
                      {l.telefon}
                    </a>
                  </>
                )}
                {l.eposta && (
                  <a href={`mailto:${l.eposta}`}
                    className="px-3 py-1.5 rounded-xl text-xs font-medium bg-white/5 border border-white/10 hover:bg-white/10">
                    {l.eposta}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
