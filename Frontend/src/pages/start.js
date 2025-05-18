import React, { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { FaLightbulb, FaRegLightbulb } from "react-icons/fa6";
import './start.css';
import animationVideo from '../assets/saludo.mp4';

// Función simple para generar un UUID
function generateToken() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16)
  );
}

function Start() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const { isDarkTheme, toggleTheme } = useTheme();

  const handleStart = () => {
    // Si no hay token, lo genera y lo guarda
    if (!localStorage.getItem('token')) {
      const token = generateToken();
      localStorage.setItem('token', token);
    }
    navigate('/home');
  };

  const newLocal = <div className="start-left-container">
    <div
      className="start-avatar-container"
      onMouseEnter={() => {
        videoRef.current.currentTime = 0; // Reinicia el video al inicio
        videoRef.current?.play();
      }}
      onMouseLeave={() => {
        if (videoRef.current && videoRef.current.paused === false) {
          // No pausa el video si ya está reproduciéndose
          return;
        }
      }}
    >
      <video
        ref={videoRef}
        className="start-avatar-video"
        autoPlay={true} // No se reproduce automáticamente
        muted
        playsInline
      >
        <source src={animationVideo} type="video/mp4" />
        Tu navegador no soporta videos HTML5.
      </video>
    </div>
  </div>;
  return (
    <div className={`start-container ${isDarkTheme ? 'dark-theme' : 'light-theme'}`}>
      {/* Botón flotante de cambio de tema */}
      <button
        className="start-theme-toggle-button"
        onClick={toggleTheme}
        aria-label="Cambiar tema"
      >
        {isDarkTheme ?
          <FaLightbulb className="start-theme-icon" /> :
          <FaRegLightbulb className="start-theme-icon" />
        }
      </button>

      {newLocal}

      <div className="start-right-container">
        <h1>Bienvenido a Vigil</h1>
        <p>En esta web impulsada por IA, podrás controlar o monitorizar el nivel de sueño al conducir.</p>
        <button
          className="start-button"
          onClick={handleStart}
        >
          Empezar
        </button>
      </div>
    </div>
  );
}

export default Start;