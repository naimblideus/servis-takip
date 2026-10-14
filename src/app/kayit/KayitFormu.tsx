'use client';

/**
 * KAYIT — siteden 14 günlük deneme hesabı (lib/kayit.ts, api/kayit).
 *
 * Giriş sayfasıyla aynı dil: neredeyse siyah zemin, tek vurgu rengi (teal).
 * Hesap açılınca seçilen şifreyle hemen giriş yapılır; ilk girişte başlangıç
 * rehberi açılır. Kayıt kapalıysa (süper admin) form yerine WhatsApp çıkar.
 * Basılı QR'dan gelen ?k=kod etkinlik kaydıdır (lib/kayit etkinlikBul);
 * sınıra takılan kayıt talebe döner ve burada "biz açacağız" yazar.
 * Etkinlik sunucuda (page.tsx) çözülür ve `ilk` olarak gelir: salon
 * Wi-Fi'ında JS geç yüklense de ilk HTML "30 gün" der, "14 gün" görünüp
 * sonra değişmez.
 */
import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n/client';
import DilSecici from '@/components/DilSecici';
import Monogram from '@/components/Monogram';
import { ILLER_ALFABETIK } from '@/lib/iller';
import { doldur } from '@/lib/i18n/sozluk';

const BOS = { firma: '', ad: '', telefon: '', eposta: '', sifre: '', il: '', onay: false, web_sitesi: '' };
const VARSAYILAN_WHATSAPP = '905526961703';

type Durum = { acik: boolean; whatsapp: string; etkinlik?: string | null; denemeGun?: number; kullanici?: number };

export default function KayitFormu({ ilk, ilkKod = '' }: { ilk?: { etkinlik: string; denemeGun: number; kullanici: number } | null; ilkKod?: string }) {
  const t = useT();
  const k = t.kayit;
  const router = useRouter();
  const [f, setF] = useState(BOS);
  const [durum, setDurum] = useState<Durum | null>(ilk ? { acik: true, whatsapp: VARSAYILAN_WHATSAPP, ...ilk } : null);
  const [hata, setHata] = useState('');
  const [mesgul, setMesgul] = useState(false);
  const [kod, setKod] = useState(ilkKod);
  const [talepAlindi, setTalepAlindi] = useState(false);

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get('k') ?? '';
    setKod(k);
    fetch(`/api/kayit${k ? `?k=${encodeURIComponent(k)}` : ''}`).then((r) => r.json()).then(setDurum)
      .catch(() => setDurum((d) => d ?? { acik: true, whatsapp: VARSAYILAN_WHATSAPP }));
  }, []);

  const degistir = (alan: keyof typeof BOS) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [alan]: e.target instanceof HTMLInputElement && e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function gonder(e: React.FormEvent) {
    e.preventDefault();
    setMesgul(true);
    setHata('');
    const r = await fetch('/api/kayit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...f, kod }) });
    const j = await r.json().catch(() => ({}));
    if (r.status === 202 && j.talep) {
      setTalepAlindi(true);
      setMesgul(false);
      return;
    }
    if (!r.ok) {
      setHata(j.error ?? t.ucHata.KAYIT_ACILAMADI);
      setMesgul(false);
      return;
    }
    const g = await signIn('credentials', { email: j.eposta ?? f.eposta.trim().toLowerCase(), password: f.sifre, redirect: false });
    if (g?.error) {
      setHata(k.girisHata);
      setMesgul(false);
      return;
    }
    router.refresh();
    router.push('/dashboard');
  }

  const alan =
    'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15px] text-white ' +
    'placeholder:text-white/25 outline-none transition focus:border-teal-500/60 focus:bg-white/[0.06]';
  const etiket = 'mb-2 block text-[13px] font-medium text-white/60';
  // Etkinlikten gelen yazışmada etkinlik adı: satış ekibi kişiyi nereden tanıdığını bilsin.
  const waMetin = `Merhaba, Nextus Servis için deneme hesabı açmak istiyorum${durum?.etkinlik ? ` (${durum.etkinlik})` : ''}`;
  const whatsapp = `https://wa.me/${durum?.whatsapp ?? VARSAYILAN_WHATSAPP}?text=${encodeURIComponent(waMetin)}`;

  return (
    <div className="min-h-screen bg-[#050508] text-white lg:grid lg:grid-cols-[1fr_1fr]">
      <div className="relative flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12 lg:min-h-0 lg:px-16">
        <div className="absolute right-6 top-6 sm:right-12"><DilSecici /></div>

        <div className="mx-auto w-full max-w-[420px]">
          <a href="/" className="mb-8 flex items-center gap-3">
            <Monogram />
            <span className="text-[19px] font-bold tracking-tight">Nextus Servis</span>
          </a>

          {durum?.etkinlik && (
            <div className="mb-4 inline-block rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-[12px] font-semibold text-teal-200">
              {durum.etkinlik}
            </div>
          )}
          <h1 className="text-[30px] font-bold leading-tight tracking-tight">
            {durum?.denemeGun ? doldur(k.baslikGun, { gun: durum.denemeGun }) : k.baslik}
          </h1>
          {durum?.denemeGun && durum?.kullanici ? (
            <p className="mt-2 text-[15px] font-semibold text-teal-200">{doldur(k.etkinlikAvantaj, { gun: durum.denemeGun, kullanici: durum.kullanici })}</p>
          ) : null}
          <p className="mt-2 text-[15px] leading-relaxed text-white/45">{k.alt}</p>

          {talepAlindi ? (
            <div role="status" className="mt-8 rounded-xl border border-teal-400/25 bg-teal-400/[0.06] p-5">
              <p className="text-[17px] font-bold text-white">{k.talepBaslik}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-white/70">{k.talepMetin}</p>
              <a href={whatsapp} className="mt-4 inline-block rounded-xl bg-teal-500 px-5 py-3 text-[15px] font-bold text-[#04121a] transition hover:bg-teal-400">
                {k.whatsapp}
              </a>
            </div>
          ) : durum && !durum.acik ? (
            <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-[15px] text-white/80">{k.kapali}</p>
              <a href={whatsapp} className="mt-4 inline-block rounded-xl bg-teal-500 px-5 py-3 text-[15px] font-bold text-[#04121a] transition hover:bg-teal-400">
                {k.whatsapp}
              </a>
            </div>
          ) : (
            <form onSubmit={gonder} className="mt-8 space-y-4">
              <div>
                <label htmlFor="firma" className={etiket}>{k.firma}</label>
                <input id="firma" value={f.firma} onChange={degistir('firma')} className={alan} placeholder={k.firmaYer}
                  autoComplete="organization" minLength={2} maxLength={120} required />
              </div>
              <div>
                <label htmlFor="ad" className={etiket}>{k.ad}</label>
                <input id="ad" value={f.ad} onChange={degistir('ad')} className={alan} placeholder={k.adYer}
                  autoComplete="name" minLength={2} maxLength={80} required />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="telefon" className={etiket}>{k.telefon}</label>
                  <input id="telefon" type="tel" inputMode="tel" value={f.telefon} onChange={degistir('telefon')} className={alan}
                    placeholder={k.telefonYer} autoComplete="tel" required />
                </div>
                <div>
                  <label htmlFor="il" className={etiket}>{k.il}</label>
                  <select id="il" value={f.il} onChange={degistir('il')} className={alan + ' appearance-none'} required>
                    <option value="" className="bg-[#0b0f17]">{k.ilSec}</option>
                    {ILLER_ALFABETIK.map((il) => <option key={il} value={il} className="bg-[#0b0f17]">{il}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="eposta" className={etiket}>{k.eposta}</label>
                <input id="eposta" type="email" value={f.eposta} onChange={degistir('eposta')} className={alan}
                  placeholder={k.epostaYer} autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={120} required />
              </div>
              <div>
                <label htmlFor="sifre" className={etiket}>{k.sifre}</label>
                <input id="sifre" type="password" value={f.sifre} onChange={degistir('sifre')} className={alan}
                  placeholder={k.sifreYer} autoComplete="new-password" minLength={8} required />
              </div>

              {/* Bal küpü: ekranda yok, botlar doldurur. */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, overflow: 'hidden' }}>
                <label htmlFor="web_sitesi">Web sitesi</label>
                <input id="web_sitesi" tabIndex={-1} autoComplete="off" value={f.web_sitesi} onChange={degistir('web_sitesi')} />
              </div>

              <label className="flex items-start gap-3 text-[13px] leading-relaxed text-white/55">
                <input type="checkbox" checked={f.onay} onChange={degistir('onay')} required className="mt-1 h-4 w-4 accent-teal-500" />
                <span>{k.onayOn}<a href="/gizlilik" target="_blank" rel="noopener" className="text-teal-300 underline-offset-2 hover:underline">{k.onayLink}</a>{k.onaySon}</span>
              </label>

              {hata && (
                <div role="alert" className="rounded-xl border border-red-500/25 bg-red-500/[0.08] px-4 py-3 text-[13px] text-red-200">{hata}</div>
              )}

              <button type="submit" disabled={mesgul}
                className="w-full rounded-xl bg-teal-500 py-3.5 text-[15px] font-bold text-[#04121a] transition hover:bg-teal-400 disabled:opacity-50">
                {mesgul ? k.aciliyor : k.ac}
              </button>
            </form>
          )}

          <p className="mt-8 text-center text-[14px] text-white/50">
            {k.girisVar} <a href="/login" className="font-semibold text-white/80 hover:text-white">{k.girisYap}</a>
          </p>
          <p className="mt-2 text-center text-[14px] text-white/50">
            {k.demoOn} <a href="/login?demo=1" className="font-semibold text-teal-300 hover:text-teal-200">{k.demoLink}</a>
          </p>
        </div>
      </div>

      {/* Sağ panel — mobilde gizli, formun önüne geçmesin. */}
      <div className="relative hidden overflow-hidden bg-[#071a1c] lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage: 'linear-gradient(#5eead4 1px,transparent 1px),linear-gradient(90deg,#5eead4 1px,transparent 1px)',
            backgroundSize: '44px 44px',
          }} />
        <div className="relative max-w-[460px]">
          <h2 className="text-[32px] font-bold leading-[1.2] tracking-tight">{k.panelBaslik}</h2>
          <ul className="mt-8 space-y-4">
            {k.panelMaddeler.map((m) => (
              <li key={m} className="flex gap-3 text-[16px] leading-snug text-white/75">
                <span aria-hidden="true" className="mt-[3px] text-teal-300">✓</span>{m}
              </li>
            ))}
          </ul>
          <p className="mt-10 text-[14px] leading-relaxed text-white/45">{k.panelNot}</p>
        </div>
      </div>
    </div>
  );
}
