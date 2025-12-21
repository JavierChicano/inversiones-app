import Image from "next/image";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="flex min-h-[calc(100vh-64px)] items-center justify-center">
        <main className="flex w-full max-w-3xl flex-col items-center justify-between py-32 px-16 sm:items-start">
          <div className="mb-8">
            <div className="text-4xl mb-2">📹</div>
          </div>
          <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
            <h1 className="max-w-xl text-4xl font-bold leading-tight tracking-tight text-foreground">
              Dashboard de Inversiones
            </h1>
            <p className="max-w-md text-lg leading-8 text-zinc-400">
              Gestiona tus inversiones en <span className="text-profit font-semibold">criptomonedas</span> y{" "}
              <span className="text-primary font-semibold">acciones</span> de manera rápida y sencilla. 
              Inicia sesión para comenzar a monitorear tu portafolio.
            </p>
            <div className="flex gap-4 mt-4">
              <div className="bg-profit-soft px-4 py-2 rounded-md text-sm">
                📈 Seguimiento en tiempo real
              </div>
              <div className="bg-card border border-border px-4 py-2 rounded-md text-sm text-foreground">
                🔒 Seguro con JWT
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
