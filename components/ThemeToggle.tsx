'use client';

import { useEffect, useState } from 'react';
import { FaSun, FaMoon } from 'react-icons/fa';

export function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);
  
  useEffect(() => {
    // Check initial state from DOM classList
    const html = document.documentElement;
    const saved = localStorage.getItem('theme');
    setIsLight(html.classList.contains('theme-light') || saved === 'light');
    
    // Listen for changes
    const observer = new MutationObserver(() => {
      setIsLight(html.classList.contains('theme-light'));
    });
    observer.observe(html, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  
  const toggle = () => {
    const html = document.documentElement;
    if (isLight) {
      html.classList.remove('theme-light');
      localStorage.setItem('theme', 'dark');
    } else {
      html.classList.add('theme-light');
      localStorage.setItem('theme', 'light');
    }
    setIsLight(!isLight);
  };
  
  return (
    <button
      onClick={toggle}
      aria-label={isLight ? "Beralih ke mode gelap" : "Beralih ke mode terang"}
      className="p-2 rounded-control hover:bg-surface-2 transition-colors focus-visible:ring-2 focus-visible:ring-accent"
    >
      {isLight ? (
        <FaMoon className="text-text-2" />
      ) : (
        <FaSun className="text-brand-red" />
      )}
    </button>
  );
}
