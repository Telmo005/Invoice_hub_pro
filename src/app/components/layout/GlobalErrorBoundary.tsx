'use client';
import React from 'react';
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'react-icons/fi';

interface Props {
    children: React.ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: React.ErrorInfo;
}

export class GlobalErrorBoundary extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('💥 Erro capturado pelo Error Boundary:', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack
        });

        this.setState({
            error,
            errorInfo
        });

        // Aqui você pode enviar para um serviço de monitoramento
        // Sentry.captureException(error, { extra: errorInfo });
    }

    handleReset = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    handleGoHome = () => {
        window.location.href = '/';
    };

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 flex items-center justify-center p-4">
                    <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-red-100 p-8 text-center">
                        <div className="flex justify-center mb-6">
                            <div className="bg-red-100 p-4 rounded-full">
                                <FiAlertTriangle className="h-12 w-12 text-red-600" />
                            </div>
                        </div>

                        <h1 className="text-2xl font-bold text-gray-900 mb-3">
                            Oops! Algo deu errado
                        </h1>

                        <p className="text-gray-600 mb-6">
                            Encontramos um problema inesperado. Não se preocupe, seus dados estão seguros.
                        </p>

                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                            <p className="text-sm text-red-800 font-medium mb-2">
                                Detalhes técnicos (para desenvolvimento):
                            </p>
                            <code className="text-xs text-red-600 break-words">
                                {this.state.error?.message || 'Erro desconhecido'}
                            </code>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                onClick={this.handleReset}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <FiRefreshCw className="h-4 w-4" />
                                Tentar Novamente
                            </button>

                            <button
                                onClick={this.handleGoHome}
                                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors"
                            >
                                <FiHome className="h-4 w-4" />
                                Página Inicial
                            </button>
                        </div>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <p className="text-xs text-gray-500">
                                Se o problema persistir, entre em contato com o suporte:
                                <a
                                    href="mailto:digitalhub.midia@gmail.com"
                                    className="text-blue-600 hover:text-blue-800 ml-1"
                                >
                                    digitalhub.midia@gmail.com
                                </a>
                            </p>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}