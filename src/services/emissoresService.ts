// lib/services/emissoresService.ts
interface Empresa {
  id: string;
  nome: string;
  nuip: string;
  pais: string;
  cidade: string;
  endereco: string;
  telefone: string;
  email: string;
  pessoa_contato?: string;
  padrao?: boolean;
}

interface ApiResponse<T> {
  success?: boolean;
  empresas?: T[];
  empresa?: T;
  emissor?: any;
  error?: string;
  message?: string;
}

class EmissoresService {
  private baseUrl = '/api/emissores';

  async listarEmpresas(): Promise<Empresa[]> {
    try {
      const response = await fetch(this.baseUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar empresas');
      }

      const data: ApiResponse<Empresa> = await response.json();
      return data.empresas || [];
    } catch (error) {
      console.error('Erro ao listar empresas:', error);
      throw error;
    }
  }

  async buscarEmpresaPorId(id: string): Promise<Empresa> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar empresa');
      }

      const data: ApiResponse<Empresa> = await response.json();
      
      if (!data.empresa) {
        throw new Error('Empresa não encontrada');
      }

      return data.empresa;
    } catch (error) {
      console.error('Erro ao buscar empresa:', error);
      throw error;
    }
  }

  async criarEmpresa(empresaData: Omit<Empresa, 'id' | 'padrao'>): Promise<Empresa> {
    try {
      // Mapear para o formato do banco de dados
      const emissorData = {
        nome_empresa: empresaData.nome,
        documento: empresaData.nuip,
        pais: empresaData.pais,
        cidade: empresaData.cidade,
        bairro: empresaData.endereco,
        pessoa_contato: empresaData.pessoa_contato,
        email: empresaData.email,
        telefone: empresaData.telefone
      };

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emissorData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao criar empresa');
      }

      const data: ApiResponse<Empresa> = await response.json();
      
      if (!data.emissor) {
        throw new Error('Erro ao criar empresa');
      }

      // Transformar de volta para o formato do frontend
      return {
        id: data.emissor.id,
        nome: data.emissor.nome_empresa,
        nuip: data.emissor.documento,
        pais: data.emissor.pais,
        cidade: data.emissor.cidade,
        endereco: data.emissor.bairro,
        telefone: data.emissor.telefone,
        email: data.emissor.email,
        pessoa_contato: data.emissor.pessoa_contato
      };
    } catch (error) {
      console.error('Erro ao criar empresa:', error);
      throw error;
    }
  }

  async atualizarEmpresa(id: string, empresaData: Omit<Empresa, 'id' | 'padrao'>): Promise<Empresa> {
    try {
      const emissorData = {
        nome_empresa: empresaData.nome,
        documento: empresaData.nuip,
        pais: empresaData.pais,
        cidade: empresaData.cidade,
        bairro: empresaData.endereco,
        pessoa_contato: empresaData.pessoa_contato,
        email: empresaData.email,
        telefone: empresaData.telefone
      };

      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(emissorData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao atualizar empresa');
      }

      const data: ApiResponse<Empresa> = await response.json();
      
      if (!data.emissor) {
        throw new Error('Erro ao atualizar empresa');
      }

      return {
        id: data.emissor.id,
        nome: data.emissor.nome_empresa,
        nuip: data.emissor.documento,
        pais: data.emissor.pais,
        cidade: data.emissor.cidade,
        endereco: data.emissor.bairro,
        telefone: data.emissor.telefone,
        email: data.emissor.email,
        pessoa_contato: data.emissor.pessoa_contato
      };
    } catch (error) {
      console.error('Erro ao atualizar empresa:', error);
      throw error;
    }
  }

  async excluirEmpresa(id: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir empresa');
      }

      const data: ApiResponse<Empresa> = await response.json();
      
      if (!data.success) {
        throw new Error('Erro ao excluir empresa');
      }
    } catch (error) {
      console.error('Erro ao excluir empresa:', error);
      throw error;
    }
  }
}

export const emissoresService = new EmissoresService();