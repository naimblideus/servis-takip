'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBicim, useDil, useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { matbaaMetni } from '@/lib/matbaa-metin';
import { fiyatHesapla, type UrunTanimi } from '@/lib/baski-fiyat';
import { SAATSIZ_TESLIM, type TaslakGorunumu } from '@/lib/baski-okuyucu';

/**
 * TEZGAH FORMU — yeni baskı işi. Fiyat ekranda anında (saf motor), kayıtta
 * sunucu aynı motorla yeniden hesaplar; ekrandaki tutar gönderilmez.
 * Telefon yazılınca kayıtlı müşteri önerilir; bağlanırsa iş cariye de
 * yazılabilir.
 *
 * TASLAK KİPİ (`taslak` verilirse): WhatsApp siparişinden okunan taslak
 * (lib/baski-okuyucu). Form okunanla dolu açılır; okuyucunun emin olmadığı
 * alanlar sarı ve "emin değilim" işaretli (alan değişince işaret kalkar).
 * Kayıt onay ucuna gider: iş ancak o zaman açılır.
 */
export interface TezgahUrunu { id: string; teslimSaat: number | null; tanim: UrunTanimi }
export interface TezgahTaslagi extends TaslakGorunumu { okumaId: string }

/** kaynak: taslaktaki kalem numarası (1'den); işaret ve ipucu ona bağlı, kalem silinse de kaymaz. */
type Kalem = { urunId: string; adet: string; sayfa: string; en: string; boy: string; secimler: Record<string, string>; kaynak?: number };
const BOS_KALEM: Kalem = { urunId: '', adet: '1', sayfa: '', en: '', boy: '', secimler: {} };
type OdemeSecimi = 'SIMDI' | 'TESLIMDE' | 'CARI';

/** datetime-local değeri (tarayıcının saatinde), yarım saate yukarı yuvarlanmış. */
function yerelSaat(saatSonra: number): string {
  const d = new Date(Date.now() + saatSonra * 3_600_000);
  d.setSeconds(0, 0);
  d.setMinutes(d.getMinutes() <= 30 ? (d.getMinutes() === 0 ? 0 : 30) : 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

const alanTaban = 'w-full rounded-lg border px-3 py-2 text-[15px] focus:border-[#0f2253] focus:outline-none';
const alan = `${alanTaban} border-gray-300 bg-white`;
const alanSari = `${alanTaban} border-amber-400 bg-amber-50`;
const etiket = 'mb-1 block text-xs font-semibold text-gray-600';
const secili = (a: boolean) => `rounded-lg px-3 py-2 text-sm font-semibold ${a ? 'bg-[#0f2253] text-white' : 'border border-gray-300 bg-white text-gray-700'}`;

export default function TezgahFormu({ urunler, fiyatsizVar, yonetici, taslak = null }: {
  urunler: TezgahUrunu[]; fiyatsizVar: boolean; yonetici: boolean; taslak?: TezgahTaslagi | null;
}) {
  const router = useRouter();
  const { dil } = useDil();
  const b = useBicim();
  const t = useT();
  const m = matbaaMetni(dil);

  const [kanal, setKanal] = useState<'TEZGAH' | 'TELEFON' | 'WHATSAPP'>(taslak ? 'WHATSAPP' : 'TEZGAH');
  const [telefon, setTelefon] = useState(taslak?.form.telefon ?? '');
  const [musteriAd, setMusteriAd] = useState(taslak?.form.musteriAd ?? '');
  const [firma, setFirma] = useState(taslak?.form.firma ?? '');
  const [oneri, setOneri] = useState<{ id: string; name: string } | null>(null);
  const [bagli, setBagli] = useState<{ id: string; name: string } | null>(null);
  const [kalemler, setKalemler] = useState<Kalem[]>(() => (taslak
    ? taslak.form.kalemler.map((k, i) => ({ ...k, kaynak: i + 1 }))
    : [{ ...BOS_KALEM, urunId: urunler[0]?.id ?? '' }]));
  const [soz, setSoz] = useState(() => {
    if (!taslak) return yerelSaat(urunler[0]?.teslimSaat ?? 1);
    if (taslak.form.teslim) return taslak.form.teslim;
    return yerelSaat(Math.max(1, ...taslak.form.kalemler.map((k) => urunler.find((u) => u.id === k.urunId)?.teslimSaat ?? 1)));
  });
  // Siparişte teslim yazıyorsa hazırlama süresi onu ezmesin.
  const [sozElle, setSozElle] = useState(!!taslak?.form.teslim);
  const [acil, setAcil] = useState(false);
  const [not, setNot] = useState(taslak?.form.not ?? '');
  // WhatsApp siparişinin parası çoğu zaman teslimde ya da havaleyle gelir.
  const [odeme, setOdeme] = useState<OdemeSecimi>(taslak ? 'TESLIMDE' : 'SIMDI');
  const [yol, setYol] = useState<'NAKIT' | 'KART' | 'HAVALE'>('NAKIT');
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState('');
  const [dokunulan, setDokunulan] = useState<ReadonlySet<string>>(() => new Set());

  // "emin değilim": okuyucu emin değildi ve çalışan alana henüz dokunmadı.
  const belirsiz = (k: string) => !!taslak?.belirsiz.includes(k) && !dokunulan.has(k);
  const dokun = (k: string) => { if (taslak && !dokunulan.has(k)) setDokunulan(new Set(dokunulan).add(k)); };
  const isaret = (k: string) => (belirsiz(k)
    ? <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800">{m.okuyucu.eminDegil}</span>
    : null);
  const alanS = (k: string) => (belirsiz(k) ? alanSari : alan);
  const kalemAnahtari = (k: Kalem, alt: string) => (k.kaynak ? `kalem${k.kaynak}.${alt}` : '');

  // Telefon 10 haneye ulaşınca kayıtlı müşteri ara (son 10 hane).
  const haneler = telefon.replace(/\D/g, '');
  useEffect(() => {
    if (haneler.length < 10) return;
    const c = new AbortController();
    const zaman = setTimeout(() => {
      fetch(`/api/matbaa/musteri?tel=${haneler}`, { signal: c.signal }).then((r) => r.json())
        .then((j) => setOneri(j.musteri ?? null)).catch(() => {});
    }, 300);
    return () => { clearTimeout(zaman); c.abort(); };
  }, [haneler]);

  const urun = (id: string) => urunler.find((u) => u.id === id);
  const fiyatlar = useMemo(() => kalemler.map((k) => {
    const u = urunler.find((x) => x.id === k.urunId);
    if (!u) return null;
    return fiyatHesapla(u.tanim, {
      adet: Number(k.adet), sayfa: Number(k.sayfa), enCm: Number(k.en), boyCm: Number(k.boy), secimler: k.secimler, sayfaDosyadan: true,
    });
  }), [kalemler, urunler]);
  const toplam = fiyatlar.reduce((s, f) => s + (f?.ok ? f.toplam : 0), 0);
  const hepsiTamam = fiyatlar.length > 0 && fiyatlar.every((f) => f?.ok);

  // Söz verilen saat: elle değiştirilmediyse en uzun hazırlama süresinden.
  // Kalem listesi değiştiği anda (olay içinde) yeniden hesaplanır.
  const kalemleriYaz = (yeni: Kalem[]) => {
    setKalemler(yeni);
    if (!sozElle) setSoz(yerelSaat(Math.max(1, ...yeni.map((k) => urun(k.urunId)?.teslimSaat ?? 1))));
  };
  const degistir = (i: number, ek: Partial<Kalem>) => kalemleriYaz(kalemler.map((k, j) => (j === i ? { ...k, ...ek } : k)));
  // Telefon kısaldıysa eski öneri gösterilmez.
  const gorunenOneri = haneler.length >= 10 ? oneri : null;
  const hataMetni = (kod: string) => (t.ucHata as Record<string, string>)[`BASKI_${kod}`] ?? m.hataGenel;

  async function kaydet(e: React.FormEvent) {
    e.preventDefault();
    if (!hepsiTamam) return;
    setMesgul(true);
    setHata('');
    const govde = {
      kanal,
      customerId: bagli?.id ?? null,
      musteriAd: musteriAd || bagli?.name || '',
      telefon,
      sozVerilenAt: soz ? new Date(soz).toISOString() : null,
      acil, not,
      odemeYolu: odeme === 'CARI' ? 'CARI' : odeme === 'SIMDI' ? yol : null,
      odeme: odeme === 'SIMDI' && toplam > 0 ? { tutar: toplam, yol } : null,
      kalemler: kalemler.map((k) => ({ urunId: k.urunId, adet: Number(k.adet), sayfa: Number(k.sayfa) || undefined, enCm: Number(k.en) || undefined, boyCm: Number(k.boy) || undefined, secimler: k.secimler })),
      // Taslakta: firma ve formdaki yerel saat (ölçü: okuyucu teslimi doğru okumuş muydu).
      ...(taslak ? { firma, teslimYerel: soz } : {}),
    };
    const adres = taslak ? `/api/matbaa/okuma/${taslak.okumaId}/onay` : '/api/matbaa/isler';
    const r = await fetch(adres, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(govde) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setHata(j.error ?? m.hataGenel); setMesgul(false); return; }
    router.push(`/matbaa/isler/${j.id}`);
  }

  /** Taslağı at: iş açılmaz. */
  async function at() {
    if (!taslak || !window.confirm(m.okuyucu.atOnay)) return;
    setMesgul(true);
    setHata('');
    const r = await fetch(`/api/matbaa/okuma/${taslak.okumaId}`, { method: 'DELETE' }).catch(() => null);
    if (!r?.ok) {
      const j = r ? await r.json().catch(() => ({})) : {};
      setHata(j.error ?? m.hataGenel);
      setMesgul(false);
      return;
    }
    router.push('/matbaa/isler/oku');
    router.refresh();
  }

  if (!urunler.length) {
    return (
      <div className="mx-auto max-w-xl p-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">{taslak ? m.okuyucu.taslakBaslik : m.yeniBaslik}</h1>
        <p className="mt-4 text-gray-600">{m.hicUrunYok}</p>
        {yonetici && <Link href="/matbaa/fiyatlar" className="mt-4 inline-block rounded-xl bg-[#0f2253] px-4 py-2.5 text-sm font-bold text-white">{m.fiyatListesineGit}</Link>}
        {taslak && <button type="button" onClick={at} disabled={mesgul} className="mt-4 ml-2 inline-block rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">{m.okuyucu.at}</button>}
        {hata && <p role="alert" className="mt-3 text-sm text-red-700">{hata}</p>}
      </div>
    );
  }

  return (
    <form onSubmit={kaydet} className="mx-auto max-w-2xl space-y-5 p-4 pb-32 md:p-8">
      {taslak ? (
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{m.okuyucu.taslakBaslik}</h1>
            <p className="mt-1 text-sm text-gray-600">{m.okuyucu.taslakAlt}</p>
          </div>
          <button type="button" onClick={at} disabled={mesgul} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 disabled:opacity-50">{m.okuyucu.at}</button>
        </div>
      ) : (<>
        <h1 className="text-2xl font-bold text-gray-900">{m.yeniBaslik}</h1>
        <div className="flex gap-2">
          {(['TEZGAH', 'TELEFON', 'WHATSAPP'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKanal(k)} className={secili(kanal === k)}>{m.kanal[k]}</button>
          ))}
        </div>
      </>)}

      {/* Müşteri */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="tel" className={etiket}>{m.telefon}{isaret('telefon')}</label>
          <input id="tel" type="tel" inputMode="tel" value={telefon} onChange={(e) => { setTelefon(e.target.value); dokun('telefon'); }} className={alanS('telefon')} placeholder={m.telefonYer} autoComplete="off" />
        </div>
        <div>
          <label htmlFor="ad" className={etiket}>{m.musteriAd}{isaret('musteriAd')}</label>
          <input id="ad" value={musteriAd} onChange={(e) => { setMusteriAd(e.target.value); dokun('musteriAd'); }} className={alanS('musteriAd')} maxLength={120} />
        </div>
        {taslak && (
          <div className="sm:col-span-2">
            <label htmlFor="firma" className={etiket}>{m.okuyucu.firma}{isaret('firma')}</label>
            <input id="firma" value={firma} onChange={(e) => { setFirma(e.target.value); dokun('firma'); }} className={alanS('firma')} maxLength={160} />
          </div>
        )}
      </div>
      {bagli ? (
        <p className="text-sm text-emerald-800">
          {m.musteriBagli}: <b>{bagli.name}</b>{' '}
          <button type="button" onClick={() => { setBagli(null); if (odeme === 'CARI') setOdeme('TESLIMDE'); }} className="ml-2 text-gray-500 underline">{m.musteriKaldir}</button>
        </p>
      ) : gorunenOneri && (
        <p className="text-sm text-gray-700">
          {doldur(m.musteriBulundu, { ad: gorunenOneri.name })}{' '}
          <button type="button" onClick={() => { setBagli(gorunenOneri); if (!musteriAd) setMusteriAd(gorunenOneri.name); }} className="ml-2 rounded-md bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">{m.musteriBagla}</button>
        </p>
      )}

      {/* Kalemler */}
      <div className="space-y-3">
        {kalemler.map((k, i) => {
          const u = urun(k.urunId);
          const f = fiyatlar[i];
          // Taslak kalemi: işaret anahtarı kalemN.alan, siparişte yazan ham bilgi ipucu olarak.
          const ka = (alt: string) => kalemAnahtari(k, alt);
          const ipucu = k.kaynak ? taslak?.ipuclari[k.kaynak - 1] : '';
          return (
            <div key={k.kaynak ? `t${k.kaynak}` : i} className="rounded-xl border border-gray-200 bg-white p-3">
              {ipucu && (
                <p className="mb-2 text-xs text-gray-600">{doldur(m.okuyucu.siparisteYazan, { metin: ipucu })}{isaret(ka('ipucu'))}</p>
              )}
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className={etiket}>{m.urun}{isaret(ka('urun'))}</label>
                  <select value={k.urunId} onChange={(e) => { degistir(i, { urunId: e.target.value, secimler: {} }); dokun(ka('urun')); }} className={alanS(ka('urun'))}>
                    {!u && <option value="">— {m.urunSec} —</option>}
                    {urunler.map((x) => <option key={x.id} value={x.id}>{x.tanim.ad}</option>)}
                  </select>
                </div>
                {kalemler.length > 1 && (
                  <button type="button" onClick={() => kalemleriYaz(kalemler.filter((_, j) => j !== i))} className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600">{m.kalemSil}</button>
                )}
              </div>
              {u && (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <div>
                    <label className={etiket}>{u.tanim.fiyatModeli === 'SAYFA' ? m.nusha : m.adet}{isaret(ka('adet'))}</label>
                    <input type="number" min={1} inputMode="numeric" value={k.adet} onChange={(e) => { degistir(i, { adet: e.target.value }); dokun(ka('adet')); }} className={alanS(ka('adet'))} />
                  </div>
                  {u.tanim.fiyatModeli === 'SAYFA' && (
                    <div>
                      <label className={etiket}>{m.sayfa}{isaret(ka('sayfa'))}</label>
                      <input type="number" min={1} inputMode="numeric" value={k.sayfa} onChange={(e) => { degistir(i, { sayfa: e.target.value }); dokun(ka('sayfa')); }} className={alanS(ka('sayfa'))} />
                    </div>
                  )}
                  {u.tanim.fiyatModeli === 'ALAN' && (<>
                    <div>
                      <label className={etiket}>{m.en}{isaret(ka('olcu'))}</label>
                      <input type="number" min={1} inputMode="decimal" value={k.en} onChange={(e) => { degistir(i, { en: e.target.value }); dokun(ka('olcu')); }} className={alanS(ka('olcu'))} />
                    </div>
                    <div>
                      <label className={etiket}>{m.boy}</label>
                      <input type="number" min={1} inputMode="decimal" value={k.boy} onChange={(e) => { degistir(i, { boy: e.target.value }); dokun(ka('olcu')); }} className={alanS(ka('olcu'))} />
                    </div>
                  </>)}
                  {u.tanim.secenekler.map((g) => (
                    <div key={g.kod}>
                      <label className={etiket}>{g.ad}{isaret(ka(`secim.${g.kod}`))}</label>
                      <select value={k.secimler[g.kod] ?? g.degerler.find((d) => d.varsayilan)?.kod ?? ''}
                        onChange={(e) => { degistir(i, { secimler: { ...k.secimler, [g.kod]: e.target.value } }); dokun(ka(`secim.${g.kod}`)); }} className={alanS(ka(`secim.${g.kod}`))}>
                        {!g.zorunlu && !g.degerler.some((d) => d.varsayilan) && <option value="">—</option>}
                        {g.degerler.map((d) => <option key={d.kod} value={d.kod}>{d.ad}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-2 text-right text-sm font-semibold">
                {/* Sayfa, ölçü ya da adet henüz yazılmadıysa hata değil, boş. */}
                {f?.ok ? b.para(f.toplam / 100) : f && f.kod !== 'SAYFA_GEREKLI' && f.kod !== 'OLCU_GEREKLI' && !(f.kod === 'ADET_GECERSIZ' && k.adet === '') ? <span className="text-red-700">{hataMetni(f.kod)}</span> : null}
              </p>
            </div>
          );
        })}
        <button type="button" onClick={() => kalemleriYaz([...kalemler, { ...BOS_KALEM, urunId: taslak ? '' : urunler[0].id }])} className="text-sm font-semibold text-[#0f2253]">{m.kalemEkle}</button>
        {fiyatsizVar && <p className="text-xs text-gray-500">{m.fiyatsizUyari}</p>}
      </div>

      {/* Zaman, not */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="soz" className={etiket}>{m.sozVerilen}{isaret('teslim')}</label>
          <input id="soz" type="datetime-local" value={soz} onChange={(e) => { setSoz(e.target.value); setSozElle(true); dokun('teslim'); }} className={alanS('teslim')} />
          {taslak?.form.teslimSaatYok && belirsiz('teslim') && (
            <p className="mt-1 text-xs text-amber-800">{doldur(m.okuyucu.saatYok, { saat: SAATSIZ_TESLIM })}</p>
          )}
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-semibold text-gray-700">
          <input type="checkbox" checked={acil} onChange={(e) => setAcil(e.target.checked)} className="h-4 w-4" /> {m.acilMi}
        </label>
      </div>
      <div>
        <label htmlFor="not" className={etiket}>{m.not}</label>
        <textarea id="not" value={not} onChange={(e) => setNot(e.target.value)} className={alan} rows={2} maxLength={2000} />
      </div>

      {/* Ödeme */}
      <div>
        <span className={etiket}>{m.odeme}</span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOdeme('SIMDI')} className={secili(odeme === 'SIMDI')}>{m.odemeSimdi}</button>
          <button type="button" onClick={() => setOdeme('TESLIMDE')} className={secili(odeme === 'TESLIMDE')}>{m.odemeTeslimde}</button>
          {bagli && <button type="button" onClick={() => setOdeme('CARI')} className={secili(odeme === 'CARI')}>{m.odemeCari}</button>}
        </div>
        {odeme === 'SIMDI' && (
          <div className="mt-2 flex gap-2">
            {(['NAKIT', 'KART', 'HAVALE'] as const).map((y) => (
              <button key={y} type="button" onClick={() => setYol(y)} className={secili(yol === y)}>{m.yol[y]}</button>
            ))}
          </div>
        )}
      </div>

      {hata && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{hata}</div>}

      {/* Toplam + kaydet: telefonda alt menünün üstünde yapışık. */}
      <div className="fixed inset-x-0 bottom-16 z-30 border-t border-gray-200 bg-white px-4 py-3 md:static md:rounded-xl md:border">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <div>
            <div className="text-xs text-gray-500">{m.toplam} · {m.kdvDahil}</div>
            <div className="text-xl font-bold text-gray-900">{b.para(toplam / 100)}</div>
          </div>
          <button type="submit" disabled={mesgul || !hepsiTamam} className="rounded-xl bg-[#0f2253] px-6 py-3 text-base font-bold text-white disabled:opacity-50">
            {mesgul ? (taslak ? m.okuyucu.onaylaniyor : m.kaydediliyor) : (taslak ? m.okuyucu.onayla : m.kaydet)}
          </button>
        </div>
      </div>
    </form>
  );
}
