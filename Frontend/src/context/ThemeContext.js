import React, { createContext, useState, useContext } from 'react';

// 1. Crear el contexto
const ThemeContext = createContext();

// 2. Crear el proveedor
export const ThemeProvider = ({ children }) => {
  const [isDarkTheme, setIsDarkTheme] = useState(true);

  const toggleTheme = () => {
    setIsDarkTheme(prev => !prev);
    document.body.className = isDarkTheme ? 'light-theme' : 'dark-theme';
  };

  return (
    <ThemeContext.Provider value={{ isDarkTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

// 3. Crear el hook personalizado
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe usarse dentro de un ThemeProvider');
  }
  return context;
};