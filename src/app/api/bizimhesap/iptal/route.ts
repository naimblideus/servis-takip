import { NextResponse } from 'next/server';
import { requireAdminUser, authErrorResponse } from '@/lib/api-auth';
import { bizimHesaptaIptal } from '@/lib/bizimhesap-veri';

// POST { id } — Nextus'ta iptal edilmiş ve Bizim Hesap'a gitmiş faturayı orada da iptal eder.
export async function POST(req: Request) {
  let tenantId: string;
  try { ({ tenantId } = await requireAdminUser()); } catch (e) { return authErrorResponse(e); }
  let govde: { id?: unknown };
  try { govde = await req.json(); } catch { return NextResponse.json({ kod: 'GECERSIZ' }, { status: 400 }); }
  if (typeof govde?.id !== 'string' || !govde.id) return NextResponse.json({ kod: 'GECERSIZ' }, { status: 400 });
  const r = await bizimHesaptaIptal(tenantId, govde.id);
  return NextResponse.json(r, { status: r.durum === 'IPTAL' ? 200 : 400 });
}
