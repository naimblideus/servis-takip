'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { sozluk, doldur, type Dil } from '@/lib/i18n/sozluk';

/**
 * Cihaz kartının altındaki iki düğme: arıza bildir / sayaç bildir.
 *
 * Kapalı dururlar. Müşteri panelinin işi önce BİLGİ vermek; formlar her zaman
 * açık dursa sayfa form yığınına döner ve asıl bilgi kaybolur.
 */
export default function TalepFormu({
  token, cihazId, cihazAd, kiralik, dil = 'tr',
}: { token: string; cihazId: string; cihazAd: string; kiralik: boolean; dil?: Dil }) {
  // Formu MÜŞTERİ dolduruyor: metinler bayinin dilinde.
  const sz = sozluk(dil).portal;
  const router = useRouter();
  const [acik, setAcik] = useState<'ARIZA' | 'SAYAC' | null>(null);
  const [aciklama, setAciklama] = useState('');
  const [black, setBlack] = useState('');
  const [color, setColor] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sonuc, setSonuc] = useState<{ ok: boolean; mesaj: string } | null>(null);

  function kapat() {
    setAcik(null); setAciklama(''); setBlack(''); setColor('');
  }

  async function gonder() {
    setGonderiliyor(true);
    try {
      const r = await fetch(`/api/portal/${token}/talep`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tur: acik, cihazId,
          ...(acik === 'ARIZA'
            ? { aciklama }
            : { sayacBlack: black, sayacColor: color }),
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setSonuc({ ok: true, mesaj: d.mesaj ?? 'Bildiriminiz iletildi.' });
        kapat();
        router.refresh(); // "Bildirimleriniz" listesi hemen güncellensin
      } else {
        setSonuc({ ok: false, mesaj: d.error ?? sz.gonderilemedi });
      }
    } catch {
      setSonuc({ ok: false, mesaj: sz.baglantiYok });
    } finally {
      setGonderiliyor(false);
    }
  }

  const gecerli = acik === 'ARIZA'
    ? aciklama.trim().length >= 5
    : black.trim() !== '' && Number.isFinite(Number(black.replace(/\D/g, '')));

  // DOKUNMA HEDEFİ: ölçüldü — bu düğmeler 30 px yüksekliğindeydi. Bu sayfayı
  // MÜŞTERİ kendi telefonundan açıyor ve bunlar sayfanın tek eyleme geçme
  // noktası. Parmak ucu ~45 px'lik alana basar; 30 px'te yanlış basış olağan.
  // min-h-11 (44 px) ile Apple'ın önerdiği hedefe çıkarıldı, yazı okunur boya.
  const dugme = 'inline-flex items-center justify-center min-h-11 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50';
  const alan = 'w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400';

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      {sonuc && (
        <div className={`mb-2.5 rounded-lg px-3 py-2 text-xs ${sonuc.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
          {sonuc.mesaj}
        </div>
      )}

      {!acik && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={dugme} onClick={() => { setAcik('ARIZA'); setSonuc(null); }}>
            {sz.arizaBildir}
          </button>
          {kiralik && (
            <button type="button" className={dugme} onClick={() => { setAcik('SAYAC'); setSonuc(null); }}>
              {sz.sayacBildir}
            </button>
          )}
        </div>
      )}

      {acik === 'ARIZA' && (
        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-slate-600">
            {doldur(sz.sorunNedir, { cihaz: cihazAd })}
          </label>
          <textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)}
            rows={3} maxLength={1000} autoFocus
            placeholder={sz.arizaYer}
            className={alan + ' resize-none'} />
          <p className="text-[11px] text-slate-400">
            {sz.arizaNot}
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={!gecerli || gonderiliyor} onClick={gonder}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40">
              {gonderiliyor ? sz.gonderiliyor : sz.gonder}
            </button>
            <button type="button" onClick={kapat} className={dugme}>{sz.vazgec}</button>
          </div>
        </div>
      )}

      {acik === 'SAYAC' && (
        <div className="space-y-2.5">
          <label className="block text-xs font-medium text-slate-600">
            {doldur(sz.sayacBaslik, { cihaz: cihazAd })}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="mb-1 block text-[11px] text-slate-500">{sz.siyahBeyaz}</span>
              <input value={black} onChange={(e) => setBlack(e.target.value)}
                inputMode="numeric" maxLength={9} autoFocus placeholder="145230" className={alan + ' tabular-nums'} />
            </div>
            <div>
              <span className="mb-1 block text-[11px] text-slate-500">{sz.renkliVarsa}</span>
              <input value={color} onChange={(e) => setColor(e.target.value)}
                inputMode="numeric" maxLength={9} placeholder="22410" className={alan + ' tabular-nums'} />
            </div>
          </div>
          <p className="text-[11px] text-slate-400">
            {sz.sayacNot}
          </p>
          <div className="flex gap-2">
            <button type="button" disabled={!gecerli || gonderiliyor} onClick={gonder}
              className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40">
              {gonderiliyor ? sz.gonderiliyor : sz.gonder}
            </button>
            <button type="button" onClick={kapat} className={dugme}>{sz.vazgec}</button>
          </div>
        </div>
      )}
    </div>
  );
}
