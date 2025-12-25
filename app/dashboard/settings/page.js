'use client';

import DashboardLayout from '@/components/dashboard/DashboardLayout';

export default function SettingsPage() {
  return (
    <DashboardLayout>
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Configuración</h2>
          <p className="text-zinc-400 mb-6">
            Personaliza tu experiencia y preferencias.
          </p>
          
          <div className="bg-zinc-800/50 rounded-lg p-8 text-center">
            <div className="text-5xl mb-4">⚙️</div>
            <p className="text-zinc-400">
              Esta sección está en desarrollo. Aquí podrás configurar tus preferencias y ajustes.
            </p>
          </div>
        </div>
    </DashboardLayout>
  );
}
