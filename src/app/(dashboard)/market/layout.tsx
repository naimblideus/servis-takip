import type { ReactNode } from 'react';

// Pazar'ın ORTAK tasarım katmanı — tek kaynak. Tüm /market alt sayfaları bu token+sınıfları miras alır.
// Panel-uygun "premium": derinlik + doğru easing + mikro-etkileşim; gösterişli değil, sade ve okunur.
const CSS = `
.mk{--ink:#0B1533;--ink2:#5B6479;--mut:#8A93AB;--line:rgba(15,34,83,.09);--navy:#0F2253;--em:#0E9F6E;--ease:cubic-bezier(.32,.72,0,1)}
.mk-eyebrow{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:var(--mut)}
.mk-h1{font-size:1.7rem;font-weight:800;letter-spacing:-.022em;color:var(--ink);margin:.3rem 0 0;line-height:1.15}
.mk-sub{color:var(--ink2);font-size:.9rem;margin:.4rem 0 0;line-height:1.5}
.mk-back{display:inline-flex;align-items:center;gap:.35rem;color:var(--mut);font-size:.82rem;font-weight:600;text-decoration:none;transition:color .2s var(--ease)}
.mk-back:hover{color:var(--ink)}
.mk-shell{background:rgba(15,34,83,.045);border:1px solid var(--line);border-radius:22px;padding:6px}
.mk-core{background:#fff;border-radius:16px;padding:1.15rem 1.25rem;box-shadow:inset 0 1px 0 rgba(255,255,255,.9)}
.mk-panel{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 1px 2px rgba(16,24,40,.04)}
.mk-btn{display:inline-flex;align-items:center;gap:.55rem;padding:.5rem .62rem .5rem 1rem;border-radius:999px;border:1px solid var(--line);background:#fff;color:var(--ink);font-weight:650;font-size:.855rem;text-decoration:none;cursor:pointer;transition:transform .22s var(--ease),box-shadow .22s var(--ease),background .22s var(--ease),border-color .22s var(--ease)}
.mk-btn:hover{box-shadow:0 8px 20px -12px rgba(15,34,83,.4);border-color:rgba(15,34,83,.16)}
.mk-btn:active{transform:scale(.98)}
.mk-btn:disabled{opacity:.5;cursor:not-allowed}
.mk-btn-p{background:var(--navy);color:#fff;border-color:transparent}
.mk-btn-p:hover{box-shadow:0 12px 26px -14px rgba(15,34,83,.7)}
.mk-btn-g{background:var(--em);color:#fff;border-color:transparent}
.mk-btn-g:hover{box-shadow:0 12px 26px -14px rgba(14,159,110,.75)}
.mk-ico{width:25px;height:25px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:rgba(15,34,83,.07);font-size:.8rem;line-height:1;transition:transform .22s var(--ease)}
.mk-btn-p .mk-ico,.mk-btn-g .mk-ico{background:rgba(255,255,255,.18)}
.mk-btn:hover .mk-ico{transform:translateX(2px)}
.mk-chip{padding:.45rem .95rem;border-radius:999px;border:1px solid var(--line);background:#fff;font-size:.83rem;font-weight:650;color:var(--ink2);cursor:pointer;transition:transform .2s var(--ease),background .2s var(--ease),color .2s var(--ease),border-color .2s var(--ease)}
.mk-chip:hover{border-color:rgba(15,34,83,.2)}
.mk-chip:active{transform:scale(.97)}
.mk-chip[data-on="1"]{background:var(--navy);border-color:var(--navy);color:#fff}
.mk-in{padding:.6rem .85rem;border:1px solid var(--line);border-radius:12px;font-size:.9rem;box-sizing:border-box;width:100%;background:#fff;color:var(--ink);outline:none;font-family:inherit;transition:border-color .2s var(--ease),box-shadow .2s var(--ease)}
.mk-in:focus{border-color:rgba(15,34,83,.3);box-shadow:0 0 0 4px rgba(15,34,83,.07)}
.mk-in::placeholder{color:#A9B0C2}
.mk-lbl{font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;font-weight:700;color:var(--mut);display:block;margin-bottom:6px}
.mk-card{background:#fff;border:1px solid var(--line);border-radius:16px;overflow:hidden;display:flex;flex-direction:column;text-decoration:none;color:inherit;box-shadow:0 1px 2px rgba(16,24,40,.04);transition:transform .28s var(--ease),box-shadow .28s var(--ease),border-color .28s var(--ease)}
.mk-card:hover{transform:translateY(-4px);box-shadow:0 20px 38px -22px rgba(15,34,83,.36);border-color:rgba(15,34,83,.14)}
.mk-thumb{height:142px;background:#F2F4F8;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center}
.mk-thumb img{width:100%;height:100%;object-fit:cover;transition:transform .55s var(--ease)}
.mk-card:hover .mk-thumb img{transform:scale(1.05)}
.mk-badge{position:absolute;top:9px;left:9px;background:rgba(11,21,51,.9);color:#fff;font-size:.65rem;font-weight:700;padding:4px 9px;border-radius:999px}
.mk-price{font-weight:800;font-size:1.06rem;color:var(--em);letter-spacing:-.012em}
.mk-meta{font-size:.72rem;color:var(--mut);margin-top:4px}
.mk-pill{font-size:.7rem;font-weight:700;padding:.22rem .65rem;border-radius:999px;white-space:nowrap}
.mk-row{background:#fff;border:1px solid var(--line);border-radius:14px;padding:.75rem .9rem;display:flex;align-items:center;gap:.85rem;text-decoration:none;color:inherit;box-shadow:0 1px 2px rgba(16,24,40,.04);transition:transform .22s var(--ease),box-shadow .22s var(--ease),border-color .22s var(--ease)}
.mk-row:hover{transform:translateY(-2px);box-shadow:0 14px 28px -20px rgba(15,34,83,.4);border-color:rgba(15,34,83,.14)}
.mk-thread{padding:.75rem .9rem;border-bottom:1px solid var(--line);cursor:pointer;border-left:3px solid transparent;transition:background .2s var(--ease),border-color .2s var(--ease)}
.mk-thread:hover{background:rgba(15,34,83,.025)}
.mk-thread[data-on="1"]{background:rgba(15,34,83,.05);border-left-color:var(--navy)}
.mk-bub{max-width:80%;border-radius:14px;padding:.55rem .8rem;background:#F2F4F8;color:var(--ink)}
.mk-bub-me{background:#E7F6EF}
.mk-sk{border-radius:16px;background:linear-gradient(100deg,#EDF0F5 30%,#F7F9FC 50%,#EDF0F5 70%);background-size:200% 100%;animation:mksh 1.5s var(--ease) infinite}
@keyframes mksh{to{background-position:-200% 0}}
.mk-ben{display:flex;gap:.85rem;align-items:flex-start;padding:.85rem .95rem;border-radius:14px;background:#fff;border:1px solid var(--line);transition:transform .22s var(--ease),box-shadow .22s var(--ease)}
.mk-ben:hover{transform:translateY(-2px);box-shadow:0 14px 28px -20px rgba(15,34,83,.4)}
@media(max-width:640px){.mk-h1{font-size:1.45rem}}
`;

export default function MarketLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mk">
      <style>{CSS}</style>
      {children}
    </div>
  );
}
