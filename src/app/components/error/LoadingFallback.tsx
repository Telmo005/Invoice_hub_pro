// app/components/error/LoadingFallback.tsx
import { FiLoader, FiAlertCircle, FiRefreshCw } from 'react-icons/fi';

interface LoadingFallbackProps {
    type?: 'loading' | 'error' | 'empty';
    message?: string;
    onRetry?: () => void;
    className?: string;
}

export const LoadingFallback: React.FC<LoadingFallbackProps> = ({
    type = 'loading',
    message,
    onRetry,
    className = ''
}) => {
    const getContent = () => {
        switch (type) {
            case 'loading':
                return {
                    icon: <FiLoader className="animate-spin text-blue-500" />,
                    title: 'Carregando...',
                    description: message || 'Estamos preparando seus dados.',
                    showAction: false
                };

            case 'error':
                return {
                    icon: <FiAlertCircle className="text-red-500" />,
                    title: 'Erro ao carregar',
                    description: message || 'Não foi possível carregar as informações.',
                    showAction: true
                };

            case 'empty':
                return {
                    icon: <FiAlertCircle className="text-gray-400" />,
                    title: 'Nada por aqui',
                    description: message || 'Nenhum dado encontrado.',
                    showAction: false
                };

            default:
                return {
                    icon: <FiLoader className="animate-spin text-blue-500" />,
                    title: 'Carregando...',
                    description: 'Aguarde um momento.',
                    showAction: false
                };
        }
    };

    const content = getContent();

    return (
        <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
            <div className="text-4xl mb-4">
                {content.icon}
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-2 text-center">
                {content.title}
            </h3>

            <p className="text-gray-600 text-center mb-6 max-w-sm">
                {content.description}
            </p>

            {content.showAction && onRetry && (
                <button
                    onClick={onRetry}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg transition-colors"
                >
                    <FiRefreshCw className="h-4 w-4" />
                    Tentar Novamente
                </button>
            )}
        </div>
    );
};