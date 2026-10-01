'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sun, Moon } from '@phosphor-icons/react';
import { persistTheme } from '@/lib/theme-key';

export function ThemeToggle() {
  const pathname = usePathname();
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    // Script pra-paint sudah menerapkan tema; cukup salin keadaan DOM.
    const html = document.documentElement;
    setIsLight(html.classList.contains('theme-light'));
    const observer = new MutationObserver(() => {
      setIsLight(html.classList.contains('theme-light'));
    });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggle = () => {
    const next = isLight ? 'dark' : 'light';
    document.documentElement.classList.toggle('theme-light', next === 'light');
    persistTheme(pathname, next);
    setIsLight(next === 'light');
  };

  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Beralih ke mode gelap" : "Beralih ke mode terang"}
      aria-pressed={!isLight}
      className="p-2 rounded-control hover:bg-surface-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {isLight ? <Moon className="text-text-2" /> : <Sun className="text-brand-red" />}
    </button>
  );
}
