import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

/* A number that counts to its new value, formatted for India */
export function CountUp({ to, dec = 0, suffix = '', prefix = '' }) {
  const [v, setV] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const c = animate(prev.current, to, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (x) => {
        prev.current = x;
        setV(x);
      },
    });
    return () => c.stop();
  }, [to]);
  return (
    <>
      {prefix}
      {v.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}
      {suffix}
    </>
  );
}
