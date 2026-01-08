import { createContext, useContext, useEffect, useState } from "react";

const MANUAL_THEME_KEY = "manual-theme-preference";

function getManualThemePreference(): "light" | "dark" | null {
  try {
    const stored = localStorage.getItem(MANUAL_THEME_KEY);
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch (e) {
    console.error("Failed to read manual theme preference:", e);
  }
  return null;
}

function setManualThemePreference(theme: "light" | "dark" | null) {
  try {
    if (theme === null) {
      localStorage.removeItem(MANUAL_THEME_KEY);
    } else {
      localStorage.setItem(MANUAL_THEME_KEY, theme);
    }
  } catch (e) {
    console.error("Failed to save manual theme preference:", e);
  }
}

function getWhopThemePreference(): "light" | "dark" | null {
  const cookies = document.cookie.split(';');
  const themeCookie = cookies.find(cookie => cookie.trim().startsWith('whop-frosted-theme='));
  
  if (themeCookie) {
    const theme = themeCookie.split('=')[1].trim();
    return theme === 'light' ? 'light' : theme === 'dark' ? 'dark' : null;
  }
  
  return null;
}

function getSystemPreference(): "light" | "dark" {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function determineTheme(): "light" | "dark" {
  const manualTheme = getManualThemePreference();
  if (manualTheme) return manualTheme;
  
  const whopTheme = getWhopThemePreference();
  if (whopTheme) return whopTheme;
  
  return getSystemPreference();
}

interface ThemeContextType {
  theme: "light" | "dark";
  toggleTheme: () => void;
  resetToAuto: () => void;
  isManual: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => determineTheme());
  const [isManual, setIsManual] = useState<boolean>(() => getManualThemePreference() !== null);

  useEffect(() => {
    const checkTheme = () => {
      const newTheme = determineTheme();
      const newIsManual = getManualThemePreference() !== null;
      
      if (newTheme !== theme) {
        setTheme(newTheme);
      }
      if (newIsManual !== isManual) {
        setIsManual(newIsManual);
      }
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (!getManualThemePreference()) {
        checkTheme();
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    const intervalId = setInterval(checkTheme, 1000);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
      clearInterval(intervalId);
    };
  }, [theme, isManual]);

  useEffect(() => {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setManualThemePreference(newTheme);
    setTheme(newTheme);
    setIsManual(true);
  };

  const resetToAuto = () => {
    setManualThemePreference(null);
    setIsManual(false);
    const autoTheme = getWhopThemePreference() || getSystemPreference();
    setTheme(autoTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, resetToAuto, isManual }}>
      {children}
    </ThemeContext.Provider>
  );
}
