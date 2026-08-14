import { useState, useEffect } from "react";
import { safeLocalStorage } from "../lib/safeStorage";

type Theme = 'light' | 'dark' | 'system';

/**
 * useAppTheme
 * Manages application theme (light/dark/system) with localStorage persistence
 * Handles theme persistence and system preference detection
 */
export function useAppTheme() {
  // Theme state with localStorage persistence
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      const stored = safeLocalStorage.getItem('theme') as Theme;
      return stored || 'system';
    } catch {
      return 'system';
    }
  });

  // Theme dropdown visibility
  const [isThemeOpen, setIsThemeOpen] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Persist theme to localStorage when changed
  useEffect(() => {
    try {
      safeLocalStorage.setItem('theme', theme);
    } catch (error) {
      console.error('Failed to persist theme:', error);
    }
  }, [theme]);

  // Set theme and persist
  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    applyTheme(newTheme);
  };

  // Apply theme to DOM
  const applyTheme = (themeValue: Theme) => {
    const htmlElement = document.documentElement;

    if (themeValue === 'system') {
      // Remove data-theme attribute to use system preference
      htmlElement.removeAttribute('data-theme');

      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      htmlElement.classList.toggle('dark', prefersDark);
    } else if (themeValue === 'dark') {
      htmlElement.setAttribute('data-theme', 'dark');
      htmlElement.classList.add('dark');
    } else if (themeValue === 'light') {
      htmlElement.setAttribute('data-theme', 'light');
      htmlElement.classList.remove('dark');
    }
  };

  // Toggle between light and dark
  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
    } else if (theme === 'dark') {
      setTheme('light');
    } else {
      // From 'system', determine current and toggle
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setTheme(prefersDark ? 'light' : 'dark');
    }
  };

  // Get current effective theme (resolved system preference if needed)
  const getEffectiveTheme = (): 'light' | 'dark' => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  // Check if currently in dark mode
  const isDarkMode = (): boolean => {
    return getEffectiveTheme() === 'dark';
  };

  // Check if currently in light mode
  const isLightMode = (): boolean => {
    return getEffectiveTheme() === 'light';
  };

  // Toggle theme dropdown
  const toggleThemeDropdown = () => {
    setIsThemeOpen(prev => !prev);
  };

  // Open theme dropdown
  const openThemeDropdown = () => {
    setIsThemeOpen(true);
  };

  // Close theme dropdown
  const closeThemeDropdown = () => {
    setIsThemeOpen(false);
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  // Enter fullscreen
  const enterFullscreen = () => {
    document.documentElement.requestFullscreen().catch((err) => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  };

  // Exit fullscreen
  const exitFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    }
  };

  // Watch for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      applyTheme('system');
    };

    // Modern browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
    // Older browsers
    else {
      mediaQuery.addListener(handleChange);
      return () => mediaQuery.removeListener(handleChange);
    }
  }, [theme]);

  // Apply theme on mount
  useEffect(() => {
    applyTheme(theme);
  }, []);

  return {
    // Theme state
    theme,
    setTheme,
    isThemeOpen,
    setIsThemeOpen,
    isFullscreen,
    setIsFullscreen,

    // Theme utilities
    toggleTheme,
    getEffectiveTheme,
    isDarkMode,
    isLightMode,

    // Dropdown helpers
    toggleThemeDropdown,
    openThemeDropdown,
    closeThemeDropdown,

    // Fullscreen helpers
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen
  };
}
