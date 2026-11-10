'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDil } from '@/lib/i18n/client';
import { matbaaMetni } from '@/lib/matbaa-metin';
import type { YanitTuru } from '@/lib/matbaa-ayar';

/**
 * SİPARİŞ SAYFASI AYARLARI — tek form, tek "Kaydet". Altında WhatsApp'a bir
 * kez yapıştırılacak hazır metinler: her satırda tek düğme (Kopyala).
 * Karşılama mesajı kopyalanınca kurulum listesindeki adım kapanır.
 */
interface Ilk { kisaAd: string; siparisAcik: boolean; calismaSaatleri: string; hazirlamaSaat: number; havaleKabul: boolean; saklamaGun: number; karsilamaMetni: string }

const alan = 'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-[15px] focus:border-[#0f2253] focus:outline-none';
const etiket = 'mb-1 block text-xs font-semibold text-gray-600';

function Yanit({ tur, metin }: { tur: YanitTuru; metin: string }) {
  const { dil } = useDil();
  const m = matbaaMetni(dil);
  const [tamam, setTamam] = useState(false);
  async function kopyala() {
    try {
      await navigator.clipboard.writeText(metin);
      setTamam(true);
      setTimeout(() => setTamam(false), 2000);
      // Kurulum adımı: karşılama mesajı kopyalandı. Kaydedilemezse ekran yine çalışır.
      if (tur === 'KARSILAMA') fetch('/api/matbaa/ayar', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ karsilamaKopyalandi: true }), keepalive: true }).catch(() => {});
    } catch { /* pano izni yok: metin ekranda, elle seçilebilir */ }
  }
  return (
    <div className="border-t border-gray-100 px-4 py-3 first:border-t-0">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-gray-800">{m.yanit[tur]}</span>
        <button type="button" onClick={kopyala} className="shrink-0 rounded-lg bg-[#0f2253] px-3 py-1.5 text-sm font-semibold text-white">{tamam ? m.kopyalandi : m.kopyala}</button>
      </div>
      <p className="mt-1 select-all whitespace-pre-wrap break-words text-sm text-gray-600">{metin}</p>
    </div>
  );
}

export default function AyarFormu({ kok, ilk, ibanVar, dosyaAcik, yanitlar }: { kok: string; ilk: Ilk; ibanVar: boolean; dosyaAcik: boolean; yanitlar: { tur: YanitTuru; metin: string }[] }) {
  const router = useRouter();
  const { dil } = useDil();
  const m = matbaaMetni(dil);
  const [f, setF] = useState(ilk);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');
  const [bilgi, setBilgi] = useState('');
  const yaz = <K extends keyof Ilk>(k: K, v: Ilk[K]) => { setF((x) => ({ ...x, [k]: v })); setBilgi(''); };

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    setMesgul(true);
    setHata('');
    const r = await fetch('/api/matbaa/ayar', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(f) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setMesgul(false);
    if (!r?.ok) { setHata(j.error ?? m.hataGenel); return; }
    setBilgi(m.kaydedildi);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{m.ayarBaslik}</h1>
        <p className="mt-2 text-sm text-gray-600">{m.ayarAlt}</p>
      </div>

      <form onSubmit={kaydet} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div>
          <label htmlFor="kisaAd" className={etiket}>{m.ayarAdres}</label>
          <div className="flex items-center gap-1">
            <span className="hidden shrink-0 text-sm text-gray-500 sm:inline">{kok.replace(/^https?:\/\//, '')}</span>
            <input id="kisaAd" value={f.kisaAd} onChange={(e) => yaz('kisaAd', e.target.value.toLowerCase())} className={alan} maxLength={40} autoCapitalize="none" spellCheck={false} />
          </div>
          <p className="mt-1 text-xs text-gray-500">{m.ayarAdresNot}</p>
          {ilk.kisaAd && <a href={`${kok}${ilk.kisaAd}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-sm font-semibold text-[#0f2253] underline">{m.ayarSayfayiAc}</a>}
        </div>

        <label className="flex items-start gap-3">
          <input type="checkbox" checked={f.siparisAcik} onChange={(e) => yaz('siparisAcik', e.target.checked)} className="mt-1 h-4 w-4" />
          <span><span className="text-sm font-semibold text-gray-800">{m.ayarAcik}</span><span className="block text-xs text-gray-500">{m.ayarAcikNot}</span></span>
        </label>

        <div>
          <label htmlFor="saat" className={etiket}>{m.ayarSaatler}</label>
          <input id="saat" value={f.calismaSaatleri} onChange={(e) => yaz('calismaSaatleri', e.target.value)} className={alan} maxLength={200} placeholder={m.ayarSaatlerYer} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="hazirlama" className={etiket}>{m.ayarHazirlama}</label>
            <input id="hazirlama" type="number" min={1} max={240} inputMode="numeric" value={f.hazirlamaSaat} onChange={(e) => yaz('hazirlamaSaat', Number(e.target.value))} className={alan} />
            <p className="mt-1 text-xs text-gray-500">{m.ayarHazirlamaNot}</p>
          </div>
          <div>
            <label htmlFor="saklama" className={etiket}>{m.ayarSaklama}</label>
            <input id="saklama" type="number" min={7} max={365} inputMode="numeric" value={f.saklamaGun} onChange={(e) => yaz('saklamaGun', Number(e.target.value))} className={alan} />
          </div>
        </div>

        <label className="flex items-start gap-3">
          <input type="checkbox" checked={f.havaleKabul} onChange={(e) => yaz('havaleKabul', e.target.checked)} className="mt-1 h-4 w-4" />
          <span><span className="text-sm font-semibold text-gray-800">{m.ayarHavale}</span><span className={`block text-xs ${ibanVar ? 'text-gray-500' : 'text-amber-800'}`}>{ibanVar ? m.ayarHavaleNot : m.ayarIbanYok}</span></span>
        </label>

        <div>
          <label htmlFor="karsilama" className={etiket}>{m.ayarKarsilama}</label>
          <textarea id="karsilama" value={f.karsilamaMetni} onChange={(e) => yaz('karsilamaMetni', e.target.value)} className={alan} rows={3} maxLength={1000} />
          <p className="mt-1 text-xs text-gray-500">{m.ayarKarsilamaNot}</p>
        </div>

        <p className={`rounded-lg px-3 py-2 text-sm ${dosyaAcik ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>{dosyaAcik ? m.ayarDosyaAcik : m.ayarDosyaKapali}</p>

        {hata && <p role="alert" className="text-sm text-red-700">{hata}</p>}
        {bilgi && <p role="status" className="text-sm text-emerald-800">{bilgi}</p>}
        <button type="submit" disabled={mesgul} className="rounded-xl bg-[#0f2253] px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{mesgul ? m.kaydediliyor : m.kaydet}</button>
      </form>

      {yanitlar.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-gray-900">{m.yanitBaslik}</h2>
          <p className="mt-1 text-sm text-gray-600">{m.yanitAlt}</p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
            {yanitlar.map((y) => <Yanit key={y.tur} tur={y.tur} metin={y.metin} />)}
          </div>
        </section>
      )}
    </div>
  );
}
