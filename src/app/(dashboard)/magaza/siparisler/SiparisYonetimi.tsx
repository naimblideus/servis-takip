'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { bicimYap } from '@/lib/bicim';
import { useBicim, useDil } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import { magazaSiparisMetni, type MagazaSiparisMetni } from '@/lib/magaza-siparis-metin';
import { SiparisEylemi } from '../SiparisEylemi';
import { KIRMIZI, MAVI, dugme, kodMetni, siparisIslemi, siparisleriGetir, type Siparis, type SiparisVerisi } from '../siparis-ortak';

/**
 * SİPARİŞLER — mağazanın bütün siparişleri, Servis'in içinden.
 *
 * Mağaza panelindeki sipariş listesinin karşılığı: aynı filtreler, aynı
 * sıradaki adım ve düğmeler (kurallar mağazada). Nadir işler (hazırlanıyor,
 * iptal) "Başka işlem" altında kapalı.
 */
const FILTRELER: { f: string; ad: keyof MagazaSiparisMetni }[] = [
  { f: 'ACIK', ad: 'fAcik' },
  { f: 'YENI', ad: 'fYeni' },
  { f: 'ONAYLANDI', ad: 'fOnayli' },
  { f: 'KARGODA', ad: 'fKargoda' },
  { f: 'STOK_BEKLIYOR', ad: 'fStok' },
  { f: 'ONAY_KUYRUKTA', ad: 'fSirada' },
  { f: 'HATA', ad: 'fHata' },
  { f: 'HEPSI', ad: 'fHepsi' },
];

const metin = (sm: MagazaSiparisMetni, onek: string, k: string) => (sm as Record<string, string>)[`${onek}${k}`] ?? k;

export function SiparisYonetimi() {
  const { dil } = useDil();
  const b = useBicim();
  const sm = magazaSiparisMetni(dil);
  const [filtre, setFiltre] = useState('ACIK');
  const [veri, setVeri] = useState<SiparisVerisi | null>(null);
  const [kod, setKod] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    void siparisleriGetir(filtre).then((r) => {
      if (iptal) return;
      if ('veri' in r) {
        setVeri(r.veri);
        setKod(null);
      } else setKod(r.kod);
    });
    return () => {
      iptal = true;
    };
  }, [filtre]);

  function degisti(yeni: Siparis) {
    setVeri((v) => (v ? { ...v, siparisler: v.siparisler.map((s) => (s.id === yeni.id ? yeni : s)) } : v));
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '1rem 0' }}>
        {FILTRELER.map((x) => {
          const n = veri?.sayilar?.[x.f];
          const secili = filtre === x.f;
          return (
            <button
              key={x.f}
              type="button"
              aria-pressed={secili}
              onClick={() => setFiltre(x.f)}
              style={{
                padding: '0.4rem 0.8rem', borderRadius: 999, fontSize: '0.84rem', cursor: 'pointer', minHeight: 36,
                border: `1px solid ${secili ? MAVI : '#d1d5db'}`, background: secili ? '#eff6ff' : 'white',
                color: secili ? MAVI : '#374151', fontWeight: secili ? 700 : 500,
              }}
            >
              {sm[x.ad]}
              {typeof n === 'number' && x.f !== 'HEPSI' && n > 0 ? ` · ${n}` : ''}
            </button>
          );
        })}
      </div>

      {kod && (
        <p style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 8, padding: '0.6rem 0.8rem', fontSize: '0.85rem' }}>
          {kodMetni(kod, sm)}
        </p>
      )}

      {!veri && !kod && <p style={{ color: '#6b7280' }}>{sm.yukleniyor}</p>}

      {veri && veri.filtre === filtre && veri.siparisler.length === 0 && (
        <p style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
          {sm.filtreBos}
        </p>
      )}

      {veri &&
        veri.siparisler.map((s) => (
          <SiparisKarti key={s.id} s={s} sm={sm} veri={veri} tarih={b.tarihSaat(s.tarih)} dil={dil} onDegisti={degisti} />
        ))}
    </div>
  );
}

function SiparisKarti({
  s,
  sm,
  veri,
  tarih,
  dil,
  onDegisti,
}: {
  s: Siparis;
  sm: MagazaSiparisMetni;
  veri: SiparisVerisi;
  tarih: string;
  dil: string;
  onDegisti: (s: Siparis) => void;
}) {
  const para = bicimYap(dil === 'en' ? 'en' : 'tr', s.paraBirimi).para;
  const [ekMesaj, setEkMesaj] = useState<{ tur: 'ok' | 'hata'; metin: string } | null>(null);
  const [mesgul, setMesgul] = useState(false);
  const odendi = s.odeme.durum === 'ODENDI';
  const iptalEdilebilir = !s.kapandi && s.durum !== 'IPTAL' && s.durum !== 'TAMAMLANDI' && s.durum !== 'ONAY_KUYRUKTA';
  const hazirlanabilir = s.kapandi && s.durum === 'ONAYLANDI';

  async function ekIslem(islem: 'IPTAL' | 'HAZIRLANIYOR', basari: string) {
    if (islem === 'IPTAL' && !window.confirm(doldur(sm.sorIptal, { no: s.no }))) return;
    setMesgul(true);
    const r = await siparisIslemi(islem, s.id);
    setMesgul(false);
    setEkMesaj(r.ok ? { tur: 'ok', metin: basari } : { tur: 'hata', metin: r.hata ?? kodMetni(r.kod, sm) });
    if (r.siparis) onDegisti(r.siparis);
  }

  return (
    <article style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: '1rem', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.82rem', color: '#374151' }}>{s.no}</span>
            <span style={{ background: '#eff6ff', color: MAVI, fontSize: '0.74rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: 6 }}>
              {metin(sm, 'durum', s.durum)}
            </span>
            {s.kapandi && (
              <span style={{ background: '#ecfdf5', color: '#05603a', fontSize: '0.74rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: 6 }}>
                {sm.stokDusuldu}
              </span>
            )}
            {s.alici.turu === 'TACIR' && (
              <span style={{ background: '#f3f4f6', color: '#374151', fontSize: '0.74rem', fontWeight: 700, padding: '0.1rem 0.5rem', borderRadius: 6 }}>
                {sm.tacir}
              </span>
            )}
          </div>
          <div style={{ fontWeight: 700, marginTop: 4 }}>{s.alici.ad}</div>
          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            {s.alici.telefon} · {tarih}
          </div>
          <div style={{ color: '#6b7280', fontSize: '0.8rem', maxWidth: 520 }}>{s.alici.adres}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{para(s.toplam)}</div>
          <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>
            {metin(sm, 'odeme', s.odeme.yontem)} · {metin(sm, 'teslimat', s.teslimat)} ·{' '}
            <span style={{ color: odendi ? '#05603a' : '#6b7280', fontWeight: odendi ? 700 : 400 }}>{odendi ? sm.odendi : sm.odemeBekliyor}</span>
          </div>
          {s.kargo.firma && (
            <div style={{ color: '#6b7280', fontSize: '0.8rem' }}>{doldur(sm.kargoBilgi, { firma: s.kargo.firma, takip: s.kargo.takip ?? '—' })}</div>
          )}
        </div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', margin: '0.6rem 0', fontSize: '0.84rem' }}>
        <tbody>
          {s.satirlar.map((r, i) => (
            <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
              <td style={{ padding: '0.35rem 0.5rem 0.35rem 0', color: '#6b7280', fontFamily: 'ui-monospace, monospace', fontSize: '0.78rem' }}>{r.sku}</td>
              <td style={{ padding: '0.35rem 0.5rem 0.35rem 0' }}>
                {r.ad}
                {veri.bagli && !r.bagli && <span style={{ color: '#b54708', fontSize: '0.74rem' }}> · {sm.stokBagiYok}</span>}
              </td>
              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', whiteSpace: 'nowrap' }}>× {r.adet}</td>
              <td style={{ padding: '0.35rem 0', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>{para(r.tutar)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {s.settleHata && s.durum !== 'ONAY_KUYRUKTA' && (
        <p style={{ background: '#fef3f2', color: KIRMIZI, borderRadius: 8, padding: '0.5rem 0.7rem', fontSize: '0.8rem', margin: '0 0 0.6rem' }}>
          <b>{sm.kapanmadi}</b> {s.settleHata}
        </p>
      )}

      <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 10 }}>
        <SiparisEylemi s={s} sm={sm} bagli={veri.bagli} otomatikWa={veri.otomatikWa} kargoFirmalari={veri.kargoFirmalari} onDegisti={(y) => onDegisti(y)} />

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {s.waLink && (
            <a href={s.waLink} target="_blank" rel="noopener noreferrer" style={dugme(MAVI, true)}>
              {sm.dMusteriyeYaz} ↗
            </a>
          )}
          {s.takipLink && (
            <a href={s.takipLink} target="_blank" rel="noopener noreferrer" style={dugme('#4b5563', true)}>
              {sm.dTakip} ↗
            </a>
          )}
          {s.musteri?.kaynak === 'SERVIS' && (
            <Link href={`/customers/${s.musteri.id}`} style={dugme('#4b5563', true)}>
              {s.odemeServiste ? sm.dTahsilat : sm.dMusteriKarti}
            </Link>
          )}
        </div>

        {(iptalEdilebilir || hazirlanabilir) && (
          <details style={{ marginTop: 10 }}>
            <summary style={{ cursor: 'pointer', color: '#6b7280', fontSize: '0.84rem' }}>{sm.dBaskaIslem}</summary>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {hazirlanabilir && (
                <button type="button" disabled={mesgul} onClick={() => void ekIslem('HAZIRLANIYOR', sm.okHazirlaniyor)} style={dugme('#4b5563', true)}>
                  {sm.dHazirlaniyor}
                </button>
              )}
              {iptalEdilebilir && (
                <button type="button" disabled={mesgul} onClick={() => void ekIslem('IPTAL', sm.okIptal)} style={dugme(KIRMIZI, true)}>
                  {sm.dIptal}
                </button>
              )}
            </div>
          </details>
        )}
        {ekMesaj && (
          <p role="status" style={{ margin: '0.5rem 0 0', fontSize: '0.84rem', color: ekMesaj.tur === 'ok' ? '#05603a' : KIRMIZI }}>
            {ekMesaj.metin}
          </p>
        )}
      </div>
    </article>
  );
}
