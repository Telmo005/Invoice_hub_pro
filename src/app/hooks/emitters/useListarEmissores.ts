import { useState, useEffect, useCallback } from 'react'
import { Empresa } from '@/app/hooks/emitters/types/emissor'

interface UseListarEmissoresReturn {
    empresas: Empresa[]
    loading: boolean
    error: string | null
    refetch: () => Promise<void>
}

export function useListarEmissores(): UseListarEmissoresReturn {
    const [empresas, setEmpresas] = useState<Empresa[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const carregarEmpresas = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const response = await fetch('/api/emissores')

            if (!response.ok) {
                throw new Error('Erro ao carregar empresas')
            }

            const data = await response.json()
            setEmpresas(data.empresas || [])
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar empresas')
            console.error('Erro ao carregar empresas:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        carregarEmpresas()
    }, [carregarEmpresas])

    return {
        empresas,
        loading,
        error,
        refetch: carregarEmpresas
    }
}