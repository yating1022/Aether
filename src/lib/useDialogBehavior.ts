import { useEffect, useRef } from 'react';

/**
 * Shared dialog behaviour: Escape closes, and page scroll is locked while open.
 *
 * The callback lives in a ref so the effect registers its listeners exactly once
 * — re-subscribing on every render would drop Escape presses mid-interaction.
 *
 * Used by every modal (link, category, brand) so the three never drift apart.
 */
export function useDialogBehavior(onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}
