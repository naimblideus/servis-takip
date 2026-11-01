'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBicim, useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { eksikFiyatlar, fiyatliMi, FIYAT_MODELLERI, type FiyatModeli, type UrunTanimi } from '@/lib/baski-fiyat';

/**
 * FİYAT LİSTESİ — ürün kartları; "Düzenle" kartı açar. Seçenek yapısı
 * (gruplar, değerler) şablondan gelir; burada yalnız rakamlar girilir:
 * kademe fiyatları, ek fiyatlar, çarpanlar, asgari tutar. Fiyatlar lira
 * olarak yazılır, kuruşa çevrilip kaydedilir.
 */
export interface ListeUrunu { id: string; kategori: string; online: boolean; aktif: boolean; teslimSaat: number | null; tanim: UrunTanimi }

const alan = 'w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-[#0f2253] focus:outline-none';
const lira = (k: number) => (k ? (k / 100).toFixed(2) : '');
const kurus = (s: string) => { const n = Number(String(s).replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0; };

function Duzenleyici({ u, kapat }: { u: ListeUrunu; kapat: () => void }) {
  const router = useRouter();
  const { dil } = useDil();
  const m = matbaaMetni(dil);
  // Taslak: rakamlar metin olarak (yazarken "12," gibi ara değerler bozulmasın).
  const [ad, setAd] = useState(u.tanim.ad);
  const [model, setModel] = useState<FiyatModeli>(u.tanim.fiyatModeli);
  const [kademeler, setKademeler] = useState(u.tanim.kademeler.map((k) => ({ min: String(k.min), fiyat: lira(k.fiyat) })));
  const [degerler, setDegerler] = useState<Record<string, string>>(() => {
    const d: Record<string, string> = {};
    for (const g of u.tanim.secenekler) for (const v of g.degerler) {
      if (v.araliklar) v.araliklar.forEach((a, i) => { d[`${g.kod}/${v.kod}/${i}`] = lira(a.deger); });
      else d[`${g.kod}/${v.kod}`] = v.tur === 'CARPAN' ? String(v.deger) : lira(v.deger);
    }
    return d;
  });
  const [minTutar, setMinTutar] = useState(lira(u.tanim.minTutar));
  const [online, setOnline] = useState(u.online);
  const [aktif, setAktif] = useState(u.aktif);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');

  async function kaydet() {
    setMesgul(true);
    setHata('');
    const secenekler = u.tanim.secenekler.map((g) => ({
      ...g,
      degerler: g.degerler.map((v) => v.araliklar
        ? { ...v, araliklar: v.araliklar.map((a, i) => ({ ...a, deger: kurus(degerler[`${g.kod}/${v.kod}/${i}`] ?? '') })) }
        : { ...v, deger: v.tur === 'CARPAN' ? Number(String(degerler[`${g.kod}/${v.kod}`]).replace(',', '.')) || 1 : kurus(degerler[`${g.kod}/${v.kod}`] ?? '') }),
    }));
    const govde = {
      ad, kategori: u.kategori, fiyatModeli: model,
      kademeler: kademeler.filter((k) => k.min.trim()).map((k) => ({ min: Number(k.min), fiyat: kurus(k.fiyat) })),
      secenekler, minTutar: kurus(minTutar), kdvOrani: u.tanim.kdvOrani, kdvDahil: u.tanim.kdvDahil, yuvarlama: u.tanim.yuvarlama,
      teslimSaat: u.teslimSaat, online, aktif,
    };
    const r = await fetch(`/api/matbaa/urunler/${u.id}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(govde) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setMesgul(false);
    if (!r?.ok) { setHata(j.error ?? m.hataGenel); return; }
    kapat();
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-4 border-t border-gray-100 pt-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold text-gray-600">{m.urunAdi}
          <input value={ad} onChange={(e) => setAd(e.target.value)} className={alan} maxLength={120} />
        </label>
        <label className="text-xs font-semibold text-gray-600">{m.modelEtiket}
          <select value={model} onChange={(e) => setModel(e.target.value as FiyatModeli)} className={alan}>
            {FIYAT_MODELLERI.map((x) => <option key={x} value={x}>{m.model[x]}</option>)}
          </select>
        </label>
      </div>

      <div>
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-semibold text-gray-600">
          <span>{m.kademeMin}</span><span>{m.kademeFiyat}</span><span />
        </div>
        {kademeler.map((k, i) => (
          <div key={i} className="mt-1 grid grid-cols-[1fr_1fr_auto] gap-2">
            <input inputMode="numeric" value={k.min} onChange={(e) => setKademeler((l) => l.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))} className={alan} />
            <input inputMode="decimal" value={k.fiyat} onChange={(e) => setKademeler((l) => l.map((x, j) => (j === i ? { ...x, fiyat: e.target.value } : x)))} className={alan} />
            <button type="button" onClick={() => setKademeler((l) => l.filter((_, j) => j !== i))} className="px-2 text-sm text-gray-500">×</button>
          </div>
        ))}
        <button type="button" onClick={() => setKademeler((l) => [...l, { min: '', fiyat: '' }])} className="mt-1 text-sm font-semibold text-[#0f2253]">{m.kademeEkle}</button>
      </div>

      {u.tanim.secenekler.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase text-gray-500">{m.secenekler}</h3>
          {u.tanim.secenekler.map((g) => (
            <div key={g.kod}>
              <div className="text-sm font-semibold text-gray-800">{g.ad}</div>
              {g.degerler.map((v) => (
                <div key={v.kod} className="mt-1 grid grid-cols-[1fr_1fr] items-center gap-2 text-sm">
                  <span className="text-gray-700">{v.ad} <span className="text-xs text-gray-400">({v.tur === 'CARPAN' ? m.carpan : m.secenekFiyat})</span></span>
                  {v.araliklar ? (
                    <div className="space-y-1">
                      {v.araliklar.map((a, i) => (
                        <label key={i} className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="w-32 shrink-0">{doldur(m.aralikMax, { max: a.max })}</span>
                          <input inputMode="decimal" value={degerler[`${g.kod}/${v.kod}/${i}`] ?? ''} onChange={(e) => setDegerler((d) => ({ ...d, [`${g.kod}/${v.kod}/${i}`]: e.target.value }))} className={alan} />
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input inputMode="decimal" value={degerler[`${g.kod}/${v.kod}`] ?? ''} onChange={(e) => setDegerler((d) => ({ ...d, [`${g.kod}/${v.kod}`]: e.target.value }))} className={alan} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs font-semibold text-gray-600">{m.minTutar}
          <input inputMode="decimal" value={minTutar} onChange={(e) => setMinTutar(e.target.value)} className={alan + ' w-32'} />
        </label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> {m.online}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={aktif} onChange={(e) => setAktif(e.target.checked)} /> {m.aktif}</label>
      </div>

      {hata && <p role="alert" className="text-sm text-red-700">{hata}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={kaydet} disabled={mesgul} className="rounded-lg bg-[#0f2253] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{mesgul ? m.kaydediliyor : m.kaydet}</button>
        <button type="button" onClick={kapat} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">{m.vazgec}</button>
      </div>
    </div>
  );
}

export default function FiyatListesi({ urunler }: { urunler: ListeUrunu[] }) {
  const router = useRouter();
  const { dil } = useDil();
  const b = useBicim();
  const m = matbaaMetni(dil);
  const [acik, setAcik] = useState<string | null>(null);
  const [bilgi, setBilgi] = useState('');

  async function sablonEkle() {
    const r = await fetch('/api/matbaa/urunler/sablon', { method: 'POST' }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setBilgi(r?.ok ? doldur(m.sablonEklendi, { n: j.eklenen ?? 0 }) : (j.error ?? m.hataGenel));
    router.refresh();
  }

  async function yeniUrun() {
    const r = await fetch('/api/matbaa/urunler', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ad: m.yeniUrunAdi, fiyatModeli: 'ADET', kademeler: [{ min: 1, fiyat: 0 }] }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) { setAcik(j.urun?.id ?? null); router.refresh(); } else setBilgi(j.error ?? m.hataGenel);
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">{m.fiyatBaslik}</h1>
        <div className="flex gap-2">
          <button type="button" onClick={sablonEkle} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold">{m.sablonEkle}</button>
          <button type="button" onClick={yeniUrun} className="rounded-lg bg-[#0f2253] px-3 py-2 text-sm font-semibold text-white">{m.yeniUrun}</button>
        </div>
      </div>
      <p className="mt-2 text-sm text-gray-600">{m.fiyatAlt}</p>
      {bilgi && <p role="status" className="mt-2 text-sm text-emerald-800">{bilgi}</p>}

      <div className="mt-4 space-y-2">
        {urunler.map((u) => {
          const fiyatli = fiyatliMi(u.tanim);
          const eksik = eksikFiyatlar(u.tanim);
          const enDusuk = u.tanim.kademeler.length ? Math.min(...u.tanim.kademeler.map((k) => k.fiyat)) : 0;
          return (
            <div key={u.id} className={`rounded-xl border border-gray-200 bg-white p-3 ${u.aktif ? '' : 'opacity-60'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900">{u.tanim.ad}</div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-gray-500">
                    <span>{m.model[u.tanim.fiyatModeli]}</span>
                    {fiyatli ? <span className="font-semibold text-gray-800">{b.para(enDusuk / 100)}</span>
                      : <span className="rounded bg-amber-100 px-1.5 font-bold text-amber-800">{m.fiyatsiz}</span>}
                    {!fiyatli && eksik.length > 0 && <span className="text-amber-800">{doldur(m.eksikFiyat, { liste: eksik.slice(0, 3).join(', ') })}</span>}
                  </div>
                </div>
                {acik !== u.id && <button type="button" onClick={() => setAcik(u.id)} className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold">{m.duzenle}</button>}
              </div>
              {acik === u.id && <Duzenleyici u={u} kapat={() => setAcik(null)} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
