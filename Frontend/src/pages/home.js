import React, { useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { IoMdSettings } from "react-icons/io";
import { Gauge } from 'gaugeJS';
import animationVideo from '../assets/saludo.mp4';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const gaugeRef = useRef(null);
  const { isDarkTheme } = useTheme();

  const goToSettings = () => {
    navigate('/settings');
  };

  useEffect(() => {
    if (!gaugeRef.current) return;

    const opts = {
      angle: -0.25,
      lineWidth: 0.2,
      radiusScale: 1,
      pointer: {
        length: 0.6,
        strokeWidth: 0.07,
        color: isDarkTheme ? '#b4b4b4' : '#2c3e50'
      },
      limitMax: false,
      colorStart: isDarkTheme ? '#101728' : '#f5f7fa',
      colorStop: isDarkTheme ? '#1a2a4a' : '#e0e8f5',
      strokeColor: isDarkTheme ? '#1a2a4a' : '#d0d8e5',
      generateGradient: true,
      highDpiSupport: true,
      staticZones: [
        { strokeStyle: "#F03E3E", min: 0, max: 50 },
        { strokeStyle: "#FFDD00", min: 50, max: 80 },
        { strokeStyle: "#30B32D", min: 80, max: 100 }
      ]
    };

    const gauge = new Gauge(gaugeRef.current).setOptions(opts);
    gauge.maxValue = 100;
    gauge.setMinValue(0);
    gauge.animationSpeed = 32;
    gauge.set(65);

    // Cleanup function
    return () => {
      // No need to call gauge.destroy as it doesn't exist
      gaugeRef.current = null;
    };
  }, [isDarkTheme]);

  return (
    <div className={`home-container ${isDarkTheme ? 'dark-theme' : 'light-theme'}`}>
      {/* Botón de configuración flotante */}
      <button
        className="home-settings-floating-button"
        onClick={goToSettings}
        aria-label="Configuración"
      >
        <IoMdSettings className="home-settings-icon" />
      </button>

      {/* Contenedor principal */}
      <div className="home-container">
        {/* Contenedor izquierdo (Avatar) */}
        <div className="home-left-container">
          <div
            className="home-avatar-container"
            onMouseEnter={() => {
              videoRef.current.currentTime = 0;
              videoRef.current?.play();
            }}
          >
            <video
              ref={videoRef}
              className="home-avatar-video"
              autoPlay={false}
              muted
              playsInline
              loop
            >
              <source src={animationVideo} type="video/mp4" />
              Tu navegador no soporta videos HTML5.
            </video>
          </div>
          {/* Label debajo del avatar */}
          <div className="home-avatar-label">
            ¡Estás atento, sigue así!
          </div>
        </div>

        {/* Contenedor derecho (Canvas) */}
        <div className="home-right-container">
          <canvas className="home-circle-canvas"></canvas>
        </div>
      </div>

      {/* Contenedor inferior */}
      <div className="home-bottom-container"></div>
    </div>
  );
}
export default Home;