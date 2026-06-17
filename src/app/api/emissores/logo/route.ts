import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { withApiGuard } from '@/lib/api/guard';
import { logger } from '@/lib/logger';

export const POST = withApiGuard(async (request: NextRequest, { user }) => {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Nenhum ficheiro enviado' }, { status: 400 });
    }

    // Validar tipo de ficheiro
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Formato de imagem inválido. Use JPEG, PNG, GIF, WEBP ou SVG.' }, { status: 400 });
    }

    // Validar tamanho (máx 2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Tamanho da imagem excede o limite de 2MB.' }, { status: 400 });
    }

    const supabase = supabaseAdmin;

    // Ler ficheiro em ArrayBuffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Gerar caminho único: user_id/timestamp.ext
    const extension = file.name.split('.').pop() || 'png';
    const filePath = `${user.id}/${Date.now()}.${extension}`;

    // Upload para Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      await logger.logError(uploadError, 'logo_upload_storage_error');
      if (uploadError.message?.includes('bucket') || (uploadError as any).status === 404) {
        return NextResponse.json({ 
          error: 'Bucket "logos" não configurado no Supabase. Por favor crie o bucket público "logos".' 
        }, { status: 500 });
      }
      return NextResponse.json({ error: 'Erro ao fazer upload da imagem' }, { status: 500 });
    }

    // Obter URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('logos')
      .getPublicUrl(filePath);

    return { url: publicUrl };
  } catch (err) {
    await logger.logError(err as Error, 'logo_upload_endpoint_error');
    return NextResponse.json({ error: 'Erro no processamento do upload' }, { status: 500 });
  }
}, { auth: true, rate: { limit: 10, intervalMs: 60_000 }, csrf: true, auditAction: 'logo_upload' });

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-csrf-token',
    },
  });
}
