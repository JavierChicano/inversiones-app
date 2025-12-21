'use client';

import { useAuth } from '@/context/AuthContext';

export default function Navbar() {
  const { user, isAuthenticated, logout, openAuthModal } = useAuth();

  return (
    <nav className="bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Título */}
          <div className="flex items-center">
            <h1 className="text-xl font-bold text-foreground">
              📊 Dashboard Inversiones
            </h1>
          </div>

          {/* Usuario y botones */}
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <div className="text-sm text-zinc-400">
                  {user?.name && <span className="font-medium text-foreground">{user.name}</span>}
                  {user?.email && (
                    <span className="ml-2">({user.email})</span>
                  )}
                </div>
                <button
                  onClick={logout}
                  className="px-4 py-2 text-sm font-medium text-white bg-loss hover:bg-red-600 rounded-md transition-colors"
                >
                  Cerrar Sesión
                </button>
              </>
            ) : (
              <button
                onClick={openAuthModal}
                className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary hover:bg-indigo-600 rounded-md transition-colors"
              >
                Iniciar Sesión
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
