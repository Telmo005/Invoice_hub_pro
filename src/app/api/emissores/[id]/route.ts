// app/api/emissores/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

interface RouteParams {
    params: {
        id: string
    }
}

// Interface para resposta padronizada
interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: any;
    };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const startTime = Date.now();
    let user: any = null;
    let emissorId: string | null = null;

    try {
        const supabase = await supabaseServer()

        // Verificar autenticação
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            await logger.log({
                action: 'api_call',
                level: 'warn',
                message: 'Tentativa de acesso não autorizado à API de busca de emissor',
                details: { 
                    endpoint: '/api/emissores/[id]',
                    method: 'GET',
                    error: authError?.message 
                }
            });

            const errorResponse: ApiResponse = {
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Não autorizado',
                    details: 'Usuário não autenticado ou token inválido'
                }
            };
            return NextResponse.json(errorResponse, { status: 401 })
        }

        user = authUser;
        emissorId = params.id;

        // Log de tentativa de busca
        await logger.log({
            action: 'document_view',
            level: 'info',
            message: `Tentativa de buscar emissor: ${emissorId}`,
            details: {
                user: user.id,
                emissorId: emissorId,
                endpoint: '/api/emissores/[id]'
            }
        });

        const { id } = params

        // Buscar emitente específico
        const { data: emissor, error } = await supabase
            .from('emissores')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                await logger.log({
                    action: 'document_view',
                    level: 'warn',
                    message: 'Emissor não encontrado',
                    details: {
                        user: user.id,
                        emissorId: id,
                        error: 'Emissor não encontrado ou não pertence ao usuário'
                    }
                });

                const errorResponse: ApiResponse = {
                    success: false,
                    error: {
                        code: 'EMISSOR_NOT_FOUND',
                        message: 'Empresa não encontrada',
                        details: {
                            emissorId: id,
                            suggestion: 'Verifique se a empresa existe e pertence a você'
                        }
                    }
                };
                return NextResponse.json(errorResponse, { status: 404 })
            }

            await logger.logError(error, 'get_emissor_database', {
                user: user.id,
                emissorId: id,
                databaseError: error.message,
                databaseCode: error.code
            });

            console.error('Erro ao buscar emitente:', error)
            
            const errorResponse: ApiResponse = {
                success: false,
                error: {
                    code: 'DATABASE_ERROR',
                    message: 'Erro ao carregar dados da empresa',
                    details: {
                        databaseError: error.message,
                        suggestion: 'Tente novamente em alguns instantes'
                    }
                }
            };
            return NextResponse.json(errorResponse, { status: 500 })
        }

        // Log de sucesso
        await logger.log({
            action: 'document_view',
            level: 'info',
            message: `Emissor encontrado: ${emissor.nome_empresa}`,
            details: {
                user: user.id,
                emissorId: id,
                emissorNome: emissor.nome_empresa,
                documento: emissor.documento
            }
        });

        // Transformar para formato do frontend
        const empresa = {
            id: emissor.id,
            nome: emissor.nome_empresa,
            nuip: emissor.documento,
            pais: emissor.pais,
            cidade: emissor.cidade,
            endereco: emissor.bairro,
            telefone: emissor.telefone,
            email: emissor.email,
            pessoa_contato: emissor.pessoa_contato
        }

        const successResponse: ApiResponse<{ empresa: any }> = {
            success: true,
            data: { empresa }
        };

        return NextResponse.json(successResponse)

    } catch (error) {
        const duration = Date.now() - startTime;
        
        await logger.logError(error as Error, 'get_emissor_unexpected', {
            user: user?.id,
            emissorId,
            durationMs: duration,
            endpoint: '/api/emissores/[id]',
            method: 'GET'
        });

        console.error('Erro completo ao carregar emitente:', error)
        
        const errorResponse: ApiResponse = {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Erro interno do servidor',
                details: process.env.NODE_ENV === 'development' ? 
                    (error instanceof Error ? error.message : 'Erro desconhecido') : 
                    undefined
            }
        };
        
        return NextResponse.json(errorResponse, { status: 500 })
    } finally {
        const duration = Date.now() - startTime;
        
        // Log de performance da API
        await logger.logApiCall(
            '/api/emissores/[id]',
            'GET',
            duration,
            true
        );
    }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
    const startTime = Date.now();
    let user: any = null;
    let emissorId: string | null = null;
    let updateData: any = null;

    try {
        const supabase = await supabaseServer()

        // Verificar autenticação
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            await logger.log({
                action: 'api_call',
                level: 'warn',
                message: 'Tentativa de acesso não autorizado à API de atualização de emissor',
                details: { 
                    endpoint: '/api/emissores/[id]',
                    method: 'PUT',
                    error: authError?.message 
                }
            });

            const errorResponse: ApiResponse = {
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Não autorizado',
                    details: 'Usuário não autenticado ou token inválido'
                }
            };
            return NextResponse.json(errorResponse, { status: 401 })
        }

        user = authUser;
        emissorId = params.id;

        const { id } = params
        const body = await request.json();
        updateData = body;

        // Log de tentativa de atualização
        await logger.log({
            action: 'document_update',
            level: 'info',
            message: `Tentativa de atualizar emissor: ${id}`,
            details: {
                user: user.id,
                emissorId: id,
                updateData: {
                    nome_empresa: body.nome_empresa,
                    documento: body.documento,
                    pais: body.pais
                }
            }
        });

        // Atualizar emitente
        const { data: emissorAtualizado, error } = await supabase
            .from('emissores')
            .update({
                nome_empresa: body.nome_empresa,
                documento: body.documento,
                pais: body.pais,
                cidade: body.cidade,
                bairro: body.bairro,
                pessoa_contato: body.pessoa_contato,
                email: body.email,
                telefone: body.telefone,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .eq('user_id', user.id)
            .select()
            .single()

        if (error) {
            await logger.logError(error, 'update_emissor_database', {
                user: user.id,
                emissorId: id,
                updateData: body,
                databaseError: error.message,
                databaseCode: error.code
            });

            console.error('Erro ao atualizar emitente:', error)
            
            const errorResponse: ApiResponse = {
                success: false,
                error: {
                    code: 'DATABASE_ERROR',
                    message: 'Erro ao atualizar empresa',
                    details: {
                        databaseError: error.message,
                        suggestion: 'Verifique os dados e tente novamente'
                    }
                }
            };
            return NextResponse.json(errorResponse, { status: 500 })
        }

        // Log de sucesso
        await logger.log({
            action: 'document_update',
            level: 'audit',
            message: `Emissor atualizado com sucesso: ${emissorAtualizado.nome_empresa}`,
            details: {
                user: user.id,
                emissorId: id,
                emissorNome: emissorAtualizado.nome_empresa,
                documento: emissorAtualizado.documento,
                updateData: body
            }
        });

        const successResponse: ApiResponse<{ emissor: any }> = {
            success: true,
            data: {
                emissor: emissorAtualizado
            }
        };

        return NextResponse.json(successResponse)

    } catch (error) {
        const duration = Date.now() - startTime;
        
        await logger.logError(error as Error, 'update_emissor_unexpected', {
            user: user?.id,
            emissorId,
            updateData,
            durationMs: duration,
            endpoint: '/api/emissores/[id]',
            method: 'PUT'
        });

        console.error('Erro completo ao atualizar emitente:', error)
        
        const errorResponse: ApiResponse = {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Erro interno do servidor',
                details: process.env.NODE_ENV === 'development' ? 
                    (error instanceof Error ? error.message : 'Erro desconhecido') : 
                    undefined
            }
        };
        
        return NextResponse.json(errorResponse, { status: 500 })
    } finally {
        const duration = Date.now() - startTime;
        
        // Log de performance da API
        await logger.logApiCall(
            '/api/emissores/[id]',
            'PUT',
            duration,
            true
        );
    }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const startTime = Date.now();
    let user: any = null;
    let emissorId: string | null = null;
    let emissorInfo: any = null;

    try {
        const supabase = await supabaseServer()

        // Verificar autenticação
        const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

        if (authError || !authUser) {
            await logger.log({
                action: 'api_call',
                level: 'warn',
                message: 'Tentativa de acesso não autorizado à API de exclusão de emissor',
                details: { 
                    endpoint: '/api/emissores/[id]',
                    method: 'DELETE',
                    error: authError?.message 
                }
            });

            const errorResponse: ApiResponse = {
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Não autorizado',
                    details: 'Usuário não autenticado ou token inválido'
                }
            };
            return NextResponse.json(errorResponse, { status: 401 })
        }

        user = authUser;
        emissorId = params.id;

        const { id } = params

        // Log de tentativa de exclusão
        await logger.log({
            action: 'document_delete',
            level: 'info',
            message: `Tentativa de excluir emissor: ${id}`,
            details: {
                user: user.id,
                emissorId: id
            }
        });

        // Buscar informações do emissor antes de excluir (para logs)
        const { data: emissor } = await supabase
            .from('emissores')
            .select('nome_empresa, documento')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        emissorInfo = emissor;

        // Verificar se existem faturas vinculadas a este emitente
        const { data: faturas, error: checkError } = await supabase
            .from('faturas')
            .select('id')
            .eq('emitente_id', id)
            .eq('user_id', user.id)
            .limit(1)

        if (checkError) {
            await logger.logError(checkError, 'check_emissor_faturas', {
                user: user.id,
                emissorId: id,
                databaseError: checkError.message
            });
            console.error('Erro ao verificar faturas:', checkError)
        }

        if (faturas && faturas.length > 0) {
            await logger.log({
                action: 'document_delete',
                level: 'warn',
                message: `Tentativa de excluir emissor com faturas vinculadas: ${emissor?.nome_empresa}`,
                details: {
                    user: user.id,
                    emissorId: id,
                    emissorNome: emissor?.nome_empresa,
                    faturasCount: faturas.length,
                    blocked: true
                }
            });

            const errorResponse: ApiResponse = {
                success: false,
                error: {
                    code: 'EMISSOR_HAS_DOCUMENTS',
                    message: 'Não é possível excluir esta empresa pois existem faturas vinculadas a ela',
                    details: {
                        emissorId: id,
                        emissorNome: emissor?.nome_empresa,
                        faturasCount: faturas.length,
                        suggestion: 'Exclua ou transfira as faturas antes de excluir a empresa'
                    }
                }
            };
            return NextResponse.json(errorResponse, { status: 400 })
        }

        // Excluir emitente
        const { error } = await supabase
            .from('emissores')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id)

        if (error) {
            await logger.logError(error, 'delete_emissor_database', {
                user: user.id,
                emissorId: id,
                emissorNome: emissor?.nome_empresa,
                databaseError: error.message,
                databaseCode: error.code
            });

            console.error('Erro ao excluir emitente:', error)
            
            const errorResponse: ApiResponse = {
                success: false,
                error: {
                    code: 'DATABASE_ERROR',
                    message: 'Erro ao excluir empresa',
                    details: {
                        databaseError: error.message,
                        suggestion: 'Tente novamente em alguns instantes'
                    }
                }
            };
            return NextResponse.json(errorResponse, { status: 500 })
        }

        // Log de sucesso
        await logger.log({
            action: 'document_delete',
            level: 'audit',
            message: `Emissor excluído com sucesso: ${emissor?.nome_empresa}`,
            details: {
                user: user.id,
                emissorId: id,
                emissorNome: emissor?.nome_empresa,
                documento: emissor?.documento,
                operation: 'hard_delete'
            }
        });

        const successResponse: ApiResponse<{ message: string }> = {
            success: true,
            data: {
                message: 'Empresa excluída com sucesso'
            }
        };

        return NextResponse.json(successResponse)

    } catch (error) {
        const duration = Date.now() - startTime;
        
        await logger.logError(error as Error, 'delete_emissor_unexpected', {
            user: user?.id,
            emissorId,
            emissorInfo,
            durationMs: duration,
            endpoint: '/api/emissores/[id]',
            method: 'DELETE'
        });

        console.error('Erro completo ao excluir emitente:', error)
        
        const errorResponse: ApiResponse = {
            success: false,
            error: {
                code: 'INTERNAL_ERROR',
                message: 'Erro interno do servidor',
                details: process.env.NODE_ENV === 'development' ? 
                    (error instanceof Error ? error.message : 'Erro desconhecido') : 
                    undefined
            }
        };
        
        return NextResponse.json(errorResponse, { status: 500 })
    } finally {
        const duration = Date.now() - startTime;
        
        // Log de performance da API
        await logger.logApiCall(
            '/api/emissores/[id]',
            'DELETE',
            duration,
            true
        );
    }
}