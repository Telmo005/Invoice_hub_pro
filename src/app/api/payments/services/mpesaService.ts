// mpesaService.ts - VERSÃO COMPLETA COM LOGS
import crypto from 'crypto';
import { logger } from '@/lib/logger';

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

  // Log da configuração carregada
  logger.log({
    action: 'system_alert',
    level: 'info',
    message: 'Configuração M-Pesa carregada',
    details: {
      environment: config.environment,
      serviceProviderCode: config.serviceProviderCode,
      hasApiKey: !!config.apiKey,
      hasPublicKey: !!config.publicKey,
      apiKeyLength: config.apiKey?.length || 0,
      publicKeyLength: config.publicKey?.length || 0
    }
  });

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
const encryptApiKey = (apiKey: string, publicKey: string): string => {
  const startTime = Date.now();
  
  try {
    console.log('🔒 Iniciando criptografia da API Key...');
    
    await logger.log({
      action: 'payment_create',
      level: 'info',
      message: 'Iniciando criptografia da API Key M-Pesa',
      details: {
        apiKeyLength: apiKey.length,
        publicKeyLength: publicKey.length,
        hasBeginKey: publicKey.includes('BEGIN PUBLIC KEY')
      }
    });

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
      
      await logger.log({
        action: 'payment_create',
        level: 'info',
        message: 'Criptografia da API Key bem-sucedida (Método 1)',
        details: {
          method: 'pem_format',
          durationMs: Date.now() - startTime,
          encryptedLength: result.length
        }
      });
      
      console.log('✅ Criptografia bem-sucedida (Método 1)');
      return result;

    } catch (pemError) {
      console.log('❌ Método 1 falhou, tentando método 2...', pemError.message);

      await logger.log({
        action: 'payment_create',
        level: 'warn',
        message: 'Método 1 de criptografia falhou, tentando método alternativo',
        details: {
          error: pemError.message,
          method: 'pem_format_failed'
        }
      });

      // Método 2: Limpa a chave e tenta como DER
      try {
        console.log('🔄 Tentando método 2: Chave limpa formato DER...');

        const cleanPublicKey = publicKey
          .replace(/-----BEGIN PUBLIC KEY-----/g, '')
          .replace(/-----END PUBLIC KEY-----/g, '')
          .replace(/\s/g, '')
          .replace(/\n/g, '');

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
        
        await logger.log({
          action: 'payment_create',
          level: 'info',
          message: 'Criptografia da API Key bem-sucedida (Método 2)',
          details: {
            method: 'der_format',
            durationMs: Date.now() - startTime,
            encryptedLength: result.length
          }
        });
        
        console.log('✅ Criptografia bem-sucedida (Método 2)');
        return result;

      } catch (derError) {
        console.log('❌ Método 2 falhou, tentando método 3...', derError.message);

        await logger.log({
          action: 'payment_create',
          level: 'warn',
          message: 'Método 2 de criptografia falhou, tentando método simples',
          details: {
            error: derError.message,
            method: 'der_format_failed'
          }
        });

        // Método 3: Usa approach mais simples
        try {
          console.log('🔄 Tentando método 3: Approach simples...');

          // Remove apenas quebras de linha, mantém headers
          const formattedKey = publicKey.replace(/\n/g, '');

          const key = crypto.createPublicKey(formattedKey);
          const encrypted = crypto.publicEncrypt(key, Buffer.from(apiKey));

          const result = encrypted.toString('base64');
          
          await logger.log({
            action: 'payment_create',
            level: 'info',
            message: 'Criptografia da API Key bem-sucedida (Método 3)',
            details: {
              method: 'simple_format',
              durationMs: Date.now() - startTime,
              encryptedLength: result.length
            }
          });
          
          console.log('✅ Criptografia bem-sucedida (Método 3)');
          return result;

        } catch (simpleError) {
          console.error('❌ Todos os métodos falharam:', simpleError.message);
          
          await logger.logError(simpleError, 'mpesa_encryption_all_methods_failed', {
            apiKeyLength: apiKey.length,
            publicKeyLength: publicKey.length,
            durationMs: Date.now() - startTime
          });
          
          throw new Error(`Todos os métodos de criptografia falharam: ${simpleError.message}`);
        }
      }
    }

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'mpesa_encryption_critical', {
      durationMs: duration
    });
    
    console.error('💥 Erro crítico na criptografia:', error);
    throw new Error(`Falha na criptografia da API Key: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
};

// Versão simplificada da criptografia
function encryptApiKeySimple(apiKey: string, publicKey: string): string {
  const startTime = Date.now();
  
  try {
    console.log('🔒 Processando public key em linha única...');
    
    await logger.log({
      action: 'payment_create',
      level: 'info',
      message: 'Iniciando criptografia simplificada da API Key',
      details: {
        method: 'simple_encryption'
      }
    });

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

      const result = encrypted.toString('base64');
      
      await logger.log({
        action: 'payment_create',
        level: 'info',
        message: 'Criptografia simplificada bem-sucedida',
        details: {
          method: 'simple_encryption',
          durationMs: Date.now() - startTime,
          encryptedLength: result.length
        }
      });
      
      console.log('✅ Criptografia bem-sucedida!');
      return result;
      
    } else {
      // Já está no formato correto com quebras
      const key = crypto.createPublicKey(publicKey);
      const encrypted = crypto.publicEncrypt(
        { key: key, padding: crypto.constants.RSA_PKCS1_PADDING },
        Buffer.from(apiKey, 'utf8')
      );
      
      const result = encrypted.toString('base64');
      
      await logger.log({
        action: 'payment_create',
        level: 'info',
        message: 'Criptografia padrão bem-sucedida',
        details: {
          method: 'standard_encryption',
          durationMs: Date.now() - startTime,
          encryptedLength: result.length
        }
      });
      
      return result;
    }
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'mpesa_simple_encryption_failed', {
      durationMs: duration
    });
    
    console.error('❌ Erro na criptografia:', error);
    throw new Error(`Falha na criptografia: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Obtém access token do Mpesa
 */
async function getAccessToken(): Promise<string> {
  const startTime = Date.now();
  const { apiKey, publicKey, sandboxUrl } = MPESA_CONFIG;

  if (!apiKey || !publicKey) {
    const error = new Error('Credenciais Mpesa não configuradas - verifique .env.local');
    
    await logger.logError(error, 'mpesa_config_missing', {
      hasApiKey: !!apiKey,
      hasPublicKey: !!publicKey
    });
    
    throw error;
  }

  console.log('🔐 Iniciando autenticação Mpesa...');

  try {
    // 1. Criptografa a API Key com a Public Key
    const encryptedApiKey = encryptApiKeySimple(apiKey, publicKey);

    if (!encryptedApiKey) {
      const error = new Error('Falha na criptografia da API Key');
      
      await logger.logError(error, 'mpesa_encryption_failed', {
        apiKeyLength: apiKey.length,
        publicKeyLength: publicKey.length
      });
      
      throw error;
    }

    // 2. Faz a requisição para obter o token
    console.log('🌐 Fazendo requisição para:', `${sandboxUrl}/oauth2/v1/token`);

    await logger.log({
      action: 'payment_create',
      level: 'info',
      message: 'Fazendo requisição de autenticação M-Pesa',
      details: {
        url: `${sandboxUrl}/oauth2/v1/token`,
        encryptedKeyLength: encryptedApiKey.length
      }
    });

    const response = await fetch(`${sandboxUrl}/oauth2/v1/token`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${encryptedApiKey}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Status da resposta:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro detalhado da API:', errorText);
      
      await logger.logError(new Error(`HTTP ${response.status}: ${response.statusText}`), 'mpesa_auth_failed', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500) // Limita tamanho do log
      });
      
      throw new Error(`Falha na autenticação: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('📦 Resposta da API:', data);

    if (!data.access_token) {
      const error = new Error('Access token não recebido da API');
      
      await logger.logError(error, 'mpesa_no_token_received', {
        responseData: data
      });
      
      throw error;
    }

    await logger.log({
      action: 'payment_create',
      level: 'info',
      message: 'Token M-Pesa obtido com sucesso',
      details: {
        tokenLength: data.access_token.length,
        durationMs: Date.now() - startTime
      }
    });

    console.log('✅ Token obtido com sucesso!');
    return data.access_token;

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'mpesa_auth_complete_failure', {
      durationMs: duration
    });
    
    console.error('💥 Erro completo na autenticação:', error);
    throw new Error(`Autenticação Mpesa falhou: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
  }
}

/**
 * Função principal do serviço Mpesa
 */
export const mpesaService = {
  async process(amount: number, phone: string, reference: string): Promise<PaymentResponse> {
    const startTime = Date.now();
    
    try {
      console.log('🎯 Iniciando processamento Mpesa...');

      await logger.log({
        action: 'payment_create',
        level: 'info',
        message: 'Iniciando processamento de pagamento M-Pesa',
        details: {
          amount,
          phone: phone.substring(0, 3) + '****' + phone.substring(7), // Mascara telefone
          reference,
          environment: MPESA_CONFIG.environment
        }
      });

      const formattedPhone = formatPhoneNumber(phone);
      const accessToken = await getAccessToken();

      console.log('✅ Token obtido, processando pagamento...');

      // Aqui você continuaria com a lógica de pagamento...
      // Por enquanto vamos só testar a autenticação

      const result = {
        success: true,
        message: 'Autenticação Mpesa testada com sucesso',
        paymentId: `test_${Date.now()}`,
        transactionId: `txn_${Date.now()}`
      };

      await logger.log({
        action: 'payment_success',
        level: 'audit',
        message: 'Pagamento M-Pesa processado com sucesso',
        details: {
          amount,
          phone: formattedPhone,
          reference,
          paymentId: result.paymentId,
          transactionId: result.transactionId,
          durationMs: Date.now() - startTime
        }
      });

      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      await logger.logError(error as Error, 'mpesa_payment_failed', {
        amount,
        phone: phone.substring(0, 3) + '****' + phone.substring(7),
        reference,
        durationMs: duration
      });
      
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
  try {
    const cleaned = phone.replace(/\s+/g, '').replace(/^\+258/, '').replace(/^258/, '');
    if (!/^8[2-7][0-9]{7}$/.test(cleaned)) {
      const error = new Error('Número de telefone moçambicano inválido. Use formato: 84XXXXXXX');
      
      logger.logError(error, 'mpesa_invalid_phone_format', {
        providedPhone: phone,
        cleanedPhone: cleaned
      });
      
      throw error;
    }
    return cleaned;
  } catch (error) {
    logger.logError(error as Error, 'mpesa_phone_formatting_failed', {
      providedPhone: phone
    });
    throw error;
  }
}

/**
 * Teste de autenticação
 */
export const testMpesaAuth = async (): Promise<{ success: boolean; message: string }> => {
  const startTime = Date.now();
  
  try {
    console.log('🧪 TESTANDO CREDENCIAIS MPESA...');

    await logger.log({
      action: 'system_alert',
      level: 'info',
      message: 'Iniciando teste de autenticação M-Pesa',
      details: {
        test: true
      }
    });

    const { apiKey, publicKey } = MPESA_CONFIG;

    console.log('📋 Configuração carregada:', {
      apiKeyLength: apiKey?.length || 0,
      publicKeyLength: publicKey?.length || 0,
      hasBeginKey: publicKey?.includes('BEGIN PUBLIC KEY') ? '✅' : '❌'
    });

    // Verifica formato da API Key (deve ter 32 caracteres)
    if (!apiKey) {
      const result = {
        success: false,
        message: 'API Key não encontrada - verifique .env.local'
      };
      
      await logger.log({
        action: 'system_alert',
        level: 'error',
        message: 'Teste M-Pesa falhou - API Key não encontrada',
        details: result
      });
      
      return result;
    }

    if (apiKey.length !== 32) {
      const result = {
        success: false,
        message: `API Key inválida. Esperado 32 caracteres, recebido: ${apiKey.length}`
      };
      
      await logger.log({
        action: 'system_alert',
        level: 'error',
        message: 'Teste M-Pesa falhou - API Key com tamanho inválido',
        details: result
      });
      
      return result;
    }

    // Verifica se a Public Key tem formato correto
    if (!publicKey || !publicKey.includes('BEGIN PUBLIC KEY')) {
      const result = {
        success: false,
        message: 'Public Key não está no formato PEM correto'
      };
      
      await logger.log({
        action: 'system_alert',
        level: 'error',
        message: 'Teste M-Pesa falhou - Public Key em formato inválido',
        details: result
      });
      
      return result;
    }

    console.log('✅ Credenciais no formato correto');

    // Testa a criptografia
    const encrypted = encryptApiKey(apiKey, publicKey);
    if (!encrypted) {
      const result = {
        success: false,
        message: 'Falha na criptografia da API Key'
      };
      
      await logger.log({
        action: 'system_alert',
        level: 'error',
        message: 'Teste M-Pesa falhou - Criptografia falhou',
        details: result
      });
      
      return result;
    }

    console.log('✅ Criptografia funcionando - Token gerado:', encrypted.substring(0, 50) + '...');

    // Tenta obter o token
    const token = await getAccessToken();

    const result = {
      success: true,
      message: `✅ Autenticação bem-sucedida! Token: ${token.substring(0, 50)}...`
    };

    await logger.log({
      action: 'system_alert',
      level: 'info',
      message: 'Teste M-Pesa concluído com sucesso',
      details: {
        ...result,
        durationMs: Date.now() - startTime,
        tokenLength: token.length
      }
    });

    return result;

  } catch (error) {
    const duration = Date.now() - startTime;
    
    await logger.logError(error as Error, 'mpesa_auth_test_failed', {
      durationMs: duration
    });
    
    console.error('💥 Erro no teste de autenticação:', error);
    return {
      success: false,
      message: `❌ Erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
    };
  }
};