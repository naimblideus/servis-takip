'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';

interface Grup {
  anahtar: string;
  marka: string;
  model: string;
  cihaz: number;
  verimli: number;
  sayacli: number;
  mevcutSb: number | null;
  mevcutRenkli: number | null;
  olculenSb: number | null;
  olculenRenkli: number | null;
  gozlemSb: number;
  gozlemRenkli: number;
}

/**
 * TONER VERİMİ — ürünün en güçlü özelliğini açan tek ekran.
 *
 * ── NEDEN BU EKRAN VAR ────────────────────────────────────────────────
 * Toner tükenme tahmini verim olmadan HİÇ çalışmıyor: `forecastChannel`
 * verim yoksa null dönüyor, yani takip kapalı. Ölçüldü: 854 cihazın
 * 853'ünde verim boş. Sayaç değeri 724 cihazda var, toner değişimi
 * kaydediliyor, altyapının tamamı hazır — eksik olan tek alan bu.
 *
 * Cihaz cihaz doldurmak 854 kayıt demek ve o iş yapılmaz. Verim modelin
 * özelliği: aynı yazıcıya takılan toner hep aynı sayfayı basar. Ekran o
 * yüzden model bazında ve ÇOK CİHAZLI MODEL ÜSTTE — bayi istediği yerde
 * durabiliyor, durduğu yere kadar en çok cihazı açmış oluyor.
 *
 * ── ÖNERİ ÜRETİLMİYOR ─────────────────────────────────────────────────
 * Elimizde model→verim sözlüğü yok. "HP P1102 → 1.600" gibi bir sayı
 * uydurmak, yanlış tahmin üretir; yanlış tahmin bu üründe en pahalı hata,
 * çünkü bayi müşteriye "toneriniz bitmek üzere" der ve değildir. Kutunun
 * üstünde yazan sayı giriliyor, sistem tahmin yürütmüyor.
 */
interface KarneSatiri {
  anahtar: string; marka: string; model: string; cihaz: number;
  kutuSb: number | null; kutuRenkli: number | null;
  olculenSb: number | null; olculenRenkli: number | null;
  gozlemSb: number; gozlemRenkli: number;
  maliyetSb: number | null; maliyetRenkli: number | null;
  sapmaSb: number | null; sapmaRenkli: number | null;
  maliyetEtkisiSb: number | null; maliyetEtkisiRenkli: number | null;
  olculdu: boolean; uyarilar: string[]; ozet: string;
  ozetKod?: { tur: string; verim: number | null; sapma: number | null };
}

interface Karne {
  model: number; olculenModel: number; cihaz: number; kapsananCihaz: number;
  kutudanAz: number; enPahali: { marka: string; model: string; maliyet: number } | null;
}

/** Uyarı kodları ekranda cümleye dönüşür — kod göstermek bayiye bir şey anlatmaz. */
const uyariMetni = (t: Sozluk, kod: string): string | null =>
  kod === 'GOZLEM_AZ' ? t.tonerVerimi.uyariGozlemAz
  : kod === 'FIYAT_YOK' ? t.tonerVerimi.uyariFiyatYok
  : null;

/**
 * Sunucudan gelen özet kodunu kullanıcının dilinde cümleye çevirir.
 * Sunucu neyi ölçtüğünü söylüyor, cümleyi ekran kuruyor.
 */
function ozetMetni(t: Sozluk, s: KarneSatiri, b: { sayi(n: number): string }): string {
  const k = s.ozetKod;
  if (!k) return s.ozet;
  const n = k.verim === null ? '' : b.sayi(k.verim);
  const sapma = k.sapma === null ? '' : k.sapma.toFixed(0);
  switch (k.tur) {
    case 'OLCUM_YOK': return t.tonerVerimi.ozetOlcumYok;
    case 'KUTUDAN_AZ': return doldur(t.tonerVerimi.ozetAz, { n, sapma });
    case 'KUTUDAN_FAZLA': return doldur(t.tonerVerimi.ozetFazla, { n, sapma });
    case 'UYUMLU': return doldur(t.tonerVerimi.ozetUyumlu, { n });
    default: return doldur(t.tonerVerimi.ozetDuz, { n });
  }
}

export default function TonerVerimiSayfasi() {
  const t = useT();
  const b = useBicim();
  const [gruplar, setGruplar] = useState<Grup[]>([]);
  const [satirlar, setSatirlar] = useState<KarneSatiri[]>([]);
  const [karne, setKarne] = useState<Karne | null>(null);
  const [gorunum, setGorunum] = useState<'KARNE' | 'EKSIK'>('KARNE');
  const [ozet, setOzet] = useState<{ model: number; cihaz: number; verimli: number; kapsanan?: number; eksik: number; olculenModel?: number } | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [ara, setAra] = useState('');
  const [sadeceEksik, setSadeceEksik] = useState(true);
  const [girdi, setGirdi] = useState<Record<string, { sb: string; renkli: string }>>({});
  const [calisan, setCalisan] = useState<string | null>(null);
  const [mesaj, setMesaj] = useState<Record<string, string>>({});
  const [hata, setHata] = useState('');

  async function yukle() {
    setYukleniyor(true);
    try {
      const r = await fetch('/api/devices/toner-verimi');
      const j = await r.json();
      if (r.ok) {
        setGruplar(j.gruplar);
        setSatirlar(j.satirlar ?? []);
        setKarne(j.karne ?? null);
        setOzet(j.ozet);
        // Ölçülmüş model yoksa karne boş kalır; bayiyi boş bir ekrana
        // düşürmek yerine doğrudan yapılacak işe (eksik girişi) götür.
        if ((j.karne?.olculenModel ?? 0) === 0) setGorunum('EKSIK');
      } else setHata(j.error ?? t.tonerVerimi.listeAlinamadi);
    } catch {
      setHata(t.genel.baglantiHatasi);
    } finally {
      setYukleniyor(false);
    }
  }

  useEffect(() => {
    yukle();
  }, []);

  const karneListe = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase(b.dil);
    return satirlar.filter((s) =>
      s.olculdu && (!q || (s.marka + ' ' + s.model).toLocaleLowerCase(b.dil).includes(q)));
  }, [satirlar, ara, b.dil]);

  const gosterilen = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase(b.dil);
    return gruplar.filter((g) => {
      // Ölçülmüş model EKSİK DEĞİL: elle bir şey yazılmasına gerek yok.
      if (sadeceEksik && (g.olculenSb || g.olculenRenkli || g.verimli >= g.cihaz)) return false;
      if (!q) return true;
      return (g.marka + ' ' + g.model).toLocaleLowerCase(b.dil).includes(q);
    });
  }, [gruplar, ara, sadeceEksik, b.dil]);

  /**
   * KÜMÜLATİF KAPSAM: "bu satıra kadar doldurursan kaç cihaz açılır".
   * Bayinin nerede durabileceğini görmesi, listenin uzunluğundan daha
   * önemli — 401 satır gördüğünde vazgeçiyor, "ilk 20 satır 250 cihaz"
   * gördüğünde başlıyor.
   */
  const kumulatif = useMemo(() => {
    let t = 0;
    return gosterilen.map((g) => (t += (g.olculenSb || g.olculenRenkli) ? 0 : g.cihaz - g.verimli));
  }, [gosterilen]);

  async function uygula(g: Grup) {
    const v = girdi[g.anahtar] ?? { sb: '', renkli: '' };
    if (!v.sb && !v.renkli) return;
    setCalisan(g.anahtar);
    setHata('');
    try {
      const r = await fetch('/api/devices/toner-verimi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anahtar: g.anahtar, sb: v.sb, renkli: v.renkli }),
      });
      const j = await r.json();
      if (r.ok) {
        setMesaj((m) => ({ ...m, [g.anahtar]: doldur(t.tonerVerimi.yazildi, { n: j.guncellenen }) }));
        await yukle();
      } else setHata(j.error ?? t.tonerVerimi.yazilamadi);
    } catch {
      setHata(t.genel.baglantiHatasi);
    } finally {
      setCalisan(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t.tonerVerimi.baslik}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            {t.tonerVerimi.altOn} <b>{t.tonerVerimi.altVurgu}</b>{t.tonerVerimi.altSon}
          </p>
        </div>
        <Link href="/sarf" className="rounded border px-3 py-2 text-sm hover:bg-gray-50">
          {t.tonerVerimi.sarfTakibi}
        </Link>
      </div>

      {ozet && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            { ad: t.tonerVerimi.kartBilinen, n: ozet.kapsanan ?? ozet.verimli },
            { ad: t.tonerVerimi.kartBilinmeyen, n: ozet.eksik, vurgu: ozet.eksik > 0 },
            { ad: t.tonerVerimi.kartModel, n: ozet.model },
          ].map((k) => (
            <div key={k.ad} className="rounded-lg border bg-white p-4">
              <div className={`text-2xl font-bold tabular-nums ${k.vurgu ? 'text-amber-700' : ''}`}>{k.n}</div>
              <div className="text-sm text-gray-600">{k.ad}</div>
            </div>
          ))}
        </div>
      )}

      {hata && <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{hata}</p>}

      {/* ── İKİ GÖRÜNÜM ────────────────────────────────────────────────
          Ekran eskiden yalnız bir VERİ GİRİŞ formuydu. Ölçüm motoru
          geldikten sonra o iş bitiyor (demo bayide eksik sıfır) ve geriye
          boş bir form kalıyordu. Asıl soru artık "verim gir" değil,
          "ölçülen verim bana ne söylüyor". */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {([
          ['KARNE', `${t.tonerVerimi.sekmeOlculen}${karne ? ` (${karne.olculenModel})` : ''}`],
          ['EKSIK', `${t.tonerVerimi.sekmeEksik}${ozet ? ` (${ozet.model - (karne?.olculenModel ?? 0)})` : ''}`],
        ] as const).map(([k, ad]) => (
          <button key={k} type="button" onClick={() => setGorunum(k)}
            className={`rounded border px-3 py-1.5 text-sm ${gorunum === k ? 'border-gray-900 bg-gray-900 text-white' : 'hover:bg-gray-50'}`}>
            {ad}
          </button>
        ))}
        <input
          value={ara}
          onChange={(e) => setAra(e.target.value)}
          placeholder={t.tonerVerimi.araYer}
          className="ml-auto w-56 rounded border px-3 py-1.5 text-sm"
        />
      </div>

      {/* ── KARNE ──────────────────────────────────────────────────── */}
      {gorunum === 'KARNE' && !yukleniyor && (
        <section className="mt-4">
          {karne && karne.kutudanAz > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <b>{doldur(t.tonerVerimi.kutudanAzVurgu, { n: karne.kutudanAz })}</b> {t.tonerVerimi.kutudanAzOrta}{' '}
              <b>{t.tonerVerimi.kutudanAzVurgu2}</b> {t.tonerVerimi.kutudanAzSon}
            </p>
          )}
          {karne && karne.kutudanAz === 0 && karneListe.length > 0 && karneListe.every(s => s.sapmaSb === null && s.sapmaRenkli === null) && (
            <p className="rounded-lg border bg-white p-3 text-sm text-gray-600">
              {t.tonerVerimi.kutuYokOn} <b>{t.tonerVerimi.kutuYokVurgu}</b> {t.tonerVerimi.kutuYokSon}
            </p>
          )}
          {karne?.enPahali && (
            <p className="mt-2 text-sm text-gray-600">
              {t.tonerVerimi.enPahaliOn} <b>{karne.enPahali.marka} {karne.enPahali.model}</b>{' '}
              {doldur(t.tonerVerimi.enPahaliSon, { m: b.altBirim(karne.enPahali.maliyet) })}
            </p>
          )}

          {karneListe.length === 0 ? (
            <p className="mt-4 rounded-lg border bg-white p-10 text-center text-sm text-gray-500">
              {t.tonerVerimi.karneBos}
            </p>
          ) : (
            <ul className="mt-4 divide-y rounded-lg border bg-white">
              {karneListe.map((s) => (
                <li key={s.anahtar} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {s.marka} <span className="font-mono">{s.model}</span>
                      <span className="ml-2 text-xs font-normal text-gray-500 tabular-nums">{doldur(t.tonerVerimi.cihazAdet, { n: s.cihaz })}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-gray-600">{ozetMetni(t, s, b)}</div>
                    {s.uyarilar.some((u) => uyariMetni(t, u)) && (
                      <div className="mt-0.5 text-xs text-gray-400">
                        {s.uyarilar.map((u) => uyariMetni(t, u)).filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-right">
                    {(s.maliyetSb !== null || s.maliyetRenkli !== null) && (
                      <div>
                        <div className="text-sm font-semibold tabular-nums">
                          {b.altBirim((s.maliyetSb ?? s.maliyetRenkli)!)}
                        </div>
                        <div className="text-[11px] text-gray-500">{t.tonerVerimi.sayfaBasiToner}</div>
                      </div>
                    )}
                    {(s.maliyetEtkisiSb ?? s.maliyetEtkisiRenkli) !== null && (
                      <div>
                        <div className={`text-sm font-semibold tabular-nums ${(s.maliyetEtkisiSb ?? s.maliyetEtkisiRenkli)! > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {(s.maliyetEtkisiSb ?? s.maliyetEtkisiRenkli)! > 0 ? '+' : ''}
                          {b.yuzde((s.maliyetEtkisiSb ?? s.maliyetEtkisiRenkli)!)}
                        </div>
                        <div className="text-[11px] text-gray-500">{t.tonerVerimi.kutuyaGore}</div>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {gorunum === 'EKSIK' && (
      <>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={sadeceEksik} onChange={(e) => setSadeceEksik(e.target.checked)} />
          {t.tonerVerimi.yalnizEksik}
        </label>
      </div>

      {yukleniyor ? (
        <p className="mt-6 text-sm text-gray-500">{t.genel.yukleniyor}</p>
      ) : gosterilen.length === 0 ? (
        <p className="mt-6 rounded-lg border bg-white p-10 text-center text-sm text-gray-500">
          {sadeceEksik ? t.tonerVerimi.eksikKalmadi : t.tonerVerimi.modelYok}
        </p>
      ) : (
        <ul className="mt-4 divide-y rounded-lg border bg-white">
          {gosterilen.map((g, i) => {
            const v = girdi[g.anahtar] ?? { sb: '', renkli: '' };
            const eksik = g.cihaz - g.verimli;
            return (
              <li key={g.anahtar} className="flex flex-wrap items-center gap-x-4 gap-y-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {g.marka} <span className="font-mono">{g.model}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
                    <span className="tabular-nums">{doldur(t.tonerVerimi.cihazAdet, { n: g.cihaz })}</span>
                    {eksik > 0 && <span className="tabular-nums text-amber-700">{doldur(t.tonerVerimi.eksikAdet, { n: eksik })}</span>}
                    {/* Sayaç değeri olmayan cihazda verim girilse de tahmin
                        anlam kazanmıyor — bayi bunu önceden bilsin. */}
                    <span className="tabular-nums">{doldur(t.tonerVerimi.sayacliAdet, { n: g.sayacli })}</span>
                    <span className="tabular-nums text-gray-400">
                      {doldur(t.tonerVerimi.burayaKadar, { n: kumulatif[i] })}
                    </span>
                  </div>
                  {/* SAHADA ÖLÇÜLEN — bu bir öneri değil gözlem. Tahmin
                      motoru zaten bunu kullanıyor; düğme sadece değeri
                      cihaz kartına da yazıyor (sabitliyor). */}
                  {(g.olculenSb || g.olculenRenkli) && (
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-emerald-700">
                      <span className="font-medium">{t.tonerVerimi.sahadaOlculdu}</span>
                      {g.olculenSb && (
                        <span className="tabular-nums">
                          {doldur(t.tonerVerimi.olculenSb, { n: b.sayi(g.olculenSb), g: g.gozlemSb })}
                        </span>
                      )}
                      {g.olculenRenkli && (
                        <span className="tabular-nums">
                          {doldur(t.tonerVerimi.olculenRenkli, { n: b.sayi(g.olculenRenkli), g: g.gozlemRenkli })}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setGirdi((st) => ({
                          ...st,
                          [g.anahtar]: {
                            sb: g.olculenSb ? String(g.olculenSb) : (st[g.anahtar]?.sb ?? ''),
                            renkli: g.olculenRenkli ? String(g.olculenRenkli) : (st[g.anahtar]?.renkli ?? ''),
                          },
                        }))}
                        className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-medium hover:bg-emerald-100"
                      >
                        {t.tonerVerimi.formaYaz}
                      </button>
                    </div>
                  )}
                  {mesaj[g.anahtar] && (
                    <div className="mt-1 text-xs font-medium text-green-700">{mesaj[g.anahtar]}</div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    inputMode="numeric"
                    value={v.sb}
                    onChange={(e) => setGirdi((s) => ({ ...s, [g.anahtar]: { ...v, sb: e.target.value } }))}
                    placeholder={g.mevcutSb ? String(g.mevcutSb) : t.tonerVerimi.sbYer}
                    aria-label={doldur(t.tonerVerimi.sbEtiket, { marka: g.marka, model: g.model })}
                    className="w-28 rounded border px-2 py-1.5 text-sm tabular-nums"
                  />
                  <input
                    inputMode="numeric"
                    value={v.renkli}
                    onChange={(e) => setGirdi((s) => ({ ...s, [g.anahtar]: { ...v, renkli: e.target.value } }))}
                    placeholder={g.mevcutRenkli ? String(g.mevcutRenkli) : t.tonerVerimi.renkliYer}
                    aria-label={doldur(t.tonerVerimi.renkliEtiket, { marka: g.marka, model: g.model })}
                    className="w-24 rounded border px-2 py-1.5 text-sm tabular-nums"
                  />
                  <button
                    type="button"
                    disabled={calisan === g.anahtar || (!v.sb && !v.renkli)}
                    onClick={() => uygula(g)}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    {calisan === g.anahtar ? '…' : t.tonerVerimi.uygula}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-gray-500">
        {t.tonerVerimi.dipnotKutu}
      </p>
      <p className="mt-2 text-xs text-gray-500">
        <b>{t.tonerVerimi.dipnotOlcumVurgu}</b> {t.tonerVerimi.dipnotOlcumOrta}{' '}
        <i>{t.tonerVerimi.dipnotOlcumVurgu2}</i>{t.tonerVerimi.dipnotOlcumSon}
      </p>
      </>
      )}
    </div>
  );
}
