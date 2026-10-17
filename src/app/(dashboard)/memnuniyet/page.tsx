import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { oturumKullanicisi, yoneticiMi } from '@/lib/api-auth';
import { sunucuBicimi } from '@/lib/i18n/sunucu-bicim';
import { doldur } from '@/lib/i18n/sozluk';
import { memnuniyetPanosu, type PanoSatiri } from '@/lib/memnuniyet-veri';
import { EN_AZ_CEVAP, isaretliPuan, puanSinifi, type TavsiyeOzeti } from '@/lib/memnuniyet';
import AradimDugmesi from './AradimDugmesi';

export const dynamic = 'force-dynamic';

/**
 * MÜŞTERİ MEMNUNİYETİ — yönetici panosu.
 *
 * Ekranın cevapladığı tek soru: MÜŞTERİLERİM BİZİ TAVSİYE EDİYOR MU.
 * Tepede tek sayı ve düz bir cümle ("10 müşteriden 7'si tavsiye ediyor"),
 * altında yapılacak iş: 0–6 veren ve henüz aranmamış müşteriler. Sayı
 * az cevaptan çıkıyorsa yazılmaz, "henüz az cevap (n=3)" denir.
 *
 * YALNIZ YÖNETİCİ: teknisyenin müşterisinin ne dediği burada. Menüde gizli
 * (menu-aileleri YALNIZ_YONETICI); adresi elle yazan için burada kapalı.
 */
const SINIF_RENGI = {
  TAVSIYE: { zemin: '#E7F6EF', yazi: '#096847' },
  KARARSIZ: { zemin: '#F1F4F9', yazi: '#33405C' },
  MEMNUN_DEGIL: { zemin: '#FDECEC', yazi: '#962929' },
} as const;

const puanRengi = (p: number | null) => (p === null ? '#6C7A93' : p > 0 ? '#096847' : p < 0 ? '#962929' : '#33405C');

export default async function MemnuniyetSayfasi() {
  const session = await auth();
  if (!session) redirect('/login');
  const user = await oturumKullanicisi(session);
  if (!user) redirect('/login');
  if (!yoneticiMi(user)) redirect('/tickets');

  const { sz, b } = await sunucuBicimi(user);
  const m = sz.memnuniyet;
  const simdi = new Date();
  const v = await memnuniyetPanosu(user.tenantId, simdi);
  const son = v.donem.son;

  const once = (iso: string | null) => {
    if (!iso) return '';
    const gun = Math.floor((simdi.getTime() - new Date(iso).getTime()) / 86_400_000);
    return gun <= 0 ? m.bugun : gun === 1 ? m.dun : doldur(m.gunOnce, { n: gun });
  };
  const rozet = (puan: number) => {
    const r = SINIF_RENGI[puanSinifi(puan)];
    return (
      <span className="badge" style={{ background: r.zemin, color: r.yazi, fontVariantNumeric: 'tabular-nums' }}>{`${puan}/10`}</span>
    );
  };
  const puanHucresi = (o: TavsiyeOzeti) =>
    o.puan !== null ? isaretliPuan(o.puan) : doldur(m.azCevapKisa, { n: o.cevap });

  const fisBaglantisi = (s: PanoSatiri) => (
    <Link href={`/tickets/${s.ticketId}`} style={{ color: '#1D3E7E', fontWeight: 600 }}>
      {doldur(m.fisNo, { n: s.fisNo ?? '—' })}
    </Link>
  );

  return (
    <div style={{ padding: '1.25rem 1rem 2rem', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>{m.baslik}</h1>
      <p style={{ color: '#6C7A93', margin: '0.3rem 0 1.25rem', fontSize: '0.92rem', lineHeight: 1.55, maxWidth: 680 }}>{m.alt}</p>

      {v.toplam === 0 ? (
        /* ── BOŞ DURUM: ne yapılacağını söyler, "veri yok" deyip bırakmaz. ── */
        <section className="card">
          <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.35rem' }}>{m.bosBaslik}</h2>
          <p style={{ color: '#53617B', margin: '0 0 0.8rem', fontSize: '0.92rem' }}>{m.bosAlt}</p>
          <ol style={{ margin: 0, paddingLeft: '1.2rem', color: '#33405C', fontSize: '0.92rem', lineHeight: 1.8 }}>
            <li>{m.bosAdim1}</li>
            <li>{m.bosAdim2}</li>
            <li>{m.bosAdim3}</li>
          </ol>
          <Link href="/tickets" className="btn-primary" style={{ marginTop: '1rem', minHeight: 44 }}>{m.fislereGit}</Link>
        </section>
      ) : (
        <>
          {/* ── TEPEDEKİ SAYI ─────────────────────────────────────────── */}
          <section className="card" aria-labelledby="tavsiye-baslik">
            <div id="tavsiye-baslik" style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6C7A93' }}>
              {`${m.tavsiyePuani} · ${doldur(m.sonGun, { n: v.donemGun })}`}
            </div>

            {son.puan !== null ? (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                  <span style={{ fontSize: '3.25rem', fontWeight: 800, lineHeight: 1.05, color: puanRengi(son.puan), fontVariantNumeric: 'tabular-nums' }}>
                    {isaretliPuan(son.puan)}
                  </span>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0F1E33' }}>{m.cumle[son.onda ?? 0]}</span>
                </div>
                {/* Dağılım: sayının arkasındaki üç küme, sayı olarak da yazılı. */}
                <div aria-hidden style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: '#E4E9F1', marginTop: '0.9rem' }}>
                  <div style={{ width: `${(100 * son.tavsiyeEden) / son.cevap}%`, background: '#0E9F6E' }} />
                  <div style={{ width: `${(100 * son.kararsiz) / son.cevap}%`, background: '#98A3B8' }} />
                  <div style={{ width: `${(100 * son.memnunDegil) / son.cevap}%`, background: '#D64545' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.4rem 1.1rem', flexWrap: 'wrap', marginTop: '0.5rem', fontSize: '0.82rem', color: '#33405C' }}>
                  <span><b style={{ color: '#096847' }}>{b.sayi(son.tavsiyeEden)}</b>{` ${m.dagilimTavsiye}`}</span>
                  <span><b>{b.sayi(son.kararsiz)}</b>{` ${m.dagilimKararsiz}`}</span>
                  <span><b style={{ color: '#962929' }}>{b.sayi(son.memnunDegil)}</b>{` ${m.dagilimMemnunDegil}`}</span>
                </div>
              </>
            ) : son.azCevap ? (
              <div style={{ marginTop: '0.35rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#33405C' }}>{doldur(m.azCevap, { n: son.cevap })}</div>
                <p style={{ color: '#6C7A93', fontSize: '0.88rem', margin: '0.3rem 0 0' }}>{doldur(m.azCevapAlt, { e: EN_AZ_CEVAP })}</p>
              </div>
            ) : (
              <div style={{ marginTop: '0.35rem', fontSize: '1.1rem', fontWeight: 700, color: '#33405C' }}>{m.cevapYok}</div>
            )}

            <div style={{ borderTop: '1px solid #E4E9F1', marginTop: '0.9rem', paddingTop: '0.7rem', display: 'grid', gap: '0.3rem', fontSize: '0.86rem', color: '#53617B' }}>
              <span>
                {v.oran.yuzde !== null
                  ? `${doldur(m.cevapSayisi, { n: son.cevap })} · ${doldur(m.cevapOrani, { y: b.yuzde(v.oran.yuzde, 0), c: b.sayi(v.oran.cevaplanan), g: b.sayi(v.oran.gonderilen) })}`
                  : `${doldur(m.cevapSayisi, { n: son.cevap })} · ${m.cevapOraniYok}`}
              </span>
              <span>
                {v.donem.fark === null
                  ? doldur(m.farkYok, { n: v.donemGun })
                  : v.donem.fark > 0 ? `▲ ${doldur(m.farkArtti, { f: v.donem.fark, n: v.donemGun })}`
                    : v.donem.fark < 0 ? `▼ ${doldur(m.farkAzaldi, { f: Math.abs(v.donem.fark), n: v.donemGun })}`
                      : doldur(m.farkAyni, { n: v.donemGun })}
              </span>
            </div>

            <details style={{ marginTop: '0.7rem' }}>
              <summary style={{ cursor: 'pointer', color: '#1D3E7E', fontWeight: 600, fontSize: '0.86rem', minHeight: 32, display: 'flex', alignItems: 'center' }}>{m.hesapNasil}</summary>
              <p style={{ color: '#53617B', fontSize: '0.86rem', lineHeight: 1.6, margin: '0.4rem 0 0' }}>{m.hesapAciklama}</p>
            </details>
          </section>

          {/* ── ARANMASI GEREKENLER ──────────────────────────────────────
              Sayıdan önce iş: bu listenin her satırı bir sözleşme yenilemesi. */}
          <section style={{ marginTop: '1.5rem' }} aria-labelledby="aranacak-baslik">
            <h2 id="aranacak-baslik" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
              {m.aranacakBaslik}
              {v.aranacaklar.length > 0 && (
                <span className="badge" style={{ marginLeft: 8, background: '#FDECEC', color: '#962929', verticalAlign: 'middle' }}>{b.sayi(v.aranacaklar.length)}</span>
              )}
            </h2>
            <p style={{ color: '#6C7A93', fontSize: '0.86rem', margin: '0.25rem 0 0.7rem', lineHeight: 1.5 }}>{m.aranacakAlt}</p>
            {v.aranacaklar.length === 0 ? (
              <div className="card" style={{ color: '#096847', fontWeight: 600, fontSize: '0.92rem' }}>{m.aranacakYok}</div>
            ) : (
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {v.aranacaklar.map((s) => {
                  const tel = s.telefon ? s.telefon.replace(/[^\d+]/g, '') : '';
                  return (
                    <div key={s.id} className="card" style={{ padding: '0.9rem 1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ minWidth: 0, flex: '1 1 16rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <b style={{ overflowWrap: 'anywhere' }}>{s.musteri}</b>
                          {rozet(s.puan)}
                        </div>
                        <div style={{ color: '#6C7A93', fontSize: '0.8rem', marginTop: 2 }}>
                          {once(s.cevaplandiAt)}{' · '}{fisBaglantisi(s)}{s.teknisyen ? ` · ${s.teknisyen}` : ''}
                        </div>
                        {s.yorum && (
                          <p style={{ margin: '0.45rem 0 0', color: '#33405C', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{`“${s.yorum}”`}</p>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: '0 1 auto' }}>
                        {tel ? (
                          <a href={`tel:${tel}`} className="btn-secondary" style={{ minHeight: 44 }}>{`📞 ${s.telefon}`}</a>
                        ) : (
                          <span style={{ color: '#98A3B8', fontSize: '0.82rem', alignSelf: 'center' }}>{m.telefonYok}</span>
                        )}
                        <AradimDugmesi anketId={s.id} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── TEKNİSYENE GÖRE ──────────────────────────────────────── */}
          <section style={{ marginTop: '1.5rem' }} aria-labelledby="teknisyen-baslik">
            <h2 id="teknisyen-baslik" style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>{m.teknisyenBaslik}</h2>
            <p style={{ color: '#6C7A93', fontSize: '0.86rem', margin: '0.25rem 0 0.7rem' }}>{doldur(m.teknisyenAlt, { n: v.donemGun })}</p>
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', color: '#6C7A93', fontSize: '0.74rem', borderBottom: '1px solid #E4E9F1' }}>
                    <th style={{ padding: '0.6rem 0.9rem' }}>{m.sutunTeknisyen}</th>
                    <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{m.sutunCevap}</th>
                    <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{m.sutunOrtalama}</th>
                    <th style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{m.sutunPuan}</th>
                  </tr>
                </thead>
                <tbody>
                  {v.teknisyenler.map((r) => (
                    <tr key={r.teknisyenId ?? 'atanmamis'} style={{ borderBottom: '1px solid #F1F4F9' }}>
                      <td style={{ padding: '0.6rem 0.9rem', fontWeight: 600, color: r.teknisyenId ? undefined : '#6C7A93' }}>{r.ad ?? (r.teknisyenId ? '—' : m.atanmamis)}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{b.sayi(r.ozet.cevap)}</td>
                      {/* Az cevapta ortalama da yazılmaz: bir kişiyi iki cevapla ölçmek iftiradır. */}
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right' }}>{!r.ozet.azCevap && r.ozet.ortalama !== null ? b.sayi(r.ozet.ortalama, 1) : '—'}</td>
                      <td style={{ padding: '0.6rem 0.9rem', textAlign: 'right', fontWeight: 800, color: puanRengi(r.ozet.puan), whiteSpace: 'nowrap', fontSize: r.ozet.puan === null ? '0.78rem' : '0.95rem' }}>
                        {puanHucresi(r.ozet)}
                      </td>
                    </tr>
                  ))}
                  {v.teknisyenler.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: '1rem 0.9rem', color: '#6C7A93' }}>{m.cevapYok}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── SON YORUMLAR ─────────────────────────────────────────── */}
          <section style={{ marginTop: '1.5rem' }} aria-labelledby="yorum-baslik">
            <h2 id="yorum-baslik" style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 0.7rem' }}>{m.yorumlarBaslik}</h2>
            {v.yorumlar.length === 0 ? (
              <div className="card" style={{ color: '#6C7A93', fontSize: '0.92rem' }}>{m.yorumYok}</div>
            ) : (
              <div className="card" style={{ padding: 0 }}>
                {v.yorumlar.map((s, i) => (
                  <div key={s.id} style={{ padding: '0.8rem 1rem', borderTop: i ? '1px solid #F1F4F9' : undefined }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {rozet(s.puan)}
                      <b style={{ overflowWrap: 'anywhere' }}>{s.musteri}</b>
                      <span style={{ color: '#6C7A93', fontSize: '0.8rem' }}>{once(s.cevaplandiAt)}{' · '}{fisBaglantisi(s)}</span>
                    </div>
                    <p style={{ margin: '0.4rem 0 0', color: '#33405C', fontSize: '0.92rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{`“${s.yorum}”`}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
