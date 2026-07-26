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
const HINT_KEY = 'gs_guide_hint_seen_v1'; // rehber işareti bir kez gösterilir

const CHECKLIST: { key: keyof Steps; title: string; desc: string; href: string; cta: string; icon: string; how: string[] }[] = [
  {
    key: 'hasCustomers', icon: '👤', title: '1. Müşterilerini sisteme al',
    desc: 'Elinde Excel listesi varsa tek seferde aktar; yoksa tek tek ekle.',
    href: '/import', cta: 'Excel’den aktar',
    how: [
      'HIZLI YOL — Excel listen varsa: Gelişmiş → Veri Aktarma → "Excel / CSV listesi".',
      'Excel’de: Dosya → Farklı Kaydet → "CSV UTF-8". Dosyayı seç; kolonları sistem kendi tanır.',
      'Önizlemede ilk satırları kontrol et → "Aktar". Müşteri + cihaz birlikte gelir.',
      'TEK TEK: Müşteriler → "＋ Yeni Müşteri" → ad ve telefon zorunlu → Kaydet.',
    ],
  },
  {
    key: 'hasDevices', icon: '🖨️', title: '2. Cihazları tanımla',
    desc: 'Müşterinin yazıcısını ekle. Kiralıksa sayaç ve aylık kira buradan işler.',
    href: '/devices', cta: 'Cihazlar',
    how: [
      'Müşteri detayı veya Cihazlar → "＋ Yeni Cihaz". Marka/model/seri no gir.',
      'Kiralıksa "Kiralık" işaretle → aylık kira + sayfa fiyatı (pakete dahil sayfa varsa onu da yaz).',
      'KONUM (kat/oda) yaz — sayaç turu ve cihaz dökümü bu sıraya göre dizilir, saha işini kolaylaştırır.',
      'Kaydet → cihaza otomatik QR üretilir; etiketi basıp makineye yapıştırabilirsin.',
    ],
  },
  {
    key: 'hasInventory', icon: '📦', title: '3. Stoğuna parça ekle',
    desc: 'Toner, drum, yedek parça gir. Barkodu varsa okuyucuyla okutarak hızlıca bulabilirsin.',
    href: '/inventory', cta: 'Stok',
    how: [
      'Stok → parça ekle (ad, adet, alış/satış fiyatı).',
      'Barkodu varsa "Barkod" alanına okuyucuyla okut; yoksa "🏷️ Etiket Yazdır".',
      '"📦 Hızlı Giriş/Çıkış" ile mal gelince (+), kullanınca (−) arka arkaya okut.',
    ],
  },
  {
    key: 'hasTickets', icon: '🧾', title: '4. İlk servis fişini aç',
    desc: 'Arıza/bakım geldiğinde fiş oluştur, kullanılan parçaları ekle (barkodla okutabilirsin), işçilik gir.',
    href: '/tickets/new', cta: 'Yeni Fiş',
    how: [
      'Yeni Fiş → müşteri + cihaz seç (ya da cihaz barkodunu okut, otomatik gelsin).',
      'Arızayı yaz; parçayı okut → fişe eklenir ve stoktan düşer.',
      'Durum: Yeni → Serviste → Hazır → Teslim; her değişimde WhatsApp bildirimi önerilir.',
    ],
  },
  {
    key: 'hasInvoices', icon: '📄', title: '5. Sayaçları oku ve faturala',
    desc: 'Ayda bir: sayaçları topluca oku, sonra tek tıkla faturala.',
    href: '/sayac-turu', cta: 'Sayaç Turu',
    how: [
      'ÖNCE SAYAÇ: Sol menü → Sayaç Turu → müşteriyi seç → tüm cihazlar tek listede çıkar, sadece yeni rakamı yaz → Kaydet.',
      'SONRA FATURA: Gelişmiş → Faturalar → "⚡ Bu Dönemi Faturala".',
      'Sistem "şu cihazların sayacı okunmadı" diye uyarır — eksik fatura gitmesin diye.',
      'Sayaç + kira + servis tek faturada birleşir; arkasına sayaç dökümü otomatik eklenir.',
      'Faturaya tıkla → "🖨 Yazdır" veya "📱 WhatsApp" ile müşteriye gönder.',
    ],
  },
  {
    key: 'hasCollections', icon: '💰', title: '6. Tahsilatını al ve borcu takip et',
    desc: 'Para geldiğinde gir; borç kendiliğinden düşer. Ödemeyenlere toplu hatırlatma gönder.',
    href: '/accounting', cta: 'Muhasebe',
    how: [
      'Muhasebe → müşteri seç → tahsilatı gir. Borç kendiliğinden düşer, elle hesap yok.',
      'Makbuz gerekiyorsa Gelişmiş → Tahsilat ekranından "🧾 Makbuz Yazdır".',
      'BORÇ HATIRLATMA: Muhasebe → "📩 Toplu Hatırlatma" → borçluları seç → SMS ile topluca gönder.',
      'Müşteri ekstresi: müşteri detayında "Yazdır" — tüm hareketler + bakiye tek sayfada.',
    ],
  },
];

// 3 EKRAN — hedef: sistemi 2 DAKİKADAN kısa sürede kavratmak.
// Ayrıntı burada DEĞİL: "Nasıl Kullanılır?" sayfasında. Burada yalnız çalışma mantığı var.
const WIZARD: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Sistem tek bir zincir',
    body: (
      <>
        <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '0.9rem' }}>
          {[
            ['👤', 'Müşteri', 'kime hizmet veriyorsun'],
            ['🖨️', 'Cihaz', 'onun yazıcısı (kiralıksa sayaç + kira)'],
            ['🧾', 'Servis Fişi', 'yapılan iş + parça'],
            ['💰', 'Para', 'fatura ve tahsilat otomatik işler'],
          ].map(([i, t, d], idx, arr) => (
            <div key={t as string}>
              <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center' }}>
                <span style={{ fontSize: '1.3rem', width: 28, textAlign: 'center' }}>{i}</span>
                <span style={{ fontSize: '0.95rem' }}><b>{t}</b> <span style={{ color: '#64748b' }}>— {d}</span></span>
              </div>
              {idx < arr.length - 1 && (
                <div style={{ marginLeft: 13, height: 12, borderLeft: '2px solid #cbd5e1' }} />
              )}
            </div>
          ))}
        </div>
        <p style={{ margin: 0, color: '#475569', fontSize: '0.9rem' }}>
          Hepsi bu. Müşteriyi ve cihazı bir kere kaydedersin; gerisi her fişte kendiliğinden bağlanır.
        </p>
      </>
    ),
  },
  {
    title: 'Günde yaptığın 3 şey',
    body: (
      <>
        <div style={{ display: 'grid', gap: '0.7rem' }}>
          {[
            ['🧾', 'Arıza gelince', 'Yeni Fiş aç — parçayı barkoddan okut, işi yaz, teslim et.'],
            ['🔢', 'Ayda bir', 'Sayaç Turu — müşteriyi seç, tüm cihazların sayacını tek listede gir.'],
            ['💰', 'Para gelince', 'Muhasebe — tahsilatı gir, borç kendiliğinden düşer.'],
          ].map(([i, t, d]) => (
            <div key={t as string} style={{ display: 'flex', gap: '0.7rem', alignItems: 'flex-start', background: '#f8fafc', borderRadius: 10, padding: '0.7rem 0.8rem' }}>
              <span style={{ fontSize: '1.2rem' }}>{i}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>{t}</div>
                <div style={{ fontSize: '0.85rem', color: '#475569', marginTop: 2, lineHeight: 1.5 }}>{d}</div>
              </div>
            </div>
          ))}
        </div>
        <p style={{ margin: '0.9rem 0 0', color: '#475569', fontSize: '0.88rem' }}>
          Fatura, cari hesap ve borç takibini <b>sistem kendi yapar</b> — sen girmezsin.
        </p>
      </>
    ),
  },
  {
    title: 'Hazırsın',
    body: (
      <>
        <p style={{ margin: '0 0 0.8rem', fontSize: '0.95rem' }}>
          İlk iş: <b>müşterilerini sisteme al.</b> Elinde Excel listesi varsa tek seferde aktarabilirsin.
        </p>
        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, padding: '0.75rem 0.9rem', fontSize: '0.86rem', color: '#075985', lineHeight: 1.6 }}>
          Takıldığın an sol menüde <b>“Nasıl Kullanılır?”</b> var — her ekranın ne işe yaradığı orada yazılı.
          Sağ alttaki <b>rehber</b> de ilk kurulumda sana adım adım eşlik eder.
        </div>
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
  const [showHint, setShowHint] = useState(false);
  const [openHow, setOpenHow] = useState<string | null>(null); // checklist'te açık "nasıl yapılır?"
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
    // Panel OTOMATİK AÇILMAZ (ekranı kaplamasın) — bunun yerine butonun yanında tek seferlik
    // küçük bir işaret çıkar; kullanıcı rehberi kaçırmasın ama ekranı da kapatmasın.
    try {
      if (!localStorage.getItem(HINT_KEY)) setShowHint(true);
    } catch { /* yoksay */ }
    try { await fetch('/api/onboarding/dismiss', { method: 'POST' }); } catch { /* yoksay */ }
    setData((d) => (d ? { ...d, onboarded: true } : d));
  };

  const dismissHint = () => {
    setShowHint(false);
    try { localStorage.setItem(HINT_KEY, '1'); } catch { /* yoksay */ }
  };

  const go = (href: string) => { setPanelOpen(false); router.push(href); };

  const hideChecklist = () => {
    setHidden(true);
    setPanelOpen(false);
    try { localStorage.setItem(HIDE_KEY, '1'); } catch { /* yoksay */ }
  };

  return (
    <>
      {/* Yazdırma sırasında onboarding ASLA görünmesin (etiket/fatura vb. baskısına binmesin) */}
      <style>{`
        @media print { .gs-noprint { display: none !important; } }
        /* Yüzen rehber butonu — MASAÜSTÜ */
        .gs-fab { position: fixed; right: 1.25rem; bottom: 1.25rem; z-index: 1500; }
        /* MOBİL: alt sekme çubuğunun ÜSTÜNE al (çakışmasın) ve küçült — yer kaplamasın */
        @media (max-width: 767px) {
          .gs-fab { right: .8rem; bottom: calc(5rem + env(safe-area-inset-bottom)); }
          .gs-fab-text { display: none; }
          .gs-fab-btn { padding: .6rem .8rem !important; }
          .gs-panel { max-height: 62vh !important; }
        }
      `}</style>

      {/* ═══════════ HOŞ GELDİN SİHİRBAZI ═══════════ */}
      {showWizard && (
        <div className="gs-noprint" style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(15,23,42,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
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
                  <>
                    <button onClick={async () => { await finishWizard(); router.push('/import'); }} style={{ padding: '0.55rem 0.9rem', background: 'white', border: '1px solid #cbd5e1', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, color: '#334155' }}>Excel'den aktar</button>
                    <button onClick={async () => { await finishWizard(); router.push('/customers/new'); }} style={{ padding: '0.55rem 1.2rem', background: 'linear-gradient(135deg,#059669,#10b981)', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: '0.875rem', fontWeight: 700, color: 'white' }}>Müşteri ekle →</button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ YÜZEN BAŞLANGIÇ REHBERİ ═══════════ */}
      {!hidden && !showWizard && (
        <div className="gs-noprint gs-fab" style={{ fontFamily: 'inherit' }}>
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
              <div className="gs-panel" style={{ maxHeight: '52vh', overflowY: 'auto', padding: '0.5rem' }}>
                {CHECKLIST.map((c) => {
                  const done = steps[c.key];
                  const howOpen = openHow === c.key;
                  return (
                    <div key={c.key} style={{ display: 'flex', gap: '0.6rem', padding: '0.65rem 0.6rem', borderRadius: 10, alignItems: 'flex-start', background: done ? '#f0fdf4' : 'transparent' }}>
                      <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 800, marginTop: 2, background: done ? '#16a34a' : '#e2e8f0', color: done ? 'white' : '#94a3b8' }}>
                        {done ? '✓' : c.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: done ? '#15803d' : '#1e293b', textDecoration: done ? 'line-through' : 'none' }}>{c.title}</div>
                        {!done && <div style={{ fontSize: '0.76rem', color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>{c.desc}</div>}
                        {!done && (
                          <div style={{ marginTop: 6, display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button onClick={() => go(c.href)} style={{ padding: '0.3rem 0.7rem', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', borderRadius: 7, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>{c.cta} →</button>
                            <button onClick={() => setOpenHow(howOpen ? null : c.key)} style={{ padding: '0.3rem 0.6rem', background: 'transparent', color: '#64748b', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>
                              {howOpen ? '▲ Gizle' : '❓ Nasıl yapılır?'}
                            </button>
                          </div>
                        )}
                        {!done && howOpen && (
                          <ol style={{ margin: '0.5rem 0 0', paddingLeft: '1.05rem', display: 'grid', gap: '0.3rem' }}>
                            {c.how.map((h, i) => (
                              <li key={i} style={{ fontSize: '0.75rem', color: '#475569', lineHeight: 1.45 }}>{h}</li>
                            ))}
                          </ol>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button onClick={() => go('/yardim')} style={{ width: '100%', padding: '0.6rem 0.9rem', background: '#f8fafc', border: 'none', borderTop: '1px solid #eef2f7', color: '#0f2253', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700, textAlign: 'left' }}>
                📘 Ayrıntılı kullanım kılavuzu — “Nasıl Kullanılır?” →
              </button>
              <div style={{ padding: '0.6rem 0.9rem', borderTop: '1px solid #eef2f7', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button onClick={() => setShowWizard(true)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>↺ Tanıtımı tekrar izle</button>
                <button onClick={hideChecklist} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Rehberi gizle</button>
              </div>
            </div>
          )}

          {/* Yüzen buton */}
          {/* Tek seferlik işaret — rehberi kaçırmasınlar */}
          {showHint && !panelOpen && (
            <div onClick={() => { dismissHint(); setPanelOpen(true); }}
              style={{
                marginBottom: '0.6rem', marginLeft: 'auto', maxWidth: 250, cursor: 'pointer',
                background: '#0f172a', color: 'white', borderRadius: 12, padding: '0.7rem 0.85rem',
                boxShadow: '0 12px 30px rgba(15,23,42,.35)', fontSize: '0.82rem', lineHeight: 1.5,
              }}>
              <b>Ne yapacağını buradan takip et 👇</b>
              <div style={{ opacity: 0.85, marginTop: 2 }}>
                {total} adım — her adımda “nasıl yapılır?” yazılı.
              </div>
              <button onClick={(e) => { e.stopPropagation(); dismissHint(); }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.6)', fontSize: '0.75rem', cursor: 'pointer', padding: '4px 0 0', fontWeight: 600 }}>
                Tamam, anladım
              </button>
            </div>
          )}

          <button
            onClick={() => { setPanelOpen((o) => !o); dismissHint(); }}
            className="gs-fab-btn"
            title="Başlangıç Rehberi"
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto',
              padding: '0.7rem 1.1rem', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: allDone ? 'linear-gradient(135deg,#059669,#10b981)' : 'linear-gradient(135deg,#0f2253,#2563eb)',
              color: 'white', fontWeight: 800, fontSize: '0.875rem', boxShadow: '0 8px 24px rgba(37,99,235,0.4)',
            }}
          >
            <span style={{ fontSize: '1.05rem' }}>🚀</span>
            <span className="gs-fab-text">Başlangıç Rehberi</span>
            <span style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 999, padding: '0.05rem 0.5rem', fontSize: '0.78rem', fontWeight: 800 }}>
              {allDone ? '✓' : `${doneCount}/${total}`}
            </span>
          </button>
        </div>
      )}
    </>
  );
}
