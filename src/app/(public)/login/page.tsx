'use client'
import React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { FcGoogle } from 'react-icons/fc'
import { FaFacebook, FaSpinner } from 'react-icons/fa'
import { useAuth } from '@/app/providers/AuthProvider'
import { ROUTES } from '@/config/routes'

function LoginContent() {
  const { signInWithOAuth } = useAuth()
  const [isLoading, setIsLoading] = React.useState(false)
  const [currentProvider, setCurrentProvider] = React.useState<'google' | 'facebook' | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect_to') || ROUTES.DASHBOARD
  const errorMessage = searchParams.get('error')

  const handleLogin = async (provider: 'google' | 'facebook') => {
    try {
      // MOSTRAR LOADING IMEDIATAMENTE
      setIsLoading(true)
      setCurrentProvider(provider)
      setError(null)
      
      // Pequeno delay para garantir que o spinner aparece
      await new Promise(resolve => setTimeout(resolve, 50))
      
      await signInWithOAuth(provider, redirectTo)
    } catch (err) {
      console.error("Login failed:", err)
      setIsLoading(false)
      setCurrentProvider(null)

      if (err instanceof Error) {
        setError(err.message || 'Falha ao fazer login. Por favor, tente novamente.')
      } else {
        setError('Falha ao fazer login. Por favor, tente novamente.')
      }
    }
  }

  React.useEffect(() => {
    if (errorMessage) {
      setError(decodeURIComponent(errorMessage))
    }
  }, [errorMessage])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
              <span className="text-white font-semibold text-sm">IH</span>
            </div>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Acesse sua conta
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Escolha como deseja fazer login
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-lg sm:px-10">
          <div className="space-y-4">
            {(error || errorMessage) && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error || errorMessage}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <button
                onClick={() => handleLogin('google')}
                disabled={isLoading}
                className="w-full relative inline-flex items-center justify-center bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200 font-medium rounded-lg shadow hover:shadow-md px-8 py-3.5 text-gray-700 overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center w-full">
                  {isLoading && currentProvider === 'google' ? (
                    <>
                      <FaSpinner className="w-5 h-5 mr-3 animate-spin text-blue-600" />
                      <span className="text-gray-600">Abrindo Google...</span>
                    </>
                  ) : (
                    <>
                      <FcGoogle className="w-5 h-5 mr-3" />
                      <span>Continuar com Google</span>
                    </>
                  )}
                </span>
              </button>
            </div>

            <div className='hidden'>
              <button
                onClick={() => handleLogin('facebook')}
                disabled={isLoading}
                className="w-full relative inline-flex items-center justify-center bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200 font-medium rounded-lg shadow hover:shadow-md px-8 py-3.5 text-gray-700 overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center w-full">
                  {isLoading && currentProvider === 'facebook' ? (
                    <>
                      <FaSpinner className="w-5 h-5 mr-3 animate-spin text-blue-600" />
                      <span className="text-gray-600">Abrindo Facebook...</span>
                    </>
                  ) : (
                    <>
                      <FaFacebook className="w-5 h-5 mr-3 text-blue-600" />
                      <span>Continuar com Facebook</span>
                    </>
                  )}
                </span>
              </button>
            </div>

            <div className="relative pt-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  Ao continuar você concorda com nossos termos
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-gray-500">
          <p>
            Ao fazer login, você concorda com nossos{' '}
            <Link href="#" className="text-blue-600 hover:text-blue-500">
              Termos de Serviço
            </Link>
            ,{' '}
            <Link href="#" className="text-blue-600 hover:text-blue-500">
              Política de Privacidade
            </Link>{' '}
            e{' '}
            <Link href="#" className="text-blue-600 hover:text-blue-500">
              Política de Cookies
            </Link>.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md">
              <span className="text-white font-semibold text-sm">IH</span>
            </div>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Acesse sua conta
          </h2>
          <div className="mt-8 flex justify-center">
            <FaSpinner className="animate-spin text-indigo-600 h-8 w-8" />
          </div>
        </div>
      </div>
    }>
      <LoginContent />
    </React.Suspense>
  )
}