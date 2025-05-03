import React from 'react';
import { useNavigate } from 'react-router-dom';
import { IoMdSettings } from "react-icons/io";
import { useTheme } from '../context/ThemeContext';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const { isDarkTheme } = useTheme();

  const goToSettings = () => {
    navigate('/settings');
  };

  return (
    <div className={`home-container ${isDarkTheme ? 'dark-theme' : 'light-theme'}`}>
      {/* Botón de configuración flotante */}
      <button 
        className="settings-floating-button"
        onClick={goToSettings}
        aria-label="Configuración"
      >
        <IoMdSettings className="settings-icon" />
      </button>

      {/* Contenido de la página Home */}
      <h1>Página Principal</h1>
      <p>Contenido de tu aplicación...</p>
    </div>
  );
}

export default Home;