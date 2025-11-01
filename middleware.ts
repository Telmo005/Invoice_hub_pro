import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    // 1. Force HTTPS em produção
    if (process.env.NODE_ENV === 'production' &&
        request.headers.get('x-forwarded-proto') !== 'https') {
        return new Response('HTTPS required', { status: 426 });
    }

    // 2. Headers de segurança
    const response = NextResponse.next();

    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    // 3. CORS restritivo
    if (request.nextUrl.pathname.startsWith('/api/')) {
        response.headers.set('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || 'http://localhost:3000');
        response.headers.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
    }

    return response;
}