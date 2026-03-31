import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

export const lightColors = {
  background: '#F4F6F9',
  surface: '#FFFFFF',
  text: '#111827',
  textSub: '#6B7280',
  border: '#E5E7EB',
  iconBg: '#FFFFFF',
  mapCard: '#E2E8F0',
  headerBg: '#1E3A8A', 
  headerText: '#FFFFFF',
  accent: '#2563EB'
};

export const darkColors = {
  background: '#0B0D14', 
  surface: '#1A1D26',    
  text: '#F9FAFB',
  textSub: '#9CA3AF',
  border: '#2D3340',
  iconBg: '#252A36',
  mapCard: '#151821',
  headerBg: '#0B0D14',   
  headerText: '#FFFFFF',
  accent: '#3B82F6'
};

type ThemeContextType = {
  isDarkMode: boolean;
  toggleTheme: () => void;
  colors: typeof lightColors;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemTheme = useColorScheme();
  const [isDarkMode, setIsDarkMode] = useState(systemTheme === 'dark');

  useEffect(() => {
    setIsDarkMode(systemTheme === 'dark');
  }, [systemTheme]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, colors: isDarkMode ? darkColors : lightColors }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};