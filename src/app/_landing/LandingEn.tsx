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
      <li><a href="#urun" class="nav-link">Product</a></li>
      <li><a href="#hesap" class="nav-link">Lost revenue</a></li>
      <li><a href="#ozellikler" class="nav-link">Features</a></li>
      <li><a href="#nasil" class="nav-link">How it works</a></li>
      <li><a href="#fiyatlandirma" class="nav-link">Pricing</a></li>
      <li><a href="#sss" class="nav-link">FAQ</a></li>
    </ul>
    <div class="nav-cta">
      <!-- Genel "Demoyu Dene" butonu BİLEREK YOK.
           Bu ürünün gücü bayinin KENDİ verisinde (kaç sayaç okunmamış, ne kadar
           faturalanmamış). Uydurma veriyle tek başına gezen biri bunu göremez,
           sayaç-kira mantığını yanlış anlayıp kapatır ve bir daha dönmez.
           Demo hesabı DURUYOR (/login?demo=1 bilgileri doldurur) ama sahada,
           kurucunun yönettiği bir gösterim için. Buradaki yol WhatsApp: bir
           konuşma başlar, gösterimi kurucu yönetir, talep de kaybolmaz. -->
      <a href="/" class="btn btn-ghost btn-sm dil-sec" hreflang="tr" lang="tr" aria-label="Türkçe sürüme geç">TR</a>
      <a href="#hesap" class="btn btn-ghost btn-sm">Calculate</a>
      <a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20a%20demo%20of%20Nextus%20Servis%20and%20pricing" target="_blank" rel="noopener" class="btn btn-primary btn-sm"><span class="nav-cta-long">On WhatsApp&nbsp;</span>Demo →</a>
      <button class="menu-btn" id="menuBtn" aria-label="Menu" aria-expanded="false" aria-controls="mobileMenu"><span></span><span></span><span></span></button>
    </div>
  </div>
</nav>
<div class="mobile-menu" id="mobileMenu" role="dialog" aria-modal="true" aria-label="Menu">
  <a href="#urun" class="nav-link-m">Product</a>
  <a href="#hesap" class="nav-link-m">Lost revenue</a>
  <a href="#ozellikler" class="nav-link-m">Features</a>
  <a href="#nasil" class="nav-link-m">How it works</a>
  <a href="#fiyatlandirma" class="nav-link-m">Pricing</a>
  <a href="#sss" class="nav-link-m">FAQ</a>
  <a href="/" class="nav-link-m" hreflang="tr" lang="tr">Türkçe</a>
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
      <span>🖨 For printer, copier and office equipment rental and service dealers</span>
    </div>

    <a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20a%20live%20demo%20of%20Nextus%20Servis" target="_blank" rel="noopener" class="hero-demo-pill">
      <span class="hdp-play">
        <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor" aria-hidden="true" focusable="false"><polygon points="6,4 20,12 6,20"/></svg>
      </span>
      <span class="hdp-text">A 15-minute live demo over a shared screen</span>
      <span class="hdp-arrow">→</span>
    </a>

    <h1 class="hero-title">
      Read the meter,
      <span class="gradient-text">let the system raise the invoice</span>
      <span class="line-2" style="font-size:.56em;margin-top:12px;letter-spacing:-0.02em;color:#d4d4dc;font-weight:700">
        lost revenue
        <span class="hero-rotator" aria-hidden="true"><span class="hero-rotator-spacer">gets paid</span><span class="hero-rotator-word active">shows up</span><span class="hero-rotator-word">gets paid</span></span>
        <span class="sr-only">shows up and gets paid</span>
      </span>
    </h1>

    <p class="hero-sub">
      If a rental device’s meter is not read, that month it is <strong>never invoiced at all</strong>. Nextus Servis brings the meter round, the included-volume and overage maths, service tickets, barcoded stock and payment tracking into one program — the month-end summary comes down to a single button.
    </p>

    <div class="hero-ctas">
      <a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20to%20start%20the%2014-day%20trial%20of%20Nextus%20Servis" target="_blank" rel="noopener" class="btn btn-grad">Try it free for 14 days <span style="font-size:18px;line-height:1">→</span></a>
      <a href="#hesap" class="btn btn-ghost">Work out what I am losing</a>
    </div>

    <div class="hero-meta">
      <span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><polyline points="3,8 7,12 13,4"/></svg> No card needed</span>
      <span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><polyline points="3,8 7,12 13,4"/></svg> Setup + Excel import + 2 hours of training, free</span>
      <span><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><polyline points="3,8 7,12 13,4"/></svg> No commitment</span>
    </div>
  </div>

  <!-- PANEL MOCKUP -->
  <div class="hero-mockup-wrap">
    <div class="float-tag t1"><span class="tag-ico">📟</span><span>Meter → invoice</span></div>
    <div class="float-tag t2"><span class="tag-ico">📉</span><span>Lost revenue panel</span></div>
    <div class="float-tag t3"><span class="tag-ico">🏷</span><span>Barcoded stock</span></div>

    <div class="hero-toast">
      <div class="hero-toast-ico">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false">
          <path d="M5 13l4 4L19 7"/>
        </svg>
      </div>
      <div class="hero-toast-body">
        <div class="hero-toast-title">Meter entered</div>
        <div class="hero-toast-meta">Canon iR-ADV C3826 • Mono 48,210 • Colour 6,940</div>
      </div>
      <div class="hero-toast-amt">Invoice ready</div>
    </div>

    <div class="hero-mockup">
      <div class="mockup-titlebar">
        <span class="dot-r r"></span><span class="dot-r y"></span><span class="dot-r g"></span>
        <div class="titlebar-url">Nextus Servis · Dealer panel</div>
        <span class="mock-sample-badge">example screen</span>
        <div class="titlebar-actions"><span></span><span></span><span></span></div>
      </div>
      <div class="dash">
        <aside class="dash-side">
          <div class="dash-side-logo"><span class="lm"></span><span>Nextus Servis</span></div>
          <div class="dash-side-section">General</div>
          <div class="dash-nav-item active">
            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span>Dashboard</span>
          </div>
          <div class="dash-nav-item">
            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/></svg>
            <span>Customers</span>
          </div>
          <div class="dash-side-section">Operations</div>
          <div class="dash-nav-item">
            <span class="ico">🖨</span><span>Devices</span>
            <span class="dash-nav-badge">142</span>
          </div>
          <div class="dash-nav-item">
            <span class="ico">🎫</span><span>Service tickets</span>
            <span class="dash-nav-badge">12</span>
          </div>
          <div class="dash-nav-item">
            <span class="ico">📟</span><span>Meter round</span>
            <span class="dash-nav-badge">7</span>
          </div>
          <div class="dash-nav-item">
            <span class="ico">🏷</span><span>Stock & barcode</span>
          </div>
          <div class="dash-side-section">Money</div>
          <div class="dash-nav-item">
            <span class="ico">🧾</span><span>Invoices</span>
          </div>
          <div class="dash-nav-item">
            <svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M3 3h18v18H3z"/><path d="M9 9h6v6H9z"/></svg>
            <span>Reports</span>
          </div>
          <div class="dash-nav-item">
            <span class="ico">🔁</span><span>Dealer market</span>
          </div>
        </aside>

        <div class="dash-main">
          <div class="dash-topbar">
            <div>
              <div class="mock-h">Month-end close <span class="pill"><span style="width:6px;height:6px;border-radius:50%;background:#10b981;display:inline-block"></span>Ready</span></div>
            </div>
            <div class="dash-topbar-right">
              <span class="ico-btn">🔔</span>
              <span class="ico-btn">⚡</span>
              <span class="dash-avatar">MB</span>
            </div>
          </div>

          <div class="dash-stats">
            <div class="stat-card s1">
              <div class="label">Rental devices</div>
              <div class="val">142</div>
              <div class="trend">↑ 6 new contracts</div>
              <svg class="spark" viewBox="0 0 80 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <defs><linearGradient id="sp1" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#f97316" stop-opacity=".5"/><stop offset="100%" stop-color="#f97316" stop-opacity="0"/></linearGradient></defs>
                <path d="M0,22 L10,18 L20,20 L30,14 L40,16 L50,10 L60,12 L70,6 L80,8 L80,28 L0,28 Z" fill="url(#sp1)"/>
                <path d="M0,22 L10,18 L20,20 L30,14 L40,16 L50,10 L60,12 L70,6 L80,8" fill="none" stroke="#f97316" stroke-width="1.5"/>
              </svg>
            </div>
            <div class="stat-card s2">
              <div class="label">Open service tickets</div>
              <div class="val">12</div>
              <div class="trend" style="color:#f59e0b">3 of them opened today</div>
              <svg class="spark" viewBox="0 0 80 28" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <defs><linearGradient id="sp2" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#14b8a6" stop-opacity=".5"/><stop offset="100%" stop-color="#14b8a6" stop-opacity="0"/></linearGradient></defs>
                <path d="M0,8 L10,12 L20,10 L30,16 L40,14 L50,18 L60,15 L70,20 L80,17 L80,28 L0,28 Z" fill="url(#sp2)"/>
                <path d="M0,8 L10,12 L20,10 L30,16 L40,14 L50,18 L60,15 L70,20 L80,17" fill="none" stroke="#14b8a6" stroke-width="1.5"/>
              </svg>
            </div>
            <div class="stat-card s3">
              <div class="label">Meters not read</div>
              <div class="val">7</div>
              <div class="trend" style="color:#f59e0b">↓ waiting to be invoiced</div>
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
                  <span class="t">Invoiced in the last 30 days</span>
                  <span class="dash-chart-total">Rent + service + consumables</span>
                </div>
                <div class="leg">
                  <span><i style="background:#f97316"></i>Rent</span>
                  <span><i style="background:#14b8a6"></i>Service</span>
                  <span><i style="background:#a855f7"></i>Consumables</span>
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
                  <text x="22" y="17" fill="#fff" font-size="10" font-family="JetBrains Mono, monospace" font-weight="600">Rent summary raised</text>
                </g>
                <g fill="rgba(255,255,255,0.30)" font-size="9" font-family="JetBrains Mono, monospace" text-anchor="middle">
                  <text x="0" y="174" text-anchor="start">Day 1</text>
                  <text x="125" y="174">Day 8</text>
                  <text x="250" y="174">Day 15</text>
                  <text x="375" y="174">Day 22</text>
                  <text x="500" y="174" text-anchor="end">Day 30</text>
                </g>
              </svg>
            </div>

            <div class="dash-list">
              <div class="dash-list-head">Today</div>
              <div class="dash-list-item">
                <div class="ava" style="background:var(--p2-grad)">MR</div>
                <div class="info"><div class="name">Meter round finished</div><div class="meta">Kadıköy route · 9 stops</div></div>
                <div class="amt">9 devices</div>
              </div>
              <div class="dash-list-item">
                <div class="ava" style="background:var(--p1-grad)">TN</div>
                <div class="info"><div class="name">Toner running out</div><div class="meta">~11 days at the current meter pace</div></div>
                <div class="amt" style="color:#f59e0b">Order</div>
              </div>
              <div class="dash-list-item">
                <div class="ava" style="background:var(--p3-grad)">QR</div>
                <div class="info"><div class="name">Fault reported by QR</div><div class="meta">The customer reported it without signing in</div></div>
                <div class="amt" style="color:#a855f7">Ticket opened</div>
              </div>
              <div class="dash-list-item">
                <div class="ava" style="background:linear-gradient(135deg,#10b981,#06b6d4)">WA</div>
                <div class="info"><div class="name">WhatsApp status update</div><div class="meta">Work done + amount sent</div></div>
                <div class="amt">One click</div>
              </div>
              <div class="dash-list-item">
                <div class="ava" style="background:linear-gradient(135deg,#f59e0b,#a855f7)">SM</div>
                <div class="info"><div class="name">Bulk summary printed</div><div class="meta">100 tickets → one page</div></div>
                <div class="amt">Ready</div>
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
             alt="A rental copier, closed body">
      </picture>
      <canvas class="patlatma-tuval" aria-hidden="true"></canvas>
      <div class="patlatma-yazi">
        <div class="inner">
          <span class="patlatma-goz">02 — Device</span>
          <h2 class="patlatma-h">The invoice is printed by the parts, not the machine.</h2>
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
      <span class="section-eyebrow"><span class="dot" style="background:#10b981"></span>Lost revenue</span>
      <h2 class="section-title">How much a month <span class="gradient-text">is never invoiced?</span></h2>
      <p class="section-sub">Set three values for your own business. This is an <strong>estimate, a model</strong>, not a guarantee — you provide the inputs and the maths never leaves your browser.</p>
    </div>

    <div class="roi-card reveal">
      <div class="roi-card-glow"></div>

      <!-- SENARYOLAR -->
      <div class="roi-presets">
        <div class="roi-presets-label">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
          Set the device count quickly — <span class="rp-label-note">you enter the miss rate</span>
        </div>
        <div class="roi-presets-row">
          <button class="roi-preset" type="button" data-c="20">
            <span class="rp-emoji" aria-hidden="true">🌱</span>
            <span class="rp-text">
              <span class="rp-name">20 devices</span>
              <span class="rp-meta">example size</span>
            </span>
          </button>
          <button class="roi-preset active" type="button" data-c="60">
            <span class="rp-emoji" aria-hidden="true">🖨</span>
            <span class="rp-text">
              <span class="rp-name">60 devices</span>
              <span class="rp-meta">example size</span>
            </span>
          </button>
          <button class="roi-preset" type="button" data-c="150">
            <span class="rp-emoji" aria-hidden="true">🏭</span>
            <span class="rp-text">
              <span class="rp-name">150 devices</span>
              <span class="rp-meta">example size</span>
            </span>
          </button>
          <button class="roi-preset" type="button" data-c="300">
            <span class="rp-emoji" aria-hidden="true">🏢</span>
            <span class="rp-text">
              <span class="rp-name">300 devices</span>
              <span class="rp-meta">example size</span>
            </span>
          </button>
        </div>
        <p class="roi-presets-note">These buttons only set the <strong>device count</strong> . The average invoice and the miss rate are your own figures — we have no industry-average data and we will not invent one.</p>
      </div>

      <div class="roi-grid">
        <!-- GIRDILER -->
        <div class="roi-inputs">
          <div class="roi-side-head">
            <span class="roi-pill">
              <span class="roi-pill-dot"></span>
              LIVE CALCULATION
            </span>
            <h3>Tell us about your business</h3>
            <p class="roi-side-sub">Three sliders — the rest is automatic. As you move them, the pricing cards below update to your device count too.</p>
          </div>

          <!-- 1 -->
          <div class="roi-input">
            <div class="roi-input-head">
              <div class="roi-input-icon" data-tone="amber">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 20h10"/><path d="M8 8h8"/></svg>
              </div>
              <div class="roi-input-meta">
                <div class="roi-input-label">Number of rental devices</div>
                <div class="roi-input-help">devices under contract whose meters are read</div>
              </div>
              <div class="roi-input-value" id="vd-count">60</div>
            </div>
            <div class="roi-slider-wrap">
              <input type="range" class="roi-slider" id="roi-count" min="5" max="400" step="1" value="60" aria-label="Number of rental devices" />
            </div>
            <div class="roi-input-foot">
              <span class="roi-tick">5</span>
              <span class="roi-context"><span class="roi-context-dot"></span>total devices in the field</span>
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
                <div class="roi-input-label">Average monthly invoice per device</div>
                <div class="roi-input-help">rent + meter overage, excluding VAT</div>
              </div>
              <div class="roi-input-value" id="vd-bill">₺1,500</div>
            </div>
            <div class="roi-slider-wrap">
              <input type="range" class="roi-slider" id="roi-bill" min="200" max="6000" step="50" value="1500" aria-label="Average monthly invoice per device" />
            </div>
            <div class="roi-input-foot">
              <span class="roi-tick">₺200</span>
              <span class="roi-context"><span class="roi-context-dot"></span>your own average</span>
              <span class="roi-tick">₺6,000</span>
            </div>
          </div>

          <!-- 3 -->
          <div class="roi-input">
            <div class="roi-input-head">
              <div class="roi-input-icon" data-tone="violet">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
              </div>
              <div class="roi-input-meta">
                <div class="roi-input-label">Estimated miss rate</div>
                <div class="roi-input-help">unread meters · late invoices · forgotten overage — <strong>10% is only a starting example; enter your own estimate</strong></div>
              </div>
              <div class="roi-input-value" id="vd-miss">10%</div>
            </div>
            <div class="roi-slider-wrap">
              <input type="range" class="roi-slider" id="roi-miss" min="1" max="30" step="1" value="10" aria-label="Estimated miss rate" />
            </div>
            <div class="roi-input-foot">
              <span class="roi-tick">1%</span>
              <span class="roi-context"><span class="roi-context-dot"></span>your estimate</span>
              <span class="roi-tick">30%</span>
            </div>
          </div>

          <div class="roi-disclaimer">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            Your inputs stay in your browser and are sent nowhere. The results are estimates, not commitments.
          </div>
        </div>

        <!-- CIKTILAR -->
        <div class="roi-output">
          <div class="roi-side-head">
            <span class="roi-pill positive">
              <span class="roi-pill-dot positive"></span>
              YOUR NUMBERS
            </span>
            <h3>Revenue never invoiced</h3>
            <p class="roi-side-sub">What you lose monthly and yearly, the net gain for the plan you pick, and the payback period.</p>
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
                    <text x="36" y="44">2.5×</text>
                    <text x="100" y="14">5×</text>
                    <text x="164" y="44">7.5×</text>
                    <text x="180" y="112">10×</text>
                  </g>
                </svg>
                <div class="roi-gauge-center">
                  <div class="roi-gauge-label">RECOVERED / COST</div>
                  <div class="roi-gauge-value" id="roiGaugeNum">2.1×</div>
                  <div class="roi-gauge-status" id="roiGaugeStatus">✓ Very good</div>
                </div>
              </div>

              <div class="roi-hero-num-side">
                <div class="roi-hero-label">Lost revenue a year</div>
                <div class="roi-hero-num" id="roi-year">₺108,000</div>
                <div class="roi-hero-meta">
                  <span>Monthly <strong id="roi-month">₺9,000</strong></span>
                  <span class="roi-hero-sep">•</span>
                  <span id="roi-basis">60 devices × ₺1,500 × 10%</span>
                </div>
                <div class="roi-hero-fiveyear">
                  <span class="rh5y-label">Net gain a year after the subscription:</span>
                  <span class="rh5y-num" id="roi-net">₺39,912</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 5 YILLIK PROJEKSIYON -->
          <div class="roi-projection">
            <div class="roi-proj-head">
              <div>
                <div class="rp-eyebrow">📈 5-YEAR PROJECTION</div>
                <div class="rp-title">With the software <strong>cumulative net gain</strong>; below, the share the model <strong>does not recover</strong></div>
              </div>
              <div class="rp-diff-pill" id="rpDiffPill">
                +₺200K / 5 years
              </div>
            </div>
            <div class="roi-proj-chart-wrap">
              <!-- SADECE path'ler preserveAspectRatio="none" ile esner.
                   Metin ve uc noktalari SVG'nin USTUNDE HTML katmanindadir; boylece
                   dar ekranda harfler yatayda sikismaz, daireler elipse donmez. -->
              <svg class="roi-proj-chart" viewBox="0 0 480 180" preserveAspectRatio="none" role="img" aria-labelledby="projChartTitle projChartDesc">
                <title id="projChartTitle">5-year projection</title>
                <desc id="projChartDesc">Green curve: cumulative net gain with the software. Red dashed curve: the share the model does not recover. The values are also written out on the left and in the badge.</desc>
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
                <span>Yr 1</span><span>Yr 2</span><span>Yr 3</span><span>Yr 4</span><span>Yr 5</span>
              </div>
            </div>
            <div class="roi-proj-legend">
              <span><i class="rpl-with"></i><strong>With Nextus Servis</strong> · cumulative net gain (the difference against how you work today)</span>
              <span><i class="rpl-without"></i><strong>The share the model does not recover</strong> · cumulative (30% of the lost revenue)</span>
              <span class="rpl-note">Both lines are in the same unit: the difference against how you work today. The figure in the badge is the far end of the green line at year 5.</span>
            </div>
          </div>

          <!-- IKINCIL METRIKLER -->
          <div class="roi-secondary">
            <div class="roi-mini">
              <div class="roi-mini-icon">📅</div>
              <div class="roi-mini-body">
                <div class="roi-mini-num" id="roi-monthly-mini">₺9,000</div>
                <div class="roi-mini-label">Lost revenue a month</div>
              </div>
            </div>
            <div class="roi-mini">
              <div class="roi-mini-icon">⚡</div>
              <div class="roi-mini-body">
                <div class="roi-mini-num" id="roi-payback">&lt; 1 month</div>
                <div class="roi-mini-label">Payback period for the software</div>
              </div>
            </div>
          </div>

          <!-- DAGILIM -->
          <div class="roi-breakdown">
            <div class="roi-breakdown-head">
              <span>How does the net gain come out?</span>
              <span class="roi-breakdown-total" id="roi-recovered">₺75,600 recovered</span>
            </div>
            <div class="roi-breakdown-bar">
              <div class="rbb-segment rbb-1" id="rbb-net" style="width:53%"></div>
              <div class="rbb-segment rbb-2" id="rbb-cost" style="width:47%"></div>
            </div>
            <div class="roi-breakdown-legend">
              <span><i class="rl-1"></i>Net gain a year <strong id="rbl-net">₺39,912</strong></span>
              <span><i class="rl-2"></i>Software cost a year <strong id="rbl-cost">₺35,688</strong></span>
              <span class="cost-line"><i class="rl-cost"></i>The share the model does not recover <strong id="rbl-rest">₺32,400</strong></span>
            </div>
            <div class="roi-assume">
              <strong>Assumption:</strong> of the lost revenue, <strong>70%</strong> is taken to be recovered; the remaining 30% is left out of the model. <strong>70% is not measured data, it is our assumption</strong> — if you see it differently, let us change it together. The software cost is taken from the <strong>Professional plan</strong>  (₺2,099 base + ₺25 for each device above the 25 included, paid monthly, excluding VAT). The pricing table shows what the other plans cost at the same device count. Paid yearly you get 2 months free, so the net gain comes out higher than this table shows.
            </div>
          </div>

          <!-- PAKET ONERISI -->
          <div class="roi-recommend">
            <div class="roi-recommend-glow"></div>
            <div class="roi-recommend-eyebrow">
              <span class="roi-rec-spark">✨</span>
              <span>FIGURES BASED ON THE PROFESSIONAL PLAN</span>
            </div>
            <div class="roi-recommend-row">
              <div>
                <div class="roi-recommend-name" id="roi-rec-name">Professional</div>
                <p class="roi-recommend-desc"><strong id="roi-rec-detail">60 devices: ₺2,099 base + 35 × ₺25</strong> — for the cost to come back <strong id="roi-rec-payback">&lt; 1 month</strong>. The pricing table shows what the other two plans cost at the same device count.</p>
              </div>
              <div class="roi-recommend-price">
                <div class="roi-recommend-price-num" id="roi-rec-price">₺2,974</div>
                <div class="roi-recommend-price-period">/ month + VAT</div>
              </div>
            </div>
            <a href="#fiyatlandirma" class="btn btn-grad btn-block roi-cta-btn">
              See the pricing table <span class="arr">→</span>
            </a>
          </div>
        </div>
      </div>

      <!-- CANLI SAYAC -->
      <div class="roi-money-ticker">
        <div class="rmt-pulse"></div>
        <div class="rmt-text">
          <span id="rmtIdle">Set the sliders to your own business; <strong>against your own figures</strong> the lost revenue starts ticking here.</span>
          <span id="rmtLive" hidden>Since you touched the slider, <strong>on the figures you entered</strong> <strong id="rmtAmount">₺0</strong> of uninvoiced revenue has built up</span>
        </div>
        <div class="rmt-rate" id="rmtRateWrap" hidden>
          <span class="rmt-rate-num" id="rmtRate">₺0</span>
          <span class="rmt-rate-unit">/ hour</span>
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
        <h2 class="pd-title">A rental dealer’s <span class="p2-text">whole job</span> in one program</h2>
        <p class="pd-tagline">From the customer and device card to the meter round, from the service ticket to the payment — all in the same place.</p>
        <p class="pd-desc">Nextus Servis is not a general-purpose “job tracker”. It was written for dealers who <strong>rent out and service printers, copiers and office equipment</strong> : meter reading, included volume and overage pricing, device profitability, toner forecasting and route planning — the steps that belong to this trade sit at the centre of the app.</p>

        <div class="pd-features">
          <div class="pd-feature">
            <div class="pd-feature-icon">📟</div>
            <h3>Invoices straight from the meter</h3>
            <p>Enter the meter reading and the rent invoice works itself out from the included volume and the overage price. A pre-invoice meter check shows you what is missing.</p>
          </div>
          <div class="pd-feature">
            <div class="pd-feature-icon">📉</div>
            <h3>Lost revenue panel</h3>
            <p>Devices whose meters are late or never entered are listed by name. “Who did we not invoice this month?” stops being guesswork.</p>
          </div>
          <div class="pd-feature">
            <div class="pd-feature-icon">🎫</div>
            <h3>Service tickets and QR fault reports</h3>
            <p>Take the device in, open a ticket, record the work and the parts, close it. The customer can scan the QR and report a fault <strong>without signing in</strong> .</p>
          </div>
          <div class="pd-feature">
            <div class="pd-feature-icon">🏷</div>
            <h3>Barcoded stock · Zebra labels</h3>
            <p>Parts and consumables go in with an LS2208 barcode reader, labels come off a Zebra printer. Consumable tracking and the toner run-out forecast are worked out from the meter pace.</p>
          </div>
          <div class="pd-feature">
            <div class="pd-feature-icon">🧾</div>
            <h3>Accounting, ledger and payments</h3>
            <p>Ledger accounts, payment tracking, bulk price rises, bulk debt reminders (SMS/WhatsApp — the provider account is separate) and a bulk summary that fits 100 tickets on one page.</p>
          </div>
          <div class="pd-feature">
            <div class="pd-feature-icon">💬</div>
            <h3>Talking on WhatsApp</h3>
            <p>An incoming message is matched to the customer by their number; the work done and the amount go back to them in one click. <span class="pd-cond">A WhatsApp Business API (Meta) account, business verification and an approved message template are required; the conversation fee is paid to Meta.</span></p>
          </div>
        </div>

        <div class="pd-cta">
          <a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20a%20demo%20of%20Nextus%20Servis" target="_blank" rel="noopener" class="btn btn-grad">Get a demo on WhatsApp →</a>
          <a href="#fiyatlandirma" class="btn btn-ghost">See the pricing</a>
        </div>
      </div>

      <div class="pd-mock reveal reveal-left">
        <div class="pd-mock-frame">
          <div class="pd-mock-glow"></div>
          <div class="mockup-titlebar">
            <span class="dot-r r"></span><span class="dot-r y"></span><span class="dot-r g"></span>
            <div class="titlebar-url">Service tickets</div>
            <span class="mock-sample-badge">example screen</span>
          </div>
          <div class="mock-srv">
            <div class="mock-srv-head">
              <div class="mock-h">Service flow</div>
              <span class="badge">● 12 open tickets</span>
            </div>
            <div class="mock-srv-kanban">
              <div class="kan-col c1">
                <div class="kan-head"><span>Waiting</span><span class="ct">5</span></div>
                <div class="kan-card">
                  <div class="id">#SF-2847</div>
                  <div class="ttl">Canon iR-ADV · paper jam</div>
                  <div class="meta"><span><i class="priority h"></i>Urgent</span><span>QR</span></div>
                </div>
                <div class="kan-card">
                  <div class="id">#SF-2848</div>
                  <div class="ttl">Konica Minolta · fuser fault</div>
                  <div class="meta"><span><i class="priority m"></i>Normal</span><span>Phone</span></div>
                </div>
                <div class="kan-card">
                  <div class="id">#SF-2849</div>
                  <div class="ttl">Pantum · toner change</div>
                  <div class="meta"><span><i class="priority l"></i>Low</span><span>WA</span></div>
                </div>
              </div>
              <div class="kan-col c2">
                <div class="kan-head"><span>In service</span><span class="ct">4</span></div>
                <div class="kan-card">
                  <div class="id">#SF-2845</div>
                  <div class="ttl">Ricoh MP · drum unit</div>
                  <div class="meta"><span><i class="priority h"></i>Waiting for a part</span><span>Stock</span></div>
                </div>
                <div class="kan-card">
                  <div class="id">#SF-2846</div>
                  <div class="ttl">Kyocera TASKalfa · maintenance</div>
                  <div class="meta"><span><i class="priority m"></i>Periodic</span><span>Route</span></div>
                </div>
              </div>
              <div class="kan-col c3">
                <div class="kan-head"><span>Closed</span><span class="ct">8</span></div>
                <div class="kan-card">
                  <div class="id">#SF-2841</div>
                  <div class="ttl">Canon iR · feed roller</div>
                  <div class="meta"><span style="color:#10b981">✓ Invoiced</span><span>Ledger</span></div>
                </div>
                <div class="kan-card">
                  <div class="id">#SF-2842</div>
                  <div class="ttl">Konica · meter read</div>
                  <div class="meta"><span style="color:#10b981">✓ On the summary</span><span>Rent</span></div>
                </div>
                <div class="kan-card">
                  <div class="id">#SF-2843</div>
                  <div class="ttl">Pantum · consumable issued</div>
                  <div class="meta"><span style="color:#10b981">✓ Taken off stock</span><span>Barcode</span></div>
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
                <div class="t">Customers report faults by QR</div>
                <div class="s">They scan the QR on the machine and report without signing in — the ticket opens on your side</div>
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
      <span class="section-eyebrow"><span class="dot" style="background:var(--p2-2)"></span>What is in the box</span>
      <h2 class="section-title">Whatever is there <span class="gradient-text">is written here</span></h2>
      <p class="section-sub">Every item on the list below works in the product today. Where a third-party account is needed we have said so. What is missing is written just as plainly — we do not want surprises.</p>
    </div>

    <div class="cap-groups reveal reveal-stagger">
      <div class="cap-group">
        <div class="cap-group-head">
          <span class="cap-ico">💸</span>
          <div>
            <h3>The money side</h3>
            <div class="cap-group-sub">rent · meters · payments</div>
          </div>
        </div>
        <ul class="cap-list">
          <li><strong>Meter reading</strong> and meter-based automatic invoicing</li>
          <li><strong>Rent invoicing:</strong> included volume + overage price</li>
          <li>A pre-invoice <strong>meter check</strong> and late-meter tracking</li>
          <li><strong>Meter round</strong> — bulk meter entry per customer</li>
          <li><strong>Lost revenue panel</strong></li>
          <li>Accounting / ledger and <strong>payment tracking</strong></li>
          <li><strong>Bulk price rises</strong> and bulk debt reminders (SMS/WhatsApp — <span class="cap-cond">the provider account is separate</span>)</li>
          <li><strong>Bulk summary printing</strong> — 100 tickets, one page</li>
          <li><strong>Device profitability report</strong> and device list</li>
        </ul>
      </div>

      <div class="cap-group">
        <div class="cap-group-head">
          <span class="cap-ico">🔧</span>
          <div>
            <h3>The field side</h3>
            <div class="cap-group-sub">service · stock · routes</div>
          </div>
        </div>
        <ul class="cap-list">
          <li>Customer, device and <strong>service ticket</strong> management</li>
          <li><strong>Stock + barcode</strong> (LS2208) and <strong>Zebra labels</strong></li>
          <li>Consumable tracking and <strong>toner run-out forecasting</strong> — “how many days left” from the meter pace</li>
          <li><strong>Route planning</strong> — a multi-stop Google Maps link</li>
          <li><strong>Customers report faults by QR</strong> (no sign-in needed)</li>
          <li>A one-click <strong>WhatsApp status update to the customer</strong> (work done + amount) — <span class="cap-cond">a WhatsApp Business API account is required</span></li>
          <li>Incoming WhatsApp messages <strong>matched to the customer automatically</strong> — <span class="cap-cond">depends on the same account</span></li>
          <li><strong>Dealer market</strong> — parts trading between dealers <span class="cap-cond">(just opening; it gets more useful as more dealers join)</span></li>
        </ul>
      </div>

      <div class="cap-group">
        <div class="cap-group-head">
          <span class="cap-ico">🗄</span>
          <div>
            <h3>The data side</h3>
            <div class="cap-group-sub">import · reports · security</div>
          </div>
        </div>
        <ul class="cap-list">
          <li><strong>Excel / CSV import</strong> — you start with the list you already have</li>
          <li><strong>Backup download</strong> — all your data in one JSON file</li>
          <li>Optional <strong>two-factor authentication (2FA)</strong></li>
          <li><strong>Brand and model reliability reports</strong></li>
          <li>Device profitability and device list reports</li>
          <li><strong>Export to Logo</strong> — a data export for your accounting software</li>
          <li>Web + <strong>PWA</strong> — add it to the home screen on a phone</li>
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
      <span class="section-eyebrow"><span class="dot" style="background:var(--p3-1)"></span>Day to day</span>
      <h2 class="section-title">In the field and in the office, <span class="gradient-text">the same program</span></h2>
      <p class="section-sub">The engineer closes the ticket on a phone and the office sees the invoice at the same moment. No separate Excel files, no separate ledgers.</p>
    </div>

    <div class="bento-grid">
      <!-- 1 (LARGE): Mobil / PWA -->
      <div class="bento bento-mobile reveal reveal-scale">
        <div class="bento-content">
          <div class="bento-eyebrow">THE ENGINEER IN THE FIELD</div>
          <h3>The full panel on a phone</h3>
          <p>There is no separate mobile app to download: open it in the browser and add it to the home screen (PWA). The engineer enters the meter, closes the ticket and takes the consumable off stock — the office sees it straight away.</p>
          <div class="bento-tags">
            <span>Web</span><span>PWA</span><span>Add to home screen</span><span>No install</span>
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
                    <div class="pah-greet">Today’s route</div>
                    <div class="pah-name">Next up <strong>4 stops</strong></div>
                  </div>
                  <div class="pah-avatar">E</div>
                </div>
                <div class="phone-stat-card">
                  <div class="psc-label">METER ENTERED</div>
                  <div class="psc-num">9 / 13</div>
                  <div class="psc-trend">↑ the round is still running</div>
                </div>
                <div class="phone-list">
                  <div class="phone-list-item">
                    <span class="pli-dot" style="background:#10b981"></span>
                    <div class="pli-body">
                      <div class="pli-title">Meter entered</div>
                      <div class="pli-meta">Canon iR-ADV · Mono 48,210</div>
                    </div>
                    <div class="pli-amt">✓</div>
                  </div>
                  <div class="phone-list-item">
                    <span class="pli-dot" style="background:#f59e0b"></span>
                    <div class="pli-body">
                      <div class="pli-title">Toner running out</div>
                      <div class="pli-meta">About 11 days left</div>
                    </div>
                    <div class="pli-amt small">⚠</div>
                  </div>
                  <div class="phone-list-item">
                    <span class="pli-dot" style="background:#a855f7"></span>
                    <div class="pli-body">
                      <div class="pli-title">Ticket closed</div>
                      <div class="pli-meta">Part taken off stock by barcode</div>
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
                <div class="phone-notif-text">Status update sent to the customer</div>
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
          <div class="bento-eyebrow">ACCOUNT SECURITY</div>
          <h3>Your data stays yours</h3>
          <p>Optional two-factor authentication (2FA) and a one-click backup download. Your customer list is in your hands at any moment.</p>
        </div>
        <div class="bento-shield-rays"></div>
      </div>

      <!-- 3: Toplu icmal / cikti -->
      <div class="bento bento-pdf reveal reveal-rotate">
        <div class="bento-content">
          <div class="bento-eyebrow">MONTH END</div>
          <h3>Bulk summary</h3>
          <p>100 service tickets on one page, with the device list and the profitability report beside it.</p>
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
            <div class="pdf-stamp">SUMMARY</div>
          </div>
        </div>
      </div>

      <!-- 4: WhatsApp -->
      <div class="bento bento-wapp reveal reveal-scale">
        <div class="bento-content">
          <div class="bento-eyebrow">TALKING TO CUSTOMERS</div>
          <h3>Updates over WhatsApp</h3>
          <p>An incoming message is matched to the customer automatically; the work and the amount go back in one click.</p>
        </div>
        <div class="bento-chat">
          <div class="chat-bubble chat-in">
            <span>Is the machine ready?</span>
          </div>
          <div class="chat-bubble chat-out">
            <span>Fuser replaced and tested. Ticket #SF-2845 · ₺1,240 🖨</span>
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
          <div class="bento-eyebrow">REPORTS</div>
          <h3>Which machine actually pays?</h3>
          <p>Device profitability and brand/model reliability on one screen.</p>
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
            <span class="bcs-num">Device</span>
            <span class="bcs-lbl">level profit</span>
          </div>
        </div>
      </div>

      <!-- 6 (LARGE): Cevre birimler -->
      <div class="bento bento-integ reveal reveal-rotate">
        <div class="bento-content">
          <div class="bento-eyebrow">WHAT IT TALKS TO</div>
          <h3>The tools you already use</h3>
          <p>It works with the Excel file you have, your barcode reader, your label printer, WhatsApp and Google Maps. On the accounting side there is an export to Logo; there is no Turkish e-invoice (GİB) integration.</p>
          <p class="bento-foot-note">WhatsApp and SMS need third-party accounts: a WhatsApp Business API (Meta) account with an approved message template, and Netgsm credit for SMS. You pay those providers directly; we set them up with you.</p>
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
          <div class="integ-node n8" style="--del:2.8s">Maps routes</div>
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
      <span class="section-eyebrow"><span class="dot" style="background:#10b981"></span>Month end</span>
      <h2 class="section-title">The same job, <span class="gradient-text">two different month ends</span></h2>
      <p class="section-sub">What a rental dealer’s month-end close looks like with a ledger-and-Excel mix, and with one program.</p>
    </div>

    <div class="ba-grid">
      <div class="ba-side before reveal reveal-left">
        <span class="ba-side-label">😩 EXCEL + LEDGER</span>
        <h3>The month-end hunt</h3>
        <ul class="ba-list">
          <li>The meter slips are in the engineer’s bag and some never arrive</li>
          <li>Which meters were read and which were skipped — nobody quite knows</li>
          <li>Included volume and overage worked out by hand, again every month</li>
          <li>Service tickets in one place, the rent invoice in another, consumables in a third</li>
          <li>Nobody knows when the toner runs out; you find out when the machine stops</li>
          <li>Which machine makes money and which keeps eating service — unknown</li>
          <li>Finding who is late paying means walking the ledger line by line</li>
        </ul>
        <div class="ba-side-stat">Uninvoiced meter volume <strong>is invisible</strong>: by the time anyone notices, the month has closed.</div>
      </div>

      <div class="ba-divider">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
      </div>

      <div class="ba-side after reveal reveal-right">
        <span class="ba-side-label">🚀 NEXTUS SERVIS</span>
        <h3>The month-end close</h3>
        <ul class="ba-list">
          <li>Bulk entry per customer on the meter round — the engineer does it on a phone</li>
          <li>The pre-invoice meter check lists whatever is still missing</li>
          <li>Included volume and overage price are worked out automatically</li>
          <li>The service ticket, the rent invoice and the consumables sit on the same device card</li>
          <li>The toner forecast reads the meter pace and says how many days are left</li>
          <li>The device profitability report and brand/model reliability are in your hands</li>
          <li>Bulk debt reminders go out by SMS or WhatsApp in one pass</li>
        </ul>
        <div class="ba-side-stat"><strong>Lost revenue panel</strong> puts the uninvoiced devices in front of you by name.</div>
      </div>
    </div>
  </div>
</section>

<!-- ========== NASIL CALISIR ========== -->
<section class="how" id="nasil">
  <div class="container">
    <div class="section-head reveal">
      <span class="section-eyebrow"><span class="dot"></span>How we start</span>
      <h2 class="section-title">Three steps <span class="gradient-text">to your first month end</span></h2>
      <p class="section-sub">No IT department, no server build, no months-long project. A conversation, a migration, a first close.</p>
    </div>

    <div class="how-grid">
      <div class="how-card reveal reveal-flip">
        <div class="step-emblem">
          <div class="step-emblem-glow"></div>
          <div class="step-emblem-ring"></div>
          <div class="step-emblem-inner">
            <span class="step-emblem-label">STEP</span>
            <span class="step-emblem-num">01</span>
          </div>
          <span class="step-emblem-icon">💬</span>
        </div>
        <h3>Message us on WhatsApp</h3>
        <p>A 15-minute live demo over a shared screen. We look at a sample from your own device list — a real screen, not a canned deck.</p>
        <div class="how-meta">⏱ 15 minutes</div>
      </div>
      <div class="how-card reveal reveal-flip">
        <div class="step-emblem">
          <div class="step-emblem-glow"></div>
          <div class="step-emblem-ring"></div>
          <div class="step-emblem-inner">
            <span class="step-emblem-label">STEP</span>
            <span class="step-emblem-num">02</span>
          </div>
          <span class="step-emblem-icon">📥</span>
        </div>
        <h3>Let us move your data</h3>
        <p>We import your customer and device lists from Excel or CSV. Setup, import and 2 hours of training — <strong>list price ₺12,000; free during our founding period</strong>.</p>
        <div class="how-meta">🤝 One-to-one setup</div>
      </div>
      <div class="how-card reveal reveal-flip">
        <div class="step-emblem">
          <div class="step-emblem-glow"></div>
          <div class="step-emblem-ring"></div>
          <div class="step-emblem-inner">
            <span class="step-emblem-label">STEP</span>
            <span class="step-emblem-num">03</span>
          </div>
          <span class="step-emblem-icon">🧾</span>
        </div>
        <h3>Let us close the first month together</h3>
        <p>Meter round → pre-check → rent summary. We are with you for the first close, so you see the lost revenue from month one.</p>
        <div class="how-meta">📟 14 days free</div>
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
        <div class="guarantee-eyebrow">★ FOUNDING PERIOD</div>
        <h3>The setup package is free right now</h3>
        <p>For setup + the Excel data import + 2 hours of training our <strong>list price is ₺12,000</strong>. We are not charging for it during the founding period, because we are bedding the product in together, in the field.</p>
        <ul class="guarantee-list">
          <li>14 days free <span class="trial-limit">(trial account: 2 users · 50 tickets)</span></li>
          <li>No card needed</li>
          <li>No commitment</li>
          <li>Download your backup whenever you like</li>
        </ul>
      </div>
      <div class="guarantee-cta" style="display:flex;align-items:center">
        <a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20information%20about%20the%20founding-period%20setup%20package" target="_blank" rel="noopener" class="btn btn-grad">Save my place</a>
      </div>
    </div>
  </div>
</section>

<!-- ========== FIYATLANDIRMA ========== -->
<section class="pricing" id="fiyatlandirma">
  <div class="container">
    <div class="section-head reveal">
      <span class="section-eyebrow"><span class="dot" style="background:var(--p2-1)"></span>Pricing</span>
      <h2 class="section-title">A base price + <span class="gradient-text">₺25 per device</span></h2>
      <p class="section-sub">Every plan includes a number of devices; each rental device above that number costs <strong>₺25 in all three plans</strong>. Prices exclude VAT.</p>

      <div class="toggle-wrap reveal">
        <div class="toggle" id="billingToggle" data-active="monthly">
          <div class="indicator"></div>
          <button class="toggle-btn active" data-bill="monthly">Monthly</button>
          <button class="toggle-btn" data-bill="yearly">Yearly <span class="save-badge">2 months free</span></button>
        </div>
      </div>
    </div>

    <div class="pricing-grid">
      <!-- BASLANGIC -->
      <div class="price-card reveal reveal-scale" data-plan="baslangic" data-base="1749" data-included="20">
        <div class="price-icon">🌱</div>
        <div class="price-name">Starter</div>
        <div class="price-tag">Up to 20 devices</div>
        <div class="price-amount">
          <span class="currency">₺</span>
          <span class="num">1,749</span>
          <span class="period">/ month</span>
          <span class="price-vat">+VAT</span>
        </div>
        <div class="price-note">The first <strong>20</strong> rental devices included · ₺25 per device after that</div>
        <div class="price-calc" hidden></div>
        <a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20to%20start%20the%2014-day%20trial%20on%20the%20Starter%20plan" target="_blank" rel="noopener" class="btn btn-ghost btn-block">Try it free for 14 days</a>
        <ul class="price-features">
          <li class="has"><strong>The first 20 rental devices included</strong> · ₺25 for each device beyond</li>
          <li class="has"><strong>3 users · 200 service tickets a month</strong></li>
          <li class="has">Customers · devices · service tickets · QR fault reports</li>
          <li class="has">Stock · barcode · Zebra labels · toner forecast</li>
          <li class="has">Accounting / ledger</li>
          <li class="has">Dealer market <span class="feat-note">(just opening)</span></li>
          <li class="has">Setup + Excel import + 2 hours of training</li>
          <li class="no">Meter reading and automatic rent invoicing</li>
          <li class="no">Lost revenue panel · payments · routes</li>
          <li class="no">Brand and model reliability reports</li>
        </ul>
      </div>

      <!-- PROFESYONEL -->
      <div class="price-card featured reveal reveal-scale" data-plan="profesyonel" data-base="2099" data-included="25">
        <div class="price-badge">Where we suggest starting</div>
        <div class="price-icon">⚡</div>
        <div class="price-name">Professional</div>
        <div class="price-tag">21–100 devices</div>
        <div class="price-amount">
          <span class="currency">₺</span>
          <span class="num">2,099</span>
          <span class="period">/ month</span>
          <span class="price-vat">+VAT</span>
        </div>
        <div class="price-note">The first <strong>25</strong> rental devices included · ₺25 per device after that</div>
        <div class="price-calc" hidden></div>
        <a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20to%20start%20the%2014-day%20trial%20on%20the%20Professional%20plan" target="_blank" rel="noopener" class="btn btn-grad btn-block">Try it free for 14 days</a>
        <ul class="price-features">
          <li class="has"><strong>The first 25 rental devices included</strong> · ₺25 for each device beyond</li>
          <li class="has"><strong>10 users · unlimited service tickets</strong></li>
          <li class="has"><strong>Everything in Starter</strong>, plus:</li>
          <li class="has">Meter reading and automatic rent invoicing</li>
          <li class="has">Payment tracking · route planning · late-meter tracking</li>
          <li class="has">The lost revenue panel and device profitability</li>
          <li class="has">WhatsApp updates <span class="feat-note">(a WhatsApp Business API account is required)</span> · bulk debt reminder SMS <span class="feat-note">(Netgsm credit is separate)</span></li>
          <li class="has">Setup + Excel import + 2 hours of training</li>
          <li class="no">Brand and model reliability reports</li>
        </ul>
      </div>

      <!-- KURUMSAL -->
      <div class="price-card reveal reveal-scale" data-plan="kurumsal" data-base="5249" data-included="100">
        <div class="price-icon">🏢</div>
        <div class="price-name">Enterprise</div>
        <div class="price-tag">100+ devices · up to 50 users</div>
        <div class="price-amount">
          <span class="currency">₺</span>
          <span class="num">5,249</span>
          <span class="period">/ month</span>
          <span class="price-vat">+VAT</span>
        </div>
        <div class="price-note">The first <strong>100</strong> rental devices included · ₺25 per device after that</div>
        <div class="price-calc" hidden></div>
        <a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20to%20talk%20about%20the%20Enterprise%20plan" target="_blank" rel="noopener" class="btn btn-ghost btn-block">Let’s talk</a>
        <ul class="price-features">
          <li class="has"><strong>The first 100 rental devices included</strong> · ₺25 for each device beyond</li>
          <li class="has"><strong>50 users · unlimited service tickets</strong></li>
          <li class="has"><strong>Everything in Professional</strong>, plus:</li>
          <li class="has">Brand and model reliability reports</li>
          <li class="has">Device renewal report</li>
          <li class="has">Setup + Excel import + 2 hours of training</li>
        </ul>
      </div>
    </div>

    <div class="pricing-foot reveal">
      <span class="check-mini">✓</span> 14 days free <span class="trial-limit">(trial: 2 users · 50 tickets)</span> &nbsp;·&nbsp;
      <span class="check-mini">✓</span> No card needed &nbsp;·&nbsp;
      <span class="check-mini">✓</span> 2 months free when you pay yearly &nbsp;·&nbsp;
      <span class="check-mini">✓</span> Prices exclude VAT
      <div style="margin-top:16px;font-size:13px;color:var(--text-faint);max-width:720px;margin-left:auto;margin-right:auto;line-height:1.6">
        The overage price is the same in all three plans (₺25); the base price and the number of included devices change from plan to plan. What really separates the plans is <strong>the features they unlock and the number of users</strong> : meter and rent invoicing, payments, routes and the lost revenue panel start with Professional, and the brand/model reliability reports are in Enterprise. So do not decide on device count alone — <strong>look at which plan unlocks the feature you actually need</strong>. Move the slider and the cards update to your own device count. If you are not sure which plan fits you,
        <a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20to%20know%20which%20plan%20fits%20my%20device%20count" target="_blank" rel="noopener" style="color:#5eead4;border-bottom:1px solid rgba(94,234,212,0.35)">Message us on WhatsApp</a>let us choose it together.
      </div>
    </div>
  </div>
</section>

<!-- ========== SSS ========== -->
<section class="faq" id="sss">
  <div class="container">
    <div class="section-head reveal">
      <span class="section-eyebrow"><span class="dot" style="background:var(--p3-1)"></span>FAQ</span>
      <h2 class="section-title">Frequently asked <span class="gradient-text">questions</span></h2>
      <p class="section-sub">Here are the questions we get most, including the answers about what the product does not do. For anything else, message us on WhatsApp.</p>
    </div>

    <div class="faq-wrap">
      <div class="faq-item reveal reveal-left">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-1" id="faq-q-1">
          <span>How exactly is the price worked out?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-1" role="region" aria-labelledby="faq-q-1" aria-hidden="true">
          <p>Base price + included devices + overage. For example: <strong>with 150 rental devices, on the Professional plan</strong> ₺2,099 base + (150 − 25) × ₺25 = <strong>₺5,224/month + VAT</strong>. The overage price is ₺25 in all three plans. Paid yearly you pay ten times the monthly total — that is <strong>2 months free</strong>.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-right">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-2" id="faq-q-2">
          <span>What do setup and data import cost?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-2" role="region" aria-labelledby="faq-q-2" aria-hidden="true">
          <p>Setup + the Excel/CSV data import + 2 hours of training have a <strong>list price is ₺12,000</strong>; during the founding period we do it <strong>free of charge</strong> . We import your customer and device lists from the file you already have, so you do not key anything in from scratch.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-left">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-3" id="faq-q-3">
          <span>Is there a Turkish e-invoice integration?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-3" role="region" aria-labelledby="faq-q-3" aria-hidden="true">
          <p><strong>No, there is no e-invoice / GİB integration at the moment.</strong> What there is today is an <strong>export to Logo</strong>. We will not call something “coming soon” when we cannot give a date — make your decision on the product as it is today.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-right">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-4" id="faq-q-4">
          <span>Can my customer see their own devices in a portal?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-4" role="region" aria-labelledby="faq-q-4" aria-hidden="true">
          <p><strong>There is no customer portal</strong> — your customer cannot sign in and look at their machines. What they can do instead is scan the <strong>QR code on the machine and report a fault without signing in</strong>, and you send the work done and the amount back over WhatsApp in one click.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-left">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-5" id="faq-q-5">
          <span>Can I see the engineer’s location live?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-5" role="region" aria-labelledby="faq-q-5" aria-hidden="true">
          <p><strong>No, there is no live location or GPS tracking.</strong> What there is, is route planning: we order the day’s stops and produce a <strong>multi-stop Google Maps link</strong> , so the engineer goes into navigation with one tap.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-right">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-6" id="faq-q-6">
          <span>Is there a mobile app?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-6" role="region" aria-labelledby="faq-q-6" aria-hidden="true">
          <p>There is <strong>no separate app on the App Store or Play</strong>. Nextus Servis runs as <strong>web + PWA</strong> : you open it in the browser and add it to the home screen, and on a phone it behaves like an app. The engineer enters meters and closes tickets from the phone.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-left">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-7" id="faq-q-7">
          <span>How does meter-based invoicing work?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-7" role="region" aria-labelledby="faq-q-7" aria-hidden="true">
          <p><strong>Meter round</strong> screen you enter meters in bulk, customer by customer. The rent invoice is then worked out automatically from the <strong>included volume</strong> and the <strong>overage price</strong> in the contract. Before invoicing, the <strong>meter check</strong> lists the readings that are missing, <strong>late-meter tracking</strong> shows what is running late, and the <strong>Lost revenue panel</strong> puts the uninvoiced ones in front of you by name.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-right">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-8" id="faq-q-8">
          <span>Is the data mine? Can I take it out?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-8" role="region" aria-labelledby="faq-q-8" aria-hidden="true">
          <p>Yes. <strong>You download your backup in one click</strong> — a JSON file containing all of your data (with administrator rights). We import your customer and device lists <strong>from Excel or CSV</strong>; the file that comes out is JSON today, and there is no Excel export yet. On your account you can turn on <strong>optional two-factor authentication (2FA)</strong> .</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-left">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-9" id="faq-q-9">
          <span>How many dealers use it?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-9" role="region" aria-labelledby="faq-q-9" aria-hidden="true">
          <p>The honest answer: <strong>we are early</strong> and we are working in the field with our founding customer. That is why you will not find a customer count, testimonials, star ratings or press logos on this page — <strong>we would rather not invent them</strong>. The way we convince you is to show the live screen and do the first month-end close with you.</p>
        </div>
      </div>

      <div class="faq-item reveal reveal-right">
        <button class="faq-q" type="button" aria-expanded="false" aria-controls="faq-a-10" id="faq-q-10">
          <span>Are there any AI features?</span>
          <span class="plus">+</span>
        </button>
        <div class="faq-a" id="faq-a-10" role="region" aria-labelledby="faq-q-10" aria-hidden="true">
          <p><strong>No.</strong> Calculations like the toner run-out forecast are not AI, they are <strong>plain arithmetic on the meter pace</strong>. The program’s job is not to guess; it is to keep the record right and raise the invoice right.</p>
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
          <div class="founder-role">Founder · the person who wrote the software</div>
        </div>
      </div>

      <p class="founder-lead">
        In a copier dealership I saw work that was <strong>never invoiced</strong> because the meters had not been read. I solved it sitting next to the dealer, not at a desk — Nextus Servis came out of that.
      </p>

      <div class="founder-grid">
        <div class="founder-item">
          <span class="founder-item-t">You reach me directly</span>
          There is no call centre. You talk to the person who wrote it.
        </div>
        <div class="founder-item">
          <span class="founder-item-t">I do the setup myself</span>
          I import your Excel and I train your team.
        </div>
        <div class="founder-item">
          <span class="founder-item-t">You can leave whenever you want</span>
          The data is yours. One button, you download it and go.
        </div>
      </div>

      <div class="founder-cta">
        <a href="https://wa.me/905526961703?text=Hello%20Mehmet%20Naim%2C%20I%20would%20like%20to%20talk%20about%20Nextus%20Servis"
           target="_blank" rel="noopener" class="btn btn-grad">Message me directly →</a>
        <span class="founder-tel">+90 552 696 17 03</span>
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
        <span class="section-eyebrow"><span class="dot"></span>Start now</span>
        <h2 class="cta-title">Let us count your machines once <span class="gradient-text">and see what is leaking, together</span></h2>
        <p class="cta-sub">14 days free (trial account: 2 users · 50 tickets). No card needed, no commitment. Setup + Excel import + 2 hours of training are free during the founding period.</p>
        <div class="cta-actions">
          <a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20to%20start%20the%2014-day%20trial%20of%20Nextus%20Servis" target="_blank" rel="noopener" class="btn btn-grad btn-lg btn-pulse">Let’s start on WhatsApp <span class="arr">→</span></a>
          <a href="#hesap" class="btn btn-ghost btn-lg">Show me the numbers first</a>
        </div>
        <div class="cta-meta">
          <span>✓ +90 552 696 17 03</span>
          <span>✓ One-to-one setup</span>
          <span>✓ Download your data any time</span>
        </div>

        <!-- WhatsApp kullanmak istemeyen / mesai dışı bakan ziyaretçi için ikinci yol.
             /api/talep talebi önce veritabanına yazar; CRM bağlı olmasa da kaybolmaz. -->
        <div class="cta-form-wrap">
          <div class="cta-form-or">— or leave your number and we will call you —</div>
          <form id="leadForm" class="cta-form" novalidate>
            <input type="text" name="firma" id="lfFirma" placeholder="Company name" autocomplete="organization" required>
            <input type="tel" name="telefon" id="lfTel" placeholder="Phone" autocomplete="tel" inputmode="tel" required>
            <input type="text" name="cihazSayisi" id="lfCihaz" placeholder="How many rental devices?" inputmode="numeric">
            <!-- bal küpü: gerçek kullanıcı görmez, botlar doldurur -->
            <input type="text" name="website_hp" id="lfHp" tabindex="-1" autocomplete="off" aria-hidden="true">
            <button type="submit" class="btn btn-grad" id="lfBtn">Call me</button>
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
               aria-label="Nextus Servis brand animation"></video>
        <a href="#" class="logo">
          <span class="logo-mark"><svg class="logo-n" viewBox="0 0 230 200" aria-hidden="true"><g class="nx-body"><rect x="30" y="20" width="38" height="160"/><polygon points="68,20 106,20 150,180 112,180"/><rect x="150" y="20" width="38" height="160"/></g><path class="nx-cut" d="M14 154 C84 120 152 78 224 34" pathLength="100"/></svg></span>
          <span class="logo-text">Nextus Servis</span>
        </a>
        <p>Meter reading, rent invoicing and service tracking for dealers who rent out and service printers, copiers and office equipment. A NEXUS GROUP product.</p>
      </div>

      <div class="footer-col">
        <h3>Product</h3>
        <a href="#urun">What it does</a>
        <a href="#ozellikler">Day to day</a>
        <a href="#donusum">The month-end comparison</a>
        <a href="#fiyatlandirma">Pricing</a>
      </div>

      <div class="footer-col">
        <h3>Before you decide</h3>
        <a href="#hesap">Lost revenue calculator</a>
        <a href="#nasil">How we start</a>
        <a href="#sss">Frequently asked questions</a>
      </div>

      <div class="footer-col">
        <h3>Contact</h3>
        <a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20information%20about%20Nextus%20Servis" target="_blank" rel="noopener">WhatsApp: +90 552 696 17 03</a>
        <a href="tel:+905526961703">Phone: +90 552 696 17 03</a>
      </div>
    </div>

    <div class="footer-bottom">
      <span>© 2026 Nextus Servis — NEXUS GROUP</span>
      <span class="footer-meta">Prices exclude VAT · Calculator results are estimates</span>
    </div>
  </div>
</footer>

<!-- WhatsApp Floating Button -->
<a href="https://wa.me/905526961703?text=Hello%2C%20I%20would%20like%20a%20demo%20of%20Nextus%20Servis%20and%20pricing" class="wa-float" aria-label="Contact on WhatsApp" target="_blank" rel="noopener">
  <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true" focusable="false">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
  <span class="wa-tooltip">Ask for a demo</span>
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
    var s = Math.round(Math.abs(n)).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
    return (neg ? '−' : '') + s;
  }
  /* isaretli para: eksi, para biriminin ONUNE gelir */
  function tl(n) {
    return (Math.round(n) < 0 ? '−₺' : '₺') + Math.round(Math.abs(n)).toString().replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
  }
  function formatCompact(n) {
    var neg = n < 0, a = Math.abs(n);
    var s;
    if (a >= 1000000) s = (a / 1000000).toFixed(1) + 'M';
    else if (a >= 1000) s = Math.round(a / 1000) + 'K';
    else s = Math.round(a).toString();
    return (neg ? '−' : '') + s;
  }
  function dec1(n) { return n.toFixed(1); }

  /* ============================================================
     FIYAT MODELI  (tek kaynak — ROI ve fiyat kartlari ayni yerden okur)
     ============================================================ */
  var PER_DEVICE = 25;                 // dahil sayinin ustundeki her cihaz — UC PAKETTE DE AYNI
  var YEARLY_MONTHS = 10;              // yillik odeme = aylik x10 (2 ay bedava)
  var RECOVERY = 0.70;                 // kacan gelirin geri kazanildigi varsayilan oran
  var PLANS = {
    baslangic:   { name: 'Starter',      base: 1749, included: 20 },
    profesyonel: { name: 'Professional', base: 2099, included: 25 },
    kurumsal:    { name: 'Enterprise',   base: 5249, included: 100 }
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
          per.textContent = '/ year';
          amt.classList.add('yearly');
        } else {
          num.textContent = formatTL(monthly);
          per.textContent = '/ month';
          amt.classList.remove('yearly');
        }
      }

      var calc = card.querySelector('.price-calc');
      if (calc) {
        if (deviceTouched) {
          var overTxt = over > 0 ? ' + ' + over + ' × ₺' + PER_DEVICE : '';
          calc.innerHTML = billing === 'yearly'
            ? '<strong>' + dev + ' devices</strong> · ₺' + formatTL(base) + ' base' + overTxt +
              ' = <strong>₺' + formatTL(monthly) + '/month</strong> → <strong>₺' + formatTL(yearly) + '</strong> a year + VAT (2 months free)'
            : '<strong>' + dev + ' devices</strong> · ₺' + formatTL(base) + ' base' + overTxt +
              ' = <strong>₺' + formatTL(monthly) + '/month</strong> + VAT';
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
    if (mult < 1) return '⚠️ Weak';
    if (mult < 1.5) return '🆗 Fair';
    if (mult < 3) return '✓ Very good';
    if (mult < 6) return '⚡ Excellent';
    return '🚀 Outstanding';
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
    if (rmtRate) rmtRate.textContent = '₺' + (perHour >= 10 ? formatTL(perHour) : perHour.toFixed(2));
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
    if (vdMiss) vdMiss.textContent = missPct + '%';
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
      paybackTxt = pm < 1 ? '< 1 month' : (pm < 12 ? dec1(pm) + ' months' : dec1(pm / 12) + ' years');
    }

    /* --- ekran --- */
    animateBig(yearlyLeak, elYear);
    if (elYear && !reduceMotion) {
      elYear.classList.add('bump');
      setTimeout(function () { elYear.classList.remove('bump'); }, 250);
    }
    if (elMonth) elMonth.textContent = tl(monthlyLeak);
    if (elMonthlyMini) elMonthlyMini.textContent = tl(monthlyLeak);
    if (elBasis) elBasis.textContent = devices + ' devices × ' + tl(billPer) + ' × ' + missPct + '%';
    if (elNet) elNet.textContent = tl(net);
    if (elPayback) elPayback.textContent = paybackTxt;
    if (elRecovered) elRecovered.textContent = tl(recovered) + ' recovered';

    var netShare = recovered > 0 ? Math.max(0, net) / recovered * 100 : 0;
    var costShare = Math.max(0, 100 - netShare);
    if (barNet) barNet.style.width = netShare.toFixed(1) + '%';
    if (barCost) barCost.style.width = costShare.toFixed(1) + '%';
    if (lblNet) lblNet.textContent = tl(net);
    if (lblCost) lblCost.textContent = tl(yearlyCost);
    if (lblRest) lblRest.textContent = tl(notRecovered);

    if (recName) recName.textContent = plan.name;
    if (recDetail) {
      recDetail.textContent = devices + ' devices: ' + tl(plan.base) + ' base' +
        (over > 0 ? ' + ' + over + ' × ₺' + PER_DEVICE : ' (within the included count)');
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
      rpDiffPill.textContent = '+₺' + formatCompact(Math.max(0, net) * 5) + ' / 5 years';
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
        rmtRate.textContent = '₺' + (ph >= 10 ? formatTL(ph) : ph.toFixed(2));
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
    if (!firma || !tel) { say('Company name and phone number are required.', 'err'); return; }

    var veri = {
      firma: firma,
      telefon: tel,
      cihazSayisi: document.getElementById('lfCihaz').value.trim(),
      website_hp: document.getElementById('lfHp').value,
      utm_source: new URLSearchParams(location.search).get('utm_source') || 'landing-en',
      utm_campaign: new URLSearchParams(location.search).get('utm_campaign') || ''
    };

    btn.disabled = true; say('Sending…');
    fetch('/api/talep', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(veri)
    })
      .then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); })
      .then(function () {
        form.reset();
        say('Got it. We will call you shortly.', 'ok');
      })
      .catch(function () {
        /* Uc yoksa/ulasilamiyorsa talebi kaybetme: WhatsApp'a tasi. */
        say('Could not connect — we are sending this over WhatsApp.', 'err');
        window.open(WA + encodeURIComponent(
          'Hello, I would like information about Nextus Servis.\\nCompany: ' + firma +
          '\\nPhone: ' + tel + (veri.cihazSayisi ? '\\nDevices: ' + veri.cihazSayisi : '')
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

export default function LandingEn() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />
      <div lang="en" dangerouslySetInnerHTML={{ __html: BODY }} />
      <Script id="stk-landing-en" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JS }} />
    </>
  );
}
