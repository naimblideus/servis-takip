'use client';

import { useEffect, useState, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

/**
 * İLK-GİRİŞ EĞİTİM SİSTEMİ
 * 1) Hoş geldin sihirbazı (çok adımlı modal) — sistemi hiç bilmeyen birine sıfırdan anlatır.
 *    onboardedAt null ise gösterilir; "Başla/Geç" -> POST /api/onboarding/dismiss (bir daha çıkmaz).
 * 2) Yüzen "Başlangıç Rehberi" (sağ altta) — veri-bazlı checklist; ilk müşteri/cihaz/fiş/parça/fatura/tahsilat
 *    gerçek verilere göre otomatik tiklenir. Her sayfa değişiminde yenilenir. Tümü bitince kutlama + gizlenir.
 * Dashboard layout'ında global mount edilir; yalnızca girişli kullanıcı görür.
 */

interface Steps {
  hasCustomers: boolean;
  hasDevices: boolean;
  hasTickets: boolean;
  hasInventory: boolean;
  hasInvoices: boolean;
  hasCollections: boolean;
}
interface Status {
  onboarded: boolean;
  userName: string;
  steps: Steps;
}

const HIDE_KEY = 'gs_checklist_hidden_v1';

const CHECKLIST: { key: keyof Steps; title: string; desc: string; href: string; cta: string; icon: string }[] = [
  { key: 'hasCustomers', icon: '👤', title: '1. İlk müşterini ekle', desc: 'Hizmet verdiğin firmayı/kişiyi kaydet. Sonradan cihaz ve fişler buna bağlanır.', href: '/customers', cta: 'Müşteriler' },
  { key: 'hasDevices', icon: '🖨️', title: '2. Cihazı/yazıcıyı tanımla', desc: 'Müşterinin yazıcı/fotokopi cihazını ekle. Kiralıksa sayaç ve aylık kira buradan işler.', href: '/devices', cta: 'Cihazlar' },
  { key: 'hasInventory', icon: '📦', title: '3. Stoğuna parça ekle', desc: 'Toner, drum, yedek parça gir. Barkodu varsa okuyucuyla okutarak hızlıca bulabilirsin.', href: '/inventory', cta: 'Stok' },
  { key: 'hasTickets', icon: '🧾', title: '4. İlk servis fişini aç', desc: 'Arıza/bakım geldiğinde fiş oluştur, kullanılan parçaları ekle (barkodla okutabilirsin), işçilik gir.', href: '/tickets/new', cta: 'Yeni Fiş' },
  { key: 'hasInvoices', icon: '📄', title: '5. Faturanı kes', desc: 'Ay sonunda "Bu Dönemi Faturala" ile sayaç + kira + servis tek faturada otomatik kesilir. PDF yazdırabilirsin.', href: '/invoices', cta: 'Faturalar' },
  { key: 'hasCollections', icon: '💰', title: '6. Tahsilatını al', desc: 'Para geldiğinde tahsilatı gir; en eski açık faturadan otomatik düşülür (FIFO) ve makbuz yazdırabilirsin.', href: '/collections', cta: 'Tahsilat' },
];

const WIZARD: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Hoş geldiniz! 👋',
    body: (
      <>
        <p style={{ margin: '0 0 0.75rem' }}>
          Bu sistem <b>tüm işletmenizi tek yerden</b> yönetmeniz için kuruldu: müşteriler, yazıcı/fotokopi
          cihazları, servis fişleri, sayaç faturalama, stok ve tahsilat.
        </p>
        <p style={{ margin: 0, color: '#475569' }}>
          Hiç kullanmadıysanız endişelenmeyin — bu kısa rehber 1 dakikada mantığı anlatır, sonra sağ alttaki
          <b> “Başlangıç Rehberi”</b> sizi adım adım elinizden tutar.
        </p>
      </>
    ),
  },
  {
    title: 'Sistem nasıl çalışır? 🔗',
    body: (
      <>
        <p style={{ margin: '0 0 0.75rem' }}>Her şey basit bir zincirle bağlıdır:</p>
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {[
            ['👤', 'Müşteri', 'Hizmet verdiğiniz firma/kişi'],
            ['🖨️', 'Cihaz', 'Müşterinin yazıcısı (kiralıksa sayaç + kira)'],
            ['🧾', 'Servis Fişi', 'Arıza/bakım kaydı + parça + işçilik'],
            ['📄', 'Fatura', 'Sayaç + kira + servis → tek faturada otomatik'],
            ['💰', 'Tahsilat', 'Ödeme girilir, açık faturadan düşülür, makbuz çıkar'],
          ].map(([i, t, d]) => (
            <div key={t} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <span style={{ fontSize: '1.1rem' }}>{i}</span>
              <span><b>{t}</b> <span style={{ color: '#64748b' }}>— {d}</span></span>
            </div>
          ))}
        </div>
      </>
    ),
  },
  {
    title: 'Günlük kullanım (tipik gün) 📅',
    body: (
      <>
        <ol style={{ margin: 0, paddingLeft: '1.1rem', display: 'grid', gap: '0.45rem', color: '#334155' }}>
          <li>Yeni müşteri/cihaz geldiyse <b>kaydedin</b>.</li>
          <li>Arıza gelince <b>Servis Fişi</b> açın; kullanılan parçaları ekleyin (<b>barkod okuyucuyla okutabilirsiniz</b>).</li>
          <li>İş bitince fişi <b>“Teslim Edildi”</b> yapın.</li>
          <li>Ay sonunda <b>“Bu Dönemi Faturala”</b> — sayaç, kira ve servis tek tıkla faturalanır.</li>
          <li>Para gelince <b>Tahsilat</b> girin; makbuzu yazdırıp müşteriye verin.</li>
        </ol>
      </>
    ),
  },
  {
    title: 'İşinizi kolaylaştıran özellikler ⚡',
    body: (
      <>
        <div style={{ display: 'grid', gap: '0.55rem', color: '#334155' }}>
          <div>📷 <b>Barkod okuyucu:</b> Parçayı okutunca otomatik bulunur/fişe eklenir (USB barkod okuyucu — 1D/2D).</div>
          <div>🖨️ <b>Yazdır / PDF:</b> Fatura ve tahsilat makbuzunu profesyonel görünümde yazdırabilirsiniz.</div>
          <div>🔄 <b>Otomatik faturalama:</b> Sayaç + kira + servis ay sonunda tek faturada birleşir.</div>
          <div>💸 <b>Akıllı tahsilat:</b> Ödeme en eski açık faturadan otomatik düşülür (FIFO), elle hesap yok.</div>
        </div>
      </>
    ),
  },
  {
    title: 'Hazırsınız! 🚀',
    body: (
      <>
        <p style={{ margin: '0 0 0.75rem' }}>
          İlk işiniz: <b>ilk müşterinizi eklemek</b>. Aşağıdaki butona basın, ya da istediğiniz zaman sağ alttaki
          <b> “Başlangıç Rehberi”</b>nden devam edin — orada 6 adımın hepsi yazılı.
        </p>
        <p style={{ margin: 0, color: '#64748b', fontSize: '0.85rem' }}>
          Bu rehbere bir daha ihtiyacınız olmaz; sistem her adımı sizin yerinize takip eder.
        </p>
      </>
    ),
  },
];

export default function Onboarding() {
  const { status: authStatus } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const [data, setData] = useState<Status | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [panelOpen, setPanelOpen] = useState(false);
  const [hidden, setHidden] = useState(true); // localStorage okunana kadar gizli (flash önlenir)

  // Yazdırma/PDF sayfalarinda onboarding ASLA gorunmemeli (fatura/makbuz belgesine dusmesin)
  const isPrintPage = (pathname || '').includes('/print');

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/onboarding/status');
      if (!r.ok) return;
      const d: Status = await r.json();
      setData(d);
      if (!d.onboarded) setShowWizard(true);
    } catch (e) { console.error('Onboarding durum cekme hatasi:', e); }
  }, []);

  // Giriş yapılınca durum çek + localStorage gizleme tercihi
  useEffect(() => {
    if (authStatus !== 'authenticated' || isPrintPage) return;
    try { setHidden(localStorage.getItem(HIDE_KEY) === '1'); } catch { setHidden(false); }
    fetchStatus();
  }, [authStatus, fetchStatus, isPrintPage]);

  // Sayfa değişiminde checklist'i tazele (adımlar tamamlandıkça otomatik tiklenir; yazdırma sayfasında çekme)
  useEffect(() => {
    if (authStatus === 'authenticated' && !isPrintPage) fetchStatus();
  }, [pathname, authStatus, fetchStatus, isPrintPage]);

  if (authStatus !== 'authenticated' || !data || isPrintPage) return null;

  const steps = data.steps;
  const doneCount = CHECKLIST.filter((c) => steps[c.key]).length;
  const total = CHECKLIST.length;
  const allDone = doneCount === total;

  const finishWizard = async () => {
    setShowWizard(false);
    setPanelOpen(true); // sihirbaz biter bitmez rehberi aç
    try { await fetch('/api/onboarding/dismiss', { method: 'POST' }); } catch { /* yoksay */ }
    setData((d) => (d ? { ...d, onboarded: true } : d));
  };

  const go = (href: string) => { setPanelOpen(false); router.push(href); };

  const hideChecklist = () => {
    setHidden(true);
    setPanelOpen(false);
    try { localStorage.setItem(HIDE_KEY, '1'); } catch { /* yoksay */ }
  };

  return (
    <>
      {/* ═══════════ HOŞ GELDİN SİHİRBAZI ═══════════ */}
      {showWizard && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'white', borderRadius: '1rem', width: '100%', maxWidth: '560px', boxShadow: '0 25px 70px rgba(0,0,0,0.35)', overflow: 'hidden' }}>
            {/* İlerleme çubuğu */}
            <div style={{ height: '5px', background: '#e2e8f0' }}>
              <div style={{ height: '100%', width: `${((step + 1) / WIZARD.length) * 100}%`, background: 'linear-gradient(90deg,#2563eb,#06b6d4)', transition: 'width .3s ease' }} />
            </div>
            {/* Başlık */}
            <div style={{ background: 'linear-gradient(135deg,#0f2253,#2563eb)', color: 'white', padding: '1.1rem 1.4rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.7rem', opacity: 0.8, letterSpacing: '0.08em', fontWeight: 700 }}>ADIM {step + 1}/{WIZARD.length}</div>
                <h2 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', fontWeight: 800 }}>{WIZARD[step].title}</h2>
              </div>
              <button onClick={finishWizard} title="Şimdilik geç" style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 30, height: 30, borderRadius: 8, cursor: 'pointer', fontSize: '1rem' }}>✕</button>
            </div>
            {/* İçerik */}
            <div style={{ padding: '1.4rem', fontSize: '0.95rem', lineHeight: 1.55, color: '#1e293b', minHeight: '180px' }}>
              {WIZARD[step].body}
            </div>
            {/* Alt */}
            <div style={{ padding: '0.9rem 1.4rem', borderTop: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem' }}>
              <button onClick={finishWizard} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Şimdilik geç</button>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {step > 0 && (
                  <button onClick={() => setStep((s) => s - 1)} style={{ padding: '0.55rem 1rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#334155' }}>← Geri</button>
                )}
                {step < WIZARD.length - 1 ? (
                  <button onClick={() => setStep((s) => s + 1)} style={{ padding: '0.55rem 1.2rem', background: '#2563eb', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, color: 'white' }}>İleri →</button>
                ) : (
                  <button onClick={async () => { await finishWizard(); router.push('/customers'); }} style={{ padding: '0.55rem 1.2rem', background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, color: 'white' }}>İlk müşterimi ekle →</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ YÜZEN BAŞLANGIÇ REHBERİ ═══════════ */}
      {!hidden && !showWizard && (
        <div style={{ position: 'fixed', right: '1.25rem', bottom: '1.25rem', zIndex: 1500, fontFamily: 'inherit' }}>
          {/* Panel */}
          {panelOpen && (
            <div style={{ width: '360px', maxWidth: 'calc(100vw - 2.5rem)', background: 'white', borderRadius: '0.9rem', boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '0.75rem' }}>
              <div style={{ background: 'linear-gradient(135deg,#0f2253,#2563eb)', color: 'white', padding: '1rem 1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>🚀 Başlangıç Rehberi</h3>
                  <button onClick={() => setPanelOpen(false)} style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 26, height: 26, borderRadius: 7, cursor: 'pointer' }}>✕</button>
                </div>
                <p style={{ margin: '0.35rem 0 0.6rem', fontSize: '0.8rem', opacity: 0.85 }}>
                  {allDone ? 'Tebrikler, hepsini tamamladınız! 🎉' : `${doneCount}/${total} adım tamamlandı — sırayla ilerleyin`}
                </p>
                <div style={{ height: '6px', background: 'rgba(255,255,255,0.25)', borderRadius: 99 }}>
                  <div style={{ height: '100%', width: `${(doneCount / total) * 100}%`, background: '#34d399', borderRadius: 99, transition: 'width .3s ease' }} />
                </div>
              </div>
              <div style={{ maxHeight: '52vh', overflowY: 'auto', padding: '0.5rem' }}>
                {CHECKLIST.map((c) => {
                  const done = steps[c.key];
                  return (
                    <div key={c.key} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.6rem', borderRadius: 10, alignItems: 'flex-start', background: done ? '#f0fdf4' : 'transparent' }}>
                      <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, marginTop: 2, background: done ? '#16a34a' : '#e2e8f0', color: done ? 'white' : '#94a3b8' }}>
                        {done ? '✓' : c.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: done ? '#15803d' : '#1e293b', textDecoration: done ? 'line-through' : 'none' }}>{c.title}</div>
                        {!done && <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{c.desc}</div>}
                        {!done && (
                          <button onClick={() => go(c.href)} style={{ marginTop: 6, padding: '0.3rem 0.7rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 7, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>{c.cta} →</button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ padding: '0.6rem 0.9rem', borderTop: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setShowWizard(true)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>↺ Tanıtımı tekrar izle</button>
                <button onClick={hideChecklist} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Rehberi gizle</button>
              </div>
            </div>
          )}

          {/* Yüzen buton */}
          <button
            onClick={() => setPanelOpen((o) => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto',
              padding: '0.7rem 1.1rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: allDone ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#0f2253,#2563eb)',
              color: 'white', fontWeight: 800, fontSize: '0.875rem', boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
            }}
          >
            <span style={{ fontSize: '1.05rem' }}>🚀</span>
            Başlangıç Rehberi
            <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 999, padding: '0.05rem 0.5rem', fontSize: '0.78rem', fontWeight: 800 }}>
              {allDone ? '✓' : `${doneCount}/${total}`}
            </span>
          </button>
        </div>
      )}
    </>
  );
}
