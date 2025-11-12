import { useState, useCallback } from 'react'

interface Empresa {
    id: string
    padrao: boolean
    nome: string
    nuip: string
    pais: string
    cidade: string
    endereco: string
    pessoa_contato: string
    email: string
    telefone: string
}

interface UseCrudEmissoresReturn {
    loading: boolean
    error: string | null
    adicionarEmpresa: (empresa: Omit<Empresa, 'id' | 'padrao'>) => Promise<void>
    editarEmpresa: (id: string, empresa: Omit<Empresa, 'id' | 'padrao'>) => Promise<void>
    excluirEmpresa: (id: string) => Promise<void>
}

export function useCrudEmissores(): UseCrudEmissoresReturn {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const adicionarEmpresa = useCallback(async (empresaData: Omit<Empresa, 'id' | 'padrao'>) => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/emissores', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nome_empresa: empresaData.nome,
                    documento: empresaData.nuip,
                    pais: empresaData.pais,
                    cidade: empresaData.cidade,
                    bairro: empresaData.endereco,
                    pessoa_contato: empresaData.pessoa_contato,
                    email: empresaData.email,
                    telefone: empresaData.telefone
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Erro ao adicionar empresa')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao adicionar empresa')
            throw err
        } finally {
            setLoading(false)
        }
    }, [])

    const editarEmpresa = useCallback(async (id: string, empresaData: Omit<Empresa, 'id' | 'padrao'>) => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/emissores/${id}`, {
                method: 'PATCH', // ✅ CORRIGIDO: PUT → PATCH
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nome_empresa: empresaData.nome,
                    documento: empresaData.nuip,
                    pais: empresaData.pais,
                    cidade: empresaData.cidade,
                    bairro: empresaData.endereco,
                    pessoa_contato: empresaData.pessoa_contato,
                    email: empresaData.email,
                    telefone: empresaData.telefone
                })
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Erro ao editar empresa')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao editar empresa')
            throw err
        } finally {
            setLoading(false)
        }
    }, [])

    const excluirEmpresa = useCallback(async (id: string) => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/emissores/${id}`, {
                method: 'DELETE'
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Erro ao excluir empresa')
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao excluir empresa')
            throw err
        } finally {
            setLoading(false)
        }
    }, [])

    return {
        loading,
        error,
        adicionarEmpresa,
        editarEmpresa,
        excluirEmpresa
    }
}