'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserIcon, WalletGrowthIcon } from './icons';

export default function Navbar() {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const pathname = usePathname();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const dropdownRef = useRef(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  useEffect(() => {
    function onScroll() {
      setIsScrolled(window.scrollY > 8);
    }

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 border-b transition-all duration-300 ${
        isScrolled
          ? 'border-zinc-800/80 bg-zinc-950/85 backdrop-blur-xl shadow-[0_12px_30px_rgba(0,0,0,0.35)]'
          : 'border-zinc-900 bg-zinc-950/70 backdrop-blur-md'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-18 items-center justify-between gap-4">
          <div className="flex items-center min-w-0">
            <Link
              href="/"
              className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-zinc-900/80"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-cyan-300/25 to-sky-400/20 text-cyan-200 ring-1 ring-cyan-300/25">
                <WalletGrowthIcon className="h-7 w-7" />
              </span>
              <span className="hidden sm:block text-sm sm:text-base font-semibold tracking-tight text-zinc-100 group-hover:text-cyan-200 transition-colors">
                Inversiones
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="btn-secondary hidden sm:inline-flex"
            >
              Inicio
            </Link>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="btn-primary hidden sm:inline-flex"
              >
                Ir al dashboard
              </Link>
            ) : (
              <button
                onClick={openAuthModal}
                className="btn-primary hidden sm:inline-flex"
              >
                Ir al dashboard
              </button>
            )}

            {isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-500 hover:bg-zinc-800 transition-colors cursor-pointer"
                  aria-label="Menú de usuario"
                >
                  <UserIcon />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-xl border border-zinc-700 bg-zinc-900/95 shadow-xl z-50 py-2 backdrop-blur">
                    <div className="px-4 py-3 border-b border-zinc-700">
                      <p className="text-sm font-medium text-zinc-100">
                        {user?.name || 'Usuario'}
                      </p>
                      <p className="mt-1 text-xs text-zinc-400">
                        {user?.email}
                      </p>
                    </div>
                    <Link
                      href="/dashboard/settings"
                      onClick={() => setIsDropdownOpen(false)}
                      className="block px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition-colors"
                    >
                      Ajustes
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-rose-300 hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Cerrar sesion
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-cyan-300/40 hover:text-cyan-200 transition-colors cursor-pointer"
                aria-label="Iniciar sesión"
              >
                <UserIcon />
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
