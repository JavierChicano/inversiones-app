import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-6">
      {/* Gradient Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative max-w-2xl w-full">
        {/* Main Card */}
        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-3xl p-12 sm:p-16 text-center">
          {/* 404 Number with gradient */}
          <div className="mb-8">
            <h1 className="text-8xl sm:text-9xl font-bold bg-linear-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              404
            </h1>
          </div>

          {/* Icon */}
          <div className="mb-6 flex justify-center">
            <div className="w-20 h-20 bg-zinc-800/50 rounded-2xl flex items-center justify-center">
              <span className="text-5xl">📊</span>
            </div>
          </div>

          {/* Title */}
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Página no encontrada
          </h2>

          {/* Description */}
          <p className="text-lg text-zinc-400 mb-8 max-w-md mx-auto">
            Parece que te has perdido en el mercado. Esta página no existe o ha sido movida.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link 
              href="/"
              className="group relative px-8 py-4 bg-linear-to-r from-blue-500 to-purple-500 rounded-xl font-semibold text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/40 transition-all duration-300 hover:scale-105"
            >
              Volver al inicio
              <span className="absolute inset-0 rounded-xl bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
            </Link>
            <Link 
              href="/dashboard"
              className="px-8 py-4 bg-zinc-800 border border-zinc-700 rounded-xl font-semibold text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600 transition-all duration-300"
            >
              Ir al Dashboard
            </Link>
          </div>

          {/* Decorative stats */}
          <div className="mt-12 pt-8 border-t border-zinc-800">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-400">404</div>
                <div className="text-xs text-zinc-500 mt-1">Error code</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-400">0%</div>
                <div className="text-xs text-zinc-500 mt-1">Encontrado</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-pink-400">∞</div>
                <div className="text-xs text-zinc-500 mt-1">Alternativas</div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating elements */}
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-blue-500/10 rounded-2xl rotate-12 blur-xl" />
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-purple-500/10 rounded-2xl -rotate-12 blur-xl" />
      </div>
    </div>
  );
}
