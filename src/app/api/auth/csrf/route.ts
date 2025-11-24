import { NextRequest, NextResponse } from 'next/server';
import { generateCsrfToken } from '@/lib/security/csrf';

// Endpoint para emissão de token CSRF.
// Uso: cliente faz GET, recebe token e guarda em memória; envia em mutações no header `x-csrf-token`.
// Cookie httpOnly é definido para verificação server-side.

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const existing = request.cookies.get('csrf_token')?.value;
  const token = existing || generateCsrfToken();

  const response = NextResponse.json({ csrfToken: token });
  // Definições seguras do cookie
  response.cookies.set('csrf_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 // 1 hora
  });

  // Expor também header para fácil captura em fetch se desejado
  response.headers.set('X-CSRF-Token', token);
  return response;
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
}
