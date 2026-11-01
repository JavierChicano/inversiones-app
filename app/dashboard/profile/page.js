'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import ProfileSummary from '@/components/profile/ProfileSummary';
import ContributionDisciplineChart from '@/components/profile/ContributionDisciplineChart';
import ReportsSection from '@/components/profile/ReportsSection';
import ChangePasswordModal from '@/components/profile/ChangePasswordModal';
import UploadReportModal from '@/components/profile/UploadReportModal';
import { LockIcon, PlusIcon, RefreshIcon } from '@/components/icons';
import { useAuth } from '@/context/AuthContext';
import { useRefresh } from '@/app/dashboard/layout';
import { useCache } from '@/context/CacheContext';
import { exportUserDataToCSV } from '@/lib/utils/exportData';

function Section({ title, description, action, children }) {
  return (
    <div className="mt-5 bg-zinc-800/50 rounded-lg p-5 border border-zinc-700/50">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          {description && <p className="text-zinc-400 text-sm mt-1">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

const DownloadIcon = ({ className = 'w-4 h-4' }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
);

export default function ProfilePage() {
  const { token, user } = useAuth();
  const { refreshVersion } = useRefresh();
  const { getCachedData, setCachedData } = useCache();

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState('');

  const [contributions, setContributions] = useState(null);
  const [contributionsLoading, setContributionsLoading] = useState(true);
  const [contributionsError, setContributionsError] = useState('');

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [reportsRefreshKey, setReportsRefreshKey] = useState(0);

  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState(null); // { type: 'success' | 'error', text }

  // Resumen general: reutiliza las estadísticas del dashboard (los totales son globales,
  // el rango de fechas solo afecta a la progresión, así que se pide el mínimo de snapshots).
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const loadStats = async () => {
      const cached = getCachedData('dashboard-stats') || getCachedData('profile-stats');
      if (cached) {
        setStats(cached.stats);
        setStatsLoading(false);
        return;
      }

      try {
        setStatsLoading(true);
        setStatsError('');
        const now = new Date().toISOString();
        const params = new URLSearchParams({ startDate: now, endDate: now, maxSnapshots: '1' });
        const response = await fetch(`/api/dashboard/stats?${params.toString()}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al obtener el resumen');
        }

        if (!cancelled) {
          setStats(data.stats);
          setCachedData('profile-stats', data);
        }
      } catch (err) {
        if (!cancelled) setStatsError(err.message || 'Error al obtener el resumen');
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };

    loadStats();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshVersion]);

  // Disciplina de aportación
  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const loadContributions = async () => {
      const cached = getCachedData('profile-contributions');
      if (cached) {
        setContributions(cached);
        setContributionsLoading(false);
        return;
      }

      try {
        setContributionsLoading(true);
        setContributionsError('');
        const response = await fetch('/api/profile/contributions', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Error al obtener la disciplina de aportación');
        }

        if (!cancelled) {
          setContributions(data);
          setCachedData('profile-contributions', data);
        }
      } catch (err) {
        if (!cancelled) setContributionsError(err.message || 'Error al obtener la disciplina de aportación');
      } finally {
        if (!cancelled) setContributionsLoading(false);
      }
    };

    loadContributions();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, refreshVersion]);

  const handleExportData = async () => {
    setExportMessage(null);
    setIsExporting(true);

    try {
      await exportUserDataToCSV(token);
      setExportMessage({ type: 'success', text: 'CSV descargado.' });
    } catch (err) {
      setExportMessage({ type: 'error', text: err.message || 'Error al exportar datos' });
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportMessage(null), 5000);
    }
  };

  return (
    <DashboardLayout>
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Perfil</h2>
            <p className="text-zinc-400 text-sm">
              {user?.name ? `${user.name} · ` : ''}
              {user?.email}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="btn-primary rounded-lg gap-1.5 !py-1.5"
            >
              <PlusIcon className="w-4 h-4" />
              Subir informe
            </button>
            <button
              type="button"
              onClick={handleExportData}
              disabled={isExporting}
              className="btn-secondary rounded-lg gap-1.5 !py-1.5"
            >
              {isExporting ? <RefreshIcon className="w-4 h-4 animate-spin" /> : <DownloadIcon />}
              {isExporting ? 'Exportando...' : 'Exportar datos'}
            </button>
            <button
              type="button"
              onClick={() => setIsPasswordModalOpen(true)}
              className="btn-secondary rounded-lg gap-1.5 !py-1.5"
            >
              <LockIcon className="w-4 h-4" />
              Cambiar contraseña
            </button>
          </div>
        </div>

        {exportMessage && (
          <div
            className={`mt-3 px-4 py-2 rounded-lg text-sm border ${
              exportMessage.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
            }`}
          >
            {exportMessage.text}
          </div>
        )}

        <Section
          title="Resumen general"
          description="Lo que ya has materializado con ventas y lo que tienes latente en posiciones abiertas."
        >
          <ProfileSummary stats={stats} loading={statsLoading} error={statsError} />
        </Section>

        <Section
          title="Disciplina de aportación"
          description="Constancia con la que envías dinero a invertir cada mes (un mes cuenta si registraste al menos un cambio EUR → USD)."
        >
          <ContributionDisciplineChart
            data={contributions}
            loading={contributionsLoading}
            error={contributionsError}
          />
        </Section>

        <Section
          title="Informes"
          description="Radiografías de cartera guardadas, con el periodo que cubre cada una."
        >
          <ReportsSection refreshKey={reportsRefreshKey} />
        </Section>
      </div>

      <UploadReportModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onUploaded={() => setReportsRefreshKey((key) => key + 1)}
      />
      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
      />
    </DashboardLayout>
  );
}
