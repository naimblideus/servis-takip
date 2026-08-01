'use client';

/**
 * Arıza kategorisi seçici — sahada hız için tasarlandı.
 *
 * Tasarım kararı: 14 seçenek az olduğu için açılır menü YOK.
 * Hepsi ekranda duruyor; yazınca süzülüyor. Böylece:
 *  - fare/dokunmatik: tek dokunuş (büyük hedefler)
 *  - klavye: "fir" + Enter (iki saniye)
 * Amaç zorlamak değil KOLAYLAŞTIRMAK — zorla doldurulan alan yalan üretir,
 * kolay alan doğru dolar.
 */
import { useMemo, useRef, useState } from 'react';
import { FAULT_CATEGORIES, searchFaultCategories } from '@/lib/fault-categories';

interface Props {
  value: string;                                  // seçili kod ('' = boş)
  onChange: (code: string, label: string) => void;
  autoFocus?: boolean;
}

export default function FaultCategoryPicker({ value, onChange, autoFocus }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [justPicked, setJustPicked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchFaultCategories(query), [query]);
  const selected = FAULT_CATEGORIES.find((c) => c.code === value) || null;

  const pick = (code: string, label: string) => {
    onChange(code, label);
    setQuery('');
    setActive(0);
    setJustPicked(true);
    window.setTimeout(() => setJustPicked(false), 600);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') {
      // Enter formu göndermesin — önce kategori seçilsin
      if (results.length) { e.preventDefault(); const c = results[active] || results[0]; pick(c.code, c.label); }
    } else if (e.key === 'Escape') { setQuery(''); }
  };

  // Seçiliyse: tek satır özet + değiştir. Ekranı doldurup akışı yavaşlatmasın.
  if (selected) {
    return (
      <div
        className={justPicked ? 'sa-pop' : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          padding: '0.7rem 0.9rem', borderRadius: '0.5rem',
          border: '1.5px solid #16a34a', backgroundColor: '#f0fdf4',
        }}
      >
        <span aria-hidden="true" className={justPicked ? 'sa-check' : undefined}
          style={{ color: '#16a34a', fontWeight: 700, fontSize: '1rem', lineHeight: 1 }}>✓</span>
        <span style={{ fontWeight: 600, color: '#14532d', flex: 1 }}>{selected.label}</span>
        {!selected.isFailure && (
          <span style={{ fontSize: '0.7rem', color: '#166534', backgroundColor: '#dcfce7',
            padding: '0.1rem 0.45rem', borderRadius: '9999px' }}>arıza değil</span>
        )}
        <button type="button" onClick={() => { onChange('', ''); setTimeout(() => inputRef.current?.focus(), 0); }}
          style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer',
            fontSize: '0.78rem', textDecoration: 'underline', padding: 0 }}>
          değiştir
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={onKeyDown}
        placeholder="Yazın: fırın, toner, sıkış… veya aşağıdan seçin"
        aria-label="Arıza kategorisi ara"
        style={{
          width: '100%', padding: '0.6rem 0.75rem', border: '1px solid #d1d5db',
          borderRadius: '0.5rem', fontSize: '0.9rem', outline: 'none',
        }}
      />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginTop: '0.55rem' }}>
        {results.map((c, i) => (
          <button
            key={c.code}
            type="button"
            onClick={() => pick(c.code, c.label)}
            onMouseEnter={() => setActive(i)}
            style={{
              padding: '0.5rem 0.8rem', borderRadius: '9999px', cursor: 'pointer',
              fontSize: '0.85rem', lineHeight: 1.2,
              border: i === active && query ? '1.5px solid #2563eb' : '1px solid #d1d5db',
              backgroundColor: i === active && query ? '#eff6ff' : 'white',
              color: c.isFailure ? '#374151' : '#166534',
              fontWeight: i === active && query ? 600 : 400,
            }}
          >
            {c.label}
          </button>
        ))}
        {results.length === 0 && (
          <span style={{ fontSize: '0.8rem', color: '#9ca3af', padding: '0.4rem 0' }}>
            Eşleşme yok — yazıyı kısaltın
          </span>
        )}
      </div>
    </div>
  );
}
