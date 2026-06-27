import Script from "next/script";

// ⚙️ OTOMATİK ÜRETİLDİ — elle düzenleme! Kaynak: marketing/landing/index.html
// Yeniden üret:  node marketing/landing/build-landing.js
// JS bilerek string olarak tutulur (next/script ile çalışır) → tsc/eslint denetlemez,
// böylece "next build" TS hatasıyla kırılmaz.
const CSS = `
  :root{
    --indigo:#4F46E5; --indigo-2:#6366F1; --emerald:#10B981; --amber:#F59E0B;
    --bg:#0B1020; --bg-2:#0F1530; --card:#151B36; --card-2:#1B2247;
    --line:rgba(255,255,255,.08); --text:#E8ECF8; --muted:#9AA4C4; --muted-2:#8A93B8;
    --radius:18px; --maxw:1140px;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{font-family:'Inter',system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;overflow-x:hidden}
  h1,h2,h3,.brand{font-family:'Sora',sans-serif;letter-spacing:-.02em;line-height:1.1}
  a{color:inherit;text-decoration:none}
  .wrap{max-width:var(--maxw);margin:0 auto;padding:0 22px}
  section{position:relative}
  :focus-visible{outline:2px solid var(--indigo-2);outline-offset:2px;border-radius:6px}
  .skip{position:absolute;left:-9999px;top:0;z-index:100;background:var(--indigo);color:#fff;padding:10px 16px;border-radius:0 0 10px 0;font-weight:600}
  .skip:focus{left:0}
  .eyebrow{display:inline-block;font-size:.78rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--indigo-2);background:rgba(99,102,241,.12);border:1px solid rgba(99,102,241,.25);padding:6px 14px;border-radius:100px;margin-bottom:18px}
  .btn{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:.97rem;padding:13px 22px;border-radius:12px;border:1px solid transparent;cursor:pointer;transition:.2s;white-space:nowrap}
  .lp-btn-primary{background:linear-gradient(135deg,var(--indigo),var(--indigo-2));color:#fff;box-shadow:0 8px 24px rgba(79,70,229,.35)}
  .lp-btn-primary:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(79,70,229,.5)}
  .btn-ghost{background:rgba(255,255,255,.04);border-color:var(--line);color:var(--text)}
  .btn-ghost:hover{background:rgba(255,255,255,.09)}
  .muted{color:var(--muted)}
  .grad-text{background:linear-gradient(120deg,#fff,#A5B4FC 60%,#6EE7B7);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5;z-index:0;pointer-events:none}

  /* NAV */
  header{position:sticky;top:0;z-index:50;background:rgba(11,16,32,.72);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
  nav{display:flex;align-items:center;justify-content:space-between;height:66px}
  .brand{font-weight:800;font-size:1.3rem;display:flex;align-items:center;gap:9px}
  .brand .dot{width:11px;height:11px;border-radius:50%;background:linear-gradient(135deg,var(--indigo-2),var(--emerald));box-shadow:0 0 16px var(--indigo-2)}
  .nav-links{display:flex;gap:28px;align-items:center}
  .nav-links a{color:var(--muted);font-size:.93rem;font-weight:500}
  .nav-links a:hover{color:var(--text)}
  .nav-cta{display:flex;gap:10px;align-items:center}
  .nav-cta .login{color:var(--muted);font-weight:600;font-size:.93rem;padding:9px 6px}
  .burger{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:8px;background:none;border:0}
  .burger span{width:24px;height:2px;background:var(--text);border-radius:2px;transition:.3s;display:block}

  /* ANNOUNCE */
  .announce{background:linear-gradient(90deg,rgba(16,185,129,.12),rgba(79,70,229,.12));border-bottom:1px solid var(--line);font-size:.85rem;text-align:center;padding:8px 16px;color:var(--muted)}
  .announce b{color:var(--emerald)}

  /* HERO */
  .hero{padding:70px 0 40px;text-align:center;position:relative}
  .hero h1{font-size:clamp(2rem,5.2vw,4rem);font-weight:800;margin:0 auto 20px;max-width:880px}
  .hero p.sub{font-size:clamp(1.05rem,2.2vw,1.3rem);color:var(--muted);max-width:660px;margin:0 auto 30px}
  .hero-cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin-bottom:18px}
  .trust-line{font-size:.86rem;color:var(--muted);display:flex;gap:18px;justify-content:center;flex-wrap:wrap;align-items:center}
  .trust-line .check{color:var(--emerald)}

  /* HERO MOCKUP */
  .mock{margin:50px auto 0;max-width:960px;position:relative;z-index:2}
  .mock-frame{background:linear-gradient(180deg,var(--card),var(--bg-2));border:1px solid var(--line);border-radius:20px;overflow:hidden;box-shadow:0 40px 90px rgba(0,0,0,.55)}
  .mock-bar{display:flex;align-items:center;gap:7px;padding:13px 16px;border-bottom:1px solid var(--line);background:rgba(255,255,255,.02)}
  .mock-bar i{width:11px;height:11px;border-radius:50%;display:inline-block}
  .mock-bar .u{margin-left:14px;font-size:.78rem;color:var(--muted-2);background:rgba(255,255,255,.04);padding:4px 12px;border-radius:6px}
  .mock-bar .demo{margin-left:auto;font-size:.68rem;color:var(--muted-2);letter-spacing:.04em;text-transform:uppercase}
  .mock-body{display:grid;grid-template-columns:200px 1fr;min-height:340px}
  .mock-side{border-right:1px solid var(--line);padding:16px 12px;background:rgba(0,0,0,.15)}
  .mock-side .it{display:flex;align-items:center;gap:9px;padding:9px 11px;border-radius:9px;font-size:.85rem;color:var(--muted);margin-bottom:3px}
  .mock-side .it.active{background:rgba(99,102,241,.18);color:#fff}
  .mock-main{padding:20px}
  .mstat{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}
  .mstat .c{background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:13px}
  .mstat .c .l{font-size:.7rem;color:var(--muted-2);text-transform:uppercase;letter-spacing:.05em}
  .mstat .c .v{font-family:'Sora';font-weight:700;font-size:1.25rem;margin-top:5px}
  .mstat .c .v.g{color:var(--emerald)} .mstat .c .v.a{color:var(--amber)}
  .mchart{background:var(--card-2);border:1px solid var(--line);border-radius:12px;padding:16px;height:150px;display:flex;align-items:flex-end;gap:8px}
  .mchart .bar{flex:1;background:linear-gradient(180deg,var(--indigo-2),rgba(99,102,241,.25));border-radius:5px 5px 0 0;min-height:14%;transform-origin:bottom;animation:barGrow .9s cubic-bezier(.22,.61,.36,1) both}
  @keyframes barGrow{from{transform:scaleY(.04)}to{transform:scaleY(1)}}
  .mchart .bar:nth-child(2){animation-delay:.06s}.mchart .bar:nth-child(3){animation-delay:.12s}.mchart .bar:nth-child(4){animation-delay:.18s}.mchart .bar:nth-child(5){animation-delay:.24s}.mchart .bar:nth-child(6){animation-delay:.3s}.mchart .bar:nth-child(7){animation-delay:.36s}.mchart .bar:nth-child(8){animation-delay:.42s}
  .float{position:absolute;background:var(--card);border:1px solid var(--line);border-radius:13px;padding:11px 14px;display:flex;gap:10px;align-items:center;box-shadow:0 16px 40px rgba(0,0,0,.5);font-size:.85rem;z-index:3;animation:floaty 4.5s ease-in-out infinite}
  .float .ico{width:34px;height:34px;border-radius:9px;display:grid;place-items:center;font-size:1.05rem}
  .float.f1{top:54px;left:-26px} .float.f2{bottom:36px;right:-22px;animation-delay:-2.2s}
  .float small{display:block;color:var(--muted);font-size:.72rem}
  .float b{font-family:'Sora'}
  @keyframes floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}

  /* HERO ROTATOR */
  .hero-rotator{display:inline-grid;text-align:left;vertical-align:bottom}
  .hero-rotator>span{grid-area:1/1;opacity:0;transform:translateY(16px);transition:opacity .5s,transform .5s;background:linear-gradient(120deg,#A5B4FC,#6EE7B7);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;white-space:nowrap}
  .hero-rotator>span.on{opacity:1;transform:none}
  .hero-rotator>span.out{opacity:0;transform:translateY(-16px)}

  /* HERO STAT STRIP */
  .statstrip{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;max-width:780px;margin:30px auto 0;padding:20px;background:var(--card);border:1px solid var(--line);border-radius:var(--radius)}
  .statstrip .s{text-align:center}
  .statstrip .sv{font-family:'Sora';font-weight:800;font-size:clamp(1.4rem,3.4vw,1.95rem);line-height:1.05}
  .statstrip .sv.g{color:var(--emerald)} .statstrip .sv.a{color:var(--amber)}
  .statstrip .sl{font-size:.76rem;color:var(--muted);margin-top:5px;line-height:1.35}

  /* GENERIC SECTION HEAD */
  .shead{text-align:center;max-width:680px;margin:0 auto 50px}
  .shead h2{font-size:clamp(1.7rem,3.6vw,2.6rem);font-weight:700;margin-bottom:14px}
  .shead p{color:var(--muted);font-size:1.05rem}
  .pad{padding:80px 0}

  /* PROBLEM VS SOLUTION */
  .vs{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .vs .col{border-radius:var(--radius);padding:28px;border:1px solid var(--line)}
  .vs .bad{background:linear-gradient(180deg,rgba(245,158,11,.06),transparent)}
  .vs .good{background:linear-gradient(180deg,rgba(16,185,129,.07),transparent);border-color:rgba(16,185,129,.25)}
  .vs h3{font-size:1.2rem;margin-bottom:18px;display:flex;align-items:center;gap:10px}
  .vs ul{list-style:none}
  .vs li{display:flex;gap:11px;padding:9px 0;border-bottom:1px solid var(--line);font-size:.96rem;color:var(--muted)}
  .vs li:last-child{border:0}
  .vs .good li{color:var(--text)}
  .vs .x{color:var(--amber);font-weight:700} .vs .v{color:var(--emerald);font-weight:700}

  /* FEATURES */
  .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
  .fcard{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:26px;transition:.25s}
  .fcard:hover{transform:translateY(-4px);border-color:rgba(99,102,241,.4);background:var(--card-2)}
  .fcard .fi{width:48px;height:48px;border-radius:13px;display:grid;place-items:center;font-size:1.4rem;margin-bottom:16px;background:rgba(99,102,241,.14)}
  .fcard h3{font-size:1.12rem;margin-bottom:9px}
  .fcard p{color:var(--muted);font-size:.93rem}

  /* CALCULATOR */
  .calc{background:linear-gradient(135deg,rgba(79,70,229,.14),rgba(16,185,129,.08));border:1px solid rgba(99,102,241,.3);border-radius:24px;padding:40px;display:grid;grid-template-columns:1fr 1fr;gap:40px;align-items:center}
  .calc h2{font-size:clamp(1.5rem,3vw,2.2rem);margin-bottom:12px}
  .calc .field{margin-bottom:18px}
  .calc label{display:block;font-size:.88rem;color:var(--muted);margin-bottom:7px;font-weight:500}
  .calc label b{color:var(--text);font-family:'Sora'}
  .calc input[type=range]{width:100%;accent-color:var(--indigo-2)}
  .calc .rowv{display:flex;justify-content:space-between;font-size:.78rem;color:var(--muted-2)}
  .calc .result{background:var(--bg);border:1px solid var(--line);border-radius:18px;padding:30px;text-align:center}
  .calc .result .lbl{color:var(--muted);font-size:.9rem}
  .calc .result .big{font-family:'Sora';font-weight:800;font-size:clamp(2rem,5vw,3rem);color:var(--amber);margin:6px 0;line-height:1}
  .calc .result .yr{color:var(--emerald);font-weight:600;margin-bottom:14px}
  .calc .result .roi{font-size:.85rem;color:var(--muted);border-top:1px solid var(--line);padding-top:16px;margin-top:4px}
  .calc .lossbox{background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.32);border-radius:10px;padding:11px 13px;font-size:.84rem;margin:0 0 16px;color:var(--text);text-align:left}
  .calc .lossbox b{color:var(--amber)}
  .calc .lossbox .em{color:var(--emerald)}

  /* STEPS */
  .steps{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;counter-reset:s}
  .step{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:26px;position:relative}
  .step::before{counter-increment:s;content:counter(s);font-family:'Sora';font-weight:800;font-size:2.4rem;color:rgba(99,102,241,.35);position:absolute;top:14px;right:18px}
  .step h3{font-size:1.05rem;margin:8px 0 8px}
  .step p{color:var(--muted);font-size:.9rem}
  .step .si{font-size:1.6rem}

  /* GUARANTEE BAND */
  .scarband{display:grid;grid-template-columns:auto 1fr;gap:22px;align-items:center;background:linear-gradient(135deg,rgba(16,185,129,.1),rgba(79,70,229,.08));border:1px solid rgba(16,185,129,.3);border-radius:20px;padding:24px 28px;margin-bottom:34px}
  .scarband .shield{width:54px;height:54px;flex-shrink:0;animation:shieldFloat 3.4s ease-in-out infinite}
  @keyframes shieldFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
  .scarband h3{font-size:1.12rem;margin-bottom:4px}
  .scarband p{color:var(--muted);font-size:.9rem}

  /* PRICING */
  .toggle{display:flex;justify-content:center;align-items:center;gap:12px;margin-bottom:34px;font-size:.92rem}
  .switch{position:relative;width:52px;height:28px;background:var(--card-2);border:1px solid var(--line);border-radius:100px;cursor:pointer;transition:.2s}
  .switch.on{background:var(--emerald)}
  .switch .k{position:absolute;top:2px;left:2px;width:22px;height:22px;background:#fff;border-radius:50%;transition:.2s}
  .switch.on .k{left:26px}
  .save{color:var(--emerald);font-weight:600;font-size:.82rem;background:rgba(16,185,129,.12);padding:3px 10px;border-radius:100px}
  .plans{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:stretch}
  .plan{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:30px;display:flex;flex-direction:column}
  .plan.pop{border-color:var(--indigo-2);background:linear-gradient(180deg,rgba(99,102,241,.1),var(--card));box-shadow:0 20px 50px rgba(79,70,229,.2);position:relative}
  .plan .tag{position:absolute;top:-13px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,var(--indigo),var(--indigo-2));font-size:.74rem;font-weight:700;padding:5px 14px;border-radius:100px}
  .plan h3{font-size:1.15rem;margin-bottom:5px}
  .plan .who{color:var(--muted);font-size:.84rem;min-height:38px}
  .plan .price{font-family:'Sora';font-weight:800;font-size:2.3rem;margin:8px 0 2px}
  .plan .price small{font-size:.95rem;color:var(--muted);font-weight:500}
  .plan .pa{color:var(--muted);font-size:.8rem;min-height:18px;margin-bottom:18px}
  .plan ul{list-style:none;margin-bottom:24px;flex:1}
  .plan li{display:flex;gap:9px;padding:7px 0;font-size:.9rem;color:var(--muted)}
  .plan li .c{color:var(--emerald);flex-shrink:0}
  .plan .btn{width:100%;justify-content:center}

  /* FOUNDER */
  .founder{display:grid;grid-template-columns:120px 1fr;gap:28px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:24px;padding:36px}
  .founder .ava{width:120px;height:120px;border-radius:24px;background:linear-gradient(135deg,var(--indigo),var(--emerald));display:grid;place-items:center;font-family:'Sora';font-weight:800;font-size:2.6rem;color:#fff}
  .founder h3{font-size:1.3rem;margin-bottom:4px}
  .founder .role{color:var(--indigo-2);font-weight:600;font-size:.9rem;margin-bottom:14px}
  .founder p{color:var(--muted);font-size:1rem}
  .founder .socials{margin-top:16px;display:flex;gap:12px;flex-wrap:wrap}
  .founder .socials a{font-size:.85rem;color:var(--muted);border:1px solid var(--line);padding:7px 14px;border-radius:10px}
  .founder .socials a:hover{color:#fff;border-color:var(--indigo-2)}

  /* FAQ */
  .faq{max-width:760px;margin:0 auto}
  .qa{border:1px solid var(--line);border-radius:14px;margin-bottom:12px;background:var(--card);overflow:hidden}
  .qa summary{padding:18px 22px;cursor:pointer;font-weight:600;font-size:1rem;list-style:none;display:flex;justify-content:space-between;align-items:center}
  .qa summary::-webkit-details-marker{display:none}
  .qa summary::after{content:'+';font-size:1.4rem;color:var(--indigo-2);transition:.2s}
  .qa[open] summary::after{transform:rotate(45deg)}
  .qa .a{padding:0 22px 20px;color:var(--muted);font-size:.94rem}

  /* CTA / FORM */
  .final{background:linear-gradient(135deg,rgba(79,70,229,.2),rgba(16,185,129,.12));border:1px solid rgba(99,102,241,.3);border-radius:26px;padding:50px;text-align:center}
  .final h2{font-size:clamp(1.7rem,3.6vw,2.6rem);margin-bottom:14px}
  .final p{color:var(--muted);max-width:520px;margin:0 auto 26px}
  .lead-form{display:flex;gap:10px;max-width:520px;margin:0 auto;flex-wrap:wrap}
  .lead-form input{flex:1;min-width:180px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:14px 16px;color:var(--text);font-size:.95rem;font-family:inherit}
  .lead-form input:focus{outline:none;border-color:var(--indigo-2)}
  .lead-form input:focus-visible{outline:2px solid var(--indigo-2);outline-offset:1px}
  .form-alt{display:flex;gap:10px;justify-content:center;max-width:520px;margin:14px auto 0;flex-wrap:wrap}
  .form-alt .wa{flex:1;min-width:230px;justify-content:center;background:#25D366;color:#06311b;border-color:transparent}
  .form-alt .wa:hover{transform:translateY(-2px);box-shadow:0 12px 30px rgba(37,211,102,.35)}
  .form-note{font-size:.82rem;color:var(--muted);margin-top:14px}
  .ok-msg{display:none;color:var(--emerald);font-weight:600;margin-top:16px}

  /* STICKY MOBILE CTA */
  .mcta{position:fixed;left:0;right:0;bottom:0;z-index:60;display:none;gap:10px;padding:11px 14px calc(11px + env(safe-area-inset-bottom,0px));background:rgba(11,16,32,.92);backdrop-filter:blur(12px);border-top:1px solid var(--line);transform:translateY(110%);transition:transform .35s cubic-bezier(.22,.61,.36,1)}
  .mcta.show{transform:translateY(0)}
  .mcta a{flex:1;justify-content:center;font-size:.92rem;padding:12px 14px}
  .mcta .wa{background:#25D366;color:#06311b;flex:0 0 52px;min-width:52px;font-size:1.2rem}

  /* FOOTER */
  footer{border-top:1px solid var(--line);padding:40px 0;margin-top:80px;color:var(--muted-2);font-size:.86rem}
  .foot{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px}
  .foot a{color:var(--muted)}

  /* SCROLL-REVEAL (fail-open: JS çalışmazsa içerik GÖRÜNÜR kalır; gizleme yalnız .stk-anim ile — onu reveal JS ekler) */
  .reveal,.reveal-scale{transition:opacity .7s cubic-bezier(.22,.61,.36,1),transform .7s cubic-bezier(.22,.61,.36,1);will-change:opacity,transform}
  .stk-anim .reveal{opacity:0;transform:translateY(28px)}
  .stk-anim .reveal-scale{opacity:0;transform:scale(.94)}
  .reveal.in,.reveal-scale.in{opacity:1;transform:none}
  .reveal-stagger>*{transition:opacity .6s cubic-bezier(.22,.61,.36,1),transform .6s cubic-bezier(.22,.61,.36,1)}
  .stk-anim .reveal-stagger>*{opacity:0;transform:translateY(26px)}
  .reveal-stagger.in>*{opacity:1;transform:none}
  .reveal-stagger.in>*:nth-child(1){transition-delay:.04s}.reveal-stagger.in>*:nth-child(2){transition-delay:.1s}.reveal-stagger.in>*:nth-child(3){transition-delay:.16s}.reveal-stagger.in>*:nth-child(4){transition-delay:.22s}.reveal-stagger.in>*:nth-child(5){transition-delay:.28s}.reveal-stagger.in>*:nth-child(6){transition-delay:.34s}

  /* RESPONSIVE */
  @media(max-width:900px){
    .nav-links{display:none}
    .burger{display:flex}
    .nav-links.open{display:flex;position:absolute;top:66px;left:0;right:0;flex-direction:column;background:var(--bg-2);padding:20px;border-bottom:1px solid var(--line);gap:6px}
    .nav-links.open a{padding:10px 0}
    .vs,.grid,.steps,.plans,.calc,.founder{grid-template-columns:1fr}
    .calc{padding:28px}
    .founder{text-align:center;justify-items:center}
    .mock-body{grid-template-columns:1fr}.mock-side{display:none}
    .float{display:none}
    .mcta{display:flex}
    body{padding-bottom:calc(78px + env(safe-area-inset-bottom,0px))}
  }
  @media(max-width:620px){
    .statstrip{grid-template-columns:1fr 1fr;gap:18px 12px}
    .scarband{grid-template-columns:1fr;text-align:center}.scarband .shield{margin:0 auto}
  }
  @media(max-width:560px){
    .mstat{grid-template-columns:1fr 1fr}
    .final{padding:32px 22px}
  }
  @media (prefers-reduced-motion:reduce){
    .reveal,.reveal-scale,.reveal-stagger>*{opacity:1!important;transform:none!important;transition:none!important}
    .float,.scarband .shield,.mchart .bar{animation:none!important}
    .mchart .bar{transform:none}
    .hero-rotator>span{transition:none}.hero-rotator>span:first-child{opacity:1;transform:none}
    .mcta{transition:none}
    .qa summary::after{transition:none}
  }
`;
const BODY = `

<a href="#main" class="skip">İçeriğe geç</a>

<div class="announce">🚀 <b>Türkiye'nin kiralık cihaz servis yazılımı</b> — sayacı okur, faturayı keser · 14 gün ücretsiz, kart yok</div>

<header>
  <div class="wrap">
    <nav>
      <a href="#" class="brand"><span class="dot"></span> Servis Takip</a>
      <div class="nav-links" id="navlinks">
        <a href="#ozellikler">Özellikler</a>
        <a href="#nasil">Nasıl Çalışır</a>
        <a href="#hesapla">Kaçan Gelir</a>
        <a href="#fiyatlar">Fiyatlar</a>
        <a href="#kurucu">Kurucu</a>
      </div>
      <div class="nav-cta">
        <!-- /login app içinde doğru. Landing'i ayrı domaine taşırsan tam URL yaz (ör. https://app.servistakip.com/login) -->
        <a class="login" href="/login">Giriş Yap</a>
        <a class="btn lp-btn-primary" href="#basla">Ücretsiz Dene →</a>
      </div>
      <button class="burger" id="burger" aria-label="Menüyü aç/kapat" aria-expanded="false" aria-controls="navlinks"><span></span><span></span><span></span></button>
    </nav>
  </div>
</header>

<main id="main">

<!-- HERO -->
<section class="hero wrap">
  <div class="glow" style="width:520px;height:520px;background:var(--indigo);top:-120px;left:50%;transform:translateX(-50%)"></div>
  <span class="eyebrow">Kiralık cihaz servis yazılımı</span>
  <h1>Sayacı okur, faturayı keser,<br><span class="hero-rotator" id="hrot"><span class="on">kaçan geliri yakalar.</span><span>tahsilatı hızlandırır.</span><span>sahayı yönetir.</span><span>işi büyütür.</span></span></h1>
  <p class="sub">Fotokopi & yazıcı kiralama-servis bayileri için tek ekran: müşteri, cihaz, servis fişi, sayaç ve fatura — hepsi otomatik birleşir. Excel'de kaybolan geliri önüne koyar.</p>
  <div class="hero-cta">
    <a class="btn lp-btn-primary" href="#basla">14 Gün Ücretsiz Başla →</a>
    <a class="btn btn-ghost" href="#hesapla">▶ Kaçan gelirimi hesapla</a>
  </div>
  <div class="trust-line">
    <span><span class="check">✓</span> Kart gerekmez</span>
    <span><span class="check">✓</span> Excel'inizi biz aktarırız</span>
    <span><span class="check">✓</span> 1 günde kurulum</span>
    <span><span class="check">✓</span> Türkçe destek</span>
  </div>

  <!-- TRUST STAT STRIP (dürüst metrikler) -->
  <div class="statstrip">
    <div class="s"><div class="sv g" data-count data-target="12000" data-prefix="₺">₺12.000</div><div class="sl">bir bayide ilk ay yakalanan kesilmemiş fatura</div></div>
    <div class="s"><div class="sv" data-count data-target="14" data-suffix=" gün">14 gün</div><div class="sl">ücretsiz deneme · kart yok</div></div>
    <div class="s"><div class="sv" data-count data-target="1" data-suffix=" gün">1 gün</div><div class="sl">ortalama kurulum süresi</div></div>
    <div class="s"><div class="sv a" data-count data-target="100" data-prefix="%">%100</div><div class="sl">veriniz sizin · tek tıkla dışa aktarın</div></div>
  </div>

  <!-- MOCKUP (örnek ekran) -->
  <div class="mock">
    <div class="float f1"><div class="ico" style="background:rgba(16,185,129,.18)">🧾</div><div><b>Fatura otomatik kesildi</b><small>Kira + 4.280 sayfa + servis</small></div></div>
    <div class="float f2"><div class="ico" style="background:rgba(245,158,11,.18)">⚠️</div><div><b>₺12.450 kaçan gelir</b><small>3 okunmamış sayaç</small></div></div>
    <div class="mock-frame">
      <div class="mock-bar"><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i><span class="u">app.servistakip.com/panel</span><span class="demo">örnek ekran</span></div>
      <div class="mock-body">
        <div class="mock-side">
          <div class="it active">📊 Panel</div>
          <div class="it">👤 Müşteriler</div>
          <div class="it">🖨️ Cihazlar</div>
          <div class="it">🧾 Servis Fişleri</div>
          <div class="it">🔢 Sayaç Okuma</div>
          <div class="it">💸 Kaçan Gelir</div>
          <div class="it">🗺️ Rota</div>
        </div>
        <div class="mock-main">
          <div class="mstat">
            <div class="c"><div class="l">Bu ay tahsilat</div><div class="v g">₺184.500</div></div>
            <div class="c"><div class="l">Açık servis</div><div class="v">8</div></div>
            <div class="c"><div class="l">Kaçan gelir</div><div class="v a">₺12.450</div></div>
          </div>
          <div class="mchart">
            <div class="bar" style="height:40%"></div><div class="bar" style="height:62%"></div>
            <div class="bar" style="height:48%"></div><div class="bar" style="height:78%"></div>
            <div class="bar" style="height:58%"></div><div class="bar" style="height:90%"></div>
            <div class="bar" style="height:70%"></div><div class="bar" style="height:100%"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- PROBLEM VS SOLUTION -->
<section class="pad wrap" id="neden">
  <div class="shead reveal">
    <span class="eyebrow">Tanıdık geldi mi?</span>
    <h2>Manuel kaos &nbsp;→&nbsp; Servis Takip düzeni</h2>
    <p>Sayaç defterde, fatura Excel'de, servis WhatsApp'ta. Her ay biraz gelir kaçar, kimse fark etmez.</p>
  </div>
  <div class="vs reveal-stagger">
    <div class="col bad">
      <h3>😩 Bugün (Excel + defter + WhatsApp)</h3>
      <ul>
        <li><span class="x">✕</span> Sayaç okumayı unutunca o ay eksik faturalanıyor</li>
        <li><span class="x">✕</span> Kira, aşım ve servis ayrı ayrı, elle toplanıyor</li>
        <li><span class="x">✕</span> Hangi fatura ödendi, hangisi açık belirsiz</li>
        <li><span class="x">✕</span> Teknisyen sahada, ofis ne yaptığını görmüyor</li>
        <li><span class="x">✕</span> Stok/parça nerede, hangi cihaza takıldı bilinmiyor</li>
        <li><span class="x">✕</span> Geçmiş yok — "geçen yıl bu cihaza ne oldu?" cevapsız</li>
      </ul>
    </div>
    <div class="col good">
      <h3>🚀 Servis Takip ile</h3>
      <ul>
        <li><span class="v">✓</span> Her okunan sayaç anında faturaya dönüşür</li>
        <li><span class="v">✓</span> Kira + aşım + servis tek faturada otomatik birleşir</li>
        <li><span class="v">✓</span> FIFO tahsilat: hangi fatura açık, ne kadar borç — net</li>
        <li><span class="v">✓</span> Saha rotası + QR arıza bildirimi, ofis canlı görür</li>
        <li><span class="v">✓</span> Barkodlu stok: parça okut, fişe ekle, stoktan düş</li>
        <li><span class="v">✓</span> Kaçan Gelir paneli: masada duran parayı gösterir</li>
      </ul>
    </div>
  </div>
</section>

<!-- FEATURES -->
<section class="pad wrap" id="ozellikler">
  <div class="shead reveal">
    <span class="eyebrow">Özellikler</span>
    <h2>Servis işinin tamamı, tek sistemde</h2>
    <p>Müşteri → Cihaz → Servis Fişi → Sayaç → Fatura → Tahsilat. Hepsi birbirine bağlı, hiçbiri kaybolmaz.</p>
  </div>
  <div class="grid reveal-stagger">
    <div class="fcard"><div class="fi">🧾</div><h3>Otomatik Birleşik Fatura</h3><p>Sayaç deltası × birim fiyat, kademeli aşım, aylık kira, servis parçası ve işçilik — ay sonu tek faturada kendi birleşir.</p></div>
    <div class="fcard"><div class="fi">💸</div><h3>Kaçan Gelir Paneli</h3><p>Okunmamış sayaç, kesilmemiş kira, ödenmemiş fatura tek ekranda: "şu an masada ne kadar para duruyor?"</p></div>
    <div class="fcard"><div class="fi">🔢</div><h3>Sayaç-Kira Yönetimi</h3><p>Mono/renkli ayrı sayaç, dahil sayfa + aşım kademesi, kiralık cihaz takibi. Fotokopi işinin tam mantığı yerleşik.</p></div>
    <div class="fcard"><div class="fi">🗺️</div><h3>Saha & Rota + QR Arıza</h3><p>Günün rotası çok-duraklı haritada. Cihazdaki QR ile müşteri arıza bildirir, teknisyen telefondan görür.</p></div>
    <div class="fcard"><div class="fi">📦</div><h3>Barkod & Stok</h3><p>USB barkod okuyucu (LS2208) ile parça okut → fişe ekle, stoktan düş. Code 128 etiket bas, kapalı döngü.</p></div>
    <div class="fcard"><div class="fi">💬</div><h3>WhatsApp & Tahsilat</h3><p>Fatura/makbuz/vade hatırlatmasını WhatsApp'tan gönder. FIFO tahsilat, cari ekstre, premium PDF çıktı.</p></div>
  </div>
</section>

<!-- CALCULATOR -->
<section class="pad wrap" id="hesapla">
  <div class="calc reveal-scale">
    <div>
      <span class="eyebrow">Ücretsiz hesap</span>
      <h2>Her ay ne kadar gelir kaçırıyorsun?</h2>
      <p class="muted" style="margin-bottom:24px">Kaydırıcıları kendi işine göre ayarla. Tahminimize göre kiralık cihaz gelirinin <b style="color:var(--amber)">%6–10'u</b> okunmamış sayaç ve unutulan fatura yüzünden kaçar.</p>
      <div class="field">
        <label>Kiralık cihaz sayısı: <b id="vN">120</b></label>
        <input type="range" id="rN" min="10" max="600" value="120" step="5" aria-label="Kiralık cihaz sayısı">
        <div class="rowv"><span>10</span><span>600</span></div>
      </div>
      <div class="field">
        <label>Cihaz başına aylık ortalama fatura (kira+sayaç): <b id="vA">₺650</b></label>
        <input type="range" id="rA" min="200" max="3000" value="650" step="50" aria-label="Cihaz başına aylık ortalama fatura">
        <div class="rowv"><span>₺200</span><span>₺3.000</span></div>
      </div>
      <div class="field">
        <label>Tahmini kaçırma oranı: <b id="vR">%8</b></label>
        <input type="range" id="rR" min="2" max="20" value="8" step="1" aria-label="Tahmini kaçırma oranı yüzde">
        <div class="rowv"><span>%2</span><span>%20</span></div>
      </div>
    </div>
    <div class="result">
      <div class="lbl">Tahmini aylık kaçan gelir</div>
      <div class="big" id="outM">₺6.240</div>
      <div class="yr" id="outY">yılda ≈ ₺74.880</div>
      <div class="lossbox">⚠️ Bu para zaten <b>sizin</b> — sadece faturalanmadığı için cebinizde değil. Servis Takip aylık ücretini <span class="em">ilk haftada</span> çıkarır.</div>
      <a class="btn lp-btn-primary" href="#basla" style="width:100%;justify-content:center">Bu parayı yakalamaya başla →</a>
      <div class="roi" id="roi">Aylık ₺599 ödeyip yıllık kaçağı yakalamak — net kazanç hesaplanıyor…</div>
    </div>
  </div>
</section>

<!-- STEPS -->
<section class="pad wrap" id="nasil">
  <div class="shead reveal">
    <span class="eyebrow">Nasıl çalışır</span>
    <h2>İlk gününde uçtan uca</h2>
    <p>Kurulum bir gün. İlk faturanı kestiğin an "keşke daha önce başlasaydık" diyeceksin.</p>
  </div>
  <div class="steps reveal-stagger">
    <div class="step"><div class="si">👤</div><h3>1) Müşteri & cihaz ekle</h3><p>Excel'ini biz aktarırız. Kiralık cihaza kira + sayaç birim fiyatını gir.</p></div>
    <div class="step"><div class="si">🔧</div><h3>2) Servis & sayaç gir</h3><p>Fiş aç, parça okut. Sayaç oku — sistem deltayı ve aşımı kendi hesaplar.</p></div>
    <div class="step"><div class="si">🧾</div><h3>3) Fatura otomatik çıksın</h3><p>Ay sonu kira + aşım + servis tek faturada birleşir. PDF/WhatsApp ile gönder.</p></div>
    <div class="step"><div class="si">💸</div><h3>4) Kaçan geliri yakala</h3><p>Tahsilatı takip et, açık fatura ve okunmamış sayacı panelden gör.</p></div>
  </div>
</section>

<!-- OBJECTION KILLER -->
<section class="pad wrap">
  <div class="shead reveal"><span class="eyebrow">Çekinmeyin</span><h2>"Bizde zaten var" diyorsanız okuyun</h2></div>
  <div class="grid reveal-stagger">
    <div class="fcard"><div class="fi">📊</div><h3>"Excel yetiyor"</h3><p>Excel sayaç okumayı hatırlatmaz, aşımı kendi hesaplamaz, kesilmemiş faturayı söylemez. Kaçan gelir tam da Excel'in <b style="color:var(--text)">göstermediği</b> yerde. 14 gün dene, kendi gözünle gör.</p></div>
    <div class="fcard"><div class="fi">🧮</div><h3>"Logo'm var"</h3><p>Logo muhasebeyi tutar; sayaç-kira ve saha servisini bilmez. Servis Takip servisi yönetir, faturayı üretir, <b style="color:var(--text)">veriyi Logo'ya akıtır.</b> Rakip değil, Logo'nuzu besler.</p></div>
    <div class="fcard"><div class="fi">🔒</div><h3>"Ya verim takılı kalırsa?"</h3><p>Verileriniz <b style="color:var(--text)">her zaman sizindir.</b> Tek tıkla Excel/PDF dışa aktarın. Girmesi kolay, <b style="color:var(--text)">çıkması da kolay.</b> İlk kurulumu da biz yaparız, siz hazıra oturursunuz.</p></div>
  </div>
</section>

<!-- PRICING -->
<section class="pad wrap" id="fiyatlar">
  <div class="shead reveal">
    <span class="eyebrow">Fiyatlar</span>
    <h2>Net fiyat, gizli ücret yok</h2>
    <p>14 gün ücretsiz dene, kart isteme. İstediğin zaman iptal et.</p>
  </div>
  <div class="scarband reveal-scale">
    <svg class="shield" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.4 8.5-8 11-4.6-2.5-8-6-8-11V5l8-3z" fill="rgba(16,185,129,.15)" stroke="var(--emerald)" stroke-width="1.5"/><path d="M8.5 12l2.5 2.5 4.5-5" stroke="var(--emerald)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <div>
      <h3>Kuruluş dönemi: İlk 50 bayiye kurulum + Excel aktarımı <span style="color:var(--emerald)">ücretsiz</span></h3>
      <p>14 gün ücretsiz dene, kart yok. Beğenmezseniz hiçbir şey ödemezsiniz — veriniz her zaman sizinle.</p>
    </div>
  </div>
  <div class="toggle">
    <span>Aylık</span>
    <div class="switch" id="sw" role="switch" tabindex="0" aria-checked="false" aria-label="Yıllık faturalandırmaya geç"><div class="k"></div></div>
    <span>Yıllık</span>
    <span class="save">2 ay bedava</span>
  </div>
  <div class="plans reveal-stagger">
    <div class="plan">
      <h3>Başlangıç</h3>
      <div class="who">Yeni başlayan, az cihazlı bayi</div>
      <div class="price" data-m="299" data-y="2990">₺299<small>/ay</small></div>
      <div class="pa" data-pa>aylık faturalandırılır</div>
      <ul>
        <li><span class="c">✓</span> Müşteri, cihaz, servis fişi</li>
        <li><span class="c">✓</span> Stok + barkod (LS2208)</li>
        <li><span class="c">✓</span> Muhasebe / cari hesap</li>
        <li><span class="c">✓</span> 3 kullanıcı · 200 fiş/ay</li>
      </ul>
      <a class="btn btn-ghost" href="#basla">Başla</a>
    </div>
    <div class="plan pop">
      <div class="tag">EN POPÜLER</div>
      <h3>Profesyonel</h3>
      <div class="who">Çoğu bayi için ideal</div>
      <div class="price" data-m="599" data-y="5990">₺599<small>/ay</small></div>
      <div class="pa" data-pa>aylık faturalandırılır</div>
      <ul>
        <li><span class="c">✓</span> Başlangıç'taki her şey</li>
        <li><span class="c">✓</span> Otomatik birleşik faturalama</li>
        <li><span class="c">✓</span> Rota & saha yönetimi</li>
        <li><span class="c">✓</span> Geç sayaç takibi</li>
        <li><span class="c">✓</span> 10 kullanıcı · sınırsız fiş</li>
      </ul>
      <a class="btn lp-btn-primary" href="#basla">14 Gün Ücretsiz</a>
    </div>
    <div class="plan">
      <h3>Kurumsal</h3>
      <div class="who">Çok şubeli / büyük filo</div>
      <div class="price" data-m="1499" data-y="14990">₺1.499<small>/ay</small></div>
      <div class="pa" data-pa>aylık faturalandırılır</div>
      <ul>
        <li><span class="c">✓</span> Profesyonel'deki her şey</li>
        <li><span class="c">✓</span> Kaçan Gelir paneli</li>
        <li><span class="c">✓</span> Gelişmiş raporlar</li>
        <li><span class="c">✓</span> Bayiler arası parça alışverişi</li>
        <li><span class="c">✓</span> 50 kullanıcı · öncelikli destek</li>
      </ul>
      <a class="btn btn-ghost" href="#basla">İletişime geç</a>
    </div>
  </div>
  <p style="text-align:center;color:var(--muted);font-size:.85rem;margin-top:24px">💡 Logo entegrasyonu mevcut · e-Faturaya hazır · veriniz size ait, istediğiniz an dışa aktarın</p>
</section>

<!-- TESTIMONIAL -->
<section class="pad wrap">
  <div class="reveal" style="background:var(--card);border:1px solid var(--line);border-radius:24px;padding:44px;text-align:center;max-width:820px;margin:0 auto">
    <div style="font-size:2.4rem;margin-bottom:10px" aria-hidden="true">★★★★★</div>
    <p style="font-family:'Sora';font-size:clamp(1.2rem,2.6vw,1.6rem);line-height:1.4;margin-bottom:22px">"Sayaç okumalarını sisteme aldığımız ilk ay <span style="color:var(--emerald)">kesilmemiş ₺12.000 fatura</span> çıktı. Eskiden bunu hiç fark etmiyorduk."</p>
    <div class="muted">— Saha servis bayisi, Kütahya · <b style="color:var(--text)">200+ kiralık cihaz</b></div>
  </div>
</section>

<!-- FOUNDER / PERSONAL BRANDING -->
<section class="pad wrap" id="kurucu">
  <div class="founder reveal">
    <div class="ava" aria-hidden="true">MN</div>
    <div>
      <h3>Mehmet Naim Çetin</h3>
      <div class="role">Kurucu · Yazılım Mühendisi</div>
      <p>"Bir fotokopi bayisinin sayaç okumayı kaçırdığı için her ay binlerce lira eksik faturaladığını gördüm. Buna dayanamadım — çözümünü sahada, bayinin yanında oturup yazdım. Servis Takip masa başında değil, gerçek bir işin içinde doğdu. Sorun yaşayan kim varsa, doğrudan bana yazabilir."</p>
      <div class="socials">
        <!-- DEĞİŞTİR: gerçek profil linkleri (yoksa o anchor'ı sil) -->
        <a href="#" target="_blank" rel="noopener">in/ LinkedIn</a>
        <a href="#" target="_blank" rel="noopener">@ Instagram</a>
        <a data-wa data-wa-text="Merhaba Mehmet Bey, Servis Takip hakkında size yazıyorum">💬 Doğrudan bana yaz</a>
      </div>
    </div>
  </div>
</section>

<!-- FAQ -->
<section class="pad wrap">
  <div class="shead reveal"><span class="eyebrow">SSS</span><h2>Aklındaki sorular</h2></div>
  <div class="faq reveal">
    <details class="qa"><summary>Verilerimi taşımak zor mu?</summary><div class="a">Hayır. Excel müşteri/cihaz listenizi bizim için bir paylaşman yeterli — kurulumda biz aktarıyoruz. İlk 50 bayiye veri aktarımı ve kurulum ücretsiz.</div></details>
    <details class="qa"><summary>Logo / muhasebe programım var, yine de gerekir mi?</summary><div class="a">Evet, çünkü Logo sayaç-kira mantığını ve saha servisini bilmez. Servis Takip servis tarafını yönetir, faturayı otomatik üretir ve verisini Logo'ya akıtır — rakip değil, tamamlayıcıdır.</div></details>
    <details class="qa"><summary>Barkod okuyucu / özel cihaz gerekir mi?</summary><div class="a">Sıradan bir USB barkod okuyucu (ör. LS2208) klavye gibi takılır, sürücü gerekmez. Telefon kamerası QR arıza bildirimi için yeterli. Özel donanım şart değil.</div></details>
    <details class="qa"><summary>Kaç günde kurulur?</summary><div class="a">Genellikle 1 gün. Aynı gün ilk müşteri/cihazını ekleyip ilk faturanı kesebilirsin.</div></details>
    <details class="qa"><summary>Taahhüt var mı, iptal edebilir miyim?</summary><div class="a">Taahhüt yok. Aylık ödersin, istediğin an iptal edersin. Yıllık ödersen 2 ay bedava kazanırsın. Verilerini her zaman dışa aktarabilirsin.</div></details>
    <details class="qa"><summary>Birden fazla şube / teknisyen olur mu?</summary><div class="a">Olur. Planına göre 3–50 kullanıcı, rol bazlı yetki, çok şubeli kullanım desteklenir.</div></details>
  </div>
</section>

</main>

<!-- FINAL CTA + LEAD FORM -->
<section class="pad wrap" id="basla">
  <div class="final reveal-scale">
    <span class="eyebrow">Hadi başlayalım</span>
    <h2>İlk faturanı bugün otomatik kes</h2>
    <p>Bilgini bırak, 1 iş günü içinde demo hesabını açıp Excel'ini aktaralım. Kart yok, taahhüt yok.</p>
    <form class="lead-form" id="leadForm">
      <input type="text" name="firma" placeholder="Firma adı" aria-label="Firma adı" required />
      <input type="text" name="ad" placeholder="Adın" aria-label="Adınız" required />
      <input type="tel" name="telefon" placeholder="Telefon / WhatsApp" aria-label="Telefon veya WhatsApp numaranız" inputmode="tel" required />
      <input type="hidden" name="utm_source" id="utm_source" />
      <input type="hidden" name="utm_campaign" id="utm_campaign" />
      <button type="submit" class="btn lp-btn-primary">Ücretsiz Başla →</button>
    </form>
    <div class="form-alt">
      <a class="btn wa" data-wa data-wa-text="Merhaba, Servis Takip demosu istiyorum">💬 Formla uğraşma — WhatsApp'tan 2 dakikada demo iste</a>
    </div>
    <div class="form-note">📱 Formu doldur ya da WhatsApp butonuna bas — 2 dakikada demo, hemen yanıt.</div>
    <div class="ok-msg" id="okMsg">✓ Teşekkürler! WhatsApp penceresi açıldıysa mesajı gönder; açılmadıysa en geç 1 iş günü içinde sana ulaşacağız.</div>
  </div>
</section>

<footer>
  <div class="wrap foot">
    <div><span class="brand" style="font-size:1.1rem"><span class="dot"></span> Servis Takip</span><div style="margin-top:8px">Kiralık cihaz servis & sayaç-kira yönetimi</div></div>
    <div style="display:flex;gap:22px;flex-wrap:wrap">
      <a href="#ozellikler">Özellikler</a>
      <a href="#fiyatlar">Fiyatlar</a>
      <a href="#hesapla">Kaçan Gelir</a>
      <a href="#basla">İletişim</a>
    </div>
    <div>© 2026 Servis Takip · Tüm hakları saklıdır</div>
  </div>
</footer>

<!-- MOBİL STICKY CTA -->
<div class="mcta" id="mcta">
  <a class="btn lp-btn-primary" href="#basla">14 Gün Ücretsiz →</a>
  <a class="btn wa" data-wa data-wa-text="Merhaba, Servis Takip demosu istiyorum" aria-label="WhatsApp ile demo iste">💬</a>
</div>

`;
const JS = `
  // ⬇️ DEĞİŞTİR: kendi WhatsApp numaran (ülke kodu+numara, + ve 0 OLMADAN). Örn: 905551234567
  // Tüm WhatsApp linkleri (form, kurucu, mobil bar) bu tek değişkenden beslenir.
  var STK_WHATSAPP='905551234567';

  // Mobil menü (erişilebilir: button + aria-expanded)
  var burger=document.getElementById('burger'), nav=document.getElementById('navlinks');
  burger.addEventListener('click',function(){
    var open=nav.classList.toggle('open');
    burger.setAttribute('aria-expanded', open?'true':'false');
  });
  nav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){nav.classList.remove('open');burger.setAttribute('aria-expanded','false');});});

  // Kaçan gelir hesaplayıcı (kapanış aracı: dinamik CTA + net kâr + kaybı forma taşı)
  var rN=document.getElementById('rN'),rA=document.getElementById('rA'),rR=document.getElementById('rR');
  var vN=document.getElementById('vN'),vA=document.getElementById('vA'),vR=document.getElementById('vR');
  var outM=document.getElementById('outM'),outY=document.getElementById('outY'),roi=document.getElementById('roi');
  function fmt(n){return '₺'+Math.round(n).toLocaleString('tr-TR');}
  function calc(){
    var N=+rN.value,A=+rA.value,R=+rR.value;
    vN.textContent=N; vA.textContent=fmt(A); vR.textContent='%'+R;
    var m=N*A*(R/100);
    outM.textContent=fmt(m); outY.textContent='yılda ≈ '+fmt(m*12);
    window.__yillikKayip=fmt(m*12);
    var btnCalc=document.querySelector('.calc .result .lp-btn-primary');
    if(btnCalc) btnCalc.textContent=fmt(m*12)+"'yi yakalamaya başla →";
    var proEl=document.querySelector('.plan.pop .price');
    var pro=proEl?(+proEl.dataset.m||599):599;
    var net=Math.round(m-pro);
    roi.innerHTML = net>0
      ? 'Aylık ₺'+pro.toLocaleString('tr-TR')+' ödeyip ayda <b style="color:var(--emerald)">'+fmt(m)+'</b> kurtarmak. Net kazanç ≈ <b style="color:var(--emerald)">'+fmt(net)+'/ay</b>'
      : 'Servis Takip Profesyonel — kaçağınızı görünür kılar.';
  }
  [rN,rA,rR].forEach(function(el){el.addEventListener('input',calc);}); calc();

  // Fiyat aylık/yıllık geçişi (tek innerHTML; klavye + aria)
  var sw=document.getElementById('sw');
  function setYearly(yearly){
    sw.classList.toggle('on', yearly);
    sw.setAttribute('aria-checked', yearly?'true':'false');
    document.querySelectorAll('.plan .price').forEach(function(p){
      var val=yearly?p.dataset.y:p.dataset.m;
      p.innerHTML='₺'+(+val).toLocaleString('tr-TR')+'<small>/'+(yearly?'yıl':'ay')+'</small>';
    });
    document.querySelectorAll('[data-pa]').forEach(function(e){e.textContent=yearly?'yıllık — 2 ay bedava':'aylık faturalandırılır';});
  }
  sw.addEventListener('click',function(){setYearly(!sw.classList.contains('on'));});
  sw.addEventListener('keydown',function(e){ if(e.key==='Enter'||e.key===' '){e.preventDefault(); setYearly(!sw.classList.contains('on'));} });

  // UTM yakala (reklam kaynağını forma taşı)
  var q=new URLSearchParams(location.search);
  document.getElementById('utm_source').value=q.get('utm_source')||'direct';
  document.getElementById('utm_campaign').value=q.get('utm_campaign')||'';

  // Lead formu -> WhatsApp (sıfır-backend; popup engellenirse tıklanabilir link gösterilir, lead kaybolmaz)
  document.getElementById('leadForm').addEventListener('submit',function(e){
    e.preventDefault();
    var f=this;
    var text='Merhaba, Servis Takip denemek istiyorum.\\n'
      +'Firma: '+(f.firma.value||'-')+'\\n'
      +'Ad: '+(f.ad.value||'-')+'\\n'
      +'Telefon: '+(f.telefon.value||'-')
      +(window.__yillikKayip ? '\\nHesapladığım yıllık kayıp: '+window.__yillikKayip : '')
      +(f.utm_source.value&&f.utm_source.value!=='direct' ? '\\nKaynak: '+f.utm_source.value : '');
    var url='https://wa.me/'+STK_WHATSAPP+'?text='+encodeURIComponent(text);
    var w=window.open(url,'_blank','noopener');
    var ok=document.getElementById('okMsg');
    if(w){ f.style.display='none'; ok.style.display='block'; }
    else { ok.innerHTML='✓ Son adım: <a href="'+url+'" target="_blank" rel="noopener" style="color:var(--emerald);text-decoration:underline">WhatsApp\\'tan mesajı gönder →</a>'; ok.style.display='block'; }
  });

  // data-wa linklerini tek WhatsApp numarasından doldur
  (function(){
    if(typeof STK_WHATSAPP==='undefined') return;
    document.querySelectorAll('[data-wa]').forEach(function(a){
      var t=a.getAttribute('data-wa-text')||'Merhaba, Servis Takip hakkında bilgi almak istiyorum';
      a.setAttribute('href','https://wa.me/'+STK_WHATSAPP+'?text='+encodeURIComponent(t));
      a.setAttribute('target','_blank'); a.setAttribute('rel','noopener');
    });
  })();

  // Scroll-reveal (hero altı içerik; fail-open)
  (function(){
    var els=document.querySelectorAll('.reveal,.reveal-scale,.reveal-stagger');
    if(!els.length) return;
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(reduce||!('IntersectionObserver' in window)){els.forEach(function(el){el.classList.add('in');});return;}
    document.documentElement.classList.add('stk-anim');
    var io=new IntersectionObserver(function(entries){
      entries.forEach(function(en){ if(en.isIntersecting){en.target.classList.add('in');io.unobserve(en.target);} });
    },{threshold:.12,rootMargin:'0px 0px -40px 0px'});
    els.forEach(function(el){io.observe(el);});
  })();

  // Count-up sayaç (küçük hedefler atlanır, ceil ile 0 görünmez)
  (function(){
    var nodes=document.querySelectorAll('[data-count]');
    if(!nodes.length) return;
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    function fmtInt(n){return Math.round(n).toLocaleString('tr-TR');}
    function run(el){
      var target=+el.getAttribute('data-target')||0;
      var pre=el.getAttribute('data-prefix')||'', suf=el.getAttribute('data-suffix')||'';
      if(reduce||target<=3){el.textContent=pre+fmtInt(target)+suf;return;}
      var start=performance.now(), dur=1500;
      function tick(now){
        var t=Math.min(1,(now-start)/dur), e=1-Math.pow(1-t,3);
        el.textContent=pre+fmtInt(Math.ceil(target*e))+suf;
        if(t<1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    }
    if(!('IntersectionObserver' in window)){nodes.forEach(run);return;}
    var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting){run(en.target);io.unobserve(en.target);}});},{threshold:.4});
    nodes.forEach(function(n){io.observe(n);});
  })();

  // Mobil sticky CTA: hero CTA görünmezken belir, final CTA (#basla) görününce gizle
  (function(){
    var bar=document.getElementById('mcta');
    var heroCta=document.querySelector('.hero-cta');
    var basla=document.getElementById('basla');
    if(!bar||!heroCta||!('IntersectionObserver' in window)) return;
    var heroVisible=true, baslaVisible=false;
    function upd(){ bar.classList.toggle('show', !heroVisible && !baslaVisible); }
    new IntersectionObserver(function(es){es.forEach(function(en){heroVisible=en.isIntersecting;});upd();},{threshold:0}).observe(heroCta);
    if(basla) new IntersectionObserver(function(es){es.forEach(function(en){baslaVisible=en.isIntersecting;});upd();},{threshold:0}).observe(basla);
  })();

  // Hero dönen fiil (remount'ta çift interval olmasın diye tek instance)
  (function(){
    var rot=document.getElementById('hrot');
    if(!rot) return;
    var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(reduce) return;
    if(window.__stkRotator) clearInterval(window.__stkRotator);
    var items=rot.querySelectorAll('span'), i=0;
    window.__stkRotator=setInterval(function(){
      items[i].classList.remove('on'); items[i].classList.add('out');
      var prev=i; i=(i+1)%items.length;
      setTimeout(function(){ items[prev].classList.remove('out'); },520);
      items[i].classList.add('on');
    },2800);
  })();
`;

export default function Landing() {
  return (
    <>
      <link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div dangerouslySetInnerHTML={{ __html: BODY }} />
      <Script id="stk-landing" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: JS }} />
    </>
  );
}
