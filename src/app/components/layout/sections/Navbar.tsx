'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import Image from "next/image";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers/AuthProvider';
import { ROUTES } from '@/config/routes';
// Importações do Font Awesome
import { library } from '@fortawesome/fontawesome-svg-core';
import {
  faBars,
  faXmark,
  faUser,
  faRightFromBracket,
  faFileInvoice,
  faFileLines,
  faChevronDown,
  faGauge,
  faGear,
  faSignInAlt,
  faSpinner,
  faBuilding,
  faPlus
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

// Adiciona os ícones à biblioteca
library.add(
  faBars,
  faXmark,
  faUser,
  faRightFromBracket,
  faFileInvoice,
  faFileLines,
  faChevronDown,
  faGauge,
  faGear,
  faSignInAlt,
  faSpinner,
  faBuilding,
  faPlus
);

// Mapeamento de ícones
const ICONS = {
  faBars,
  faXmark,
  faUser,
  faSignOutAlt: faRightFromBracket,
  faFileInvoice,
  faFileAlt: faFileLines,
  faChevronDown,
  faGauge,
  faGear,
  faSignIn: faSignInAlt,
  faSpinner,
  faBuilding,
  faPlus,
  faCompany: faBuilding
};

// Interfaces
interface User {
  user_metadata?: {
    avatar_url?: string;
    picture?: string;
    name?: string;
  };
  identities?: Array<{
    identity_data?: {
      avatar_url?: string;
    };
  }>;
  image?: string;
  email?: string;
}

interface NavLinkProps {
  href: string;
  icon: string;
  label: string;
  onClick?: () => void;
  isLoading?: boolean;
}

interface DropdownLinkProps {
  href: string;
  icon: string;
  label: string;
  onClick: () => void;
  isLoading?: boolean;
}

// Hook personalizado para manipulação do avatar
const useUserAvatar = (user: User | null) => {
  const isValidUrl = (url: string) => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  return useMemo(() => {
    if (!user) return null;

    const sources = [
      user?.user_metadata?.avatar_url,
      user?.user_metadata?.picture,
      user?.identities?.[0]?.identity_data?.avatar_url,
      user?.image
    ].filter(Boolean) as string[];

    return sources.find(isValidUrl) || null;
  }, [user]);
};

// Hook para detectar clique fora do elemento - CORRIGIDO
const useClickOutside = (ref: React.RefObject<HTMLElement | null>, callback: () => void) => {
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, callback]);
};

// Componente Skeleton para loading
const AvatarSkeleton = () => (
  <div className="w-9 h-9 rounded-full bg-gray-200 animate-pulse" />
);

// Componentes reutilizáveis
const NavLink = ({ href, icon, label, onClick, isLoading = false }: NavLinkProps) => {
  const iconObj = ICONS[icon as keyof typeof ICONS];

  return (
    <Link 
      href={href} 
      className="group" 
      prefetch={false}
      onClick={onClick}
    >
      <div className={`flex items-center gap-2 text-gray-600 hover:text-indigo-600 px-3 py-2 text-sm font-medium transition-all rounded-lg hover:bg-gray-50 ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {isLoading ? (
          <FontAwesomeIcon
            icon={ICONS.faSpinner}
            className="text-xs text-gray-500 animate-spin"
          />
        ) : (
          iconObj && (
            <FontAwesomeIcon
              icon={iconObj}
              className="text-xs text-gray-500 group-hover:text-indigo-500 transition-colors"
            />
          )
        )}
        <span>{isLoading ? 'Carregando...' : label}</span>
      </div>
    </Link>
  );
};

const _DropdownLink = ({ href, icon, label, onClick, isLoading = false }: DropdownLinkProps) => {
  const iconObj = ICONS[icon as keyof typeof ICONS];

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      prefetch={false}
    >
      {isLoading ? (
        <FontAwesomeIcon icon={ICONS.faSpinner} className="text-gray-500 animate-spin" />
      ) : (
        iconObj && <FontAwesomeIcon icon={iconObj} className="text-gray-500" />
      )}
      <span>{isLoading ? 'Carregando...' : label}</span>
    </Link>
  );
};

const MobileDropdownLink = ({ href, icon, label, onClick, isLoading = false }: DropdownLinkProps) => {
  const iconObj = ICONS[icon as keyof typeof ICONS];

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      prefetch={false}
    >
      {isLoading ? (
        <FontAwesomeIcon icon={ICONS.faSpinner} className="text-gray-500 animate-spin" />
      ) : (
        iconObj && <FontAwesomeIcon icon={iconObj} className="text-gray-500" />
      )}
      <span>{isLoading ? 'Carregando...' : label}</span>
    </Link>
  );
};

export default function Navbar() {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isNavigating, setIsNavigating] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();

  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileDropdownRef = useRef<HTMLDivElement>(null);

  const avatarUrl = useUserAvatar(user);
  const userDisplayName = useMemo(() => (
    user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário'
  ), [user]);

  useClickOutside(dropdownRef, () => setDropdownOpen(false));
  useClickOutside(mobileDropdownRef, () => setMobileDropdownOpen(false));

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleDropdown = () => setDropdownOpen(!dropdownOpen);
  const toggleMobileDropdown = () => setMobileDropdownOpen(!mobileDropdownOpen);
  const closeDropdown = () => setDropdownOpen(false);
  const closeMobileDropdown = () => setMobileDropdownOpen(false);

  const handleNavigate = async (route: string, label: string) => {
    setIsNavigating(label);
    closeDropdown();
    closeMobileDropdown();
    
    // Pequeno delay para mostrar o loading
    await new Promise(resolve => setTimeout(resolve, 25));
    router.push(route);
  };

  const handleNavigateToLogin = () => {
    setIsRedirecting(true);
    router.push(ROUTES.LOGIN);
  };

  const handleSignOut = async () => {
    try {
      setIsSigningOut(true);
      closeDropdown();
      closeMobileDropdown();
      await signOut();
      // Garantia adicional: redireciona para a página inicial após logout
      try {
        router.replace(ROUTES.HOME);
      } catch (_) {
        // fallback para forçar reload caso o router falhe
        try { window.location.href = ROUTES.HOME; } catch (_) { /* ignore */ }
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <nav className={`fixed top-0 z-50 w-full transition-all duration-300 ${scrolled ? 'bg-white/90 backdrop-blur-md shadow-sm' : 'bg-white/80 backdrop-blur-lg'}`}>
      <div className="max-w-7xl mx-auto px-6 py-2 flex justify-between items-center">
        {/* Logo */}
        <Link href={ROUTES.HOME} className="flex items-center gap-3 group" prefetch={false}>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
            <span className="text-white font-semibold text-xs">IH</span>
          </div>
          <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 text-transparent bg-clip-text tracking-tight">
            Invoice Hub
          </span>
          <span className="text-[11px] text-indigo-800 bg-indigo-100 px-2 py-[2px] rounded-full font-medium shadow-sm">PRO</span>
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-4">
          {!user ? (
            <button
              onClick={handleNavigateToLogin}
              disabled={isRedirecting}
              className="flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:border-indigo-300 hover:shadow-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRedirecting ? (
                <>
                  <FontAwesomeIcon
                    icon={ICONS.faSpinner}
                    className="text-gray-500 animate-spin"
                  />
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={ICONS.faSignIn} className="text-gray-500" />
                  <span>Login</span>
                </>
              )}
            </button>
          ) : (
            <>
              <NavLink 
                href={ROUTES.DASHBOARD} 
                icon="faGauge" 
                label="Dashboard" 
                onClick={() => handleNavigate(ROUTES.DASHBOARD, 'Dashboard')}
                isLoading={isNavigating === 'Dashboard'}
              />
              <NavLink 
                href={ROUTES.QUOTES_INVOICES} 
                icon="faFileInvoice" 
                label="Registos" 
                onClick={() => handleNavigate(ROUTES.QUOTES_INVOICES, 'Registos')}
                isLoading={isNavigating === 'Registos'}
              />
              <NavLink 
                href={ROUTES.ENTITIES} 
                icon="faCompany" 
                label="Entidades" 
                onClick={() => handleNavigate(ROUTES.ENTITIES, 'Entidades')}
                isLoading={isNavigating === 'Entidades'}
              />

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={toggleDropdown}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
                  aria-expanded={dropdownOpen}
                  aria-label="Menu do usuário"
                  disabled={isSigningOut}
                >
                  {isLoading || isSigningOut ? (
                    <AvatarSkeleton />
                  ) : (
                    <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-white shadow-sm hover:border-indigo-100 transition-colors">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt="Avatar"
                          width={36}
                          height={36}
                          className="object-cover"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.src = '/default-avatar.png';
                          }}
                        />
                      ) : (
                        <div className="bg-gradient-to-br from-indigo-500 to-purple-500 w-full h-full flex justify-center items-center">
                          <FontAwesomeIcon icon={ICONS.faUser} className="text-white text-sm" />
                        </div>
                      )}
                    </div>
                  )}
                  <div className={`transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''}`}>
                    {isSigningOut ? (
                      <FontAwesomeIcon icon={ICONS.faSpinner} className="text-gray-500 text-xs animate-spin" />
                    ) : (
                      <FontAwesomeIcon icon={ICONS.faChevronDown} className="text-gray-500 text-xs" />
                    )}
                  </div>
                </button>
                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-fade-in">
                    <div className="flex items-center gap-3 p-3 border-b border-gray-100">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 flex justify-center items-center shadow-sm">
                        {avatarUrl ? (
                          <Image
                            src={avatarUrl}
                            alt="Avatar"
                            width={40}
                            height={40}
                            className="object-cover"
                            onError={(e) => {
                              const target = e.currentTarget as HTMLImageElement;
                              target.src = '/default-avatar.png';
                            }}
                          />
                        ) : (
                          <FontAwesomeIcon icon={ICONS.faUser} className="text-indigo-600" />
                        )}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {userDisplayName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">{user.email}</p>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={handleSignOut}
                        disabled={isSigningOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Sair da conta"
                      >
                        {isSigningOut ? (
                          <>
                            <FontAwesomeIcon icon={ICONS.faSpinner} className="animate-spin" />
                            <span>Saindo...</span>
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={ICONS.faSignOutAlt} />
                            <span>Sair</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Mobile Toggle */}
        <div className="md:hidden relative" ref={mobileDropdownRef}>
          <button
            onClick={toggleMobileDropdown}
            className="p-2 rounded-lg hover:bg-gray-100 transition active:scale-95 disabled:opacity-50"
            aria-label="Menu"
            aria-expanded={mobileDropdownOpen}
            disabled={isSigningOut}
          >
            {isSigningOut ? (
              <FontAwesomeIcon icon={ICONS.faSpinner} className="text-lg animate-spin" />
            ) : (
              <FontAwesomeIcon
                icon={mobileDropdownOpen ? ICONS.faXmark : ICONS.faBars}
                className="text-lg"
              />
            )}
          </button>

          {mobileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 p-2 z-50 animate-fade-in">
              {!user ? (
                <button
                  onClick={handleNavigateToLogin}
                  disabled={isRedirecting}
                  className="w-full flex items-center justify-center gap-2 border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:border-indigo-300 hover:shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                >
                  {isRedirecting ? (
                    <>
                      <FontAwesomeIcon
                        icon={ICONS.faSpinner}
                        className="text-gray-500 animate-spin"
                      />
                      <span>Processando...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={ICONS.faSignIn} className="text-gray-500" />
                      <span>Login</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  <div className="flex items-center gap-3 p-3 border-b border-gray-100 mb-2">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-indigo-100 to-purple-100 flex justify-center items-center shadow-sm">
                      {avatarUrl ? (
                        <Image
                          src={avatarUrl}
                          alt="Avatar"
                          width={40}
                          height={40}
                          className="object-cover"
                          onError={(e) => {
                            const target = e.currentTarget as HTMLImageElement;
                            target.src = '/default-avatar.png';
                          }}
                        />
                      ) : (
                        <FontAwesomeIcon icon={ICONS.faUser} className="text-indigo-600" />
                      )}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {userDisplayName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                  </div>

                  <MobileDropdownLink 
                    href={ROUTES.DASHBOARD} 
                    icon="faGauge" 
                    label="Dashboard" 
                    onClick={() => handleNavigate(ROUTES.DASHBOARD, 'Dashboard')}
                    isLoading={isNavigating === 'Dashboard'}
                  />
                  <MobileDropdownLink 
                    href={ROUTES.QUOTES_INVOICES} 
                    icon="faFileInvoice" 
                    label="Registos" 
                    onClick={() => handleNavigate(ROUTES.QUOTES_INVOICES, 'Registos')}
                    isLoading={isNavigating === 'Registos'}
                  />
                  <MobileDropdownLink 
                    href={ROUTES.ENTITIES} 
                    icon="faCompany" 
                    label="Entidades" 
                    onClick={() => handleNavigate(ROUTES.ENTITIES, 'Entidades')}
                    isLoading={isNavigating === 'Entidades'}
                  />
                  <button
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50 rounded-lg transition-colors mt-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Sair da conta"
                  >
                    {isSigningOut ? (
                      <>
                        <FontAwesomeIcon icon={ICONS.faSpinner} className="animate-spin" />
                        <span>Saindo...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={ICONS.faSignOutAlt} />
                        <span>Sair</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}