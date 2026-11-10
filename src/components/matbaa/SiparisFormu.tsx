'use client';

import { useMemo, useRef, useState } from 'react';
import { doldur } from '@/lib/i18n/sozluk';
import { bicimYap } from '@/lib/bicim';
import { musteriMetni } from '@/lib/matbaa-musteri-metin';
import { takipYolu } from '@/lib/matbaa-ayar';
import { fiyatHesapla, type UrunTanimi } from '@/lib/baski-fiyat';
import { dosyaTuru, DOSYA_AZAMI, IS_DOSYA_SAYISI } from '@/lib/baski-dosya';
import { dosyaYukle, onKontrol, type OnKontrol } from '@/lib/baski-yukle';

/**
 * SİPARİŞ FORMU — matbaanın müşterisi doldurur (giriş yok).
 *
 * Fiyat ekranda anında, tezgahla AYNI motorla; gönderilince sunucu yeniden
 * hesaplar (ekrandaki tutar gönderilmez). Sıra: ürün → dosya → fiyat → ad ve
 * telefon. Dosya seçilince sayfa sayısı dosyadan okunur ve kutuya yazılır;
 * müşteri "kaç sayfaydı" diye saymaz. Sipariş önce açılır, dosyalar sonra
 * doğrudan depoya yüklenir: yükleme yarıda kalsa da sipariş kaybolmaz.
 */
export interface SiparisUrunu { id: string; teslimSaat: number | null; tanim: UrunTanimi }
export interface SiparisKalemi { urunId: string; adet: string; sayfa: string; en: string; boy: string; secimler: Record<string, string> }
interface Dosya { dosya: File; bilgi: OnKontrol | null; yuzde: number; durum: 'BEKLIYOR' | 'YUKLENIYOR' | 'TAMAM' | 'HATA'; hata?: string }

const alan = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base focus:border-[#0f2253] focus:outline-none';
const etiket = 'mb-1 block text-xs font-semibold text-slate-600';
const secili = (a: boolean) => `rounded-lg px-3 py-2 text-sm font-semibold ${a ? 'bg-[#0f2253] text-white' : 'border border-slate-300 bg-white text-slate-700'}`;

export default function SiparisFormu({ kisaAd, dil, birim, urunler, havale, dosyaAcik, saklamaGun, hazirlamaSaat, ilkKalemler, ilkAd }: {
  kisaAd: string; dil: string; birim: string; urunler: SiparisUrunu[]; havale: boolean; dosyaAcik: boolean; saklamaGun: number; hazirlamaSaat: number;
  ilkKalemler: SiparisKalemi[] | null; ilkAd: string;
}) {
  const m = musteriMetni(dil);
  const b = useMemo(() => bicimYap(dil === 'en' ? 'en' : 'tr', birim), [dil, birim]);
  const bos = (): SiparisKalemi => ({ urunId: urunler[0].id, adet: '1', sayfa: '', en: '', boy: '', secimler: {} });
  const [kalemler, setKalemler] = useState<SiparisKalemi[]>(() => ilkKalemler ?? [bos()]);
  const [dosyalar, setDosyalar] = useState<Dosya[]>([]);
  const [sayfaDosyadan, setSayfaDosyadan] = useState(false);
  const [ad, setAd] = useState(ilkAd);
  const [telefon, setTelefon] = useState('');
  const [not, setNot] = useState('');
  const [web, setWeb] = useState('');
  const [odeme, setOdeme] = useState<'TESLIMDE' | 'HAVALE'>('TESLIMDE');
  const [asama, setAsama] = useState<'FORM' | 'GONDERILIYOR' | 'YUKLENIYOR' | 'EKSIK'>('FORM');
  const [hata, setHata] = useState('');
  const [sonuc, setSonuc] = useState<{ jeton: string; no: string } | null>(null);
  const giris = useRef<HTMLInputElement>(null);

  const urun = (id: string) => urunler.find((u) => u.id === id);
  const fiyatlar = useMemo(() => kalemler.map((k) => {
    const u = urunler.find((x) => x.id === k.urunId);
    return u ? fiyatHesapla(u.tanim, { adet: Number(k.adet), sayfa: Number(k.sayfa), enCm: Number(k.en), boyCm: Number(k.boy), secimler: k.secimler }) : null;
  }), [kalemler, urunler]);
  const toplam = fiyatlar.reduce((s, f) => s + (f?.ok ? f.toplam : 0), 0);
  const hepsiTamam = fiyatlar.length > 0 && fiyatlar.every((f) => f?.ok);
  const tahmini = fiyatlar.some((f) => f?.ok && f.tahmini);
  const sure = Math.max(...kalemler.map((k) => urun(k.urunId)?.teslimSaat ?? hazirlamaSaat));
  const degistir = (i: number, ek: Partial<SiparisKalemi>) => setKalemler((l) => l.map((k, j) => (j === i ? { ...k, ...ek } : k)));

  async function dosyaEkle(secilen: File[]) {
    for (const dosya of secilen) {
      if (dosyalar.length >= IS_DOSYA_SAYISI) break;
      if (!dosyaTuru(dosya.name)) { setDosyalar((l) => [...l, { dosya, bilgi: null, yuzde: 0, durum: 'HATA', hata: m.uyari.TUR }]); continue; }
      if (dosya.size > DOSYA_AZAMI) { setDosyalar((l) => [...l, { dosya, bilgi: null, yuzde: 0, durum: 'HATA', hata: m.uyari.BUYUK }]); continue; }
      // Afiş ve poster: çözünürlük seçilen ölçüye göre denetlenir.
      const olculu = kalemler.find((k) => Number(k.en) > 0 && Number(k.boy) > 0);
      const bilgi = await onKontrol(dosya, olculu ? { en: Number(olculu.en), boy: Number(olculu.boy) } : null);
      setDosyalar((l) => [...l, { dosya, bilgi, yuzde: 0, durum: 'BEKLIYOR' }]);
      // Sayfa sayısı boş olan ilk sayfa başı kalem dosyadan dolar.
      if (bilgi.sayfaSayisi) {
        setKalemler((l) => {
          const i = l.findIndex((k) => urun(k.urunId)?.tanim.fiyatModeli === 'SAYFA' && !k.sayfa);
          if (i < 0) return l;
          setSayfaDosyadan(true);
          return l.map((k, j) => (j === i ? { ...k, sayfa: String(bilgi.sayfaSayisi) } : k));
        });
      }
    }
  }

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    if (!hepsiTamam || ad.trim().length < 2 || telefon.replace(/\D/g, '').length < 10) { setHata(m.eksik); return; }
    setHata('');
    setAsama('GONDERILIYOR');
    const r = await fetch('/api/b/siparis', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kisaAd, musteriAd: ad, telefon, not, web, odemeYolu: odeme === 'HAVALE' ? 'HAVALE' : null,
        kalemler: kalemler.map((k) => ({ urunId: k.urunId, adet: Number(k.adet), sayfa: Number(k.sayfa) || undefined, enCm: Number(k.en) || undefined, boyCm: Number(k.boy) || undefined, secimler: k.secimler })),
      }),
    }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok || !j.jeton) { setHata(j.error ?? m.hataGenel); setAsama('FORM'); return; }
    setSonuc({ jeton: j.jeton, no: j.no });

    const bekleyen = dosyalar.map((d, i) => ({ d, i })).filter((x) => x.d.durum === 'BEKLIYOR');
    let eksik = false;
    if (bekleyen.length) {
      setAsama('YUKLENIYOR');
      for (const { d, i } of bekleyen) {
        const guncelle = (ek: Partial<Dosya>) => setDosyalar((l) => l.map((x, k) => (k === i ? { ...x, ...ek } : x)));
        guncelle({ durum: 'YUKLENIYOR' });
        const y = await dosyaYukle(d.dosya, { tur: 'MUSTERI', kisaAd, jeton: j.jeton }, d.bilgi, (yuzde) => guncelle({ yuzde }));
        guncelle(y.ok ? { durum: 'TAMAM', yuzde: 100 } : { durum: 'HATA', hata: y.hata ?? m.yuklenemedi });
        if (!y.ok) eksik = true;
      }
    }
    if (eksik) { setAsama('EKSIK'); return; }
    window.location.assign(takipYolu(kisaAd, j.jeton));
  }

  const dosyaListesi = dosyalar.length > 0 && (
    <div className="mt-2 space-y-2">
      {dosyalar.map((d, i) => (
        <div key={i} className="text-sm">
          <div className="flex justify-between gap-3">
            <span className="min-w-0 truncate">{d.dosya.name}</span>
            <span className={`shrink-0 text-xs ${d.durum === 'HATA' ? 'text-red-700' : d.durum === 'TAMAM' ? 'text-emerald-700' : 'text-slate-500'}`}>
              {d.durum === 'HATA' ? (d.hata ?? m.yuklenemedi) : d.durum === 'TAMAM' ? m.yuklendi : d.durum === 'YUKLENIYOR' ? doldur(m.yukleniyor, { yuzde: d.yuzde })
                : [d.bilgi?.sayfaSayisi ? doldur(m.sayfaBilgi, { n: d.bilgi.sayfaSayisi }) : null, d.bilgi?.olcu].filter(Boolean).join(' · ')}
              {asama === 'FORM' && <button type="button" onClick={() => setDosyalar((l) => l.filter((_, k) => k !== i))} className="ml-2 underline">{m.kaldir}</button>}
            </span>
          </div>
          {d.durum === 'YUKLENIYOR' && <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-[#0f2253] transition-[width]" style={{ width: `${d.yuzde}%` }} /></div>}
          {asama === 'FORM' && (d.bilgi?.uyarilar ?? []).map((u) => <p key={u} className="text-xs text-amber-800">{m.uyari[u as keyof typeof m.uyari] ?? u}</p>)}
        </div>
      ))}
    </div>
  );

  // Sipariş açıldı; dosyalar yükleniyor ya da bir kısmı yüklenemedi.
  if (sonuc && asama !== 'FORM' && asama !== 'GONDERILIYOR') {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-lg font-bold">{doldur(m.siparisAlindi, { no: sonuc.no })}</p>
        <p className="mt-1 text-sm text-slate-600">{asama === 'YUKLENIYOR' ? m.dosyaYukleniyor : m.dosyaEksik}</p>
        {dosyaListesi}
        {asama === 'EKSIK' && <a href={takipYolu(kisaAd, sonuc.jeton)} className="mt-4 inline-block rounded-xl bg-[#0f2253] px-5 py-3 text-sm font-bold text-white">{m.takibeGit}</a>}
      </div>
    );
  }

  return (
    <form onSubmit={gonder} className="space-y-5 pb-28">
      <p className="text-sm text-slate-600">{m.siparisAlt}</p>

      <div className="space-y-3">
        {kalemler.map((k, i) => {
          const u = urun(k.urunId);
          const f = fiyatlar[i];
          return (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className={etiket}>{m.urun}</label>
                  <select value={k.urunId} onChange={(e) => degistir(i, { urunId: e.target.value, secimler: {} })} className={alan}>
                    {urunler.map((x) => <option key={x.id} value={x.id}>{x.tanim.ad}</option>)}
                  </select>
                </div>
                {kalemler.length > 1 && <button type="button" onClick={() => setKalemler((l) => l.filter((_, j) => j !== i))} className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-600">{m.kalemSil}</button>}
              </div>
              {u && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className={etiket}>{u.tanim.fiyatModeli === 'SAYFA' ? m.nusha : m.adet}</label>
                    <input type="number" min={1} inputMode="numeric" value={k.adet} onChange={(e) => degistir(i, { adet: e.target.value })} className={alan} />
                  </div>
                  {u.tanim.fiyatModeli === 'SAYFA' && (
                    <div>
                      <label className={etiket}>{m.sayfa}</label>
                      <input type="number" min={1} inputMode="numeric" value={k.sayfa} onChange={(e) => { degistir(i, { sayfa: e.target.value }); setSayfaDosyadan(false); }} className={alan} />
                    </div>
                  )}
                  {u.tanim.fiyatModeli === 'ALAN' && (<>
                    <div><label className={etiket}>{m.en}</label><input type="number" min={1} inputMode="decimal" value={k.en} onChange={(e) => degistir(i, { en: e.target.value })} className={alan} /></div>
                    <div><label className={etiket}>{m.boy}</label><input type="number" min={1} inputMode="decimal" value={k.boy} onChange={(e) => degistir(i, { boy: e.target.value })} className={alan} /></div>
                  </>)}
                  {u.tanim.secenekler.map((g) => (
                    <div key={g.kod}>
                      <label className={etiket}>{g.ad}</label>
                      <select value={k.secimler[g.kod] ?? g.degerler.find((d) => d.varsayilan)?.kod ?? ''} onChange={(e) => degistir(i, { secimler: { ...k.secimler, [g.kod]: e.target.value } })} className={alan}>
                        {!g.zorunlu && !g.degerler.some((d) => d.varsayilan) && <option value="">—</option>}
                        {g.degerler.map((d) => <option key={d.kod} value={d.kod}>{d.ad}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              {f?.ok && <p className="mt-3 text-right text-base font-bold tabular-nums">{b.para(f.toplam / 100)}</p>}
            </div>
          );
        })}
        <button type="button" onClick={() => setKalemler((l) => [...l, bos()])} className="text-sm font-semibold text-[#0f2253]">{m.kalemEkle}</button>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <span className={etiket}>{m.dosyaBaslik}</span>
        {dosyaAcik ? (<>
          <button type="button" onClick={() => giris.current?.click()} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold">{m.dosyaEkle}</button>
          <input ref={giris} type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" className="hidden"
            onChange={(e) => { const l = [...(e.target.files ?? [])]; e.target.value = ''; if (l.length) void dosyaEkle(l); }} />
          <p className="mt-2 text-xs text-slate-500">{doldur(m.dosyaTurleri, { mb: Math.round(DOSYA_AZAMI / 1024 / 1024) })}</p>
          {sayfaDosyadan && <p className="mt-1 text-xs text-emerald-700">{m.sayfaDosyadan}</p>}
          {dosyaListesi}
          <p className="mt-2 text-xs text-slate-500">{doldur(m.dosyaSakla, { gun: saklamaGun })}</p>
        </>) : <p className="text-sm text-slate-600">{m.dosyaKapali}</p>}
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label htmlFor="ad" className={etiket}>{m.adSoyad}</label><input id="ad" value={ad} onChange={(e) => setAd(e.target.value)} className={alan} maxLength={120} autoComplete="name" required /></div>
          <div><label htmlFor="tel" className={etiket}>{m.telefon}</label><input id="tel" type="tel" inputMode="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} className={alan} placeholder={m.telefonYer} autoComplete="tel" required /></div>
        </div>
        {/* Bal küpü: insan görmez, bot doldurur. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Web<input tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} /></label>
        </div>
        <div><label htmlFor="not" className={etiket}>{m.not}</label><textarea id="not" value={not} onChange={(e) => setNot(e.target.value)} className={alan} rows={2} maxLength={2000} /></div>
        {havale && (
          <div>
            <span className={etiket}>{m.odeme}</span>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setOdeme('TESLIMDE')} className={secili(odeme === 'TESLIMDE')}>{m.odemeTeslimdeSec}</button>
              <button type="button" onClick={() => setOdeme('HAVALE')} className={secili(odeme === 'HAVALE')}>{m.odemeHavaleSec}</button>
            </div>
            {odeme === 'HAVALE' && <p className="mt-1 text-xs text-slate-500">{m.odemeHavaleNot}</p>}
          </div>
        )}
      </div>

      {hata && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hata}</div>}

      {/* Tek sayı ve tek düğme: telefonda ekranın altında yapışık. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white px-5 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500">{hepsiTamam ? `${m.toplam} · ${m.kdvDahil}` : m.fiyatBekleniyor}</div>
            {hepsiTamam && <div className="text-xl font-bold tabular-nums">{b.para(toplam / 100)}</div>}
            {hepsiTamam && <div className="truncate text-[11px] text-slate-500">{tahmini ? m.tahmini : doldur(m.hazirSure, { saat: sure })}</div>}
          </div>
          <button type="submit" disabled={asama !== 'FORM' || !hepsiTamam} className="shrink-0 rounded-xl bg-[#0f2253] px-5 py-3 text-base font-bold text-white disabled:opacity-50">
            {asama === 'GONDERILIYOR' ? m.gonderiliyor : m.gonder}
          </button>
        </div>
      </div>
    </form>
  );
}
