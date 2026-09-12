'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import AddressAutocomplete from '@/components/AddressAutocomplete';
import { faturaEksikleri } from '@/lib/fatura-kimlik';

interface Props {
    customer: {
        id: string;
        name: string;
        phone: string;
        address: string | null;
        taxNo: string | null;
        email?: string | null;
        legalName?: string | null;
        taxOffice?: string | null;
        city?: string | null;
        district?: string | null;
        eInvoiceUser?: boolean | null;
        contractEndDate?: string | null;
    };
}

export default function CustomerEditPanel({ customer }: Props) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        name: customer.name,
        phone: customer.phone,
        address: customer.address || '',
        taxNo: customer.taxNo || '',
        email: customer.email || '',
        legalName: customer.legalName || '',
        taxOffice: customer.taxOffice || '',
        city: customer.city || '',
        district: customer.district || '',
        // '' = hiç sorulmadı. Bilerek üç değerli — bkz. lib/fatura-kimlik.ts
        eInvoiceUser: customer.eInvoiceUser === true ? 'evet' : customer.eInvoiceUser === false ? 'hayir' : '',
        contractEndDate: customer.contractEndDate ? customer.contractEndDate.slice(0, 10) : '',
    });

    // Fatura bölümü KAPALI başlıyor: bayilerin çoğu müşteriyi telefonunu
    // ya da adresini düzeltmek için açıyor, altı fatura alanını her
    // seferinde görmek gürültü olurdu. Eksik varsa rozet zaten çağırıyor.
    const [faturaAcik, setFaturaAcik] = useState(false);
    const eksikler = faturaEksikleri({
        name: form.name, legalName: form.legalName, taxNo: form.taxNo,
        taxOffice: form.taxOffice, address: form.address, city: form.city,
        district: form.district, email: form.email,
        eInvoiceUser: form.eInvoiceUser === 'evet' ? true : form.eInvoiceUser === 'hayir' ? false : null,
    });

    const save = async () => {
        setSaving(true);
        const res = await fetch(`/api/customers/${customer.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        });
        if (res.ok) {
            router.refresh();
            setOpen(false);
        } else {
            const d = await res.json();
            alert('Hata: ' + d.error);
        }
        setSaving(false);
    };

    const deleteCustomer = async () => {
        if (!confirm(`"${customer.name}" müşterisini ve tüm cihazlarını/fişlerini silmek isteriyor musunuz?`)) return;
        const res = await fetch(`/api/customers/${customer.id}`, { method: 'DELETE' });
        if (res.ok) {
            router.push('/customers');
        } else {
            const d = await res.json();
            alert('Silinemedi: ' + d.error);
        }
    };

    const inp = {
        width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #d1d5db',
        borderRadius: '0.5rem', fontSize: '0.875rem', boxSizing: 'border-box' as const,
    };
    const lbl = { fontSize: '0.8rem', fontWeight: '500' as const, color: '#6b7280', display: 'block' as const, marginBottom: '0.25rem' };

    return (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button onClick={() => setOpen(!open)} style={{
                padding: '0.5rem 1rem', backgroundColor: open ? '#f3f4f6' : 'white',
                border: '1px solid #d1d5db', borderRadius: '0.5rem',
                fontSize: '0.875rem', cursor: 'pointer', fontWeight: '500',
            }}>
                {open ? '✕ Kapat' : '✏️ Düzenle'}
            </button>
            <button onClick={deleteCustomer} style={{
                padding: '0.5rem 0.875rem', backgroundColor: '#fee2e2', border: 'none',
                borderRadius: '0.5rem', fontSize: '0.875rem', cursor: 'pointer',
                color: '#b91c1c', fontWeight: '500',
            }}>🗑️</button>

            {open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50,
                    // Kip ekrandan uzunsa kaydırılabilsin: 'center' + taşma
                    // = üstü erişilemez hâle gelir, o yüzden flex-start +
                    // çocukta margin:auto (kısa içerikte yine ortalanır).
                    display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
                    overflowY: 'auto', padding: '1.5rem 1rem',
                }} onClick={() => setOpen(false)}>
                    <div style={{
                        margin: 'auto',
                        backgroundColor: 'white', borderRadius: '1rem', padding: '2rem',
                        width: '100%', maxWidth: '480px', boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                    }} onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontWeight: '700', fontSize: '1.25rem', marginBottom: '1.5rem' }}>Müşteri Düzenle</h2>

                        <div style={{ marginBottom: '1rem' }}>
                            <label style={lbl}>Ad Soyad *</label>
                            <input style={inp} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={lbl}>Telefon *</label>
                            <input style={inp} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={lbl}>Adres</label>
                            <AddressAutocomplete value={form.address} onChange={v => setForm({ ...form, address: v })} style={inp} />
                        </div>
                        <div style={{ marginBottom: '1rem' }}>
                            <label style={lbl}>Vergi No / TC Kimlik No</label>
                            <input style={inp} value={form.taxNo} onChange={e => setForm({ ...form, taxNo: e.target.value })} />
                        </div>

                        {/* ── FATURA BİLGİLERİ ─────────────────────────────
                            Defterdeki müşteri ile faturaya yazılan müşteri aynı
                            şey değil: faturada tescilli unvan, vergi dairesi ve
                            il/ilçe AYRI alanlar olarak isteniyor. Eksik listesi
                            tek kaynaktan (lib/fatura-kimlik.ts) geliyor — form,
                            göç özeti ve fatura kesme aynı cevabı versin diye. */}
                        <div style={{ marginBottom: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.6rem', overflow: 'hidden' }}>
                            <button type="button" onClick={() => setFaturaAcik(!faturaAcik)}
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    gap: '0.5rem', padding: '0.7rem 0.85rem', background: '#f9fafb', border: 'none',
                                    cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, color: '#374151', textAlign: 'left' }}>
                                <span>Fatura bilgileri</span>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    {eksikler.length > 0 ? (
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#92400e',
                                            background: '#fef3c7', padding: '0.15rem 0.45rem', borderRadius: '999px' }}>
                                            {eksikler.length} eksik
                                        </span>
                                    ) : (
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#166534',
                                            background: '#dcfce7', padding: '0.15rem 0.45rem', borderRadius: '999px' }}>
                                            tamam
                                        </span>
                                    )}
                                    <span style={{ color: '#9ca3af' }}>{faturaAcik ? '▲' : '▼'}</span>
                                </span>
                            </button>

                            {faturaAcik && (
                                <div style={{ padding: '0.85rem' }}>
                                    <div style={{ marginBottom: '0.8rem' }}>
                                        <label style={lbl}>Ticari unvan (faturada yazacak ad)</label>
                                        <input style={inp} value={form.legalName} placeholder={form.name}
                                            onChange={e => setForm({ ...form, legalName: e.target.value })} />
                                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                                            Boş bırakırsan faturaya yukarıdaki ad yazılır.
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))', gap: '0.6rem', marginBottom: '0.8rem' }}>
                                        <div>
                                            <label style={lbl}>Vergi dairesi</label>
                                            <input style={inp} value={form.taxOffice} onChange={e => setForm({ ...form, taxOffice: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={lbl}>İl</label>
                                            <input style={inp} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} />
                                        </div>
                                        <div>
                                            <label style={lbl}>İlçe</label>
                                            <input style={inp} value={form.district} onChange={e => setForm({ ...form, district: e.target.value })} />
                                        </div>
                                    </div>
                                    <div style={{ marginBottom: '0.8rem' }}>
                                        <label style={lbl}>E-posta</label>
                                        <input style={inp} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                                    </div>
                                    <div style={{ marginBottom: '0.8rem' }}>
                                        <label style={lbl}>e-Fatura mükellefi mi?</label>
                                        <select style={inp} value={form.eInvoiceUser}
                                            onChange={e => setForm({ ...form, eInvoiceUser: e.target.value })}>
                                            <option value="">Bilinmiyor — sorgulanmadı</option>
                                            <option value="evet">Evet — e-Fatura</option>
                                            <option value="hayir">Hayır — e-Arşiv</option>
                                        </select>
                                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                                            Faturanın hangi yoldan gideceğini bu belirler.
                                        </div>
                                    </div>
                                    {eksikler.length > 0 && (
                                        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '0.5rem',
                                            padding: '0.6rem 0.7rem', fontSize: '0.74rem', color: '#92400e' }}>
                                            <b>Fatura kesilebilmesi için eksik:</b>
                                            <ul style={{ margin: '0.3rem 0 0', paddingLeft: '1.1rem' }}>
                                                {eksikler.map((x) => <li key={x}>{x}</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div style={{ marginBottom: '1.5rem' }}>
                            <label style={lbl}>Sözleşme Bitiş Tarihi</label>
                            <input type="date" style={inp} value={form.contractEndDate}
                                onChange={e => setForm({ ...form, contractEndDate: e.target.value })} />
                            <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: '0.3rem' }}>
                                Girersen bitmeden önce ana ekranda uyarı çıkar (sözleşme unutulup bedava çalışmasın).
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button onClick={save} disabled={saving} style={{
                                flex: 1, padding: '0.75rem', backgroundColor: '#3b82f6', color: 'white',
                                border: 'none', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer',
                                opacity: saving ? 0.7 : 1,
                            }}>
                                {saving ? 'Kaydediliyor...' : 'Kaydet'}
                            </button>
                            <button onClick={() => setOpen(false)} style={{
                                padding: '0.75rem 1.5rem', border: '1px solid #d1d5db', backgroundColor: 'white',
                                borderRadius: '0.5rem', cursor: 'pointer', color: '#374151',
                            }}>İptal</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
