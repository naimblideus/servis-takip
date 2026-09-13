'use client';

import { useEffect, useState } from 'react';

/**
 * e-FATURA HAZIRLIK EKRANI
 *
 * Entegratör seçilmeden de işe yarıyor ve asıl niyeti bu: bayi bugün
 * eksiklerini kapatsın, entegratör geldiğinde gönderim tek adım olsun.
 * Hangi özel entegratör seçilirse seçilsin istenen alanlar aynı.
 *
 * ÖNİZLEME numara YAKMIYOR: GİB belge sırasında boşluk olamaz, numara
 * ancak GERÇEK gönderim anında atanıyor. Gönderim buradan yapılıyor ve
 * geri alınamaz — onay metni test/canlı ayrımını açıkça yazıyor.
 */

type Fatura = {
  id: string; invoiceNumber: string; tarih: string; musteri: string;
  tutar: number; hazir: boolean; eksikSayisi: number; eksikler: string[];
  senaryo: string | null; durum: string | null; gibNo: string | null;
};
type Ozet = {
  saticiEksikleri: string[];
  toplam: number; hazir: number; eksik: number;
  enSikEksikler: { eksik: string; adet: number }[];
  faturalar: Fatura[];
};

const tl = (n: number) => `₺${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const gg = (s: string) => new Date(s).toLocaleDateString('tr-TR');

/**
 * Gönderim durumunun rozet karşılığı. Gönderilmiş belge YEŞİL değil MAVİ:
 * yeşil bu ekranda "hazır" demek ve ikisi karışırsa bayi gönderilmiş
 * faturayı tekrar göndermeye kalkar.
 */
// Tekrar gönderilebilir durumlar — lib/e-belge-gonderim.ts ile aynı liste.
const GONDERILEBILIR: (string | null)[] = [null, 'HAZIR', 'HATA'];
// Eski (kağıt/başka sistem) faturalar bu ekranın konusu değil.
const ESKI = 'ESKI_SISTEM';

const ROZET = {
  GONDERILIYOR: { etiket: 'gönderiliyor…', zemin: '#e0e7ff', yazi: '#3730a3' },
  GONDERILDI: { etiket: '✓ gönderildi', zemin: '#dbeafe', yazi: '#1e40af' },
  KABUL: { etiket: '✓ kabul edildi', zemin: '#dbeafe', yazi: '#1e40af' },
  RED: { etiket: '✗ RED', zemin: '#fef2f2', yazi: '#991b1b' },
  HATA: { etiket: '✗ hata', zemin: '#fef2f2', yazi: '#991b1b' },
};

export default function EFaturaPage() {
  const [veri, setVeri] = useState<Ozet | null>(null);
  const [yukleniyor, setYukleniyor] = useState(true);
  const [hata, setHata] = useState<string | null>(null);
  const [suzgec, setSuzgec] = useState<'hepsi' | 'bekleyen' | 'gonderildi' | 'eksik'>('hepsi');
  const [acik, setAcik] = useState<string | null>(null);
  const [belge, setBelge] = useState<any>(null);
  const [ayar, setAyar] = useState<any>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [topluSonuc, setTopluSonuc] = useState<any>(null);

  useEffect(() => {
    // Sağlayıcı ayarı ekranın en üstünde gösteriliyor: bayi "niye
    // gönderemiyorum" diye faturada değil ayarlarda arasın.
    fetch('/api/settings/e-fatura').then((r) => r.json()).then(setAyar).catch(() => {});
    fetch('/api/invoices/e-belge')
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Yüklenemedi');
        setVeri(d);
      })
      .catch((e) => setHata(e.message))
      .finally(() => setYukleniyor(false));
  }, []);

  /**
   * GÖNDER — geri alınamaz. Onay metni test/canlı ayrımını ve
   * gönderilecek belge numarasını olduğu gibi yazıyor; "emin misiniz"
   * diye sormak bayiye hiçbir şey söylemez.
   */
  const gonder = async (id: string, b: any, islem?: 'durum') => {
    if (islem !== 'durum') {
      const no = b?.numaraOnizleme || '(gönderimde atanacak)';
      const kim = b?.belge?.alici?.unvan || b?.musteri || 'müşteri';
      const mesaj = ayar?.testModu
        ? `TEST gönderimi yapılacak.\n\n${kim} · ${no}\n\nBu belge GİB\u2019e ULAŞMAZ ve müşteriye fatura GİTMEZ. Devam edilsin mi?`
        : `CANLI e-Fatura gönderilecek — GERİ ALINAMAZ.\n\n${kim} · ${no}\n\nBelge müşteriye ulaşır. Devam edilsin mi?`;
      if (!confirm(mesaj)) return;
    }
    setGonderiliyor(true);
    try {
      const r = await fetch('/api/invoices/e-belge/gonder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, islem }),
      });
      const d = await r.json();
      if (!d.ok) {
        alert(`Gönderilemedi:\n\n${d.hata || 'bilinmeyen hata'}` + (d.eksikler?.length ? `\n\n· ${d.eksikler.join('\n· ')}` : ''));
      }
      // Başarılı da olsa başarısız da olsa listeyi ve belgeyi tazele:
      // durum ve numara değişmiş olabilir.
      const y = await fetch('/api/invoices/e-belge');
      setVeri(await y.json());
      const y2 = await fetch(`/api/invoices/e-belge?id=${id}`);
      setBelge(await y2.json());
    } catch {
      alert('Sunucuya bağlanılamadı');
    }
    setGonderiliyor(false);
  };

  /**
   * TOPLU GÖNDERİM — ay sonunda 40-50 kira faturası var; tek tek
   * göndermek bu özelliği kullanılamaz yapıyordu.
   *
   * Onay metni KAÇ fatura ve test mi canlı mı olduğunu yazıyor. Bir
   * faturanın hatası diğerlerini durdurmuyor ama hiçbiri sessiz
   * değil: her sonuç tek tek gösteriliyor.
   */
  const topluGonder = async () => {
    const hazirlar = veri!.faturalar.filter((f) => f.hazir && GONDERILEBILIR.includes(f.durum));
    if (!hazirlar.length) { alert('Gönderilmeye hazır, henüz gönderilmemiş fatura yok.'); return; }
    const mesaj = ayar?.testModu
      ? `${hazirlar.length} fatura TEST olarak gönderilecek.\n\nBu belgeler GİB\u2019e ULAŞMAZ ve müşterilere fatura GİTMEZ. Devam edilsin mi?`
      : `${hazirlar.length} fatura CANLI gönderilecek — GERİ ALINAMAZ.\n\nHer biri müşterisine ulaşır. Devam edilsin mi?`;
    if (!confirm(mesaj)) return;

    setGonderiliyor(true); setTopluSonuc(null);
    try {
      const r = await fetch('/api/invoices/e-belge/toplu', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: hazirlar.map((f) => f.id) }),
      });
      const d = await r.json();
      if (!r.ok) { alert(d.error || 'Gönderilemedi'); }
      else setTopluSonuc(d);
      const y = await fetch('/api/invoices/e-belge');
      setVeri(await y.json());
    } catch { alert('Sunucuya bağlanılamadı'); }
    setGonderiliyor(false);
  };

  const belgeyiAc = async (id: string) => {
    if (acik === id) { setAcik(null); setBelge(null); return; }
    setAcik(id); setBelge(null);
    const r = await fetch(`/api/invoices/e-belge?id=${id}`);
    setBelge(await r.json());
  };

  if (yukleniyor) return <div style={{ padding: '2rem', color: '#6b7280' }}>Yükleniyor…</div>;
  if (hata) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{hata}</div>;
  if (!veri) return null;

  // Üç ayrı yığın: gönderilmiş, gönderilmeyi bekleyen, bilgisi eksik.
  // HATA almış fatura BEKLEYEN sayılıyor — tekrar gönderilebiliyor ve
  // ay sonunda unutulmaması gereken tam olarak o.
  const gonderilmis = veri.faturalar.filter((f) => f.durum && f.durum !== ESKI && !GONDERILEBILIR.includes(f.durum));
  const bekleyen = veri.faturalar.filter((f) => f.hazir && GONDERILEBILIR.includes(f.durum));
  const eksikler = veri.faturalar.filter((f) => !f.hazir);
  const liste = suzgec === 'bekleyen' ? bekleyen
    : suzgec === 'gonderildi' ? gonderilmis
    : suzgec === 'eksik' ? eksikler
    : veri.faturalar;

  return (
    <div style={{ padding: '2rem', maxWidth: 1100 }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>e-Fatura Hazırlığı</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
        Faturaların elektronik belge olarak hazır mı, ve gönderim durumu ne.
      </p>


      {/* SAĞLAYICI DURUMU — gönderim buna bağlı. Ayar yoksa hiçbir
          fatura gönderilemez ve sebebi burada yazıyor. */}
      {ayar && (
        <div style={{
          background: ayar.saglayici ? (ayar.testModu ? '#fffbeb' : '#f0fdf4') : '#f9fafb',
          border: '1px solid ' + (ayar.saglayici ? (ayar.testModu ? '#fde68a' : '#bbf7d0') : '#e5e7eb'),
          borderRadius: '0.75rem', padding: '0.85rem 1rem', marginBottom: '1.25rem',
          fontSize: '0.84rem',
        }}>
          {!ayar.saglayici ? (
            <>
              <b>e-Fatura sağlayıcısı seçilmemiş.</b> Gönderim için bir servis sağlayıcı
              (özel entegratör) sözleşmesi ve ayarları gerekiyor.{' '}
              <a href="/settings/e-fatura" style={{ color: '#2563eb' }}>Ayarlara git →</a>
            </>
          ) : ayar.testModu ? (
            <>
              <b>TEST MODU açık ({ayar.saglayici}).</b> Gönderilen belge GİB&apos;e ULAŞMAZ ve
              müşteriye fatura GİTMEZ. Gerçek gönderim için Ayarlar&apos;dan test modunu kapat.{' '}
              <a href="/settings/e-fatura" style={{ color: '#2563eb' }}>Ayarlar →</a>
            </>
          ) : (
            <>
              <b>Canlı gönderim açık ({ayar.saglayici}).</b> Gönderdiğin belge müşteriye ULAŞIR
              ve geri alınamaz.
            </>
          )}
          {ayar.parolaOkunamiyor && (
            <div style={{ marginTop: '0.35rem', color: '#991b1b' }}>
              Kayıtlı parola okunamıyor (şifreleme anahtarı değişmiş olabilir) — yeniden girin.
            </div>
          )}
        </div>
      )}

      {veri.saticiEksikleri.length > 0 && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem',
          padding: '0.85rem 1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#991b1b',
        }}>
          <b>Kendi bilgilerinde eksik var — bunlar kapanmadan hiçbir fatura hazır olamaz:</b>
          <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem' }}>
            {veri.saticiEksikleri.map((x) => <li key={x}>{x.replace(/^Satıcı: /, '')}</li>)}
          </ul>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9.5rem, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          ['Fatura', veri.toplam, '#374151'],
          ['Gönderildi', gonderilmis.length, gonderilmis.length ? '#1e40af' : '#9ca3af'],
          ['Gönderilmeyi bekleyen', bekleyen.length, bekleyen.length ? '#15803d' : '#9ca3af'],
          ['Bilgisi eksik', veri.eksik, veri.eksik ? '#b45309' : '#9ca3af'],
        ].map(([l, v, c]: any) => (
          <div key={l} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.9rem' }}>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{l}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: c }}>{v}</div>
          </div>
        ))}
      </div>

      {/* En çok tekrar eden eksik başta: bayi tek işle en çok faturayı
          hazır edeceği yeri görsün. */}
      {veri.enSikEksikler.length > 0 && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.6rem' }}>En çok tekrar eden eksikler</h2>
          <div style={{ display: 'grid', gap: '0.4rem' }}>
            {veri.enSikEksikler.slice(0, 8).map((x) => (
              <div key={x.eksik} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.85rem' }}>
                <span style={{ color: '#374151' }}>{x.eksik}</span>
                <span style={{ fontWeight: 700, color: '#b45309', whiteSpace: 'nowrap' }}>{x.adet} fatura</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.7rem', marginBottom: 0 }}>
            Alıcı eksikleri müşteri kartındaki <b>Fatura bilgileri</b> bölümünden kapatılıyor.
          </p>
        </div>
      )}

      {/* TOPLU GÖNDERİM — ay sonunun asıl işi. Kaç faturanın
          gönderileceği düğmenin üstünde yazıyor. */}
      {(() => {
        const hazirlar = veri.faturalar.filter((f) => f.hazir && GONDERILEBILIR.includes(f.durum));
        if (!hazirlar.length || !ayar?.saglayici) return null;
        return (
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <button onClick={topluGonder} disabled={gonderiliyor}
              style={{
                padding: '0.6rem 1.1rem', borderRadius: '0.5rem', border: 'none', fontWeight: 700,
                fontSize: '0.88rem', cursor: 'pointer', color: 'white',
                background: ayar.testModu ? '#b45309' : '#0f2253',
              }}>
              {gonderiliyor ? 'Gönderiliyor…' : `${hazirlar.length} hazır faturayı ${ayar.testModu ? 'TEST olarak ' : ''}gönder`}
            </button>
            <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
              Sırayla gönderilir; biri hata verirse diğerleri devam eder ve her sonuç tek tek gösterilir.
            </span>
          </div>
        );
      })()}

      {/* TOPLU XML — ay sonunda muhasebeye/entegratör portalına giden
          dosyaların hepsi tek arşivde. Tek tek indirmek 40 fatura
          demek ve bayi o yüzden eski programda kalır. */}
      {gonderilmis.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          <a href={`/api/invoices/e-belge/ubl?ids=${gonderilmis.map((f) => f.id).join(',')}`}
            style={{ padding: '0.55rem 1rem', borderRadius: '0.5rem', border: '1px solid #0f2253', background: 'white', color: '#0f2253', fontWeight: 700, fontSize: '0.85rem', textDecoration: 'none' }}>
            {gonderilmis.length} belgenin UBL XML&apos;ini indir (ZIP)
          </a>
          <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>
            Entegratör portalına toplu yüklemek ya da muhasebeciye vermek için.
          </span>
        </div>
      )}

      {topluSonuc && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Gönderim sonucu: {topluSonuc.gonderilen} gönderildi
            {topluSonuc.basarisiz > 0 && <span style={{ color: '#b91c1c' }}>, {topluSonuc.basarisiz} başarısız</span>}
          </h2>
          <div style={{ display: 'grid', gap: '0.25rem', fontSize: '0.8rem', maxHeight: '16rem', overflowY: 'auto' }}>
            {topluSonuc.sonuclar.map((x: any) => (
              <div key={x.id} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', color: x.ok ? '#166534' : '#991b1b' }}>
                <span style={{ fontWeight: 700, minWidth: '1.2rem' }}>{x.ok ? '✓' : '✗'}</span>
                <span style={{ fontFamily: 'monospace' }}>{x.invoiceNumber}</span>
                <span style={{ minWidth: '9rem' }}>{x.musteri}</span>
                {x.gibNo && <span style={{ fontFamily: 'monospace', color: '#6b7280' }}>{x.gibNo}</span>}
                {x.hata && <span>{x.hata}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        {([['Tümü', 'hepsi', veri.toplam], ['Bekleyen', 'bekleyen', bekleyen.length], ['Gönderilen', 'gonderildi', gonderilmis.length], ['Eksik', 'eksik', veri.eksik]] as const).map(([l, v, n]) => (
          <button key={l} onClick={() => setSuzgec(v)}
            style={{
              padding: '0.4rem 0.9rem', borderRadius: '999px', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
              border: '1px solid ' + (suzgec === v ? '#0f2253' : '#d1d5db'),
              background: suzgec === v ? '#0f2253' : 'white',
              color: suzgec === v ? 'white' : '#374151',
            }}>{l} ({n})</button>
        ))}
      </div>

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', overflow: 'hidden' }}>
        {liste.length === 0 && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280', fontSize: '0.9rem' }}>
            {suzgec === 'eksik' ? 'Eksiği olan fatura yok — hepsinin bilgisi tam.'
              : suzgec === 'bekleyen' ? 'Gönderilmeyi bekleyen fatura yok.'
              : suzgec === 'gonderildi' ? 'Henüz gönderilmiş fatura yok.'
              : 'Henüz fatura yok.'}
          </div>
        )}
        {liste.map((f) => (
          <div key={f.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <button onClick={() => belgeyiAc(f.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
              padding: '0.8rem 1rem', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
            }}>
              {/* ROZET — gönderim durumu varsa hazırlık bilgisinin YERİNE
                  geçer. Gönderilmiş fatura listede "hazır" yazmaya devam
                  ederse bayi onu tekrar göndermeye çalışır. */}
              {(() => {
                const d = f.durum && f.durum !== 'ESKI_SISTEM' ? f.durum : null;
                const g = ROZET[d as keyof typeof ROZET];
                const etiket = g ? g.etiket : f.hazir ? 'hazır' : `${f.eksikSayisi} eksik`;
                const zemin = g ? g.zemin : f.hazir ? '#dcfce7' : '#fef3c7';
                const yazi = g ? g.yazi : f.hazir ? '#166534' : '#92400e';
                return (
                  <span style={{
                    fontSize: '0.7rem', fontWeight: 700, borderRadius: '999px', padding: '0.15rem 0.5rem',
                    background: zemin, color: yazi, whiteSpace: 'nowrap',
                  }}>{etiket}</span>
                );
              })()}
              <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#6b7280' }}>
                {f.invoiceNumber}
                {f.gibNo && <><br /><span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>{f.gibNo}</span></>}
              </span>
              <span style={{ flex: 1, minWidth: '8rem', fontWeight: 600, color: '#111827' }}>{f.musteri}</span>
              <span style={{ fontSize: '0.78rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{gg(f.tarih)}</span>
              <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{tl(f.tutar)}</span>
              <span style={{ color: '#9ca3af' }}>{acik === f.id ? '▲' : '▼'}</span>
            </button>

            {acik === f.id && (
              <div style={{ padding: '0 1rem 1rem', fontSize: '0.83rem' }}>
                {!belge && <p style={{ color: '#6b7280' }}>Hazırlanıyor…</p>}
                {/* GÖNDERİM DURUMU — gönderilmişse numarası ve sonucu. */}
                {belge?.gonderimDurumu?.durum && belge.gonderimDurumu.durum !== 'ESKI_SISTEM' && (
                  <div style={{
                    background: belge.gonderimDurumu.durum === 'HATA' || belge.gonderimDurumu.durum === 'RED' ? '#fef2f2' : '#f0fdf4',
                    border: '1px solid ' + (belge.gonderimDurumu.durum === 'HATA' || belge.gonderimDurumu.durum === 'RED' ? '#fecaca' : '#bbf7d0'),
                    borderRadius: '0.5rem', padding: '0.6rem 0.75rem', marginBottom: '0.7rem', fontSize: '0.8rem',
                  }}>
                    <b>{belge.gonderimDurumu.durum}</b>
                    {belge.gonderimDurumu.gibNo && <> · <span style={{ fontFamily: 'monospace' }}>{belge.gonderimDurumu.gibNo}</span></>}
                    {belge.gonderimDurumu.not && <div>{belge.gonderimDurumu.not}</div>}
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                      {belge.gonderimDurumu.durum === 'GONDERILDI' && (
                        <button onClick={() => gonder(f.id, belge, 'durum')} disabled={gonderiliyor}
                          style={{ padding: '0.25rem 0.7rem', fontSize: '0.76rem', fontWeight: 600, borderRadius: '0.4rem', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>
                          Durumu sor (kabul/red)
                        </button>
                      )}
                      {/* UBL XML — entegratör portalına yüklenecek asıl dosya.
                          Bağlantı kurulmamış bayinin faturayı kesme yolu bu. */}
                      {belge.gonderimDurumu.gibNo && (
                        <a href={`/api/invoices/e-belge/ubl?id=${f.id}`}
                          style={{ padding: '0.25rem 0.7rem', fontSize: '0.76rem', fontWeight: 600, borderRadius: '0.4rem', border: '1px solid #d1d5db', background: 'white', color: '#111827', textDecoration: 'none' }}>
                          UBL XML indir
                        </a>
                      )}
                    </div>
                  </div>
                )}
                {belge && belge.eksikler?.length > 0 && (
                  <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem', padding: '0.7rem', color: '#92400e' }}>
                    <b>Eksikler:</b>
                    <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
                      {belge.eksikler.map((x: string) => <li key={x}>{x}</li>)}
                    </ul>
                  </div>
                )}
                {belge?.belgeHatasi && (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.5rem', padding: '0.7rem', color: '#991b1b', whiteSpace: 'pre-wrap' }}>
                    {belge.belgeHatasi}
                  </div>
                )}
                {belge?.belge && (
                  <div style={{ display: 'grid', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', color: '#374151' }}>
                      <span>Senaryo: <b>{belge.belge.senaryo === 'TEMELFATURA' ? 'e-Fatura' : 'e-Arşiv'}</b></span>
                      <span>Belge no: <b style={{ fontFamily: 'monospace' }}>{belge.numaraOnizleme || '—'}</b></span>
                      <span>Alıcı: <b>{belge.belge.alici.unvan}</b></span>
                      <span>{belge.belge.alici.kimlikTuru}: <b style={{ fontFamily: 'monospace' }}>{belge.belge.alici.kimlikNo}</b></span>
                    </div>
                    <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}>
                      <table style={{ width: '100%', fontSize: '0.78rem', borderCollapse: 'collapse' }}>
                        <thead style={{ background: '#f9fafb' }}>
                          <tr>{['#', 'Açıklama', 'Miktar', 'Birim fiyat', 'Tutar', 'KDV', 'KDV tutarı'].map((h) => (
                            <th key={h} style={{ padding: '0.4rem 0.5rem', textAlign: 'left', fontWeight: 600, color: '#6b7280' }}>{h}</th>
                          ))}</tr>
                        </thead>
                        <tbody>
                          {belge.belge.satirlar.map((s: any) => (
                            <tr key={s.sira} style={{ borderTop: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '0.35rem 0.5rem' }}>{s.sira}</td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>{s.aciklama}</td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>{s.miktar}</td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>{tl(s.birimFiyat)}</td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>{tl(s.tutar)}</td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>%{s.kdvOrani}</td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>{tl(s.kdvTutari)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', justifyContent: 'flex-end', fontWeight: 600 }}>
                      <span>Matrah: {tl(belge.belge.toplamlar.matrah)}</span>
                      <span>KDV: {tl(belge.belge.toplamlar.kdv)}</span>
                      <span style={{ color: '#0f2253' }}>Toplam: {tl(belge.belge.toplamlar.genelToplam)}</span>
                    </div>

                    {/* GÖNDER — geri alınamaz. Onay metni test/canlı ayrımını
                        ve gönderilecek numarayı olduğu gibi yazıyor. */}
                    <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginTop: '0.5rem' }}>
                      <button
                        onClick={() => gonder(f.id, belge)}
                        disabled={gonderiliyor || !ayar?.saglayici}
                        style={{
                          padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none', fontWeight: 700,
                          fontSize: '0.85rem', cursor: ayar?.saglayici ? 'pointer' : 'not-allowed',
                          background: ayar?.saglayici ? (ayar.testModu ? '#b45309' : '#0f2253') : '#d1d5db',
                          color: 'white',
                        }}>
                        {gonderiliyor ? 'Gönderiliyor…' : ayar?.testModu ? 'Test gönderimi' : 'Gönder'}
                      </button>
                      {!ayar?.saglayici && (
                        <span style={{ fontSize: '0.76rem', color: '#9ca3af' }}>Önce sağlayıcı ayarlarını yap.</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
