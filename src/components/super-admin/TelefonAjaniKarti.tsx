'use client';

/*
 * SUPER ADMIN — bayinin telefon ajani: hat numarasi, aktarma numarasi,
 * "kaydet ve kur". Hatti YALNIZ platform ekibi atar (Retell hesabi ortak;
 * bayi baska bir hatti kendine baglayamasin). Bayi yalniz ac/kapa, asistan
 * adi ve aktarma numarasini kendi ekranindan degistirir.
 */
import { useCallback, useEffect, useState } from 'react';
import { useBicim, useDil } from '@/lib/i18n/client';
import { ajanMetni, doldurMetin } from '@/lib/telefon-ajani-metin';
import type { HazirlikKodu, TaslakSayaci } from '@/lib/telefon-ajani';
import type { KurulumKodu } from '@/lib/ses-cekirdek/retell-govde';

interface Durum {
  acik: boolean;
  hatNumarasi: string | null;
  aktarmaTelefonu: string | null;
  kurulu: boolean;
  retellSenkronAt: string | null;
  retellHata: string | null;
  hazirlik: { kod: HazirlikKodu; tamam: boolean }[];
  sayac: { buAy: TaslakSayaci; toplam: TaslakSayaci };
}

export default function TelefonAjaniKarti({ id }: { id: string }) {
  const { dil } = useDil();
  const b = useBicim();
  const m = ajanMetni(dil);
  const sa = m.superAdmin;

  const [d, setD] = useState<Durum | null>(null);
  const [hat, setHat] = useState('');
  const [aktarma, setAktarma] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [bilgi, setBilgi] = useState<{ ok: boolean; metin: string } | null>(null);

  const yukle = useCallback(async () => {
    const r = await fetch(`/api/super-admin/tenants/${id}/telefon-ajani`).catch(() => null);
    if (!r?.ok) return;
    const v = (await r.json()) as Durum;
    setD(v);
    setHat(v.hatNumarasi ? `+${v.hatNumarasi}` : '');
    setAktarma(v.aktarmaTelefonu ?? '');
  }, [id]);

  useEffect(() => {
    yukle();
  }, [yukle]);

  const gonder = async (kur: boolean) => {
    setMesgul(true);
    setBilgi(null);
    try {
      const r = await fetch(`/api/super-admin/tenants/${id}/telefon-ajani`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hatNumarasi: hat, aktarmaTelefonu: aktarma, kur }),
      });
      const v = await r.json().catch(() => ({}));
      if (!r.ok) {
        setBilgi({ ok: false, metin: v.error || m.hata });
        return;
      }
      const uyarilar = ((v.uyarilar ?? []) as string[]).map((u) => m.uyari[u] ?? u);
      const kurulum = v.kurulum as { ok: boolean; kod?: KurulumKodu; detay?: string } | null;
      if (kurulum && !kurulum.ok) {
        const neden = kurulum.kod ? m.kurulum[kurulum.kod] : m.hata;
        setBilgi({ ok: false, metin: [neden, kurulum.detay, ...uyarilar].filter(Boolean).join(' · ') });
      } else {
        setBilgi({ ok: true, metin: [kurulum ? sa.kuruldu : m.ayar.kaydedildi, ...uyarilar].join(' · ') });
      }
      await yukle();
    } finally {
      setMesgul(false);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
      <h3 className="font-bold text-gray-900">{sa.baslik}</h3>
      <p className="text-sm text-gray-500 mt-1">{sa.alt}</p>

      {d && (
        <div className="mt-3 text-sm text-gray-700 space-y-1">
          <div>{doldurMetin(sa.ajanDurumu, { durum: d.acik ? m.ayar.acik : m.ayar.kapali })}</div>
          <div>{doldurMetin(sa.sayac, { acilan: b.sayi(d.sayac.toplam.acilan), onaylanan: b.sayi(d.sayac.toplam.onaylanan) })}</div>
          {d.retellSenkronAt && <div>{doldurMetin(sa.sonGonderim, { zaman: b.tarihSaat(d.retellSenkronAt) })}</div>}
          {d.retellHata && <div className="text-red-700">{doldurMetin(sa.sonHata, { kod: m.kurulum[d.retellHata as KurulumKodu] ?? d.retellHata })}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
        <div>
          <label htmlFor="sa-hat" className="block text-xs font-bold text-gray-600 mb-1">{sa.hatNumarasi}</label>
          <input id="sa-hat" value={hat} onChange={(e) => setHat(e.target.value)} inputMode="tel" maxLength={20}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="sa-aktarma" className="block text-xs font-bold text-gray-600 mb-1">{sa.aktarma}</label>
          <input id="sa-aktarma" value={aktarma} onChange={(e) => setAktarma(e.target.value)} inputMode="tel" maxLength={20}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" disabled={mesgul} onClick={() => gonder(false)}
          className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 bg-white">
          {sa.kaydet}
        </button>
        <button type="button" disabled={mesgul} onClick={() => gonder(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-indigo-700">
          {mesgul ? sa.kuruluyor : sa.kur}
        </button>
      </div>

      {bilgi && (
        <div role={bilgi.ok ? 'status' : 'alert'} className={`mt-3 text-sm rounded-lg px-3 py-2 ${bilgi.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {bilgi.metin}
        </div>
      )}

      {d && (
        <ul className="mt-4 grid gap-1 text-sm">
          {d.hazirlik.map((h) => (
            <li key={h.kod} className="flex gap-2">
              <span className={`font-bold min-w-[52px] ${h.tamam ? 'text-green-700' : 'text-amber-700'}`}>
                {h.tamam ? m.hazirlik.tamam : m.hazirlik.eksik}
              </span>
              <span>{m.hazirlik.kod[h.kod]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
