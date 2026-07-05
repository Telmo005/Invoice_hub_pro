export interface Empresa {
    id: string
    nome: string
    nuip: string
    // Tipo do documento fiscal (NUIT/NIF/VAT/TIN/CPF/Outro) -- ver
    // DOCUMENTO_FISCAL_TIPOS em @/lib/validation.
    documento_tipo?: string
    pais: string
    cidade: string
    endereco: string
    telefone: string
    email: string
    pessoa_contato?: string
    padrao: boolean
    logo_url?: string | null
}