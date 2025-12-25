'use client';
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Home() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const router = useRouter();

  const handleCTAClick = () => {
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      openAuthModal();
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Gradient Background */}
        <div className="absolute inset-0 bg-linear-to-br from-blue-500/10 via-transparent to-purple-500/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-24 sm:py-32">
          <div className="text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/50 border border-zinc-800 mb-8">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-sm text-zinc-400">Datos actualizados cada 20 minutos</span>
            </div>

            {/* Main Heading */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
              <span className="bg-linear-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                Gestiona tus
              </span>
              <br />
              <span className="bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Inversiones
              </span>
            </h1>

            {/* Description */}
            <p className="max-w-2xl mx-auto text-lg sm:text-xl text-zinc-400 mb-12 leading-relaxed">
              Monitorea tu portfolio de <span className="text-blue-400 font-semibold">criptomonedas</span> y{" "}
              <span className="text-purple-400 font-semibold">acciones</span> en un solo lugar. 
              Dashboard intuitivo con análisis en tiempo real.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <button onClick={handleCTAClick} className="group relative px-8 py-4 bg-linear-to-r from-blue-500 to-purple-500 rounded-xl font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 cursor-pointer">
                Comenzar ahora
                <span className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto">
              <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-6">
                <div className="text-3xl font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  Real-time
                </div>
                <div className="text-sm text-zinc-500">Precios actualizados</div>
              </div>
              <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-6">
                <div className="text-3xl font-bold bg-linear-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent mb-2">
                  Seguro
                </div>
                <div className="text-sm text-zinc-500">Autenticación JWT</div>
              </div>
              <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-6">
                <div className="text-3xl font-bold bg-linear-to-r from-orange-400 to-red-400 bg-clip-text text-transparent mb-2">
                  Completo
                </div>
                <div className="text-sm text-zinc-500">Análisis detallado</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Todo lo que necesitas
          </h2>
          <p className="text-zinc-400 text-lg">
            Herramientas profesionales para gestionar tus inversiones
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {/* Feature 1 */}
          <div className="group relative bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-linear-to-br from-blue-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Dashboard Completo</h3>
              <p className="text-zinc-400">
                Visualiza tu portfolio con gráficos interactivos y métricas clave como ROI y Win Rate
              </p>
            </div>
          </div>

          {/* Feature 2 */}
          <div className="group relative bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8 hover:border-purple-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-linear-to-br from-purple-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">💱</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Multi-Asset</h3>
              <p className="text-zinc-400">
                Soporta criptomonedas, acciones y pares de divisas con conversión automática EUR/USD
              </p>
            </div>
          </div>

          {/* Feature 3 */}
          <div className="group relative bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8 hover:border-green-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-linear-to-br from-green-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-12 h-12 bg-green-500/10 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">📈</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Historial</h3>
              <p className="text-zinc-400">
                Seguimiento automático de snapshots para ver la evolución de tu portfolio en el tiempo
              </p>
            </div>
          </div>

          {/* Feature 4 */}
          <div className="group relative bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8 hover:border-orange-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-linear-to-br from-orange-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🔄</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Actualización Auto</h3>
              <p className="text-zinc-400">
                Precios actualizados cada 20 minutos automáticamente con GitHub Actions
              </p>
            </div>
          </div>

          {/* Feature 5 */}
          <div className="group relative bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8 hover:border-red-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-linear-to-br from-red-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Rápido y Ligero</h3>
              <p className="text-zinc-400">
                Interfaz optimizada con Next.js 15 y caché inteligente para máxima velocidad
              </p>
            </div>
          </div>

          {/* Feature 6 */}
          <div className="group relative bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-2xl p-8 hover:border-cyan-500/50 transition-all duration-300">
            <div className="absolute inset-0 bg-linear-to-br from-cyan-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center mb-4">
                <span className="text-2xl">🔒</span>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">Privado y Seguro</h3>
              <p className="text-zinc-400">
                Tus datos están protegidos con autenticación JWT y almacenamiento encriptado
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-24">
        <div className="relative bg-linear-to-r from-blue-500/10 to-purple-500/10 border border-zinc-800 rounded-3xl p-12 sm:p-16 overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
          
          <div className="relative text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              ¿Listo para empezar?
            </h2>
            <p className="text-zinc-400 text-lg mb-8 max-w-2xl mx-auto">
              Crea tu cuenta gratis y comienza a monitorear tus inversiones en minutos
            </p>
            <button onClick={handleCTAClick} className="group relative px-10 py-5 bg-linear-to-r from-blue-500 to-purple-500 rounded-xl font-semibold text-white text-lg shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105 cursor-pointer">
              Crear cuenta gratuita
              <span className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="text-center text-zinc-500 text-sm">
            <p>© 2025 Dashboard de Inversiones. Datos proporcionados por Twelve Data y CoinGecko.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
