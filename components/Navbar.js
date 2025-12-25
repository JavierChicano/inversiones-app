'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { UserIcon, WalletGrowthIcon } from './icons';

export default function Navbar() {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
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

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Título */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold text-foreground hover:text-primary transition-colors">
              <WalletGrowthIcon className="h-12 w-12" /> Dashboard Inversiones
            </Link>
          </div>

          {/* Botones y menú usuario */}
          <div className="flex items-center gap-4">
            {/* Botón Dashboard */}
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-indigo-600 rounded-md transition-colors"
              >
                Dashboard
              </Link>
            ) : (
              <button
                onClick={openAuthModal}
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-indigo-600 rounded-md transition-colors cursor-pointer"
              >
                Dashboard
              </button>
            )}

            {/* Menú de usuario */}
            {isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-700 hover:bg-zinc-600 transition-colors text-foreground cursor-pointer"
                  aria-label="Menú de usuario"
                >
                  <UserIcon />
                </button>

                {/* Dropdown */}
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-xl z-50 py-2">
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-medium text-foreground">
                        {user?.name || 'Usuario'}
                      </p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {user?.email}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-loss hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      Cerrar Sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={openAuthModal}
                className="flex items-center justify-center w-10 h-10 rounded-full bg-zinc-700 hover:bg-zinc-600 transition-colors text-zinc-400 cursor-pointer"
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
