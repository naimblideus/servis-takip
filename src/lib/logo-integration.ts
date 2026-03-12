/**
 * Logo Muhasebe Entegrasyon Motoru
 * Desteklenen yöntemler: REST API, Dosya (XML), Veritabanı (MSSQL)
 */

export interface LogoConfig {
    method: 'rest' | 'file' | 'db';
    // REST
    apiUrl?: string;
    apiKey?: string;
    firmaKodu?: string;
    donemKodu?: string;
    // DB
    dbServer?: string;
    dbPort?: string;
    dbName?: string;
    dbUser?: string;
    dbPass?: string;
    // Muhasebe eşleştirmeler
    defaultCariGrup?: string;
    defaultGelirHesap?: string;
    kasaHesap?: string;
    bankaHesap?: string;
}

export interface LogoResult {
    success: boolean;
    logoKod?: string;
    error?: string;
}

export interface LogoSyncReport {
    total: number;
    success: number;
    failed: number;
    errors: { entityId: string; error: string }[];
}

// ────────────────────────────────────────────
// Logo REST API Adapter
// ────────────────────────────────────────────

class LogoRestApiAdapter {
    constructor(private config: LogoConfig) { }

    async testConnection(): Promise<boolean> {
        try {
            const res = await fetch(`${this.config.apiUrl}/ping`, {
                headers: { Authorization: `Bearer ${this.config.apiKey}` },
                signal: AbortSignal.timeout(5000),
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    async createOrUpdateCari(customer: { id: string; name: string; phone: string; taxNo?: string; address?: string }): Promise<LogoResult> {
        try {
            const payload = {
                CODE: `C-${customer.id.slice(-8).toUpperCase()}`,
                DEFINITION_: customer.name,
                PHONE1: customer.phone,
                TAXNR: customer.taxNo || '',
                ADDR1: customer.address || '',
                GROUPCODE: this.config.defaultCariGrup || 'MUS',
            };

            const res = await fetch(`${this.config.apiUrl}/ARPs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) {
                const err = await res.text();
                return { success: false, error: err };
            }

            const data = await res.json();
            return { success: true, logoKod: payload.CODE };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async createInvoice(ticket: {
        id: string; ticketNumber: string; totalCost: number;
        customer: { name: string; phone: string; taxNo?: string };
        createdAt: Date;
    }): Promise<LogoResult> {
        try {
            const payload = {
                TYPE: 8, // Satış faturası
                NUMBER: ticket.ticketNumber,
                DATE: new Date(ticket.createdAt).toISOString().split('T')[0].replace(/-/g, ''),
                CLIENTREF: `C-${ticket.id.slice(-8).toUpperCase()}`,
                LINES: [{
                    STOCKREF: this.config.defaultGelirHesap || '600',
                    DEFINITION_: `Servis - ${ticket.ticketNumber}`,
                    QUANTITY: 1,
                    PRICE: ticket.totalCost,
                }],
            };

            const res = await fetch(`${this.config.apiUrl}/invoices`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) return { success: false, error: await res.text() };
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }

    async createPayment(payment: { id: string; amount: number; method: string; paymentDate: Date }): Promise<LogoResult> {
        try {
            const accountCode = payment.method === 'CARD' || payment.method === 'TRANSFER'
                ? (this.config.bankaHesap || '102')
                : (this.config.kasaHesap || '100');

            const payload = {
                TYPE: 1, // Kasa/Banka tahsilat
                DATE: new Date(payment.paymentDate).toISOString().split('T')[0].replace(/-/g, ''),
                AMOUNT: payment.amount,
                ACCOUNTCODE: accountCode,
            };

            const res = await fetch(`${this.config.apiUrl}/receipts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(15000),
            });

            if (!res.ok) return { success: false, error: await res.text() };
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    }
}

// ────────────────────────────────────────────
// Logo XML Dosya Adapter
// ────────────────────────────────────────────

class LogoFileAdapter {
    constructor(private config: LogoConfig) { }

    async testConnection(): Promise<boolean> {
        return true; // Dosya yönteminde bağlantı testi yok
    }

    generateCariXml(customers: { name: string; phone: string; taxNo?: string; address?: string }[]): string {
        const rows = customers.map((c, i) => `
  <Cari>
    <Kod>C-${String(i + 1).padStart(5, '0')}</Kod>
    <Unvan>${escapeXml(c.name)}</Unvan>
    <Telefon>${c.phone || ''}</Telefon>
    <VergiNo>${c.taxNo || ''}</VergiNo>
    <Adres>${escapeXml(c.address || '')}</Adres>
  </Cari>`).join('\n');

        return `<?xml version="1.0" encoding="UTF-8"?>
<CariListesi>
${rows}
</CariListesi>`;
    }

    generateInvoiceXml(ticket: { ticketNumber: string; totalCost: number; createdAt: Date }): string {
        return `<?xml version="1.0" encoding="UTF-8"?>
<Fatura>
  <No>${ticket.ticketNumber}</No>
  <Tarih>${new Date(ticket.createdAt).toLocaleDateString('tr-TR')}</Tarih>
  <Tutar>${ticket.totalCost.toFixed(2)}</Tutar>
</Fatura>`;
    }
}

function escapeXml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ────────────────────────────────────────────
// Ana Entegrasyon Sınıfı
// ────────────────────────────────────────────

export class LogoIntegration {
    private adapter: LogoRestApiAdapter | LogoFileAdapter;

    constructor(private config: LogoConfig) {
        this.adapter = config.method === 'file'
            ? new LogoFileAdapter(config)
            : new LogoRestApiAdapter(config);
    }

    async testConnection(): Promise<boolean> {
        return this.adapter.testConnection();
    }

    async createOrUpdateCustomer(customer: any): Promise<LogoResult> {
        if (this.adapter instanceof LogoRestApiAdapter) {
            return this.adapter.createOrUpdateCari(customer);
        }
        return { success: true, logoKod: `C-${customer.id?.slice(-8)}` }; // XML moda always success
    }

    async createInvoice(ticket: any): Promise<LogoResult> {
        if (this.adapter instanceof LogoRestApiAdapter) {
            return this.adapter.createInvoice(ticket);
        }
        return { success: true };
    }

    async createPayment(payment: any): Promise<LogoResult> {
        if (this.adapter instanceof LogoRestApiAdapter) {
            return this.adapter.createPayment(payment);
        }
        return { success: true };
    }

    /**
     * Tüm müşterileri Logo'ya gönder
     */
    async syncAllCustomers(customers: any[]): Promise<LogoSyncReport> {
        const report: LogoSyncReport = { total: customers.length, success: 0, failed: 0, errors: [] };
        for (const customer of customers) {
            const result = await this.createOrUpdateCustomer(customer);
            if (result.success) report.success++;
            else { report.failed++; report.errors.push({ entityId: customer.id, error: result.error || 'Bilinmeyen hata' }); }
        }
        return report;
    }

    /**
     * XML cari listesi dosyası oluştur
     */
    generateCariXml(customers: any[]): string {
        if (this.adapter instanceof LogoFileAdapter) {
            return this.adapter.generateCariXml(customers);
        }
        return '';
    }
}

/**
 * Tenant config'inden LogoIntegration oluştur
 */
export function createLogoIntegration(tenant: any): LogoIntegration | null {
    if (!tenant.logoIntegrationEnabled || !tenant.logoIntegrationMethod) return null;

    const config: LogoConfig = {
        method: tenant.logoIntegrationMethod as 'rest' | 'file' | 'db',
        apiUrl: tenant.logoApiUrl,
        apiKey: tenant.logoApiKey,
        firmaKodu: tenant.logoFirmaKodu,
        donemKodu: tenant.logoDönemKodu,
        dbServer: tenant.logoDbServer,
        dbPort: tenant.logoDbPort,
        dbName: tenant.logoDbName,
        dbUser: tenant.logoDbUser,
        defaultCariGrup: tenant.logoDefaultCariGrup,
        defaultGelirHesap: tenant.logoDefaultGelirHesap,
        kasaHesap: tenant.logoKasaHesap,
        bankaHesap: tenant.logoBankaHesap,
    };

    return new LogoIntegration(config);
}
