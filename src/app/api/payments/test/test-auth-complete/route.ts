import { NextResponse } from 'next/server';
import crypto from 'crypto';

function encryptApiKeyFixed(apiKey: string, publicKey: string): string {
    try {
        console.log('🔒 Usando criptografia corrigida para linha única...');
        console.log('📋 Public Key length:', publicKey.length);
        console.log('📋 Public Key (início):', publicKey.substring(0, 100));

        // Processa a chave (linha única ou formatada)
        let pemKey = publicKey;
        if (!publicKey.includes('\n') && publicKey.includes('BEGIN PUBLIC KEY')) {
            console.log('🔄 Detectada linha única, reformatando...');
            const base64Content = publicKey
                .replace('-----BEGIN PUBLIC KEY-----', '')
                .replace('-----END PUBLIC KEY-----', '')
                .trim();

            pemKey = `-----BEGIN PUBLIC KEY-----\n${base64Content}\n-----END PUBLIC KEY-----`;

            console.log('✅ Public key reformatada para PEM');
        }

        console.log('📝 Chave PEM final (início):', pemKey.substring(0, 100));

        const key = crypto.createPublicKey(pemKey);
        console.log('✅ Chave pública criada com sucesso!');

        const encrypted = crypto.publicEncrypt(
            {
                key: key,
                padding: crypto.constants.RSA_PKCS1_PADDING,
            },
            Buffer.from(apiKey, 'utf8')
        );

        const result = encrypted.toString('base64');
        console.log('✅ Criptografia bem-sucedida! Tamanho:', result.length);
        return result;

    } catch (error) {
        console.error('❌ Erro na criptografia corrigida:', error);
        throw new Error(`Falha na criptografia: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
}

export async function GET() {
    try {
        const publicKey = process.env.MPESA_PUBLIC_KEY;
        const apiKey = process.env.MPESA_API_KEY;
        const sandboxUrl = 'https://api.sandbox.vm.co.mz';

        if (!apiKey || !publicKey) {
            return NextResponse.json({
                success: false,
                error: 'Credenciais não configuradas'
            }, { status: 400 });
        }

        console.log('🚀 INICIANDO TESTE COMPLETO CORRIGIDO');
        console.log('📋 API Key length:', apiKey.length);
        console.log('📋 Public Key length:', publicKey.length);

        // 1. Testa criptografia com a função corrigida
        console.log('1. 🔒 Testando criptografia corrigida...');
        const encryptedApiKey = encryptApiKeyFixed(apiKey, publicKey);
        console.log('✅ Criptografia OK - Token gerado');

        // 2. Testa autenticação com API
        console.log('2. 🌐 Testando autenticação com API Mpesa...');

        const response = await fetch(`${sandboxUrl}/oauth2/v1/token`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${encryptedApiKey}`,
                'Content-Type': 'application/json',
            },
        });

        console.log('📡 Status:', response.status);
        console.log('📡 Status Text:', response.statusText);

        if (!response.ok) {
            let errorText = 'Erro sem detalhes';
            try {
                errorText = await response.text();
            } catch (e) {
                errorText = 'Não foi possível ler o corpo do erro';
            }

            console.error('❌ Erro da API:', errorText);

            return NextResponse.json({
                success: false,
                step: 'authentication',
                status: response.status,
                statusText: response.statusText,
                error: `API retornou erro ${response.status}`,
                details: errorText.substring(0, 500)
            }, { status: 400 });
        }

        const data = await response.json();
        console.log('✅ Resposta da API recebida');

        if (!data.access_token) {
            console.error('❌ Token não encontrado na resposta:', data);
            return NextResponse.json({
                success: false,
                step: 'token_extraction',
                error: 'Access token não encontrado na resposta',
                responseData: data
            }, { status: 400 });
        }

        console.log('✅ Token obtido com sucesso!');

        return NextResponse.json({
            success: true,
            message: '🎉 AUTENTICAÇÃO MPESA BEM-SUCEDIDA!',
            tokenPreview: data.access_token.substring(0, 50) + '...',
            tokenLength: data.access_token.length,
            steps: {
                encryption: '✅ OK',
                api_connection: '✅ OK',
                token_received: '✅ OK'
            }
        });

    } catch (error) {
        console.error('💥 ERRO NO TESTE COMPLETO:', error);

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Erro desconhecido',
            step: 'execution'
        }, { status: 500 });
    }
}