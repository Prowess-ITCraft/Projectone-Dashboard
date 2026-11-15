import { useEffect, useRef } from 'react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/*
  Behaviour every modal surface needs: Escape closes it, Tab stays inside it, the page behind does not scroll,
  and focus goes back to whatever was focused before it opened. Attach the returned ref to the modal's panel.
*/
export function useModal(onClose) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return undefined;
    const before = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (!panel.contains(document.activeElement))
      (panel.querySelector('[data-autofocus]') || panel.querySelector(FOCUSABLE) || panel).focus();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.tabIndex !== -1);
      if (!items.length) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    panel.addEventListener('keydown', onKey);
    return () => {
      panel.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      if (before instanceof HTMLElement && before.isConnected) before.focus();
    };
  }, []);

  return ref;
}
