'use client';

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

export const PRIVACY_STORAGE_KEY = 'privacy-mode';
const HTML_ATTR = 'data-privacy';
const CHANGE_EVENT = 'privacy-mode-change';

const PrivacyContext = createContext(null);

function readStored() {
  try {
    return localStorage.getItem(PRIVACY_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}

function subscribe(callback) {
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

/**
 * Modo privacidad: cuando está activo, todo lo envuelto en <Amount> (clase `sensitive`)
 * se difumina vía CSS (`html[data-privacy="on"] .sensitive`).
 *
 * La fuente de verdad es localStorage. El atributo en <html> lo fija un script inline
 * en app/layout.js antes del primer pintado (evita el parpadeo al recargar) y aquí se
 * actualiza al cambiar el modo.
 */
export function PrivacyProvider({ children }) {
  const hidden = useSyncExternalStore(subscribe, readStored, () => false);

  const setPrivacy = useCallback((value) => {
    document.documentElement.setAttribute(HTML_ATTR, value ? 'on' : 'off');
    try {
      localStorage.setItem(PRIVACY_STORAGE_KEY, value ? 'on' : 'off');
    } catch {
      /* ignorar */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  const togglePrivacy = useCallback(() => setPrivacy(!readStored()), [setPrivacy]);

  return (
    <PrivacyContext.Provider value={{ hidden, setPrivacy, togglePrivacy }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy debe ser usado dentro de PrivacyProvider');
  }
  return context;
}
