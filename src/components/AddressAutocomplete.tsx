'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Serbest-metin adres girişi + otomatik tamamlama (OpenStreetMap/Nominatim, ÜCRETSİZ, API key yok).
 * - Yazarken eşleşen adresler listelenir; tıklayınca dolar.
 * - KISITLAMA YOK: liste boşsa/eşleşme yoksa kullanıcı kendi adresini elle yazıp kaydedebilir.
 * - Düşük hacim için public Nominatim yeterli (debounce + min 3 harf + limit 5; istek sınırına uyar).
 */
export default function AddressAutocomplete({
  value,
  onChange,
  style,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  style?: React.CSSProperties;
  placeholder?: string;
}) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(false); // seçimden sonra gereksiz tekrar-aramayı önle
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = (value || '').trim();
    if (skipNext.current) { skipNext.current = false; return; }
    if (q.length < 3) { setSuggestions([]); return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&countrycodes=tr&limit=5&q=${encodeURIComponent(q)}`,
          { headers: { 'Accept-Language': 'tr' } }
        );
        const d = await r.json();
        setSuggestions(Array.isArray(d) ? d.map((x: any) => x.display_name).filter(Boolean) : []);
      } catch {
        setSuggestions([]); // hata olursa sessizce: kullanıcı elle yazmaya devam eder
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = (s: string) => {
    skipNext.current = true;
    onChange(s);
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <textarea
        rows={2}
        style={style}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder || 'Adres yazın — listeden seçin ya da elle tamamlayın'}
      />
      {loading && <span style={{ position: 'absolute', right: 8, top: 8, fontSize: 11, color: '#9ca3af' }}>aranıyor…</span>}
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60, marginTop: 2,
          background: 'white', border: '1px solid #d1d5db', borderRadius: 8,
          maxHeight: 220, overflowY: 'auto', boxShadow: '0 6px 18px rgba(0,0,0,0.15)',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              style={{ padding: '0.5rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer', borderBottom: i < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none', lineHeight: 1.35 }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
            >
              📍 {s}
            </div>
          ))}
          <div style={{ padding: '0.4rem 0.7rem', fontSize: '0.7rem', color: '#9ca3af', borderTop: '1px solid #f3f4f6' }}>
            Bulamadın mı? Yazmaya devam et, elle de kaydedebilirsin · OpenStreetMap
          </div>
        </div>
      )}
    </div>
  );
}
