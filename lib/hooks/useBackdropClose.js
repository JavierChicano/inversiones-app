'use client';

import { useRef } from 'react';

/**
 * Hook para cerrar un modal al hacer click en el fondo (backdrop).
 * A diferencia de un onClick simple, solo cierra si el gesto completo
 * (mousedown y mouseup) ocurrió sobre el propio fondo. Así, arrastrar
 * una selección de texto desde un input y soltar fuera del modal
 * no lo cierra accidentalmente.
 *
 * @param {Function} onClose - Callback para cerrar el modal
 * @returns {Object} Props para extender en el elemento del backdrop
 */
export function useBackdropClose(onClose) {
  const pressedOnBackdrop = useRef(false);

  return {
    onMouseDown: (e) => {
      pressedOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e) => {
      if (pressedOnBackdrop.current && e.target === e.currentTarget) {
        onClose(e);
      }
      pressedOnBackdrop.current = false;
    },
  };
}
