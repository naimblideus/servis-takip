'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/lib/i18n/client';
import { doldur } from '@/lib/i18n/sozluk';
import DavetPaylas from '@/components/DavetPaylas';

/**
 * YENİ KULLANICI — varsayılan yol DAVET: yönetici şifre uydurup telefonda
 * söylemez; kişiye WhatsApp'tan tek kullanımlık bağlantı gider, şifresini
 * kendisi koyar (lib/kullanici-davet.ts). "Şifreyi ben belirleyeyim" eski yol,
 * yan yana oturulan kurulumlar için duruyor.
 */
type Davet = { baglanti: string; ad: string; giris: string; firma: string };

export default function NewUserPage() {
    const router = useRouter();
    const t = useT();
    const [loading, setLoading] = useState(false);
    const [yol, setYol] = useState<'davet' | 'sifre'>('davet');
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        role: 'TECHNICIAN',
    });
    const [error, setError] = useState('');
    const [davet, setDavet] = useState<Davet | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (yol === 'sifre' && form.password.length < 6) { setError(t.kullanici.sifreKisa); return; }
        setLoading(true);
        setError('');
        const govde = yol === 'davet'
            ? { name: form.name, email: form.email, role: form.role, davet: true }
            : form;
        const res = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(govde),
        });
        const data = await res.json();
        if (!res.ok) {
            setError(data.error || t.genel.hata);
            setLoading(false);
            return;
        }
        if (yol === 'davet' && data.davet) {
            setDavet({ baglanti: data.davet.baglanti, ad: data.name, giris: data.email, firma: data.davet.firma });
            setLoading(false);
            return;
        }
        router.push('/users');
    };

    const inp = {
        width: '100%', padding: '0.625rem 0.75rem', border: '1px solid #d1d5db',
        borderRadius: '0.5rem', fontSize: '0.875rem', outline: 'none', boxSizing: 'border-box' as const,
    };
    const lbl = { display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#374151', marginBottom: '0.375rem' };
    const secenek = (aktif: boolean) => ({
        flex: 1, minHeight: '44px', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', cursor: 'pointer',
        fontSize: '0.85rem', fontWeight: 600,
        border: aktif ? '2px solid #059669' : '1px solid #d1d5db',
        backgroundColor: aktif ? '#ecfdf5' : 'white', color: aktif ? '#065f46' : '#374151',
    });

    if (davet) {
        const ilkAd = davet.ad.trim().split(/\s+/)[0] ?? davet.ad;
        return (
            <div style={{ padding: '2rem', maxWidth: '500px' }}>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>{t.kullanici.davetHazir}</h1>
                <DavetPaylas
                    baglanti={davet.baglanti}
                    mesaj={doldur(t.kullanici.davetMesaji, { ad: ilkAd, firma: davet.firma, baglanti: davet.baglanti, giris: davet.giris })}
                    baslik={davet.ad}
                    aciklama={doldur(t.kullanici.davetHazirAlt, { ad: ilkAd })}
                />
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button type="button" onClick={() => { setDavet(null); setForm({ name: '', email: '', password: '', role: form.role }); }}
                        style={{ minHeight: '44px', padding: '0 1rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', backgroundColor: 'white', cursor: 'pointer', fontWeight: 600 }}>
                        {t.kullanici.baskaKisi}
                    </button>
                    <Link href="/users" style={{ minHeight: '44px', display: 'inline-flex', alignItems: 'center', padding: '0 1rem', borderRadius: '0.5rem', backgroundColor: '#3b82f6', color: 'white', textDecoration: 'none', fontWeight: 600 }}>
                        {t.kullanici.kullanicilaraDon}
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem', maxWidth: '500px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <Link href="/users" style={{ color: '#6b7280', fontSize: '0.875rem', textDecoration: 'none' }}>← {t.menu['/users']}</Link>
                <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginTop: '0.25rem' }}>{t.kullanici.yeniBaslik}</h1>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', padding: '1.5rem' }}>
                {error && (
                    <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                        ❌ {error}
                    </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }} role="radiogroup">
                    <button type="button" role="radio" aria-checked={yol === 'davet'} onClick={() => setYol('davet')} style={secenek(yol === 'davet')}>
                        {t.kullanici.davetSecenek}
                    </button>
                    <button type="button" role="radio" aria-checked={yol === 'sifre'} onClick={() => setYol('sifre')} style={secenek(yol === 'sifre')}>
                        {t.kullanici.sifreSecenek}
                    </button>
                </div>
                {yol === 'davet' && <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '1rem' }}>{t.kullanici.davetSecenekAlt}</p>}

                <form onSubmit={handleSubmit} style={{ marginTop: yol === 'sifre' ? '1rem' : 0 }}>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={lbl}>{t.musteri.adSoyad}</label>
                        <input required style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder={t.kalanEtiket.ornekAdSoyad} />
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                        <label style={lbl}>{yol === 'davet' ? t.kullanici.girisAdi : `${t.musteri.eposta} *`}</label>
                        <input required type="email" style={inp} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="ahmet@firma.com" />
                    </div>
                    {yol === 'sifre' && (
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={lbl}>{t.kullanici.sifre}</label>
                            <input required type="password" style={inp} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
                        </div>
                    )}
                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={lbl}>{t.kullanici.rol} *</label>
                        <select style={inp} value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                            <option value="TECHNICIAN">{t.kullanici.roller.TECHNICIAN}</option>
                            <option value="FRONT_DESK">{t.kullanici.roller.FRONT_DESK}</option>
                            <option value="ADMIN">{t.kullanici.roller.ADMIN}</option>
                        </select>
                    </div>

                    <button type="submit" disabled={loading} style={{
                        width: '100%', padding: '0.75rem', backgroundColor: yol === 'davet' ? '#059669' : '#3b82f6', color: 'white',
                        border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer',
                        fontSize: '1rem', opacity: loading ? 0.7 : 1,
                    }}>
                        {loading ? t.kullanici.olusturuluyor : yol === 'davet' ? t.kullanici.davetOlustur : t.kullanici.olustur}
                    </button>
                </form>
            </div>
        </div>
    );
}
