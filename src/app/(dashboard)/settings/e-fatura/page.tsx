'use client';

import { useEffect, useState } from 'react';
import { useT, useBicim } from '@/lib/i18n/client';
import { doldur, type Sozluk } from '@/lib/i18n/sozluk';

/**
 * e-FATURA SAĞLAYICI AYARLARI
 *
 * ── İKİ TEHLİKELİ DÜĞME ──────────────────────────────────────────────────
 * 1. TEST MODUNU KAPATMAK. Kapandığı an gönderilen belge müşteriye ULAŞIR
 *    ve geri alınamaz. Varsayılan açık, kapatmak bilerek yapılan bir iş.
 * 2. BELGE SIRASI. Ekranda GÖSTERİLİYOR ama DEĞİŞTİRİLEMİYOR: geri
 *    alınırsa aynı numaradan iki belge çıkar, ileri alınırsa sırada boşluk
 *    kalır. İkisi de düzeltilemez.
 *
 * Parola bir kez girildikten sonra GERİ OKUNMUYOR, yalnız maskesi
 * görünüyor: ekrana düşen parola tarayıcı geçmişine ve ekran görüntüsüne
 * girer.
 */

/** Seçim listesinde kod değil bayinin anlayacağı ad görünsün. */
const saglayiciAdi = (t: Sozluk): Record<string, string> => ({
  ELDEN: t.eFatura.saglayiciElden,
  TEST: t.eFatura.saglayiciTest,
});

export default function EFaturaAyarPage() {
  const t = useT();
  const b = useBicim();
  const SAGLAYICI_ADI = saglayiciAdi(t);
  const [d, setD] = useState<any>(null);
  const [f, setF] = useState<any>({ saglayici: '', kullanici: '', parola: '', onEk: '', etiket: '', testModu: true });
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [tamam, setTamam] = useState(false);

  const yukle = async () => {
    const r = await fetch('/api/settings/e-fatura');
    const j = await r.json();
    if (!r.ok) { setHata(j.error || t.genel.hata); return; }
    setD(j);
    setF({
      saglayici: j.saglayici || '', kullanici: j.kullanici || '', parola: '',
      onEk: j.onEk || '', etiket: j.etiket || '', testModu: j.testModu !== false,
    });
  };
  useEffect(() => { yukle(); }, []);

  const kaydet = async () => {
    // Test modunu KAPATMAK geri alınamaz sonuçlar doğurur: açıkça soruluyor.
    if (d?.testModu && !f.testModu) {
      if (!confirm(t.eFatura.testKapatmaOnay)) return;
    }
    setMesgul(true); setHata(null); setTamam(false);
    const r = await fetch('/api/settings/e-fatura', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    });
    const j = await r.json();
    setMesgul(false);
    if (!r.ok) { setHata(j.error || t.sozlesmeler.kaydedilemedi); return; }
    setTamam(true);
    await yukle();
  };

  if (hata && !d) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{hata}</div>;
  if (!d) return <div style={{ padding: '2rem', color: '#6b7280' }}>{t.genel.yukleniyor}</div>;

  const inp: any = { width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.9rem' };
  const lbl: any = { display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.25rem' };

  return (
    <div style={{ padding: '2rem', maxWidth: 660 }}>
      <a href="/e-fatura" style={{ fontSize: '0.82rem', color: '#2563eb' }}>{t.eFatura.ayarGeri}</a>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem' }}>{t.eFatura.ayarBaslik}</h1>
      <p style={{ color: '#6b7280', margin: '0 0 1.25rem', fontSize: '0.88rem' }}>
        {t.eFatura.ayarAlt}
      </p>

      {!d.anahtarVar && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.84rem', color: '#991b1b' }}>
          <b>{t.eFatura.anahtarYokVurgu}</b> {t.eFatura.anahtarYokSon}
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <div style={{ marginBottom: '0.9rem' }}>
          <label style={lbl}>{t.eFatura.saglayici}</label>
          <select style={inp} value={f.saglayici} onChange={(e) => setF({ ...f, saglayici: e.target.value })}>
            <option value="">{t.eFatura.saglayiciSecilmemis}</option>
            {(d.saglayicilar || []).map((x: string) => <option key={x} value={x}>{SAGLAYICI_ADI[x] || x}</option>)}
          </select>
          <div style={{ fontSize: '0.73rem', color: '#6b7280', margin: '0.4rem 0 0', lineHeight: 1.6 }}>
            <div><b>{t.eFatura.eldenVurgu}</b> {t.eFatura.eldenSon}</div>
            <div style={{ marginTop: '0.2rem' }}><b>{t.eFatura.testVurgu}</b> {t.eFatura.testSon}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.7rem', marginBottom: '0.9rem' }}>
          <div>
            <label style={lbl}>{t.eFatura.kullaniciAdi}</label>
            <input style={inp} value={f.kullanici} onChange={(e) => setF({ ...f, kullanici: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>{t.eFatura.parola}</label>
            <input type="password" style={inp} value={f.parola}
              placeholder={d.parolaMaske || t.eFatura.parolaGirilmemis}
              onChange={(e) => setF({ ...f, parola: e.target.value })} />
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
              {d.parolaOkunamiyor ? t.eFatura.parolaOkunamiyorKisa : t.eFatura.parolaKorunur}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.7rem', marginBottom: '0.9rem' }}>
          <div>
            <label style={lbl}>{t.eFatura.onEk}</label>
            <input style={inp} maxLength={3} value={f.onEk}
              onChange={(e) => setF({ ...f, onEk: e.target.value.toLocaleUpperCase('tr-TR') })} />
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
              {t.eFatura.onEkIpucuOn} <code>{(f.onEk || 'XXX')}2026000000001</code> {t.eFatura.onEkIpucuSon}
            </p>
          </div>
          <div>
            <label style={lbl}>{t.eFatura.etiket}</label>
            <input style={inp} value={f.etiket} onChange={(e) => setF({ ...f, etiket: e.target.value })} />
          </div>
        </div>

        {/* ── BELGE SIRASI: GÖSTERİLİYOR, DEĞİŞTİRİLEMİYOR ──────────── */}
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.7rem 0.85rem', marginBottom: '0.9rem', fontSize: '0.82rem' }}>
          <b>{t.eFatura.siraBaslik}</b>{' '}
          {d.sonSira > 0 ? doldur(t.eFatura.siraDeger, { yil: d.sonSiraYil, n: d.sonSira }) : t.eFatura.siraYok}
          <p style={{ fontSize: '0.73rem', color: '#9ca3af', margin: '0.3rem 0 0' }}>
            {t.eFatura.siraIpucu}
          </p>
        </div>

        {/* ── TEST MODU ─────────────────────────────────────────────── */}
        <div style={{
          background: f.testModu ? '#fffbeb' : '#fef2f2',
          border: `1px solid ${f.testModu ? '#fde68a' : '#fecaca'}`,
          borderRadius: '0.5rem', padding: '0.75rem 0.85rem', marginBottom: '1rem',
        }}>
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.6rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={f.testModu} style={{ marginTop: '0.2rem' }}
              onChange={(e) => setF({ ...f, testModu: e.target.checked })} />
            <span style={{ fontSize: '0.84rem', color: f.testModu ? '#92400e' : '#991b1b' }}>
              <b>{t.eFatura.testModu}</b>
              <div style={{ marginTop: '0.2rem' }}>
                {f.testModu ? t.eFatura.testModuAcik : t.eFatura.testModuKapali}
              </div>
            </span>
          </label>
        </div>

        {hata && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.8rem' }}>{hata}</div>}
        {tamam && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.8rem' }}>{t.eFatura.kaydedildi}</div>}

        <button onClick={kaydet} disabled={mesgul}
          style={{ width: '100%', padding: '0.7rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', opacity: mesgul ? 0.7 : 1 }}>
          {mesgul ? t.genel.kaydediliyor : t.genel.kaydet}
        </button>
      </div>
    </div>
  );
}
