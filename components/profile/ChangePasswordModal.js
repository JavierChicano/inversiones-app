'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useBackdropClose } from '@/lib/hooks/useBackdropClose';
import { CloseIcon, EyeIcon, EyeOffIcon } from '@/components/icons';

function PasswordInput({ label, value, onChange, visible, onToggle, autoComplete, minLength }) {
  return (
    <div>
      <label className="block text-sm font-medium text-zinc-400 mb-2">{label}</label>
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-zinc-800 text-white border border-zinc-700 rounded-lg px-4 py-2 pr-11 focus:outline-none focus:border-blue-500"
          autoComplete={autoComplete}
          minLength={minLength}
          required
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 hover:text-white transition-colors"
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        >
          {visible ? <EyeOffIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

const EMPTY_FORM = { current: '', next: '', confirm: '' };

export default function ChangePasswordModal({ isOpen, onClose }) {
  const { token } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [visible, setVisible] = useState({ current: false, next: false, confirm: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleClose = () => {
    if (isSubmitting) return;
    setForm(EMPTY_FORM);
    setError('');
    setSuccess('');
    onClose();
  };

  const backdropProps = useBackdropClose(handleClose);

  if (!isOpen) return null;

  const setField = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));
  const toggle = (field) => setVisible((prev) => ({ ...prev, [field]: !prev[field] }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('No autorizado. Inicia sesión de nuevo.');
      return;
    }

    if (form.next !== form.confirm) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: form.current,
          newPassword: form.next,
          confirmPassword: form.confirm,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'No se pudo actualizar la contraseña');
      }

      setForm(EMPTY_FORM);
      setSuccess('Contraseña actualizada correctamente.');
    } catch (err) {
      setError(err.message || 'Error al cambiar contraseña');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      {...backdropProps}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md relative">
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
          aria-label="Cerrar"
        >
          <CloseIcon className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-bold text-white mb-4">Cambiar contraseña</h3>

        {success && (
          <div className="mb-4 bg-green-500/10 border border-green-500/20 text-green-400 px-4 py-3 rounded-lg text-sm">
            {success}
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <PasswordInput
            label="Contraseña actual"
            value={form.current}
            onChange={setField('current')}
            visible={visible.current}
            onToggle={() => toggle('current')}
            autoComplete="current-password"
          />
          <PasswordInput
            label="Nueva contraseña"
            value={form.next}
            onChange={setField('next')}
            visible={visible.next}
            onToggle={() => toggle('next')}
            autoComplete="new-password"
            minLength={6}
          />
          <PasswordInput
            label="Confirmar nueva contraseña"
            value={form.confirm}
            onChange={setField('confirm')}
            visible={visible.confirm}
            onToggle={() => toggle('confirm')}
            autoComplete="new-password"
            minLength={6}
          />

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} className="btn-secondary rounded-lg">
              Cancelar
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary rounded-lg">
              {isSubmitting ? 'Actualizando...' : 'Actualizar contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
