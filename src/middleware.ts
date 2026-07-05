import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { ROUTES } from '@/config/routes';

function isPrivatePath(pathname: string): boolean {
  return ROUTES.getPrivateRoutes().some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export async function middleware(request: NextRequest) {
  // Nonce por pedido para o CSP (ver M2 em docs/auditoria-inicial.md): permite
  // remover 'unsafe-inline' de script-src. Propagado como header do pedido
  // para que Route Handlers/Server Components o possam ler e aplicar aos
  // seus próprios <script> inline (ex.: document/view, document/pdf).
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  let response = NextResponse.next({ request: { headers: requestHeaders } });

  // Auth gating para rotas privadas (defesa em profundidade -- ver A1 em
  // docs/auditoria-inicial.md: nada verificava autenticação antes disto,
  // cada página/rota API tinha de se lembrar de o fazer sozinha).
  // Não se aplica a /api/* (essas rotas fazem a sua própria verificação e
  // devolvem 401 JSON; redirecionar para /login quebraria os clientes fetch).
  if (!request.nextUrl.pathname.startsWith('/api/') && isPrivatePath(request.nextUrl.pathname)) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({ request: { headers: requestHeaders } });
            cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      const loginUrl = new URL(ROUTES.LOGIN, request.url);
      loginUrl.searchParams.set('redirect_to', request.nextUrl.pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Request ID propagation
  const incomingId = request.headers.get('x-request-id');
  // Gera um requestId estável. Usa randomUUID se disponível, caso contrário fallback simples.
  const requestId = incomingId ?? (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2));
  response.headers.set('X-Request-Id', requestId);

  // 1. Headers de Segurança (Sempre aplicados) + CSP & cross-origin policies
  const securityHeaders: Record<string,string> = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), location=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      // Nonce + strict-dynamic em vez de 'unsafe-inline' (ver M2 em
      // docs/auditoria-inicial.md). 'self' fica como fallback para browsers
      // sem suporte a strict-dynamic. style-src mantém 'unsafe-inline'
      // deliberadamente -- ver nota em docs/auditoria-inicial.md sobre os
      // atributos style="" inline do React, que nonce não cobre.
      `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'none'"
    ].join('; '),
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin'
  };

  Object.entries(securityHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // 2. Force HTTPS em produção (Approach melhorado)
  if (process.env.NODE_ENV === 'production') {
    const proto = request.headers.get('x-forwarded-proto');
    const host = request.headers.get('host');

    if (proto === 'http') {
      return NextResponse.redirect(
        `https://${host}${request.nextUrl.pathname}${request.nextUrl.search}`,
        301
      );
    }

    // HSTS Header para HTTPS
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
  }

  // 3. CORS para APIs (Approach mais robusto)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
    response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
    response.headers.set('Vary', 'Origin');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-client-info, x-request-id, x-csrf-token');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: response.headers,
      });
    }
  }

  // 4. Proteção adicional para rotas administrativas
  if (request.nextUrl.pathname.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }

  return response;
}

// Configuração do middleware - Defina quais rotas devem ser processadas
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
