'use client'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import { ROUTES } from '@/config/routes'
import { useAuth } from '@/app/providers/AuthProvider'

export default function HeroSection() {
  const [invoiceLoading, setInvoiceLoading] = useState(false)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const router = useRouter()
  const { user } = useAuth()

  useEffect(() => {
    setReducedMotion(
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
    // Prefetch das rotas para melhor performance
    router.prefetch(ROUTES.INVOICES_NEW)
    router.prefetch(ROUTES.QUOTATIONS_NEW)
    router.prefetch(ROUTES.LOGIN)
  }, [router])

  const handleGenerateInvoice = () => {
    setInvoiceLoading(true)
    if (!user) {
      router.push(`${ROUTES.LOGIN}?redirect_to=${ROUTES.INVOICES_NEW}`)
    } else {
      setTimeout(() => {
        router.push(ROUTES.INVOICES_NEW)
      }, 300)
    }
  }

  const handleGenerateQuote = () => {
    setQuoteLoading(true)
    if (!user) {
      router.push(`${ROUTES.LOGIN}?redirect_to=${ROUTES.QUOTATIONS_NEW}`)
    } else {
      setTimeout(() => {
        router.push(ROUTES.QUOTATIONS_NEW)
      }, 300)
    }
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-slate-950 text-white flex items-center px-4 sm:px-6">
      {/* Background otimizado */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src="/dashboard_background_img.JPG"
          alt="Fundo abstrato financeiro"
          fill
          priority
          quality={30}
          className="object-cover opacity-30"
          sizes="100vw"
        />

        {/* Efeito de partículas reduzido */}
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-gradient-to-br from-amber-400/15 to-blue-400/5 blur-[40px]"
            style={{
              width: `${Math.random() * 200 + 80}px`,
              height: `${Math.random() * 200 + 80}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={reducedMotion ? {} : {
              opacity: [0.1, 0.2, 0.1],
              scale: [1, 1.1, 1],
            }}
            transition={reducedMotion ? {} : {
              duration: Math.random() * 8 + 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Conteúdo Principal */}
      <div className="relative z-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center py-20">
        {/* Texto + CTA */}
        <div className="text-center lg:text-left">
          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, x: -20 }}
            animate={reducedMotion ? {} : { opacity: 1, x: 0 }}
            transition={reducedMotion ? {} : { duration: 0.6 }}
            className="inline-flex items-center bg-slate-850 border border-slate-700 rounded-full px-4 py-2 mb-6 backdrop-blur-sm"
          >
            <div className="w-2 h-2 rounded-full bg-amber-400 mr-2 animate-pulse" />
            <span className="text-sm text-slate-200">DOCUMENTOS PROFISSIONAIS</span>
          </motion.div>

          <motion.h1
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 30 }}
            animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={reducedMotion ? {} : { duration: 0.8 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 leading-tight"
          >
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-200 to-amber-400 animate-text-shine">
              Cotações & Faturas que
            </span>
            <br />
            <span className="text-2xl sm:text-3xl md:text-4xl font-medium text-slate-300">
              Geram Confiança e Resultados
            </span>
          </motion.h1>

          <motion.p
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={reducedMotion ? {} : { opacity: 1 }}
            transition={reducedMotion ? {} : { duration: 0.6, delay: 0.4 }}
            className="text-lg text-slate-300 mb-8 max-w-lg mx-auto lg:mx-0 leading-relaxed"
          >
            Crie documentos financeiros com um <span className="text-amber-300 font-medium">design premiado</span> que eleva a percepção da sua marca e acelera pagamentos.
          </motion.p>

          <motion.div
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
            animate={reducedMotion ? {} : { opacity: 1, y: 0 }}
            transition={reducedMotion ? {} : { duration: 0.6, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
          >
            <button
              onClick={handleGenerateQuote}
              disabled={quoteLoading || invoiceLoading}
              className="relative inline-flex items-center justify-center border border-slate-700 hover:border-slate-600 bg-slate-850 hover:bg-slate-800 transition-all duration-300 font-medium rounded-lg px-8 py-3.5 text-white overflow-hidden group"
              aria-label="Gerar cotação"
            >
              <span className="relative z-10 flex items-center">
                {quoteLoading ? (
                  <>
                    <span>CARREGANDO...</span>
                    <svg className="w-5 h-5 ml-3 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </>
                ) : (
                  <>
                    <span>GERAR COTAÇÃO</span>
                    <svg
                      className="w-5 h-5 ml-3 group-hover:-translate-y-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                  </>
                )}
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>

            <button
              onClick={handleGenerateInvoice}
              disabled={invoiceLoading || quoteLoading}
              className="relative inline-flex items-center justify-center bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 transition-all duration-300 font-medium rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-95 px-8 py-3.5 text-white overflow-hidden group"
              aria-label="Gerar fatura"
            >
              <span className="relative z-10 flex items-center">
                {invoiceLoading ? (
                  <>
                    <span>CARREGANDO...</span>
                    <svg className="w-5 h-5 ml-3 animate-spin" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </>
                ) : (
                  <>
                    <span>GERAR FATURA</span>
                    <svg
                      className="w-5 h-5 ml-3 group-hover:-translate-y-1 transition-transform"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                  </>
                )}
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </motion.div>
        </div>

        {/* Imagem de Destaque */}
        <motion.div
          className="relative"
          initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
          animate={reducedMotion ? {} : { opacity: 1, scale: 1 }}
          transition={reducedMotion ? {} : { duration: 0.8, delay: 0.2 }}
        >
          <div className="relative aspect-[4/3] bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
            <Image
              src="/invoice-mockup-premium.JPG"
              alt="Fatura profissional em destaque"
              fill
              priority
              quality={70}
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/30 to-slate-950/70" />
          </div>

          {!reducedMotion && (
            <motion.div
              className="absolute -top-12 -left-12 w-64 h-64 rounded-full bg-amber-400/10 blur-3xl -z-10"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.3, 0.5, 0.3],
              }}
              transition={{
                duration: 12,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          )}

          {/* Miniaturas */}
          <div className="absolute -bottom-8 -right-8 flex gap-3">
            <motion.div
              className="w-24 h-32 rounded-lg overflow-hidden border-2 border-slate-800 shadow-lg"
              whileHover={reducedMotion ? {} : { y: -10 }}
              transition={reducedMotion ? {} : { type: "spring", stiffness: 400, damping: 10 }}
            >
              <Image
                src="/template_fatura_1.JPG"
                alt="Estilo de fatura minimalista"
                width={96}
                height={128}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </motion.div>
            <motion.div
              className="w-24 h-32 rounded-lg overflow-hidden border-2 border-slate-800 shadow-lg"
              whileHover={reducedMotion ? {} : { y: -10 }}
              transition={reducedMotion ? {} : { type: "spring", stiffness: 400, damping: 10, delay: 0.1 }}
            >
              <Image
                src="/invoice2.JPG"
                alt="Estilo de fatura corporativa"
                width={96}
                height={128}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </motion.div>
          </div>
        </motion.div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent z-20 pointer-events-none" />
    </section>
  )
}