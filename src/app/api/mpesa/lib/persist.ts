import { logger } from '@/lib/logger';

export async function persistMpesaPayment(params: {
  supabase: any;
  userId: string;
  transaction_reference: string;
  third_party_reference?: string;
  formattedMsisdn: string;
  amount: number;
  moeda: string;
  tipo_documento: 'fatura' | 'cotacao' | 'recibo';
  mpesaData: any;
  originalBody: any;
}) {
  const { supabase, userId, transaction_reference, third_party_reference, formattedMsisdn, amount, moeda, tipo_documento, mpesaData, originalBody } = params;
  const { data: pagamento, error: pagamentoError } = await supabase
    .from('pagamentos')
    .insert({
      user_id: userId,
      documento_id: null,
      tipo_documento,
      external_id: transaction_reference,
      metodo: 'mpesa',
      status: 'aguardando_documento',
      valor: amount,
      moeda,
      phone_number: formattedMsisdn,
      mpesa_transaction_id: mpesaData?.transaction_id || null,
      mpesa_conversation_id: mpesaData?.conversation_id || null,
      mpesa_third_party_reference: third_party_reference || null,
      metadata: { originalPayload: originalBody }
    })
    .select()
    .single();

  if (pagamentoError) {
    await logger.logError(pagamentoError, 'mpesa_payment_db_insert', { transactionReference: transaction_reference });
    return { ok: false, error: pagamentoError };
  }

  await supabase.from('mpesa_transactions').insert({
    pagamento_id: pagamento.id,
    transaction_reference,
    third_party_reference: third_party_reference || null,
    mpesa_transaction_id: mpesaData?.transaction_id || null,
    mpesa_conversation_id: mpesaData?.conversation_id || null,
    customer_msisdn: formattedMsisdn,
    amount,
    response_code: mpesaData?.response_code || '0',
    response_description: mpesaData?.response_description || 'SUCCESS',
    status: 'completed',
    request_payload: {
      transaction_reference,
      customer_msisdn: formattedMsisdn,
      amount,
      third_party_reference,
      service_provider_code: '171717'
    },
    response_payload: mpesaData || null
  });

  return { ok: true, pagamento };
}
