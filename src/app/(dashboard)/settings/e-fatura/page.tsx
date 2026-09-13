'use client';

import { useEffect, useState } from 'react';

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

export default function EFaturaAyarPage() {
  const [d, setD] = useState<any>(null);
  const [f, setF] = useState<any>({ saglayici: '', kullanici: '', parola: '', onEk: '', etiket: '', testModu: true });
  const [mesgul, setMesgul] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [tamam, setTamam] = useState(false);

  const yukle = async () => {
    const r = await fetch('/api/settings/e-fatura');
    const j = await r.json();
    if (!r.ok) { setHata(j.error || 'Yüklenemedi'); return; }
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
      if (!confirm(
        'TEST MODU KAPATILIYOR.\n\n'
        + 'Bundan sonra gönderdiğin her belge GERÇEKTEN müşteriye ulaşır ve geri alınamaz.\n\n'
        + 'Sağlayıcı bilgilerinin doğru olduğundan emin misin?',
      )) return;
    }
    setMesgul(true); setHata(null); setTamam(false);
    const r = await fetch('/api/settings/e-fatura', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(f),
    });
    const j = await r.json();
    setMesgul(false);
    if (!r.ok) { setHata(j.error || 'Kaydedilemedi'); return; }
    setTamam(true);
    await yukle();
  };

  if (hata && !d) return <div style={{ padding: '2rem', color: '#b91c1c' }}>{hata}</div>;
  if (!d) return <div style={{ padding: '2rem', color: '#6b7280' }}>Yükleniyor…</div>;

  const inp: any = { width: '100%', padding: '0.55rem 0.7rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', fontSize: '0.9rem' };
  const lbl: any = { display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#4b5563', marginBottom: '0.25rem' };

  return (
    <div style={{ padding: '2rem', maxWidth: 660 }}>
      <a href="/e-fatura" style={{ fontSize: '0.82rem', color: '#2563eb' }}>← e-Fatura Hazırlığı</a>
      <h1 style={{ fontSize: '1.6rem', fontWeight: 'bold', margin: '0.5rem 0 0.25rem' }}>e-Fatura Sağlayıcı Ayarları</h1>
      <p style={{ color: '#6b7280', margin: '0 0 1.25rem', fontSize: '0.88rem' }}>
        Faturayı GİB&apos;e ulaştıran servis sağlayıcı (özel entegratör) bilgileri.
      </p>

      {!d.anahtarVar && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '0.75rem', padding: '0.85rem 1rem', marginBottom: '1.25rem', fontSize: '0.84rem', color: '#991b1b' }}>
          <b>Şifreleme anahtarı tanımlı değil.</b> Parola şifrelenemediği için KAYDEDİLMEZ —
          düz metin olarak yazmıyoruz. Sunucuda <code>SIR_ANAHTARI</code> ortam değişkenini
          tanımlayın (64 karakterlik onaltılık bir değer).
        </div>
      )}

      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '1.25rem' }}>
        <div style={{ marginBottom: '0.9rem' }}>
          <label style={lbl}>Sağlayıcı</label>
          <select style={inp} value={f.saglayici} onChange={(e) => setF({ ...f, saglayici: e.target.value })}>
            <option value="">Seçilmemiş — gönderim kapalı</option>
            {(d.saglayicilar || []).map((x: string) => <option key={x} value={x}>{x}</option>)}
          </select>
          <p style={{ fontSize: '0.73rem', color: '#9ca3af', margin: '0.3rem 0 0' }}>
            <b>TEST</b> gerçek bir servise bağlanmaz; gönderim hattını denemek içindir.
            Gerçek sağlayıcı, sözleşme yapıldığında buraya eklenir.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.7rem', marginBottom: '0.9rem' }}>
          <div>
            <label style={lbl}>Kullanıcı adı</label>
            <input style={inp} value={f.kullanici} onChange={(e) => setF({ ...f, kullanici: e.target.value })} />
          </div>
          <div>
            <label style={lbl}>Parola</label>
            <input type="password" style={inp} value={f.parola}
              placeholder={d.parolaMaske || 'girilmemiş'}
              onChange={(e) => setF({ ...f, parola: e.target.value })} />
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
              {d.parolaOkunamiyor
                ? 'Kayıtlı parola okunamıyor — yeniden girin.'
                : 'Boş bırakırsan mevcut parola korunur. Kayıtlı parola geri gösterilmez.'}
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))', gap: '0.7rem', marginBottom: '0.9rem' }}>
          <div>
            <label style={lbl}>Belge ön eki (3 harf)</label>
            <input style={inp} maxLength={3} value={f.onEk}
              onChange={(e) => setF({ ...f, onEk: e.target.value.toLocaleUpperCase('tr-TR') })} />
            <p style={{ fontSize: '0.72rem', color: '#9ca3af', margin: '0.25rem 0 0' }}>
              GİB&apos;e kayıtlı ön ek. Belge numarası <code>{(f.onEk || 'XXX')}2026000000001</code> gibi olur.
            </p>
          </div>
          <div>
            <label style={lbl}>Gönderici etiketi</label>
            <input style={inp} value={f.etiket} onChange={(e) => setF({ ...f, etiket: e.target.value })} />
          </div>
        </div>

        {/* ── BELGE SIRASI: GÖSTERİLİYOR, DEĞİŞTİRİLEMİYOR ──────────── */}
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem', padding: '0.7rem 0.85rem', marginBottom: '0.9rem', fontSize: '0.82rem' }}>
          <b>Son kullanılan belge sırası:</b>{' '}
          {d.sonSira > 0 ? `${d.sonSiraYil} yılı · ${d.sonSira}. belge` : 'henüz belge gönderilmedi'}
          <p style={{ fontSize: '0.73rem', color: '#9ca3af', margin: '0.3rem 0 0' }}>
            Bu sayı elle değiştirilemez: geri alınırsa aynı numaradan iki belge çıkar,
            ileri alınırsa sırada boşluk kalır. İkisi de düzeltilemez.
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
              <b>Test modu</b>
              <div style={{ marginTop: '0.2rem' }}>
                {f.testModu
                  ? 'Açık: gönderilen belge GİB’e ulaşmaz, müşteriye fatura gitmez. Güvenle deneyebilirsin.'
                  : 'KAPALI: gönderdiğin her belge GERÇEKTEN müşteriye ulaşır ve GERİ ALINAMAZ.'}
              </div>
            </span>
          </label>
        </div>

        {hata && <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.8rem' }}>{hata}</div>}
        {tamam && <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', borderRadius: '0.5rem', padding: '0.6rem 0.75rem', fontSize: '0.82rem', marginBottom: '0.8rem' }}>Kaydedildi.</div>}

        <button onClick={kaydet} disabled={mesgul}
          style={{ width: '100%', padding: '0.7rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '0.5rem', fontWeight: 600, cursor: 'pointer', opacity: mesgul ? 0.7 : 1 }}>
          {mesgul ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}
