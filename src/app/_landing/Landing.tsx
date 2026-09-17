import Script from "next/script";
import { LANDING_CSS } from "./landing-stil";

// ⚙️ OTOMATİK ÜRETİLDİ — elle düzenlemeyin! Kaynak: marketing/landing/nextus-servis.html
// Yeniden üret:  node marketing/landing/build-landing.js
// JS bilerek string olarak tutulur (next/script ile çalışır) → tsc/eslint denetlemez,
// böylece "next build" TS hatasıyla kırılmaz.
const BODY = `

<!-- Scroll progress bar -->
<div class="scroll-progress" id="scrollProgress" aria-hidden="true"></div>

<!-- Global grain texture overlay -->
<div class="grain-overlay" aria-hidden="true"></div>

<!-- ========== NAVIGATION ========== -->
<nav class="nav" id="nav">
  <div class="nav-inner">
    <a href="#" class="logo">
      <span class="logo-mark"><svg class="logo-n" viewBox="0 0 230 200" aria-hidden="true"><g class="nx-body"><rect x="30" y="20" width="38" height="160"/><polygon points="68,20 106,20 150,180 112,180"/><rect x="150" y="20" width="38" height="160"/></g><path class="nx-cut" d="M14 154 C84 120 152 78 224 34" pathLength="100"/></svg></span>
      <span>Nextus Servis</span>
    </a>
    <ul class="nav-links">
      <li><a href="#urun" class="nav-link">Ürün</a></li>
      <li><a href="#hesap" class="nav-link">Kaçan Gelir Hesabı</a></li>
      <li><a href="#ozellikler" class="nav-link">Özellikler</a></li>
      <li><a href="#nasil" class="nav-link">Nasıl Çalışır</a></li>
      <li><a href="#fiyatlandirma" class="nav-link">Fiyatlar</a></li>
      <li><a href="#sss" class="nav-link">SSS</a></li>
    </ul>
    <div class="nav-cta">
      <!-- Genel "Demoyu Dene" butonu BİLEREK YOK.
           Bu ürünün gücü bayinin KENDİ verisinde (kaç sayaç okunmamış, ne kadar
           faturalanmamış). Uydurma veriyle tek başına gezen biri bunu göremez,
           sayaç-kira mantığını yanlış anlayıp kapatır ve bir daha dönmez.
           Demo hesabı DURUYOR (/login?demo=1 bilgileri doldurur) ama sahada,
           kurucunun yönettiği bir gösterim için. Buradaki yol WhatsApp: bir
           konuşma başlar, gösterimi kurucu yönetir, talep de kaybolmaz. -->
      <a href="/en" class="btn btn-ghost btn-sm dil-sec" hreflang="en" lang="en" aria-label="Switch to English">EN</a>
      <a href="#hesap" class="btn btn-ghost btn-sm">Hesapla</a>
      <a href="https://wa.me/905526961703?text=Merhaba%2C%20Nextus%20Servis%20demosu%20ve%20fiyat%20bilgisi%20istiyorum" target="_blank" rel="noopener" class="btn btn-primary btn-sm"><span class="nav-cta-long">WhatsApp'tan&nbsp;</span>Demo →</a>
      <button class="menu-btn" id="menuBtn" aria-label="Menü" aria-expanded="false" aria-controls="mobileMenu"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu" role="dialog" aria-modal="true" aria-label="Menü">
  <a href="#urun" class="nav-link-m">Ürün</a>
  <a href="#hesap" class="nav-link-m">Kaçan Gelir Hesabı</a>
  <a href="#ozellikler" class="nav-link-m">Özellikler</a>
  <a href="#nasil" class="nav-link-m">Nasıl Çalışır</a>
  <a href="#fiyatlandirma" class="nav-link-m">Fiyatlar</a>
  <a href="#sss" class="nav-link-m">SSS</a>
  <a href="/en" class="nav-link-m" hreflang="en" lang="en">English</a>
</div>

<!-- ========== HERO ========== -->
<section class="hero">
  <div class="hero-bg">
    <canvas id="particles" aria-hidden="true"></canvas>
    <div class="blob blob-1"></div>
    <div class="blob blob-2"></div>
    <div class="blob blob-3"></div>
    <div class="hero-glow"></div>
    <div class="hero-grid-bg"></div>
  </div>
  <div class="hero-grad-line"></div>

  <div class="hero-inner">
    <div class="hero-badge">
      <span class="pulse"></span>
      <span class="hb-label">B2B</span>
      <span class="hb-sep"></span>
      <span>🖨 Yazıcı · fotokopi · ofis cihazı kiralama ve servis bayileri için</span>
    </div>

    <a href="https://wa.me/905526961703?text=Merhaba%2C%20Nextus%20Servis%20canli%20demo%20istiyorum" target="_blank" rel="noopener" class="hero-demo-pill">
      <span class="hdp-play">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true" focusable="false"><polygon points="6,4 20,12 6,20"/></svg>
      </span>
      <span class="hdp-text">Ekranı paylaşarak 15 dakikalık canlı demo</span>
      <span class="hdp-arrow">→</span>
    </a>

    <h1 class="hero-title">
      Sayacı okuyun,
      <span class="gradient-text">faturayı sistem kessin</span>
      <span class="line-2" style="font-size:.56em;margin-top:12px;letter-spacing:-0.02em;color:#d4d4dc;font-weight:700">
        kaçan gelir
        <span class="hero-rotator" aria-hidden="true"><span class="hero-rotator-spacer">tahsil edilsin</span><span class="hero-rotator-word active">görünsün</span><span class="hero-rotator-word">tahsil edilsin</span></span>
        <span class="sr-only">görünsün ve tahsil edilsin</span>
      </span>
    </h1>

    <p class="hero-sub">
      Kiralık cihazlarınızın sayacı okunmazsa o ay <strong>hiç faturalanmıyor</strong>. Nextus Servis; sayaç turunu, dahil hacim + aşım hesabını, servis fişini, barkodlu stoğu ve tahsilat takibini tek programda toplar — ay sonu icmali tek tuşa iner.
    </p>

    <div class="hero-ctas">
      <a href="https://wa.me/905526961703?text=Merhaba%2C%20Nextus%20Servis%20icin%2014%20gunluk%20denemeyi%20baslatmak%20istiyorum" target="_blank" rel="noopener" class="btn btn-grad">14 Gün Ücretsiz Dene <span style="font-size:18px;line-height:1">→</span></a>
      <a href="#hesap" class="btn btn-ghost">Kaçan gelirimi hesapla</a>
    </div>

    <div class="hero-meta">
      <span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><polyline points="3,8 7,12 13,4"/></svg> Kredi kartı istenmez</span>
      <span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><polyline points="3,8 7,12 13,4"/></svg> Kurulum + Excel aktarımı + 2 saat eğitim ücretsiz</span>
      <span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><polyline points="3,8 7,12 13,4"/></svg> Taahhüt yok</span>
    </div>
  </div>

  <!-- PANEL MOCKUP -->
  <div class="hero-mockup-wrap">
    <div class="float-tag t1"><span class="tag-ico">📟</span><span>Sayaç → fatura</span></div>
    <div class="float-tag t2"><span class="tag-ico">📉</span><span>Kaçan Gelir paneli</span></div>
    <div class="float-tag t3"><span class="tag-ico">🏷</span><span>Barkodlu stok</span></div>

    <div class="hero-toast">
      <div class="hero-toast-ico">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false">
          <path d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <div class="hero-toast-body">
        <div class="hero-toast-title">Sayaç girildi</div>
        <div class="hero-toast-meta">Canon iR-ADV C3826 • S/B 48.210 • Renkli 6.940</div>
      </div>
      <div class="hero-toast-amt">Fatura hazır</div>
    </div>

    <div class="hero-mockup">
      <div class="mockup-titlebar">
        <span class="dot-r r"></span><span class="dot-r y"></span><span class="dot-r g"></span>
        <div class="titlebar-url">Nextus Servis · Bayi Paneli</div>
        <span class="mock-sample-badge">örnek ekran</span>
        <div class="titlebar-actions"><span></span><span></span><span></span></div>
      </div>
      <div class="dash">
        <aside class="dash-side">
          <div class="dash-side-logo"><span class="lm"></span><span>Nextus Servis</span></div>
          <div class="dash-side-section">Genel</div>
          <div class="dash-nav-item active">
            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span>Panel</span>
          </div>
          <div class="dash-nav-item">
            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>
            <span>Müşteriler</span>
          </div>
          <div class="dash-side-section">Operasyon</div>
          <div class="dash-nav-item">
            <span class="ico">🖨</span><span>Cihazlar</span>
            <span class="dash-nav-badge">142</span>
          </div>
          <div class="dash-nav-item">
            <span class="ico">🎫</span><span>Servis Fişleri</span>
            <span class="dash-nav-badge">12</span>
          </div>
          <div class="dash-nav-item">
            <span class="ico">📟</span><span>Sayaç Turu</span>
            <span class="dash-nav-badge">7</span>
          </div>
          <div class="dash-nav-item">
            <span class="ico">🏷</span><span>Stok & Barkod</span>
          </div>
          <div class="dash-side-section">Para</div>
          <div class="dash-nav-item">
            <span class="ico">🧾</span><span>Faturalar</span>
          </div>
          <div class="dash-nav-item">
            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M3 3h18v18H3z"/><path d="M9 9h6v6H9z"/></svg>
            <span>Raporlar</span>
          </div>
          <div class="dash-nav-item">
            <span class="ico">🔁</span><span>Bayi Pazarı</span>
          </div>
        </aside>

        <div class="dash-main">
          <div class="dash-topbar">
            <div>
              <div class="mock-h">Ay Sonu Kapanışı <span class="pill"><span style="width:6px;height:6px;border-radius:50%;background:#10b981;display:inline-block"></span>Hazır</span></div>
            </div>
            <div class="dash-topbar-right">
              <span class="ico-btn">🔔</span>
              <span class="ico-btn">⚡</span>
              <span class="dash-avatar">MB</span>
            </div>
          </div>

          <div class="dash-stats">
            <div class="stat-card s1">
              <div class="label">Kiralık Cihaz</div>
              <div class="val">142</div>
              <div class="trend">↑ 6 yeni sözleşme</div>
              <svg class="spark" viewBox="0 0 80 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <defs><linearGradient id="sp1" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#f97316" stop-opacity=".5"/><stop offset="100%" stop-color="#f97316" stop-opacity="0"/></linearGradient></defs>
                <path d="M0,22 L10,18 L20,20 L30,14 L40,16 L50,10 L60,12 L70,6 L80,8 L80,28 L0,28 Z" fill="url(#sp1)"/>
                <path d="M0,22 L10,18 L20,20 L30,14 L40,16 L50,10 L60,12 L70,6 L80,8" fill="none" stroke="#f97316" stroke-width="1.5"/>
              </svg>
            </div>
            <div class="stat-card s2">
              <div class="label">Açık Servis Fişi</div>
              <div class="val">12</div>
              <div class="trend" style="color:#f59e0b">3 tanesi bugün açıldı</div>
              <svg class="spark" viewBox="0 0 80 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <defs><linearGradient id="sp2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#14b8a6" stop-opacity=".5"/><stop offset="100%" stop-color="#14b8a6" stop-opacity="0"/></linearGradient></defs>
                <path d="M0,8 L10,12 L20,10 L30,16 L40,14 L50,18 L60,15 L70,20 L80,17 L80,28 L0,28 Z" fill="url(#sp2)"/>
                <path d="M0,8 L10,12 L20,10 L30,16 L40,14 L50,18 L60,15 L70,20 L80,17" fill="none" stroke="#14b8a6" stroke-width="1.5"/>
              </svg>
            </div>
            <div class="stat-card s3">
              <div class="label">Sayacı Okunmamış</div>
              <div class="val">7</div>
              <div class="trend" style="color:#f59e0b">↓ faturalanmayı bekliyor</div>
              <svg class="spark" viewBox="0 0 80 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <defs><linearGradient id="sp3" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#a855f7" stop-opacity=".5"/><stop offset="100%" stop-color="#a855f7" stop-opacity="0"/></linearGradient></defs>
                <path d="M0,18 L10,15 L20,17 L30,12 L40,14 L50,9 L60,11 L70,7 L80,4 L80,28 L0,28 Z" fill="url(#sp3)"/>
                <path d="M0,18 L10,15 L20,17 L30,12 L40,14 L50,9 L60,11 L70,7 L80,4" fill="none" stroke="#a855f7" stroke-width="1.5"/>
              </svg>
            </div>
          </div>

          <div class="dash-row">
            <div class="dash-chart">
              <div class="dash-chart-head">
                <div>
                  <span class="t">Faturalanan tutar (son 30 gün)</span>
                  <span class="dash-chart-total">Kira + servis + sarf</span>
                </div>
                <div class="leg">
                  <span><i style="background:#f97316"></i>Kira</span>
                  <span><i style="background:#14b8a6"></i>Servis</span>
                  <span><i style="background:#a855f7"></i>Sarf</span>
                </div>
              </div>
              <svg class="dash-chart-svg" viewBox="0 0 500 180" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <defs>
                  <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#f97316" stop-opacity=".42"/>
                    <stop offset="100%" stop-color="#f97316" stop-opacity="0"/>
                  </linearGradient>
                  <linearGradient id="g2" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#14b8a6" stop-opacity=".32"/>
                    <stop offset="100%" stop-color="#14b8a6" stop-opacity="0"/>
                  </linearGradient>
                  <linearGradient id="g3" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#a855f7" stop-opacity=".28"/>
                    <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
                  </linearGradient>
                </defs>
                <g stroke="rgba(255,255,255,0.04)" stroke-width="1">
                  <line x1="0" y1="40" x2="500" y2="40"/>
                  <line x1="0" y1="80" x2="500" y2="80"/>
                  <line x1="0" y1="120" x2="500" y2="120"/>
                </g>
                <path d="M0,150 C50,145 90,148 130,138 C170,130 210,135 250,125 C290,118 330,120 370,110 C410,102 450,105 500,95 L500,160 L0,160 Z" fill="url(#g3)"/>
                <path d="M0,150 C50,145 90,148 130,138 C170,130 210,135 250,125 C290,118 330,120 370,110 C410,102 450,105 500,95" fill="none" stroke="#a855f7" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M0,130 C50,120 90,124 130,108 C170,98 210,106 250,92 C290,80 330,86 370,72 C410,64 450,66 500,55 L500,160 L0,160 Z" fill="url(#g2)"/>
                <path d="M0,130 C50,120 90,124 130,108 C170,98 210,106 250,92 C290,80 330,86 370,72 C410,64 450,66 500,55" fill="none" stroke="#14b8a6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M0,105 C50,90 90,94 130,72 C170,58 210,68 250,46 C290,30 330,40 370,24 C410,12 450,16 500,4 L500,160 L0,160 Z" fill="url(#g1)"/>
                <path d="M0,105 C50,90 90,94 130,72 C170,58 210,68 250,46 C290,30 330,40 370,24 C410,12 450,16 500,4" fill="none" stroke="#f97316" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="370" y1="20" x2="370" y2="160" stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-dasharray="3 4"/>
                <circle cx="370" cy="24" r="5" fill="#f97316" stroke="#050508" stroke-width="2.5"/>
                <circle cx="370" cy="24" r="9" fill="none" stroke="#f97316" stroke-opacity=".25" stroke-width="2"/>
                <g transform="translate(288,2)">
                  <rect width="158" height="26" rx="7" fill="rgba(15,15,25,0.96)" stroke="rgba(255,255,255,0.12)"/>
                  <circle cx="12" cy="13" r="3" fill="#f97316"/>
                  <text x="22" y="17" fill="#fff" font-size="10" font-family="JetBrains Mono, monospace" font-weight="600">Kira icmali kesildi</text>
                </g>
                <g fill="rgba(255,255,255,0.30)" font-size="9" font-family="JetBrains Mono, monospace" text-anchor="middle">
                  <text x="0" y="174" text-anchor="start">1. gün</text>
                  <text x="125" y="174">8. gün</text>
                  <text x="250" y="174">15. gün</text>
                  <text x="375" y="174">22. gün</text>
                  <text x="500" y="174" text-anchor="end">30. gün</text>
                </g>
              </svg>
            </div>

            <div class="dash-list">
              <div class="dash-list-head">Bugün</div>
              <div class="dash-list-item">
                <div class="ava" style="background:var(--p2-grad)">SY</div>
                <div class="info"><div class="name">Sayaç turu tamamlandı</div><div class="meta">Kadıköy rotası · 9 durak</div></div>
                <div class="amt">9 cihaz</div>
              </div>
              <div class="dash-list-item">
                <div class="ava" style="background:var(--p1-grad)">TN</div>
                <div class="info"><div class="name">Toner bitiyor uyarısı</div><div class="meta">Sayaç hızına göre ~11 gün</div></div>
                <div class="amt" style="color:#f59e0b">Sipariş</div>
              </div>
              <div class="dash-list-item">
                <div class="ava" style="background:var(--p3-grad)">QR</div>
                <div class="info"><div class="name">QR'dan arıza bildirimi</div><div class="meta">Müşteri girişsiz bildirdi</div></div>
                <div class="amt" style="color:#a855f7">Fiş açıldı</div>
              </div>
              <div class="dash-list-item">
                <div class="ava" style="background:linear-gradient(135deg,#10b981,#06b6d4)">WA</div>
                <div class="info"><div class="name">WhatsApp durum bildirimi</div><div class="meta">Yapılan işlem + tutar gönderildi</div></div>
                <div class="amt">Tek tık</div>
              </div>
              <div class="dash-list-item">
                <div class="ava" style="background:linear-gradient(135deg,#f59e0b,#a855f7)">İC</div>
                <div class="info"><div class="name">Toplu icmal yazdırıldı</div><div class="meta">100 fiş → tek sayfa</div></div>
                <div class="amt">Hazır</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ========== PATLATILMIS MAKINE ========== -->
<section class="patlatma" id="patlatma"
  data-adet="192" data-genislik="1440" data-yukseklik="810"
  data-madet="96" data-mgenislik="800" data-myukseklik="450">
  <div class="patlatma-yol">
    <div class="patlatma-sahne">
      <!-- JS calismasa da, kareler yuklenirken de burasi dolu kalir. -->
      <picture>
        <source media="(max-width:767px)" srcset="/servis-m/f-001.webp" width="800" height="450">
        <img class="patlatma-poster" src="/servis/f-001.webp" width="1440" height="810" decoding="async"
             alt="Kiralık fotokopi makinesi, kapalı gövde">
      </picture>
      <canvas class="patlatma-tuval" aria-hidden="true"></canvas>
      <div class="patlatma-yazi">
        <div class="inner">
          <span class="patlatma-goz">02 — Cihaz</span>
          <h2 class="patlatma-h">Faturayı cihaz değil, parçaları yazdırır.</h2>
        </div>
      </div>
      <span class="patlatma-no">02</span>
    </div>
  </div>
</section>

<!-- ========== ROI / KACAN GELIR HESABI ========== -->
<section class="roi" id="hesap">
  <div class="container">
    <div class="section-head reveal">
      <span class="section-eyebrow"><span class="dot" style="background:#10b981"></span>Kaçan Gelir Hesabı</span>
      <h2 class="section-title">Ayda ne kadarı <span class="gradient-text">hiç faturalanmıyor?</span></h2>
      <p class="section-sub">Üç değeri kendi bayinize göre ayarlayın. Bu bir <strong>tahmin modelidir</strong>, garanti değildir — girdileri siz verirsiniz, hesap tarayıcınızdan çıkmaz.</p>
    </div>

    <div class="roi-card reveal">
      <div class="roi-card-glow"></div>

      <!-- SENARYOLAR -->
      <div class="roi-presets">
        <div class="roi-presets-label">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          Cihaz sayısını hızlı ayarla — <span class="rp-label-note">kaçırma oranını siz girin</span>
        </div>
        <div class="roi-presets-row">
          <button class="roi-preset" type="button" data-c="20">
            <span class="rp-emoji" aria-hidden="true">🌱</span>
            <span class="rp-text">
              <span class="rp-name">20 cihaz</span>
              <span class="rp-meta">örnek büyüklük</span>
            </span>
          </button>
          <button class="roi-preset active" type="button" data-c="60">
            <span class="rp-emoji" aria-hidden="true">🖨</span>
            <span class="rp-text">
              <span class="rp-name">60 cihaz</span>
              <span class="rp-meta">örnek büyüklük</span>
            </span>
          </button>
          <button class="roi-preset" type="button" data-c="150">
            <span class="rp-emoji" aria-hidden="true">🏭</span>
            <span class="rp-text">
              <span class="rp-name">150 cihaz</span>
              <span class="rp-meta">örnek büyüklük</span>
            </span>
          </button>
          <button class="roi-preset" type="button" data-c="300">
            <span class="rp-emoji" aria-hidden="true">🏢</span>
            <span class="rp-text">
              <span class="rp-name">300 cihaz</span>
              <span class="rp-meta">örnek büyüklük</span>
            </span>
          </button>
        </div>
        <p class="roi-presets-note">Bu düğmeler yalnızca <strong>cihaz sayısını</strong> ayarlar. Ortalama fatura ve kaçırma oranı sizin kendi rakamınız — sektör ortalaması diye bir veri elimizde yok, uydurmuyoruz.</p>
      </div>

      <div class="roi-grid">
        <!-- GIRDILER -->
        <div class="roi-inputs">
          <div class="roi-side-head">
            <span class="roi-pill">
              <span class="roi-pill-dot"></span>
              CANLI HESAPLAMA
            </span>
            <h3>Bayinizi tanıyalım</h3>
            <p class="roi-side-sub">Üç slider — gerisi otomatik. Kaydırdığınızda aşağıdaki fiyat kartları da cihaz sayınıza göre güncellenir.</p>
          </div>

          <!-- 1 -->
          <div class="roi-input">
            <div class="roi-input-head">
              <div class="roi-input-icon" data-tone="amber">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10"/><path d="M8 8h8"/></svg>
              </div>
              <div class="roi-input-meta">
                <div class="roi-input-label">Kiralık cihaz sayısı</div>
                <div class="roi-input-help">sözleşmeli, sayaç okunan cihazlar</div>
              </div>
              <div class="roi-input-value" id="vd-count">60</div>
            </div>
            <div class="roi-slider-wrap">
              <input type="range" class="roi-slider" id="roi-count" min="5" max="400" step="1" value="60" aria-label="Kiralık cihaz sayısı" />
            </div>
            <div class="roi-input-foot">
              <span class="roi-tick">5</span>
              <span class="roi-context"><span class="roi-context-dot"></span>sahadaki toplam cihaz</span>
              <span class="roi-tick">400</span>
            </div>
          </div>

          <!-- 2 -->
          <div class="roi-input">
            <div class="roi-input-head">
              <div class="roi-input-icon" data-tone="teal">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M4 4h16v16H4z"/><path d="M8 9h8M8 13h8M8 17h5"/></svg>
              </div>
              <div class="roi-input-meta">
                <div class="roi-input-label">Cihaz başına aylık ortalama fatura</div>
                <div class="roi-input-help">kira + sayaç aşımı, KDV hariç</div>
              </div>
              <div class="roi-input-value" id="vd-bill">₺1.500</div>
            </div>
            <div class="roi-slider-wrap">
              <input type="range" class="roi-slider" id="roi-bill" min="200" max="6000" step="50" value="1500" aria-label="Cihaz başına aylık ortalama fatura" />
            </div>
            <div class="roi-input-foot">
              <span class="roi-tick">₺200</span>
              <span class="roi-context"><span class="roi-context-dot"></span>kendi ortalamanız</span>
              <span class="roi-tick">₺6.000</span>
            </div>
          </div>

          <!-- 3 -->
          <div class="roi-input">
            <div class="roi-input-head">
              <div class="roi-input-icon" data-tone="violet">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div class="roi-input-meta">
                <div class="roi-input-label">Tahmini kaçırma oranı</div>
                <div class="roi-input-help">okunmayan sayaç · geç fatura · unutulan aşım — <strong>%10 sadece başlangıç örneği, kendi tahmininizi girin</strong></div>
              </div>
              <div class="roi-input-value" id="vd-miss">%10</div>
            </div>
            <div class="roi-slider-wrap">
              <input type="range" class="roi-slider" id="roi-miss" min="1" max="30" step="1" value="10" aria-label="Tahmini kaçırma oranı" />
            </div>
            <div class="roi-input-foot">
              <span class="roi-tick">%1</span>
              <span class="roi-context"><span class="roi-context-dot"></span>sizin tahmininiz</span>
              <span class="roi-tick">%30</span>
            </div>
          </div>

          <div class="roi-disclaimer">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Girdileriniz tarayıcınızda kalır, hiçbir yere gönderilmez. Sonuçlar tahmindir; taahhüt değildir.
          </div>
        </div>

        <!-- CIKTILAR -->
        <div class="roi-output">
          <div class="roi-side-head">
            <span class="roi-pill positive">
              <span class="roi-pill-dot positive"></span>
              SİZİN TABLONUZ
            </span>
            <h3>Faturalanmayan gelir</h3>
            <p class="roi-side-sub">Aylık ve yıllık kaçan tutar, seçilen pakete göre net kazanç ve geri ödeme süresi.</p>
          </div>

          <div class="roi-hero-result">
            <div class="roi-hero-grid">
              <div class="roi-gauge-wrap">
                <svg class="roi-gauge" viewBox="0 0 200 116" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
                  <defs>
                    <linearGradient id="gaugeGrad" x1="0" x2="1" y1="0" y2="0">
                      <stop offset="0%" stop-color="#ef4444"/>
                      <stop offset="20%" stop-color="#f59e0b"/>
                      <stop offset="50%" stop-color="#14b8a6"/>
                      <stop offset="100%" stop-color="#10b981"/>
                    </linearGradient>
                    <filter id="gaugeGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="3" result="b"/>
                      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>
                  <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="14" stroke-linecap="round"/>
                  <path id="roiGaugeArc" d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="url(#gaugeGrad)" stroke-width="14" stroke-linecap="round" pathLength="100" stroke-dasharray="21 100" style="transition:stroke-dasharray .55s cubic-bezier(.4,0,.2,1);"/>
                  <circle id="roiGaugeDot" cx="71.7" cy="25.2" r="6" fill="#10b981" filter="url(#gaugeGlow)"/>
                  <g stroke="rgba(255,255,255,0.20)" stroke-width="1" stroke-linecap="round">
                    <line x1="20" y1="100" x2="22" y2="92"/>
                    <line x1="35" y1="50" x2="40" y2="55"/>
                    <line x1="100" y1="20" x2="100" y2="28"/>
                    <line x1="160" y1="50" x2="155" y2="55"/>
                    <line x1="180" y1="100" x2="178" y2="92"/>
                  </g>
                  <g font-family="JetBrains Mono, monospace" font-size="8" fill="rgba(255,255,255,0.4)" text-anchor="middle">
                    <text x="20" y="112">0×</text>
                    <text x="36" y="44">2,5×</text>
                    <text x="100" y="14">5×</text>
                    <text x="164" y="44">7,5×</text>
                    <text x="180" y="112">10×</text>
                  </g>
                </svg>
                <div class="roi-gauge-center">
                  <div class="roi-gauge-label">GERİ KAZANIM / MALİYET</div>
                  <div class="roi-gauge-value" id="roiGaugeNum">2,1×</div>
                  <div class="roi-gauge-status" id="roiGaugeStatus">✓ Çok iyi</div>
                </div>
              </div>

              <div class="roi-hero-num-side">
                <div class="roi-hero-label">Yıllık kaçan gelir</div>
                <div class="roi-hero-num" id="roi-year">₺108.000</div>
                <div class="roi-hero-meta">
                  <span>Aylık <strong id="roi-month">₺9.000</strong></span>
                  <span class="roi-hero-sep">•</span>
                  <span id="roi-basis">60 cihaz × ₺1.500 × %10</span>
                </div>
                <div class="roi-hero-fiveyear">
                  <span class="rh5y-label">Paket sonrası yıllık net kazanç:</span>
                  <span class="rh5y-num" id="roi-net">₺39.912</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 5 YILLIK PROJEKSIYON -->
          <div class="roi-projection">
            <div class="roi-proj-head">
              <div>
                <div class="rp-eyebrow">📈 5 YILLIK PROJEKSİYON</div>
                <div class="rp-title">Programla <strong>birikimli net kazanç</strong>; altta modelde <strong>geri kazanılmayan pay</strong></div>
              </div>
              <div class="rp-diff-pill" id="rpDiffPill">
                +₺200K / 5 yıl
              </div>
            </div>
            <div class="roi-proj-chart-wrap">
              <!-- SADECE path'ler preserveAspectRatio="none" ile esner.
                   Metin ve uc noktalari SVG'nin USTUNDE HTML katmanindadir; boylece
                   dar ekranda harfler yatayda sikismaz, daireler elipse donmez. -->
              <svg class="roi-proj-chart" viewBox="0 0 480 180" preserveAspectRatio="none" role="img" aria-labelledby="projChartTitle projChartDesc">
                <title id="projChartTitle">5 yıllık projeksiyon</title>
                <desc id="projChartDesc">Yeşil eğri: programla birikimli net kazanç. Kırmızı kesikli eğri: modelde geri kazanılmayan pay. Değerler solda ve rozette sayı olarak da yazılıdır.</desc>
                <defs>
                  <linearGradient id="projWith" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#10b981" stop-opacity=".45"/>
                    <stop offset="100%" stop-color="#10b981" stop-opacity="0"/>
                  </linearGradient>
                  <linearGradient id="projWithout" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stop-color="#ef4444" stop-opacity=".25"/>
                    <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
                  </linearGradient>
                </defs>
                <g stroke="rgba(255,255,255,0.04)" stroke-width="1">
                  <line x1="0" y1="45" x2="480" y2="45"/>
                  <line x1="0" y1="90" x2="480" y2="90"/>
                  <line x1="0" y1="135" x2="480" y2="135"/>
                </g>
                <g stroke="rgba(255,255,255,0.03)" stroke-width="1" stroke-dasharray="2 4">
                  <line x1="96" y1="0" x2="96" y2="180"/>
                  <line x1="192" y1="0" x2="192" y2="180"/>
                  <line x1="288" y1="0" x2="288" y2="180"/>
                  <line x1="384" y1="0" x2="384" y2="180"/>
                </g>
                <path id="projWithoutFill" d="" fill="url(#projWithout)"/>
                <path id="projWithoutLine" d="" fill="none" stroke="#ef4444" stroke-width="1.5" stroke-dasharray="4 4" opacity=".7"/>
                <path id="projWithFill" d="" fill="url(#projWith)"/>
                <path id="projWithLine" d="" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              <span class="proj-dot proj-dot-with" id="projWithEnd" aria-hidden="true"></span>
              <span class="proj-dot proj-dot-without" id="projWithoutEnd" aria-hidden="true"></span>
              <span class="proj-end-label" id="projEndLabel"><span id="projEndLabelText">+₺200K</span></span>
              <div class="roi-proj-axis">
                <span>1.yıl</span><span>2.yıl</span><span>3.yıl</span><span>4.yıl</span><span>5.yıl</span>
              </div>
            </div>
            <div class="roi-proj-legend">
              <span><i class="rpl-with"></i><strong>Nextus Servis ile</strong> · birikimli net kazanç (bugünkü düzene göre fark)</span>
              <span><i class="rpl-without"></i><strong>Modelde geri kazanılmayan pay</strong> · birikimli (kaçan gelirin %30'u)</span>
              <span class="rpl-note">İki çizgi de aynı birimde: bugünkü düzene göre fark. Rozetteki tutar yeşil çizginin 5. yıl ucudur.</span>
            </div>
          </div>

          <!-- IKINCIL METRIKLER -->
          <div class="roi-secondary">
            <div class="roi-mini">
              <div class="roi-mini-icon">📅</div>
              <div class="roi-mini-body">
                <div class="roi-mini-num" id="roi-monthly-mini">₺9.000</div>
                <div class="roi-mini-label">Aylık kaçan gelir</div>
              </div>
            </div>
            <div class="roi-mini">
              <div class="roi-mini-icon">⚡</div>
              <div class="roi-mini-body">
                <div class="roi-mini-num" id="roi-payback">&lt; 1 ay</div>
                <div class="roi-mini-label">Yazılımın geri ödeme süresi</div>
              </div>
            </div>
          </div>

          <!-- DAGILIM -->
          <div class="roi-breakdown">
            <div class="roi-breakdown-head">
              <span>Net kazanç nasıl çıkıyor?</span>
              <span class="roi-breakdown-total" id="roi-recovered">₺75.600 geri kazanım</span>
            </div>
            <div class="roi-breakdown-bar">
              <div class="rbb-segment rbb-1" id="rbb-net" style="width:53%"></div>
              <div class="rbb-segment rbb-2" id="rbb-cost" style="width:47%"></div>
            </div>
            <div class="roi-breakdown-legend">
              <span><i class="rl-1"></i>Yıllık net kazanç <strong id="rbl-net">₺39.912</strong></span>
              <span><i class="rl-2"></i>Yıllık yazılım maliyeti <strong id="rbl-cost">₺35.688</strong></span>
              <span class="cost-line"><i class="rl-cost"></i>Modelde geri kazanılmayan pay <strong id="rbl-rest">₺32.400</strong></span>
            </div>
            <div class="roi-assume">
              <strong>Varsayım:</strong> kaçan gelirin <strong>%70'i</strong> geri kazanılıyor kabul edilir; kalan %30 modelde hesaba katılmaz. <strong>%70 ölçülmüş bir veri değil, bizim varsayımımızdır</strong> — siz farklı düşünüyorsanız birlikte değiştirelim. Yazılım maliyeti <strong>Profesyonel pakete</strong> göre alınır (taban ₺2.099 + dahil 25 cihaz üstü her cihaz ₺25, aylık ödeme, KDV hariç). Diğer paketlerin aynı cihaz sayısındaki fiyatını fiyat tablosunda görürsünüz. Yıllık ödemede 2 ay bedava olduğu için net kazanç bu tablodakinden yüksek çıkar.
            </div>
          </div>

          <!-- PAKET ONERISI -->
          <div class="roi-recommend">
            <div class="roi-recommend-glow"></div>
            <div class="roi-recommend-eyebrow">
              <span class="roi-rec-spark">✨</span>
              <span>HESAP PROFESYONEL PAKETE GÖRE</span>
            </div>
            <div class="roi-recommend-row">
              <div>
                <div class="roi-recommend-name" id="roi-rec-name">Profesyonel</div>
                <p class="roi-recommend-desc"><strong id="roi-rec-detail">60 cihaz: ₺2.099 taban + 35 × ₺25</strong> — maliyetin geri gelmesi <strong id="roi-rec-payback">&lt; 1 ay</strong>. Diğer iki paketin aynı cihaz sayısındaki fiyatını fiyat tablosunda görebilirsiniz.</p>
              </div>
              <div class="roi-recommend-price">
                <div class="roi-recommend-price-num" id="roi-rec-price">₺2.974</div>
                <div class="roi-recommend-price-period">/ ay + KDV</div>
              </div>
            </div>
            <a href="#fiyatlandirma" class="btn btn-grad btn-block roi-cta-btn">
              Fiyat tablosunu gör <span class="arr">→</span>
            </a>
          </div>
        </div>
      </div>

      <!-- CANLI SAYAC -->
      <div class="roi-money-ticker">
        <div class="rmt-pulse"></div>
        <div class="rmt-text">
          <span id="rmtIdle">Kaydırıcıları kendi bayinize göre ayarlayın; <strong>sizin rakamlarınıza göre</strong> kaçan gelir burada işlemeye başlar.</span>
          <span id="rmtLive" hidden>Kaydırıcıya dokunduğunuzdan beri, <strong>girdiğiniz rakamlara göre</strong> <strong id="rmtAmount">₺0</strong> faturalanmamış gelir birikti</span>
        </div>
        <div class="rmt-rate" id="rmtRateWrap" hidden>
          <span class="rmt-rate-num" id="rmtRate">₺0</span>
          <span class="rmt-rate-unit">/ saat</span>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ========== URUN DETAY ========== -->
<section class="product-detail pd2" id="urun">
  <div class="container">
    <div class="pd-grid">
      <div class="pd-content reveal reveal-right">
        <span class="pd-eyebrow">🖨 Nextus Servis</span>
        <h2 class="pd-title">Kiralama bayisinin <span class="p2-text">tüm işi</span> tek programda</h2>
        <p class="pd-tagline">Müşteri ve cihaz kartından sayaç turuna, servis fişinden tahsilata kadar aynı yerde.</p>
        <p class="pd-desc">Nextus Servis genel amaçlı bir "iş takip" programı değil. Yazıcı, fotokopi ve ofis cihazı <strong>kiralayan ve servis veren bayiler</strong> için yazıldı: sayaç okuma, dahil hacim + aşım fiyatı, cihaz kârlılığı, toner tahmini ve rota planlama gibi bu işin kendine has adımları uygulamanın merkezinde duruyor.</p>

        <div class="pd-features">
          <div class="pd-feature">
            <div class="pd-feature-icon">📟</div>
            <h3>Sayaçtan otomatik fatura</h3>
            <p>Sayaç okumasını girin; dahil hacim ve aşım fiyatına göre kira faturası kendiliğinden hesaplansın. Fatura öncesi sayaç ön kontrolü eksikleri size gösterir.</p>
          </div>
          <div class="pd-feature">
            <div class="pd-feature-icon">📉</div>
            <h3>Kaçan Gelir paneli</h3>
            <p>Sayacı geç girilen ya da hiç girilmeyen cihazlar isim isim listelenir. "Bu ay kimi faturalamadık?" sorusu tahmine kalmaz.</p>
          </div>
          <div class="pd-feature">
            <div class="pd-feature-icon">🎫</div>
            <h3>Servis fişi ve QR arıza bildirimi</h3>
            <p>Cihaz teslim al, fişi aç, işlemi ve parçayı işle, kapat. Müşteri QR'ı okutup <strong>giriş yapmadan</strong> arıza bildirebilir.</p>
          </div>
          <div class="pd-feature">
            <div class="pd-feature-icon">🏷</div>
            <h3>Barkodlu stok · Zebra etiket</h3>
            <p>Parça ve sarf girişi LS2208 barkod okuyucuyla, etiketler Zebra yazıcıdan. Sarf takibi ve toner tükenme tahmini sayaç hızından hesaplanır.</p>
          </div>
          <div class="pd-feature">
            <div class="pd-feature-icon">🧾</div>
            <h3>Muhasebe, cari ve tahsilat</h3>
            <p>Cari hesap, tahsilat takibi, toplu zam, toplu borç hatırlatma (SMS/WhatsApp — sağlayıcı hesabı ayrıca) ve 100 fişi tek sayfaya sığdıran toplu icmal yazdırma.</p>
          </div>
          <div class="pd-feature">
            <div class="pd-feature-icon">💬</div>
            <h3>WhatsApp'la iletişim</h3>
            <p>Gelen mesajda müşteri numarasından otomatik tanınır; yapılan işlem ve tutar tek tıkla müşteriye bildirilir. <span class="pd-cond">WhatsApp Business API (Meta) hesabı, işletme doğrulaması ve onaylı mesaj şablonu gerekir; konuşma ücreti Meta'ya ödenir.</span></p>
          </div>
        </div>

        <div class="pd-cta">
          <a href="https://wa.me/905526961703?text=Merhaba%2C%20Nextus%20Servis%20demosu%20istiyorum" target="_blank" rel="noopener" class="btn btn-grad">WhatsApp'tan demo al →</a>
          <a href="#fiyatlandirma" class="btn btn-ghost">Fiyatları gör</a>
        </div>
      </div>

      <div class="pd-mock reveal reveal-left">
        <div class="pd-mock-frame">
          <div class="pd-mock-glow"></div>
          <div class="mockup-titlebar">
            <span class="dot-r r"></span><span class="dot-r y"></span><span class="dot-r g"></span>
            <div class="titlebar-url">Servis Fişleri</div>
            <span class="mock-sample-badge">örnek ekran</span>
          </div>
          <div class="mock-srv">
            <div class="mock-srv-head">
              <div class="mock-h">Servis Akışı</div>
              <span class="badge">● 12 açık fiş</span>
            </div>
            <div class="mock-srv-kanban">
              <div class="kan-col c1">
                <div class="kan-head"><span>Beklemede</span><span class="ct">5</span></div>
                <div class="kan-card">
                  <div class="id">#SF-2847</div>
                  <div class="ttl">Canon iR-ADV · kağıt sıkışması</div>
                  <div class="meta"><span><i class="priority h"></i>Acil</span><span>QR</span></div>
                </div>
                <div class="kan-card">
                  <div class="id">#SF-2848</div>
                  <div class="ttl">Konica Minolta · fuser hatası</div>
                  <div class="meta"><span><i class="priority m"></i>Normal</span><span>Tel</span></div>
                </div>
                <div class="kan-card">
                  <div class="id">#SF-2849</div>
                  <div class="ttl">Pantum · toner değişimi</div>
                  <div class="meta"><span><i class="priority l"></i>Düşük</span><span>WA</span></div>
                </div>
              </div>
              <div class="kan-col c2">
                <div class="kan-head"><span>Serviste</span><span class="ct">4</span></div>
                <div class="kan-card">
                  <div class="id">#SF-2845</div>
                  <div class="ttl">Ricoh MP · drum ünitesi</div>
                  <div class="meta"><span><i class="priority h"></i>Parça bekliyor</span><span>Stok</span></div>
                </div>
                <div class="kan-card">
                  <div class="id">#SF-2846</div>
                  <div class="ttl">Kyocera TASKalfa · bakım</div>
                  <div class="meta"><span><i class="priority m"></i>Periyodik</span><span>Rota</span></div>
                </div>
              </div>
              <div class="kan-col c3">
                <div class="kan-head"><span>Kapandı</span><span class="ct">8</span></div>
                <div class="kan-card">
                  <div class="id">#SF-2841</div>
                  <div class="ttl">Canon iR · besleme makarası</div>
                  <div class="meta"><span style="color:#10b981">✓ Faturalandı</span><span>Cari</span></div>
                </div>
                <div class="kan-card">
                  <div class="id">#SF-2842</div>
                  <div class="ttl">Konica · sayaç okundu</div>
                  <div class="meta"><span style="color:#10b981">✓ İcmale girdi</span><span>Kira</span></div>
                </div>
                <div class="kan-card">
                  <div class="id">#SF-2843</div>
                  <div class="ttl">Pantum · sarf çıkışı</div>
                  <div class="meta"><span style="color:#10b981">✓ Stoktan düştü</span><span>Barkod</span></div>
                </div>
              </div>
            </div>
            <div class="mock-srv-foot">
              <div class="qr-mini">
                <i></i><i></i><i></i><i class="w"></i><i></i><i class="w"></i><i></i><i></i>
                <i></i><i class="w"></i><i></i><i></i><i></i><i class="w"></i><i class="w"></i><i></i>
                <i></i><i></i><i class="w"></i><i></i><i class="w"></i><i></i><i></i><i></i>
                <i class="w"></i><i></i><i></i><i></i><i class="w"></i><i></i><i class="w"></i><i></i>
                <i></i><i class="w"></i><i></i><i class="w"></i><i></i><i></i><i></i><i class="w"></i>
                <i></i><i></i><i></i><i></i><i class="w"></i><i></i><i class="w"></i><i></i>
                <i class="w"></i><i></i><i></i><i class="w"></i><i></i><i class="w"></i><i></i><i></i>
                <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
              </div>
              <div class="info">
                <div class="t">QR ile müşteri arıza bildirimi</div>
                <div class="s">Cihazın üstündeki QR'ı okutur, giriş yapmadan bildirir — fiş sizde açılır</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ========== KUTUDAN CIKAN HER SEY ========== -->
<section class="caps">
  <div class="container">
    <div class="section-head reveal">
      <span class="section-eyebrow"><span class="dot" style="background:var(--p2-2)"></span>Kutudan Çıkanlar</span>
      <h2 class="section-title">Ne varsa <span class="gradient-text">burada yazıyor</span></h2>
      <p class="section-sub">Aşağıdaki listedeki her madde bugün üründe çalışıyor. Üçüncü taraf hesap gerektirenleri ayrıca not düştük. Olmayanları da aynı netlikte yazdık — sürpriz istemiyoruz.</p>
    </div>

    <div class="cap-groups reveal reveal-stagger">
      <div class="cap-group">
        <div class="cap-group-head">
          <span class="cap-ico">💸</span>
          <div>
            <h3>Para tarafı</h3>
            <div class="cap-group-sub">kira · sayaç · tahsilat</div>
          </div>
        </div>
        <ul class="cap-list">
          <li><strong>Sayaç okuma</strong> ve sayaç bazlı otomatik faturalama</li>
          <li><strong>Kira faturalaması:</strong> dahil hacim + aşım fiyatı</li>
          <li>Fatura öncesi <strong>sayaç ön kontrolü</strong> ve geç sayaç takibi</li>
          <li><strong>Sayaç Turu</strong> — müşteri bazlı toplu sayaç girişi</li>
          <li><strong>Kaçan Gelir paneli</strong></li>
          <li>Muhasebe / cari hesap ve <strong>tahsilat takibi</strong></li>
          <li><strong>Toplu zam</strong> ve toplu borç hatırlatma (SMS/WhatsApp — <span class="cap-cond">sağlayıcı hesabı ayrıca</span>)</li>
          <li><strong>Toplu icmal yazdırma</strong> — 100 fiş, tek sayfa</li>
          <li><strong>Cihaz kârlılık raporu</strong> ve cihaz dökümü</li>
        </ul>
      </div>

      <div class="cap-group">
        <div class="cap-group-head">
          <span class="cap-ico">🔧</span>
          <div>
            <h3>Saha tarafı</h3>
            <div class="cap-group-sub">servis · stok · rota</div>
          </div>
        </div>
        <ul class="cap-list">
          <li>Müşteri, cihaz ve <strong>servis fişi</strong> yönetimi</li>
          <li><strong>Stok + barkod</strong> (LS2208) ve <strong>Zebra etiket</strong></li>
          <li>Sarf takibi ve <strong>toner tükenme tahmini</strong> — sayaç hızından "kaç gün sonra biter"</li>
          <li><strong>Rota planlama</strong> — Google Maps çok duraklı bağlantı</li>
          <li><strong>QR ile müşteri arıza bildirimi</strong> (giriş gerektirmez)</li>
          <li>Müşteriye <strong>tek tıkla WhatsApp durum bildirimi</strong> (yapılan işlem + tutar) — <span class="cap-cond">WhatsApp Business API hesabı gerekir</span></li>
          <li>WhatsApp'tan gelen mesajda <strong>müşteriyi otomatik tanıma</strong> — <span class="cap-cond">aynı hesaba bağlıdır</span></li>
          <li><strong>Bayi Pazarı</strong> — bayiler arası parça ticareti <span class="cap-cond">(yeni açılıyor; bayi sayısı arttıkça değer kazanır)</span></li>
        </ul>
      </div>

      <div class="cap-group">
        <div class="cap-group-head">
          <span class="cap-ico">🗄</span>
          <div>
            <h3>Veri tarafı</h3>
            <div class="cap-group-sub">aktarım · rapor · güvenlik</div>
          </div>
        </div>
        <ul class="cap-list">
          <li><strong>Excel / CSV içeri aktarma</strong> — mevcut listenizle başlarsınız</li>
          <li><strong>Yedek indirme</strong> — tüm veriniz tek JSON dosyasında</li>
          <li>İsteğe bağlı <strong>iki adımlı doğrulama (2FA)</strong></li>
          <li><strong>Marka/model güvenilirlik raporları</strong></li>
          <li>Cihaz kârlılığı ve cihaz dökümü raporları</li>
          <li><strong>Logo'ya aktarım</strong> — muhasebe programına veri aktarımı</li>
          <li>Web + <strong>PWA</strong> — telefonda ana ekrana eklenir</li>
        </ul>
      </div>
    </div>

  </div>
</section>

<!-- ========== ORTAK GUC / BENTO ========== -->
<section class="common" id="ozellikler">
  <div class="fon fon-saha" aria-hidden="true">
    <picture>
      <source type="image/avif" media="(max-width:767px)" srcset="/fon/saha-m.avif">
      <source type="image/webp" media="(max-width:767px)" srcset="/fon/saha-m.webp">
      <source type="image/avif" srcset="/fon/saha.avif">
      <source type="image/webp" srcset="/fon/saha.webp">
      <img src="/fon/saha.webp" alt="" loading="lazy" decoding="async" width="1920" height="1072">
    </picture>
    <video class="fon-v" data-src="/fon/saha.mp4" muted loop playsinline preload="none" tabindex="-1" aria-hidden="true"></video>
  </div>

  <div class="container">
    <div class="section-head reveal">
      <span class="section-eyebrow"><span class="dot" style="background:var(--p3-1)"></span>Günlük Kullanım</span>
      <h2 class="section-title">Sahada da, ofiste de <span class="gradient-text">aynı program</span></h2>
      <p class="section-sub">Teknisyen telefondan fişi kapatır, ofis aynı anda faturayı görür. Ayrı ayrı Excel dosyası, ayrı ayrı defter yok.</p>
    </div>

    <div class="bento-grid">
      <!-- 1 (LARGE): Mobil / PWA -->
      <div class="bento bento-mobile reveal reveal-scale">
        <div class="bento-content">
          <div class="bento-eyebrow">SAHADAKİ TEKNİSYEN</div>
          <h3>Telefondan tam panel</h3>
          <p>Ayrı bir mobil uygulama indirmenize gerek yok: tarayıcıdan açıp ana ekrana ekleyin (PWA). Teknisyen sayacı girer, fişi kapatır, sarfı stoktan düşer — ofis anında görür.</p>
          <div class="bento-tags">
            <span>Web</span><span>PWA</span><span>Ana ekrana ekle</span><span>Kurulum yok</span>
          </div>
        </div>
        <div class="bento-visual">
          <div class="phone">
            <div class="phone-notch"></div>
            <div class="phone-screen">
              <div class="phone-status">
                <span class="ps-time">14:23</span>
                <span class="ps-icons">
                  <svg viewBox="0 0 14 10" width="14" height="10" fill="currentColor" aria-hidden="true" focusable="false"><path d="M2 8h2v2H2zM5 6h2v4H5zM8 4h2v6H8zM11 2h2v8h-2z"/></svg>
                  <svg viewBox="0 0 16 10" width="14" height="10" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false"><rect x="0.5" y="2" width="13" height="6" rx="1"/><rect x="2" y="3.5" width="9" height="3"/><line x1="14.5" y1="4" x2="14.5" y2="6"/></svg>
                </span>
              </div>
              <div class="phone-app">
                <div class="phone-app-header">
                  <div>
                    <div class="pah-greet">Bugünkü rota</div>
                    <div class="pah-name">Sırada <strong>4 durak</strong></div>
                  </div>
                  <div class="pah-avatar">T</div>
                </div>
                <div class="phone-stat-card">
                  <div class="psc-label">SAYACI GİRİLEN</div>
                  <div class="psc-num">9 / 13</div>
                  <div class="psc-trend">↑ tur devam ediyor</div>
                </div>
                <div class="phone-list">
                  <div class="phone-list-item">
                    <span class="pli-dot" style="background:#10b981"></span>
                    <div class="pli-body">
                      <div class="pli-title">Sayaç girildi</div>
                      <div class="pli-meta">Canon iR-ADV · S/B 48.210</div>
                    </div>
                    <div class="pli-amt">✓</div>
                  </div>
                  <div class="phone-list-item">
                    <span class="pli-dot" style="background:#f59e0b"></span>
                    <div class="pli-body">
                      <div class="pli-title">Toner bitiyor</div>
                      <div class="pli-meta">Tahmini 11 gün</div>
                    </div>
                    <div class="pli-amt small">⚠</div>
                  </div>
                  <div class="phone-list-item">
                    <span class="pli-dot" style="background:#a855f7"></span>
                    <div class="pli-body">
                      <div class="pli-title">Fiş kapatıldı</div>
                      <div class="pli-meta">Parça barkoddan düştü</div>
                    </div>
                    <div class="pli-amt">✓</div>
                  </div>
                </div>
              </div>
            </div>
            <div class="phone-notif">
              <div class="phone-notif-ico">💬</div>
              <div class="phone-notif-body">
                <div class="phone-notif-title">Nextus Servis</div>
                <div class="phone-notif-text">Müşteriye durum bildirimi gönderildi</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 2: Veri sizin -->
      <div class="bento bento-guard reveal reveal-blur">
        <div class="bento-shield">
          <svg viewBox="0 0 60 60" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false">
            <path d="M30 5 L52 14 L52 30 C52 42 42 52 30 56 C18 52 8 42 8 30 L8 14 Z"/>
            <polyline points="20,30 27,37 40,22" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="bento-content">
          <div class="bento-eyebrow">HESAP GÜVENLİĞİ</div>
          <h3>Veriniz sizde kalır</h3>
          <p>İsteğe bağlı iki adımlı doğrulama (2FA) ve tek tıkla yedek indirme. Müşteri listeniz her an elinizde.</p>
        </div>
        <div class="bento-shield-rays"></div>
      </div>

      <!-- 3: Toplu icmal / cikti -->
      <div class="bento bento-pdf reveal reveal-rotate">
        <div class="bento-content">
          <div class="bento-eyebrow">AY SONU</div>
          <h3>Toplu icmal</h3>
          <p>100 servis fişi tek sayfada. Cihaz dökümü ve kârlılık raporu yanında.</p>
        </div>
        <div class="bento-pdf-stack">
          <div class="pdf-page pdf-3">
            <div class="pdf-header"></div>
            <div class="pdf-line"></div>
            <div class="pdf-line short"></div>
            <div class="pdf-line"></div>
          </div>
          <div class="pdf-page pdf-2">
            <div class="pdf-header"></div>
            <div class="pdf-line"></div>
            <div class="pdf-line short"></div>
            <div class="pdf-line"></div>
            <div class="pdf-line"></div>
          </div>
          <div class="pdf-page pdf-1">
            <div class="pdf-header amber"></div>
            <div class="pdf-line"></div>
            <div class="pdf-line short"></div>
            <div class="pdf-line"></div>
            <div class="pdf-line"></div>
            <div class="pdf-stamp">İCMAL</div>
          </div>
        </div>
      </div>

      <!-- 4: WhatsApp -->
      <div class="bento bento-wapp reveal reveal-scale">
        <div class="bento-content">
          <div class="bento-eyebrow">MÜŞTERİ İLETİŞİMİ</div>
          <h3>WhatsApp'tan bildirim</h3>
          <p>Gelen mesajda müşteri otomatik tanınır; işlem ve tutar tek tıkla gider.</p>
        </div>
        <div class="bento-chat">
          <div class="chat-bubble chat-in">
            <span>Cihaz hazır mı?</span>
          </div>
          <div class="chat-bubble chat-out">
            <span>Fuser değişti, test edildi. Fiş #SF-2845 · ₺1.240 🖨</span>
            <span class="chat-tick">✓✓</span>
          </div>
          <div class="chat-bubble chat-in chat-typing">
            <span class="dot-typ"></span><span class="dot-typ"></span><span class="dot-typ"></span>
          </div>
        </div>
      </div>

      <!-- 5: Raporlama -->
      <div class="bento bento-report reveal reveal-blur">
        <div class="bento-content">
          <div class="bento-eyebrow">RAPORLAR</div>
          <h3>Hangi cihaz kazandırıyor?</h3>
          <p>Cihaz kârlılığı ve marka/model güvenilirliği tek panelde.</p>
        </div>
        <div class="bento-chart">
          <svg viewBox="0 0 140 70" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <defs>
              <linearGradient id="bcGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stop-color="#a855f7" stop-opacity=".5"/>
                <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <g stroke="rgba(255,255,255,0.04)" stroke-width="1">
              <line x1="0" y1="22" x2="140" y2="22"/>
              <line x1="0" y1="44" x2="140" y2="44"/>
            </g>
            <path d="M0,55 C20,48 30,40 50,30 C70,22 85,28 105,18 C120,12 130,10 140,6 L140,70 L0,70 Z" fill="url(#bcGrad)"/>
            <path d="M0,55 C20,48 30,40 50,30 C70,22 85,28 105,18 C120,12 130,10 140,6" fill="none" stroke="#a855f7" stroke-width="1.5"/>
            <circle cx="140" cy="6" r="3" fill="#a855f7" stroke="#0a0a14" stroke-width="1.5"/>
          </svg>
          <div class="bento-chart-stat">
            <span class="bcs-num">Cihaz</span>
            <span class="bcs-lbl">bazında kâr</span>
          </div>
        </div>
      </div>

      <!-- 6 (LARGE): Cevre birimler -->
      <div class="bento bento-integ reveal reveal-rotate">
        <div class="bento-content">
          <div class="bento-eyebrow">NELERLE KONUŞUYOR</div>
          <h3>Zaten kullandığınız aletlerle</h3>
          <p>Elinizdeki Excel dosyası, barkod okuyucu, etiket yazıcısı, WhatsApp ve Google Maps ile çalışır. Muhasebe tarafında Logo'ya aktarım mevcut; e-Fatura / GİB entegrasyonu yok.</p>
          <p class="bento-foot-note">WhatsApp ve SMS için üçüncü taraf hesap gerekir: WhatsApp Business API (Meta) hesabı ve onaylı mesaj şablonu, SMS için Netgsm kontörü. Bu hesapların ücretini sağlayıcıya siz ödersiniz; kurulumu birlikte yaparız.</p>
        </div>
        <div class="bento-integ-cloud">
          <div class="integ-orbit"></div>
          <div class="integ-orbit integ-orbit-2"></div>
          <div class="integ-center">
            <div class="integ-center-inner">
              <span class="logo-mark"><svg class="logo-n" viewBox="0 0 230 200" aria-hidden="true"><g class="nx-body"><rect x="30" y="20" width="38" height="160"/><polygon points="68,20 106,20 150,180 112,180"/><rect x="150" y="20" width="38" height="160"/></g><path class="nx-cut" d="M14 154 C84 120 152 78 224 34" pathLength="100"/></svg></span>
            </div>
          </div>
          <div class="integ-node n1" style="--del:0s">Excel</div>
          <div class="integ-node n2" style="--del:.4s">CSV</div>
          <div class="integ-node n3" style="--del:.8s">Logo</div>
          <div class="integ-node n4" style="--del:1.2s">LS2208</div>
          <div class="integ-node n5" style="--del:1.6s">Zebra</div>
          <div class="integ-node n6" style="--del:2.0s">WhatsApp<sup class="integ-star">*</sup></div>
          <div class="integ-node n7" style="--del:2.4s">SMS<sup class="integ-star">*</sup></div>
          <div class="integ-node n8" style="--del:2.8s">Maps rota</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ========== ONCE / SONRA ========== -->
<section class="beforeafter" id="donusum">
  <div class="fon fon-once" aria-hidden="true">
    <picture>
      <source type="image/avif" media="(max-width:767px)" srcset="/fon/once-m.avif">
      <source type="image/webp" media="(max-width:767px)" srcset="/fon/once-m.webp">
      <source type="image/avif" srcset="/fon/once.avif">
      <source type="image/webp" srcset="/fon/once.webp">
      <img src="/fon/once.webp" alt="" loading="lazy" decoding="async" width="1920" height="1072">
    </picture>
  </div>

  <div class="container">
    <div class="section-head reveal">
      <span class="section-eyebrow"><span class="dot" style="background:#10b981"></span>Ay Sonu</span>
      <h2 class="section-title">Aynı iş, <span class="gradient-text">iki farklı ay sonu</span></h2>
      <p class="section-sub">Kiralama bayisinin ay sonu kapanışı, defter–Excel karışımıyla ve tek programla nasıl görünüyor?</p>
    </div>

    <div class="ba-grid">
      <div class="ba-side before reveal reveal-left">
        <span class="ba-side-label">😩 EXCEL + DEFTER</span>
        <h3>Ay sonu avı</h3>
        <ul class="ba-list">
          <li>Sayaç kâğıtları teknisyenin çantasında, bir kısmı hiç ulaşmıyor</li>
          <li>Hangi cihazın sayacı okundu, hangisi atlandı — kimse tam bilmiyor</li>
          <li>Dahil hacim ve aşım hesabı elle, her ay yeniden</li>
          <li>Servis fişleri ayrı, kira faturası ayrı, sarf çıkışı ayrı yerde</li>
          <li>Toner ne zaman biter belli değil; cihaz durunca öğreniliyor</li>
          <li>Hangi cihaz para kazandırıyor, hangisi sürekli servis yiyor — bilinmiyor</li>
          <li>Borcunu geciktireni bulmak için cari defteri tek tek geziliyor</li>
        </ul>
        <div class="ba-side-stat">Faturalanmamış sayaç hacmi <strong>görünmez</strong>: fark edilse bile ay kapanmıştır.</div>
      </div>

      <div class="ba-divider">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      </div>

      <div class="ba-side after reveal reveal-right">
        <span class="ba-side-label">🚀 NEXTUS SERVİS</span>
        <h3>Ay sonu kapanışı</h3>
        <ul class="ba-list">
          <li>Sayaç turu ile müşteri bazlı toplu giriş — teknisyen telefondan</li>
          <li>Fatura öncesi sayaç ön kontrolü eksik kalanları listeler</li>
          <li>Dahil hacim + aşım fiyatı otomatik hesaplanır</li>
          <li>Servis fişi, kira faturası, sarf çıkışı aynı cihaz kartında</li>
          <li>Toner tükenme tahmini sayaç hızından "kaç gün sonra biter" der</li>
          <li>Cihaz kârlılık raporu ve marka/model güvenilirliği elinizde</li>
          <li>Toplu borç hatırlatma SMS/WhatsApp ile tek seferde gider</li>
        </ul>
        <div class="ba-side-stat"><strong>Kaçan Gelir paneli</strong> faturalanmamış cihazları isim isim önünüze koyar.</div>
      </div>
    </div>
  </div>
</section>

<!-- ========== NASIL CALISIR ========== -->
<section class="how" id="nasil">
  <div class="container">
    <div class="section-head reveal">
      <span class="section-eyebrow"><span class="dot"></span>Nasıl Başlıyoruz</span>
      <h2 class="section-title">3 adımda <span class="gradient-text">ilk ay sonunuza</span></h2>
      <p class="section-sub">IT departmanı, sunucu kurulumu, aylarca proje yok. Konuşma, taşıma, ilk kapanış.</p>
    </div>

    <div class="how-grid">
      <div class="how-card reveal reveal-flip">
        <div class="step-emblem">
          <div class="step-emblem-glow"></div>
          <div class="step-emblem-ring"></div>
          <div class="step-emblem-inner">
            <span class="step-emblem-label">ADIM</span>
            <span class="step-emblem-num">01</span>
          </div>
          <span class="step-emblem-icon">💬</span>
        </div>
        <h3>WhatsApp'tan yazın</h3>
        <p>Ekran paylaşımıyla 15 dakikalık canlı demo. Kendi cihaz listenizden bir örnekle bakarız — hazır sunum değil, gerçek ekran.</p>
        <div class="how-meta">⏱ 15 dakika</div>
      </div>
      <div class="how-card reveal reveal-flip">
        <div class="step-emblem">
          <div class="step-emblem-glow"></div>
          <div class="step-emblem-ring"></div>
          <div class="step-emblem-inner">
            <span class="step-emblem-label">ADIM</span>
            <span class="step-emblem-num">02</span>
          </div>
          <span class="step-emblem-icon">📥</span>
        </div>
        <h3>Verinizi biz taşıyalım</h3>
        <p>Müşteri ve cihaz listenizi Excel/CSV ile aktarıyoruz. Kurulum, aktarım ve 2 saat eğitim — <strong>liste fiyatı ₺12.000; kuruluş döneminde ücretsiz</strong>.</p>
        <div class="how-meta">🤝 Birebir kurulum</div>
      </div>
      <div class="how-card reveal reveal-flip">
        <div class="step-emblem">
          <div class="step-emblem-glow"></div>
          <div class="step-emblem-ring"></div>
          <div class="step-emblem-inner">
            <span class="step-emblem-label">ADIM</span>
            <span class="step-emblem-num">03</span>
          </div>
          <span class="step-emblem-icon">🧾</span>
        </div>
        <h3>İlk ay sonunu birlikte kapatalım</h3>
        <p>Sayaç turu → ön kontrol → kira icmali. İlk kapanışta yanınızdayız; kaçan geliri ilk aydan görün.</p>
        <div class="how-meta">📟 14 gün ücretsiz</div>
      </div>
    </div>
  </div>
</section>

<!-- ========== KURULUM BANNERI ========== -->
<section class="guarantee">
  <div class="container">
    <div class="guarantee-card reveal reveal-scale">
      <div class="guarantee-shield">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9,12 11,14 15,10"/>
        </svg>
      </div>
      <div>
        <div class="guarantee-eyebrow">★ KURULUŞ DÖNEMİ</div>
        <h3>Kurulum paketi şu an ücretsiz</h3>
        <p>Kurulum + Excel veri aktarımı + 2 saat eğitim için <strong>liste fiyatımız ₺12.000</strong>. Kuruluş döneminde ücret almıyoruz — çünkü ürünü sahada birlikte oturtuyoruz.</p>
        <ul class="guarantee-list">
          <li>14 gün ücretsiz deneme <span class="trial-limit">(deneme hesabı: 2 kullanıcı · 50 fiş)</span></li>
          <li>Kredi kartı istenmez</li>
          <li>Taahhüt yok</li>
          <li>Yedeğinizi her an indirin</li>
        </ul>
      </div>
      <div class="guarantee-cta" style="display:flex;align-items:center">
        <a href="https://wa.me/905526961703?text=Merhaba%2C%20kurulus%20donemi%20kurulum%20paketi%20hakkinda%20bilgi%20istiyorum" target="_blank" rel="noopener" class="btn btn-grad">Yerimi ayır</a>
      </div>
    </div>
  </div>
</section>

<!-- ========== FIYATLANDIRMA ========== -->
<section class="pricing" id="fiyatlandirma">
  <div class="container">
    <div class="section-head reveal">
      <span class="section-eyebrow"><span class="dot" style="background:var(--p2-1)"></span>Fiyatlandırma</span>
      <h2 class="section-title">Taban fiyat + <span class="gradient-text">cihaz başına ₺25</span></h2>
      <p class="section-sub">Her pakette dahil bir cihaz adedi var; dahil sayının üstündeki her kiralık cihaz <strong>üç pakette de ₺25</strong>. Fiyatlar KDV hariçtir.</p>

      <div class="toggle-wrap reveal">
        <div class="toggle" id="billingToggle" data-active="monthly">
          <div class="indicator"></div>
          <button class="toggle-btn active" data-bill="monthly">Aylık</button>
          <button class="toggle-btn" data-bill="yearly">Yıllık <span class="save-badge">2 ay bedava</span></button>
        </div>
      </div>
    </div>

    <div class="pricing-grid">
      <!-- BASLANGIC -->
      <div class="price-card reveal reveal-scale" data-plan="baslangic" data-base="1749" data-included="20">
        <div class="price-icon">🌱</div>
        <div class="price-name">Başlangıç</div>
        <div class="price-tag">20 cihaza kadar</div>
        <div class="price-amount">
          <span class="currency">₺</span>
          <span class="num">1.749</span>
          <span class="period">/ ay</span>
          <span class="price-vat">+KDV</span>
        </div>
        <div class="price-note">İlk <strong>20</strong> kiralık cihaz dahil · sonrası cihaz başına ₺25</div>
        <div class="price-calc" hidden></div>
        <a href="https://wa.me/905526961703?text=Merhaba%2C%20Baslangic%20paketi%20icin%2014%20gunluk%20denemeyi%20baslatmak%20istiyorum" target="_blank" rel="noopener" class="btn btn-ghost btn-block">14 Gün Ücretsiz Dene</a>
        <ul class="price-features">
          <li class="has"><strong>İlk 20 kiralık cihaz dahil</strong> · aşan her cihaz ₺25</li>
          <li class="has"><strong>3 kullanıcı · 200 servis fişi/ay</strong></li>
          <li class="has">Müşteri · cihaz · servis fişi · QR arıza bildirimi</li>
          <li class="has">Stok · barkod · Zebra etiket · toner tahmini</li>
          <li class="has">Muhasebe / cari hesap</li>
          <li class="has">Bayi Pazarı <span class="feat-note">(yeni açılıyor)</span></li>
          <li class="has">Kurulum + Excel aktarımı + 2 saat eğitim</li>
          <li class="no">Sayaç okuma ve otomatik kira faturalaması</li>
          <li class="no">SLA uyum raporu</li>
          <li class="no">Kaçan Gelir paneli · tahsilat · rota</li>
          <li class="no">Marka/model güvenilirlik raporları</li>
        </ul>
      </div>

      <!-- PROFESYONEL -->
      <div class="price-card featured reveal reveal-scale" data-plan="profesyonel" data-base="2099" data-included="25">
        <div class="price-badge">Önerdiğimiz başlangıç noktası</div>
        <div class="price-icon">⚡</div>
        <div class="price-name">Profesyonel</div>
        <div class="price-tag">21–100 cihaz</div>
        <div class="price-amount">
          <span class="currency">₺</span>
          <span class="num">2.099</span>
          <span class="period">/ ay</span>
          <span class="price-vat">+KDV</span>
        </div>
        <div class="price-note">İlk <strong>25</strong> kiralık cihaz dahil · sonrası cihaz başına ₺25</div>
        <div class="price-calc" hidden></div>
        <a href="https://wa.me/905526961703?text=Merhaba%2C%20Profesyonel%20paket%20icin%2014%20gunluk%20denemeyi%20baslatmak%20istiyorum" target="_blank" rel="noopener" class="btn btn-grad btn-block">14 Gün Ücretsiz Dene</a>
        <ul class="price-features">
          <li class="has"><strong>İlk 25 kiralık cihaz dahil</strong> · aşan her cihaz ₺25</li>
          <li class="has"><strong>10 kullanıcı · sınırsız servis fişi</strong></li>
          <li class="has"><strong>Başlangıç'taki her şey</strong>, ayrıca:</li>
          <li class="has">Sayaç okuma ve otomatik kira faturalaması</li>
          <li class="has">Tahsilat takibi · rota planlama · geç sayaç takibi</li>
          <li class="has">Kaçan Gelir paneli ve cihaz kârlılığı</li>
          <li class="has">SLA uyum raporu <span class="feat-note">(sözleşmedeki müdahale/çözüm süresi, mesai saatine göre)</span></li>
          <li class="has">WhatsApp bildirim <span class="feat-note">(WhatsApp Business API hesabı gerekir)</span> · toplu borç hatırlatma SMS <span class="feat-note">(Netgsm kontörü ayrıca)</span></li>
          <li class="has">Kurulum + Excel aktarımı + 2 saat eğitim</li>
          <li class="no">Marka/model güvenilirlik raporları</li>
        </ul>
      </div>

      <!-- KURUMSAL -->
      <div class="price-card reveal reveal-scale" data-plan="kurumsal" data-base="5249" data-included="100">
        <div class="price-icon">🏢</div>
        <div class="price-name">Kurumsal</div>
        <div class="price-tag">100+ cihaz · 50 kullanıcıya kadar</div>
        <div class="price-amount">
          <span class="currency">₺</span>
          <span class="num">5.249</span>
          <span class="period">/ ay</span>
          <span class="price-vat">+KDV</span>
        </div>
        <div class="price-note">İlk <strong>100</strong> kiralık cihaz dahil · sonrası cihaz başına ₺25</div>
        <div class="price-calc" hidden></div>
        <a href="https://wa.me/905526961703?text=Merhaba%2C%20Kurumsal%20paket%20icin%20gorusmek%20istiyorum" target="_blank" rel="noopener" class="btn btn-ghost btn-block">Görüşelim</a>
        <ul class="price-features">
          <li class="has"><strong>İlk 100 kiralık cihaz dahil</strong> · aşan her cihaz ₺25</li>
          <li class="has"><strong>50 kullanıcı · sınırsız servis fişi</strong></li>
          <li class="has"><strong>Profesyonel'deki her şey</strong>, ayrıca:</li>
          <li class="has">Marka/model güvenilirlik raporları</li>
          <li class="has">Cihaz yenileme raporu</li>
          <li class="has">Kurulum + Excel aktarımı + 2 saat eğitim</li>
        </ul>
      </div>
    </div>

    <div class="pricing-foot reveal">
      <span class="check-mini">✓</span> 14 gün ücretsiz deneme <span class="trial-limit">(deneme: 2 kullanıcı · 50 fiş)</span> &nbsp;·&nbsp;
      <span class="check-mini">✓</span> Kredi kartı istenmez &nbsp;·&nbsp;
      <span class="check-mini">✓</span> Yıllık ödemede 2 ay bedava &nbsp;·&nbsp;
      <span class="check-mini">✓</span> Fiyatlar KDV hariçtir
      <div style="margin-top:16px;font-size:13px;color:var(--text-faint);max-width:720px;margin-left:auto;margin-right:auto;line-height:1.6">
        Aşım bedeli üç pakette de aynıdır (₺25); taban fiyat ve dahil cihaz adedi paketten pakete değişir. Paketler asıl olarak <strong>açılan özellikler ve kullanıcı sayısıyla</strong> ayrışır: sayaç/kira faturalaması, tahsilat, rota ve Kaçan Gelir paneli Profesyonel ile başlar, marka/model güvenilirlik raporları Kurumsal'dadır. Bu yüzden sadece cihaz sayısına bakıp karar vermeyin — <strong>ihtiyacınız olan özelliğin hangi pakette açık olduğuna bakın</strong>. Kaydırıcıyı oynattığınızda kartlar kendi cihaz sayınıza göre güncellenir. Hangi paketin size oturduğundan emin değilseniz
        <a href="https://wa.me/905526961703?text=Merhaba%2C%20cihaz%20sayima%20gore%20hangi%20paket%20uygun%20ogrenmek%20istiyorum" target="_blank" rel="noopener" style="color:#5eead4;border-bottom:1px solid rgba(94,234,212,0.35)">WhatsApp'tan yazın</a>, birlikte seçelim.
      </div>
    </div>
  </div>
</section>

<!-- ========== SSS ========== -->
<section class="faq" id="sss">
  <div class="container">
    <div class="section-head reveal">
      <span class="section-eyebrow"><span class="dot" style="background:var(--p3-1)"></span>SSS</span>
      <h2 class="section-title">Sık sorulan <span class="gradient-text">sorular</span></h2>
      <p class="section-sub">En çok sorulanları, olmayanları da gizlemeden yazdık. Kalanı için WhatsApp'tan yazın.</p>
    </div>

    <div class="faq-wrap">
      <div class="faq-item reveal reveal-left">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-1" id="faq-q-1">
          <span>Fiyat tam olarak nasıl hesaplanıyor?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-1" role="region" aria-labelledby="faq-q-1" aria-hidden="true">
          <p>Taban fiyat + dahil cihaz adedi + aşım. Örnek: <strong>150 kiralık cihazınız varsa Profesyonel pakette</strong> ₺2.099 taban + (150 − 25) × ₺25 = <strong>₺5.224/ay + KDV</strong>. Aşım bedeli üç pakette de ₺25'tir. Yıllık ödemede aylık toplamın 10 katını ödersiniz — yani <strong>2 ay bedava</strong>.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-right">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-2" id="faq-q-2">
          <span>Kurulum ve veri aktarımı ne kadar?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-2" role="region" aria-labelledby="faq-q-2" aria-hidden="true">
          <p>Kurulum + Excel/CSV veri aktarımı + 2 saat eğitim için <strong>liste fiyatımız ₺12.000</strong>; kuruluş döneminde <strong>ücretsiz</strong> yapıyoruz. Müşteri ve cihaz listenizi mevcut dosyanızdan aktarıyoruz, sıfırdan veri girmenize gerek yok.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-left">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-3" id="faq-q-3">
          <span>e-Fatura entegrasyonu var mı?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-3" role="region" aria-labelledby="faq-q-3" aria-hidden="true">
          <p><strong>Hayır, şu an e-Fatura / GİB entegrasyonu yok.</strong> Bugün için <strong>Logo'ya aktarım mevcut</strong>. Tarih veremediğimiz bir şeye "yolda" demek istemiyoruz — kararınızı ürünün bugünkü haliyle verin.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-right">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-4" id="faq-q-4">
          <span>Müşterim kendi panelinden cihazlarını görebiliyor mu?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-4" role="region" aria-labelledby="faq-q-4" aria-hidden="true">
          <p><strong>Müşteri portalı yok</strong> — müşteriniz giriş yapıp cihazlarını göremez. Bunun yerine cihazdaki <strong>QR kodu okutup giriş yapmadan arıza bildirebilir</strong>, siz de yapılan işlem ve tutarı tek tıkla WhatsApp'tan gönderirsiniz.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-left">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-5" id="faq-q-5">
          <span>Teknisyenin konumunu canlı görebilir miyim?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-5" role="region" aria-labelledby="faq-q-5" aria-hidden="true">
          <p><strong>Hayır, canlı konum / GPS takibi yok.</strong> Olan şey rota planlama: günün duraklarını sıralayıp <strong>Google Maps çok duraklı bağlantısı</strong> üretiyoruz; teknisyen tek dokunuşla navigasyona geçiyor.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-right">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-6" id="faq-q-6">
          <span>Mobil uygulaması var mı?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-6" role="region" aria-labelledby="faq-q-6" aria-hidden="true">
          <p>App Store veya Play'de <strong>ayrı bir uygulama yok</strong>. Nextus Servis <strong>web + PWA</strong> olarak çalışır: tarayıcıdan açıp ana ekrana eklersiniz, telefonda uygulama gibi durur. Teknisyen sayaç girişini ve fiş kapatmayı telefondan yapar.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-left">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-7" id="faq-q-7">
          <span>Sayaç bazlı faturalama nasıl işliyor?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-7" role="region" aria-labelledby="faq-q-7" aria-hidden="true">
          <p><strong>Sayaç Turu</strong> ekranında müşteri bazlı toplu sayaç girersiniz. Sözleşmedeki <strong>dahil hacim</strong> ve <strong>aşım fiyatı</strong> üzerinden kira faturası otomatik hesaplanır. Fatura öncesi <strong>sayaç ön kontrolü</strong> eksik okumaları listeler, <strong>geç sayaç takibi</strong> gecikenleri gösterir, <strong>Kaçan Gelir paneli</strong> faturalanmamışları isim isim önünüze koyar.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-right">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-8" id="faq-q-8">
          <span>Verilerim bana ait mi? Dışarı alabilir miyim?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-8" role="region" aria-labelledby="faq-q-8" aria-hidden="true">
          <p>Evet. <strong>Yedeğinizi tek tıkla indirirsiniz</strong> — tüm verinizi içeren bir JSON dosyası olarak (yönetici yetkisiyle). Müşteri ve cihaz listenizi <strong>Excel/CSV ile içeri aktarıyoruz</strong>; dışarı çıkan dosya bugün JSON formatındadır, Excel dışa aktarımı henüz yok. Hesabınızda <strong>isteğe bağlı iki adımlı doğrulama (2FA)</strong> açabilirsiniz.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-left">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-9" id="faq-q-9">
          <span>Kaç bayi kullanıyor?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-9" role="region" aria-labelledby="faq-q-9" aria-hidden="true">
          <p>Dürüst cevap: <strong>erken dönemdeyiz</strong> ve şu an kurucu müşterimizle sahada çalışıyoruz. Bu yüzden bu sayfada müşteri sayısı, yorum, yıldız puanı veya basın logosu göremezsiniz — <strong>uydurmamayı tercih ettik</strong>. İkna yöntemimiz canlı ekranı göstermek ve ilk ay sonu kapanışını birlikte yapmak.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-right">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-10" id="faq-q-10">
          <span>Yapay zekâ özellikleri var mı?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-10" role="region" aria-labelledby="faq-q-10" aria-hidden="true">
          <p><strong>Hayır.</strong> Toner tükenme tahmini gibi hesaplar yapay zekâ değil, <strong>sayaç hızına dayalı düz aritmetik</strong>. Programın işi tahmin etmek değil, kaydı doğru tutup faturayı doğru kesmek.</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ========== KURUCU ==========
     Yuzu olmayan yazilim firmalarina karsi tek gercek fark: yazani taniyor olmak.
     Ovgu degil, DOGRULANABILIR taahhutler: kimin yazdigi, nerede yazildigi,
     kime ulasilacagi. Uydurma rakam ya da unvan yok.                            -->
<section class="founder-sec">
  <div class="container">
    <div class="founder-card reveal">
      <div class="founder-head">
        <div class="founder-ava" aria-hidden="true">MN</div>
        <div>
          <h3 class="founder-name">Mehmet Naim Çetin</h3>
          <div class="founder-role">Kurucu · Yazılımı yazan kişi</div>
        </div>
      </div>

      <p class="founder-lead">
        Bir fotokopi bayisinde, okunmamış sayaçlar yüzünden <strong>faturalanmamış işler</strong> olduğunu
        gördüm. Sorunu masa başında değil, bayinin yanında oturarak çözdüm — Nextus Servis oradan çıktı.
      </p>

      <div class="founder-grid">
        <div class="founder-item">
          <span class="founder-item-t">Doğrudan bana ulaşırsınız</span>
          Çağrı merkezi yok. Yazan kişi ile konuşursunuz.
        </div>
        <div class="founder-item">
          <span class="founder-item-t">Kurulumu ben yaparım</span>
          Excel'inizi ben aktarırım, ekibinize ben anlatırım.
        </div>
        <div class="founder-item">
          <span class="founder-item-t">İstediğiniz an çıkarsınız</span>
          Veriniz sizin. Tek tuşla indirir, gidersiniz.
        </div>
      </div>

      <div class="founder-cta">
        <a href="https://wa.me/905526961703?text=Merhaba%20Mehmet%20Naim%2C%20Nextus%20Servis%20hakkinda%20konusmak%20istiyorum"
           target="_blank" rel="noopener" class="btn btn-grad">Doğrudan bana yazın →</a>
        <span class="founder-tel">0552 696 17 03</span>
      </div>
    </div>
  </div>
</section>

<!-- ========== KAPANIS CTA ========== -->
<section class="cta-final">
  <div class="fon fon-kapanis" aria-hidden="true">
    <picture>
      <source type="image/avif" media="(max-width:767px)" srcset="/fon/kapanis-m.avif">
      <source type="image/webp" media="(max-width:767px)" srcset="/fon/kapanis-m.webp">
      <source type="image/avif" srcset="/fon/kapanis.avif">
      <source type="image/webp" srcset="/fon/kapanis.webp">
      <img src="/fon/kapanis.webp" alt="" loading="lazy" decoding="async" width="1920" height="1072">
    </picture>
    <video class="fon-v" data-src="/fon/kapanis.mp4" muted loop playsinline preload="none" tabindex="-1" aria-hidden="true"></video>
  </div>

  <div class="container">
    <div class="cta-card reveal reveal-scale">
      <div class="cta-mesh"></div>
      <div class="cta-inner">
        <span class="section-eyebrow"><span class="dot"></span>Şimdi Başla</span>
        <h2 class="cta-title">Cihazlarınızı bir kere sayalım, <span class="gradient-text">kaçanı birlikte görelim</span></h2>
        <p class="cta-sub">14 gün ücretsiz (deneme hesabı: 2 kullanıcı · 50 fiş). Kredi kartı istenmez, taahhüt yok. Kurulum + Excel aktarımı + 2 saat eğitim kuruluş döneminde ücretsiz.</p>
        <div class="cta-actions">
          <a href="https://wa.me/905526961703?text=Merhaba%2C%20Nextus%20Servis%20icin%2014%20gunluk%20denemeyi%20baslatmak%20istiyorum" target="_blank" rel="noopener" class="btn btn-grad btn-lg btn-pulse">WhatsApp'tan başlayalım <span class="arr">→</span></a>
          <a href="#hesap" class="btn btn-ghost btn-lg">Önce hesabı göreyim</a>
        </div>
        <div class="cta-meta">
          <span>✓ 0552 696 17 03</span>
          <span>✓ Birebir kurulum</span>
          <span>✓ Verinizi her an indirin</span>
        </div>

        <!-- WhatsApp kullanmak istemeyen / mesai dışı bakan ziyaretçi için ikinci yol.
             /api/talep talebi önce veritabanına yazar; CRM bağlı olmasa da kaybolmaz. -->
        <div class="cta-form-wrap">
          <div class="cta-form-or">— ya da numaranızı bırakın, biz arayalım —</div>
          <form id="leadForm" class="cta-form" novalidate>
            <input type="text" name="firma" id="lfFirma" placeholder="Firma adı" autocomplete="organization" required>
            <input type="tel" name="telefon" id="lfTel" placeholder="Telefon" autocomplete="tel" inputmode="tel" required>
            <input type="text" name="cihazSayisi" id="lfCihaz" placeholder="Kaç kiralık cihaz?" inputmode="numeric">
            <!-- bal küpü: gerçek kullanıcı görmez, botlar doldurur -->
            <input type="text" name="website_hp" id="lfHp" tabindex="-1" autocomplete="off" aria-hidden="true">
            <button type="submit" class="btn btn-grad" id="lfBtn">Beni arayın</button>
          </form>
          <div id="lfMsg" class="cta-form-msg" role="status" aria-live="polite"></div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ========== FOOTER ========== -->
<footer class="footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-about">
        <!-- Marka animasyonu (480x480, 5 sn, ~1 MB). Ayrı bir bölüm olarak konunca
             yamalı duruyordu; asıl yeri burası — markanın imza attığı yer.
             Videonun kendi zemini koyu, altbilgiyle aynı; çerçeve gerekmiyor.
             src baştan verilmez, görüşe yaklaşınca yüklenir (sayfa kasmasın). -->
        <video class="brand-clip-v" data-src="/nextus-servis.mp4"
               autoplay muted loop playsinline preload="none" disablepictureinpicture
               aria-label="Nextus Servis marka animasyonu"></video>
        <a href="#" class="logo">
          <span class="logo-mark"><svg class="logo-n" viewBox="0 0 230 200" aria-hidden="true"><g class="nx-body"><rect x="30" y="20" width="38" height="160"/><polygon points="68,20 106,20 150,180 112,180"/><rect x="150" y="20" width="38" height="160"/></g><path class="nx-cut" d="M14 154 C84 120 152 78 224 34" pathLength="100"/></svg></span>
          <span class="logo-text">Nextus Servis</span>
        </a>
        <p>Yazıcı, fotokopi ve ofis cihazı kiralayan ve servis veren bayiler için sayaç, kira faturalaması ve servis takip programı. NEXUS GROUP ürünüdür.</p>
      </div>

      <div class="footer-col">
        <h3>Ürün</h3>
        <a href="#urun">Ne yapıyor</a>
        <a href="#ozellikler">Günlük kullanım</a>
        <a href="#donusum">Ay sonu karşılaştırması</a>
        <a href="#fiyatlandirma">Fiyatlar</a>
      </div>

      <div class="footer-col">
        <h3>Karar vermeden</h3>
        <a href="#hesap">Kaçan gelir hesabı</a>
        <a href="#nasil">Nasıl başlıyoruz</a>
        <a href="#sss">Sık sorulan sorular</a>
      </div>

      <div class="footer-col">
        <h3>İletişim</h3>
        <a href="https://wa.me/905526961703?text=Merhaba%2C%20Nextus%20Servis%20hakkinda%20bilgi%20istiyorum" target="_blank" rel="noopener">WhatsApp: 0552 696 17 03</a>
        <a href="tel:+905526961703">Telefon: 0552 696 17 03</a>
      </div>
    </div>

    <div class="footer-bottom">
      <span>© 2026 Nextus Servis — NEXUS GROUP</span>
      <span class="footer-meta">Fiyatlar KDV hariçtir · Hesaplayıcı sonuçları tahmindir</span>
    </div>
  </div>
</footer>

<!-- WhatsApp Floating Button -->
<a href="https://wa.me/905526961703?text=Merhaba%2C%20Nextus%20Servis%20demosu%20ve%20fiyat%20bilgisi%20istiyorum" class="wa-float" aria-label="WhatsApp ile iletişim" target="_blank" rel="noopener">
  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
  <span class="wa-tooltip">Demo için yazın</span>
</a>

<!-- ========== JAVASCRIPT ========== -->
`;
const JS = `
document.documentElement.classList.add('js');
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  /* ============================================================
     ORTAK YARDIMCILAR
     ============================================================ */
  function formatTL(n) {
    var neg = Math.round(n) < 0;
    var s = Math.round(Math.abs(n)).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
    return (neg ? '−' : '') + s;
  }
  /* isaretli para: eksi, para biriminin ONUNE gelir */
  function tl(n) {
    return (Math.round(n) < 0 ? '−₺' : '₺') + Math.round(Math.abs(n)).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, '.');
  }
  function formatCompact(n) {
    var neg = n < 0, a = Math.abs(n);
    var s;
    if (a >= 1000000) s = (a / 1000000).toFixed(1).replace('.', ',') + 'M';
    else if (a >= 1000) s = Math.round(a / 1000) + 'K';
    else s = Math.round(a).toString();
    return (neg ? '−' : '') + s;
  }
  function dec1(n) { return n.toFixed(1).replace('.', ','); }

  /* ============================================================
     FIYAT MODELI  (tek kaynak — ROI ve fiyat kartlari ayni yerden okur)
     ============================================================ */
  var PER_DEVICE = 25;                 // dahil sayinin ustundeki her cihaz — UC PAKETTE DE AYNI
  var YEARLY_MONTHS = 10;              // yillik odeme = aylik x10 (2 ay bedava)
  var RECOVERY = 0.70;                 // kacan gelirin geri kazanildigi varsayilan oran
  var PLANS = {
    baslangic:   { name: 'Başlangıç',   base: 1749, included: 20 },
    profesyonel: { name: 'Profesyonel', base: 2099, included: 25 },
    kurumsal:    { name: 'Kurumsal',    base: 5249, included: 100 }
  };
  function planMonthly(plan, devices) {
    return plan.base + Math.max(0, devices - plan.included) * PER_DEVICE;
  }
  // ROI hesabinin dayandigi paket: Profesyonel.
  // Sebep: Kacan Gelir paneli, sayac/kira faturalamasi ve tahsilat bu paketle acilir;
  // yani ROI'yi ureten ozelliklerin ilk bulundugu paket budur.
  // Ucret farki fiyat tablosunda uc paket icin ayni anda gosterildigi icin
  // burada "size su paket uygun" seklinde bir iddia uretilmez.
  var ROI_PLAN_KEY = 'profesyonel';

  var deviceCount = 60;        // ROI slider'indan gelen guncel cihaz sayisi
  var deviceTouched = false;   // slider'a dokunulmadan fiyat kartlari TABAN fiyati gosterir
  var billing = 'monthly';

  /* ============================================================
     STICKY NAV
     ============================================================ */
  var nav = document.getElementById('nav');
  function onScrollNav() {
    if (!nav) return;
    if (window.scrollY > 20) nav.classList.add('scrolled');
    else nav.classList.remove('scrolled');
  }
  window.addEventListener('scroll', onScrollNav, { passive: true });
  onScrollNav();

  /* ============================================================
     MOBIL MENU
     ============================================================ */
  var menuBtn = document.getElementById('menuBtn');
  var mobileMenu = document.getElementById('mobileMenu');
  if (menuBtn && mobileMenu) {
    var menuLinks = mobileMenu.querySelectorAll('a');

    var closeMenu = function (returnFocus) {
      if (!mobileMenu.classList.contains('open')) return;
      mobileMenu.classList.remove('open');
      menuBtn.classList.remove('active');
      menuBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      if (returnFocus) menuBtn.focus();
    };
    var openMenu = function () {
      mobileMenu.classList.add('open');
      menuBtn.classList.add('active');
      menuBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      if (menuLinks.length) menuLinks[0].focus();
    };

    menuBtn.addEventListener('click', function () {
      if (mobileMenu.classList.contains('open')) closeMenu(true);
      else openMenu();
    });
    Array.prototype.forEach.call(menuLinks, function (a) {
      a.addEventListener('click', function () { closeMenu(false); });
    });

    /* Escape ile kapan + odagi menunun icinde tut */
    document.addEventListener('keydown', function (e) {
      if (!mobileMenu.classList.contains('open')) return;
      if (e.key === 'Escape' || e.key === 'Esc') { closeMenu(true); return; }
      if (e.key !== 'Tab' || !menuLinks.length) return;
      var first = menuLinks[0], last = menuLinks[menuLinks.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  /* ============================================================
     SCROLL ILE BELIRME
     ============================================================ */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e, idx) {
        if (e.isIntersecting) {
          setTimeout(function () { e.target.classList.add('in'); }, idx * 60);
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });

    /* Emniyet agi: IntersectionObserver kisitlanirsa (gizli sekme, eski tarayici)
       gorunum icine giren bloklar yine de acilsin. */
    var revealFallback = function () {
      var left = 0;
      Array.prototype.forEach.call(reveals, function (el) {
        if (el.classList.contains('in')) return;
        if (el.getBoundingClientRect().top < window.innerHeight * 1.1) el.classList.add('in');
        else left++;
      });
      if (left === 0) window.removeEventListener('scroll', revealFallback);
    };
    window.addEventListener('scroll', revealFallback, { passive: true });
    setTimeout(revealFallback, 1500);
    /* NOT: lead formu asagida, bu blogun disinda baglanir. */

    /* SON EMNIYET AGI — kosulsuz.
       Yukaridaki yedek yalnizca GORUS ALANINA YAKIN bloklari acar; sayfa hic
       kaydirilmazsa ve IntersectionObserver da calismazsa geri kalan her sey
       KALICI GIZLI kalir (dogrulama sirasinda 40 blogun 40'i boyle gizli kaldi:
       window.innerHeight o anda 0 raporlanmisti, dolayisiyla hicbir blok
       "gorus alaninda" sayilmadi).
       Bos bir sayfa gostermektense animasyonu kaybetmek yeglenir: 3 saniye
       sonra hala gizli olan ne varsa kosulsuz acilir. IO calisirsa bu noktada
       zaten hepsi acilmis olur ve bu satirin hicbir etkisi olmaz. */
    setTimeout(function () {
      Array.prototype.forEach.call(reveals, function (el) { el.classList.add('in'); });
      window.removeEventListener('scroll', revealFallback);
    }, 3000);
  } else {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('in'); });
  }

  /* ============================================================
     SSS AKORDIYON
     ============================================================ */
  function setFaqState(item, open) {
    item.classList.toggle('open', open);
    var btn = item.querySelector('.faq-q');
    var panel = item.querySelector('.faq-a');
    if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    /* kapali panel ekran okuyucudan da gizlensin (max-height:0 tek basina gizlemiyor) */
    if (panel) panel.setAttribute('aria-hidden', open ? 'false' : 'true');
  }
  Array.prototype.forEach.call(document.querySelectorAll('.faq-q'), function (q) {
    q.addEventListener('click', function () {
      var item = q.parentElement;
      var wasOpen = item.classList.contains('open');
      Array.prototype.forEach.call(document.querySelectorAll('.faq-item'), function (i) {
        setFaqState(i, false);
      });
      if (!wasOpen) setFaqState(item, true);
    });
  });

  /* ============================================================
     FIYAT KARTLARI
     ============================================================ */
  var priceCards = document.querySelectorAll('.price-card');

  function renderPriceCards() {
    Array.prototype.forEach.call(priceCards, function (card) {
      var base = +card.dataset.base;
      var inc = +card.dataset.included;
      // Slider'a dokunulmadiysa "dahil" adet kullanilir -> ekranda TABAN fiyat gorunur
      var dev = deviceTouched ? deviceCount : inc;
      var over = Math.max(0, dev - inc);
      var monthly = base + over * PER_DEVICE;
      var yearly = monthly * YEARLY_MONTHS;

      var amt = card.querySelector('.price-amount');
      var num = card.querySelector('.price-amount .num');
      var per = card.querySelector('.price-amount .period');
      if (num && per && amt) {
        if (billing === 'yearly') {
          num.textContent = formatTL(yearly);
          per.textContent = '/ yıl';
          amt.classList.add('yearly');
        } else {
          num.textContent = formatTL(monthly);
          per.textContent = '/ ay';
          amt.classList.remove('yearly');
        }
      }

      var calc = card.querySelector('.price-calc');
      if (calc) {
        if (deviceTouched) {
          var overTxt = over > 0 ? ' + ' + over + ' × ₺' + PER_DEVICE : '';
          calc.innerHTML = billing === 'yearly'
            ? '<strong>' + dev + ' cihaz</strong> · ₺' + formatTL(base) + ' taban' + overTxt +
              ' = <strong>₺' + formatTL(monthly) + '/ay</strong> → yıllık <strong>₺' + formatTL(yearly) + '</strong> + KDV (2 ay bedava)'
            : '<strong>' + dev + ' cihaz</strong> · ₺' + formatTL(base) + ' taban' + overTxt +
              ' = <strong>₺' + formatTL(monthly) + '/ay</strong> + KDV';
          calc.hidden = false;
        } else {
          calc.hidden = true;
          calc.innerHTML = '';
        }
      }
    });
  }

  /* Aylik / Yillik anahtari */
  var toggle = document.getElementById('billingToggle');
  if (toggle) {
    var toggleButtons = toggle.querySelectorAll('.toggle-btn');
    var indicator = toggle.querySelector('.indicator');
    var setBilling = function (mode) {
      billing = mode;
      toggle.dataset.active = mode;
      Array.prototype.forEach.call(toggleButtons, function (b) {
        b.classList.toggle('active', b.dataset.bill === mode);
      });
      var activeBtn = toggle.querySelector('.toggle-btn.active');
      if (activeBtn && indicator) {
        indicator.style.width = activeBtn.offsetWidth + 'px';
        indicator.style.transform = 'translateX(' + activeBtn.offsetLeft + 'px)';
      }
      renderPriceCards();
    };
    Array.prototype.forEach.call(toggleButtons, function (b) {
      b.addEventListener('click', function () {
        setBilling(b.dataset.bill);
        Array.prototype.forEach.call(document.querySelectorAll('.price-amount'), function (pa) {
          pa.classList.add('changing');
          setTimeout(function () { pa.classList.remove('changing'); }, 350);
        });
      });
    });
    requestAnimationFrame(function () { setBilling('monthly'); });
    window.addEventListener('resize', function () { setBilling(toggle.dataset.active || 'monthly'); }, { passive: true });
  } else {
    renderPriceCards();
  }

  /* ============================================================
     KACAN GELIR HESAPLAYICISI
     ============================================================ */
  var sCount = document.getElementById('roi-count');
  var sBill = document.getElementById('roi-bill');
  var sMiss = document.getElementById('roi-miss');

  var vdCount = document.getElementById('vd-count');
  var vdBill = document.getElementById('vd-bill');
  var vdMiss = document.getElementById('vd-miss');

  var elYear = document.getElementById('roi-year');
  var elMonth = document.getElementById('roi-month');
  var elBasis = document.getElementById('roi-basis');
  var elNet = document.getElementById('roi-net');
  var elMonthlyMini = document.getElementById('roi-monthly-mini');
  var elPayback = document.getElementById('roi-payback');
  var elRecovered = document.getElementById('roi-recovered');
  var barNet = document.getElementById('rbb-net');
  var barCost = document.getElementById('rbb-cost');
  var lblNet = document.getElementById('rbl-net');
  var lblCost = document.getElementById('rbl-cost');
  var lblRest = document.getElementById('rbl-rest');
  var recName = document.getElementById('roi-rec-name');
  var recDetail = document.getElementById('roi-rec-detail');
  var recPrice = document.getElementById('roi-rec-price');
  var recPayback = document.getElementById('roi-rec-payback');

  var gaugeArc = document.getElementById('roiGaugeArc');
  var gaugeDot = document.getElementById('roiGaugeDot');
  var gaugeNum = document.getElementById('roiGaugeNum');
  var gaugeStatus = document.getElementById('roiGaugeStatus');

  var projWithFill = document.getElementById('projWithFill');
  var projWithLine = document.getElementById('projWithLine');
  var projWithEnd = document.getElementById('projWithEnd');
  var projWithoutFill = document.getElementById('projWithoutFill');
  var projWithoutLine = document.getElementById('projWithoutLine');
  var projWithoutEnd = document.getElementById('projWithoutEnd');
  var projEndLabel = document.getElementById('projEndLabel');
  var projEndLabelText = document.getElementById('projEndLabelText');
  var rpDiffPill = document.getElementById('rpDiffPill');

  var rmtAmount = document.getElementById('rmtAmount');
  var rmtRate = document.getElementById('rmtRate');
  var rmtIdle = document.getElementById('rmtIdle');
  var rmtLive = document.getElementById('rmtLive');
  var rmtRateWrap = document.getElementById('rmtRateWrap');

  /* Buyuk sayi icin yumusak sayma */
  var lastBig = 0, bigRaf = null, bigFallback = null;
  function animateBig(target, el) {
    if (!el) return;
    if (bigRaf) cancelAnimationFrame(bigRaf);
    if (bigFallback) clearTimeout(bigFallback);
    var duration = reduceMotion ? 0 : 550;
    var settle = function () { el.textContent = tl(target); lastBig = target; };
    if (duration === 0) { settle(); return; }
    var start = lastBig, startTime = performance.now();
    var step = function (now) {
      var t = Math.min((now - startTime) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = tl(start + (target - start) * eased);
      if (t < 1) bigRaf = requestAnimationFrame(step);
      else settle();
    };
    bigRaf = requestAnimationFrame(step);
    /* rAF kisitlanirsa (arka plan sekmesi vb.) deger yine de dogru kalsin */
    bigFallback = setTimeout(settle, duration + 120);
  }

  /* Gosterge ucundaki nokta konumu */
  function gaugeArcPos(pct) {
    var angle = Math.PI * (1 - pct);
    var cx = 100, cy = 100, r = 80;
    return { x: cx - r * Math.cos(angle), y: cy - r * Math.sin(angle) };
  }

  function smoothPath(pts) {
    if (!pts.length) return '';
    var d = 'M ' + pts[0].x.toFixed(1) + ' ' + pts[0].y.toFixed(1);
    for (var i = 1; i < pts.length; i++) {
      var cpx = (pts[i - 1].x + pts[i].x) / 2;
      d += ' C ' + cpx.toFixed(1) + ' ' + pts[i - 1].y.toFixed(1) + ', ' +
           cpx.toFixed(1) + ' ' + pts[i].y.toFixed(1) + ', ' +
           pts[i].x.toFixed(1) + ' ' + pts[i].y.toFixed(1);
    }
    return d;
  }

  /* Iki egri de AYNI birimde: bugunku duzene gore yillik fark.
     yearlyNet  = geri kazanim - yazilim maliyeti (yesil)
     yearlyRest = modelde geri kazanilamayan pay  (kirmizi) */
  function buildProjection(yearlyNet, yearlyRest) {
    var W = 480, H = 180, months = 60;
    var a = [], b = [];
    for (var m = 0; m <= months; m++) {
      a.push({ x: (m / months) * W, raw: Math.max(0, yearlyNet) / 12 * m });
      b.push({ x: (m / months) * W, raw: Math.max(0, yearlyRest) / 12 * m });
    }
    var maxRaw = Math.max(a[months].raw, b[months].raw, 1);
    a.forEach(function (p) { p.y = H - 14 - (p.raw / maxRaw) * (H - 24); });
    b.forEach(function (p) { p.y = H - 14 - (p.raw / maxRaw) * (H - 24); });
    return {
      withLine: smoothPath(a),
      withFill: smoothPath(a) + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z',
      withoutLine: smoothPath(b),
      withoutFill: smoothPath(b) + ' L ' + W + ' ' + H + ' L 0 ' + H + ' Z',
      withEnd: a[months],
      withoutEnd: b[months]
    };
  }

  function multStatus(mult) {
    if (mult < 1) return '⚠️ Zayıf';
    if (mult < 1.5) return '🆗 İdare eder';
    if (mult < 3) return '✓ Çok iyi';
    if (mult < 6) return '⚡ Mükemmel';
    return '🚀 Olağanüstü';
  }

  /* Canli sayac durumu.
     ONEMLI: sayac ziyaretcinin KENDI girdisiyle baslar (deviceTouched).
     Dokunulmadan once bizim varsayimimizla "sizin paraniz eriyor" izlenimi verilmez. */
  var tickerYearly = 0;
  var tickerStart = performance.now();
  var tickerOffset = 0;
  var tickerLastRate = 0;
  var tickerRunning = false;

  function renderTicker(value, perHour) {
    if (rmtAmount) rmtAmount.textContent = '₺' + formatTL(value);
    if (rmtRate) rmtRate.textContent = '₺' + (perHour >= 10 ? formatTL(perHour) : perHour.toFixed(2).replace('.', ','));
  }

  function tickerLoop(now) {
    /* Arka plan sekmesinde bosuna calisma (WCAG 2.2.2 + pil) */
    if (document.hidden) { requestAnimationFrame(tickerLoop); return; }
    var elapsed = (now - tickerStart) / 1000;
    var perSec = tickerYearly / (365 * 24 * 60 * 60);
    renderTicker(tickerOffset + elapsed * perSec, perSec * 3600);
    requestAnimationFrame(tickerLoop);
  }

  function startTicker() {
    if (tickerRunning) return;
    tickerRunning = true;
    if (rmtIdle) rmtIdle.hidden = true;
    if (rmtLive) rmtLive.hidden = false;
    if (rmtRateWrap) rmtRateWrap.hidden = false;
    /* prefers-reduced-motion: surekli artan rakam yok, tek seferlik deger yazilir */
    if (reduceMotion) { renderTicker(0, tickerYearly / (365 * 24)); return; }
    tickerStart = performance.now();
    requestAnimationFrame(tickerLoop);
  }

  function paintSliderTracks() {
    var sliders = [sCount, sBill, sMiss];
    var grads = [
      ['#f59e0b', '#f97316'],
      ['#10b981', '#14b8a6'],
      ['#8b5cf6', '#a855f7']
    ];
    sliders.forEach(function (s, i) {
      if (!s) return;
      var pct = ((+s.value - +s.min) / (+s.max - +s.min)) * 100;
      /* \`background\` kisayolu background-clip'i sifirlar; CSS'teki content-box
         kirpmasi (dokunma hedefi 34px, gorsel track 6px) bozulmasin diye
         SADECE background-image yazilir. */
      s.style.backgroundImage = 'linear-gradient(90deg,' + grads[i][0] + ' 0%,' + grads[i][1] + ' ' +
        pct + '%,rgba(255,255,255,0.05) ' + pct + '%)';
    });
  }

  function calcROI() {
    if (!sCount || !sBill || !sMiss) return;

    var devices = +sCount.value;
    var billPer = +sBill.value;
    var missPct = +sMiss.value;
    deviceCount = devices;

    if (vdCount) vdCount.textContent = devices;
    if (vdBill) vdBill.textContent = '₺' + formatTL(billPer);
    if (vdMiss) vdMiss.textContent = '%' + missPct;
    paintSliderTracks();

    /* --- kacan gelir --- */
    var monthlyLeak = devices * billPer * (missPct / 100);
    var yearlyLeak = monthlyLeak * 12;
    var recovered = yearlyLeak * RECOVERY;
    var notRecovered = yearlyLeak - recovered;

    /* --- pakete gore maliyet --- */
    var plan = PLANS[ROI_PLAN_KEY];
    var monthlyCost = planMonthly(plan, devices);
    var yearlyCost = monthlyCost * 12;
    var over = Math.max(0, devices - plan.included);

    var net = recovered - yearlyCost;
    var mult = yearlyCost > 0 ? recovered / yearlyCost : 0;
    var monthlyRecovered = recovered / 12;
    var paybackTxt;
    if (monthlyRecovered <= 0) paybackTxt = '—';
    else {
      var pm = monthlyCost / monthlyRecovered;
      paybackTxt = pm < 1 ? '< 1 ay' : (pm < 12 ? dec1(pm) + ' ay' : dec1(pm / 12) + ' yıl');
    }

    /* --- ekran --- */
    animateBig(yearlyLeak, elYear);
    if (elYear && !reduceMotion) {
      elYear.classList.add('bump');
      setTimeout(function () { elYear.classList.remove('bump'); }, 250);
    }
    if (elMonth) elMonth.textContent = tl(monthlyLeak);
    if (elMonthlyMini) elMonthlyMini.textContent = tl(monthlyLeak);
    if (elBasis) elBasis.textContent = devices + ' cihaz × ' + tl(billPer) + ' × %' + missPct;
    if (elNet) elNet.textContent = tl(net);
    if (elPayback) elPayback.textContent = paybackTxt;
    if (elRecovered) elRecovered.textContent = tl(recovered) + ' geri kazanım';

    var netShare = recovered > 0 ? Math.max(0, net) / recovered * 100 : 0;
    var costShare = Math.max(0, 100 - netShare);
    if (barNet) barNet.style.width = netShare.toFixed(1) + '%';
    if (barCost) barCost.style.width = costShare.toFixed(1) + '%';
    if (lblNet) lblNet.textContent = tl(net);
    if (lblCost) lblCost.textContent = tl(yearlyCost);
    if (lblRest) lblRest.textContent = tl(notRecovered);

    if (recName) recName.textContent = plan.name;
    if (recDetail) {
      recDetail.textContent = devices + ' cihaz: ' + tl(plan.base) + ' taban' +
        (over > 0 ? ' + ' + over + ' × ₺' + PER_DEVICE : ' (dahil adedin içinde)');
    }
    if (recPrice) recPrice.textContent = tl(monthlyCost);
    if (recPayback) recPayback.textContent = paybackTxt;

    /* --- gosterge (0–10x) --- */
    if (gaugeArc) {
      var pct = Math.max(0, Math.min(mult / 10, 1));
      gaugeArc.setAttribute('stroke-dasharray', (pct * 100).toFixed(2) + ' 100');
      var dot = gaugeArcPos(pct);
      if (gaugeDot) {
        gaugeDot.setAttribute('cx', dot.x.toFixed(2));
        gaugeDot.setAttribute('cy', dot.y.toFixed(2));
      }
    }
    if (gaugeNum) {
      gaugeNum.textContent = (mult < 10 ? dec1(mult) : Math.round(mult)) + '×';
      gaugeNum.classList.add('bump');
      setTimeout(function () { gaugeNum.classList.remove('bump'); }, 300);
    }
    if (gaugeStatus) gaugeStatus.textContent = multStatus(mult);

    /* --- 5 yillik projeksiyon ---
       ONEMLI: iki cizgi de "bugunku duzene GORE fark" birimindedir.
       Yesil  = birikimli net kazanc (geri kazanim - yazilim maliyeti).
       Kirmizi= modelde geri kazanilamayan pay (kacan gelirin %30'u).
       Bu ikisi TOPLANMAZ; toplasaydik baz durumu iki kez saymis olurduk. */
    var proj = buildProjection(net, notRecovered);
    if (projWithFill) projWithFill.setAttribute('d', proj.withFill);
    if (projWithLine) projWithLine.setAttribute('d', proj.withLine);
    if (projWithoutFill) projWithoutFill.setAttribute('d', proj.withoutFill);
    if (projWithoutLine) projWithoutLine.setAttribute('d', proj.withoutLine);
    /* Uc noktalari ve etiket HTML katmanindadir: SVG kullanici birimini (480x180)
       yuzdeye cevirip konumlandiririz — boylece esneme deformasyonu olmaz. */
    if (projWithEnd) {
      projWithEnd.style.left = (proj.withEnd.x / 480 * 100).toFixed(2) + '%';
      projWithEnd.style.top = (proj.withEnd.y / 180 * 100).toFixed(2) + '%';
    }
    if (projWithoutEnd) {
      projWithoutEnd.style.left = (proj.withoutEnd.x / 480 * 100).toFixed(2) + '%';
      projWithoutEnd.style.top = (proj.withoutEnd.y / 180 * 100).toFixed(2) + '%';
    }
    if (projEndLabel && projEndLabelText) {
      var ly = Math.max(0, Math.min(proj.withEnd.y - 34, 140));
      projEndLabel.style.top = (ly / 180 * 100).toFixed(2) + '%';
      projEndLabelText.textContent = '+₺' + formatCompact(Math.max(0, net) * 5);
    }
    if (rpDiffPill) {
      /* 5 yillik fark = yalnizca birikimli NET kazanc (yesil cizginin ucu). */
      rpDiffPill.textContent = '+₺' + formatCompact(Math.max(0, net) * 5) + ' / 5 yıl';
    }

    /* --- canli sayac oranini guncelle (yalnizca kullanici dokunduysa) --- */
    if (deviceTouched) {
      var now = performance.now();
      tickerOffset += ((now - tickerStart) / 1000) * (tickerLastRate / (365 * 24 * 60 * 60));
      tickerStart = now;
      tickerYearly = yearlyLeak;
      tickerLastRate = yearlyLeak;
      startTicker();
      /* rAF calismasa bile oran etiketi dogru kalsin */
      if (rmtRate) {
        var ph = yearlyLeak / (365 * 24);
        rmtRate.textContent = '₺' + (ph >= 10 ? formatTL(ph) : ph.toFixed(2).replace('.', ','));
      }
    }

    /* --- fiyat kartlari --- */
    renderPriceCards();
  }

  [sCount, sBill, sMiss].forEach(function (s) {
    if (!s) return;
    s.addEventListener('input', function () {
      deviceTouched = true;
      calcROI();
    });
  });

  /* Hazir senaryolar */
  var presetButtons = document.querySelectorAll('.roi-preset');
  Array.prototype.forEach.call(presetButtons, function (btn) {
    btn.addEventListener('click', function () {
      if (!sCount || !sBill || !sMiss) return;
      Array.prototype.forEach.call(presetButtons, function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      deviceTouched = true;

      /* On ayarlar SADECE cihaz sayisini degistirir.
         Ortalama fatura ve kacirma orani olculmus veri olmadigi icin
         bayinin kendi girdisi olarak kalir. */
      var tc = +btn.dataset.c;
      var c0 = +sCount.value;
      var startTime = performance.now(), duration = reduceMotion ? 0 : 600;

      if (duration === 0) {
        sCount.value = tc;
        calcROI();
        return;
      }
      var step = function (now) {
        var t = Math.min((now - startTime) / duration, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        sCount.value = Math.round(c0 + (tc - c0) * eased);
        calcROI();
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  /* Ilk hesap: cihaz sayisina dokunulmadigi icin fiyat kartlari TABAN fiyatta kalir.
     Canli para sayaci da burada BASLAMAZ — ilk slider dokunusunda baslar. */
  if (sCount) {
    lastBig = 0;
    calcROI();
  }

  /* ============================================================
     SCROLL ILERLEME CUBUGU
     ============================================================ */
  var scrollProgress = document.getElementById('scrollProgress');
  if (scrollProgress) {
    var spRaf = null;
    var updateProgress = function () {
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var scrolled = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
      scrollProgress.style.width = Math.min(scrolled, 100).toFixed(1) + '%';
      spRaf = null;
    };
    window.addEventListener('scroll', function () {
      if (!spRaf) spRaf = requestAnimationFrame(updateProgress);
    }, { passive: true });
    updateProgress();
  }

  /* ============================================================
     BASLIK KELIME DONDURUCU
     ============================================================ */
  var rotatorWords = document.querySelectorAll('.hero-rotator-word');
  if (rotatorWords.length > 1 && !reduceMotion) {
    var activeIdx = 0;
    setInterval(function () {
      var current = rotatorWords[activeIdx];
      var nextIdx = (activeIdx + 1) % rotatorWords.length;
      var next = rotatorWords[nextIdx];
      current.classList.remove('active');
      current.classList.add('exiting');
      setTimeout(function () {
        current.classList.remove('exiting');
        next.classList.add('active');
      }, 60);
      activeIdx = nextIdx;
    }, 2800);
  }

  /* ============================================================
     HERO PARCACIK TUVALI
     ============================================================ */
  var canvas = document.getElementById('particles');
  if (canvas && !reduceMotion) {
    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, particles = [], mouse = { x: -9999, y: -9999, active: false };
    var COLORS = ['#f59e0b', '#f97316', '#10b981', '#14b8a6', '#06b6d4', '#8b5cf6', '#a855f7'];
    var isMobile = window.matchMedia('(max-width:900px)').matches;
    var COUNT = isMobile ? 24 : 50;   // baglanti dongusu O(n^2): 70 -> 50 kare basina ~2400 -> ~1200 hesap
    var MAX_DIST = isMobile ? 100 : 140;
    var heroInView = true;            // hero ekrandan cikinca rAF isi yapmaz

    var resize = function () {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var rect = canvas.getBoundingClientRect();
      W = rect.width; H = rect.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    var spawn = function () {
      particles = [];
      for (var i = 0; i < COUNT; i++) {
        particles.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
          r: Math.random() * 1.6 + 0.6,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          a: Math.random() * 0.5 + 0.3
        });
      }
    };
    var tick = function () {
      /* Arka plan sekmesi veya hero goruntude degilse cizim yapma */
      if (document.hidden || !heroInView) { requestAnimationFrame(tick); return; }
      ctx.clearRect(0, 0, W, H);
      for (var k = 0; k < particles.length; k++) {
        var p = particles[k];
        if (mouse.active) {
          var mdx = p.x - mouse.x, mdy = p.y - mouse.y;
          var d2 = mdx * mdx + mdy * mdy;
          if (d2 < 14000) {
            var f = (14000 - d2) / 14000 * 0.04;
            p.vx += mdx * f / 30; p.vy += mdy * f / 30;
          }
        }
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.992; p.vy *= 0.992;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;
        ctx.globalAlpha = p.a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.lineWidth = 0.6;
      for (var i2 = 0; i2 < particles.length; i2++) {
        for (var j = i2 + 1; j < particles.length; j++) {
          var a = particles[i2], b = particles[j];
          var dx = a.x - b.x, dy = a.y - b.y;
          var d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            ctx.strokeStyle = a.color;
            ctx.globalAlpha = (1 - d / MAX_DIST) * 0.18;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(tick);
    };

    var heroEl = document.querySelector('.hero');
    if (heroEl) {
      heroEl.addEventListener('mousemove', function (e) {
        var rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
        mouse.active = true;
      }, { passive: true });
      heroEl.addEventListener('mouseleave', function () { mouse.active = false; });
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          heroInView = entries[0].isIntersecting;
        }, { threshold: 0 }).observe(heroEl);
      }
    }

    resize(); spawn(); tick();
    /* Mobil tarayicilarda URL cubugu acilip kapandikca resize tetiklenir;
       yalnizca GENISLIK degistiyse yeniden uret, yoksa parcaciklar zipliyor. */
    var lastW = window.innerWidth;
    window.addEventListener('resize', function () {
      resize();
      if (window.innerWidth !== lastW) { lastW = window.innerWidth; spawn(); }
    }, { passive: true });
  }

  /* ============================================================
     HERO BLOB PARALAKS
     ============================================================ */
  var heroBlobs = document.querySelectorAll('.hero .blob');
  if (heroBlobs.length && window.matchMedia('(pointer:fine)').matches && !reduceMotion) {
    document.addEventListener('mousemove', function (e) {
      var cx = (e.clientX / window.innerWidth - 0.5) * 2;
      var cy = (e.clientY / window.innerHeight - 0.5) * 2;
      Array.prototype.forEach.call(heroBlobs, function (b, i) {
        var depth = (i + 1) * 8;
        b.style.transform = 'translate(' + (cx * depth) + 'px,' + (cy * depth) + 'px)';
      });
    }, { passive: true });
  }

  /* ============================================================
     PANEL MOCKUP — 3D EGIM
     ============================================================ */
  var mockup = document.querySelector('.hero-mockup');
  var mockupWrap = document.querySelector('.hero-mockup-wrap');
  if (mockup && mockupWrap && window.matchMedia('(pointer:fine)').matches && !reduceMotion) {
    var mRect = null, mRaf = null;
    mockupWrap.addEventListener('mousemove', function (e) {
      if (!mRect) mRect = mockupWrap.getBoundingClientRect();
      var x = (e.clientX - mRect.left) / mRect.width;
      var y = (e.clientY - mRect.top) / mRect.height;
      var rotY = (x - 0.5) * 6, rotX = (0.5 - y) * 4;
      if (mRaf) cancelAnimationFrame(mRaf);
      mRaf = requestAnimationFrame(function () {
        mockup.style.transform = 'perspective(1500px) rotateX(' + rotX + 'deg) rotateY(' + rotY + 'deg) translateZ(0)';
      });
    }, { passive: true });
    mockupWrap.addEventListener('mouseleave', function () {
      mRect = null;
      if (mRaf) cancelAnimationFrame(mRaf);
      mockup.style.transform = 'perspective(1500px) rotateX(0) rotateY(0)';
    });
    window.addEventListener('scroll', function () { mRect = null; }, { passive: true });
  }

})();

/* ---- Bölüm fon videoları: geç yükleme -------------------------------------
   İki bölüm (saha, kapanış) fotoğrafın üstünde dönen bir video taşıyor.

   MOBİLDE HİÇ İNMEZ: iki video ~1,3 MB ve telefonda fotoğraf zaten aynı işi
   görüyor. Hareket azaltma tercihinde de inmez.

   preload="none" TEK BAŞINA YETMEZ — autoplay özniteliği onu geçersiz kılar
   (OTOPrime giriş ekranında ölçüldü). Bu yüzden src HTML'de YOK, data-src'de
   duruyor ve ancak bölüme yaklaşınca atanıyor.

   rootMargin küçük (20%) BİLEREK: patlatma dizisinde 150% kullanılmıştı ve
   sayfa açılır açılmaz 10,6 MB indiriyordu (bkz. d2f541e). Aynı hataya
   düşmemek için öngörü dar tutuldu.

   ZAMAN AŞIMI YEDEĞİ YOK — gerek de yok: video inmezse altındaki fotoğraf
   görünür, kutu asla boş kalmaz.                                            */
(function () {
  var vs = [].slice.call(document.querySelectorAll('.fon-v[data-src]'));
  if (!vs.length) return;
  var mm = window.matchMedia;
  if (mm && mm('(prefers-reduced-motion: reduce)').matches) return;
  if (mm && mm('(max-width: 900px)').matches) return;

  vs.forEach(function (v) {
    var yuklendi = false;
    function yukle() {
      if (yuklendi) return;
      yuklendi = true;
      v.addEventListener('playing', function () { v.dataset.acik = '1'; }, { once: true });
      v.src = v.dataset.src;
      var p = v.play();
      if (p && p.catch) p.catch(function () { /* otomatik oynatma engellendi — fotoğraf kalır */ });
    }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (g) {
        if (!g.some(function (x) { return x.isIntersecting; })) return;
        io.disconnect();
        yukle();
      }, { rootMargin: '20% 0px' });
      io.observe(v);
    } else {
      yukle();
    }
  });
})();

/* ---- Marka animasyonu: geç yükleme ---------------------------------------
   1 MB'lik dosya sayfa acilisinda cekilmesin; yalnizca goruse yaklasinca.
   IntersectionObserver kisitlanirsa (gizli sekme, eski tarayici) 4 sn sonra
   kosulsuz yuklenir — aksi halde kutu kalici bos kalirdi.
   Hareket azaltma tercihi varsa hic yuklenmez: CSS zaten gizliyor.            */
(function () {
  var v = document.querySelector('.brand-clip-v');
  if (!v || !v.dataset.src) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var yuklendi = false;
  var yukle = function () {
    if (yuklendi) return;
    yuklendi = true;
    v.src = v.dataset.src;
    // autoplay ozniteligi yerine play(): tarayici reddederse sessizce gecilir
    var p = v.play();
    if (p && p.catch) p.catch(function () { /* otomatik oynatma engellendi — sorun degil */ });
  };

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { yukle(); io.disconnect(); }
    }, { rootMargin: '300px' });
    io.observe(v);
  }
  setTimeout(yukle, 4000);
})();

/* ---- Lead formu ----------------------------------------------------------
   /api/talep talebi ONCE veritabanina yazar, CRM aktarimi ustune ek adimdir.
   Bu sayfa tek dosya olarak (file://) da acilabildigi icin uc bulunamazsa
   ziyaretciyi bosa dusurmeyip WhatsApp'a yonlendiriyoruz.                    */
(function () {
  var form = document.getElementById('leadForm');
  if (!form) return;
  var msg = document.getElementById('lfMsg');
  var btn = document.getElementById('lfBtn');

  var WA = 'https://wa.me/905526961703?text=';
  var say = function (t, cls) { msg.textContent = t; msg.className = 'cta-form-msg ' + (cls || ''); };

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var firma = document.getElementById('lfFirma').value.trim();
    var tel = document.getElementById('lfTel').value.trim();
    if (!firma || !tel) { say('Firma adı ve telefon gerekli.', 'err'); return; }

    var veri = {
      firma: firma,
      telefon: tel,
      cihazSayisi: document.getElementById('lfCihaz').value.trim(),
      website_hp: document.getElementById('lfHp').value,
      utm_source: new URLSearchParams(location.search).get('utm_source') || 'landing',
      utm_campaign: new URLSearchParams(location.search).get('utm_campaign') || ''
    };

    btn.disabled = true; say('Gönderiliyor…');
    fetch('/api/talep', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri)
    })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function () {
        form.reset();
        say('Aldık. En kısa sürede arayacağız.', 'ok');
      })
      .catch(function () {
        /* Uc yoksa/ulasilamiyorsa talebi kaybetme: WhatsApp'a tasi. */
        say('Bağlantı kurulamadı — WhatsApp üzerinden iletiyoruz.', 'err');
        window.open(WA + encodeURIComponent(
          'Merhaba, Nextus Servis için bilgi istiyorum.\\nFirma: ' + firma +
          '\\nTelefon: ' + tel + (veri.cihazSayisi ? '\\nCihaz: ' + veri.cihazSayisi : '')
        ), '_blank');
      })
      .then(function () { btn.disabled = false; });
  });
})();

/* ══════════════════════════════════════════════════════════════════════════
   HAREKET MOTORU
   ══════════════════════════════════════════════════════════════════════════
   Sekiz efektin TEK bir rAF döngüsünde toplanmasının sebebi: her efekt kendi
   scroll dinleyicisini kursaydı aynı karede sekiz kez layout okunurdu
   (layout thrashing). Burada bir kez okuyup hepsine dağıtıyoruz.

   Kaydırma DEVRALINMAZ. Lenis tarzı smooth-scroll siteyi pahalı hissettirir
   ama fiyat arayan bayinin tekerleğini elinden alır; kazancı bedeline değmez.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  var azHareket = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var gercekFare = window.matchMedia('(pointer:fine)').matches;

  /* ── KAHRAMANA DOKUNULMUYOR ──────────────────────────────────────────
     Kahramanın ZATEN çalışan bir giriş animasyonu var (fadeUp,
     animation-fill-mode:both). CSS animasyonu geçişleri EZER; buraya ikinci
     bir giriş katmanı koymak onunla dövüşüp metni görünmez bırakıyordu.
     Çalışan bir şeyin üstüne ikincisini kurmak, iyileştirme değil hata
     kaynağıdır — bu yüzden kahraman girişi olduğu gibi bırakıldı. */

  /* ── 2. BÖLÜM BAŞLIKLARI: kelime kelime ──────────────────────────────
     Düz solma yerine kelimelerin sırayla yükselmesi, başlığı "yazılıyormuş"
     gibi gösterir. Yalnız bölüm başlıklarında — her yerde yapılsaydı
     sayfa huzursuz olurdu. */
  function baslikParcala() {
    if (azHareket) return;
    document.querySelectorAll('.section-title').forEach(function (h) {
      if (h.dataset.split) return;
      h.dataset.split = '1';
      var g = 0;
      Array.prototype.slice.call(h.childNodes).forEach(function (dugum) {
        if (dugum.nodeType !== 3) return;
        var metin = dugum.nodeValue;
        if (!metin || !metin.trim()) return;
        var parca = document.createDocumentFragment();
        metin.split(/(\\s+)/).forEach(function (p) {
          if (!p.trim()) { parca.appendChild(document.createTextNode(p)); return; }
          var kutu = document.createElement('span');
          kutu.className = 'word-wrap';
          var kelime = document.createElement('span');
          kelime.className = 'word';
          kelime.style.setProperty('--wd', (g += 0.05).toFixed(3) + 's');
          kelime.textContent = p;
          kutu.appendChild(kelime);
          parca.appendChild(kutu);
        });
        dugum.parentNode.replaceChild(parca, dugum);
      });
    });

    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.section-title .word-wrap').forEach(function (w) { w.classList.add('words-in'); });
      return;
    }
    var io = new IntersectionObserver(function (girdiler) {
      girdiler.forEach(function (g) {
        if (!g.isIntersecting) return;
        g.target.querySelectorAll('.word-wrap').forEach(function (w) { w.classList.add('words-in'); });
        io.unobserve(g.target);
      });
    }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.section-title').forEach(function (h) { io.observe(h); });

    // EMNİYET AĞI. Bu landing'de daha önce tam olarak şu yaşandı: gözlemci
    // beklenmedik bir sebeple tetiklenmedi ve bloklar kalıcı olarak görünmez
    // kaldı. Görünmeyen başlık, animasyonsuz başlıktan kat kat kötüdür.
    setTimeout(function () {
      document.querySelectorAll('.section-title .word-wrap:not(.words-in)')
        .forEach(function (w) { w.classList.add('words-in'); });
    }, 3000);
  }

  /* ── 3. ADIM İLERLEMESİ ──────────────────────────────────────────────
     "Nasıl çalışır" adımlarında o an okunan adım öne çıkar, diğerleri
     geri çekilir. Okuyucu sırayı kaybetmez. */
  function adimlar() {
    var kartlar = document.querySelectorAll('.how-grid .how-card');
    if (!kartlar.length || !('IntersectionObserver' in window)) return;
    kartlar.forEach(function (k) { k.classList.add('stepy'); });
    var io = new IntersectionObserver(function (girdiler) {
      girdiler.forEach(function (g) { g.target.classList.toggle('step-on', g.isIntersecting); });
    }, { threshold: 0.55 });
    kartlar.forEach(function (k) { io.observe(k); });
  }

  /* ── 4. MIKNATIS DÜĞMELER ────────────────────────────────────────────
     İmleç yaklaşınca düğme ona doğru kayar: hedef imlece gelir, tıklamak
     kolaylaşır. Dokunmatikte anlamsız, o yüzden yalnız gerçek farede. */
  function miknatis() {
    if (!gercekFare || azHareket) return;
    document.querySelectorAll('.btn-grad, .hero-demo-pill, .price-card .btn').forEach(function (b) {
      b.classList.add('magnetic');
      var r = null;
      b.addEventListener('mouseenter', function () { r = b.getBoundingClientRect(); b.classList.add('mag-active'); });
      b.addEventListener('mousemove', function (e) {
        if (!r) return;
        var x = (e.clientX - r.left - r.width / 2) * 0.22;
        var y = (e.clientY - r.top - r.height / 2) * 0.3;
        b.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      });
      b.addEventListener('mouseleave', function () {
        r = null; b.classList.remove('mag-active'); b.style.transform = '';
      });
    });
  }

  /* ── 5. KART IŞIK NOKTASI ────────────────────────────────────────────
     İmlecin konumu CSS değişkenine yazılır, aydınlanmayı CSS çizer.
     JS hiçbir stil hesaplamaz — sadece iki sayı bildirir. */
  function isikNoktasi() {
    if (!gercekFare) return;
    var kartlar = document.querySelectorAll('.price-card, .cap-group, .bento-card, .feature-card, .pd-card');
    kartlar.forEach(function (k) {
      k.classList.add('spot');
      k.addEventListener('mousemove', function (e) {
        var r = k.getBoundingClientRect();
        k.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        k.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    });
  }

  /* ── 6. TEK KAYDIRMA DÖNGÜSÜ ─────────────────────────────────────────
     İlerleme çubuğu + nav gizleme + paralaks: üçü de aynı karede, tek
     layout okumasıyla. Ayrı ayrı dinleseler aynı işi üç kez yaparlardı. */
  function kaydirmaDongusu() {
    var bar = document.createElement('div');
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);

    var nav = document.getElementById('nav');
    var parElemanlari = [];
    if (!azHareket) {
      // Kahraman arkaplan katmanları farklı hızda kayar → derinlik.
      [['.blob-1', 0.16], ['.blob-2', -0.1], ['.blob-3', 0.22], ['.hero-grid-bg', 0.06]].forEach(function (ç) {
        var el = document.querySelector(ç[0]);
        if (el) { el.classList.add('par'); parElemanlari.push([el, ç[1]]); }
      });
    }

    var sonY = window.scrollY, bekliyor = false;

    function kare() {
      bekliyor = false;
      var y = window.scrollY;
      var tam = document.documentElement.scrollHeight - window.innerHeight;

      bar.style.transform = 'scaleX(' + (tam > 0 ? Math.min(1, y / tam) : 0).toFixed(4) + ')';

      // Nav: aşağı inerken gizle (ama sayfanın en üstünde asla gizleme)
      if (nav) {
        var asagi = y > sonY;
        if (y > 220 && asagi) nav.classList.add('nav-hidden');
        else if (!asagi || y <= 220) nav.classList.remove('nav-hidden');
      }

      // Paralaks yalnız kahraman ekrandayken hesaplanır — aşağıda boşa iş yok
      if (y < window.innerHeight * 1.2) {
        for (var i = 0; i < parElemanlari.length; i++) {
          parElemanlari[i][0].style.setProperty('--py', (y * parElemanlari[i][1]).toFixed(1) + 'px');
        }
      }
      sonY = y;
    }

    window.addEventListener('scroll', function () {
      if (bekliyor) return;
      bekliyor = true;
      requestAnimationFrame(kare);
    }, { passive: true });
    kare();
  }

  /* ── Başlat ──────────────────────────────────────────────────────────
     Kahraman girişi HEMEN; gerisi sayfa yerleşince. */
  // Betik iki kez çalışırsa (HMR, next/script yeniden yürütme) efektler
  // üst üste binmesin.
  function basla() {
    if (document.documentElement.dataset.hareket) return;
    document.documentElement.dataset.hareket = '1';
    kaydirmaDongusu();
    baslikParcala();
    adimlar();
    miknatis();
    isikNoktasi();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', basla);
  else basla();
})();


/* ========== PATLATILMIS MAKINE — kaydirmaya bagli kare dizisi ==========
   Nextus Car'daki uygulamanin vanilla karsiligi. Kararlarin gerekcesi:

   TEK CANVAS, <img> dizisi degil: 192 dugumu tarayici katmanlamaya calisir,
   bellek ve kompozisyon maliyeti patlar.

   OLCEK KURALI: saf "cover" yanlis. Patlatilmis gorunum kadraja kenardan
   kenara yayiliyor, bolum ise 16:9'dan kare; cover yuksekligi doldurup
   GENISLIGI kirpiyor ve en distaki parcalar kesiliyor. Kare siginiyorsa
   contain, dar/uzun ekranda cover (esik: kaplanan yukseklik %78 alti).

   KABADAN INCEYE YUKLEME: sirali yuklersek dizi ancak son kare ininca
   kullanilabilir olur. Once 16'sar atlayarak diziyi kaba kapliyoruz, sonra
   8/4/2/1. Kaydirma dizinin 1/8'i ininca acilir, kalan kareler geldikce
   goruntu keskinlesir. Istenen kare yoksa EN YAKIN yuklu kareye dusulur.

   SAYILAR ELLE YAZILMAZ: bolumun data-* ozniteliklerinden okunur; onlari
   scripts/servis-kareler.mjs kaynak HTML'e yaziyor. */
(function(){
  var bolum = document.getElementById('patlatma');
  if (!bolum) return;
  var tuval = bolum.querySelector('.patlatma-tuval');
  var sahne = bolum.querySelector('.patlatma-sahne');
  var yol   = bolum.querySelector('.patlatma-yol');
  if (!tuval || !sahne || !yol) return;

  var MOBIL = window.matchMedia('(max-width:767px)').matches;
  var SET = MOBIL
    ? { adet:+bolum.dataset.madet, yol:'/servis-m' }
    : { adet:+bolum.dataset.adet,  yol:'/servis'  };
  if (!SET.adet) return;

  var kareler = new Array(SET.adet);
  var sonCizilen = -1, sonIstenen = 0, hazir = false, ilkCizildi = false;

  function kareYolu(i){
    var s = String(i);
    while (s.length < 3) s = '0' + s;
    return SET.yol + '/f-' + s + '.webp';
  }
  function yukluMu(k){
    var g = kareler[k];
    return !!g && g.complete && g.naturalWidth > 0;
  }
  function olcekle(){
    var dpr = Math.min(window.devicePixelRatio || 1, 2); /* 2 ile SINIRLI: dpr 3'te arka bellek 9x buyur */
    var cw = tuval.clientWidth, ch = tuval.clientHeight;
    if (!cw || !ch) return;
    var w = Math.round(cw * dpr), hh = Math.round(ch * dpr);
    if (tuval.width !== w || tuval.height !== hh){
      tuval.width = w; tuval.height = hh;
      var c = tuval.getContext('2d');
      if (c) c.setTransform(dpr, 0, 0, dpr, 0, 0);
      sonCizilen = -1;
    }
  }
  function ciz(indeks){
    if (!kareler.length) return;
    var i = Math.max(0, Math.min(kareler.length - 1, indeks));
    sonIstenen = i;
    var g = -1;
    if (yukluMu(i)) g = i;
    else {
      for (var d = 1; d < kareler.length; d++){
        if (yukluMu(i - d)) { g = i - d; break; }
        if (yukluMu(i + d)) { g = i + d; break; }
      }
    }
    if (g < 0 || g === sonCizilen) return;
    var img = kareler[g];
    var ctx = tuval.getContext('2d');
    if (!ctx) return;
    var cw = tuval.clientWidth, ch = tuval.clientHeight;
    if (!cw || !ch) return;
    var sigdir = Math.min(cw / img.naturalWidth, ch / img.naturalHeight);
    var kapla  = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    var oran = (img.naturalHeight * sigdir) / ch >= 0.78 ? sigdir : kapla;
    var w = img.naturalWidth * oran, hh = img.naturalHeight * oran;
    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, (cw - w) / 2, (ch - hh) / 2, w, hh);
    sonCizilen = g;
    tuval.dataset.kare = String(i + 1);   /* gorunmeyen durumu olculebilir kilar */
    tuval.dataset.cizilen = String(g + 1);
  }
  function yuklemeSirasi(n){
    var gorulen = {}, sira = [];
    function ekle(i){ if (!gorulen[i]) { gorulen[i] = 1; sira.push(i); } }
    ekle(0); ekle(n - 1);
    var adimlar = [16, 8, 4, 2, 1];
    for (var a = 0; a < adimlar.length; a++)
      for (var i = 0; i < n; i += adimlar[a]) ekle(i);
    return sira;
  }
  function agKisitli(){
    var c = navigator.connection;
    if (!c) return false;
    return !!c.saveData || c.effectiveType === '2g' || c.effectiveType === 'slow-2g';
  }

  /* Azaltilmis hareket / kisitli ag: dizi indirilmez, poster son kareye doner. */
  if (window.matchMedia('(prefers-reduced-motion:reduce)').matches || agKisitli()){
    var poster = bolum.querySelector('.patlatma-poster');
    if (poster) poster.src = kareYolu(SET.adet);
    return;
  }

  function yukle(){
    var sira = yuklemeSirasi(SET.adet);
    var kabaEsik = Math.min(SET.adet, Math.ceil(SET.adet / 8) + 2);
    var yuklu = 0, acildi = false;
    function geldi(i){
      yuklu++;
      if (i === 0 && !ilkCizildi){ olcekle(); ciz(0); ilkCizildi = true; tuval.dataset.hazir = '1'; }
      if (acildi) ciz(sonIstenen);
      if (!acildi && yuklu >= kabaEsik){ acildi = true; hazir = true; }
      if (yuklu >= SET.adet){
        for (var k = 0; k < SET.adet; k++)
          if (!yukluMu(k)) kareler[k] = kareler[Math.max(0, k - 1)];
        ciz(sonIstenen);
      }
    }
    for (var s = 0; s < sira.length; s++){
      (function(i){
        var img = new Image();
        img.decoding = 'async';
        img.onload = function(){ geldi(i); };
        img.onerror = function(){ geldi(i); };
        img.src = kareYolu(i + 1);
        kareler[i] = img;
      })(sira[s]);
    }
  }

  /* Bolum gorus alanina yaklasinca indir — ilk boyamayi engellemesin.

     OLCULDU (2026-08-18): eski deger '150%' idi ve HIC iSE YARAMIYORDU. 900px
     ekranda %150 = 1350px ongoru demek; hero 1529px oldugu icin gozcunun
     genisletilmis alani SAYFA ACILIR ACILMAZ patlatma bolumune degiyordu ve
     192 kare (10,6 MB) kullanici tek piksel kaydirmadan iniyordu. Ilk yukleme
     1440px'te 10.860 KB olarak olculdu.
     '25%' = 225px ongoru → indirme kullanici ~400px kaydirinca basliyor, bolum
     ise 629px'te geliyor. Aradaki 229px + kaba-once yukleme sirasi (ilk 26
     kare esigi) bolume varildiginda dizinin hazir olmasina yetiyor.
     Bolum bu sirada bos kalmiyor: poster (f-001.webp) zaten <img> olarak basili. */
  var gozcu = new IntersectionObserver(function(g){
    if (!g.some(function(x){ return x.isIntersecting; })) return;
    gozcu.disconnect();
    yukle();
  }, { rootMargin: '25% 0px' });
  gozcu.observe(bolum);

  var bekliyor = false;
  function guncelle(){
    bekliyor = false;
    if (!hazir) return;
    /* getBoundingClientRect + scrollY: offsetTop offsetParent'a GORE olcer ve
       .patlatma position:relative oldugu icin 0 donuyordu — ilerleme sayfanin
       en ustunden hesaplanip dizi ortadan basliyordu (olculdu: kare 45). */
    var ust = yol.getBoundingClientRect().top + window.scrollY;
    var mesafe = yol.offsetHeight - sahne.offsetHeight;
    if (mesafe <= 0) return;
    var p = (window.scrollY - ust) / mesafe;
    p = Math.max(0, Math.min(1, p));
    ciz(Math.round(p * (SET.adet - 1)));
  }
  function istek(){ if (!bekliyor){ bekliyor = true; requestAnimationFrame(guncelle); } }
  window.addEventListener('scroll', istek, { passive: true });
  window.addEventListener('resize', function(){ olcekle(); sonCizilen = -1; istek(); }, { passive: true });
})();
`;

export default function Landing() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <div lang="tr" dangerouslySetInnerHTML={{ __html: BODY }} />
      <Script id="stk-landing-tr" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JS }} />
    </>
  );
}
