'use client';

import { useEffect, useState } from 'react';
import { waUrl } from '@/lib/share';

/**
 * Müşteri kartındaki "Müşteri paneli" bölümü.
 *
 * Bayinin buradaki tek işi: aç → bağlantıyı WhatsApp'tan yolla. Bağlantı
 * yanlış kişiye giderse "Yenile" eskisini anında geçersiz kılar; bu yüzden
 * tek tık uzakta ve ne yaptığı açıkça yazıyor.
 */
export default function MusteriPortalKarti({ customerId }: { customerId: string }) {
  const [durum, setDurum] = useState<{
    acik: boolean; yol: string | null; sonGoruntuleme: string | null;
    telefon: string; musteriAdi: string; maliGorunur: boolean;
    hazirlik: { anahtar: string; sayi: number; mesaj: string; ornek?: string }[];
  } | null>(null);
  const [calisiyor, setCalisiyor] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [hata, setHata] = useState('');

  useEffect(() => {
    fetch(`/api/customers/${customerId}/portal`).then((r) => r.json())
      .then((d) => { if (!d.error) setDurum(d); }).catch(() => {});
  }, [customerId]);

  async function islem(op: 'ac' | 'kapat' | 'yenile') {
    if (op === 'yenile' && !confirm('Eski bağlantı ANINDA geçersiz olacak. Müşteriye yeni bağlantıyı yollamanız gerekir. Devam edilsin mi?')) return;
    if (op === 'kapat' && !confirm('Müşteri paneli kapatılacak ve bağlantı geçersiz olacak. Devam edilsin mi?')) return;
    setCalisiyor(true); setHata('');
    try {
      const r = await fetch(`/api/customers/${customerId}/portal`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ islem: op }),
      });
      const d = await r.json();
      if (!r.ok) { setHata(d.error ?? 'İşlem başarısız'); return; }
      setDurum((o) => (o ? { ...o, acik: d.acik, yol: d.yol } : o));
      setKopyalandi(false);
    } catch {
      setHata('Bağlantı kurulamadı.');
    } finally { setCalisiyor(false); }
  }

  if (!durum) return null;

  const tamLink = durum.yol && typeof window !== 'undefined' ? `${window.location.origin}${durum.yol}` : '';
  const mesaj = tamLink
    ? `Merhaba${durum.musteriAdi ? ` ${durum.musteriAdi}` : ''},\n\nCihazlarınızı, servis durumunu ve bakiyenizi görebileceğiniz kişisel sayfanız:\n${tamLink}\n\nBu bağlantı size özeldir, paylaşmayınız.`
    : '';

  const kutu: React.CSSProperties = { backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' };
  const dugme: React.CSSProperties = {
    padding: '0.45rem 0.9rem', borderRadius: '0.5rem', fontSize: '0.8rem', fontWeight: 500,
    border: '1px solid #e5e7eb', backgroundColor: 'white', color: '#374151', cursor: 'pointer',
  };

  return (
    <div style={kutu}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontWeight: 600 }}>Müşteri paneli</h2>
        <span style={{
          fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: 9999,
          backgroundColor: durum.acik ? '#dcfce7' : '#f3f4f6', color: durum.acik ? '#166534' : '#6b7280',
        }}>{durum.acik ? 'Açık' : 'Kapalı'}</span>
      </div>

      <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.6 }}>
        Müşteri kendi cihazlarını{durum.maliGorunur ? ', servis durumunu ve bakiyesini' : ' ve servis durumunu'} görür;
        arıza ve sayaç bildirebilir. Şifre yok — bağlantıya sahip olan görür.
      </p>

      {hata && <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: '#b91c1c' }}>{hata}</div>}

      {/* GÖNDERMEDEN ÖNCE GÖR — panel bayinin verisini müşteriye gösteriyor.
          Engellemiyoruz, karar bayinin; ama sonradan utanmaktansa şimdi görsün. */}
      {durum.hazirlik?.length > 0 && (
        <div style={{
          marginTop: '0.875rem', padding: '0.75rem 0.85rem', borderRadius: '0.6rem',
          backgroundColor: '#fffbeb', border: '1px solid #fde68a',
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e' }}>
            Göndermeden önce
          </div>
          <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.1rem', fontSize: '0.78rem', color: '#78350f', lineHeight: 1.6 }}>
            {durum.hazirlik.map((h) => (
              <li key={h.anahtar}>
                {h.mesaj}
                {h.ornek && <span style={{ display: 'block', color: '#a16207', fontFamily: 'monospace', fontSize: '0.72rem' }}>ör: {h.ornek}</span>}
              </li>
            ))}
          </ul>
          <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#a16207' }}>
            Panel bu bilgileri olduğu gibi gösterir. Düzeltmeden gönderebilirsiniz, karar sizin.
          </div>
        </div>
      )}

      {/* Mali bilgi durumu — bayi ne paylaştığını bilerek göndersin */}
      <div style={{ marginTop: '0.7rem', fontSize: '0.75rem', color: '#6b7280' }}>
        {durum.maliGorunur
          ? <>Müşteri <b>bakiyesini ve faturalarını</b> görecek. Gizlemek için Ayarlar → Müşteri Paneli.</>
          : <>Mali bilgiler <b>gizli</b>: müşteri hiçbir tutar görmüyor.</>}
      </div>

      {!durum.acik ? (
        <button onClick={() => islem('ac')} disabled={calisiyor}
          style={{ ...dugme, marginTop: '0.875rem', backgroundColor: '#111827', color: 'white', border: 'none' }}>
          {calisiyor ? 'Açılıyor…' : 'Paneli aç ve bağlantı oluştur'}
        </button>
      ) : (
        <>
          <div style={{
            marginTop: '0.875rem', padding: '0.6rem 0.75rem', borderRadius: '0.5rem',
            backgroundColor: '#f9fafb', border: '1px solid #e5e7eb',
            fontSize: '0.72rem', fontFamily: 'monospace', wordBreak: 'break-all', color: '#374151',
          }}>{tamLink}</div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
            <a href={waUrl(durum.telefon, mesaj)} target="_blank" rel="noreferrer"
              style={{ ...dugme, backgroundColor: '#25D366', color: 'white', border: 'none', textDecoration: 'none' }}>
              WhatsApp'tan gönder
            </a>
            <button onClick={() => { navigator.clipboard?.writeText(tamLink); setKopyalandi(true); }} style={dugme}>
              {kopyalandi ? 'Kopyalandı' : 'Bağlantıyı kopyala'}
            </button>
            <a href={durum.yol ?? '#'} target="_blank" rel="noreferrer" style={{ ...dugme, textDecoration: 'none' }}>
              Önizle
            </a>
            <button onClick={() => islem('yenile')} disabled={calisiyor} style={dugme}>
              Bağlantıyı yenile
            </button>
            <button onClick={() => islem('kapat')} disabled={calisiyor} style={{ ...dugme, color: '#b91c1c' }}>
              Kapat
            </button>
          </div>

          <p style={{ marginTop: '0.7rem', fontSize: '0.72rem', color: '#9ca3af' }}>
            {durum.sonGoruntuleme
              ? `Müşteri en son ${new Date(durum.sonGoruntuleme).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })} tarihinde baktı.`
              : 'Müşteri henüz paneli açmadı.'}
          </p>
        </>
      )}
    </div>
  );
}
