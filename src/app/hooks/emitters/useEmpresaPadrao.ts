import { useState, useEffect, useCallback } from 'react'
import { Empresa } from '@/app/hooks/emitters/types/emissor'

interface UseEmpresaPadraoReturn {
    empresaPadrao: Empresa | null
    loading: boolean
    error: string | null
    definirEmpresaPadrao: (id: string) => Promise<void>
    refetch: () => Promise<void>
}

export function useEmpresaPadrao(): UseEmpresaPadraoReturn {
    const [empresaPadrao, setEmpresaPadrao] = useState<Empresa | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const carregarEmpresaPadrao = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/emissores/padrao')

            if (response.ok) {
                const data = await response.json()
                setEmpresaPadrao(data.empresa || null)
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar empresa padrão')
            console.error('Erro ao carregar empresa padrão:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    const definirEmpresaPadrao = useCallback(async (id: string) => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch(`/api/emissores/${id}/padrao`, {
                method: 'PATCH'
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Erro ao definir empresa como padrão')
            }

            // Recarregar a empresa padrão
            await carregarEmpresaPadrao()
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao definir empresa como padrão')
            throw err
        } finally {
            setLoading(false)
        }
    }, [carregarEmpresaPadrao])

    useEffect(() => {
        carregarEmpresaPadrao()
    }, [carregarEmpresaPadrao])

    return {
        empresaPadrao,
        loading,
        error,
        definirEmpresaPadrao,
        refetch: carregarEmpresaPadrao
    }
}