'use client';
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Home() {
  const { isAuthenticated, openAuthModal } = useAuth();
  const router = useRouter();

  const keyModules = [
    {
      title: 'Vista global del portfolio',
      description:
        'Resumen de patrimonio, variacion diaria y distribucion por activo para entender tu exposicion en segundos.',
      accent: 'from-cyan-400/40 to-cyan-200/10',
    },
    {
      title: 'Registro de operaciones',
      description:
        'Alta rapida de compras, ventas y cambios de divisas con datos consistentes para mantener tu historico limpio.',
      accent: 'from-amber-400/40 to-amber-200/10',
    },
    {
      title: 'Analitica de rendimiento',
      description:
        'ROI, win rate, ganancias realizadas y evolucion temporal para evaluar que estrategias funcionan mejor.',
      accent: 'from-emerald-400/40 to-emerald-200/10',
    },
    {
      title: 'Seguimiento multi-asset',
      description:
        'Acciones, criptomonedas y pares de divisas en un mismo flujo de trabajo sin hojas de calculo paralelas.',
      accent: 'from-rose-400/40 to-rose-200/10',
    },
  ];

  const workflowSteps = [
    {
      step: '01',
      title: 'Carga tus movimientos',
      description: 'Registra compras, ventas y cambios de divisa en menos de un minuto.',
    },
    {
      step: '02',
      title: 'Recibe datos actualizados',
      description: 'La app refresca precios periodicamente para mantener tu foto de mercado al dia.',
    },
    {
      step: '03',
      title: 'Toma decisiones con contexto',
      description: 'Analiza resultados, detecta patrones y ajusta tu estrategia con evidencia real.',
    },
  ];

  const handleCTAClick = () => {
    if (isAuthenticated) {
      router.push('/dashboard');
    } else {
      openAuthModal();
    }
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(34,211,238,0.18),transparent_38%),radial-gradient(circle_at_82%_64%,rgba(251,191,36,0.14),transparent_42%),radial-gradient(circle_at_55%_95%,rgba(56,189,248,0.1),transparent_38%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] bg-[linear-gradient(to_right,#f4f4f515_1px,transparent_1px),linear-gradient(to_bottom,#f4f4f515_1px,transparent_1px)] bg-size-[44px_44px]" />

      <div className="relative z-10">
        <section className="relative max-w-7xl mx-auto px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-4 py-2 text-xs sm:text-sm font-medium tracking-wide text-cyan-200">
                <span className="h-2 w-2 rounded-full bg-cyan-300 motion-safe:animate-pulse" />
                Tu control diario de inversiones, en una sola pantalla
              </span>

              <h1 className="mt-6 text-5xl sm:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight text-balance">
                Menos ruido.
                <br />
                <span className="bg-linear-to-r from-cyan-300 via-sky-200 to-amber-200 bg-clip-text text-transparent">
                  Mas decisiones
                </span>
                <br />
                con contexto.
              </h1>

              <p className="mt-6 max-w-xl text-base sm:text-lg leading-relaxed text-zinc-300">
                Esta app no es solo un registro: es tu centro de operaciones para entender rendimiento,
                exposicion y evolucion del portfolio con datos actualizados y analitica util para actuar.
              </p>

              <div className="mt-10 flex flex-col sm:flex-row sm:items-stretch gap-4">
                <button
                  onClick={handleCTAClick}
                  className="btn-primary group relative sm:flex-none px-8 py-4 text-base whitespace-nowrap transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_10px_35px_rgba(56,189,248,0.35)]"
                >
                  Entrar al dashboard
                  <span className="absolute inset-0 rounded-xl opacity-0 transition-opacity group-hover:opacity-100 bg-white/20" />
                </button>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 sm:p-8 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <p className="text-sm uppercase tracking-[0.16em] text-zinc-400">Resumen de hoy</p>
                  <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                    Mercado activo
                  </span>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-4">
                  <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-zinc-500">Patrimonio</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-100">€124.8K</p>
                    <p className="mt-1 text-xs text-emerald-300">+3.6% este mes</p>
                  </article>
                  <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-zinc-500">Rendimiento</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-100">+18.4%</p>
                    <p className="mt-1 text-xs text-cyan-300">ROI acumulado</p>
                  </article>
                  <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-zinc-500">Win rate</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-100">62%</p>
                    <p className="mt-1 text-xs text-amber-300">Operaciones cerradas</p>
                  </article>
                  <article className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                    <p className="text-xs uppercase tracking-widest text-zinc-500">Exposicion</p>
                    <p className="mt-2 text-2xl font-bold text-zinc-100">5 activos</p>
                    <p className="mt-1 text-xs text-rose-300">Crypto, equity y FX</p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Para el dia a dia</p>
            <p className="mt-2 text-zinc-200">Ver rapidamente si tu cartera mejora o se desvia.</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Para evaluar estrategia</p>
            <p className="mt-2 text-zinc-200">Comparar resultados por activo, periodo y tipo de operacion.</p>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 px-5 py-4">
            <p className="text-xs uppercase tracking-widest text-zinc-500">Para no perder contexto</p>
            <p className="mt-2 text-zinc-200">Historial y snapshots para entender de donde viene cada cambio.</p>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-16 sm:py-24">
        <div className="mb-12 max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Capacidades clave</p>
          <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white">Lo importante para gestionar mejor tu capital</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {keyModules.map((module) => (
            <article
              key={module.title}
              className="group relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 p-7 transition-colors duration-300 hover:border-zinc-600"
            >
              <div className={`absolute inset-0 bg-linear-to-br ${module.accent} opacity-0 transition-opacity duration-300 group-hover:opacity-100`} />
              <div className="relative">
                <h3 className="text-xl font-semibold text-zinc-100">{module.title}</h3>
                <p className="mt-3 text-zinc-300 leading-relaxed">{module.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 lg:px-8 pb-20 sm:pb-28">
        <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-8 sm:p-10">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">Flujo de trabajo</p>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white">Como se usa realmente en 3 pasos</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {workflowSteps.map((item) => (
              <article key={item.step} className="rounded-2xl border border-zinc-700/70 bg-zinc-950/70 p-6">
                <p className="text-sm font-bold text-amber-300">{item.step}</p>
                <h3 className="mt-3 text-lg font-semibold text-zinc-100">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{item.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 rounded-2xl border border-cyan-300/25 bg-cyan-300/10 p-6">
            <div>
              <p className="text-xl font-semibold text-cyan-100">Empieza con datos claros, no con suposiciones</p>
              <p className="mt-2 text-cyan-50/85">Entra y convierte tu historial de operaciones en decisiones mas consistentes.</p>
            </div>
            <button
              onClick={handleCTAClick}
              className="btn-secondary px-6 py-3 transition-transform duration-300 hover:-translate-y-0.5"
            >
              Probar ahora
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 py-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 text-center text-sm text-zinc-500">
          <p>© 2026 Dashboard de Inversiones. Datos de mercado integrados para seguimiento de portfolio.</p>
        </div>
      </footer>
    </main>
  );
}
