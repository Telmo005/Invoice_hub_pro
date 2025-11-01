// mpesaService.ts - VERSÃO COMPLETA CORRIGIDA

import crypto from 'crypto';

// Configuração do Mpesa
export const getMpesaConfig = () => {
  const config = {
    apiKey: process.env.MPESA_API_KEY!,
    publicKey: process.env.MPESA_PUBLIC_KEY!,
    serviceProviderCode: process.env.MPESA_SERVICE_PROVIDER_CODE || '171717',
    environment: (process.env.MPESA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production',
    sandboxUrl: 'https://api.sandbox.vm.co.mz',
    productionUrl: 'https://api.mpesa.vm.co.mz'
  };

  console.log('🔧 Configuração Mpesa carregada:', {
    apiKey: config.apiKey ? `✅ (${config.apiKey.substring(0, 8)}...)` : '❌ Faltando',
    publicKey: config.publicKey ? `✅ (${config.publicKey.substring(0, 50)}...)` : '❌ Faltando',
    serviceProviderCode: config.serviceProviderCode,
    environment: config.environment
  });

  return config;
};

export const MPESA_CONFIG = getMpesaConfig();

// Interfaces
export interface PaymentResponse {
  success: boolean;
  paymentId?: string;
  transactionId?: string;
  message?: string;
  error?: string;
  details?: any;
}

/**
 * Criptografa a API Key usando a Public Key (RSA)
 */
// SUBSTITUA a função encryptApiKey por esta:

const encryptApiKey = (apiKey: string, publicKey: string): string => {
  try {
    console.log('🔒 Iniciando criptografia da API Key...');
    console.log('📝 API Key:', apiKey);
    console.log('📝 Public Key (primeiros 100 chars):', publicKey.substring(0, 100));

    // Método 1: Tenta com a chave completa (formato PEM)
    try {
      console.log('🔄 Tentando método 1: Formato PEM completo...');

      const key = crypto.createPublicKey({
        key: publicKey,
        format: 'pem'
      });

      const encrypted = crypto.publicEncrypt(
        {
          key: key,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(apiKey, 'utf8')
      );

      const result = encrypted.toString('base64');
      console.log('✅ Criptografia bem-sucedida (Método 1)');
      return result;

    } catch (pemError) {
      console.log('❌ Método 1 falhou, tentando método 2...', pemError.message);

      // Método 2: Limpa a chave e tenta como DER
      try {
        console.log('🔄 Tentando método 2: Chave limpa formato DER...');

        const cleanPublicKey = publicKey
          .replace(/-----BEGIN PUBLIC KEY-----/g, '')
          .replace(/-----END PUBLIC KEY-----/g, '')
          .replace(/\s/g, '')
          .replace(/\n/g, '');

        console.log('📝 Chave limpa (primeiros 50 chars):', cleanPublicKey.substring(0, 50));

        const keyBuffer = Buffer.from(cleanPublicKey, 'base64');

        const key = crypto.createPublicKey({
          key: keyBuffer,
          format: 'der',
          type: 'spki'
        });

        const encrypted = crypto.publicEncrypt(
          {
            key: key,
            padding: crypto.constants.RSA_PKCS1_PADDING,
          },
          Buffer.from(apiKey, 'utf8')
        );

        const result = encrypted.toString('base64');
        console.log('✅ Criptografia bem-sucedida (Método 2)');
        return result;

      } catch (derError) {
        console.log('❌ Método 2 falhou, tentando método 3...', derError.message);

        // Método 3: Usa approach mais simples
        try {
          console.log('🔄 Tentando método 3: Approach simples...');

          // Remove apenas quebras de linha, mantém headers
          const formattedKey = publicKey.replace(/\n/g, '');

          const key = crypto.createPublicKey(formattedKey);
          const encrypted = crypto.publicEncrypt(key, Buffer.from(apiKey));

          const result = encrypted.toString('base64');
          console.log('✅ Criptografia bem-sucedida (Método 3)');
          return result;

        } catch (simpleError) {
          console.error('❌ Todos os métodos falharam:', simpleError.message);
          throw new Error(`Todos os métodos de criptografia falharam: ${simpleError.message}`);
        }
      }
    }

  } catch (error) {
    console.error('💥 Erro crítico na criptografia:', error);
    throw new Error(`Falha na criptografia da API Key: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
};

// ALTERNATIVA: Se os métodos acima não funcionarem, use esta versão:

// Atualize a função encryptApiKeySimple para lidar com linha única
// Atualize a função encryptApiKeySimple para lidar com linha única
function encryptApiKeySimple(apiKey: string, publicKey: string): string {
  try {
    console.log('🔒 Processando public key em linha única...');
    
    // Verifica se está em linha única (sem quebras)
    if (!publicKey.includes('\n') && publicKey.includes('BEGIN PUBLIC KEY')) {
      console.log('📝 Detectada public key em linha única, formatando...');
      
      // Extrai o conteúdo base64 entre os headers
      const base64Content = publicKey
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .trim();
      
      // Reconstrói no formato PEM padrão com quebras de linha
      const pemKey = `-----BEGIN PUBLIC KEY-----\n${base64Content}\n-----END PUBLIC KEY-----`;
      
      console.log('✅ Public key formatada para PEM padrão');
      const key = crypto.createPublicKey(pemKey);
      
      const encrypted = crypto.publicEncrypt(
        {
          key: key,
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(apiKey, 'utf8')
      );

      console.log('✅ Criptografia bem-sucedida!');
      return encrypted.toString('base64');
      
    } else {
      // Já está no formato correto com quebras
      const key = crypto.createPublicKey(publicKey);
      const encrypted = crypto.publicEncrypt(
        { key: key, padding: crypto.constants.RSA_PKCS1_PADDING },
        Buffer.from(apiKey, 'utf8')
      );
      return encrypted.toString('base64');
    }
    
  } catch (error) {
    console.error('❌ Erro na criptografia:', error);
    throw new Error(`Falha na criptografia: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

// Adicione esta função para debug
const debugPublicKey = (publicKey: string) => {
  console.log('🔍 DEBUG DA PUBLIC KEY:');
  console.log('Tamanho total:', publicKey.length);
  console.log('Tem BEGIN:', publicKey.includes('BEGIN PUBLIC KEY'));
  console.log('Tem END:', publicKey.includes('END PUBLIC KEY'));
  console.log('Número de quebras de linha:', (publicKey.match(/\n/g) || []).length);
  console.log('Primeiros 200 caracteres:', publicKey.substring(0, 200));
  console.log('Últimos 100 caracteres:', publicKey.substring(publicKey.length - 100));
};

/**
 * Obtém access token do Mpesa
 */
async function getAccessToken(): Promise<string> {
  const { apiKey, publicKey, sandboxUrl } = MPESA_CONFIG;

  if (!apiKey || !publicKey) {
    throw new Error('Credenciais Mpesa não configuradas - verifique .env.local');
  }

  console.log('🔐 Iniciando autenticação Mpesa...');

  try {
    // 1. Criptografa a API Key com a Public Key
    //const encryptedApiKey = encryptApiKey(apiKey, publicKey);
    const encryptedApiKey = encryptApiKeySimple(apiKey, publicKey);

    if (!encryptedApiKey) {
      throw new Error('Falha na criptografia da API Key');
    }

    // 2. Faz a requisição para obter o token
    console.log('🌐 Fazendo requisição para:', `${sandboxUrl}/oauth2/v1/token`);

    const response = await fetch(`${sandboxUrl}/oauth2/v1/token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${encryptedApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Status da resposta:', response.status);
    console.log('📡 Headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro detalhado da API:', errorText);
      throw new Error(`Falha na autenticação: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📦 Resposta da API:', data);

    if (!data.access_token) {
      throw new Error('Access token não recebido da API');
    }

    console.log('✅ Token obtido com sucesso!');
    return data.access_token;

  } catch (error) {
    console.error('💥 Erro completo na autenticação:', error);
    throw new Error(`Autenticação Mpesa falhou: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Função principal do serviço Mpesa
 */
export const mpesaService = {
  async process(amount: number, phone: string, reference: string): Promise<PaymentResponse> {
    try {
      console.log('🎯 Iniciando processamento Mpesa...');

      const formattedPhone = formatPhoneNumber(phone);
      const accessToken = await getAccessToken();

      console.log('✅ Token obtido, processando pagamento...');

      // Aqui você continuaria com a lógica de pagamento...
      // Por enquanto vamos só testar a autenticação

      return {
        success: true,
        message: 'Autenticação Mpesa testada com sucesso',
        paymentId: `test_${Date.now()}`,
        transactionId: `txn_${Date.now()}`
      };

    } catch (error) {
      console.error('❌ Erro no MpesaService:', error);
      return {
        success: false,
        error: `Falha no Mpesa: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  },
};

/**
 * Formata número de telefone
 */
function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\s+/g, '').replace(/^\+258/, '').replace(/^258/, '');
  if (!/^8[2-7][0-9]{7}$/.test(cleaned)) {
    throw new Error('Número de telefone moçambicano inválido. Use formato: 84XXXXXXX');
  }
  return cleaned;
}

/**
 * Teste de autenticação
 */
export const testMpesaAuth = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🧪 TESTANDO CREDENCIAIS MPESA...');

    const { apiKey, publicKey } = MPESA_CONFIG;

    console.log('📋 Configuração carregada:', {
      apiKeyLength: apiKey?.length || 0,
      publicKeyLength: publicKey?.length || 0,
      hasBeginKey: publicKey?.includes('BEGIN PUBLIC KEY') ? '✅' : '❌'
    });

    // Verifica formato da API Key (deve ter 32 caracteres)
    if (!apiKey) {
      return {
        success: false,
        message: 'API Key não encontrada - verifique .env.local'
      };
    }

    if (apiKey.length !== 32) {
      return {
        success: false,
        message: `API Key inválida. Esperado 32 caracteres, recebido: ${apiKey.length}`
      };
    }

    // Verifica se a Public Key tem formato correto
    if (!publicKey || !publicKey.includes('BEGIN PUBLIC KEY')) {
      return {
        success: false,
        message: 'Public Key não está no formato PEM correto'
      };
    }

    console.log('✅ Credenciais no formato correto');

    // Testa a criptografia
    const encrypted = encryptApiKey(apiKey, publicKey);
    if (!encrypted) {
      return {
        success: false,
        message: 'Falha na criptografia da API Key'
      };
    }

    console.log('✅ Criptografia funcionando - Token gerado:', encrypted.substring(0, 50) + '...');

    // Tenta obter o token
    const token = await getAccessToken();

    return {
      success: true,
      message: `✅ Autenticação bem-sucedida! Token: ${token.substring(0, 50)}...`
    };

  } catch (error) {
    console.error('💥 Erro no teste de autenticação:', error);
    return {
      success: false,
      message: `❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
};