import Script from "next/script";

// ⚙️ OTOMATİK ÜRETİLDİ — elle düzenleme! Kaynak: marketing/landing/nextus-servis.html
// Yeniden üret:  node marketing/landing/build-landing.js
// JS bilerek string olarak tutulur (next/script ile çalışır) → tsc/eslint denetlemez,
// böylece "next build" TS hatasıyla kırılmaz.
const CSS = ` blogu yakalar. Bu dosyayi o betige
  baglamayin; baglamak isterseniz once betikte (a) kaynak yolunu, (b) style
  yakalamayi matchAll ile TUM bloklari birlestirecek sekilde guncelleyin ve
  (c) uretilen Landing.tsx'ten Google Fonts <link>'ini kaldirin (fontlar zaten gomulu).
-->
<style>
/* ========== RESET & BASE ========== */
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{
  font-family:'Inter',-apple-system,sans-serif;
  background:#050508;
  color:#e7e7ee;
  line-height:1.5;
  -webkit-font-smoothing:antialiased;
  -moz-osx-font-smoothing:grayscale;
  overflow-x:hidden;
  font-feature-settings:"ss01","cv11";
}
img,svg{display:block;max-width:100%}
button{font:inherit;cursor:pointer;border:none;background:none;color:inherit}
a{color:inherit;text-decoration:none}
ul{list-style:none}
:root{
  --bg:#050508;
  --bg-2:#0a0a12;
  --bg-3:#10101a;
  --border:rgba(255,255,255,0.08);
  --border-strong:rgba(255,255,255,0.14);
  --text:#e7e7ee;
  --text-dim:#9b9bab;
  --text-faint:#5a5a6a;

  /* Aksan 1 — amber/turuncu/kirmizi */
  --p1-1:#f59e0b;
  --p1-2:#f97316;
  --p1-3:#ef4444;
  --p1-grad:linear-gradient(135deg,#f59e0b 0%,#f97316 50%,#ef4444 100%);
  --p1-glow:0 0 60px rgba(249,115,22,0.35);

  /* Aksan 2 — zumrut/teal/cyan (ana renk) */
  --p2-1:#10b981;
  --p2-2:#14b8a6;
  --p2-3:#06b6d4;
  --p2-grad:linear-gradient(135deg,#10b981 0%,#14b8a6 50%,#06b6d4 100%);
  --p2-glow:0 0 60px rgba(20,184,166,0.35);

  /* Aksan 3 — mor/fusya */
  --p3-1:#8b5cf6;
  --p3-2:#a855f7;
  --p3-3:#d946ef;
  --p3-grad:linear-gradient(135deg,#8b5cf6 0%,#a855f7 50%,#d946ef 100%);
  --p3-glow:0 0 60px rgba(168,85,247,0.35);

  --tri-grad:linear-gradient(90deg,#f59e0b,#14b8a6,#a855f7);
  --radius:16px;
  --radius-lg:24px;
  --radius-xl:32px;
  --container:1240px;
  --ease:cubic-bezier(.2,.8,.2,1);
}
::selection{background:rgba(249,115,22,0.3);color:#fff}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-track{background:#0a0a12}
::-webkit-scrollbar-thumb{background:#22222e;border-radius:6px}
::-webkit-scrollbar-thumb:hover{background:#33334a}

h1,h2,h3,h4,h5,h6{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;letter-spacing:-0.02em;line-height:1.1;color:#fff}
.mono{font-family:'JetBrains Mono',monospace}
.container{max-width:var(--container);margin:0 auto;padding:0 24px}

/* ========== UTILITY ========== */
.gradient-text{
  background:var(--tri-grad);
  background-size:200% 200%;
  -webkit-background-clip:text;
  background-clip:text;
  -webkit-text-fill-color:transparent;
  animation:gradFlow 8s ease infinite;
}
@keyframes gradFlow{
  0%,100%{background-position:0% 50%}
  50%{background-position:100% 50%}
}
.p1-text{background:var(--p1-grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.p2-text{background:var(--p2-grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.p3-text{background:var(--p3-grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}

.section-eyebrow{
  display:inline-flex;align-items:center;gap:8px;
  padding:6px 14px;
  border:1px solid var(--border);
  border-radius:999px;
  background:rgba(255,255,255,0.03);
  font-size:13px;color:var(--text-dim);
  font-weight:500;
  backdrop-filter:blur(10px);
  -webkit-backdrop-filter:blur(10px);
}
.section-eyebrow .dot{width:6px;height:6px;border-radius:50%}
.section-title{font-size:clamp(36px,5vw,60px);line-height:1.05;letter-spacing:-0.03em;margin-top:18px}
.section-sub{font-size:18px;color:var(--text-dim);max-width:640px;margin-top:18px;line-height:1.6}
.section-head{text-align:center;margin-bottom:64px}
.section-head .section-sub{margin-left:auto;margin-right:auto}

/* ========== BUTTONS ========== */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:8px;
  padding:14px 22px;
  border-radius:12px;
  font-weight:600;font-size:15px;
  transition:all .25s var(--ease);
  position:relative;
  white-space:nowrap;
}
.btn-primary{
  background:linear-gradient(135deg,#fff 0%,#dadae8 100%);
  color:#08080c;
  box-shadow:0 1px 0 rgba(255,255,255,0.4) inset,0 8px 24px rgba(255,255,255,0.08);
}
.btn-primary:hover{transform:translateY(-1px);box-shadow:0 1px 0 rgba(255,255,255,0.5) inset,0 12px 32px rgba(255,255,255,0.16)}
.btn-grad{
  background:var(--tri-grad);
  background-size:200% 200%;
  color:#fff;
  box-shadow:0 8px 32px rgba(249,115,22,0.25),0 8px 32px rgba(168,85,247,0.2);
  animation:gradFlow 6s ease infinite;
}
.btn-grad:hover{transform:translateY(-2px);box-shadow:0 12px 40px rgba(249,115,22,0.35),0 12px 40px rgba(168,85,247,0.3)}
.btn-ghost{
  background:rgba(255,255,255,0.04);
  color:#fff;
  border:1px solid var(--border-strong);
  backdrop-filter:blur(10px);
}
.btn-ghost:hover{background:rgba(255,255,255,0.08);border-color:rgba(255,255,255,0.25)}
.btn-sm{padding:10px 16px;font-size:14px;border-radius:10px}

/* ========== NAVIGATION ========== */
.nav{
  position:fixed;top:0;left:0;right:0;z-index:100;
  padding:14px 0;
  transition:all .3s var(--ease);
}
.nav.scrolled{
  background:rgba(5,5,8,0.7);
  backdrop-filter:blur(20px) saturate(180%);
  -webkit-backdrop-filter:blur(20px) saturate(180%);
  border-bottom:1px solid var(--border);
}
.nav-inner{
  display:flex;align-items:center;justify-content:space-between;
  max-width:var(--container);margin:0 auto;padding:0 24px;
}
.logo{
  display:flex;align-items:center;gap:10px;
  font-family:'Plus Jakarta Sans';font-weight:800;font-size:18px;
  letter-spacing:-0.02em;
}
.logo-mark{
  width:32px;height:32px;border-radius:9px;
  background:var(--tri-grad);
  background-size:200% 200%;
  animation:gradFlow 6s ease infinite;
  position:relative;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 6px 20px rgba(168,85,247,0.3);
}
.logo-mark::after{
  content:'';position:absolute;inset:6px;border-radius:5px;
  background:#050508;
}
.logo-mark::before{
  content:'';position:absolute;width:10px;height:10px;border-radius:2px;
  background:var(--tri-grad);
  background-size:200% 200%;
  animation:gradFlow 6s ease infinite;
  z-index:1;
  box-shadow:0 0 12px rgba(255,255,255,0.4);
}
.nav-links{display:flex;gap:6px;align-items:center}
.nav-link{
  padding:8px 14px;border-radius:8px;
  color:var(--text-dim);font-size:14px;font-weight:500;
  transition:all .2s var(--ease);
}
.nav-link:hover{color:#fff;background:rgba(255,255,255,0.05)}
.nav-cta{display:flex;gap:10px;align-items:center}
.nav-mobile{display:none}

@media (max-width:900px){
  .nav-links{display:none}
  .nav-cta .btn-ghost{display:none}
}

/* ============================================================
   HERO
============================================================ */
.hero{
  position:relative;
  padding:140px 0 80px;
  overflow:hidden;
  isolation:isolate;
}
.hero-bg{
  position:absolute;inset:0;z-index:-1;overflow:hidden;
}
.hero-bg::before{
  content:'';position:absolute;inset:0;
  background-image:
    radial-gradient(rgba(255,255,255,0.04) 1px,transparent 1px);
  background-size:40px 40px;
  mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%);
  -webkit-mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%);
}
.blob{
  position:absolute;border-radius:50%;filter:blur(120px);opacity:.28;
  animation:blobFloat 22s ease-in-out infinite;
  will-change:transform;
}
.blob-1{width:380px;height:380px;background:#f97316;top:-120px;left:-120px;animation-delay:0s}
.blob-2{width:340px;height:340px;background:#14b8a6;top:30%;right:-120px;animation-delay:-7s;opacity:.22}
.blob-3{width:420px;height:420px;background:#a855f7;bottom:-180px;left:35%;animation-delay:-14s;opacity:.30}
@keyframes blobFloat{
  0%,100%{transform:translate(0,0) scale(1)}
  33%{transform:translate(40px,-30px) scale(1.04)}
  66%{transform:translate(-30px,40px) scale(.96)}
}
.hero-glow{
  position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);
  width:900px;height:500px;
  background:
    radial-gradient(ellipse 60% 50% at 30% 40%,rgba(245,158,11,0.10),transparent 70%),
    radial-gradient(ellipse 60% 50% at 70% 60%,rgba(168,85,247,0.10),transparent 70%),
    radial-gradient(ellipse 50% 40% at 50% 50%,rgba(20,184,166,0.06),transparent 70%);
  pointer-events:none;filter:blur(20px);
}
.hero-grad-line{
  position:absolute;top:0;left:50%;transform:translateX(-50%);
  width:1px;height:100%;
  background:linear-gradient(180deg,transparent,rgba(255,255,255,0.06) 20%,rgba(255,255,255,0.06) 80%,transparent);
  pointer-events:none;
}

.hero-inner{position:relative;text-align:center;max-width:980px;margin:0 auto;padding:0 24px}
.hero-badge{
  display:inline-flex;align-items:center;gap:10px;
  padding:7px 16px;
  border:1px solid var(--border-strong);
  background:rgba(255,255,255,0.03);
  border-radius:999px;
  font-size:13px;color:#d4d4dc;font-weight:500;
  backdrop-filter:blur(10px);
  margin-bottom:32px;
  animation:fadeUp .8s var(--ease) both;
}
.hero-badge .pulse{
  width:8px;height:8px;border-radius:50%;
  background:#10b981;
  position:relative;
}
.hero-badge .pulse::after{
  content:'';position:absolute;inset:-3px;border-radius:50%;
  background:#10b981;
  animation:pulseRing 2s ease-out infinite;
}
@keyframes pulseRing{
  0%{transform:scale(1);opacity:.6}
  100%{transform:scale(2.5);opacity:0}
}

h1.hero-title{
  font-size:clamp(44px,7.5vw,92px);
  line-height:.98;
  letter-spacing:-0.045em;
  font-weight:800;
  animation:fadeUp .9s var(--ease) .1s both;
}
.hero-title .line-2{display:block}
.hero-sub{
  font-size:clamp(17px,1.6vw,21px);
  color:var(--text-dim);
  max-width:680px;
  margin:24px auto 0;
  line-height:1.55;
  animation:fadeUp 1s var(--ease) .25s both;
}
.hero-ctas{
  display:flex;gap:12px;justify-content:center;flex-wrap:wrap;
  margin-top:38px;
  animation:fadeUp 1s var(--ease) .4s both;
}
.hero-meta{
  display:flex;gap:24px;justify-content:center;flex-wrap:wrap;
  margin-top:28px;
  font-size:13px;color:var(--text-faint);
  animation:fadeUp 1s var(--ease) .55s both;
}
.hero-meta span{display:inline-flex;align-items:center;gap:6px}
.hero-meta svg{width:14px;height:14px;color:#10b981}

@keyframes fadeUp{
  from{opacity:0;transform:translateY(20px)}
  to{opacity:1;transform:translateY(0)}
}

/* ============ HERO DASHBOARD MOCKUP ============ */
.hero-mockup-wrap{
  position:relative;
  margin-top:80px;
  perspective:2000px;
  animation:fadeUp 1.2s var(--ease) .7s both;
}
.hero-mockup-wrap::before{
  content:'';position:absolute;
  left:50%;top:50%;transform:translate(-50%,-50%);
  width:90%;height:80%;
  background:radial-gradient(ellipse,rgba(168,85,247,0.25) 0%,rgba(20,184,166,0.15) 40%,transparent 70%);
  filter:blur(60px);
  z-index:-1;
}
.hero-mockup{
  max-width:1180px;margin:0 auto;
  background:linear-gradient(180deg,rgba(20,20,30,0.9) 0%,rgba(10,10,18,0.9) 100%);
  border:1px solid var(--border-strong);
  border-radius:18px;
  padding:0;
  box-shadow:
    0 40px 80px -20px rgba(0,0,0,0.6),
    0 0 0 1px rgba(255,255,255,0.04),
    inset 0 1px 0 rgba(255,255,255,0.06);
  overflow:hidden;
  transform:rotateX(2deg);
  transform-style:preserve-3d;
}
.mockup-titlebar{
  display:flex;align-items:center;gap:8px;
  padding:12px 16px;
  border-bottom:1px solid var(--border);
  background:rgba(0,0,0,0.3);
}
.dot-r{width:11px;height:11px;border-radius:50%}
.dot-r.r{background:#ff5f57}
.dot-r.y{background:#febc2e}
.dot-r.g{background:#28c840}
.titlebar-url{
  margin-left:18px;flex:1;max-width:380px;
  background:rgba(255,255,255,0.04);
  border:1px solid var(--border);
  border-radius:7px;
  padding:5px 12px;
  font-size:12px;color:var(--text-dim);
  font-family:'JetBrains Mono',monospace;
  display:flex;align-items:center;gap:8px;
}
.titlebar-url::before{content:'🔒';font-size:10px}
.titlebar-actions{display:flex;gap:6px;margin-left:auto}
.titlebar-actions span{width:24px;height:20px;border-radius:5px;background:rgba(255,255,255,0.04);border:1px solid var(--border)}

.dash{display:grid;grid-template-columns:200px 1fr;min-height:540px}
.dash-side{
  border-right:1px solid var(--border);
  padding:18px 12px;
  background:rgba(0,0,0,0.2);
}
.dash-side-logo{
  display:flex;align-items:center;gap:8px;
  padding:6px 8px;margin-bottom:18px;
  font-weight:700;font-size:13px;
}
.dash-side-logo .lm{width:20px;height:20px;border-radius:6px;background:var(--tri-grad);background-size:200% 200%;animation:gradFlow 6s ease infinite}
.dash-side-section{
  font-size:10px;text-transform:uppercase;letter-spacing:.1em;
  color:var(--text-faint);padding:0 8px;margin:14px 0 6px;font-weight:600;
}
.dash-nav-item{
  display:flex;align-items:center;gap:10px;
  padding:7px 10px;border-radius:7px;
  font-size:13px;color:var(--text-dim);
  margin-bottom:2px;
}
.dash-nav-item .ico{width:14px;height:14px;flex-shrink:0;opacity:.7}
.dash-nav-item.active{background:rgba(168,85,247,0.12);color:#fff;border:1px solid rgba(168,85,247,0.25)}
.dash-nav-item.active .ico{opacity:1;color:#a855f7}
.dash-nav-badge{margin-left:auto;font-size:10px;background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:4px}

.dash-main{padding:20px 24px;display:flex;flex-direction:column;gap:16px}
.dash-topbar{display:flex;align-items:center;gap:12px;justify-content:space-between}
.dash-topbar h3{font-size:18px;font-weight:700}
.dash-topbar .pill{
  display:inline-flex;gap:6px;align-items:center;
  padding:4px 10px;border-radius:999px;
  background:rgba(16,185,129,0.12);color:#10b981;
  font-size:11px;font-weight:600;
  border:1px solid rgba(16,185,129,0.25);
}
.dash-topbar-right{display:flex;gap:8px;align-items:center}
.dash-topbar-right .ico-btn{
  width:30px;height:30px;border-radius:8px;
  border:1px solid var(--border);
  background:rgba(255,255,255,0.03);
  display:grid;place-items:center;
  font-size:13px;
}
.dash-avatar{
  width:30px;height:30px;border-radius:50%;
  background:var(--p3-grad);
  display:grid;place-items:center;
  font-size:11px;font-weight:700;
}

.dash-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.stat-card{
  padding:14px 16px;border-radius:12px;
  background:rgba(255,255,255,0.03);
  border:1px solid var(--border);
  position:relative;overflow:hidden;
}
.stat-card .label{font-size:11px;color:var(--text-faint);text-transform:uppercase;letter-spacing:.08em;font-weight:600}
.stat-card .val{font-size:24px;font-weight:700;font-family:'Plus Jakarta Sans';margin-top:6px;color:#fff}
.stat-card .trend{font-size:11px;margin-top:4px;color:#10b981;display:inline-flex;align-items:center;gap:3px}
.stat-card.s1::after{content:'';position:absolute;right:-20px;top:-20px;width:80px;height:80px;background:radial-gradient(circle,rgba(249,115,22,0.2),transparent 70%)}
.stat-card.s2::after{content:'';position:absolute;right:-20px;top:-20px;width:80px;height:80px;background:radial-gradient(circle,rgba(20,184,166,0.2),transparent 70%)}
.stat-card.s3::after{content:'';position:absolute;right:-20px;top:-20px;width:80px;height:80px;background:radial-gradient(circle,rgba(168,85,247,0.2),transparent 70%)}

.dash-row{display:grid;grid-template-columns:2fr 1fr;gap:12px;flex:1;min-height:0}
.dash-chart{
  padding:18px;border-radius:12px;
  background:rgba(255,255,255,0.03);
  border:1px solid var(--border);
  display:flex;flex-direction:column;
  min-height:200px;
}
.dash-chart-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;gap:12px}
.dash-chart-head .t{font-size:13px;font-weight:600;display:block;line-height:1.2}
.dash-chart-total{
  display:block;margin-top:4px;
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:18px;font-weight:800;letter-spacing:-0.02em;
  background:linear-gradient(135deg,#f59e0b,#10b981);
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
.dash-chart-head .leg{display:flex;gap:10px;font-size:11px;color:var(--text-dim);flex-wrap:wrap;justify-content:flex-end}
.dash-chart-head .leg span{display:inline-flex;align-items:center;gap:5px}
.dash-chart-head .leg i{width:8px;height:8px;border-radius:2px;display:inline-block}
.dash-chart-svg{flex:1;width:100%;height:auto;min-height:160px;display:block}

.dash-list{
  padding:14px;border-radius:12px;
  background:rgba(255,255,255,0.03);
  border:1px solid var(--border);
  display:flex;flex-direction:column;gap:10px;
}
.dash-list-head{font-size:12px;font-weight:600;color:var(--text-dim);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
.dash-list-item{display:flex;align-items:center;gap:10px;padding:6px 0}
.dash-list-item .ava{
  width:28px;height:28px;border-radius:50%;
  display:grid;place-items:center;font-size:11px;font-weight:700;
  flex-shrink:0;
}
.dash-list-item .info{flex:1;min-width:0}
.dash-list-item .name{font-size:12px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dash-list-item .meta{font-size:10px;color:var(--text-faint)}
.dash-list-item .amt{font-size:11px;font-weight:600;color:#10b981;font-family:'JetBrains Mono'}

@media (max-width:768px){
  .hero{padding:110px 0 60px}
  .dash{grid-template-columns:1fr}
  .dash-side{display:none}
  .dash-stats{grid-template-columns:1fr}
  .dash-row{grid-template-columns:1fr}
}

/* Floating tags around hero mockup */
.float-tag{
  position:absolute;
  padding:8px 12px;
  background:rgba(15,15,22,0.85);
  backdrop-filter:blur(20px);
  border:1px solid var(--border-strong);
  border-radius:10px;
  font-size:12px;font-weight:500;
  display:flex;align-items:center;gap:8px;
  box-shadow:0 8px 32px rgba(0,0,0,0.5);
  animation:floaty 6s ease-in-out infinite;
}
.float-tag .tag-ico{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;font-size:13px}
.float-tag.t1{top:15%;left:-5%;animation-delay:0s}
.float-tag.t1 .tag-ico{background:rgba(249,115,22,0.15);color:#f97316}
.float-tag.t2{top:55%;right:-5%;animation-delay:-2s}
.float-tag.t2 .tag-ico{background:rgba(20,184,166,0.15);color:#14b8a6}
.float-tag.t3{bottom:10%;left:5%;animation-delay:-4s}
.float-tag.t3 .tag-ico{background:rgba(168,85,247,0.15);color:#a855f7}
@keyframes floaty{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-12px)}
}
@media (max-width:1100px){.float-tag{display:none}}

/* ========== PRODUCT FAMILY ========== */
.section{padding:120px 0;position:relative}
/* ========== PRODUCT DETAIL SECTIONS ========== */
.product-detail{padding:120px 0;position:relative;overflow:hidden}
.product-detail::before{
  content:'';position:absolute;inset:0;z-index:-1;
  opacity:.4;
}
.pd1::before{background:radial-gradient(ellipse at 80% 20%,rgba(249,115,22,0.12),transparent 50%)}
.pd2::before{background:radial-gradient(ellipse at 20% 30%,rgba(20,184,166,0.12),transparent 50%)}
.pd3::before{background:radial-gradient(ellipse at 80% 30%,rgba(168,85,247,0.12),transparent 50%)}
.pd-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:80px;align-items:center}
.pd2 .pd-grid{grid-template-columns:1.2fr 1fr}
.pd2 .pd-content{order:2}
.pd2 .pd-mock{order:1}

.pd-eyebrow{
  display:inline-flex;gap:8px;align-items:center;
  padding:6px 14px;border-radius:999px;
  font-size:13px;font-weight:600;
}
.pd1 .pd-eyebrow{background:rgba(249,115,22,0.1);color:#fb923c;border:1px solid rgba(249,115,22,0.25)}
.pd2 .pd-eyebrow{background:rgba(20,184,166,0.1);color:#2dd4bf;border:1px solid rgba(20,184,166,0.25)}
.pd3 .pd-eyebrow{background:rgba(168,85,247,0.1);color:#c084fc;border:1px solid rgba(168,85,247,0.25)}
.pd-title{font-size:clamp(34px,4.5vw,52px);line-height:1.05;letter-spacing:-0.03em;margin-top:20px}
.pd-tagline{font-size:18px;color:#d4d4dc;margin-top:18px;line-height:1.55;font-weight:500}
.pd-desc{font-size:15px;color:var(--text-dim);margin-top:14px;line-height:1.65}
.pd-features{
  margin-top:36px;
  display:grid;grid-template-columns:repeat(2,1fr);gap:16px;
}
.pd-feature{
  padding:18px;border-radius:14px;
  background:rgba(255,255,255,0.025);
  border:1px solid var(--border);
  transition:all .25s var(--ease);
}
.pd-feature:hover{background:rgba(255,255,255,0.04);transform:translateY(-2px)}
.pd1 .pd-feature:hover{border-color:rgba(249,115,22,0.3)}
.pd2 .pd-feature:hover{border-color:rgba(20,184,166,0.3)}
.pd3 .pd-feature:hover{border-color:rgba(168,85,247,0.3)}
.pd-feature-icon{
  width:36px;height:36px;border-radius:10px;
  display:grid;place-items:center;font-size:18px;
  margin-bottom:10px;
}
.pd1 .pd-feature-icon{background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.2)}
.pd2 .pd-feature-icon{background:rgba(20,184,166,0.12);border:1px solid rgba(20,184,166,0.2)}
.pd3 .pd-feature-icon{background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.2)}
.pd-feature h4{font-size:15px;font-weight:700;margin-bottom:6px;color:#fff}
.pd-feature p{font-size:13px;color:var(--text-dim);line-height:1.5}

.pd-cta{margin-top:32px;display:flex;gap:12px;flex-wrap:wrap}

@media (max-width:900px){
  .pd-grid{grid-template-columns:1fr;gap:50px}
  .pd2 .pd-content{order:1}
  .pd2 .pd-mock{order:2}
  .pd-features{grid-template-columns:1fr}
}

/* ============ PRODUCT MOCKUPS ============ */
.pd-mock-frame{
  position:relative;
  border-radius:18px;
  background:linear-gradient(180deg,rgba(20,20,30,0.95) 0%,rgba(8,8,14,0.95) 100%);
  border:1px solid var(--border-strong);
  overflow:hidden;
  box-shadow:0 30px 60px -20px rgba(0,0,0,0.5);
}
.pd-mock-frame::before{
  content:'';position:absolute;left:0;right:0;top:0;height:3px;
  z-index:2;
}
.pd1 .pd-mock-frame::before{background:var(--p1-grad)}
.pd2 .pd-mock-frame::before{background:var(--p2-grad)}
.pd3 .pd-mock-frame::before{background:var(--p3-grad)}
.pd-mock-frame .mockup-titlebar{padding:10px 14px}
.pd-mock-glow{
  position:absolute;inset:-40px;z-index:-1;
  filter:blur(60px);opacity:.4;
}
.pd1 .pd-mock-glow{background:radial-gradient(ellipse,rgba(249,115,22,0.35),transparent 60%)}
.pd2 .pd-mock-glow{background:radial-gradient(ellipse,rgba(20,184,166,0.35),transparent 60%)}
.pd3 .pd-mock-glow{background:radial-gradient(ellipse,rgba(168,85,247,0.35),transparent 60%)}

/* === Servis Takip mockup === */
.mock-srv{padding:18px;display:flex;flex-direction:column;gap:14px;min-height:480px}
.mock-srv-head{display:flex;justify-content:space-between;align-items:center}
.mock-srv-head h4{font-size:15px;font-weight:700}
.mock-srv-head .badge{font-size:10px;padding:3px 8px;border-radius:6px;background:rgba(20,184,166,0.12);color:#2dd4bf;border:1px solid rgba(20,184,166,0.25);font-weight:600}
.mock-srv-kanban{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;flex:1}
.kan-col{
  padding:10px;border-radius:10px;
  background:rgba(255,255,255,0.02);
  border:1px solid var(--border);
  display:flex;flex-direction:column;gap:8px;
}
.kan-head{
  display:flex;justify-content:space-between;align-items:center;
  font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;
  padding-bottom:6px;border-bottom:1px solid var(--border);
}
.kan-head .ct{
  font-size:10px;padding:1px 6px;border-radius:4px;
  background:rgba(255,255,255,0.06);color:var(--text-dim);font-weight:700;
}
.kan-col.c1 .kan-head{color:#fb923c}
.kan-col.c2 .kan-head{color:#2dd4bf}
.kan-col.c3 .kan-head{color:#10b981}
.kan-card{
  padding:10px;border-radius:8px;
  background:rgba(255,255,255,0.03);
  border:1px solid var(--border);
  font-size:11px;
}
.kan-card .id{font-family:'JetBrains Mono';font-size:9px;color:var(--text-faint)}
.kan-card .ttl{font-weight:600;color:#fff;margin-top:3px;line-height:1.3}
.kan-card .meta{display:flex;justify-content:space-between;align-items:center;margin-top:8px;font-size:9px;color:var(--text-dim)}
.kan-card .priority{
  width:6px;height:6px;border-radius:50%;display:inline-block;margin-right:4px;
}
.kan-card .priority.h{background:#ef4444;box-shadow:0 0 6px #ef4444}
.kan-card .priority.m{background:#f59e0b}
.kan-card .priority.l{background:#10b981}

.mock-srv-foot{
  padding:12px;border-radius:10px;
  background:linear-gradient(135deg,rgba(20,184,166,0.08),rgba(6,182,212,0.08));
  border:1px solid rgba(20,184,166,0.2);
  display:flex;align-items:center;gap:12px;
}
.qr-mini{
  width:48px;height:48px;border-radius:8px;
  background:#fff;
  display:grid;grid-template-columns:repeat(8,1fr);
  padding:5px;flex-shrink:0;
}
.qr-mini i{background:#000;border-radius:1px}
.qr-mini i.w{background:transparent}
.mock-srv-foot .info{flex:1}
.mock-srv-foot .info .t{font-size:12px;font-weight:600;color:#fff}
.mock-srv-foot .info .s{font-size:10px;color:var(--text-dim);margin-top:2px}

/* ========== GENEL OZELLIK KARTLARI ========== */
.common{padding:120px 0;border-top:1px solid var(--border);position:relative}
.common-grid{
  display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:60px;
}
.common-card{
  position:relative;
  padding:28px;
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  background:linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.005));
  transition:all .35s var(--ease);
  overflow:hidden;
}
.common-card:hover{border-color:rgba(255,255,255,0.18);transform:translateY(-4px);background:linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))}
.common-card .ico{
  width:46px;height:46px;border-radius:12px;
  display:grid;place-items:center;font-size:22px;
  margin-bottom:18px;
  background:rgba(255,255,255,0.04);
  border:1px solid var(--border);
}
.common-card:nth-child(1) .ico{background:linear-gradient(135deg,rgba(249,115,22,0.12),rgba(168,85,247,0.12));border-color:rgba(249,115,22,0.25)}
.common-card:nth-child(2) .ico{background:linear-gradient(135deg,rgba(168,85,247,0.12),rgba(20,184,166,0.12));border-color:rgba(168,85,247,0.25)}
.common-card:nth-child(3) .ico{background:linear-gradient(135deg,rgba(20,184,166,0.12),rgba(6,182,212,0.12));border-color:rgba(20,184,166,0.25)}
.common-card:nth-child(4) .ico{background:linear-gradient(135deg,rgba(16,185,129,0.12),rgba(245,158,11,0.12));border-color:rgba(16,185,129,0.25)}
.common-card:nth-child(5) .ico{background:linear-gradient(135deg,rgba(217,70,239,0.12),rgba(6,182,212,0.12));border-color:rgba(217,70,239,0.25)}
.common-card:nth-child(6) .ico{background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(239,68,68,0.12));border-color:rgba(245,158,11,0.25)}
.common-card h4{font-size:17px;font-weight:700;margin-bottom:8px}
.common-card p{font-size:14px;color:var(--text-dim);line-height:1.6}

@media (max-width:900px){.common-grid{grid-template-columns:1fr}}

/* ========== HOW IT WORKS ========== */
.how{padding:120px 0;position:relative;border-top:1px solid var(--border)}
.how-grid{
  display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:60px;position:relative;
}
.how-grid::before{
  content:'';position:absolute;top:50px;left:10%;right:10%;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent);
  z-index:0;
}
.how-step{
  text-align:center;padding:0 20px;position:relative;z-index:1;
}
.how-num{
  width:80px;height:80px;border-radius:50%;
  margin:0 auto 24px;
  display:grid;place-items:center;
  font-family:'Plus Jakarta Sans';font-weight:800;font-size:28px;
  background:linear-gradient(180deg,#0a0a12,#050508);
  border:1px solid var(--border-strong);
  position:relative;
}
.how-num::before{
  content:'';position:absolute;inset:-1px;border-radius:50%;
  background:var(--tri-grad);
  background-size:200% 200%;
  animation:gradFlow 6s ease infinite;
  z-index:-1;
}
.how-step:nth-child(1) .how-num{color:#fb923c}
.how-step:nth-child(2) .how-num{color:#2dd4bf}
.how-step:nth-child(3) .how-num{color:#c084fc}
.how-step h4{font-size:20px;font-weight:700;margin-bottom:10px}
.how-step p{font-size:14px;color:var(--text-dim);line-height:1.6;max-width:280px;margin:0 auto}
@media (max-width:900px){
  .how-grid{grid-template-columns:1fr}
  .how-grid::before{display:none}
}

/* ========== PRICING ========== */
.pricing{padding:120px 0;position:relative;border-top:1px solid var(--border)}
.pricing::before{
  content:'';position:absolute;left:50%;top:80px;transform:translateX(-50%);
  width:600px;height:300px;
  background:radial-gradient(ellipse,rgba(168,85,247,0.12),transparent 70%);
  filter:blur(60px);z-index:-1;
}
.toggle{
  display:inline-flex;
  padding:4px;
  border:1px solid var(--border);
  border-radius:999px;
  background:rgba(255,255,255,0.03);
  margin-top:30px;
  position:relative;
}
.toggle button{
  padding:9px 22px;
  border-radius:999px;
  font-size:13px;font-weight:600;color:var(--text-dim);
  position:relative;z-index:2;
  transition:color .25s var(--ease);
}
.toggle button.active{color:#08080c}
.toggle .indicator{
  position:absolute;top:4px;left:4px;
  height:calc(100% - 8px);
  background:#fff;
  border-radius:999px;
  transition:all .35s var(--ease);
  z-index:1;
}
.toggle .save-badge{
  position:absolute;
  top:-12px;right:-58px;
  font-size:10px;font-weight:700;
  background:var(--p2-grad);color:#fff;
  padding:3px 8px;border-radius:6px;
  white-space:nowrap;
}
.toggle .save-badge::after{
  content:'';position:absolute;left:-6px;top:50%;
  border:5px solid transparent;border-right-color:#10b981;
  transform:translateY(-50%);
}

.pricing-grid{
  display:grid;grid-template-columns:repeat(3,1fr);gap:20px;
  margin-top:60px;align-items:start;
}
.price-card{
  position:relative;
  padding:32px;
  border:1px solid var(--border);
  border-radius:var(--radius-lg);
  background:linear-gradient(180deg,rgba(255,255,255,0.025),rgba(255,255,255,0.005));
  transition:all .3s var(--ease);
}
.price-card:hover{border-color:rgba(255,255,255,0.2);transform:translateY(-4px)}
.price-card.featured{
  border-color:rgba(168,85,247,0.4);
  background:linear-gradient(180deg,rgba(168,85,247,0.08) 0%,rgba(255,255,255,0.02) 100%);
  transform:scale(1.04);
  box-shadow:0 30px 60px -20px rgba(168,85,247,0.4),inset 0 1px 0 rgba(255,255,255,0.06);
}
.price-card.featured:hover{transform:scale(1.04) translateY(-4px)}
.price-badge{
  position:absolute;top:-13px;left:50%;transform:translateX(-50%);
  padding:5px 14px;border-radius:999px;
  font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;
  background:var(--tri-grad);
  background-size:200% 200%;
  animation:gradFlow 4s ease infinite;
  color:#fff;
  box-shadow:0 8px 24px rgba(168,85,247,0.4);
}
.price-name{
  font-size:13px;font-weight:600;
  text-transform:uppercase;letter-spacing:.08em;
  color:var(--text-dim);
  display:flex;align-items:center;gap:8px;
}
.price-amount{
  display:flex;align-items:baseline;gap:6px;
  margin-top:18px;
}
.price-amount .cur{font-size:22px;font-weight:600;color:var(--text-dim)}
.price-amount .num{
  font-family:'Plus Jakarta Sans';font-weight:800;
  font-size:48px;letter-spacing:-0.03em;line-height:1;
  color:#fff;
}
.price-amount .per{font-size:14px;color:var(--text-faint)}
.price-yearly{
  font-size:12px;color:var(--text-faint);
  margin-top:6px;
}
.price-features{
  margin:24px 0;display:flex;flex-direction:column;gap:12px;
  padding-top:24px;border-top:1px solid var(--border);
}
.price-features li{
  font-size:14px;color:var(--text-dim);
  display:flex;gap:10px;align-items:flex-start;line-height:1.45;
}
.price-features li svg{width:16px;height:16px;flex-shrink:0;margin-top:2px}
.price-features li.has svg{color:#10b981}
.price-features li.no{color:var(--text-faint);text-decoration:line-through;text-decoration-color:rgba(255,255,255,0.1)}
.price-features li.no svg{color:var(--text-faint)}
.price-cta{width:100%;justify-content:center}

@media (max-width:900px){
  .pricing-grid{grid-template-columns:1fr}
  .price-card.featured{transform:none}
  .price-card.featured:hover{transform:translateY(-4px)}
}

/* ========== FAQ ========== */
.faq{padding:120px 0;border-top:1px solid var(--border)}
.faq-wrap{max-width:780px;margin:60px auto 0}
.faq-item{
  border-bottom:1px solid var(--border);
  padding:0;
}
.faq-q{
  width:100%;
  padding:24px 0;
  display:flex;justify-content:space-between;align-items:center;gap:20px;
  text-align:left;
  font-size:17px;font-weight:600;color:#fff;
  font-family:'Plus Jakarta Sans';
  transition:color .25s var(--ease);
}
.faq-q:hover{color:#c4b5fd}
.faq-q .plus{
  width:24px;height:24px;border-radius:50%;
  border:1px solid var(--border-strong);
  display:grid;place-items:center;
  flex-shrink:0;
  position:relative;
  transition:all .35s var(--ease);
}
.faq-q .plus::before,.faq-q .plus::after{
  content:'';position:absolute;background:#fff;border-radius:1px;
  transition:transform .35s var(--ease);
}
.faq-q .plus::before{width:10px;height:1.5px}
.faq-q .plus::after{width:1.5px;height:10px}
.faq-item.open .faq-q .plus{background:var(--tri-grad);border-color:transparent;transform:rotate(180deg)}
.faq-item.open .faq-q .plus::after{transform:scaleY(0)}
.faq-a{
  max-height:0;overflow:hidden;
  transition:max-height .4s var(--ease),padding .4s var(--ease);
}
.faq-a-inner{
  padding:0 0 24px;
  font-size:15px;color:var(--text-dim);
  line-height:1.7;
  max-width:680px;
}
.faq-item.open .faq-a{max-height:300px}

/* ========== FINAL CTA ========== */
.cta{
  padding:120px 0;
  position:relative;overflow:hidden;
  border-top:1px solid var(--border);
}
.cta-inner{
  max-width:900px;margin:0 auto;
  padding:80px 40px;
  border-radius:var(--radius-xl);
  background:
    radial-gradient(ellipse at 20% 30%,rgba(249,115,22,0.18),transparent 50%),
    radial-gradient(ellipse at 80% 70%,rgba(168,85,247,0.18),transparent 50%),
    radial-gradient(ellipse at 50% 50%,rgba(20,184,166,0.12),transparent 60%),
    linear-gradient(180deg,rgba(20,20,30,0.6),rgba(10,10,18,0.6));
  border:1px solid var(--border-strong);
  text-align:center;
  position:relative;
  overflow:hidden;
}
.cta-inner::before{
  content:'';position:absolute;inset:0;
  background-image:
    radial-gradient(rgba(255,255,255,0.04) 1px,transparent 1px);
  background-size:30px 30px;
  mask-image:radial-gradient(ellipse,#000 0%,transparent 70%);
  -webkit-mask-image:radial-gradient(ellipse,#000 0%,transparent 70%);
  pointer-events:none;
}
.cta-inner h2{font-size:clamp(34px,4.5vw,56px);line-height:1.05;letter-spacing:-0.03em;position:relative}
.cta-inner p{font-size:18px;color:var(--text-dim);margin:20px auto 0;max-width:520px;line-height:1.6;position:relative}
.cta-inner .hero-ctas{margin-top:36px;position:relative}
.cta-inner .hero-meta{position:relative}

.btn-pulse{position:relative}
.btn-pulse::before{
  content:'';position:absolute;inset:-4px;
  border-radius:14px;
  background:var(--tri-grad);
  background-size:200% 200%;
  animation:gradFlow 4s ease infinite;
  z-index:-1;
  opacity:.5;filter:blur(12px);
}

/* ========== FOOTER ========== */
.footer{
  padding:80px 0 30px;
  border-top:1px solid var(--border);
  background:#040407;
}
.footer-grid{
  display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:50px;
}
.footer-about p{
  font-size:14px;color:var(--text-dim);
  line-height:1.6;margin:18px 0;max-width:340px;
}
.footer-social{display:flex;gap:8px}
.footer-social a{
  width:36px;height:36px;border-radius:10px;
  border:1px solid var(--border);
  background:rgba(255,255,255,0.02);
  display:grid;place-items:center;
  color:var(--text-dim);
  transition:all .2s var(--ease);
}
.footer-social a:hover{color:#fff;border-color:rgba(255,255,255,0.2);background:rgba(255,255,255,0.05)}
.footer-social svg{width:16px;height:16px}
.footer h5{
  font-size:13px;font-weight:700;color:#fff;
  text-transform:uppercase;letter-spacing:.08em;margin-bottom:18px;
  font-family:'Plus Jakarta Sans';
}
.footer ul{display:flex;flex-direction:column;gap:10px}
.footer ul a{font-size:14px;color:var(--text-dim);transition:color .2s}
.footer ul a:hover{color:#fff}
.footer-bottom{
  margin-top:60px;padding-top:30px;
  border-top:1px solid var(--border);
  display:flex;justify-content:space-between;align-items:center;
  font-size:13px;color:var(--text-faint);
  flex-wrap:wrap;gap:14px;
}
@media (max-width:900px){
  .footer-grid{grid-template-columns:1fr 1fr;gap:30px}
  .footer-about{grid-column:1/-1}
}

/* ========== WHATSAPP FLOAT ========== */
.wa-float{
  position:fixed;bottom:24px;right:24px;z-index:90;
  width:56px;height:56px;border-radius:50%;
  background:#25d366;
  display:grid;place-items:center;
  color:#fff;
  box-shadow:0 8px 30px rgba(37,211,102,0.5);
  transition:all .25s var(--ease);
  animation:waPulse 2.5s ease-in-out infinite;
}
.wa-float:hover{transform:scale(1.08);box-shadow:0 12px 40px rgba(37,211,102,0.7)}
.wa-float svg{width:30px;height:30px;fill:#fff}
@keyframes waPulse{
  0%,100%{box-shadow:0 8px 30px rgba(37,211,102,0.5),0 0 0 0 rgba(37,211,102,0.6)}
  70%{box-shadow:0 8px 30px rgba(37,211,102,0.5),0 0 0 18px rgba(37,211,102,0)}
}

/* ========== REVEAL ANIMATION ========== */
.reveal{opacity:0;transform:translateY(30px);transition:opacity .8s var(--ease),transform .8s var(--ease)}
.reveal.in{opacity:1;transform:translateY(0)}

/* ========== MOBILE NAV ========== */
.menu-btn{
  display:none;
  width:38px;height:38px;border-radius:10px;
  border:1px solid var(--border);
  background:rgba(255,255,255,0.03);
  flex-direction:column;justify-content:center;align-items:center;gap:4px;
}
.menu-btn span{display:block;width:16px;height:1.5px;background:#fff;border-radius:1px;transition:.3s}
@media (max-width:900px){
  .menu-btn{display:flex}
}
.mobile-menu{
  position:fixed;top:0;left:0;right:0;bottom:0;
  background:rgba(5,5,8,0.96);
  backdrop-filter:blur(20px);
  z-index:99;
  padding:90px 24px 40px;
  display:none;flex-direction:column;gap:8px;
}
.mobile-menu.open{display:flex}
.mobile-menu a{
  padding:14px 18px;border-radius:12px;
  font-size:17px;font-weight:600;
  border:1px solid var(--border);
  background:rgba(255,255,255,0.02);
}

/* ========== SECTION DIVIDER ========== */
.divider{
  width:100%;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent);
}

/* ========== SUPPLEMENTARY (HOW / TESTI / PRICING / CTA / FOOTER / WA) ========== */

/* HOW IT WORKS */
.how-grid{
  display:grid;grid-template-columns:repeat(3,1fr);gap:28px;
  margin-top:60px;position:relative;
}
.how-grid::before{
  content:"";position:absolute;top:60px;left:12%;right:12%;height:1px;
  background:linear-gradient(90deg,transparent 0%,#f59e0b33 20%,#14b8a633 50%,#a855f733 80%,transparent 100%);
  z-index:0;
}
.how-card{
  position:relative;z-index:1;
  background:linear-gradient(180deg,rgba(20,20,28,0.6),rgba(12,12,18,0.4));
  border:1px solid var(--border);border-radius:20px;
  padding:36px 28px;text-align:center;
  backdrop-filter:blur(10px);
  transition:transform .3s ease, border-color .3s ease;
}
.how-card:hover{transform:translateY(-4px);border-color:rgba(255,255,255,0.18)}
.how-num{
  display:inline-block;font-family:'JetBrains Mono',monospace;
  font-size:14px;font-weight:600;letter-spacing:0.1em;
  background:var(--tri-grad);-webkit-background-clip:text;background-clip:text;color:transparent;
  margin-bottom:12px;
}
.how-card:nth-child(1) .how-num{background:var(--p1-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.how-card:nth-child(2) .how-num{background:var(--p2-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.how-card:nth-child(3) .how-num{background:var(--p3-grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.how-icon{
  width:64px;height:64px;border-radius:18px;
  display:flex;align-items:center;justify-content:center;
  margin:6px auto 22px;font-size:30px;
  background:rgba(255,255,255,0.04);border:1px solid var(--border);
}
.how-card:nth-child(1) .how-icon{background:linear-gradient(135deg,rgba(245,158,11,0.18),rgba(239,68,68,0.10));border-color:rgba(245,158,11,0.25)}
.how-card:nth-child(2) .how-icon{background:linear-gradient(135deg,rgba(16,185,129,0.18),rgba(6,182,212,0.10));border-color:rgba(16,185,129,0.25)}
.how-card:nth-child(3) .how-icon{background:linear-gradient(135deg,rgba(139,92,246,0.18),rgba(217,70,239,0.10));border-color:rgba(139,92,246,0.25)}
.how-card h4{font-size:22px;font-weight:700;letter-spacing:-0.01em;margin-bottom:12px}
.how-card p{font-size:15px;color:var(--text-dim);line-height:1.6;margin-bottom:20px}
.how-meta{
  display:inline-block;padding:6px 14px;border-radius:999px;
  background:rgba(255,255,255,0.04);border:1px solid var(--border);
  font-size:12px;color:var(--text-dim);font-weight:500;
}
@media (max-width:900px){
  .how-grid{grid-template-columns:1fr;gap:20px}
  .how-grid::before{display:none}
}

/* PRICING */
.toggle-wrap{display:flex;justify-content:center;margin-top:32px}
.toggle{
  position:relative;display:inline-flex;align-items:center;gap:0;
  padding:5px;border-radius:999px;
  background:rgba(255,255,255,0.04);border:1px solid var(--border);
}
.toggle .indicator{
  position:absolute;top:5px;left:0;height:calc(100% - 10px);
  background:#fff;border-radius:999px;
  transition:transform .35s cubic-bezier(.4,0,.2,1), width .35s cubic-bezier(.4,0,.2,1);
  z-index:0;box-shadow:0 4px 12px rgba(255,255,255,0.15);
}
.toggle-btn{
  position:relative;z-index:1;
  background:transparent;border:none;cursor:pointer;
  padding:10px 22px;border-radius:999px;
  font-size:14px;font-weight:600;color:var(--text-dim);
  font-family:inherit;transition:color .3s ease;
  display:inline-flex;align-items:center;gap:8px;
}
.toggle-btn.active{color:#08080c}
.toggle .save-badge{
  display:inline-block;padding:2px 8px;border-radius:999px;
  background:linear-gradient(135deg,#10b981,#14b8a6);color:#fff;
  font-size:11px;font-weight:700;letter-spacing:0.02em;
}
.toggle-btn.active .save-badge{color:#fff}

.pricing-grid{
  display:grid;grid-template-columns:repeat(3,1fr);gap:24px;
  margin-top:60px;align-items:stretch;
}
.price-card{
  position:relative;
  background:linear-gradient(180deg,rgba(20,20,28,0.7),rgba(12,12,18,0.5));
  border:1px solid var(--border);border-radius:24px;
  padding:36px 28px;display:flex;flex-direction:column;
  backdrop-filter:blur(12px);
  transition:transform .35s ease, border-color .35s ease, box-shadow .35s ease;
}
.price-card:hover{
  transform:translateY(-6px);border-color:rgba(255,255,255,0.18);
  box-shadow:0 24px 60px rgba(0,0,0,0.4);
}
.price-card.featured{
  border-color:rgba(168,85,247,0.4);
  background:
    linear-gradient(180deg,rgba(20,15,35,0.85),rgba(15,10,25,0.6)),
    radial-gradient(ellipse at top,rgba(168,85,247,0.18),transparent 70%);
  transform:scale(1.04);
  box-shadow:0 24px 64px rgba(168,85,247,0.18);
}
.price-card.featured:hover{transform:scale(1.04) translateY(-6px)}
.price-badge{
  position:absolute;top:-14px;left:50%;transform:translateX(-50%);
  padding:6px 14px;border-radius:999px;
  background:var(--tri-grad);color:#fff;
  font-size:12px;font-weight:700;letter-spacing:0.02em;
  box-shadow:0 8px 24px rgba(168,85,247,0.4);
  white-space:nowrap;
}
.price-icon{font-size:32px;margin-bottom:14px}
.price-name{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:22px;font-weight:700;letter-spacing:-0.01em;color:#fff;
}
.price-tag{font-size:13px;color:var(--text-faint);margin-top:4px}
.price-amount{
  display:flex;align-items:baseline;gap:4px;
  margin:24px 0 6px;
}
.price-amount .currency{font-size:22px;font-weight:600;color:var(--text-dim)}
.price-amount .num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:54px;font-weight:800;letter-spacing:-0.04em;
  line-height:1;color:#fff;
}
.price-amount .period{font-size:14px;color:var(--text-faint);margin-left:4px}
.price-note{font-size:12px;color:var(--text-faint);margin-bottom:22px}
.btn-block{display:flex;width:100%;justify-content:center}
.price-features{
  list-style:none;padding:0;margin-top:28px;
  display:flex;flex-direction:column;gap:12px;
  border-top:1px solid var(--border);padding-top:24px;
}
.price-features li{
  display:flex;align-items:flex-start;gap:10px;
  font-size:14px;color:var(--text);line-height:1.5;
  padding-left:24px;position:relative;
}
.price-features li::before{
  content:"";position:absolute;left:0;top:6px;
  width:14px;height:14px;border-radius:50%;
  display:inline-block;
}
.price-features li.has::before{
  background:rgba(16,185,129,0.15);
  border:1px solid rgba(16,185,129,0.4);
}
.price-features li.has::after{
  content:"";position:absolute;left:4px;top:9px;
  width:6px;height:3px;border-left:1.5px solid #34d399;border-bottom:1.5px solid #34d399;
  transform:rotate(-45deg);
}
.price-features li.no{color:var(--text-faint)}
.price-features li.no::before{
  background:rgba(255,255,255,0.04);
  border:1px solid rgba(255,255,255,0.08);
}
.price-features li.no::after{
  content:"";position:absolute;left:5px;top:12px;
  width:4px;height:1.5px;background:rgba(255,255,255,0.25);
}
.pricing-foot{
  text-align:center;margin-top:48px;
  font-size:14px;color:var(--text-dim);
}
.check-mini{
  display:inline-block;width:18px;height:18px;border-radius:50%;
  background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.4);
  color:#34d399;font-size:11px;font-weight:700;
  line-height:16px;text-align:center;margin-right:4px;
  vertical-align:middle;
}
@media (max-width:1000px){
  .pricing-grid{grid-template-columns:1fr;max-width:480px;margin-left:auto;margin-right:auto;gap:20px}
  .price-card.featured{transform:none}
  .price-card.featured:hover{transform:translateY(-6px)}
}

/* FAQ */
.faq-item{
  border-bottom:1px solid var(--border);
  padding:0;
}
.faq-item:first-child{border-top:1px solid var(--border)}
.faq-q{
  width:100%;background:transparent;border:none;cursor:pointer;
  padding:24px 0;display:flex;align-items:center;justify-content:space-between;gap:24px;
  font-family:inherit;font-size:17px;font-weight:600;color:#fff;
  text-align:left;letter-spacing:-0.01em;
  transition:color .25s ease;
}
.faq-q .plus{
  flex-shrink:0;width:32px;height:32px;border-radius:50%;
  border:1px solid var(--border);
  display:flex;align-items:center;justify-content:center;
  font-size:18px;color:var(--text-dim);font-weight:400;
  transition:all .3s ease;
}
.faq-item.open .faq-q .plus{
  background:var(--tri-grad);color:#fff;border-color:transparent;
  transform:rotate(45deg);
}
.faq-a{
  max-height:0;overflow:hidden;
  transition:max-height .4s cubic-bezier(.4,0,.2,1);
}
.faq-item.open .faq-a{max-height:400px}
.faq-a p{
  font-size:15px;color:var(--text-dim);line-height:1.7;
  padding:0 0 24px 0;max-width:90%;
}
.faq-a p strong{color:#fff;font-weight:600}

/* FINAL CTA */
.cta-final{padding:120px 0;position:relative}
.cta-card{
  position:relative;overflow:hidden;
  border-radius:32px;
  border:1px solid rgba(255,255,255,0.1);
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%,rgba(168,85,247,0.18),transparent 60%),
    radial-gradient(ellipse 60% 40% at 0% 100%,rgba(245,158,11,0.12),transparent 60%),
    radial-gradient(ellipse 60% 40% at 100% 100%,rgba(16,185,129,0.12),transparent 60%),
    linear-gradient(180deg,rgba(20,20,32,0.8),rgba(10,10,18,0.6));
  padding:80px 40px;
}
.cta-mesh{
  position:absolute;inset:0;
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px);
  background-size:40px 40px;
  mask-image:radial-gradient(ellipse at center,black 30%,transparent 75%);
  -webkit-mask-image:radial-gradient(ellipse at center,black 30%,transparent 75%);
  pointer-events:none;
}
.cta-inner{
  position:relative;z-index:1;
  text-align:center;max-width:720px;margin:0 auto;
  padding:0;background:none;border:none;border-radius:0;
}
.cta-inner::before{display:none}
.cta-title{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:clamp(36px,5vw,60px);line-height:1.05;letter-spacing:-0.03em;
  margin-top:20px;font-weight:800;
}
.cta-sub{
  font-size:18px;color:var(--text-dim);
  margin:20px auto 0;max-width:520px;line-height:1.6;
}
.cta-actions{
  display:flex;gap:14px;justify-content:center;flex-wrap:wrap;
  margin-top:36px;
}
.btn-lg{padding:18px 32px;font-size:17px;border-radius:14px}
.cta-actions .arr{display:inline-block;transition:transform .3s ease;margin-left:6px}
.cta-actions a:hover .arr{transform:translateX(4px)}
/* İkinci iletişim yolu: WhatsApp istemeyen ziyaretçi için form */
.cta-form-wrap{margin-top:26px;padding-top:22px;border-top:1px solid rgba(255,255,255,.08)}
.cta-form-or{font-size:13px;color:var(--muted);margin-bottom:12px}
.cta-form{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.cta-form input{flex:1 1 170px;min-width:0;max-width:230px;padding:12px 14px;border-radius:12px;
  border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff;font:inherit;font-size:14px}
.cta-form input::placeholder{color:rgba(255,255,255,.42)}
.cta-form input:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-color:transparent}
.cta-form button{flex:0 0 auto;padding:12px 22px;font-size:14px}
/* Bal küpü: ekranda görünmez ama ekran okuyucudan da gizli, odak almaz */
#lfHp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none}
.cta-form-msg{margin-top:12px;font-size:14px;min-height:20px}
.cta-form-msg.ok{color:#5eead4}
.cta-form-msg.err{color:#fca5a5}
@media(max-width:620px){.cta-form input,.cta-form button{max-width:none;flex:1 1 100%}}
.cta-meta{
  display:flex;gap:24px;justify-content:center;flex-wrap:wrap;
  margin-top:32px;font-size:13px;color:var(--text-faint);
}
.cta-meta span{display:inline-flex;align-items:center;gap:6px}

/* FOOTER */
.footer{
  border-top:1px solid var(--border);
  padding:80px 0 40px;
  background:linear-gradient(180deg,#050508 0%,#030305 100%);
}
.footer-grid{
  display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:48px;
  padding-bottom:48px;border-bottom:1px solid var(--border);
}
.footer-about{max-width:340px}
.footer-about .logo{margin-bottom:18px}
.footer-about p{
  font-size:14px;color:var(--text-dim);line-height:1.6;
  margin-bottom:20px;
}
.footer-social{display:flex;gap:8px}
.footer-social a{
  width:36px;height:36px;border-radius:10px;
  display:inline-flex;align-items:center;justify-content:center;
  border:1px solid var(--border);color:var(--text-dim);
  transition:all .25s ease;
}
.footer-social a:hover{
  color:#fff;border-color:rgba(255,255,255,0.2);
  background:rgba(255,255,255,0.04);transform:translateY(-2px);
}
.footer-col{display:flex;flex-direction:column;gap:12px}
.footer-col h5{
  font-size:13px;font-weight:700;color:#fff;
  letter-spacing:0.05em;text-transform:uppercase;
  margin-bottom:8px;
}
.footer-col a{
  font-size:14px;color:var(--text-dim);
  transition:color .25s ease;
}
.footer-col a:hover{color:#fff}
.footer-bottom{
  padding-top:32px;
  display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px;
  font-size:13px;color:var(--text-faint);
}
.footer-meta{font-size:13px}
@media (max-width:900px){
  .footer-grid{grid-template-columns:1fr 1fr;gap:32px}
  .footer-about{grid-column:1/-1;max-width:none}
}
@media (max-width:560px){
  .footer-grid{grid-template-columns:1fr}
}

/* WHATSAPP TOOLTIP */
.wa-float{position:relative}
.wa-tooltip{
  position:absolute;right:calc(100% + 14px);top:50%;transform:translateY(-50%);
  background:#1a1a24;color:#fff;
  padding:8px 14px;border-radius:10px;
  font-size:13px;font-weight:500;white-space:nowrap;
  border:1px solid var(--border);
  opacity:0;pointer-events:none;
  transition:opacity .25s ease, transform .25s ease;
  box-shadow:0 8px 24px rgba(0,0,0,0.4);
}
.wa-tooltip::after{
  content:"";position:absolute;left:100%;top:50%;transform:translateY(-50%);
  border:6px solid transparent;border-left-color:#1a1a24;
}
.wa-float:hover .wa-tooltip{opacity:1;transform:translateY(-50%) translateX(-4px)}
@media (max-width:640px){.wa-tooltip{display:none}}

/* ============================================================
   ENHANCEMENT LAYER — Particles, Animations, Comparison,
   Mobile, Badge pulse, Hero toast, Sparklines, 3D tilt
   ============================================================ */

/* ----- PARTICLE CANVAS (HERO) ----- */
#particles{
  position:absolute;inset:0;width:100%;height:100%;
  pointer-events:none;z-index:0;opacity:.55;
}
.hero-bg{position:absolute;inset:0;overflow:hidden;z-index:0}
.hero-bg .blob,.hero-bg .hero-glow,.hero-grid-bg{z-index:1}
.hero-inner,.hero-mockup-wrap{position:relative;z-index:2}
.hero-grid-bg{
  position:absolute;inset:0;
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),
    linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px);
  background-size:60px 60px;
  mask-image:radial-gradient(ellipse 90% 70% at 50% 30%,black 20%,transparent 80%);
  -webkit-mask-image:radial-gradient(ellipse 90% 70% at 50% 30%,black 20%,transparent 80%);
  pointer-events:none;
}

/* ----- LIVE NOTIFICATION TOAST IN HERO ----- */
.hero-toast{
  position:absolute;
  top:18%;right:-18px;
  display:flex;align-items:center;gap:12px;
  background:linear-gradient(135deg,rgba(20,20,30,0.92),rgba(15,15,22,0.92));
  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,0.12);
  border-radius:14px;padding:12px 16px;
  box-shadow:0 16px 50px rgba(0,0,0,0.5),0 0 0 1px rgba(16,185,129,0.15);
  min-width:240px;z-index:5;
  opacity:0;transform:translateX(40px);
  animation:toastIn .8s cubic-bezier(.34,1.56,.64,1) 1.2s forwards,
            toastFloat 4s ease-in-out 2s infinite;
}
.hero-toast-ico{
  width:34px;height:34px;border-radius:10px;flex-shrink:0;
  background:linear-gradient(135deg,#10b981,#14b8a6);
  display:flex;align-items:center;justify-content:center;color:#fff;
  box-shadow:0 4px 14px rgba(16,185,129,0.4);
}
.hero-toast-body{flex:1;min-width:0}
.hero-toast-title{font-size:13px;font-weight:700;color:#fff;letter-spacing:-0.01em}
.hero-toast-meta{font-size:11px;color:var(--text-faint);margin-top:2px}
.hero-toast-amt{
  font-family:'JetBrains Mono',monospace;
  font-size:13px;font-weight:700;color:#10b981;
  white-space:nowrap;
}
@keyframes toastIn{
  0%{opacity:0;transform:translateX(40px) scale(.92)}
  100%{opacity:1;transform:translateX(0) scale(1)}
}
@keyframes toastFloat{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-6px)}
}
@media (max-width:980px){.hero-toast{display:none}}

/* ----- SPARKLINES IN HERO STAT CARDS ----- */
.stat-card{position:relative;overflow:hidden}
.stat-card .spark{
  position:absolute;bottom:0;right:0;
  width:80px;height:28px;
  opacity:.85;pointer-events:none;
}
.stat-card .spark path{
  stroke-dasharray:200;stroke-dashoffset:200;
  animation:sparkDraw 1.6s ease-out forwards;
}
.stat-card.s1 .spark{animation-delay:.3s}
.stat-card.s2 .spark{animation-delay:.5s}
.stat-card.s3 .spark{animation-delay:.7s}
@keyframes sparkDraw{to{stroke-dashoffset:0}}

/* ----- ENHANCED REVEAL VARIANTS ----- */
.reveal-left{opacity:0;transform:translateX(-50px);transition:opacity .9s var(--ease),transform .9s var(--ease)}
.reveal-left.in{opacity:1;transform:translateX(0)}
.reveal-right{opacity:0;transform:translateX(50px);transition:opacity .9s var(--ease),transform .9s var(--ease)}
.reveal-right.in{opacity:1;transform:translateX(0)}
.reveal-scale{opacity:0;transform:scale(.92);transition:opacity .8s var(--ease),transform .8s var(--ease)}
.reveal-scale.in{opacity:1;transform:scale(1)}
.reveal-blur{opacity:0;filter:blur(14px);transform:translateY(20px);transition:opacity .9s var(--ease),filter .9s var(--ease),transform .9s var(--ease)}
.reveal-blur.in{opacity:1;filter:blur(0);transform:translateY(0)}
.reveal-rotate{opacity:0;transform:translateY(40px) rotate(-3deg);transition:opacity .9s var(--ease),transform .9s var(--ease)}
.reveal-rotate.in{opacity:1;transform:translateY(0) rotate(0)}
.reveal-flip{opacity:0;transform:perspective(800px) rotateX(20deg);transform-origin:center bottom;transition:opacity .9s var(--ease),transform .9s var(--ease)}
.reveal-flip.in{opacity:1;transform:perspective(800px) rotateX(0)}

/* Stagger children */
.reveal-stagger > *{opacity:0;transform:translateY(24px);transition:opacity .7s var(--ease),transform .7s var(--ease)}
.reveal-stagger.in > *{opacity:1;transform:translateY(0)}
.reveal-stagger.in > *:nth-child(1){transition-delay:.05s}
.reveal-stagger.in > *:nth-child(2){transition-delay:.15s}
.reveal-stagger.in > *:nth-child(3){transition-delay:.25s}
.reveal-stagger.in > *:nth-child(4){transition-delay:.35s}
.reveal-stagger.in > *:nth-child(5){transition-delay:.45s}
.reveal-stagger.in > *:nth-child(6){transition-delay:.55s}

/* ----- "EN POPÜLER" BADGE PULSE ----- */
.price-badge{
  animation:badgePulse 2.8s ease-in-out infinite;
  background-size:200% 200%;
  background-image:linear-gradient(135deg,#f59e0b 0%,#14b8a6 50%,#a855f7 100%);
}
@keyframes badgePulse{
  0%,100%{
    box-shadow:0 8px 24px rgba(168,85,247,0.4),0 0 0 0 rgba(168,85,247,0.5);
    background-position:0% 50%;
  }
  50%{
    box-shadow:0 12px 32px rgba(168,85,247,0.6),0 0 0 12px rgba(168,85,247,0);
    background-position:100% 50%;
  }
}
.price-card.featured::before{
  content:"";position:absolute;inset:-1px;border-radius:24px;
  background:linear-gradient(135deg,#f59e0b,#14b8a6,#a855f7,#f59e0b);
  background-size:300% 300%;
  z-index:-1;opacity:0;filter:blur(16px);
  animation:featuredGlow 4s ease-in-out infinite;
}
.price-card.featured{position:relative;z-index:1}
.price-card.featured:hover::before{opacity:.5}
@keyframes featuredGlow{
  0%,100%{background-position:0% 50%;opacity:.25}
  50%{background-position:100% 50%;opacity:.45}
}

/* ----- 3D TILT (HERO MOCKUP) ----- */
.hero-mockup{
  transition:transform .15s ease-out;
  transform-style:preserve-3d;
  will-change:transform;
}
.hero-mockup-wrap{perspective:1500px}

/* ----- FLOATING TAGS ENHANCED ANIMATIONS ----- */
.float-tag.t1{animation:floatTag 4.5s ease-in-out infinite}
.float-tag.t2{animation:floatTag 5.2s ease-in-out infinite .8s}
.float-tag.t3{animation:floatTag 4.8s ease-in-out infinite 1.4s}
@keyframes floatTag{
  0%,100%{transform:translateY(0) rotate(-2deg)}
  50%{transform:translateY(-12px) rotate(1deg)}
}

/* ----- TOGGLE ANIMATION ENHANCEMENT ----- */
.toggle .indicator{
  background:linear-gradient(135deg,#fff,#e2e8f0);
  box-shadow:0 4px 14px rgba(255,255,255,0.18),0 0 0 1px rgba(255,255,255,0.1);
}
.toggle:hover .indicator{box-shadow:0 6px 18px rgba(255,255,255,0.25)}

/* ----- COMMON CARD HOVER UPGRADE ----- */
.common-card{
  transition:transform .4s cubic-bezier(.4,0,.2,1),border-color .35s ease,background .35s ease,box-shadow .4s ease;
  position:relative;overflow:hidden;
}
.common-card::before{
  content:"";position:absolute;top:0;left:-100%;
  width:100%;height:100%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,0.04),transparent);
  transition:left .8s ease;
}
.common-card:hover::before{left:100%}
.common-card:hover{transform:translateY(-6px);box-shadow:0 24px 60px -10px rgba(0,0,0,0.4)}

/* ----- HOW CARD CONNECTOR ARROW ANIMATION ----- */
.how-card{position:relative}
.how-card .how-icon{transition:transform .4s ease}
.how-card:hover .how-icon{transform:rotate(-8deg) scale(1.08)}

/* ----- PRICE CARD NUM ANIMATION ON TOGGLE ----- */
.price-amount .num{
  transition:transform .35s cubic-bezier(.34,1.56,.64,1),color .35s ease;
}
.price-amount.changing .num{transform:scale(1.15);color:#a855f7}

/* ============================================================
   MOBILE OPTIMIZATION LAYER
   ============================================================ */
@media (max-width:900px){
  /* Bigger touch targets */
  .btn{min-height:48px;padding:14px 22px;font-size:15px}
  .btn-sm{min-height:40px}
  .btn-lg{min-height:56px;padding:16px 26px}

  /* Hero */
  .hero{padding-top:90px;padding-bottom:40px}
  .hero-title{font-size:clamp(36px,9vw,52px) !important;line-height:1.05}
  .hero-sub{font-size:16px}
  .hero-ctas{flex-direction:column;width:100%;gap:10px}
  .hero-ctas .btn{width:100%;justify-content:center}
  .hero-meta{flex-direction:column;align-items:flex-start;gap:8px;font-size:13px}
  .hero-mockup-wrap{margin-top:40px}
  .float-tag{font-size:11px;padding:6px 10px}
  .float-tag.t1,.float-tag.t2,.float-tag.t3{display:none}

  /* Hide complex sidebar on mobile mockup */
  .dash-side{display:none}
  .dash{grid-template-columns:1fr !important}
  .dash-stats{grid-template-columns:1fr 1fr !important;gap:10px}
  .stat-card .val{font-size:24px}
  .dash-row{grid-template-columns:1fr !important;gap:12px}
  .dash-list{display:none}
  .titlebar-url{font-size:11px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

  /* Sections common */
  section{padding:64px 0 !important}
  .section-title{font-size:clamp(28px,7vw,40px) !important}
  .section-sub{font-size:15px;padding:0 8px}
  .section-head{margin-bottom:40px}

  /* Product family */

  /* Product detail */
  .pd-grid{grid-template-columns:1fr !important;gap:32px}
  .pd-content,.pd-mock{padding:0 4px}
  .pd-features{grid-template-columns:1fr !important}

  /* Common features grid */
  .common-grid{grid-template-columns:1fr !important;gap:14px}

  /* Stats */

  /* Pricing */
  .price-card{padding:28px 22px}
  .price-amount .num{font-size:42px}

  /* Footer */
  .footer{padding:48px 0 24px}
  .footer-bottom{flex-direction:column;text-align:center;gap:8px}

  /* Final CTA */
  .cta-card{padding:48px 22px;border-radius:22px}

  /* WhatsApp button */
  .wa-float{width:54px;height:54px;bottom:20px;right:20px}
  .wa-float svg{width:24px;height:24px}
}

@media (max-width:560px){
  .container{padding-left:18px;padding-right:18px}
  .hero-badge{font-size:12px;padding:6px 12px}
  .hero-mockup{transform:scale(.95);transform-origin:top center}
  .footer-grid{grid-template-columns:1fr;gap:28px}
  .cta-actions{flex-direction:column;width:100%}
  .cta-actions .btn{width:100%;justify-content:center}
  .cta-meta{flex-direction:column;gap:8px}
}

/* Reduce motion preference */
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{
    animation-duration:0.01ms !important;
    animation-iteration-count:1 !important;
    transition-duration:0.01ms !important;
  }
  #particles{display:none}
}

/* ============================================================
   HERO POLISH v2 — improved badge, trust chip
   ============================================================ */
.hero-badge{
  background:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02));
  border-color:rgba(255,255,255,0.10);
  padding:7px 8px 7px 14px;
  box-shadow:0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 24px rgba(0,0,0,0.25);
}
.hero-badge .pulse{width:6px;height:6px}
.hero-badge .hb-label{
  font-family:'JetBrains Mono',monospace;
  font-size:10px;font-weight:700;letter-spacing:0.12em;
  color:#10b981;
}
.hero-badge .hb-sep{
  width:1px;height:12px;background:rgba(255,255,255,0.12);margin:0 4px;
}

/* ============================================================
   STEP EMBLEM — sophisticated 3-step indicator
   ============================================================ */
.how-card{
  --ec1:#fff;--ec2:#fff;--ec3:#fff;
  padding-top:42px;
}
.how-card:nth-child(1){--ec1:#f59e0b;--ec2:#f97316;--ec3:#ef4444}
.how-card:nth-child(2){--ec1:#10b981;--ec2:#14b8a6;--ec3:#06b6d4}
.how-card:nth-child(3){--ec1:#8b5cf6;--ec2:#a855f7;--ec3:#d946ef}

/* Hide old icon block (legacy CSS no longer used) */
.how-card > .how-icon{display:none}

.step-emblem{
  position:relative;
  width:130px;height:130px;
  margin:0 auto 28px;
  display:flex;align-items:center;justify-content:center;
  isolation:isolate;
}

/* Outer ROTATING conic-gradient ring */
.step-emblem-ring{
  position:absolute;inset:0;
  border-radius:32px;
  background:conic-gradient(from 0deg,
    var(--ec1) 0%,
    var(--ec2) 25%,
    transparent 35%,
    transparent 55%,
    var(--ec3) 75%,
    var(--ec1) 100%);
  animation:emblemSpin 6s linear infinite;
  filter:blur(0.5px);
}
.step-emblem-ring::after{
  /* inner mask — creates the ring effect by hiding the center */
  content:"";position:absolute;inset:1.5px;
  border-radius:30px;
  background:#08080c;
}

/* Soft outer glow halo */
.step-emblem-glow{
  position:absolute;inset:-12px;
  border-radius:40px;
  background:linear-gradient(135deg,var(--ec1),var(--ec2),var(--ec3));
  filter:blur(28px);opacity:.30;
  z-index:-1;
  animation:emblemGlow 3s ease-in-out infinite alternate;
}
@keyframes emblemSpin{to{transform:rotate(360deg)}}
@keyframes emblemGlow{
  from{opacity:.20;transform:scale(.96)}
  to{opacity:.42;transform:scale(1.06)}
}

/* Inner content (label + number) */
.step-emblem-inner{
  position:relative;z-index:2;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;
  padding:0 8px;
}
.step-emblem-label{
  font-family:'JetBrains Mono',monospace;
  font-size:10px;font-weight:700;letter-spacing:0.18em;
  color:var(--text-faint);
  margin-bottom:2px;text-transform:uppercase;
}
.step-emblem-num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:56px;font-weight:800;
  letter-spacing:-0.05em;line-height:1;
  background:linear-gradient(135deg,var(--ec1) 0%,var(--ec2) 50%,var(--ec3) 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  text-shadow:0 0 30px rgba(255,255,255,0.05);
}

/* Floating icon badge in corner */
.step-emblem-icon{
  position:absolute;
  bottom:-8px;right:-8px;
  width:42px;height:42px;
  display:flex;align-items:center;justify-content:center;
  border-radius:14px;font-size:20px;
  background:linear-gradient(135deg,#1a1a24,#0e0e16);
  border:1px solid rgba(255,255,255,0.10);
  box-shadow:
    0 8px 24px rgba(0,0,0,0.5),
    0 0 0 3px #08080c,
    inset 0 1px 0 rgba(255,255,255,0.06);
  z-index:3;
  transition:transform .4s cubic-bezier(.34,1.56,.64,1);
}
.how-card:hover .step-emblem-icon{
  transform:rotate(-12deg) scale(1.1);
}
.how-card:hover .step-emblem-glow{
  opacity:.55;
}

/* Enhanced grid connector */
.how-grid{position:relative}
.how-grid::before{
  content:"";position:absolute;
  top:65px;left:14%;right:14%;height:1.5px;
  background:linear-gradient(90deg,
    transparent 0%,
    rgba(245,158,11,0.4) 18%,
    rgba(20,184,166,0.5) 50%,
    rgba(168,85,247,0.4) 82%,
    transparent 100%);
  z-index:0;
  border-radius:2px;
}
.how-grid::after{
  /* traveling pulse light */
  content:"";position:absolute;
  top:62px;left:14%;width:60px;height:7px;
  background:radial-gradient(ellipse 50% 100% at center,rgba(255,255,255,0.9),transparent 70%);
  border-radius:50%;
  filter:blur(2px);
  animation:travel 4s ease-in-out infinite;
  z-index:0;pointer-events:none;
}
@keyframes travel{
  0%{left:14%;opacity:0}
  10%{opacity:.8}
  50%{left:50%;transform:translateX(-50%)}
  90%{opacity:.8}
  100%{left:86%;opacity:0;transform:translateX(-100%)}
}
@media (max-width:900px){
  .how-grid::before,.how-grid::after{display:none}
  .step-emblem{width:120px;height:120px}
  .step-emblem-num{font-size:50px}
}
@media (max-width:560px){
  .step-emblem{width:108px;height:108px}
  .step-emblem-num{font-size:46px}
  .step-emblem-icon{width:36px;height:36px;font-size:17px;bottom:-6px;right:-6px}
}

/* ============================================================
   HERO MOCKUP v2 — slight refinement
   ============================================================ */
.hero-mockup-wrap{margin-top:90px}
@media (max-width:900px){.hero-mockup-wrap{margin-top:60px}}

/* ============================================================
   ROI CALCULATOR
   ============================================================ */
.roi{
  padding:120px 0;position:relative;
  border-top:1px solid var(--border);
  background:
    radial-gradient(ellipse 80% 50% at 50% 0%,rgba(168,85,247,0.06),transparent 60%),
    radial-gradient(ellipse 60% 40% at 50% 100%,rgba(20,184,166,0.04),transparent 60%);
}
.roi-card{
  position:relative;overflow:hidden;
  background:linear-gradient(180deg,rgba(20,20,32,0.7),rgba(12,12,18,0.5));
  border:1px solid var(--border);border-radius:28px;
  padding:48px;
  display:grid;grid-template-columns:1fr 1.05fr;gap:56px;
  backdrop-filter:blur(14px);
  box-shadow:0 32px 80px -20px rgba(0,0,0,0.4);
}
.roi-card::before{
  content:"";position:absolute;inset:-2px;border-radius:30px;
  background:linear-gradient(135deg,rgba(245,158,11,0.3),rgba(20,184,166,0.3),rgba(168,85,247,0.3));
  z-index:-1;filter:blur(40px);opacity:.4;
}
.roi-inputs h3,.roi-output h3{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:22px;font-weight:700;letter-spacing:-0.02em;
  margin-bottom:28px;
}
.roi-inputs h3 .ico,.roi-output h3 .ico{
  display:inline-block;margin-right:8px;font-size:20px;
}
.roi-input{margin-bottom:30px}
.roi-input label{
  display:flex;justify-content:space-between;align-items:baseline;gap:10px;
  margin-bottom:12px;
  font-size:14px;color:var(--text-dim);font-weight:500;
}
.roi-input label .vd{
  font-family:'JetBrains Mono',monospace;
  font-size:18px;font-weight:700;
  background:linear-gradient(135deg,#f59e0b,#14b8a6,#a855f7);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  letter-spacing:-0.01em;
}
.roi-slider{
  -webkit-appearance:none;appearance:none;
  width:100%;height:6px;
  background:linear-gradient(90deg,
    rgba(245,158,11,0.4) 0%,
    rgba(20,184,166,0.4) 50%,
    rgba(168,85,247,0.4) 100%);
  border-radius:3px;cursor:pointer;
  border:1px solid rgba(255,255,255,0.06);
}
.roi-slider::-webkit-slider-thumb{
  -webkit-appearance:none;appearance:none;
  width:24px;height:24px;border-radius:50%;
  background:linear-gradient(135deg,#fff,#e2e8f0);
  border:3px solid #0a0a0e;
  box-shadow:0 4px 14px rgba(0,0,0,0.5),0 0 0 2px rgba(168,85,247,0.4);
  cursor:grab;transition:transform .2s ease,box-shadow .2s ease;
}
.roi-slider::-webkit-slider-thumb:hover{
  transform:scale(1.15);box-shadow:0 6px 18px rgba(0,0,0,0.6),0 0 0 4px rgba(168,85,247,0.6);
}
.roi-slider::-webkit-slider-thumb:active{cursor:grabbing;transform:scale(1.1)}
.roi-slider::-moz-range-thumb{
  width:24px;height:24px;border-radius:50%;
  background:linear-gradient(135deg,#fff,#e2e8f0);
  border:3px solid #0a0a0e;
  box-shadow:0 4px 14px rgba(0,0,0,0.5);
  cursor:grab;
}
.roi-track-labels{
  display:flex;justify-content:space-between;
  font-family:'JetBrains Mono',monospace;
  font-size:11px;color:var(--text-faint);margin-top:8px;
}
.roi-output{
  display:flex;flex-direction:column;justify-content:center;gap:16px;
  position:relative;
  padding:28px;border-radius:20px;
  background:
    radial-gradient(ellipse at top right,rgba(168,85,247,0.10),transparent 60%),
    rgba(255,255,255,0.02);
  border:1px solid var(--border);
}
.roi-result-card{
  padding:22px 24px;border-radius:16px;
  background:rgba(255,255,255,0.025);
  border:1px solid var(--border);
  position:relative;overflow:hidden;
}
.roi-result-card.highlight{
  background:
    linear-gradient(135deg,rgba(16,185,129,0.10),rgba(20,184,166,0.05));
  border-color:rgba(16,185,129,0.3);
  padding:28px;
}
.roi-result-card.highlight::after{
  content:"";position:absolute;top:0;right:0;width:120px;height:120px;
  background:radial-gradient(circle,rgba(16,185,129,0.20),transparent 70%);
  pointer-events:none;
}
.roi-big-num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:54px;font-weight:800;letter-spacing:-0.04em;line-height:1;
  background:linear-gradient(135deg,#10b981,#14b8a6,#06b6d4);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  margin-bottom:6px;transition:transform .3s ease;
}
.roi-mid-num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:30px;font-weight:800;letter-spacing:-0.03em;line-height:1;
  color:#fff;margin-bottom:4px;
}
.roi-label{font-size:13px;color:var(--text-dim)}
.roi-results-grid{
  display:grid;grid-template-columns:1fr 1fr;gap:12px;
}
.roi-cta{margin-top:8px}
.roi-cta .btn{width:100%;justify-content:center}

@media (max-width:900px){
  .roi-card{grid-template-columns:1fr;gap:36px;padding:32px 24px}
  .roi-big-num{font-size:42px}
  .roi-mid-num{font-size:24px}
}

/* ============================================================
   BEFORE / AFTER
   ============================================================ */
.beforeafter{
  padding:120px 0;
  border-top:1px solid var(--border);
  position:relative;overflow:hidden;
}
.beforeafter::before{
  content:"";position:absolute;inset:0;
  background:
    radial-gradient(ellipse 50% 40% at 0% 50%,rgba(239,68,68,0.04),transparent 60%),
    radial-gradient(ellipse 50% 40% at 100% 50%,rgba(16,185,129,0.05),transparent 60%);
  pointer-events:none;
}
.ba-grid{
  position:relative;
  display:grid;grid-template-columns:1fr auto 1fr;
  gap:32px;align-items:stretch;
  margin-top:60px;
}
.ba-side{
  position:relative;
  padding:40px 36px;border-radius:24px;
  backdrop-filter:blur(10px);
  display:flex;flex-direction:column;
}
.ba-side.before{
  background:linear-gradient(180deg,rgba(50,20,20,0.4),rgba(30,12,12,0.2));
  border:1px solid rgba(239,68,68,0.20);
}
.ba-side.after{
  background:linear-gradient(180deg,rgba(15,40,30,0.4),rgba(10,30,22,0.2));
  border:1px solid rgba(16,185,129,0.30);
  box-shadow:0 24px 60px -10px rgba(16,185,129,0.10);
}
.ba-side-label{
  display:inline-flex;align-items:center;gap:8px;
  font-family:'JetBrains Mono',monospace;
  font-size:11px;font-weight:700;letter-spacing:0.15em;
  padding:6px 12px;border-radius:999px;
  margin-bottom:20px;width:fit-content;
}
.ba-side.before .ba-side-label{
  background:rgba(239,68,68,0.12);color:#fca5a5;
  border:1px solid rgba(239,68,68,0.25);
}
.ba-side.after .ba-side-label{
  background:rgba(16,185,129,0.12);color:#6ee7b7;
  border:1px solid rgba(16,185,129,0.30);
}
.ba-side h3{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:26px;font-weight:800;letter-spacing:-0.02em;
  margin-bottom:24px;
}
.ba-side.before h3{color:#fca5a5}
.ba-side.after h3{
  background:linear-gradient(135deg,#10b981,#06b6d4);
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
.ba-list{list-style:none;padding:0;margin:0;flex:1}
.ba-list li{
  display:flex;align-items:flex-start;gap:12px;
  padding:14px 0;
  border-bottom:1px solid rgba(255,255,255,0.05);
  font-size:15px;color:var(--text);line-height:1.5;
}
.ba-list li:last-child{border-bottom:none}
.ba-list li::before{
  flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;
  width:22px;height:22px;border-radius:50%;
  font-size:12px;font-weight:700;margin-top:1px;
}
.ba-side.before .ba-list li::before{
  content:"✕";background:rgba(239,68,68,0.15);color:#fca5a5;
  border:1px solid rgba(239,68,68,0.3);
}
.ba-side.after .ba-list li::before{
  content:"✓";background:rgba(16,185,129,0.15);color:#34d399;
  border:1px solid rgba(16,185,129,0.4);
}
.ba-side-stat{
  margin-top:20px;padding-top:20px;
  border-top:1px solid rgba(255,255,255,0.06);
  font-size:13px;color:var(--text-faint);
}
.ba-side-stat strong{color:#fff;font-weight:700}
.ba-side.before .ba-side-stat strong{color:#fca5a5}
.ba-side.after .ba-side-stat strong{color:#6ee7b7}

.ba-divider{
  align-self:center;
  width:64px;height:64px;border-radius:50%;
  background:linear-gradient(135deg,#f59e0b 0%,#14b8a6 50%,#a855f7 100%);
  display:flex;align-items:center;justify-content:center;
  position:relative;z-index:1;
  box-shadow:0 8px 32px rgba(0,0,0,0.4),0 0 0 4px #050508;
}
.ba-divider::before{
  content:"";position:absolute;inset:-8px;border-radius:50%;
  background:linear-gradient(135deg,#f59e0b,#14b8a6,#a855f7);
  filter:blur(16px);opacity:.5;z-index:-1;
  animation:emblemGlow 3s ease-in-out infinite alternate;
}
.ba-divider svg{
  width:26px;height:26px;color:#fff;
  fill:none;stroke:currentColor;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round;
}

@media (max-width:900px){
  .ba-grid{grid-template-columns:1fr;gap:16px}
  .ba-divider{transform:rotate(90deg);margin:8px auto;width:54px;height:54px}
  .ba-side{padding:28px 22px}
}

/* ============================================================
   GUARANTEE BANNER
   ============================================================ */
.guarantee{padding:60px 0;position:relative}
.guarantee-card{
  position:relative;overflow:hidden;
  background:
    radial-gradient(ellipse 60% 80% at 0% 50%,rgba(16,185,129,0.10),transparent 60%),
    linear-gradient(180deg,rgba(15,30,22,0.6),rgba(10,20,16,0.4));
  border:1px solid rgba(16,185,129,0.30);
  border-radius:28px;
  padding:40px 48px;
  display:grid;grid-template-columns:auto 1fr auto;gap:32px;align-items:center;
  backdrop-filter:blur(12px);
  box-shadow:0 24px 60px -10px rgba(16,185,129,0.10);
}
.guarantee-card::before{
  content:"";position:absolute;top:0;right:0;width:240px;height:240px;
  background:radial-gradient(circle,rgba(16,185,129,0.15),transparent 70%);
  filter:blur(20px);pointer-events:none;
}
.guarantee-shield{
  width:88px;height:88px;border-radius:24px;flex-shrink:0;
  background:linear-gradient(135deg,#10b981,#14b8a6);
  display:flex;align-items:center;justify-content:center;
  position:relative;
  box-shadow:0 12px 32px rgba(16,185,129,0.4);
}
.guarantee-shield::before{
  content:"";position:absolute;inset:-4px;border-radius:28px;
  background:linear-gradient(135deg,#10b981,#14b8a6);
  filter:blur(12px);opacity:.5;z-index:-1;
  animation:emblemGlow 2.5s ease-in-out infinite alternate;
}
.guarantee-shield svg{
  width:44px;height:44px;color:#fff;
  fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;
}
.guarantee-eyebrow{
  font-family:'JetBrains Mono',monospace;
  font-size:11px;font-weight:700;letter-spacing:0.18em;
  color:#34d399;margin-bottom:6px;
}
.guarantee-card h3{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:26px;font-weight:800;letter-spacing:-0.02em;
  margin-bottom:8px;
}
.guarantee-card p{
  font-size:15px;color:var(--text-dim);line-height:1.6;
  max-width:560px;margin-bottom:14px;
}
.guarantee-list{
  display:flex;gap:20px;flex-wrap:wrap;list-style:none;padding:0;margin:0;
}
.guarantee-list li{
  display:inline-flex;align-items:center;gap:6px;
  font-size:13px;color:#a7f3d0;font-weight:500;
}
.guarantee-list li::before{
  content:"";width:16px;height:16px;border-radius:50%;
  background:rgba(16,185,129,0.20);border:1px solid rgba(16,185,129,0.4);
  position:relative;display:inline-flex;align-items:center;justify-content:center;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%2334d399' stroke-width='2.5' aria-hidden="true" focusable="false"><polyline points='2.5,6.5 5,9 9.5,3.5'/></svg>");
  background-repeat:no-repeat;background-position:center;background-size:11px;
}

@media (max-width:900px){
  .guarantee-card{
    grid-template-columns:1fr;gap:20px;text-align:center;padding:32px 24px;
  }
  .guarantee-shield{margin:0 auto}
  .guarantee-list{justify-content:center}
  .guarantee-card p{margin-left:auto;margin-right:auto}
  .guarantee-eyebrow,.guarantee-card h3{text-align:center}
}

/* ============================================================
   ROI CALCULATOR v2 — Upgraded sophisticated version
   ============================================================ */
.roi-card{
  /* Override the simpler old grid */
  grid-template-columns:1fr 1.15fr;
  gap:0;padding:0;
  background:linear-gradient(180deg,rgba(20,20,32,0.85),rgba(12,12,18,0.65));
  overflow:hidden;
}
.roi-card-glow{
  position:absolute;inset:0;pointer-events:none;
  background:
    radial-gradient(ellipse 50% 40% at 0% 30%,rgba(245,158,11,0.10),transparent 60%),
    radial-gradient(ellipse 50% 40% at 100% 70%,rgba(168,85,247,0.10),transparent 60%),
    radial-gradient(ellipse 40% 30% at 50% 100%,rgba(16,185,129,0.08),transparent 60%);
  z-index:0;
}
.roi-inputs,.roi-output{
  position:relative;z-index:1;
  padding:48px 44px;
  display:flex;flex-direction:column;
}
.roi-inputs{
  border-right:1px solid var(--border);
  background:linear-gradient(180deg,rgba(15,15,22,0.4),rgba(10,10,16,0.2));
}
.roi-output{
  background:
    radial-gradient(ellipse 80% 60% at 50% 0%,rgba(16,185,129,0.06),transparent 65%),
    linear-gradient(180deg,rgba(8,16,12,0.4),rgba(5,12,9,0.2));
}

/* Side header */
.roi-side-head{margin-bottom:32px}
.roi-pill{
  display:inline-flex;align-items:center;gap:6px;
  padding:5px 11px;border-radius:999px;
  font-family:'JetBrains Mono',monospace;
  font-size:10px;font-weight:700;letter-spacing:0.15em;
  background:rgba(255,255,255,0.04);border:1px solid var(--border);
  color:var(--text-dim);margin-bottom:14px;
}
.roi-pill-dot{
  width:6px;height:6px;border-radius:50%;background:#a855f7;
  box-shadow:0 0 0 0 rgba(168,85,247,0.6);
  animation:atPulse 2s ease-out infinite;
}
.roi-pill.positive{background:rgba(16,185,129,0.10);border-color:rgba(16,185,129,0.3);color:#6ee7b7}
.roi-pill-dot.positive{background:#10b981;box-shadow:0 0 0 0 rgba(16,185,129,0.6)}
.roi-side-head h3{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:24px;font-weight:800;letter-spacing:-0.025em;line-height:1.15;
  margin-bottom:6px;color:#fff;
}
.roi-side-sub{
  font-size:13px;color:var(--text-faint);line-height:1.5;
  max-width:420px;
}

/* Inputs */
.roi-inputs .roi-input{
  margin-bottom:26px;padding-bottom:24px;
  border-bottom:1px solid rgba(255,255,255,0.04);
}
.roi-inputs .roi-input:last-of-type{border-bottom:none;margin-bottom:14px}

.roi-input-head{
  display:flex;align-items:center;gap:14px;margin-bottom:14px;
}
.roi-input-icon{
  flex-shrink:0;width:42px;height:42px;border-radius:12px;
  display:flex;align-items:center;justify-content:center;
  background:rgba(255,255,255,0.03);border:1px solid var(--border);
}
.roi-input-icon svg{width:20px;height:20px;color:#fff}
.roi-input-icon[data-tone="amber"]{
  background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.08));
  border-color:rgba(245,158,11,0.3);
}
.roi-input-icon[data-tone="amber"] svg{color:#fbbf24}
.roi-input-icon[data-tone="teal"]{
  background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.08));
  border-color:rgba(16,185,129,0.3);
}
.roi-input-icon[data-tone="teal"] svg{color:#5eead4}
.roi-input-icon[data-tone="violet"]{
  background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(217,70,239,0.08));
  border-color:rgba(139,92,246,0.3);
}
.roi-input-icon[data-tone="violet"] svg{color:#c4b5fd}

.roi-input-meta{flex:1;min-width:0}
.roi-input-label{
  font-size:14px;font-weight:600;color:#fff;letter-spacing:-0.01em;line-height:1.2;
}
.roi-input-help{font-size:11px;color:var(--text-faint);margin-top:2px}
.roi-input-value{
  flex-shrink:0;
  font-family:'JetBrains Mono',monospace;
  font-size:18px;font-weight:700;letter-spacing:-0.01em;
  background:linear-gradient(135deg,#fff,#e2e8f0 60%,#94a3b8);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  padding:6px 12px;border-radius:8px;
  background-color:rgba(255,255,255,0.04);
  border:1px solid var(--border);
  min-width:78px;text-align:center;
}

/* Slider */
.roi-slider-wrap{position:relative;padding:8px 0}
.roi-slider{
  -webkit-appearance:none;appearance:none;
  width:100%;height:6px;
  background:rgba(255,255,255,0.05);
  border-radius:3px;cursor:pointer;
  border:none;
}
.roi-slider::-webkit-slider-thumb{
  -webkit-appearance:none;appearance:none;
  width:24px;height:24px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#fff,#cbd5e1);
  border:2.5px solid #08080c;
  box-shadow:
    0 4px 14px rgba(0,0,0,0.5),
    0 0 0 2px rgba(168,85,247,0.5),
    inset 0 1px 0 rgba(255,255,255,0.6);
  cursor:grab;transition:transform .2s ease,box-shadow .2s ease;
}
.roi-slider::-webkit-slider-thumb:hover{
  transform:scale(1.18);
  box-shadow:
    0 6px 20px rgba(0,0,0,0.6),
    0 0 0 4px rgba(168,85,247,0.7),
    inset 0 1px 0 rgba(255,255,255,0.6);
}
.roi-slider::-webkit-slider-thumb:active{cursor:grabbing;transform:scale(1.1)}
.roi-slider::-moz-range-thumb{
  width:24px;height:24px;border-radius:50%;
  background:radial-gradient(circle at 35% 30%,#fff,#cbd5e1);
  border:2.5px solid #08080c;
  box-shadow:0 4px 14px rgba(0,0,0,0.5),0 0 0 2px rgba(168,85,247,0.5);
  cursor:grab;
}

.roi-input-foot{
  display:flex;justify-content:space-between;align-items:center;
  margin-top:12px;
  font-family:'JetBrains Mono',monospace;
  font-size:10px;letter-spacing:0.04em;
}
.roi-tick{color:var(--text-faint)}
.roi-context{
  display:inline-flex;align-items:center;gap:5px;
  color:var(--text-dim);font-weight:500;
}
.roi-context-dot{
  width:5px;height:5px;border-radius:50%;
  background:rgba(168,85,247,0.6);
}

.roi-disclaimer{
  display:inline-flex;align-items:center;gap:8px;
  font-size:11px;color:var(--text-faint);line-height:1.4;
  padding:10px 12px;border-radius:10px;
  background:rgba(255,255,255,0.02);
  border:1px solid var(--border);
  margin-top:8px;
}
.roi-disclaimer svg{flex-shrink:0;color:#a855f7}

/* HERO RESULT */
.roi-hero-result{
  position:relative;overflow:hidden;
  background:
    radial-gradient(ellipse 60% 80% at 100% 0%,rgba(16,185,129,0.18),transparent 60%),
    linear-gradient(180deg,rgba(15,40,30,0.5),rgba(10,25,18,0.3));
  border:1px solid rgba(16,185,129,0.3);
  border-radius:18px;padding:24px 26px;
  margin-bottom:18px;
}
.roi-hero-result::before{
  content:"";position:absolute;top:-1px;left:-1px;right:-1px;height:2px;
  background:linear-gradient(90deg,transparent,#10b981 30%,#14b8a6 70%,transparent);
  border-radius:18px 18px 0 0;
}
.roi-hero-top{
  display:flex;justify-content:space-between;align-items:center;
  margin-bottom:10px;
}
.roi-hero-label{
  font-family:'JetBrains Mono',monospace;
  font-size:10px;font-weight:700;letter-spacing:0.18em;
  color:#6ee7b7;text-transform:uppercase;
}
.roi-multiplier{
  display:inline-flex;align-items:center;
  padding:4px 10px;border-radius:999px;
  background:linear-gradient(135deg,#10b981,#06b6d4);
  color:#fff;font-family:'JetBrains Mono',monospace;
  font-size:12px;font-weight:800;letter-spacing:-0.01em;
  box-shadow:0 4px 12px rgba(16,185,129,0.3);
  transition:transform .3s ease;
}
.roi-multiplier.bump{transform:scale(1.15)}

.roi-hero-num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:clamp(38px,4.5vw,52px);font-weight:800;
  letter-spacing:-0.045em;line-height:1;
  background:linear-gradient(135deg,#10b981 0%,#14b8a6 50%,#06b6d4 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  margin-bottom:8px;
  filter:drop-shadow(0 4px 20px rgba(16,185,129,0.20));
  transition:transform .25s cubic-bezier(.34,1.56,.64,1);
}
.roi-hero-num.bump{transform:scale(1.04)}
.roi-hero-meta{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  font-size:12px;color:var(--text-dim);
}
.roi-hero-meta strong{
  color:#fff;font-family:'JetBrains Mono',monospace;font-weight:700;
}
.roi-hero-sep{color:var(--text-faint)}

/* Sparkline */
.roi-spark-wrap{margin-top:18px}
.roi-spark-label{
  font-size:11px;color:var(--text-faint);margin-bottom:6px;
  font-family:'JetBrains Mono',monospace;letter-spacing:0.05em;
}
.roi-spark{
  width:100%;height:80px;display:block;
}
.roi-spark-axis{
  display:flex;justify-content:space-between;
  font-family:'JetBrains Mono',monospace;
  font-size:10px;color:var(--text-faint);
  margin-top:4px;
}

/* SECONDARY METRICS */
.roi-secondary{
  display:grid;grid-template-columns:1fr 1fr;gap:12px;
  margin-bottom:18px;
}
.roi-mini{
  display:flex;align-items:center;gap:12px;
  padding:14px 16px;border-radius:14px;
  background:rgba(255,255,255,0.025);
  border:1px solid var(--border);
  transition:border-color .25s ease,background .25s ease;
}
.roi-mini:hover{border-color:rgba(255,255,255,0.12);background:rgba(255,255,255,0.04)}
.roi-mini-icon{
  flex-shrink:0;width:34px;height:34px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;
  font-size:16px;
  background:linear-gradient(135deg,rgba(245,158,11,0.12),rgba(168,85,247,0.10));
  border:1px solid rgba(255,255,255,0.06);
}
.roi-mini-num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:20px;font-weight:800;letter-spacing:-0.02em;line-height:1;
  color:#fff;margin-bottom:2px;
}
.roi-mini-label{font-size:11px;color:var(--text-faint);line-height:1.3}

/* BREAKDOWN */
.roi-breakdown{
  padding:16px 18px;border-radius:14px;
  background:rgba(255,255,255,0.02);
  border:1px solid var(--border);
  margin-bottom:18px;
}
.roi-breakdown-head{
  display:flex;justify-content:space-between;align-items:baseline;
  margin-bottom:10px;
  font-size:12px;color:var(--text-dim);
}
.roi-breakdown-total{
  font-family:'JetBrains Mono',monospace;font-weight:700;color:#fff;font-size:13px;
}
.roi-breakdown-bar{
  display:flex;width:100%;height:10px;border-radius:6px;overflow:hidden;
  background:rgba(255,255,255,0.04);
  border:1px solid var(--border);
  margin-bottom:12px;
}
.rbb-segment{
  height:100%;transition:width .5s cubic-bezier(.4,0,.2,1);
}
.rbb-1{background:linear-gradient(90deg,#10b981,#14b8a6)}
.rbb-2{background:linear-gradient(90deg,#14b8a6,#06b6d4)}
.roi-breakdown-legend{
  display:flex;flex-direction:column;gap:6px;
  font-size:11px;color:var(--text-dim);
}
.roi-breakdown-legend span{
  display:flex;align-items:center;gap:8px;justify-content:space-between;
}
.roi-breakdown-legend i{
  width:9px;height:9px;border-radius:2px;flex-shrink:0;
  display:inline-block;
}
.roi-breakdown-legend .rl-1{background:#10b981}
.roi-breakdown-legend .rl-2{background:#06b6d4}
.roi-breakdown-legend .rl-cost{background:#ef4444;opacity:.7}
.roi-breakdown-legend strong{
  color:#fff;font-family:'JetBrains Mono',monospace;font-weight:700;
  margin-left:auto;font-size:12px;
}
.roi-breakdown-legend .cost-line strong{color:#fca5a5}
.roi-breakdown-legend .cost-line{
  padding-top:6px;border-top:1px dashed rgba(255,255,255,0.06);margin-top:2px;
}

/* PLAN RECOMMENDATION */
.roi-recommend{
  position:relative;overflow:hidden;
  padding:20px 22px;border-radius:18px;
  background:
    linear-gradient(135deg,rgba(168,85,247,0.10),rgba(245,158,11,0.06));
  border:1px solid rgba(168,85,247,0.30);
  box-shadow:0 12px 32px -8px rgba(168,85,247,0.20);
}
.roi-recommend-glow{
  position:absolute;top:-30px;right:-30px;width:160px;height:160px;
  background:radial-gradient(circle,rgba(168,85,247,0.30),transparent 70%);
  filter:blur(20px);pointer-events:none;
  animation:emblemGlow 3s ease-in-out infinite alternate;
}
.roi-recommend-eyebrow{
  display:inline-flex;align-items:center;gap:6px;
  font-family:'JetBrains Mono',monospace;
  font-size:10px;font-weight:700;letter-spacing:0.18em;
  color:#c4b5fd;margin-bottom:6px;
  position:relative;z-index:1;
}
.roi-recommend-row{
  display:flex;align-items:flex-end;justify-content:space-between;gap:14px;
  margin-bottom:14px;position:relative;z-index:1;
}
.roi-recommend-name{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1.1;
  color:#fff;margin-bottom:6px;
}
.roi-recommend-desc{
  font-size:13px;color:var(--text-dim);line-height:1.5;
  max-width:340px;
}
.roi-recommend-desc strong{
  color:#fff;font-family:'JetBrains Mono',monospace;font-weight:700;
}
.roi-recommend-price{
  text-align:right;flex-shrink:0;
  display:flex;align-items:baseline;gap:2px;
}
.roi-recommend-price-num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:28px;font-weight:800;letter-spacing:-0.03em;line-height:1;
  background:linear-gradient(135deg,#fff,#cbd5e1);
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
.roi-recommend-price-period{font-size:12px;color:var(--text-faint)}
.roi-cta-btn{position:relative;z-index:1;font-size:15px;padding:14px 22px}
.roi-cta-btn .arr{
  display:inline-block;margin-left:6px;
  transition:transform .3s ease;
}
.roi-cta-btn:hover .arr{transform:translateX(4px)}

@media (max-width:980px){
  .roi-card{grid-template-columns:1fr}
  .roi-inputs{border-right:none;border-bottom:1px solid var(--border)}
  .roi-inputs,.roi-output{padding:32px 24px}
  .roi-recommend-row{flex-direction:column;align-items:flex-start;gap:10px}
  .roi-recommend-price{text-align:left;align-self:flex-start}
}

/* ============================================================
   ROI CALCULATOR v3 — World-class edition
   Presets · Gauge · 5-Year Projection · Live Ticker
   ============================================================ */

/* Override: roi-card now stacks (presets top, grid mid, ticker bottom) */
.roi-card{
  display:block;
  grid-template-columns:none;
  border-radius:28px;
}
.roi-grid{
  display:grid;grid-template-columns:1fr 1.15fr;gap:0;
  position:relative;z-index:1;
}
@media (max-width:980px){.roi-grid{grid-template-columns:1fr}}

/* ===== SCENARIO PRESETS ===== */
.roi-presets{
  position:relative;z-index:2;
  padding:24px 32px;
  border-bottom:1px solid var(--border);
  background:linear-gradient(180deg,rgba(15,15,22,0.6),rgba(15,15,22,0.3));
}
.roi-presets-label{
  display:inline-flex;align-items:center;gap:6px;
  font-family:'JetBrains Mono',monospace;
  font-size:10px;font-weight:700;letter-spacing:0.18em;
  color:var(--text-faint);margin-bottom:12px;
}
.roi-presets-label svg{color:#fbbf24}
.roi-presets-row{
  display:grid;grid-template-columns:repeat(4,1fr);gap:10px;
}
.roi-preset{
  position:relative;overflow:hidden;
  display:flex;align-items:center;gap:12px;
  padding:12px 14px;border-radius:14px;
  background:rgba(255,255,255,0.025);
  border:1px solid var(--border);
  cursor:pointer;text-align:left;
  font-family:inherit;color:inherit;
  transition:all .25s cubic-bezier(.4,0,.2,1);
}
.roi-preset:hover{
  background:rgba(255,255,255,0.05);
  border-color:rgba(255,255,255,0.18);
  transform:translateY(-2px);
}
.roi-preset.active{
  background:linear-gradient(135deg,rgba(168,85,247,0.10),rgba(20,184,166,0.06));
  border-color:rgba(168,85,247,0.35);
  box-shadow:0 8px 24px -4px rgba(168,85,247,0.20),inset 0 1px 0 rgba(255,255,255,0.04);
}
.roi-preset.active::before{
  content:"";position:absolute;top:0;left:0;right:0;height:2px;
  background:linear-gradient(90deg,transparent,#a855f7,#14b8a6,transparent);
  border-radius:14px 14px 0 0;
}
.rp-emoji{
  flex-shrink:0;width:34px;height:34px;border-radius:10px;
  display:flex;align-items:center;justify-content:center;
  font-size:18px;
  background:rgba(255,255,255,0.04);border:1px solid var(--border);
}
.roi-preset.active .rp-emoji{
  background:linear-gradient(135deg,rgba(168,85,247,0.20),rgba(20,184,166,0.12));
  border-color:rgba(168,85,247,0.4);
}
.rp-text{display:flex;flex-direction:column;min-width:0}
.rp-name{font-size:13px;font-weight:700;color:#fff;letter-spacing:-0.01em;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.rp-meta{font-size:11px;color:var(--text-faint);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

@media (max-width:980px){
  .roi-presets{padding:18px 20px}
  .roi-presets-row{grid-template-columns:1fr 1fr;gap:8px}
}
@media (max-width:480px){
  .roi-presets-row{grid-template-columns:1fr}
}

/* ===== INDUSTRY BENCHMARK MARKER ON SLIDERS ===== */
.roi-slider-wrap{position:relative;padding:8px 0;margin-bottom:0}
.roi-bench{
  position:absolute;top:50%;width:2px;height:14px;
  background:linear-gradient(180deg,transparent,#a855f7 30%,#a855f7 70%,transparent);
  transform:translate(-1px,-50%);
  pointer-events:none;z-index:0;border-radius:2px;
  box-shadow:0 0 8px rgba(168,85,247,0.5);
}
.roi-bench::after{
  content:"";position:absolute;top:-3px;left:50%;
  width:6px;height:6px;border-radius:50%;
  background:#a855f7;transform:translate(-50%,0);
  box-shadow:0 0 6px rgba(168,85,247,0.8);
}

/* ===== HERO RESULT (Gauge + Number) ===== */
.roi-hero-result{padding:24px}
.roi-hero-grid{
  display:grid;grid-template-columns:200px 1fr;gap:24px;align-items:center;
}
@media (max-width:1100px){.roi-hero-grid{grid-template-columns:1fr;text-align:center}}

/* GAUGE */
.roi-gauge-wrap{
  position:relative;
  width:200px;height:128px;
  margin:0 auto;
}
.roi-gauge{width:100%;height:auto;display:block}
.roi-gauge-center{
  position:absolute;left:50%;bottom:0;transform:translateX(-50%);
  text-align:center;width:140px;
  padding-bottom:4px;
}
.roi-gauge-label{
  font-family:'JetBrains Mono',monospace;
  font-size:9px;font-weight:700;letter-spacing:0.20em;
  color:var(--text-faint);margin-bottom:2px;
}
.roi-gauge-value{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:34px;font-weight:800;letter-spacing:-0.04em;line-height:1;
  background:linear-gradient(135deg,#10b981,#14b8a6,#06b6d4);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 4px 14px rgba(16,185,129,0.25));
  transition:transform .3s cubic-bezier(.34,1.56,.64,1);
}
.roi-gauge-value.bump{transform:scale(1.08)}
.roi-gauge-status{
  font-size:11px;color:#6ee7b7;font-weight:600;
  margin-top:2px;
  display:inline-flex;align-items:center;justify-content:center;gap:4px;
}
#roiGaugeDot{
  transition:cx .55s cubic-bezier(.4,0,.2,1), cy .55s cubic-bezier(.4,0,.2,1);
}

/* HERO NUMBER SIDE */
.roi-hero-num-side{display:flex;flex-direction:column;gap:6px}
.roi-hero-label{
  font-family:'JetBrains Mono',monospace;
  font-size:10px;font-weight:700;letter-spacing:0.18em;
  color:#6ee7b7;text-transform:uppercase;
}
.roi-hero-num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:clamp(36px,4vw,46px);font-weight:800;
  letter-spacing:-0.045em;line-height:1;
  background:linear-gradient(135deg,#10b981 0%,#14b8a6 50%,#06b6d4 100%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  filter:drop-shadow(0 4px 18px rgba(16,185,129,0.20));
  transition:transform .25s cubic-bezier(.34,1.56,.64,1);
  margin:2px 0 4px;
}
.roi-hero-num.bump{transform:scale(1.04)}
.roi-hero-meta{
  display:flex;align-items:center;gap:10px;flex-wrap:wrap;
  font-size:12px;color:var(--text-dim);
}
.roi-hero-meta strong{color:#fff;font-family:'JetBrains Mono',monospace;font-weight:700}
.roi-hero-sep{color:var(--text-faint)}
.roi-hero-fiveyear{
  display:inline-flex;align-items:baseline;gap:8px;margin-top:8px;
  padding:8px 12px;border-radius:10px;
  background:rgba(168,85,247,0.08);
  border:1px solid rgba(168,85,247,0.25);
  width:fit-content;
}
@media (max-width:1100px){.roi-hero-fiveyear{align-self:center}}
.rh5y-label{
  font-family:'JetBrains Mono',monospace;
  font-size:11px;font-weight:600;color:#c4b5fd;letter-spacing:0.05em;
}
.rh5y-num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#fff;
}

/* Outer hero-result card style (the wrapper) */
.roi-hero-result{
  margin-bottom:18px;
  background:
    radial-gradient(ellipse 60% 80% at 100% 0%,rgba(16,185,129,0.12),transparent 60%),
    linear-gradient(180deg,rgba(15,40,30,0.5),rgba(10,25,18,0.3));
  border:1px solid rgba(16,185,129,0.25);
  border-radius:18px;
  position:relative;overflow:hidden;
  padding:24px;
}
.roi-hero-result::before{
  content:"";position:absolute;top:-1px;left:-1px;right:-1px;height:2px;
  background:linear-gradient(90deg,transparent,#10b981 30%,#14b8a6 70%,transparent);
  border-radius:18px 18px 0 0;
}

/* ===== 5-YEAR PROJECTION CHART ===== */
.roi-projection{
  padding:20px;border-radius:18px;
  background:
    radial-gradient(ellipse 80% 100% at 50% 0%,rgba(255,255,255,0.025),transparent 70%),
    rgba(255,255,255,0.018);
  border:1px solid var(--border);
  margin-bottom:18px;
  position:relative;overflow:hidden;
}
.roi-proj-head{
  display:flex;align-items:flex-start;justify-content:space-between;
  gap:14px;margin-bottom:14px;
}
.rp-eyebrow{
  font-family:'JetBrains Mono',monospace;
  font-size:10px;font-weight:700;letter-spacing:0.15em;
  color:var(--text-faint);margin-bottom:4px;
}
.rp-title{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:16px;font-weight:700;letter-spacing:-0.01em;color:#fff;
}
.rp-title strong{
  background:linear-gradient(135deg,#10b981,#06b6d4);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  font-weight:800;
}
.rp-diff-pill{
  flex-shrink:0;
  font-family:'JetBrains Mono',monospace;
  font-size:13px;font-weight:800;
  padding:6px 12px;border-radius:999px;
  background:linear-gradient(135deg,#10b981,#14b8a6);
  color:#fff;letter-spacing:-0.01em;
  box-shadow:0 4px 12px rgba(16,185,129,0.30);
}

.roi-proj-chart-wrap{position:relative;margin:14px 0 8px}
.roi-proj-chart{
  width:100%;height:180px;display:block;
}
.roi-proj-chart path{
  /* NOT: SVG \`d\` gecisi yalnizca Chromium'da (Chrome/Edge) yumusar.
     Firefox ve Safari bu ozelligi yok sayar; oralarda egri aninda degisir.
     Islevsel bir hata degil, bilincli kabul edilmis bir fark. */
  transition:d .55s cubic-bezier(.4,0,.2,1);
}
.roi-proj-axis{
  display:flex;justify-content:space-between;
  font-family:'JetBrains Mono',monospace;
  font-size:10px;color:var(--text-faint);
  margin-top:4px;padding:0 4px;
}
.roi-proj-legend{
  display:flex;flex-wrap:wrap;gap:18px;
  margin-top:14px;padding-top:14px;
  border-top:1px solid var(--border);
  font-size:12px;color:var(--text-dim);
}
.roi-proj-legend strong{color:#fff;font-weight:600}
.roi-proj-legend span{display:inline-flex;align-items:center;gap:8px}
.roi-proj-legend i{
  display:inline-block;width:14px;height:3px;border-radius:2px;
}
.roi-proj-legend .rpl-with{background:#10b981}
.roi-proj-legend .rpl-without{
  background:transparent;border-bottom:2px dashed #ef4444;height:2px;width:14px;
}

/* ===== LIVE MONEY TICKER ===== */
.roi-money-ticker{
  position:relative;z-index:1;
  display:flex;align-items:center;gap:16px;
  padding:16px 32px;
  border-top:1px solid var(--border);
  background:
    linear-gradient(90deg,rgba(16,185,129,0.05),rgba(20,184,166,0.03) 50%,rgba(16,185,129,0.05));
  font-size:14px;
}
.rmt-pulse{
  width:10px;height:10px;border-radius:50%;flex-shrink:0;
  background:#10b981;
  box-shadow:0 0 0 0 rgba(16,185,129,0.7);
  animation:atPulse 1.5s ease-out infinite;
}
.rmt-text{
  flex:1;color:var(--text-dim);min-width:0;
}
.rmt-text strong{
  color:#10b981;font-family:'JetBrains Mono',monospace;font-weight:800;
  font-size:16px;letter-spacing:-0.01em;
  background:linear-gradient(135deg,#10b981,#14b8a6);
  -webkit-background-clip:text;background-clip:text;color:transparent;
}
.rmt-rate{
  flex-shrink:0;display:inline-flex;align-items:baseline;gap:2px;
  padding:6px 12px;border-radius:8px;
  background:rgba(16,185,129,0.08);
  border:1px solid rgba(16,185,129,0.25);
}
.rmt-rate-num{
  font-family:'JetBrains Mono',monospace;
  font-size:14px;font-weight:800;color:#34d399;
  letter-spacing:-0.01em;
}
.rmt-rate-unit{font-size:11px;color:#6ee7b7}

@media (max-width:780px){
  .roi-money-ticker{flex-direction:column;align-items:flex-start;gap:10px;padding:14px 20px}
  .rmt-rate{align-self:flex-start}
}

/* ============================================================
   GLOBAL POLISH LAYER — Scroll progress · Grain · Hero rotator
   Demo pill · Marquee · Bento grid · Newsletter
   ============================================================ */

/* ===== SCROLL PROGRESS BAR ===== */
.scroll-progress{
  position:fixed;top:0;left:0;
  height:2.5px;width:0%;
  background:linear-gradient(90deg,#f59e0b 0%,#14b8a6 50%,#a855f7 100%);
  z-index:200;
  box-shadow:0 0 12px rgba(168,85,247,0.5),0 0 4px rgba(168,85,247,0.8);
  transition:width .08s linear;
  pointer-events:none;
}

/* ===== GLOBAL GRAIN TEXTURE ===== */
.grain-overlay{
  position:fixed;inset:0;
  pointer-events:none;z-index:150;
  opacity:.035;mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml;utf8,<svg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg' aria-hidden="true" focusable="false"><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>");
  background-size:200px 200px;
}

/* ===== HERO DEMO PILL ===== */
.hero-demo-pill{
  display:inline-flex;align-items:center;gap:10px;
  padding:6px 12px 6px 6px;border-radius:999px;
  background:linear-gradient(135deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02));
  border:1px solid rgba(255,255,255,0.08);
  font-size:13px;color:var(--text-dim);font-weight:500;
  margin-bottom:18px;
  backdrop-filter:blur(10px);
  transition:transform .25s ease, border-color .25s ease, background .25s ease;
  animation:fadeUp .8s var(--ease) both;
}
.hero-demo-pill:hover{
  transform:translateY(-2px);
  border-color:rgba(255,255,255,0.16);
  background:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03));
  color:#fff;
}
.hdp-play{
  width:24px;height:24px;border-radius:50%;flex-shrink:0;
  background:linear-gradient(135deg,#f59e0b,#a855f7);
  color:#fff;display:inline-flex;align-items:center;justify-content:center;
  position:relative;
  box-shadow:0 4px 12px rgba(168,85,247,0.4);
}
.hdp-play::before{
  content:"";position:absolute;inset:-2px;border-radius:50%;
  background:linear-gradient(135deg,#f59e0b,#a855f7);
  opacity:.4;z-index:-1;filter:blur(6px);
  animation:emblemGlow 2s ease-in-out infinite alternate;
}
.hdp-play svg{transform:translateX(0.5px)}
.hdp-arrow{
  font-size:13px;color:var(--text-faint);transition:transform .3s ease;
}
.hero-demo-pill:hover .hdp-arrow{transform:translateX(3px);color:#fff}

/* ===== HERO TITLE ROTATOR ===== */
.hero-rotator{
  display:inline-block;position:relative;
  min-width:6.5ch;text-align:center;vertical-align:bottom;
  /* Using vertical baseline alignment so it matches title flow */
}
.hero-rotator-word{
  position:absolute;left:0;right:0;top:0;
  opacity:0;transform:translateY(20px);
  transition:opacity .6s var(--ease), transform .6s var(--ease);
  background:linear-gradient(135deg,#f59e0b 0%,#14b8a6 50%,#a855f7 100%);
  background-size:200% 200%;
  -webkit-background-clip:text;background-clip:text;color:transparent;
  animation:gradFlow 6s ease-in-out infinite;
  font-weight:inherit;letter-spacing:inherit;
}
.hero-rotator-word.active{
  position:relative;
  opacity:1;transform:translateY(0);
}
.hero-rotator-word.exiting{
  opacity:0;transform:translateY(-20px);
}

/* ===== BENTO GRID ===== */
.bento-grid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  grid-auto-rows:minmax(180px,auto);
  gap:18px;
  margin-top:60px;
}
.bento{
  position:relative;overflow:hidden;
  background:linear-gradient(180deg,rgba(20,20,30,0.7),rgba(12,12,18,0.5));
  border:1px solid var(--border);border-radius:22px;
  padding:28px;
  display:flex;flex-direction:column;
  backdrop-filter:blur(10px);
  transition:transform .4s cubic-bezier(.4,0,.2,1),border-color .4s ease,box-shadow .4s ease;
}
.bento:hover{
  transform:translateY(-4px);
  border-color:rgba(255,255,255,0.16);
  box-shadow:0 24px 60px -16px rgba(0,0,0,0.5);
}
.bento-eyebrow{
  font-family:'JetBrains Mono',monospace;
  font-size:10px;font-weight:700;letter-spacing:0.15em;
  color:var(--text-faint);margin-bottom:6px;
}
.bento h4{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:20px;font-weight:800;letter-spacing:-0.02em;line-height:1.2;
  margin-bottom:8px;color:#fff;
}
.bento p{
  font-size:14px;color:var(--text-dim);line-height:1.55;
  flex:1;
}
.bento-content{position:relative;z-index:1}

/* === Mobile bento (large 2x2) with iPhone === */
.bento-mobile{
  grid-column:span 2;grid-row:span 2;
  background:
    radial-gradient(ellipse 60% 80% at 90% 30%,rgba(168,85,247,0.10),transparent 60%),
    linear-gradient(180deg,rgba(20,20,30,0.7),rgba(12,12,18,0.5));
  flex-direction:row;align-items:center;gap:24px;
  padding:36px;
  min-height:480px;
}
.bento-mobile .bento-content{flex:1;max-width:340px}
.bento-mobile h4{font-size:28px}
.bento-tags{
  display:flex;flex-wrap:wrap;gap:6px;margin-top:18px;
}
.bento-tags span{
  font-family:'JetBrains Mono',monospace;
  font-size:10px;font-weight:700;letter-spacing:0.05em;
  padding:4px 10px;border-radius:999px;
  background:rgba(255,255,255,0.04);
  border:1px solid var(--border);
  color:var(--text-dim);
}
.bento-visual{
  flex-shrink:0;display:flex;align-items:center;justify-content:center;
  position:relative;
}

/* iPhone mockup */
.phone{
  position:relative;
  width:240px;height:480px;
  border-radius:42px;
  background:linear-gradient(135deg,#1a1a26,#0c0c14);
  border:2px solid #2a2a36;
  box-shadow:
    0 0 0 1px rgba(255,255,255,0.06) inset,
    0 30px 60px -15px rgba(0,0,0,0.7),
    0 60px 80px -30px rgba(168,85,247,0.20);
  padding:6px;overflow:hidden;
  transform:rotate(-3deg) translateY(-10px);
  transition:transform .5s ease;
}
.bento-mobile:hover .phone{transform:rotate(0deg) translateY(-10px) scale(1.02)}
.phone-notch{
  position:absolute;top:8px;left:50%;transform:translateX(-50%);
  width:80px;height:18px;border-radius:0 0 12px 12px;
  background:#000;z-index:3;
}
.phone-screen{
  width:100%;height:100%;border-radius:36px;
  background:linear-gradient(180deg,#0a0a14,#050508);
  overflow:hidden;position:relative;
  padding:32px 14px 14px;
}
.phone-status{
  display:flex;justify-content:space-between;align-items:center;
  padding:0 14px;margin-bottom:14px;
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:13px;font-weight:600;color:#fff;
}
.ps-icons{display:inline-flex;gap:4px;color:#fff}
.phone-app{display:flex;flex-direction:column;gap:10px}
.phone-app-header{
  display:flex;justify-content:space-between;align-items:center;
  padding:0 4px;
}
.pah-greet{font-size:11px;color:var(--text-faint)}
.pah-name{font-size:14px;color:#fff;font-weight:600}
.pah-name strong{color:#a855f7}
.pah-avatar{
  width:34px;height:34px;border-radius:50%;
  background:linear-gradient(135deg,#f59e0b,#ef4444);
  display:flex;align-items:center;justify-content:center;
  font-size:13px;font-weight:700;color:#fff;
  border:2px solid rgba(255,255,255,0.06);
}
.phone-stat-card{
  margin-top:6px;padding:14px;border-radius:14px;
  background:linear-gradient(135deg,rgba(168,85,247,0.18),rgba(20,184,166,0.10));
  border:1px solid rgba(168,85,247,0.30);
  position:relative;overflow:hidden;
}
.phone-stat-card::before{
  content:"";position:absolute;top:-20px;right:-20px;width:80px;height:80px;
  background:radial-gradient(circle,rgba(168,85,247,0.30),transparent 70%);
  filter:blur(8px);
}
.psc-label{
  font-family:'JetBrains Mono',monospace;
  font-size:9px;font-weight:700;letter-spacing:0.1em;
  color:#c4b5fd;margin-bottom:4px;position:relative;
}
.psc-num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:24px;font-weight:800;letter-spacing:-0.03em;
  color:#fff;line-height:1;margin-bottom:4px;position:relative;
}
.psc-trend{font-size:10px;color:#34d399;font-weight:600;position:relative}
.phone-list{display:flex;flex-direction:column;gap:6px;margin-top:6px}
.phone-list-item{
  display:flex;align-items:center;gap:8px;
  padding:9px 10px;border-radius:11px;
  background:rgba(255,255,255,0.03);
  border:1px solid var(--border);
}
.pli-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.pli-body{flex:1;min-width:0}
.pli-title{font-size:11px;color:#fff;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pli-meta{font-size:9px;color:var(--text-faint);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pli-amt{
  font-family:'JetBrains Mono',monospace;
  font-size:11px;font-weight:700;color:#10b981;
  flex-shrink:0;
}
.pli-amt.small{font-size:14px;color:#f59e0b}

.phone-notif{
  position:absolute;top:60px;left:-30px;right:-30px;
  display:flex;align-items:center;gap:10px;
  padding:10px 14px;border-radius:14px;
  background:rgba(20,20,30,0.95);
  backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,0.10);
  box-shadow:0 14px 30px rgba(0,0,0,0.5);
  z-index:5;
  transform:rotate(3deg);
  animation:phoneNotifFloat 4s ease-in-out 1s infinite;
}
.phone-notif-ico{
  width:30px;height:30px;border-radius:8px;flex-shrink:0;
  background:linear-gradient(135deg,#10b981,#14b8a6);
  display:flex;align-items:center;justify-content:center;
  font-size:14px;
}
.phone-notif-title{font-size:11px;font-weight:700;color:#fff}
.phone-notif-text{font-size:10px;color:var(--text-faint);margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:180px}
@keyframes phoneNotifFloat{
  0%,100%{transform:rotate(3deg) translateY(0)}
  50%{transform:rotate(2deg) translateY(-6px)}
}

/* === Kalkan bento === */
.bento-guard{
  background:
    radial-gradient(ellipse 80% 100% at 50% 0%,rgba(16,185,129,0.10),transparent 70%),
    linear-gradient(180deg,rgba(15,30,22,0.6),rgba(10,20,16,0.4));
  border-color:rgba(16,185,129,0.25);
  position:relative;
}
.bento-shield{
  margin-bottom:auto;color:#10b981;
  filter:drop-shadow(0 8px 20px rgba(16,185,129,0.35));
  animation:shieldFloat 5s ease-in-out infinite;
}
@keyframes shieldFloat{
  0%,100%{transform:translateY(0) rotate(-2deg)}
  50%{transform:translateY(-6px) rotate(2deg)}
}
.bento-shield-rays{
  position:absolute;top:30px;left:30px;width:120px;height:120px;
  background:radial-gradient(circle,rgba(16,185,129,0.20),transparent 60%);
  filter:blur(20px);pointer-events:none;
  animation:emblemGlow 3s ease-in-out infinite alternate;
}

/* === PDF stack bento === */
.bento-pdf{
  background:
    radial-gradient(ellipse 80% 100% at 100% 100%,rgba(245,158,11,0.10),transparent 70%),
    linear-gradient(180deg,rgba(30,24,15,0.6),rgba(20,15,10,0.4));
  border-color:rgba(245,158,11,0.20);
  position:relative;
}
.bento-pdf-stack{
  position:absolute;bottom:-20px;right:-15px;width:160px;height:160px;
  pointer-events:none;
}
.pdf-page{
  position:absolute;width:120px;height:150px;border-radius:8px;
  background:linear-gradient(180deg,#1a1a24,#0e0e14);
  border:1px solid rgba(255,255,255,0.10);
  padding:12px;
  box-shadow:0 8px 20px rgba(0,0,0,0.4);
  transition:transform .5s cubic-bezier(.4,0,.2,1);
}
.pdf-3{transform:rotate(-12deg) translate(-20px,8px)}
.pdf-2{transform:rotate(-6deg) translate(-10px,4px)}
.pdf-1{transform:rotate(0deg)}
.bento-pdf:hover .pdf-3{transform:rotate(-18deg) translate(-30px,12px)}
.bento-pdf:hover .pdf-2{transform:rotate(-3deg) translate(-5px,2px)}
.bento-pdf:hover .pdf-1{transform:rotate(4deg) translate(8px,-6px)}
.pdf-header{
  width:60%;height:6px;border-radius:2px;
  background:linear-gradient(90deg,#a855f7,#14b8a6);
  margin-bottom:10px;
}
.pdf-header.amber{background:linear-gradient(90deg,#f59e0b,#ef4444)}
.pdf-line{
  width:100%;height:3px;border-radius:1.5px;
  background:rgba(255,255,255,0.08);
  margin-bottom:5px;
}
.pdf-line.short{width:55%}
.pdf-stamp{
  position:absolute;bottom:8px;right:8px;
  font-family:'JetBrains Mono',monospace;
  font-size:9px;font-weight:800;letter-spacing:0.1em;
  padding:3px 7px;border-radius:4px;
  background:linear-gradient(135deg,#f59e0b,#ef4444);
  color:#fff;
}

/* === WhatsApp chat bento === */
.bento-wapp{
  background:
    radial-gradient(ellipse 80% 100% at 100% 100%,rgba(37,211,102,0.08),transparent 70%),
    linear-gradient(180deg,rgba(15,28,22,0.6),rgba(10,20,16,0.4));
  border-color:rgba(37,211,102,0.18);
  position:relative;
}
.bento-chat{
  display:flex;flex-direction:column;gap:6px;
  margin-top:14px;
}
.chat-bubble{
  padding:8px 12px;border-radius:14px;
  font-size:12px;color:#fff;line-height:1.4;
  max-width:85%;position:relative;
  display:inline-flex;align-items:center;gap:6px;
}
.chat-in{
  background:rgba(255,255,255,0.06);
  border-radius:14px 14px 14px 4px;
  align-self:flex-start;
}
.chat-out{
  background:linear-gradient(135deg,#10b981,#14b8a6);
  border-radius:14px 14px 4px 14px;
  align-self:flex-end;
  color:#fff;
}
.chat-tick{font-size:10px;opacity:.85}
.chat-typing{padding:10px 14px}
.dot-typ{
  width:6px;height:6px;border-radius:50%;
  background:#fff;display:inline-block;
  animation:typingDot 1.4s ease-in-out infinite;
}
.dot-typ:nth-child(1){animation-delay:0s}
.dot-typ:nth-child(2){animation-delay:.2s}
.dot-typ:nth-child(3){animation-delay:.4s}
@keyframes typingDot{
  0%,60%,100%{opacity:.3;transform:translateY(0)}
  30%{opacity:1;transform:translateY(-3px)}
}

/* === Reporting chart bento === */
.bento-report{
  background:
    radial-gradient(ellipse 80% 100% at 100% 100%,rgba(168,85,247,0.10),transparent 70%),
    linear-gradient(180deg,rgba(22,15,30,0.6),rgba(15,10,20,0.4));
  border-color:rgba(168,85,247,0.20);
  position:relative;
}
.bento-chart{
  position:relative;margin-top:14px;
  border-radius:10px;
  background:rgba(0,0,0,0.2);padding:14px 16px 12px;
  border:1px solid var(--border);
}
.bento-chart svg{
  width:100%;height:auto;display:block;
  margin-top:8px;border-radius:6px;overflow:hidden;
}
.bento-chart-stat{
  display:flex;align-items:baseline;justify-content:space-between;gap:8px;
  margin-bottom:0;
}
.bcs-num{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:22px;font-weight:800;letter-spacing:-0.02em;line-height:1.2;
  padding-right:2px;display:inline-block;
  background:linear-gradient(135deg,#a855f7,#d946ef);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  -webkit-text-fill-color:transparent;
}
.bcs-lbl{
  font-size:10px;color:var(--text-faint);
  font-family:'JetBrains Mono',monospace;letter-spacing:0.05em;
}

/* === Integration cloud bento (large 3x) === */
.bento-integ{
  grid-column:span 3;
  background:
    radial-gradient(ellipse 50% 80% at 25% 50%,rgba(168,85,247,0.10),transparent 70%),
    radial-gradient(ellipse 60% 80% at 80% 50%,rgba(20,184,166,0.08),transparent 70%),
    linear-gradient(180deg,rgba(20,20,30,0.7),rgba(12,12,18,0.5));
  flex-direction:row;align-items:center;gap:20px;
  min-height:280px;padding:36px;
}
.bento-integ .bento-content{flex:0 0 360px}
.bento-integ h4{font-size:24px}
.bento-integ-cloud{
  flex:1;position:relative;height:240px;
  display:flex;align-items:center;justify-content:center;
}
.integ-orbit{
  position:absolute;top:50%;left:50%;
  width:170px;height:170px;
  border-radius:50%;
  border:1px dashed rgba(255,255,255,0.08);
  transform:translate(-50%,-50%);
  animation:orbitSpin 30s linear infinite;
}
.integ-orbit-2{width:260px;height:260px;animation:orbitSpin 50s linear infinite reverse}
@keyframes orbitSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}
.integ-center{
  position:relative;z-index:2;
  width:64px;height:64px;border-radius:18px;
  background:linear-gradient(135deg,#0a0a14,#1a1a24);
  border:1px solid rgba(255,255,255,0.10);
  display:flex;align-items:center;justify-content:center;
  box-shadow:
    0 0 0 4px #050508,
    0 0 0 5px rgba(168,85,247,0.30),
    0 12px 32px rgba(168,85,247,0.30);
}
.integ-center::before{
  content:"";position:absolute;inset:-12px;border-radius:24px;
  background:linear-gradient(135deg,#f59e0b,#14b8a6,#a855f7);
  filter:blur(16px);opacity:.4;z-index:-1;
  animation:emblemGlow 3s ease-in-out infinite alternate;
}
.integ-center-inner{
  width:32px;height:32px;border-radius:8px;
  background:linear-gradient(135deg,#f59e0b 0%,#14b8a6 50%,#a855f7 100%);
}
.integ-center-inner .logo-mark{
  width:100%;height:100%;border-radius:8px;
  background:inherit;display:block;
}
.integ-node{
  position:absolute;
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:11px;font-weight:700;letter-spacing:-0.01em;
  padding:6px 12px;border-radius:999px;
  background:rgba(20,20,30,0.85);
  backdrop-filter:blur(10px);
  border:1px solid rgba(255,255,255,0.10);
  color:#fff;white-space:nowrap;
  animation:nodeFloat 4s ease-in-out infinite;
  animation-delay:var(--del,0s);
  box-shadow:0 6px 16px rgba(0,0,0,0.4);
}
.integ-node.n1{top:10%;left:8%;color:#fbbf24;border-color:rgba(245,158,11,0.30)}
.integ-node.n2{top:14%;right:6%;color:#5eead4;border-color:rgba(20,184,166,0.30)}
.integ-node.n3{top:50%;left:0%;color:#c4b5fd;border-color:rgba(168,85,247,0.30)}
.integ-node.n4{bottom:14%;left:12%;color:#f9a8d4;border-color:rgba(244,114,182,0.30)}
.integ-node.n5{bottom:10%;right:8%;color:#fbbf24;border-color:rgba(245,158,11,0.30)}
.integ-node.n6{top:50%;right:0%;color:#5eead4;border-color:rgba(20,184,166,0.30)}
.integ-node.n7{top:30%;left:35%;color:#a5f3fc;border-color:rgba(6,182,212,0.30)}
.integ-node.n8{bottom:30%;right:32%;color:#fda4af;border-color:rgba(244,63,94,0.30)}
@keyframes nodeFloat{
  0%,100%{transform:translateY(0)}
  50%{transform:translateY(-6px)}
}

/* Bento responsive */
@media (max-width:1100px){
  .bento-integ .bento-content{flex:1;max-width:280px}
}
@media (max-width:900px){
  .bento-grid{grid-template-columns:1fr 1fr;grid-auto-rows:minmax(180px,auto);gap:14px}
  .bento-mobile{grid-column:span 2;flex-direction:column;text-align:center;min-height:auto}
  .bento-mobile .bento-content{max-width:none}
  .bento-mobile .phone{transform:rotate(0) scale(.85)}
  .bento-integ{grid-column:span 2;flex-direction:column;text-align:center;min-height:auto}
  .bento-integ .bento-content{flex:1;max-width:none}
  .bento-integ-cloud{width:100%;max-width:380px;height:200px}
}
@media (max-width:560px){
  .bento-grid{grid-template-columns:1fr}
  .bento-mobile,.bento-integ{grid-column:span 1}
  .bento{padding:22px}
}

/* ============================================================
   TEK URUN EKLERI (kaynak gorsel dili korunarak)
   ============================================================ */

/* JS calismazsa "reveal" bloklari gizli kalmasin */
html:not(.js) .reveal,
html:not(.js) .reveal-stagger > *{
  opacity:1 !important;transform:none !important;filter:none !important;
}

/* --- Yetenek listesi (kutudan cikan her sey) --- */
.caps{padding:110px 0;border-top:1px solid var(--border);position:relative}
.caps::before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse at 50% 0%,rgba(20,184,166,0.09),transparent 55%);
}
.caps .container{position:relative}
.cap-groups{
  display:grid;grid-template-columns:repeat(3,1fr);gap:20px;
}
.cap-group{
  background:linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.01));
  border:1px solid var(--border);border-radius:var(--radius-lg);
  padding:28px 26px;position:relative;overflow:hidden;
  transition:transform .35s var(--ease),border-color .35s var(--ease),box-shadow .35s var(--ease);
}
.cap-group:hover{transform:translateY(-4px);border-color:rgba(255,255,255,0.16);box-shadow:0 24px 60px -20px rgba(0,0,0,0.55)}
.cap-group-head{display:flex;align-items:center;gap:12px;margin-bottom:18px}
.cap-ico{
  width:40px;height:40px;border-radius:12px;flex-shrink:0;
  display:grid;place-items:center;font-size:19px;
  border:1px solid var(--border-strong);
}
.cap-group:nth-child(1) .cap-ico{background:linear-gradient(135deg,rgba(16,185,129,0.16),rgba(6,182,212,0.14));border-color:rgba(16,185,129,0.28)}
.cap-group:nth-child(2) .cap-ico{background:linear-gradient(135deg,rgba(245,158,11,0.16),rgba(249,115,22,0.14));border-color:rgba(245,158,11,0.28)}
.cap-group:nth-child(3) .cap-ico{background:linear-gradient(135deg,rgba(139,92,246,0.16),rgba(217,70,239,0.14));border-color:rgba(139,92,246,0.28)}
.cap-group h4{font-size:17px;font-weight:700;letter-spacing:-0.01em}
.cap-group-sub{font-size:12px;color:var(--text-faint);margin-top:2px}
.cap-list{display:flex;flex-direction:column;gap:11px}
.cap-list li{
  font-size:14px;color:var(--text-dim);line-height:1.5;
  padding-left:22px;position:relative;
}
.cap-list li::before{
  content:'';position:absolute;left:2px;top:7px;
  width:6px;height:6px;border-radius:2px;background:var(--p2-grad);opacity:.85;
}
.cap-list li strong{color:#fff;font-weight:600}
.cap-note{
  margin-top:28px;text-align:center;font-size:13px;color:var(--text-faint);
}
.cap-note strong{color:var(--text-dim);font-weight:600}
@media (max-width:900px){.cap-groups{grid-template-columns:1fr}}

/* --- Nav: dar ekranda CTA kisalir --- */
.nav-inner{min-width:0}
.logo{min-width:0}
@media (max-width:620px){
  .nav-cta-long{display:none}
  .logo span:last-child{font-size:15px}
}
@media (max-width:380px){
  .nav-inner{padding-left:14px;padding-right:14px}
}

/* --- Durus / seffaflik seridi --- */
.honest{
  display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin-top:34px;
}
.honest span{
  font-size:12.5px;color:var(--text-dim);
  padding:8px 14px;border-radius:999px;
  background:rgba(255,255,255,0.03);border:1px solid var(--border);
  font-family:'JetBrains Mono',monospace;letter-spacing:-0.01em;
}
.honest span b{color:#fca5a5;font-weight:700}

/* --- Fiyat karti: cihaz sayisina gore canli hesap --- */
.price-calc{
  margin:-10px 0 20px;padding:11px 14px;border-radius:12px;
  background:rgba(16,185,129,0.07);border:1px solid rgba(16,185,129,0.22);
  font-size:12.5px;color:#a7f3d0;line-height:1.45;
}
.price-calc strong{color:#fff;font-family:'JetBrains Mono',monospace;font-weight:700}
.price-amount{flex-wrap:wrap}
.price-amount.yearly .num{font-size:40px}
.price-vat{font-size:12px;color:var(--text-faint);margin-left:2px}

/* --- ROI: tek urun rozeti --- */
.roi-assume{
  margin-top:14px;font-size:11.5px;color:var(--text-faint);line-height:1.5;
  padding-left:2px;
}
.roi-assume strong{color:var(--text-dim);font-weight:600}

/* --- Kurulum banneri (garanti kartinin tek urun hali) --- */
.guarantee-card h3{letter-spacing:-0.02em}

/* ============================================================
   DENETIM DUZELTMELERI (2026-08)
   Bu blok en sonda durur ki once tanimlanan kurallari ezebilsin.
   ============================================================ */

/* --- 1) YATAY TASMA ---------------------------------------------------
   .pricing::before 600px genisliginde dekoratif bir katman ve .pricing'de
   kirpma yoktu; 375px'te document 488px'e cikiyor, position:fixed olan .nav
   de 488px'e uzayip hamburger menuyu ekran disina itiyordu. */
.pricing{overflow:hidden}
.faq{overflow-x:clip}
/* body'de gercek tasmayi maskelemek yerine kirp (clip destekleyen tarayicida
   sticky/fixed davranisini bozmaz); hidden yalnizca eski tarayici yedegi. */
body{overflow-x:hidden;overflow-x:clip}

/* --- 2) URUN DETAY: mobilde metnin kesilmesi --------------------------
   .mock-srv-kanban'in min-content genisligi grid track'ini 383px'te
   kilitliyordu; minmax(0,1fr) + min-width:0 otomatik minimumu kirar. */
.mock-srv-kanban{grid-template-columns:repeat(3,minmax(0,1fr))}
.pd-content,.pd-mock{min-width:0}
.kan-card .ttl,.kan-card .id,.kan-card .meta{overflow-wrap:anywhere}
@media (max-width:900px){
  .pd-grid{grid-template-columns:minmax(0,1fr) !important}
  .mock-srv{padding:12px}
  .mock-srv-kanban{gap:6px}
  .kan-col{padding:7px}
  .kan-card{padding:7px}
}

/* --- 3) KONTRAST -----------------------------------------------------
   Eski --text-faint (#5a5a6a) --bg uzerinde 3.01:1 idi (WCAG AA 4.5 ister).
   #8a8a9a ~5.3:1 verir. Ayrica en kucuk metinler 12px'in altina inmesin. */
:root{--text-faint:#8a8a9a}
.roi-proj-axis{font-size:12px}
.price-vat,.price-tag,.price-note{font-size:12.5px}
.roi-assume{font-size:12px}
/* Karar metinleri 12px'in altina inmesin (mockup ici dekoratif mikro-yazilar haric) */
.roi-input-help,.roi-tick,.roi-disclaimer,.rp-meta,.roi-mini-label,
.roi-gauge-label,.roi-presets-label,.rp-eyebrow,.bento-eyebrow,
.step-emblem-label,.hero-toast-meta{font-size:12px}

/* --- 4) KLAVYE ODAGI (WCAG 2.4.7) ------------------------------------ */
a:focus-visible,
button:focus-visible,
input:focus-visible,
[tabindex]:focus-visible{
  outline:2px solid #5eead4;
  outline-offset:3px;
  border-radius:6px;
}
.roi-slider:focus-visible{
  outline:none;
  box-shadow:0 0 0 3px rgba(94,234,212,.65);
}

/* --- 5) DOKUNMA HEDEFLERI (WCAG 2.5.8) --------------------------------
   Gorsel track 6px kalir (background-clip:content-box), hedef ~34px olur. */
.roi-slider-wrap{padding:2px 0}
.roi-slider{
  padding:14px 0;
  height:34px;
  background-color:transparent;
  background-clip:content-box;
  border:none;
}
.menu-btn{width:44px;height:44px}
.footer-col a{display:inline-block;padding:8px 0}
.footer-bottom a{display:inline-block;padding:6px 0}

/* --- 6) HERO BASLIK DONDURUCU ----------------------------------------
   Gorunmez "spacer" kapsayiciyi EN UZUN kelimeye gore sabitler; tum kelimeler
   mutlak konumlu oldugu icin H1 her 2,8 saniyede yeniden akmaz. */
.hero-rotator{min-width:0}
.hero-rotator-spacer{visibility:hidden;pointer-events:none}
.hero-rotator-word,
.hero-rotator-word.active{position:absolute;left:0;right:0;top:0}
.sr-only{
  position:absolute;width:1px;height:1px;
  padding:0;margin:-1px;overflow:hidden;
  clip:rect(0 0 0 0);clip-path:inset(50%);white-space:nowrap;border:0;
}

/* --- 7) PROJEKSIYON GRAFIGI: HTML ustkatman ---------------------------
   preserveAspectRatio="none" yalnizca path'leri esnetir; nokta ve etiket
   burada, deformasyonsuz. */
.proj-dot{
  position:absolute;width:10px;height:10px;border-radius:50%;
  transform:translate(-50%,-50%);
  border:2px solid #050508;pointer-events:none;
}
.proj-dot-with{background:#10b981}
.proj-dot-without{width:8px;height:8px;background:#ef4444}
.proj-end-label{
  position:absolute;right:6px;
  padding:4px 10px;border-radius:6px;
  background:rgba(16,185,129,0.15);
  border:1px solid rgba(16,185,129,0.4);
  color:#34d399;
  font-family:'JetBrains Mono',monospace;font-size:12px;font-weight:700;
  pointer-events:none;white-space:nowrap;
  transition:top .35s var(--ease);
}
.rpl-note{
  flex-basis:100%;font-size:12px;color:var(--text-faint);line-height:1.5;
}

/* Madde ici <strong> ve kosul notlari ayri flex ogesi olup satiri bolmesin */
.price-features li{display:block}

/* --- 8) DURUSTLUK NOTLARI (kucuk kosul metinleri) --------------------- */
.feat-note,.cap-cond,.pd-cond,.trial-limit,.rp-label-note{
  font-size:12px;color:var(--text-faint);font-weight:500;
}
.pd-cond{display:block;margin-top:6px}
.bento-foot-note{
  margin-top:10px;font-size:12px;color:var(--text-faint);line-height:1.55;
}
.integ-star{font-size:9px;color:#5eead4;vertical-align:super}
.roi-presets-note{
  margin-top:10px;font-size:12px;color:var(--text-faint);line-height:1.55;
}
.roi-presets-note strong{color:var(--text-dim);font-weight:600}
.mock-sample-badge{
  margin-left:8px;flex-shrink:0;
  font-size:10px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
  padding:2px 7px;border-radius:5px;
  background:rgba(255,255,255,0.06);
  border:1px solid var(--border);
  color:var(--text-faint);
}
@media (max-width:520px){.mock-sample-badge{display:none}}

/* --- 9) BASLIK HIYERARSISI --------------------------------------------
   Bolum basliklari h2, kart basliklari h3 oldu; gorsel boyut burada kalir. */
.pd-feature h3{font-size:15px;font-weight:700;margin-bottom:6px;color:#fff}
.cap-group h3{font-size:17px;font-weight:700;letter-spacing:-0.01em}
.how-card h3{font-size:22px;font-weight:700;letter-spacing:-0.01em;margin-bottom:12px}
.bento h3{
  font-family:'Plus Jakarta Sans',sans-serif;
  font-size:20px;font-weight:800;letter-spacing:-0.02em;line-height:1.2;
  margin-bottom:8px;color:#fff;
}
.bento-mobile h3{font-size:28px}
.bento-integ h3{font-size:24px}
.footer-col h3{
  font-size:13px;font-weight:700;color:#fff;
  letter-spacing:0.05em;text-transform:uppercase;
  margin-bottom:8px;
}
/* Mockup icindeki "baslik"lar artik gercek baslik degil (dekoratif) */
.dash-topbar .mock-h{font-size:18px;font-weight:700;color:#fff;font-family:'Plus Jakarta Sans',sans-serif}
.mock-srv-head .mock-h{font-size:15px;font-weight:700;color:#fff;font-family:'Plus Jakarta Sans',sans-serif}
`;
const BODY = `

<!-- Scroll progress bar -->
<div class="scroll-progress" id="scrollProgress" aria-hidden="true"></div>

<!-- Global grain texture overlay -->
<div class="grain-overlay" aria-hidden="true"></div>

<!-- ========== NAVIGATION ========== -->
<nav class="nav" id="nav">
  <div class="nav-inner">
    <a href="#" class="logo">
      <span class="logo-mark"></span>
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

    <div class="honest reveal">
      <span><b>Yok:</b> e-Fatura / GİB entegrasyonu (Logo'ya aktarım var)</span>
      <span><b>Yok:</b> canlı teknisyen konumu / GPS takibi</span>
      <span><b>Yok:</b> müşterinin giriş yaptığı müşteri portalı</span>
      <span><b>Yok:</b> yapay zekâ özellikleri</span>
      <span><b>Yok:</b> App Store / Play'de ayrı mobil uygulama</span>
    </div>
    <p class="cap-note"><strong>Neden bunları da yazıyoruz?</strong> Çünkü demoda görmediğiniz bir şeyi satmak istemiyoruz.</p>
  </div>
</section>

<!-- ========== ORTAK GUC / BENTO ========== -->
<section class="common" id="ozellikler">
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
              <span class="logo-mark"></span>
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

<!-- ========== KAPANIS CTA ========== -->
<section class="cta-final">
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
        <a href="#" class="logo">
          <span class="logo-mark"></span>
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
`;

export default function Landing() {
  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
      <Script id="stk-landing" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JS }} />
    </>
  );
}
