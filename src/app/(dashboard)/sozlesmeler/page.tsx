'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * SÖZLEŞMELER
 *
 * Ekran PARAYLA açılıyor, dosya listesiyle değil. Sözleşmeyi saklamak bir
 * dosya dolabıdır; bayi onu bir kez yükler ve bir daha açmaz. Bu ekranın
 * açılma sebebi şu dört sorunun cevabı olmalı:
 *
 *   1. Sözleşmede yazan fiyatla sistemdeki fiyat ayrışmış mı? Kaç ₺?
 *   2. Zam zamanı gelen sözleşme var mı?
 *   3. Fesih ihbar penceresi kaçan var mı? (bitiş tarihinden AYRI bir şey)
 *   4. Sözleşmeye girmemiş kiralık makine var mı?
 *
 * Fark bulmak yetmiyor: her farkın yanında "Sisteme uygula" var. O düğme
 * olmadan bayi farkı okuyup cihaz kartına gidiyor, yedi alanı elle
 * kopyalıyor, birini yanlış yazıyor.
 */

const tl = (n: number | null | undefined) =>
  n === null || n === undefined ? '—'
    : `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const gg = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString('tr-TR') : '—');

const DURUM_ADI: Record<string, string> = { AKTIF: 'Aktif', BITTI: 'Bitti', FESIH: 'Feshedildi' };

// Sayfa adedi ile lira aynı biçimde yazılırsa bayi "3537" ve "2500"e
// bakıp hangisinin ne olduğunu ayırt edemiyor. Kalem türüne göre biçim.
const SAYFA_ALANLARI = new Set(['includedBlack', 'includedColor']);
const KURUS_ALANLARI = new Set(['pricePerBlack', 'pricePerColor', 'overagePriceBlack', 'overagePriceColor']);
function deger(alan: string, v: number) {
  if (SAYFA_ALANLARI.has(alan)) return `${v.toLocaleString('tr-TR')} sayfa`;
  // Sayfa fiyatı kuruşun altında oynuyor: 2 basamağa yuvarlarsak
  // 0,4250 ile 0,4200 aynı görünür ve fark anlamsızlaşır.
  if (KURUS_ALANLARI.has(alan)) return `₺${v.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;
  return tl(v);
}

export default function SozlesmelerPage() {
  const [veri, setVeri] = useState<any>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [acik, setAcik] = useState<string | null>(null);
  const [suzgec, setSuzgec] = useState<'hepsi' | 'farkli' | 'zam' | 'ihbar'>('hepsi');
  const [formAcik, setFormAcik] = useState(false);

  const yukle = useCallback(async () => {
    setYukleniyor(true);
    try {
      const r = await fetch('/api/sozlesmeler');
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Yüklenemedi');
      setVeri(d); setHata(null);
    } catch (e: any) { setHata(e.message); }
    setYukleniyor(false);
  }, []);
  useEffect(() => { yukle(); }, [yukle]);

  const patch = async (id: string, govde: any) => {
    const r = await fetch(`/api/sozlesmeler/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(govde),
    });
    if (!r.ok) { alert((await r.json()).error || 'İşlem başarısız'); return false; }
    await yukle();
    return true;
  };

  if (yukleniyor && !veri) return <div style={{ padding: '2rem', color: '#6b7280' }}>Yükleniyor…</div>;
  if (hata) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{hata}</div>;
  if (!veri) return null;

  const o = veri.ozet;
  const liste = veri.sozlesmeler.filter((k: any) => {
    if (suzgec === 'farkli') return k.farkSayisi > 0;
    if (suzgec === 'zam') return k.zam.zamani;
    if (suzgec === 'ihbar') return k.takvim.ihbarKacti || (!k.takvim.bitmis && k.takvim.bitimeGun <= 60) || k.takvim.bitmis;
    return true;
  });

  return (
    <div style={{ padding: '2rem', maxWidth: 1150 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold' }}>Sözleşmeler</h1>
          <p style={{ color: '#6b7280', margin: '0.25rem 0 0' }}>
            Sözleşmede yazan ile sistemde olan aynı mı — fark varsa kaç lira.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          {/* KÂRLILIK — yenileme görüşmesine bu rakamla oturulur. Ayrı menü
              satırı açmıyoruz; bayi zaten sözleşmeye bakarken burada. */}
          <a href="/sozlesmeler/karlilik"
            style={{ background: 'white', color: '#0f2253', border: '1px solid #0f2253', padding: '0.625rem 1.1rem', borderRadius: '0.5rem', fontWeight: 600, textDecoration: 'none' }}>
            Kârlılık ve fiyat kararı →
          </a>
          <button onClick={() => setFormAcik(true)}
            style={{ background: '#3b82f6', color: 'white', border: 'none', padding: '0.625rem 1.25rem', borderRadius: '0.5rem', fontWeight: 500, cursor: 'pointer' }}>
            + Yeni Sözleşme
          </button>
        </div>
      </div>

      {/* ── PARA ÖNCE ────────────────────────────────────────────────────
          Bayi bu ekranı "dosyalarım nerede" diye açmıyor; "ne kaybediyorum"
          diye açıyor. Kartların hepsi tıklanınca ilgili listeyi süzüyor. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <Kart
          baslik="Sözleşmeye uymayan fiyat"
          buyuk={o.aylikEksik > 0 ? `${tl(o.aylikEksik)}/ay` : o.farkliSozlesme ? 'fark var' : 'yok'}
          alt={
            o.farkliSozlesme === 0 ? 'Bütün sözleşmeler sistemle uyumlu'
              : `${o.farkliSozlesme} sözleşmede fark${o.aylikFazla > 0 ? ` · ${tl(o.aylikFazla)}/ay FAZLA faturalama` : ''}`
          }
          renk={o.aylikEksik > 0 ? '#b45309' : o.farkliSozlesme ? '#b45309' : '#15803d'}
          secili={suzgec === 'farkli'}
          tikla={() => setSuzgec(suzgec === 'farkli' ? 'hepsi' : 'farkli')}
        />
        <Kart
          baslik="Zam zamanı gelen"
          buyuk={o.zamZamani ? `${o.zamZamani} sözleşme` : 'yok'}
          alt={o.zamKaybi > 0 ? `${tl(o.zamKaybi)}/ay kaybediyorsun` : o.zamZamani ? 'Oran sözleşmede yazmıyor' : 'Zamanı gelen yok'}
          renk={o.zamZamani ? '#b45309' : '#15803d'}
          secili={suzgec === 'zam'}
          tikla={() => setSuzgec(suzgec === 'zam' ? 'hepsi' : 'zam')}
        />
        <Kart
          baslik="Bitiş / ihbar"
          buyuk={o.ihbarKacan ? `${o.ihbarKacan} pencere kaçtı` : o.bitiyor ? `${o.bitiyor} yaklaşıyor` : 'sorun yok'}
          alt={o.bitmis ? `${o.bitmis} sözleşme süresi geçmiş` : 'Bitişe 60 günden az kalanlar'}
          renk={o.ihbarKacan || o.bitmis ? '#b91c1c' : o.bitiyor ? '#b45309' : '#15803d'}
          secili={suzgec === 'ihbar'}
          tikla={() => setSuzgec(suzgec === 'ihbar' ? 'hepsi' : 'ihbar')}
        />
        <Kart
          baslik="Sözleşmesiz makine"
          buyuk={o.kapsamDisi ? `${o.kapsamDisi} cihaz` : 'yok'}
          alt={o.kapsamDisi ? 'Sözleşmeli müşteride sözleşmeye girmemiş kiralık' : 'Hepsi bir sözleşmede'}
          renk={o.kapsamDisi ? '#b45309' : '#15803d'}
        />
      </div>

      {veri.kapsamDisi.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#92400e', margin: '0 0 0.5rem' }}>
            Sözleşmeye girmemiş kiralık cihazlar
          </h2>
          <p style={{ fontSize: '0.78rem', color: '#92400e', margin: '0 0 0.6rem' }}>
            Bu müşterilerin sözleşmesi var ama bu makineler sözleşmede geçmiyor — ya unutulmuş ya anlaşmasız.
          </p>
          <div style={{ display: 'grid', gap: '0.3rem', fontSize: '0.82rem' }}>
            {veri.kapsamDisi.map((d: any) => (
              <div key={d.deviceId} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', color: '#78350f' }}>
                <span style={{ fontWeight: 600, minWidth: '9rem' }}>{d.musteri}</span>
                <span>{d.cihaz}</span>
                <span style={{ fontFamily: 'monospace', color: '#a16207' }}>{d.serialNo}</span>
                <span>{d.aylikKira ? `${tl(d.aylikKira)}/ay` : 'kira girilmemiş'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
          {liste.length} / {veri.toplam} sözleşme
        </span>
        {suzgec !== 'hepsi' && (
          <button onClick={() => setSuzgec('hepsi')}
            style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem', borderRadius: '999px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
            süzgeci kaldır
          </button>
        )}
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden' }}>
        {liste.length === 0 && (
          <div style={{ padding: '2.5rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
            {veri.toplam === 0
              ? 'Henüz sözleşme yok. "Yeni Sözleşme" ile başla — şartlar cihazın mevcut ayarından dolar, sen yalnız kâğıttan farklı olanı düzeltirsin.'
              : 'Bu süzgeçte sözleşme yok.'}
          </div>
        )}
        {liste.map((k: any) => (
          <SozlesmeSatiri
            key={k.id} k={k}
            acik={acik === k.id}
            ac={() => setAcik(acik === k.id ? null : k.id)}
            patch={patch}
            yenile={yukle}
          />
        ))}
      </div>

      {formAcik && <YeniSozlesme kapat={() => setFormAcik(false)} bitti={() => { setFormAcik(false); yukle(); }} />}
    </div>
  );
}

function Kart({ baslik, buyuk, alt, renk, secili, tikla }: any) {
  const icerik = (
    <>
      <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{baslik}</div>
      <div style={{ fontSize: '1.3rem', fontWeight: 700, color: renk, margin: '0.15rem 0' }}>{buyuk}</div>
      <div style={{ fontSize: '0.72rem', color: '#9ca3af', lineHeight: 1.3 }}>{alt}</div>
    </>
  );
  const stil: any = {
    background: 'white', border: `1px solid ${secili ? '#0f2253' : '#e5e7eb'}`,
    borderRadius: '0.75rem', padding: '0.9rem', textAlign: 'left', width: '100%',
    boxShadow: secili ? '0 0 0 2px rgba(15,34,83,0.12)' : 'none',
  };
  if (!tikla) return <div style={stil}>{icerik}</div>;
  return <button onClick={tikla} style={{ ...stil, cursor: 'pointer', font: 'inherit' }}>{icerik}</button>;
}

function Rozet({ metin, renk, arka }: { metin: string; renk: string; arka: string }) {
  return (
    <span style={{ fontSize: '0.68rem', fontWeight: 700, color: renk, background: arka, borderRadius: '999px', padding: '0.12rem 0.5rem', whiteSpace: 'nowrap' }}>
      {metin}
    </span>
  );
}

function SozlesmeSatiri({ k, acik, ac, patch, yenile }: any) {
  const [mesgul, setMesgul] = useState(false);

  const uygula = async (c: any) => {
    const satirlar = c.farklar.map((f: any) => `· ${f.ad}: ${deger(f.alan, f.sistemde)} → ${deger(f.alan, f.sozlesmede)}`).join('\n');
    if (!confirm(
      `${c.cihaz} (${c.serialNo}) cihazının ayarları sözleşmedeki hâline getirilecek:\n\n${satirlar}\n\n`
      + 'Bu değişiklik BUNDAN SONRAKİ faturaları etkiler; kesilmiş faturalar değişmez. Devam edilsin mi?',
    )) return;
    setMesgul(true);
    await patch(k.id, { sistemeUygula: c.contractDeviceId });
    setMesgul(false);
  };

  const zamYapildi = async () => {
    if (!confirm('Zam yapıldı olarak işaretlensin mi? Sonraki hatırlatma bugünden itibaren sayılacak.\n\n(Fiyatları değiştirmez — onu Toplu Zam ekranından yaparsın.)')) return;
    setMesgul(true);
    await patch(k.id, { lastEscalationAt: new Date().toISOString().slice(0, 10) });
    setMesgul(false);
  };

  return (
    <div style={{ borderBottom: '1px solid #f3f4f6' }}>
      <button onClick={ac} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '0.7rem', flexWrap: 'wrap',
        padding: '0.85rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        <span style={{ fontWeight: 600, color: '#111827', minWidth: '9rem', flex: 1 }}>{k.musteri?.name}</span>
        {k.contractNo && <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280' }}>{k.contractNo}</span>}
        <span style={{ fontSize: '0.76rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
          {gg(k.startDate)} – {gg(k.endDate)}
        </span>
        <span style={{ fontSize: '0.76rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{k.cihazSayisi} cihaz</span>

        {k.status !== 'AKTIF' && <Rozet metin={DURUM_ADI[k.status] || k.status} renk="#374151" arka="#f3f4f6" />}
        {k.etki.eksik > 0 && <Rozet metin={`${tl(k.etki.eksik)}/ay eksik`} renk="#92400e" arka="#fef3c7" />}
        {k.etki.fazla > 0 && <Rozet metin={`${tl(k.etki.fazla)}/ay fazla`} renk="#9a3412" arka="#ffedd5" />}
        {k.zam.zamani && <Rozet metin="zam zamanı" renk="#92400e" arka="#fef3c7" />}
        {k.takvim.ihbarKacti && <Rozet metin="ihbar kaçtı" renk="#991b1b" arka="#fee2e2" />}
        {k.takvim.bitmis && <Rozet metin="süresi geçmiş" renk="#991b1b" arka="#fee2e2" />}
        {!k.takvim.bitmis && !k.takvim.ihbarKacti && k.takvim.bitimeGun <= 60 && (
          <Rozet metin={`${k.takvim.bitimeGun} gün kaldı`} renk="#92400e" arka="#fef3c7" />
        )}
        {k.farkSayisi === 0 && k.status === 'AKTIF' && <Rozet metin="uyumlu" renk="#166534" arka="#dcfce7" />}
        <span style={{ color: '#9ca3af' }}>{acik ? '▲' : '▼'}</span>
      </button>

      {acik && (
        <div style={{ padding: '0 1rem 1.1rem', fontSize: '0.83rem' }}>
          {/* ── TAKVİM ──────────────────────────────────────────────────
              İhbar günü bitiş tarihinden AYRI gösteriliyor: "daha 2 ay var"
              diye rahat olan bayi ihbar penceresini kaçırıyor. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(13rem, 1fr))', gap: '0.7rem', marginBottom: '0.9rem' }}>
            <Kutu baslik="Bitiş"
              icerik={k.takvim.bitmis ? `${gg(k.endDate)} — ${-k.takvim.bitimeGun} gün geçti` : `${gg(k.endDate)} — ${k.takvim.bitimeGun} gün kaldı`}
              renk={k.takvim.bitmis ? '#b91c1c' : k.takvim.bitimeGun <= 60 ? '#b45309' : '#374151'} />
            <Kutu baslik="Fesih ihbarı için son gün"
              icerik={k.takvim.ihbarSonGun
                ? `${gg(k.takvim.ihbarSonGun)} — ${k.takvim.ihbarKacti ? `${-k.takvim.ihbaraGun} gün GEÇTİ` : `${k.takvim.ihbaraGun} gün kaldı`}`
                : 'Sözleşmede ihbar süresi yok'}
              renk={k.takvim.ihbarKacti ? '#b91c1c' : '#374151'} />
            <Kutu baslik="Zam"
              icerik={!k.zam.maddeVar ? 'Sözleşmede zam maddesi yok'
                : k.zam.zamani
                  ? `Zamanı geldi${k.zam.gecikenAy ? ` (${k.zam.gecikenAy} ay gecikti)` : ''}${k.zam.aylikKayip ? ` — ${tl(k.zam.aylikKayip)}/ay` : ''}`
                  : `Sonraki: ${gg(k.zam.sonrakiTarih)} (${k.zam.kalanGun} gün)`}
              renk={k.zam.zamani ? '#b45309' : '#374151'} />
          </div>

          {k.zam.zamani && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
              <a href={`/toplu-zam?musteri=${k.musteri?.id}`}
                style={{ padding: '0.4rem 0.85rem', background: '#0f2253', color: 'white', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, textDecoration: 'none' }}>
                Zammı uygula →
              </a>
              <button onClick={zamYapildi} disabled={mesgul}
                style={{ padding: '0.4rem 0.85rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                Zam yapıldı, işaretle
              </button>
            </div>
          )}

          {/* ── CİHAZ BAZINDA FARK ──────────────────────────────────────── */}
          {k.cihazlar.map((c: any) => (
            <div key={c.contractDeviceId} style={{ border: '1px solid #e5e7eb', borderRadius: '0.6rem', padding: '0.7rem', marginBottom: '0.6rem' }}>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: c.farklar.length ? '0.6rem' : 0 }}>
                <b>{c.cihaz}</b>
                <span style={{ fontFamily: 'monospace', fontSize: '0.76rem', color: '#6b7280' }}>{c.serialNo}</span>
                {c.konum && <span style={{ fontSize: '0.76rem', color: '#9ca3af' }}>{c.konum}</span>}
                <span style={{ fontSize: '0.74rem', color: '#9ca3af' }}>
                  {c.aylikSayfaSB !== null ? `ayda ~${c.aylikSayfaSB.toLocaleString('tr-TR')} S/B` : 'sayfa geçmişi yetersiz'}
                  {c.aylikSayfaRenkli ? ` · ~${c.aylikSayfaRenkli.toLocaleString('tr-TR')} renkli` : ''}
                </span>
                {c.farklar.length === 0
                  ? <Rozet metin="uyumlu" renk="#166534" arka="#dcfce7" />
                  : <Rozet metin={`${c.farklar.length} fark`} renk="#92400e" arka="#fef3c7" />}
              </div>

              {c.farklar.length > 0 && (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse', minWidth: '30rem' }}>
                      <thead style={{ background: '#f9fafb' }}>
                        <tr>{['Kalem', 'Sözleşmede', 'Sistemde', 'Aylık etki', ''].map((h) => (
                          <th key={h} style={{ padding: '0.35rem 0.5rem', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {c.farklar.map((f: any) => (
                          <tr key={f.alan} style={{ borderTop: '1px solid #f3f4f6' }}>
                            <td style={{ padding: '0.35rem 0.5rem' }}>{f.ad}</td>
                            <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600 }}>{deger(f.alan, f.sozlesmede)}</td>
                            <td style={{ padding: '0.35rem 0.5rem' }}>{deger(f.alan, f.sistemde)}</td>
                            <td style={{ padding: '0.35rem 0.5rem', fontWeight: 600, color: f.yon === 'EKSIK_FATURALAMA' ? '#b45309' : '#9a3412' }}>
                              {f.aylikEtki === null ? '—' : tl(f.aylikEtki)}
                            </td>
                            <td style={{ padding: '0.35rem 0.5rem', color: f.yon === 'EKSIK_FATURALAMA' ? '#b45309' : '#9a3412', fontSize: '0.72rem' }}>
                              {f.yon === 'EKSIK_FATURALAMA' ? 'eksik faturalama' : 'FAZLA faturalama'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.6rem', alignItems: 'center' }}>
                    <button onClick={() => uygula(c)} disabled={mesgul}
                      style={{ padding: '0.4rem 0.85rem', background: '#0f2253', color: 'white', border: 'none', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
                      {mesgul ? 'Uygulanıyor…' : 'Sisteme uygula'}
                    </button>
                    <a href={`/devices/${c.deviceId}`} style={{ fontSize: '0.78rem', color: '#2563eb' }}>Cihaz kartı →</a>
                    <span style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                      Sözleşme yanlış girildiyse cihaz değil SÖZLEŞME düzeltilmeli.
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.6rem' }}>
            {k.fileUrl && <a href={k.fileUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8rem', color: '#2563eb' }}>Taranmış nüsha →</a>}
            {k.notes && <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{k.notes}</span>}
            <button
              onClick={async () => {
                if (!confirm('Sözleşme silinsin mi? Cihazlar ve fiyatları silinmez, yalnız sözleşme kaydı gider.')) return;
                const r = await fetch(`/api/sozlesmeler/${k.id}`, { method: 'DELETE' });
                if (r.ok) yenile(); else alert('Silinemedi');
              }}
              style={{ marginLeft: 'auto', fontSize: '0.76rem', color: '#b91c1c', background: 'none', border: 'none', cursor: 'pointer' }}>
              Sözleşmeyi sil
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Kutu({ baslik, icerik, renk }: any) {
  return (
    <div style={{ background: '#f9fafb', borderRadius: '0.5rem', padding: '0.6rem 0.7rem' }}>
      <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{baslik}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: renk, marginTop: '0.15rem' }}>{icerik}</div>
    </div>
  );
}

function YeniSozlesme({ kapat, bitti }: { kapat: () => void; bitti: () => void }) {
  const [musteriler, setMusteriler] = useState<any[]>([]);
  const [cihazlar, setCihazlar] = useState<any[]>([]);
  const [seciliCihaz, setSeciliCihaz] = useState<string[]>([]);
  const [f, setF] = useState<any>({
    customerId: '', contractNo: '', startDate: '', endDate: '',
    noticeDays: 30, autoRenew: true, escalationMonths: 12, escalationRate: '',
    fileUrl: '', notes: '',
  });
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/customers').then((r) => r.json())
      .then((d) => setMusteriler(Array.isArray(d) ? d : d.customers || []))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!f.customerId) { setCihazlar([]); setSeciliCihaz([]); return; }
    fetch(`/api/devices?customerId=${f.customerId}`).then((r) => r.json())
      .then((d) => {
        const liste = (Array.isArray(d) ? d : d.devices || []).filter((x: any) => x.isRental);
        setCihazlar(liste);
        // Kiralık cihazların hepsi varsayılan seçili: sözleşme zaten onları
        // kapsıyor; bayi istisnayı çıkarsın, hepsini tek tek seçmesin.
        setSeciliCihaz(liste.map((x: any) => x.id));
      })
      .catch(() => setCihazlar([]));
  }, [f.customerId]);

  const kaydet = async () => {
    setMesgul(true); setHata(null);
    const r = await fetch('/api/sozlesmeler', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, deviceIds: seciliCihaz }),
    });
    const d = await r.json();
    setMesgul(false);
    if (!r.ok) { setHata(d.error || 'Kaydedilemedi'); return; }
    bitti();
  };

  const inp: any = { width: '100%', padding: '0.5rem 0.65rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.88rem' };
  const lbl: any = { display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.25rem' };

  return (
    <div onClick={kapat} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50,
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      overflowY: 'auto', padding: '1.5rem 1rem',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        margin: 'auto', background: 'white', borderRadius: '1rem', padding: '1.5rem',
        width: '100%', maxWidth: 560, boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ fontWeight: 700, fontSize: '1.15rem', marginBottom: '1rem' }}>Yeni Sözleşme</h2>

        <div style={{ marginBottom: '0.8rem' }}>
          <label style={lbl}>Müşteri *</label>
          <select style={inp} value={f.customerId} onChange={(e) => setF({ ...f, customerId: e.target.value })}>
            <option value="">Seçin…</option>
            {musteriler.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.6rem', marginBottom: '0.8rem' }}>
          <div><label style={lbl}>Sözleşme no</label><input style={inp} value={f.contractNo} onChange={(e) => setF({ ...f, contractNo: e.target.value })} /></div>
          <div><label style={lbl}>Başlangıç *</label><input type="date" style={inp} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div><label style={lbl}>Bitiş *</label><input type="date" style={inp} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.6rem', marginBottom: '0.35rem' }}>
          <div>
            <label style={lbl}>Fesih ihbar süresi (gün)</label>
            <input type="number" style={inp} value={f.noticeDays} onChange={(e) => setF({ ...f, noticeDays: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Zam aralığı (ay)</label>
            <input type="number" style={inp} value={f.escalationMonths} onChange={(e) => setF({ ...f, escalationMonths: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Zam oranı (%)</label>
            <input type="number" style={inp} placeholder="pazarlıkla" value={f.escalationRate} onChange={(e) => setF({ ...f, escalationRate: e.target.value })} />
          </div>
        </div>
        <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0 0 0.8rem' }}>
          İhbar süresi: sözleşme bitmeden bu kadar gün önce haber verilmezse kendiliğinden uzar.
          Zam oranı boş bırakılırsa yalnız &quot;zamanı geldi&quot; denir, tutar hesaplanmaz.
        </p>

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.8rem', fontSize: '0.85rem' }}>
          <input type="checkbox" checked={f.autoRenew} onChange={(e) => setF({ ...f, autoRenew: e.target.checked })} />
          Sözleşme kendiliğinden uzuyor
        </label>

        {cihazlar.length > 0 && (
          <div style={{ marginBottom: '0.8rem' }}>
            <label style={lbl}>Kapsanan cihazlar</label>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.5rem', maxHeight: '11rem', overflowY: 'auto' }}>
              {cihazlar.map((d) => (
                <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0.6rem', fontSize: '0.82rem', borderBottom: '1px solid #f3f4f6' }}>
                  <input type="checkbox" checked={seciliCihaz.includes(d.id)}
                    onChange={(e) => setSeciliCihaz(e.target.checked ? [...seciliCihaz, d.id] : seciliCihaz.filter((x) => x !== d.id))} />
                  <span>{[d.brand, d.model].filter(Boolean).join(' ')}</span>
                  <span style={{ fontFamily: 'monospace', color: '#6b7280', fontSize: '0.75rem' }}>{d.serialNo}</span>
                </label>
              ))}
            </div>
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.3rem 0 0' }}>
              Şartlar cihazın <b>mevcut ayarından</b> dolar. Kaydettikten sonra kâğıttan farklı olanları düzeltirsin.
            </p>
          </div>
        )}

        <div style={{ marginBottom: '0.8rem' }}>
          <label style={lbl}>Taranmış nüshanın bağlantısı</label>
          <input style={inp} placeholder="Drive/Dropbox bağlantısı" value={f.fileUrl} onChange={(e) => setF({ ...f, fileUrl: e.target.value })} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={lbl}>Not</label>
          <input style={inp} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </div>

        {hata && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.5rem', padding: '0.6rem', fontSize: '0.82rem', marginBottom: '0.8rem' }}>{hata}</div>}

        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button onClick={kaydet} disabled={mesgul || !f.customerId || !f.startDate || !f.endDate}
            style={{ flex: 1, padding: '0.7rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', opacity: mesgul ? 0.7 : 1 }}>
            {mesgul ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
          <button onClick={kapat} style={{ padding: '0.7rem 1.4rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '0.5rem', cursor: 'pointer', color: '#374151' }}>İptal</button>
        </div>
      </div>
    </div>
  );
}
