export const ROUTES = {
  // Rotas públicas
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  ABOUT: '/about',
  CONTACT: '/contact',
  DASHBOARD: '/dashboard',

  // Rotas privadas (requerem autenticação)
  PROFILE: '/pages/PROFILE',
  ENTITIES: '/pages/emitters/entities',
  SETTINGS: '/settings',
  INVOICES: '/invoices',
  QUOTES_INVOICES: '/pages/documents/documentsPanel',
  INVOICES_NEW: '/invoices/new',
  QUOTATIONS_NEW: '/quotations/new',

  // Rotas da API
  API: {
    AUTH: '/api/auth',
    USERS: '/api/users',
  },

  // Utilitários
  getPublicRoutes: () => [
    ROUTES.HOME,
    ROUTES.LOGIN,
    ROUTES.REGISTER,
    ROUTES.FORGOT_PASSWORD,
    ROUTES.RESET_PASSWORD,
    ROUTES.ABOUT,
    ROUTES.CONTACT,
    ROUTES.DASHBOARD,
  ],

  getPrivateRoutes: () => [
    ROUTES.PROFILE,
    ROUTES.ENTITIES,
    ROUTES.SETTINGS,
    ROUTES.INVOICES,
    ROUTES.INVOICES_NEW,
    ROUTES.QUOTATIONS_NEW,
  ],

  isPublicRoute: (path: string) => ROUTES.getPublicRoutes().includes(path),
  isPrivateRoute: (path: string) => ROUTES.getPrivateRoutes().includes(path),
}

export type AppRoute = keyof typeof ROUTES