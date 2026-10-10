/** Marka işareti — landing'deki N monogramının aynısı (giriş ve kayıt sayfaları). */
export default function Monogram({ size = 34 }: { size?: number }) {
  return (
    <span
      style={{ width: size, height: size }}
      className="inline-flex items-center justify-center rounded-[10px] border border-white/10 bg-gradient-to-br from-[#161c28] to-[#0a0e16]"
    >
      <svg viewBox="0 0 230 200" aria-hidden="true" style={{ width: '70%', height: '70%', overflow: 'visible' }}>
        <g fill="#e6ecf5">
          <rect x="30" y="20" width="38" height="160" />
          <polygon points="68,20 106,20 150,180 112,180" />
          <rect x="150" y="20" width="38" height="160" />
        </g>
        <path d="M14 154 C84 120 152 78 224 34" stroke="#0d121c" strokeWidth="13" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
