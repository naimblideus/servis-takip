/**
 * Tenant Manager — Tenant oluşturma ve yönetim yardımcıları
 */
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

const PLAN_LIMITS: Record<string, { maxUsers: number; maxTicketsPerMonth: number | null; storageLimitMB: number }> = {
    trial: { maxUsers: 2, maxTicketsPerMonth: 50, storageLimitMB: 200 },
    starter: { maxUsers: 3, maxTicketsPerMonth: 200, storageLimitMB: 500 },
    professional: { maxUsers: 10, maxTicketsPerMonth: null, storageLimitMB: 2000 },
    enterprise: { maxUsers: 50, maxTicketsPerMonth: null, storageLimitMB: 10000 },
};

interface CreateTenantInput {
    name: string;
    slug?: string;
    ownerName: string;
    phone: string;
    email: string;
    taxNumber?: string;
    taxOffice?: string;
    address?: string;
    city?: string;
    district?: string;
    businessType?: string;
    plan?: string;
    trialDays?: number;
    maxUsers?: number;
    adminNotes?: string;
    logo?: string;
}

/**
 * Yeni tenant oluştur + varsayılan admin kullanıcısı ekle
 */
export async function createTenant(input: CreateTenantInput): Promise<{ tenant: any; user: any; tempPassword: string }> {
    const plan = input.plan || 'trial';
    const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.trial;
    const trialDays = input.trialDays ?? 14;

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + trialDays);

    // Slug oluştur
    const slug = input.slug || generateSlug(input.name);

    // Geçici şifre oluştur
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Tenant + admin user tek transaction'da oluştur
    const result = await prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
            data: {
                name: input.name,
                slug,
                ownerName: input.ownerName,
                phone: input.phone,
                email: input.email,
                taxNumber: input.taxNumber,
                taxOffice: input.taxOffice,
                address: input.address,
                city: input.city,
                district: input.district,
                businessType: input.businessType || 'general',
                plan,
                trialEndsAt: plan === 'trial' ? trialEndsAt : null,
                isActive: true,
                maxUsers: input.maxUsers || limits.maxUsers,
                maxTicketsPerMonth: limits.maxTicketsPerMonth,
                storageLimitMB: limits.storageLimitMB,
                adminNotes: input.adminNotes,
                logo: input.logo,
            } as any,
        });

        const user = await tx.user.create({
            data: {
                tenantId: tenant.id,
                email: input.email,
                passwordHash,
                name: input.ownerName,
                role: 'ADMIN',
                isActive: true,
            },
        });

        // Abonelik geçmişi
        await (tx as any).subscriptionHistory.create({
            data: {
                tenantId: tenant.id,
                plan,
                action: 'created',
                notes: `Yeni işletme oluşturuldu. Deneme süresi: ${trialDays} gün`,
            },
        });

        return { tenant, user };
    });

    return { ...result, tempPassword };
}

/**
 * Slug üret
 */
export function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
}

/**
 * Geçici şifre üret (8 karakter)
 */
export function generateTempPassword(): string {
    const chars = 'abcdefhjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

/**
 * Fatura numarası üret
 */
export async function generateInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `FAT-${year}-`;

    const lastInvoice = await (prisma as any).tenantInvoice.findFirst({
        where: { invoiceNumber: { startsWith: prefix } },
        orderBy: { invoiceNumber: 'desc' },
    });

    let seq = 1;
    if (lastInvoice) {
        const lastSeq = parseInt(lastInvoice.invoiceNumber.split('-')[2] || '0');
        seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(4, '0')}`;
}

/**
 * Abonelik geçmişine kayıt ekle
 */
export async function addSubscriptionHistory(tenantId: string, action: string, plan: string, amount?: number, notes?: string) {
    await (prisma as any).subscriptionHistory.create({
        data: { tenantId, plan, action, amount, notes },
    });
}
