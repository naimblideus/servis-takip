// ⚙️ OTOMATİK ÜRETİLDİ — elle düzenlemeyin! Kaynak: marketing/landing/nextus-servis.html
// Yeniden üret:  node marketing/landing/build-landing.js
export const LANDING_CSS = ` blogu yakalar. Bu dosyayi o betige
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
  /* İNİŞLİ HARF KIRPILMASI (g, ğ, y, p, ş, ç):
     background-clip:text gradyanı öğenin ARKA PLAN kutusuna boyar. Satır-içi bir
     öğede bu kutu yaklaşık font boyu kadardır ve taban çizgisinin altına taşan
     inişleri kapsamaz — "görünsün" kelimesinin g'si boyasız kalıp kesik görünüyordu.
     (Başlıklarda line-height 1.05 olduğu için pay hiç yok.)
     Satır-içi öğede DİKEY DOLGU satır yüksekliğini ve sarmayı etkilemez, yalnızca
     boyama alanını büyütür — bu yüzden inline-block'a çevirmek gerekmiyor
     (çevirseydik çok kelimeli ifadeler mobilde satır sonunda bölünemezdi). */
  padding-bottom:.20em;
  padding-top:.06em;
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
/* Marka işareti: gerçek logoyla aynı dil — KOYU zemin üzerinde GÜMÜŞ N.
   Önceki hâli (renkli gradyan kare + nokta) jenerikti ve marka videosundaki
   krom N ile hiç ilgisi yoktu. */
.logo-mark{
  width:32px;height:32px;border-radius:9px;
  background:linear-gradient(160deg,#161c28,#0a0e16);
  border:1px solid rgba(255,255,255,.10);
  position:relative;
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 4px 14px rgba(0,0,0,.45);
}
/* NEXTUS "N" monogramı — marka videosundaki logonun aynısı
   (kaynak: C:\\Projeler\\nexus-video/src/components/Monogram.tsx, viewBox 0 0 230 200).
   İki dikey bar + kalın diyagonal, içinden geçen swoosh kesiği.
   Kesik, arka plan renginde KALIN bir çizgiyle çiziliyor: küçük boyutta SVG mask'ten
   hem daha iyi okunuyor hem de id çakışması olmadan aynı işaret 3 yerde kullanılabiliyor. */
.logo-n{width:70%;height:70%;display:block;overflow:visible}
/* Gümüş: düz beyaz yerine hafif soğuk bir ton — krom hissi verir, koyu zeminde parlar */
.logo-n .nx-body{fill:#e6ecf5}
.logo-n .nx-cut{
  /* Kesik, işaretin ZEMİN rengiyle çiziliyor: harfin içinden geçen swoosh böyle oluşuyor */
  stroke:#0d121c;stroke-width:13;fill:none;stroke-linecap:round;
  stroke-dasharray:100;stroke-dashoffset:100;
  animation:nxSwoosh 7s cubic-bezier(.22,1,.36,1) infinite;
}
@keyframes nxSwoosh{
  0%   {stroke-dashoffset:100}
  18%  {stroke-dashoffset:0}    /* çizilir */
  82%  {stroke-dashoffset:0}    /* durur — asıl hâli bu */
  100% {stroke-dashoffset:-100} /* diğer uçtan sıyrılıp çıkar */
}
/* Hareket azaltma tercihi: kesik animasyonsuz, doğrudan yerinde dursun */
@media(prefers-reduced-motion:reduce){
  .logo-n .nx-cut{animation:none;stroke-dashoffset:0}
  .logo-mark{animation:none}
}
a.logo:hover .logo-mark{transform:translateY(-1px) scale(1.04)}
.logo-mark{transition:transform .25s cubic-bezier(.22,1,.36,1)}
.nav-links{display:flex;gap:6px;align-items:center}
.nav-link{
  padding:8px 14px;border-radius:8px;
  color:var(--text-dim);font-size:14px;font-weight:500;
  transition:all .2s var(--ease);
}
.nav-link:hover{color:#fff;background:rgba(255,255,255,0.05)}
.nav-cta{display:flex;gap:10px;align-items:center}
/* Dil secici: TR <-> EN. btn-ghost oldugu icin 900px altinda gizlenir;
   o genislikte mobil menudeki bagalanti devreye girer. */
.dil-sec{padding:10px 12px;font-weight:700;letter-spacing:.04em}
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
    linear-gradient(180deg,rgba(20,20,32,0.62),rgba(10,10,18,0.46));
  padding:80px 40px;
  /* Arkadaki fotokopi makinesi kartın içinden yumuşakça okunsun diye. Kart
     tamamen opakken bölüm fonu tamamen boşa gidiyordu (ekranda görüldü). */
  backdrop-filter:blur(10px) saturate(1.15);
  -webkit-backdrop-filter:blur(10px) saturate(1.15);
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
/* ---- Marka animasyonu — altbilgide, marka imzası olarak ----
   Videonun kendi zemini koyu; altbilgiyle aynı olduğu için çerçeve/arka plan yok,
   kutu gibi durmuyor. Küçük tutuluyor: satış içeriğiyle yarışmasın. */
.brand-clip-v{width:132px;height:132px;display:block;margin:0 0 10px;border-radius:18px;object-fit:cover}
@media(max-width:760px){.brand-clip-v{width:104px;height:104px;border-radius:14px}}
/* Hareket azaltma tercihi: hiç gösterilme (JS de yüklemiyor) */
@media(prefers-reduced-motion:reduce){.brand-clip-v{display:none}}

/* ---- Kurucu bölümü ---- */
.founder-sec{padding:60px 0 0}
.founder-card{max-width:860px;margin:0 auto;padding:34px;border-radius:22px;
  background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.08)}
.founder-head{display:flex;align-items:center;gap:16px;margin-bottom:20px}
.founder-ava{width:60px;height:60px;flex:0 0 60px;border-radius:16px;display:grid;place-items:center;
  font-weight:800;font-size:20px;letter-spacing:.5px;color:#0b1020;
  background:linear-gradient(135deg,#7c5cff,#22d3a7)}
.founder-name{font-size:21px;font-weight:800;margin:0;line-height:1.25}
.founder-role{font-size:13px;color:var(--muted);margin-top:3px}
.founder-lead{font-size:16.5px;line-height:1.75;color:rgba(255,255,255,.86);margin:0 0 24px}
.founder-lead strong{color:#fff}
.founder-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
.founder-item{padding:15px 16px;border-radius:14px;font-size:13.5px;line-height:1.6;color:var(--muted);
  background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06)}
.founder-item-t{display:block;color:#fff;font-weight:700;font-size:14px;margin-bottom:5px}
.founder-cta{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.founder-tel{font-size:14px;color:var(--muted);font-variant-numeric:tabular-nums}
@media(max-width:760px){
  .founder-card{padding:24px}
  .founder-grid{grid-template-columns:1fr}
  .founder-lead{font-size:15.5px}
}
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

/* ══════════════════════════════════════════════════════════════════════════
   HAREKET KATMANI — "premium" hissi buradan gelir
   ══════════════════════════════════════════════════════════════════════════
   İLKELER (hepsi bilinçli, hepsi ölçülebilir):
   · YALNIZ transform ve opacity animasyonlanır. width/top/left/filter
     animasyonu her karede yeniden yerleşim (layout) tetikler ve orta seviye
     Android'de kare düşürür — bizim ziyaretçimiz tam olarak o telefonda.
   · TEK bir requestAnimationFrame döngüsü var. Her efekt kendi scroll
     dinleyicisini kursaydı 8 dinleyici aynı karede çalışırdı.
   · KAYDIRMA ELE GEÇİRİLMEZ. Smooth-scroll kütüphanesi (Lenis vb.) siteyi
     "pahalı" hissettirir ama fiyat arayan bir bayinin tekerleğini elinden
     alır. Kaydırmaya BAĞLI efekt yapıyoruz, kaydırmayı DEVRALMIYORUZ.
   · İşaretçi efektleri yalnız gerçek fare olan cihazda (pointer:fine).
   · prefers-reduced-motion hepsini kapatır — süsleme değil, erişilebilirlik.
   ═══════════════════════════════════════════════════════════════════════ */

/* ----- 1. KAYDIRMA İLERLEME ÇUBUĞU ----- */
/* Uzun bir sayfada "ne kadar kaldı" sorusunu sessizce cevaplar. */
.scroll-progress{
  position:fixed;top:0;left:0;right:0;height:2px;z-index:1000;
  transform-origin:0 50%;transform:scaleX(0);
  background:linear-gradient(90deg,var(--p3-1,#14b8a6),var(--p3-2,#a855f7));
  will-change:transform;pointer-events:none;
}

/* ----- 2. NAV: AŞAĞI İNERKEN GİZLEN, YUKARI ÇIKARKEN GÖRÜN ----- */
/* Okurken ekranı geri verir; geri dönmek isteyince anında elinin altında. */
.nav{transition:transform .42s cubic-bezier(.16,1,.3,1),background-color .3s ease,backdrop-filter .3s ease}
.nav.nav-hidden{transform:translateY(-102%)}

/* ----- 3. BAŞLIKTA KELİME KELİME YÜKSELİŞ ----- */
/* Maske içinden çıkar, harflerin tepesi kesilmez. Yalnız BÖLÜM başlıklarında:
   kahramanın kendi fadeUp animasyonu var, oraya karışmıyoruz. */
.word-wrap{display:inline-block;overflow:hidden;vertical-align:bottom;padding-bottom:.06em;margin-bottom:-.06em}
html.js .word-wrap > .word{display:inline-block;transform:translateY(105%);opacity:0}
html.js .word-wrap.words-in > .word{
  transform:translateY(0);opacity:1;
  transition:transform .9s cubic-bezier(.16,1,.3,1) var(--wd,0s),
             opacity .6s ease var(--wd,0s);
}

/* ----- 4. KAYDIRMAYA BAĞLI DERİNLİK (PARALAKS) ----- */
/* Katmanlar farklı hızda kayar → sayfa düz bir yüzey olmaktan çıkar.
   Değer JS'ten --py olarak yazılır, CSS yalnız uygular. */
.par{transform:translate3d(0,var(--py,0px),0);will-change:transform}

/* ----- 5. MIKNATIS DÜĞME ----- */
/* İmleç yaklaşınca düğme hafifçe ona doğru kayar. Tıklanabilirliği artırır,
   çünkü hedef imlece gelir. Yalnız gerçek farede. */
@media (pointer:fine){
  .magnetic{transition:transform .35s cubic-bezier(.16,1,.3,1)}
  .magnetic.mag-active{transition:transform .12s linear}
}

/* ----- 6. KART IŞIK NOKTASI ----- */
/* İmlecin altında yumuşak bir aydınlanma. Kartın "cam" hissini güçlendirir. */
@media (pointer:fine){
  .spot{position:relative;isolation:isolate}
  .spot::before{
    content:'';position:absolute;inset:0;border-radius:inherit;pointer-events:none;
    opacity:0;transition:opacity .35s ease;z-index:0;
    background:radial-gradient(320px circle at var(--mx,50%) var(--my,50%),
      rgba(255,255,255,.07),transparent 65%);
  }
  .spot:hover::before{opacity:1}
}

/* ----- 7. ADIM İLERLEMESİ (Nasıl çalışır) ----- */
/* Kaydırdıkça o an okunan adım öne çıkar — okuyucu sırayı kaybetmez. */
.step-active{position:relative}
html.js .stepy{transition:opacity .5s ease,transform .5s cubic-bezier(.16,1,.3,1)}
html.js .stepy:not(.step-on){opacity:.42}
html.js .stepy.step-on{opacity:1;transform:translateY(-2px)}

/* ── HAREKET HASSASİYETİ: hepsini kapat ──────────────────────────────────
   Bu blok sadece "iyi niyet" değil — vestibüler rahatsızlığı olan biri için
   paralaks ve kayan başlık fiziksel rahatsızlık üretir. */
@media (prefers-reduced-motion:reduce){
  html.js .word-wrap > .word{opacity:1 !important;transform:none !important;transition:none !important}
  .par{transform:none !important}
  .scroll-progress{display:none}
  .nav.nav-hidden{transform:none}
  html.js .stepy:not(.step-on){opacity:1}
  html.js .stepy.step-on{transform:none}
  .magnetic{transform:none !important}
}

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

/* ═══════════════════════════════════════════════════════════════════════
   SADE / PREMIUM KATMANI
   ═══════════════════════════════════════════════════════════════════════
   Renk kiti AYNEN duruyor (--p1/--p2/--p3 değişkenleri silinmedi); değişen
   şey onların DEKORATİF kullanımı. Pahalı görünen arayüzlerin ortak yanı
   süs değil ölçü: tek vurgu rengi, çok boşluk, az hareket.

   Bu katman en sonda ve override olarak duruyor — geri almak istersen tek
   blok silinir, altındaki tasarım olduğu gibi geri gelir.
   ═══════════════════════════════════════════════════════════════════════ */

/* 1 ── TEK VURGU RENGİ.
   Üç ayrı gradyan (amber + teal + mor) aynı sayfada yarışıyordu. Teal zaten
   "ana renk" olarak işaretliydi; diğer ikisi vurgu olmaktan çıkıp nötrleşiyor. */
:root{
  --accent:#14b8a6;
  --accent-soft:rgba(20,184,166,0.14);
}

/* 2 ── GRADYAN YAZI YOK.
   Başlıkta gradyan, anlam taşımayan bir süs. Düz renk hem daha okunaklı
   hem daha pahalı duruyor. (İnişli harf dolgusuna da gerek kalmıyor —
   background-clip kalkınca kırpılma sorunu ortadan kalkar.) */
.gradient-text{
  background:none !important;
  -webkit-background-clip:initial !important;
  background-clip:initial !important;
  -webkit-text-fill-color:currentColor !important;
  color:var(--accent) !important;
  animation:none !important;
  padding-top:0 !important;
  padding-bottom:0 !important;
}

/* 2b ── DÖNEN KELİME DE DÜZ RENK.
   .gradient-text düz renge çevrilirken .hero-rotator-word ATLANMIŞTI; o hâlâ
   background-clip:text kullanıyordu ve aynı hatayı üretiyordu: gradyan öğenin
   arka plan kutusuna boyanır, taban çizgisinin ALTINA taşan inişleri (g, ğ, ü)
   kapsamaz — "görünsün" kelimesinin altı boyasız kalıp KESİK görünüyordu.
   Metin kırpılmıyordu; boyanmıyordu. Çözüm aynı: gradyanı kaldır. */
.hero-rotator-word{
  background:none !important;
  -webkit-background-clip:initial !important;
  background-clip:initial !important;
  -webkit-text-fill-color:currentColor !important;
  color:var(--accent) !important;
  animation:none !important;
}
/* Dönen kelime mutlak konumlu; kutusu inişleri kapsasın diye satır yüksekliği
   biraz açılıyor, aksi halde altındaki öğeye değer. */
.hero-rotator{line-height:1.25}
.hero-rotator-word{padding-bottom:.08em}

/* Dönen kelime BÖLÜNMEZ. Türkçe karşılıklar tek kelime ("görünsün"), bu
   yüzden sorun çıkmamıştı; İngilizcede iki kelime ("gets paid") ve dar
   ekranda ikiye sarıyordu — kelimeler mutlak konumlu olduğu için ikinci
   satır kutunun dışına taşıp bir sonraki kelimenin üstüne biniyordu.
   nowrap ile kutuya sığmazsa kelime tümden alt satıra iner, üst üste binmez. */
.hero-rotator-word,
.hero-rotator-spacer{white-space:nowrap}

/* 3 ── RENKLİ PARILTI YOK.
   Sıfır ofsetli renkli gölge, "AI yapımı arayüz" izlenimi veren en belirgin
   işaret. Yerine düz, nötr yükseklik. */
.hero-glow,.blob,.cta-mesh{display:none !important}
.btn-grad,.btn-primary,.lp-btn-primary,.price-card,.feature-card,.bento-card,
.founder-card,.cta-card,.logo-mark{box-shadow:none !important}
.btn-grad:hover,.btn-primary:hover{box-shadow:0 4px 16px rgba(0,0,0,0.4) !important}

/* 4 ── SÜREKLİ HAREKET YOK.
   Döngüsel gradyan akışı ve nabız dikkat çalıyor. Girişteki .reveal
   animasyonları ve logodaki tek seferlik swoosh KORUNUYOR — onlar
   bir kez olup biten, anlam taşıyan hareketler. */
.btn-pulse{animation:none !important}
[class*="grad"]:not(.btn-grad):not(.logo-mark){animation:none !important}

/* 5 ── VURGU BUTONU: gradyan yerine düz renk.
   Gradyan buton ucuz durur; düz renk + net kenar pahalı durur. */
.btn-grad,.lp-btn-primary{
  background:var(--accent) !important;
  color:#04121a !important;
  font-weight:700;
}
.btn-grad:hover,.lp-btn-primary:hover{background:#0d9488 !important}

/* 6 ── DAHA ÇOK BOŞLUK.
   Premium algısının en ucuz ve en etkili kaynağı. */
.section,.pad,section[class*="sec"]{padding-top:104px;padding-bottom:104px}
@media(max-width:760px){.section,.pad,section[class*="sec"]{padding-top:68px;padding-bottom:68px}}

/* 7 ── SAKİN KARTLAR: ince kenar, düz zemin, gradyan çerçeve yok. */
.price-card,.feature-card,.bento-card,.founder-card,.cta-card,.faq-item{
  background:rgba(255,255,255,0.022) !important;
  border:1px solid rgba(255,255,255,0.07) !important;
}
.price-card.featured,.price-card[data-plan="profesyonel"]{
  border-color:rgba(20,184,166,0.32) !important;
  background:rgba(20,184,166,0.04) !important;
}

/* 8 ── TİPOGRAFİ: daha az kalın, daha sıkı.
   Her yerde 800 kullanmak bağırmak gibi; ölçülü ağırlık daha güvenli durur. */
h1,.hero-title{letter-spacing:-0.03em;font-weight:700}
h2,.section-title,.cta-title{letter-spacing:-0.022em;font-weight:700}
.section-eyebrow{letter-spacing:0.14em;font-weight:600;color:var(--text-dim)}
.section-eyebrow .dot{background:var(--accent) !important}

/* ========== PATLATILMIS MAKINE — kaydirmaya bagli kare dizisi ========== */
/* Kaynak kareler ACIK GRI studyo zemininde, sayfa ise koyu. Ham goruntuyu
   koyultmak makinenin detayini da oldururdu; bunun yerine sahne bir ISIKLI
   PLATFORM gibi cerceveleniyor: hafif koyultma + kenarlardan sayfanin zeminine
   eriyen vinyet. Boylece acik dikdortgen yapistirilmis gibi durmaz. */
.patlatma{position:relative;background:var(--bg);border-top:1px solid var(--border)}
.patlatma-yol{position:relative;height:300vh}
.patlatma-sahne{position:sticky;top:0;height:100vh;overflow:hidden}
.patlatma-poster,.patlatma-tuval{position:absolute;inset:0;width:100%;height:100%;display:block}
.patlatma-poster{object-fit:cover;filter:saturate(1.05) contrast(1.04) brightness(.86)}
.patlatma-tuval{opacity:0;transition:opacity .26s cubic-bezier(.32,.72,0,1);
  filter:saturate(1.05) contrast(1.04) brightness(.86)}
.patlatma-tuval[data-hazir="1"]{opacity:1}
/* Vinyet — ayri katman, filtreden etkilenmez. Sol ustteki elips yalnizca
   basligin oturdugu koseyi karartir; bolumun tamamini karartmak parcalari
   soldururdu. */
.patlatma-sahne::before{content:"";position:absolute;inset:0;z-index:1;pointer-events:none;
  background:
    radial-gradient(68% 46% at 2% 0%, rgba(5,5,8,.97) 0%, rgba(5,5,8,.82) 34%, rgba(5,5,8,.4) 58%, rgba(5,5,8,0) 80%),
    radial-gradient(120% 88% at 50% 46%, rgba(5,5,8,0) 34%, rgba(5,5,8,.5) 74%, rgba(5,5,8,.94) 100%),
    linear-gradient(180deg, var(--bg) 0%, rgba(5,5,8,0) 16%, rgba(5,5,8,0) 78%, var(--bg) 100%)}
.patlatma-yazi{position:absolute;top:0;left:0;right:0;z-index:2;padding:104px 24px 0}
.patlatma-yazi .inner{max-width:1200px;margin:0 auto}
.patlatma-goz{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.16em;
  text-transform:uppercase;color:var(--p2-2)}
.patlatma-h{margin-top:12px;max-width:22ch;font-family:'Plus Jakarta Sans',Inter,sans-serif;
  font-weight:800;line-height:1.12;letter-spacing:-.02em;color:#fff;
  font-size:clamp(1.5rem,3.1vw,2.6rem)}
.patlatma-no{position:absolute;right:24px;bottom:24px;z-index:3;font-family:'JetBrains Mono',monospace;
  font-size:12px;letter-spacing:.22em;color:var(--text-faint);pointer-events:none}
@media (max-width:767px){
  .patlatma-yazi{padding-top:88px}
  .patlatma-yol{height:260vh}
}
/* Azaltilmis hareket: sticky yol kisalir, tek duragan kare gosterilir. */
@media (prefers-reduced-motion:reduce){
  .patlatma-yol{height:auto}
  .patlatma-sahne{position:relative;height:72svh}
}

/* ══════════ BÖLÜM FONLARI ══════════════════════════════════════════════════
   Dört bölüm artık fotoğraf (ikisi ayrıca video) zemin taşıyor. Sayfada ürün
   vardı ama müşterinin DÜNYASI yoktu: yazılımı görüyordun, servis aracını,
   teknisyeni, atölyeyi hiç görmüyordun.

   TEK SİSTEM: .fon katmanı bölümün en altına oturur, içerik üstünde kalır,
   kontrastı .fon::after perdesi taşır. Perde gücü bölüm bölüm ayarlanır —
   tek bir değer hepsine olmaz, çünkü "once" görselinde kağıtlar açık gri,
   diğerlerinde zemin neredeyse siyah.

   ÜST/ALT KENAR SAYFA ZEMİNİNE ERİR: perde 0% ve 100%'de tam opak --bg. Aksi
   halde görselin dikdörtgen kenarı ortaya çıkar ve bölüm "yapıştırılmış kutu"
   gibi durur. Frigora'da aynı sorun yaşandı, çözümü bu.

   AĞIRLIK: görseller loading="lazy" ile tarayıcının görüş-alanı kapısından
   geçiyor (hero hariç — o ekranın üstünde, eager). Videolar hiç indirilmiyor
   ta ki bölüme yaklaşılana kadar; mobilde ve hareket-azaltmada HİÇ inmiyor. */
.fon{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.fon picture{position:absolute;inset:0;display:block}
.fon img{width:100%;height:100%;object-fit:cover;display:block}
/* Video fotoğrafın ÜSTÜNE biner ve yumuşak açılır: indiği an sert geçiş olursa
   göz takılır. Açılmadan önce (ve hiç inmezse) altındaki fotoğraf görünür. */
.fon video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  display:block;opacity:0;transition:opacity 1.4s ease}
.fon video[data-acik="1"]{opacity:1}
.fon::after{content:"";position:absolute;inset:0;background:var(--perde);pointer-events:none}

/* İçerik fonun üstünde. overflow:hidden fonun bölüm dışına taşmasını keser. */
.common,.beforeafter,.cta-final{overflow:hidden}
.common>.container,.beforeafter>.container,.cta-final>.container{position:relative;z-index:1}

/* Perde güçleri — ÖLÇÜLEREK ayarlandı, göz kararı değil (aşağıdaki değerler
   metin/zemin kontrast ölçümünün sonucu). */
/* HERO FONU KALDIRILDI — ölçüldü, görünmüyordu.
   Hero 1529px yüksekliğinde ve object-fit:cover 1920x1072'lik görselin orta
   %53'ünü gösteriyor; servis aracı ise dikeyde %78'de, yani tarayıcı maketinin
   arkasına düşüyor. Perde .58'den .30'a indirildi, blob/ızgara/parıltı kısıldı,
   yine görünmedi. object-position da çözmez: sorun yatayda değil dikeyde.
   Ekranın ÜSTÜNDE olduğu için bedeli herkese biniyordu (106 KB AVIF, kritik
   yolda). Görünmeyen bir varlığı orada tutmanın savunması yok.
   Üretilen hero dosyaları da SİLİNDİ — kullanılmayan varlık depoda ve Docker
   imajında ölü ağırlık. Hero yeniden kurgulanırsa (ör. tarayıcı maketi aşağı
   alınırsa) fon-varliklari.mjs kaynaktan saniyeler içinde geri üretir; iş
   tanımı script'in ISLER listesinde duruyor. */
.fon-saha{--perde:linear-gradient(180deg,#050508 0%,rgba(5,5,8,.52) 22%,rgba(5,5,8,.52) 78%,#050508 100%)}
.fon-once{--perde:linear-gradient(180deg,#050508 0%,rgba(5,5,8,.90) 16%,rgba(5,5,8,.90) 84%,#050508 100%)}
.fon-kapanis{--perde:linear-gradient(180deg,#050508 0%,rgba(5,5,8,.42) 22%,rgba(5,5,8,.42) 78%,#050508 100%)}

`;
