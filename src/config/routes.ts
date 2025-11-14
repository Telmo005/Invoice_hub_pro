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
  ENTITIES: '/pages/emitters/overview',
  SETTINGS: '/settings',
  INVOICES: '/invoices',
  QUOTES_INVOICES: '/pages/documents/overview',
  INVOICES_NEW: '/pages/invoices/new',
  QUOTATIONS_NEW: '/pages/quotations/new',

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