import { useListarEmissores } from '@/app/hooks/emitters/useListarEmissores'
import { useEmpresaPadrao } from '@/app/hooks/emitters/useEmpresaPadrao'
import { useCrudEmissores } from '@/app/hooks/emitters/useCrudEmissores'
import { Empresa } from '@/app/hooks/emitters/types/emissor'

interface UseEmissoresReturn {
    empresas: Empresa[]
    loading: boolean
    error: string | null
    adicionarEmpresa: (empresa: Omit<Empresa, 'id' | 'padrao'>) => Promise<void>
    editarEmpresa: (id: string, empresa: Omit<Empresa, 'id' | 'padrao'>) => Promise<void>
    excluirEmpresa: (id: string) => Promise<void>
    definirEmpresaPadrao: (id: string) => Promise<void>
    empresaPadrao: Empresa | null
    refetch: () => Promise<void>
}

export function useEmissores(): UseEmissoresReturn {
    const {
        empresas,
        loading: loadingList,
        error: errorList,
        refetch: refetchList
    } = useListarEmissores()

    const {
        empresaPadrao,
        loading: loadingPadrao,
        error: errorPadrao,
        definirEmpresaPadrao,
        refetch: refetchPadrao
    } = useEmpresaPadrao()

    const {
        loading: loadingCrud,
        error: errorCrud,
        adicionarEmpresa,
        editarEmpresa,
        excluirEmpresa
    } = useCrudEmissores()

    const refetchCompleto = async () => {
        await Promise.all([refetchList(), refetchPadrao()])
    }

    const handleAdicionarEmpresa = async (empresa: Omit<Empresa, 'id' | 'padrao'>) => {
        await adicionarEmpresa(empresa)
        await refetchCompleto()
    }

    const handleEditarEmpresa = async (id: string, empresa: Omit<Empresa, 'id' | 'padrao'>) => {
        await editarEmpresa(id, empresa)
        await refetchCompleto()
    }

    const handleExcluirEmpresa = async (id: string) => {
        await excluirEmpresa(id)
        await refetchCompleto()
    }

    const handleDefinirEmpresaPadrao = async (id: string) => {
        await definirEmpresaPadrao(id)
        await refetchCompleto()
    }

    return {
        empresas,
        loading: loadingList || loadingPadrao || loadingCrud,
        error: errorList || errorPadrao || errorCrud,
        adicionarEmpresa: handleAdicionarEmpresa,
        editarEmpresa: handleEditarEmpresa,
        excluirEmpresa: handleExcluirEmpresa,
        definirEmpresaPadrao: handleDefinirEmpresaPadrao,
        empresaPadrao,
        refetch: refetchCompleto
    }
}