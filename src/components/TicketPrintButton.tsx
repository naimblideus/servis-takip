'use client';

import { useState } from 'react';

interface TicketPrintButtonProps {
    ticketId: string;
}

export default function TicketPrintButton({ ticketId }: TicketPrintButtonProps) {
    const [loading, setLoading] = useState(false);

    const handlePrint = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/tickets/${ticketId}/print-data`);
            if (!res.ok) {
                alert('Baskı verisi yüklenemedi');
                setLoading(false);
                return;
            }
            const data = await res.json();
            const { ticket, customer, device, parts, companyName } = data;

            const partsTotal = parts.reduce((s: number, p: any) => s + p.unitPrice * p.quantity, 0);

            const printWindow = window.open('', '_blank');
            if (!printWindow) {
                alert('Popup engellenmiş olabilir, lütfen izin verin.');
                setLoading(false);
                return;
            }

            printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
    <title>${ticket.ticketNumber} - Servis Fişi</title>
    <style>
        @page { size: A4; margin: 8mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, sans-serif; 
            font-size: 11px; color: #1a1a1a;
            -webkit-print-color-adjust: exact; print-color-adjust: exact;
        }
        .page { width: 100%; max-width: 210mm; margin: 0 auto; }
        .header {
            display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 2px solid #1e40af; padding-bottom: 8px; margin-bottom: 10px;
        }
        .header-left h1 { font-size: 18px; color: #1e40af; }
        .header-left .company { font-size: 10px; color: #6b7280; margin-top: 2px; }
        .header-right { text-align: right; }
        .header-right .ticket-no { font-size: 22px; font-weight: 700; color: #1e40af; font-family: monospace; }
        .header-right .date { font-size: 10px; color: #6b7280; }
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .section { border: 1px solid #d1d5db; border-radius: 4px; padding: 8px; }
        .section-title { 
            font-size: 10px; font-weight: 700; text-transform: uppercase; 
            color: #1e40af; border-bottom: 1px solid #e5e7eb; 
            padding-bottom: 4px; margin-bottom: 6px; letter-spacing: 0.5px;
        }
        .row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 10.5px; }
        .row .label { color: #6b7280; }
        .row .value { font-weight: 600; text-align: right; max-width: 60%; word-break: break-word; }
        .issue-box { 
            background: #f9fafb; padding: 6px 8px; border-radius: 3px; 
            font-size: 10.5px; white-space: pre-wrap; min-height: 16px; margin-bottom: 4px;
        }
        .issue-label { font-size: 9px; font-weight: 600; color: #6b7280; margin-bottom: 2px; text-transform: uppercase; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th { background: #f3f4f6; padding: 4px 6px; text-align: left; font-weight: 600; border: 1px solid #e5e7eb; font-size: 9px; }
        td { padding: 3px 6px; border: 1px solid #e5e7eb; }
        .text-right { text-align: right; }
        .total-row { font-weight: 700; background: #f0f9ff; }
        .footer {
            border-top: 1px solid #d1d5db; padding-top: 6px; margin-top: 8px;
            display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
        }
        .qr-section { display: flex; align-items: center; gap: 8px; padding: 6px; }
        .qr-label { font-size: 8px; color: #6b7280; text-align: center; }
        .sign-area {
            border-top: 1px solid #9ca3af; margin-top: 30px; padding-top: 4px;
            text-align: center; font-size: 9px; color: #6b7280;
        }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div class="header-left">
                <h1>SERVİS FİŞİ</h1>
                <div class="company">${escapeHtml(companyName)}</div>
            </div>
            <div class="header-right">
                <div class="ticket-no">${ticket.ticketNumber}</div>
                <div class="date">${new Date(ticket.createdAt).toLocaleDateString('tr-TR')} ${new Date(ticket.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
        </div>

        <div class="grid-3">
            <div class="section">
                <div class="section-title">Müşteri Bilgileri</div>
                <div class="row"><span class="label">Müşteri</span><span class="value">${escapeHtml(customer.name)}</span></div>
                <div class="row"><span class="label">Telefon</span><span class="value">${escapeHtml(customer.phone)}</span></div>
                <div class="row"><span class="label">Adres</span><span class="value">${escapeHtml(customer.address || '-')}</span></div>
            </div>
            <div class="section">
                <div class="section-title">Cihaz Bilgileri</div>
                <div class="row"><span class="label">Marka</span><span class="value">${escapeHtml(device.brand)}</span></div>
                <div class="row"><span class="label">Model</span><span class="value">${escapeHtml(device.model)}</span></div>
                <div class="row"><span class="label">Seri No</span><span class="value" style="font-family:monospace">${escapeHtml(device.serialNo)}</span></div>
                ${device.counterBlack || device.counterColor ? `<div class="row"><span class="label">Sayaç</span><span class="value">SB:${(device.counterBlack || 0).toLocaleString('tr-TR')}${device.counterColor ? ' / RNK:' + device.counterColor.toLocaleString('tr-TR') : ''}</span></div>` : ''}
                ${device.location ? `<div class="row"><span class="label">Konum</span><span class="value">${escapeHtml(device.location)}</span></div>` : ''}
            </div>
            <div class="section">
                <div class="section-title">Fiş Bilgileri</div>
                <div class="row"><span class="label">Durum</span><span class="value">${statusLabel(ticket.status)}</span></div>
                <div class="row"><span class="label">Öncelik</span><span class="value">${priorityLabel(ticket.priority)}</span></div>
                <div class="row"><span class="label">Teknisyen</span><span class="value">${escapeHtml(ticket.assignedUserName || '-')}</span></div>
                <div class="row"><span class="label">Oluşturan</span><span class="value">${escapeHtml(ticket.createdByName || '-')}</span></div>
                <div class="row"><span class="label">Ödeme</span><span class="value">${paymentLabel(ticket.paymentStatus)}</span></div>
                <div class="row"><span class="label">Toplam</span><span class="value" style="font-weight:700;color:#059669">₺${ticket.totalCost.toFixed(2)}</span></div>
            </div>
        </div>

        <div class="section" style="margin-bottom:10px">
            <div class="section-title">Arıza & İşlem Bilgileri</div>
            <div class="issue-label">Arıza Açıklaması</div>
            <div class="issue-box">${escapeHtml(ticket.issueText || '-')}</div>
            <div class="issue-label">Yapılan İşlem</div>
            <div class="issue-box">${escapeHtml(ticket.actionText || '-')}</div>
            ${ticket.notes ? `<div class="issue-label">Notlar</div><div class="issue-box">${escapeHtml(ticket.notes)}</div>` : ''}
        </div>

        ${parts.length > 0 ? `
        <div class="section" style="margin-bottom:10px">
            <div class="section-title">Kullanılan Parçalar</div>
            <table>
                <thead>
                    <tr>
                        <th style="width:60px">Kod</th>
                        <th>Parça Adı</th>
                        <th style="width:55px">Grup</th>
                        <th class="text-right" style="width:35px">Adet</th>
                        <th class="text-right" style="width:65px">Birim ₺</th>
                        <th class="text-right" style="width:65px">Toplam ₺</th>
                    </tr>
                </thead>
                <tbody>
                    ${parts.map((p: any) => `
                    <tr>
                        <td style="font-family:monospace;font-size:9px">${escapeHtml(p.sku)}</td>
                        <td>${escapeHtml(p.name)}</td>
                        <td style="font-size:9px">${escapeHtml(p.group || '-')}</td>
                        <td class="text-right">${p.quantity}</td>
                        <td class="text-right">₺${p.unitPrice.toFixed(2)}</td>
                        <td class="text-right">₺${(p.unitPrice * p.quantity).toFixed(2)}</td>
                    </tr>`).join('')}
                    <tr class="total-row">
                        <td colspan="5" class="text-right" style="font-weight:700">PARÇALAR TOPLAMI</td>
                        <td class="text-right">₺${partsTotal.toFixed(2)}</td>
                    </tr>
                </tbody>
            </table>
        </div>` : ''}

        <div class="footer">
            <div class="qr-section">
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(window.location.origin + '/qr/' + device.publicCode)}" width="80" height="80" />
                <div>
                    <div class="qr-label">Cihaz QR Kodu</div>
                    <div style="font-size:9px;color:#374151;font-family:monospace">${device.publicCode}</div>
                </div>
            </div>
            <div>
                <div class="sign-area">Müşteri İmzası</div>
                <div class="sign-area">Teknisyen İmzası</div>
            </div>
        </div>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print()},500)};<\/script>
</body>
</html>`);
            printWindow.document.close();
        } catch (e) {
            alert('Yazdırma hatası: ' + (e as Error).message);
        }
        setLoading(false);
    };

    return (
        <button onClick={handlePrint} disabled={loading} style={{
            padding: '0.5rem 1rem', backgroundColor: '#1e40af', color: 'white',
            border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600',
            fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.35rem',
            opacity: loading ? 0.7 : 1,
        }}>
            {loading ? '⏳ Hazırlanıyor...' : '🖨️ Yazdır'}
        </button>
    );
}

function escapeHtml(s: string) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function statusLabel(s: string) {
    const m: Record<string, string> = { NEW: 'Yeni', IN_SERVICE: 'Serviste', WAITING_FOR_PART: 'Parça Bkl.', READY: 'Hazır', DELIVERED: 'Teslim', CANCELLED: 'İptal' };
    return m[s] || s;
}
function priorityLabel(p: string) {
    const m: Record<string, string> = { LOW: 'Düşük', NORMAL: 'Normal', HIGH: 'Yüksek', URGENT: 'Acil' };
    return m[p] || p;
}
function paymentLabel(p: string) {
    const m: Record<string, string> = { UNPAID: 'Ödenmedi', PARTIAL: 'Kısmi', PAID: 'Ödendi', REFUNDED: 'İade' };
    return m[p] || p;
}
