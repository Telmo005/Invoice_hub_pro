import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
    try {
        const publicKey = process.env.MPESA_PUBLIC_KEY;
        const apiKey = process.env.MPESA_API_KEY;

        console.log('🎯 TESTE FINAL - Verificando formato da chave...');
        console.log('Public Key:', publicKey);

        // Verificação básica
        if (!publicKey || publicKey.length < 700) {
            return NextResponse.json({
                success: false,
                error: `Public Key muito curta: ${publicKey?.length} caracteres (esperado ~790)`,
                yourKey: publicKey
            });
        }

        return NextResponse.json({
            success: true,
            keyLength: publicKey.length,
            hasBegin: publicKey.includes('BEGIN PUBLIC KEY'),
            hasEnd: publicKey.includes('END PUBLIC KEY'),
            recommendation: 'Key parece ter formato correto'
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido'
        });
    }
}