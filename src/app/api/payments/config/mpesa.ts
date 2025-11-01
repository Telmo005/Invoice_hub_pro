export interface MpesaConfig {
    apiKey: string;
    publicKey: string;
    serviceProviderCode: string;
    environment: 'sandbox' | 'production';
    initiatorIdentifier?: string;
    securityCredential?: string;
}

export const getMpesaConfig = (): MpesaConfig => {
    const environment = (process.env.MPESA_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';

    const config = {
        apiKey: process.env.MPESA_API_KEY!,
        publicKey: process.env.MPESA_PUBLIC_KEY!,
        serviceProviderCode: process.env.MPESA_SERVICE_PROVIDER_CODE!,
        environment,
        initiatorIdentifier: process.env.MPESA_INITIATOR_IDENTIFIER,
        securityCredential: process.env.MPESA_SECURITY_CREDENTIAL,
    };

    // Validação em produção
    if (environment === 'production') {
        const missing = Object.entries(config)
            .filter(([key, value]) => !value && key !== 'initiatorIdentifier' && key !== 'securityCredential')
            .map(([key]) => key);

        if (missing.length > 0) {
            throw new Error(`❌ Configuração Mpesa incompleta para produção: ${missing.join(', ')}`);
        }
    }

    return config;
};

export const MPESA_URLS = {
    sandbox: {
        base: 'https://api.sandbox.vm.co.mz',
        token: 'https://api.sandbox.vm.co.mz/oauth2/v1/token',
        payment: 'https://api.sandbox.vm.co.mz/ipg/v1/vodacommpesa/c2bPayment/singleStage/'
    },
    production: {
        base: 'https://api.mpesa.vm.co.mz',
        token: 'https://api.mpesa.vm.co.mz/oauth2/v1/token',
        payment: 'https://api.mpesa.vm.co.mz/ipg/v1/vodacommpesa/c2bPayment/singleStage/'
    }
};