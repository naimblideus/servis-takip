import { NextResponse } from 'next/server';
import { AKTIF_SSO } from '@/lib/auth';

// GET /api/auth/sso — giriş ekranı hangi kurumsal giriş düğmelerini göstereceğini
// buradan öğrenir. Yalnız "açık mı" bilgisi döner; hiçbir anahtar sızmaz.
export async function GET() {
  return NextResponse.json(AKTIF_SSO);
}
