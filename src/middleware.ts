import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Middleware aktif değil — tüm istekler doğrudan geçer
export function middleware(request: NextRequest) {
    return NextResponse.next();
}

export const config = {
    matcher: [],
};
