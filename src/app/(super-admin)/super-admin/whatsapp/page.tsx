'use client';

import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock, Send, Copy, Check, ChevronDown } from 'lucide-react';
import { useT, useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { SABLONLAR } from '@/lib/whatsapp-sablon';
import { MAGAZA_SABLONLARI } from '@/lib/whatsapp-sablon-magaza';
import { SablonOlustur } from './SablonOlustur';
import { META_HATALARI, waHataMetni } from '@/lib/whatsapp-graph';
import type { SaglikMaddesi, SaglikDurumu } from '@/lib/whatsapp-saglik';

/**
 * WHATSAPP KURULUM DURUMU — platform numarasının Meta kurulumunu adım adım gösterir.
 *
 * Liste sunucuda (api/super-admin/whatsapp) üretilir; burada yalnız sözlükten
 * kullanıcının dilinde yazılır. Hiçbir gizli değer bu sayfaya gelmez.
 */

// Meta'ya girilecek webhook adresi — canlı alan adı sabit (Coolify'daki uygulama).
const WEBHOOK_URL = 'https://nextusservis.com/api/whatsapp/webhook';

type Cevap = {
  genel: SaglikDurumu;
  liste: SaglikMaddesi[];
  gercekler: {
    phoneIdMaske: string | null;
    wabaIdMaske: string | null;
    graphSurum: string;
    numara: { gorunen: string | null; ad: string | null; limit: string | null } | null;
  };
  zaman: string;
};

const RENK: Record<SaglikDurumu, { kutu: string; yazi: string; rozet: string; Ikon: typeof CheckCircle2 }> = {
  tamam: { kutu: 'border-emerald-500/25 bg-emerald-50', yazi: 'text-emerald-700', rozet: 'bg-emerald-50 text-emerald-700', Ikon: CheckCircle2 },
  uyari: { kutu: 'border-amber-200 bg-amber-50', yazi: 'text-amber-700', rozet: 'bg-amber-50 text-amber-700', Ikon: AlertTriangle },
  hata: { kutu: 'border-red-500/35 bg-red-50', yazi: 'text-red-700', rozet: 'bg-red-50 text-red-700', Ikon: XCircle },
  bekliyor: { kutu: 'border-gray-200 bg-white', yazi: 'text-gray-500', rozet: 'bg-gray-100 text-gray-500', Ikon: Clock },
};

type TestTuru = 'hello_world' | 'borc' | 'sayac' | 'metin';

export default function WhatsappKurulumPage() {
  const sz = useT();
  const { dil } = useDil();
  const z = sz.superAdmin.whatsapp;
  const yaz = (anahtar: string, p?: Record<string, string | number>) =>
    doldur((z.m as Record<string, string>)[anahtar] ?? anahtar, p ?? {});

  const [veri, setVeri] = useState<Cevap | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    setHata(false);
    try {
      const r = await fetch('/api/super-admin/whatsapp', { cache: 'no-store' });
      if (!r.ok) throw new Error(String(r.status));
      setVeri(await r.json());
    } catch {
      setHata(true);
    } finally {
      setYukleniyor(false);
    }
  }, []);
  useEffect(() => { yukle(); }, [yukle]);

  // ── Test gönderimi ───────────────────────────────────────────────────
  const [telefon, setTelefon] = useState('');
  const [tur, setTur] = useState<TestTuru>('hello_world');
  const [metin, setMetin] = useState('');
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [sonuc, setSonuc] = useState<{ ok: boolean; metin: string; id?: string | null } | null>(null);

  const gonder = async (e: React.FormEvent) => {
    e.preventDefault();
    setGonderiliyor(true);
    setSonuc(null);
    try {
      const r = await fetch('/api/super-admin/whatsapp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefon, tur, metin }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429) setSonuc({ ok: false, metin: doldur(z.test.hataCok, { n: j?.retryAfter ?? 60 }) });
      else if (j?.ok) setSonuc({ ok: true, metin: z.test.basarili, id: j.id });
      else if (j?.error === 'telefon') setSonuc({ ok: false, metin: z.test.hataTelefon });
      else if (j?.error === 'env') setSonuc({ ok: false, metin: z.test.hataEnv });
      else if (j?.error === 'metin') setSonuc({ ok: false, metin: z.test.hataMetin });
      else {
        // Bilinen Meta kodu kullanıcının dilinde; bilinmeyende Meta'nın kendi cümlesi.
        const kod = typeof j?.kod === 'number' ? j.kod : null;
        setSonuc({ ok: false, metin: kod != null && META_HATALARI[kod] ? waHataMetni(kod, j?.error, dil === 'en' ? 'en' : 'tr') : (j?.error || z.test.basarisiz) });
      }
    } catch {
      setSonuc({ ok: false, metin: z.test.hataAg });
    } finally {
      setGonderiliyor(false);
    }
  };

  // ── Kopyala ──────────────────────────────────────────────────────────
  const [kopyalanan, setKopyalanan] = useState<string | null>(null);
  const kopyala = async (anahtar: string, deger: string) => {
    try {
      await navigator.clipboard.writeText(deger);
    } catch {
      // Eski tarayıcı / izin yok: geçici alanla dene.
      const ta = document.createElement('textarea');
      ta.value = deger;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch { /* yoksay */ }
      ta.remove();
    }
    setKopyalanan(anahtar);
    setTimeout(() => setKopyalanan((k) => (k === anahtar ? null : k)), 1800);
  };
  const KopyaDugmesi = ({ anahtar, deger }: { anahtar: string; deger: string }) => (
    <button type="button" onClick={() => kopyala(anahtar, deger)}
      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-xs text-gray-700">
      {kopyalanan === anahtar ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
      {kopyalanan === anahtar ? z.kurulum.kopyalandi : z.kurulum.kopyala}
    </button>
  );
  const KopyaSatiri = ({ etiket, deger, anahtar, cok = false }: { etiket: string; deger: string; anahtar: string; cok?: boolean }) => (
    <div>
      <div className="text-xs text-gray-500 mb-1">{etiket}</div>
      <div className="flex items-start gap-2">
        <div className={`flex-1 min-w-0 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm font-mono text-gray-800 ${cok ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>{deger}</div>
        <KopyaDugmesi anahtar={anahtar} deger={deger} />
      </div>
    </div>
  );

  const adimlar = [z.kurulum.adim1, z.kurulum.adim2, z.kurulum.adim3, z.kurulum.adim4, z.kurulum.adim5, z.kurulum.adim6,
    z.kurulum.adim7, z.kurulum.adim8, z.kurulum.adim9, z.kurulum.adim10, z.kurulum.adim11, z.kurulum.adim12];

  const genelRenk = veri ? RENK[veri.genel] : null;
  const saat = veri ? new Date(veri.zaman).toLocaleTimeString(dil === 'en' ? 'en-GB' : 'tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-blue-700 shrink-0" />
              {z.baslik}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">{z.alt}</p>
          </div>
          <button onClick={yukle} disabled={yukleniyor}
            className="shrink-0 flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-sm disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${yukleniyor ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{z.yenile}</span>
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        {hata && <div role="alert" className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{z.yuklenemedi}</div>}
        {!veri && yukleniyor && <div className="flex justify-center py-16"><RefreshCw className="w-7 h-7 animate-spin text-blue-700" /></div>}

        {veri && genelRenk && (
          <>
            {/* Genel durum */}
            <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${genelRenk.kutu}`}>
              <genelRenk.Ikon className={`w-5 h-5 shrink-0 ${genelRenk.yazi}`} />
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${genelRenk.yazi}`}>{z.genel[veri.genel]}</div>
                <div className="text-xs text-gray-500">{doldur(z.sonKontrol, { saat })}</div>
              </div>
            </div>

            {/* Kontrol listesi */}
            <ol className="space-y-2">
              {veri.liste.map((x) => {
                const r = RENK[x.durum];
                return (
                  <li key={x.anahtar} className={`rounded-xl border px-4 py-3 ${r.kutu}`}>
                    <div className="flex items-start gap-3">
                      <r.Ikon className={`w-4 h-4 mt-0.5 shrink-0 ${r.yazi}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                          <div className="text-sm text-gray-800 break-words min-w-0">{yaz(x.baslik, x.baslikParam)}</div>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full shrink-0 ${r.rozet}`}>{z.durum[x.durum]}</span>
                        </div>
                        {x.cozum && (
                          <div className="mt-1.5 text-xs text-gray-700 break-words">
                            <span className="font-semibold text-blue-700">{z.siradaki}: </span>{yaz(x.cozum, x.cozumParam)}
                          </div>
                        )}
                        {x.ayrinti && (
                          <div className="mt-1.5 text-[11px] text-gray-500 font-mono bg-gray-50 rounded-lg px-2 py-1.5 whitespace-pre-wrap break-words">
                            <span className="text-gray-500">{z.ayrinti}: </span>{x.ayrinti}
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            {/* Teknik bilgiler (gizli değer yok; kimlikler maskeli) */}
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-blue-700 mb-3">{z.gercekler}</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                <div className="flex justify-between gap-3"><dt className="text-gray-500">{z.numaraKimligi}</dt><dd className="font-mono text-gray-800">{veri.gercekler.phoneIdMaske ?? z.yok}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">{z.wabaKimligi}</dt><dd className="font-mono text-gray-800">{veri.gercekler.wabaIdMaske ?? z.yok}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-gray-500">{z.graphSurum}</dt><dd className="font-mono text-gray-800">{veri.gercekler.graphSurum}</dd></div>
                {veri.gercekler.numara?.limit && (
                  <div className="flex justify-between gap-3"><dt className="text-gray-500">{z.limit}</dt><dd className="font-mono text-gray-800">{veri.gercekler.numara.limit}</dd></div>
                )}
              </dl>
            </div>
          </>
        )}

        {/* Test mesajı */}
        <form onSubmit={gonder} className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-blue-700">{z.test.baslik}</h3>
            <p className="text-xs text-gray-500 mt-1">{z.test.alt}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="wa-tel" className="text-xs text-gray-500 mb-1 block">{z.test.telefon}</label>
              <input id="wa-tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} inputMode="tel" autoComplete="off" placeholder={z.test.telefonYer} required
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="wa-tur" className="text-xs text-gray-500 mb-1 block">{z.test.tur}</label>
              <select id="wa-tur" value={tur} onChange={(e) => setTur(e.target.value as TestTuru)}
                className="w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500">
                <option value="hello_world">{z.test.turHello}</option>
                <option value="borc">{z.test.turBorc}</option>
                <option value="sayac">{z.test.turSayac}</option>
                <option value="metin">{z.test.turMetin}</option>
              </select>
            </div>
          </div>
          {tur === 'metin' && (
            <div>
              <label htmlFor="wa-metin" className="text-xs text-gray-500 mb-1 block">{z.test.metin}</label>
              <textarea id="wa-metin" value={metin} onChange={(e) => setMetin(e.target.value)} rows={3} maxLength={1000} placeholder={z.test.metinYer}
                className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-500 resize-none" />
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <button type="submit" disabled={gonderiliyor || !telefon.trim()}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 text-sm disabled:opacity-50">
              {gonderiliyor ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {gonderiliyor ? z.test.gonderiliyor : z.test.gonder}
            </button>
          </div>
          {sonuc && (
            <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${sonuc.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
              {!sonuc.ok && <div className="font-semibold mb-0.5">{z.test.basarisiz}</div>}
              <div className="break-words">{sonuc.metin}</div>
              {sonuc.ok && sonuc.id && <div className="text-[11px] text-emerald-300/70 font-mono mt-1 break-all">{doldur(z.test.mesajKimligi, { id: sonuc.id })}</div>}
            </div>
          )}
        </form>

        {/* Şablonları elle kopyalamak yerine tek düğme (Meta'da olanlara dokunmaz). */}
        <SablonOlustur onBitti={yukle} />

        {/* Kurulum adımları */}
        <details className="group bg-white border border-gray-200 rounded-2xl">
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-4 sm:px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-blue-700">{z.kurulum.baslik}</h3>
              <p className="text-xs text-gray-500 mt-0.5">{z.kurulum.alt}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180 shrink-0" />
          </summary>
          <div className="px-4 sm:px-5 pb-5 space-y-5">
            <ol className="space-y-2 list-decimal pl-5 text-sm text-gray-700 marker:text-blue-700">
              {adimlar.map((a, i) => <li key={i} className="break-words">{a}</li>)}
            </ol>

            <div className="space-y-3">
              <KopyaSatiri etiket={z.kurulum.webhookUrl} deger={WEBHOOK_URL} anahtar="url" />
              <KopyaSatiri etiket={z.kurulum.webhookAlan} deger="messages" anahtar="alan" />
            </div>

            {/* Elle kurulum için 7 şablonun hepsi: hatırlatmalar + mağaza bildirimleri. */}
            {(Object.entries({ ...SABLONLAR, ...MAGAZA_SABLONLARI }) as [string, (typeof SABLONLAR)['borc']][]).map(([k, s]) => {
              return (
                <div key={k} className="rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4 space-y-3">
                  <KopyaSatiri etiket={z.kurulum.sablonAdi} deger={s.ad} anahtar={`${k}-ad`} />
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div><div className="text-gray-500 mb-1">{z.kurulum.kategori}</div><div className="text-gray-800">{z.kurulum.kategoriDeger}</div></div>
                    <div><div className="text-gray-500 mb-1">{z.kurulum.dil}</div><div className="text-gray-800">{z.kurulum.dilDeger}</div></div>
                  </div>
                  <KopyaSatiri etiket={z.kurulum.govde} deger={s.metin} anahtar={`${k}-metin`} cok />
                  <div>
                    <div className="text-xs text-gray-500 mb-1">{z.kurulum.ornekler}</div>
                    <div className="space-y-1.5">
                      {s.ornek.map((o, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="w-20 shrink-0 text-xs text-gray-500 font-mono">{doldur(z.kurulum.ornek, { v: `{{${i + 1}}}` })}</span>
                          <div className="flex-1 min-w-0 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-sm font-mono text-gray-800 truncate">{o}</div>
                          <KopyaDugmesi anahtar={`${k}-o${i}`} deger={o} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      </div>
    </div>
  );
}
