'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBicim, useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import {
  eksikFiyatlar, fiyatliMi, FIYAT_MODELLERI, kademeleriYapistir, liraOku, secenekKodu, urunleriYapistir,
  type FiyatModeli, type KuralTuru, type SecenekGrubu, type UrunTanimi,
} from '@/lib/baski-fiyat';

/**
 * FİYAT LİSTESİ — ürün kartları; "Düzenle" kartı açar. Hazır ürünün seçenek
 * yapısı şablondan gelir, rakamları matbaa girer: kademe fiyatları, ek
 * fiyatlar, çarpanlar, asgari tutar. Kendi seçenek grubunu da ekleyebilir
 * (kâğıt türü, laminasyon). Excel'deki liste yapıştırılabilir: ürün listesi
 * sayfanın üstünden, kademeler ürünün içinden. Fiyatlar lira yazılır,
 * kuruşa çevrilip kaydedilir.
 */
export interface ListeUrunu { id: string; kategori: string; online: boolean; aktif: boolean; teslimSaat: number | null; tanim: UrunTanimi }

const alan = 'w-full rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:border-[#0f2253] focus:outline-none';
const lira = (k: number) => (k ? (k / 100).toFixed(2) : '');
const kurus = (s: string) => liraOku(s);

// Yeni seçenek grubu taslağı. "YOK" = fiyat farkı olmayan seçenek (mat / parlak): CARPAN 1 yazılır.
type YeniDeger = { ad: string; tur: 'YOK' | KuralTuru; deger: string };
type YeniGrup = { ad: string; zorunlu: boolean; degerler: YeniDeger[] };
const BOS_DEGER: YeniDeger = { ad: '', tur: 'YOK', deger: '' };

/** Taslağı kayda çevirir; adı ya da seçeneği olmayan grup yazılmaz. İlk seçenek varsayılandır. */
function grubuCevir(g: YeniGrup, mevcutKodlar: string[]): SecenekGrubu | null {
  const kodlar: string[] = [];
  const degerler = g.degerler.filter((d) => d.ad.trim()).map((d, i) => {
    const kod = secenekKodu(d.ad, kodlar);
    kodlar.push(kod);
    const tur: KuralTuru = d.tur === 'YOK' ? 'CARPAN' : d.tur;
    const deger = d.tur === 'YOK' ? 1 : d.tur === 'CARPAN' ? Number(d.deger.replace(',', '.')) || 1 : kurus(d.deger);
    return { kod, ad: d.ad.trim(), tur, deger, ...(i === 0 ? { varsayilan: true } : {}) };
  });
  return g.ad.trim() && degerler.length ? { kod: secenekKodu(g.ad, mevcutKodlar), ad: g.ad.trim(), zorunlu: g.zorunlu, degerler } : null;
}

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
  const [silinen, setSilinen] = useState<string[]>([]);
  const [yeniGruplar, setYeniGruplar] = useState<YeniGrup[]>([]);
  const [yapistirAcik, setYapistirAcik] = useState(false);
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');
  const grupYaz = (i: number, ek: Partial<YeniGrup>) => setYeniGruplar((l) => l.map((g, j) => (j === i ? { ...g, ...ek } : g)));
  const degerYaz = (i: number, k: number, ek: Partial<YeniDeger>) => grupYaz(i, { degerler: yeniGruplar[i].degerler.map((d, j) => (j === k ? { ...d, ...ek } : d)) });

  async function kaydet() {
    setMesgul(true);
    setHata('');
    const eski = u.tanim.secenekler.filter((g) => !silinen.includes(g.kod)).map((g) => ({
      ...g,
      degerler: g.degerler.map((v) => v.araliklar
        ? { ...v, araliklar: v.araliklar.map((a, i) => ({ ...a, deger: kurus(degerler[`${g.kod}/${v.kod}/${i}`] ?? '') })) }
        : { ...v, deger: v.tur === 'CARPAN' ? Number(String(degerler[`${g.kod}/${v.kod}`]).replace(',', '.')) || 1 : kurus(degerler[`${g.kod}/${v.kod}`] ?? '') }),
    }));
    const secenekler: SecenekGrubu[] = [...eski];
    for (const g of yeniGruplar) {
      const c = grubuCevir(g, secenekler.map((x) => x.kod));
      if (c) secenekler.push(c);
    }
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
        <div className="mt-1 flex flex-wrap gap-4">
          <button type="button" onClick={() => setKademeler((l) => [...l, { min: '', fiyat: '' }])} className="text-sm font-semibold text-[#0f2253]">{m.kademeEkle}</button>
          <button type="button" onClick={() => setYapistirAcik((a) => !a)} className="text-sm text-gray-600 underline">{m.kademeYapistir}</button>
        </div>
        {yapistirAcik && (
          <label className="mt-2 block text-xs text-gray-500">{m.kademeYapistirAlt}
            {/* Yapıştırılan metin okunabiliyorsa kademelerin yerine geçer; okunamıyorsa liste değişmez. */}
            <textarea rows={3} className={alan} onChange={(e) => { const k = kademeleriYapistir(e.target.value); if (k.length) setKademeler(k.map((x) => ({ min: String(x.min), fiyat: lira(x.fiyat) }))); }} />
          </label>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase text-gray-500">{m.secenekler}</h3>
          {u.tanim.secenekler.filter((g) => !silinen.includes(g.kod)).map((g) => (
            <div key={g.kod}>
              <div className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-800">
                <span>{g.ad}</span>
                <button type="button" onClick={() => setSilinen((l) => [...l, g.kod])} className="text-xs font-normal text-gray-500 underline">{m.grupSil}</button>
              </div>
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
        {yeniGruplar.map((g, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-2">
            <div className="flex items-center gap-2">
              <input value={g.ad} onChange={(e) => grupYaz(i, { ad: e.target.value })} placeholder={m.grupAdi} className={alan} maxLength={60} />
              <button type="button" onClick={() => setYeniGruplar((l) => l.filter((_, j) => j !== i))} className="shrink-0 text-xs text-gray-500 underline">{m.grupSil}</button>
            </div>
            {g.degerler.map((d, k) => (
              <div key={k} className="mt-1 grid grid-cols-[1fr_auto_5rem] gap-2">
                <input value={d.ad} onChange={(e) => degerYaz(i, k, { ad: e.target.value })} placeholder={m.degerAdi} className={alan} maxLength={60} />
                <select value={d.tur} onChange={(e) => degerYaz(i, k, { tur: e.target.value as YeniDeger['tur'] })} className={alan}>
                  {(['YOK', 'BIRIM', 'SABIT', 'CARPAN'] as const).map((t) => <option key={t} value={t}>{m.degerTur[t]}</option>)}
                </select>
                <input inputMode="decimal" value={d.deger} disabled={d.tur === 'YOK'} onChange={(e) => degerYaz(i, k, { deger: e.target.value })} className={alan + ' disabled:bg-gray-100'} />
              </div>
            ))}
            <div className="mt-1 flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => grupYaz(i, { degerler: [...g.degerler, { ...BOS_DEGER }] })} className="text-sm font-semibold text-[#0f2253]">{m.degerEkle}</button>
              <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={g.zorunlu} onChange={(e) => grupYaz(i, { zorunlu: e.target.checked })} /> {m.grupZorunlu}</label>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setYeniGruplar((l) => [...l, { ad: '', zorunlu: true, degerler: [{ ...BOS_DEGER }, { ...BOS_DEGER }] }])} className="text-sm font-semibold text-[#0f2253]">{m.grupEkle}</button>
      </div>

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
  const [yapistir, setYapistir] = useState<string | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const okunan = yapistir ? urunleriYapistir(yapistir) : [];

  async function aktar() {
    setMesgul(true);
    const r = await fetch('/api/matbaa/urunler/yapistir', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ metin: yapistir }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    setMesgul(false);
    setBilgi(r?.ok ? doldur(m.aktarildi, { eklenen: j.eklenen ?? 0, guncellenen: j.guncellenen ?? 0 }) : (j.error ?? m.hataGenel));
    if (r?.ok) { setYapistir(null); router.refresh(); }
  }

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
      {yapistir === null ? (
        <button type="button" onClick={() => setYapistir('')} className="mt-2 text-sm text-gray-600 underline">{m.yapistir}</button>
      ) : (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-sm text-gray-600">{m.yapistirAlt}</p>
          <textarea value={yapistir} onChange={(e) => setYapistir(e.target.value)} rows={6} placeholder={m.yapistirYer} className={alan + ' mt-2 font-mono'} autoFocus />
          {yapistir.trim() !== '' && (
            <div className="mt-2 text-sm">
              <p className={okunan.length ? 'font-semibold text-gray-800' : 'text-amber-800'}>{okunan.length ? doldur(m.yapistirOnizleme, { n: okunan.length }) : m.yapistirBos}</p>
              {okunan.slice(0, 5).map((s) => <div key={s.ad} className="flex justify-between gap-3 text-gray-600"><span className="truncate">{s.ad}</span><span className="shrink-0">{b.para(s.fiyat / 100)}</span></div>)}
              {okunan.length > 5 && <div className="text-gray-400">…</div>}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={aktar} disabled={mesgul || !okunan.length} className="rounded-lg bg-[#0f2253] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{m.aktar}</button>
            <button type="button" onClick={() => setYapistir(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm">{m.vazgec}</button>
          </div>
        </div>
      )}
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
