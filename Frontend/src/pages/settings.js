import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaLightbulb, FaRegLightbulb } from "react-icons/fa6";
import { IoArrowBack } from "react-icons/io5";
import { useTheme } from '../context/ThemeContext';
import './Settings.css';
import op1 from '../assets/op1.png';
import op2 from '../assets/op2.png';
import op3 from '../assets/op3.png';
import alarm1 from '../assets/audio/alarm1.mp3';
import alarm2 from '../assets/audio/alarm2.mp3';
import alarm3 from '../assets/audio/alarm3.mp3';

function Settings() {
  const { isDarkTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [isGrayscale] = useState(true); // Blanco y negro por defecto
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [stream, setStream] = useState(null);
  const streamRef = useRef();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [brightness, setBrightness] = useState(() => parseInt(localStorage.getItem('brightness')) || 100);
  const [contrast, setContrast] = useState(() => parseInt(localStorage.getItem('contrast')) || 100);
  const [tempBrightness, setTempBrightness] = useState(brightness);
  const [tempContrast, setTempContrast] = useState(contrast);
  const audioRef = useRef(null);
  const [zoom, setZoom] = useState(() => parseInt(localStorage.getItem('zoom')) || 200);
  const [selectedAvatar, setSelectedAvatar] = useState(() => parseInt(localStorage.getItem('selectedAvatar')) || 1);
  const [selectedAlarm, setSelectedAlarm] = useState(() => localStorage.getItem('selectedAlarm') || 'alarm1');
  const [tempZoom, setTempZoom] = useState(zoom); // Zoom temporal para el slider

  // Recuperar configuraciones desde localStorage al cargar la página
  useEffect(() => {
    const savedBrightness = localStorage.getItem('brightness');
    const savedContrast = localStorage.getItem('contrast');
    const savedZoom = localStorage.getItem('zoom');
    const savedAvatar = localStorage.getItem('selectedAvatar');
    const savedAlarm = localStorage.getItem('selectedAlarm');
    const savedTheme = localStorage.getItem('theme');

    if (savedBrightness) setBrightness(parseInt(savedBrightness));
    if (savedContrast) setContrast(parseInt(savedContrast));
    if (savedZoom) setZoom(parseInt(savedZoom));
    if (savedAvatar) setSelectedAvatar(parseInt(savedAvatar));
    if (savedAlarm) setSelectedAlarm(savedAlarm);

    // Aplicar el tema guardado solo una vez
    if (savedTheme === 'dark' && !isDarkTheme) {
      toggleTheme();
    } else if (savedTheme === 'light' && isDarkTheme) {
      toggleTheme();
    }
    // eslint-disable-next-line
  }, []);

  // Guardar configuraciones en localStorage al cambiar los valores
  useEffect(() => {
    localStorage.setItem('brightness', brightness);
  }, [brightness]);

  useEffect(() => {
    localStorage.setItem('contrast', contrast);
  }, [contrast]);

  useEffect(() => {
    localStorage.setItem('zoom', zoom);
  }, [zoom]);

  useEffect(() => {
    localStorage.setItem('selectedAvatar', selectedAvatar);
  }, [selectedAvatar]);

  useEffect(() => {
    localStorage.setItem('selectedAlarm', selectedAlarm);
  }, [selectedAlarm]);

  useEffect(() => {
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

  const saveSettings = () => {
    localStorage.setItem('brightness', brightness);
    localStorage.setItem('contrast', contrast);
    localStorage.setItem('zoom', zoom);
    localStorage.setItem('selectedAvatar', selectedAvatar);
    localStorage.setItem('selectedAlarm', selectedAlarm);
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    alert('Configuración guardada exitosamente.');
  };

  // Objeto con las alarmas disponibles
  const alarms = {
    alarm1: {
      name: "Alarma 1",
      file: alarm1
    },
    alarm2: {
      name: "Alarma 2",
      file: alarm2
    },
    alarm3: {
      name: "Alarma 3",
      file: alarm3
    }
  };

  // Función para probar la alarma seleccionada
  const testAlarm = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = alarms[selectedAlarm].file;
      audioRef.current.play().catch(e => console.log("Error al reproducir:", e));
    }
  };

  // Manejar cambio de alarma
  const handleAlarmChange = (e) => {
    setSelectedAlarm(e.target.value);
  };

  // Manejar cambio de brillo
  const handleBrightnessChange = (e) => {
    setTempBrightness(parseInt(e.target.value));
  };

  // Aplicar brillo cuando se suelta el slider
  const handleBrightnessCommit = () => {
    setBrightness(tempBrightness);
  };

  // Manejar cambio de contraste
  const handleContrastChange = (e) => {
    setTempContrast(parseInt(e.target.value));
  };

  // Aplicar contraste cuando se suelta el slider
  const handleContrastCommit = () => {
    setContrast(tempContrast);
  };

  const handleZoomChange = (e) => {
    setTempZoom(parseInt(e.target.value));
  };

  const handleZoomCommit = () => {
    setZoom(tempZoom);
  };

  // Función para solicitar permisos y detectar cámaras
  const requestCameraAccess = useCallback(async () => {
    try {
      setLoading(true);
      setPermissionGranted(false);

      // 1. Solicitar permisos de cámara explícitamente
      const permissionStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setPermissionGranted(true);

      // 2. Detener el stream de permisos (solo necesitamos el prompt)
      permissionStream.getTracks().forEach(track => track.stop());

      // 3. Enumerar dispositivos disponibles
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      setCameras(videoDevices);

      // 4. Seleccionar automáticamente la primera cámara si existe
      if (videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (error) {
      console.error('Error al solicitar acceso a la cámara:', error);
      setPermissionGranted(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Aplicar filtros al video
  const applyFilters = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.style.filter = `
        brightness(${brightness}%)
        contrast(${contrast}%)
        ${isGrayscale ? 'grayscale(100%)' : ''}
      `;
      videoRef.current.style.transform = `scale(${zoom / 80})`; // Aplicar zoom
    }
  }, [brightness, contrast, isGrayscale, zoom]);

  // Iniciar cámara
  const startCamera = useCallback(async (deviceId) => {
    try {
      // Detener stream anterior si existe
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          width: { ideal: 680 },
          height: { ideal: 480 },
          frameRate: { ideal: 24, max: 24 }
        }
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      streamRef.current = newStream; // Actualizar la referencia

      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        applyFilters();
      }
    } catch (error) {
      console.error('Error al iniciar la cámara:', error);
    }
  }, [applyFilters]);

  // Efecto para inicializar la cámara al montar el componente
  useEffect(() => {
    requestCameraAccess();
  }, [requestCameraAccess]);

  useEffect(() => {
    if (selectedCamera && permissionGranted) {
      startCamera(selectedCamera);
    }
  }, [selectedCamera, permissionGranted, startCamera]);

  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  const goBack = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    navigate('/home');
  };

  const selectAvatar = (avatarNumber) => {
    setSelectedAvatar(avatarNumber);
    console.log(`Avatar seleccionado: op${avatarNumber}`);
  };

  return (
    <div className={`settings-container ${isDarkTheme ? 'dark-theme' : 'light-theme'}`}>
      {/* Botón de retroceso flotante */}
      <button className="floating-back-button" onClick={goBack}>
        <IoArrowBack className="floating-icon" />
      </button>

      {/* Título centrado */}
      <h1 className="settings-title">Elige tu avatar favorito</h1>

      {/* Botón de tema flotante */}
      <button className="floating-theme-button" onClick={toggleTheme}>
        {isDarkTheme ?
          <FaLightbulb className="floating-icon" /> :
          <FaRegLightbulb className="floating-icon" />
        }
      </button>

      {/* Contenedor de avatares */}
      <div className="avatars-container">
        <div className="avatars-scroll">
          <div
            className={`avatar-option ${selectedAvatar === 1 ? 'selected' : ''}`}
            onClick={() => selectAvatar(1)}
          >
            <img src={op1} alt="Avatar opción 1" className="avatar-image" />
          </div>
          <div
            className={`avatar-option ${selectedAvatar === 2 ? 'selected' : ''}`}
            onClick={() => selectAvatar(2)}
          >
            <img src={op2} alt="Avatar opción 2" className="avatar-image" />
          </div>
          <div
            className={`avatar-option ${selectedAvatar === 3 ? 'selected' : ''}`}
            onClick={() => selectAvatar(3)}
          >
            <img src={op3} alt="Avatar opción 3" className="avatar-image" />
          </div>
        </div>
      </div>

      {/* Controles de cámara */}
      <div className="settings-content">
        {loading ? (
          <div className="camera-loading">Solicitando acceso a la cámara...</div>
        ) : !permissionGranted ? (
          <div className="camera-permission-denied">
            <p>No se otorgaron permisos para usar la cámara</p>
            <button onClick={requestCameraAccess} className="retry-button">
              Reintentar
            </button>
          </div>
        ) : (
          <div className="camera-controls-container">
            <div className="control-group">
              <label className="control-label">Selecciona una cámara</label>
              <select
                className="camera-select"
                value={selectedCamera}
                onChange={(e) => setSelectedCamera(e.target.value)}
                disabled={cameras.length === 0}
              >
                {cameras.length > 0 ? (
                  cameras.map(camera => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Cámara ${cameras.indexOf(camera) + 1}`}
                    </option>
                  ))
                ) : (
                  <option value="">No se detectaron cámaras</option>
                )}
              </select>
              <div className="alarm-label">
                <label className="control-label">Cambiar Alarma</label>
                <select
                  className="camera-select"
                  value={selectedAlarm}
                  onChange={handleAlarmChange}
                >
                  {Object.entries(alarms).map(([key, alarm]) => (
                    <option key={key} value={key}>
                      {alarm.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={testAlarm}
                  className="test-alarm-button"
                  aria-label="Probar alarma"
                >
                  Probar
                </button>
              </div>
            </div>


            <div className="control-group">
              <div className="video-preview-container">
                {selectedCamera ? (
                  <video
                    ref={videoRef}
                    className="camera-preview"
                    autoPlay
                    playsInline
                    muted
                  />
                ) : (
                  <div className="camera-placeholder">
                    Selecciona una cámara
                  </div>
                )}
              </div>
            </div>

            <div className="control-group">
              <label className="control-label">
                Brillo: {tempBrightness}%
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={tempBrightness}
                  onChange={handleBrightnessChange}
                  onMouseUp={handleBrightnessCommit}
                  onTouchEnd={handleBrightnessCommit}
                  className="control-slider"
                  disabled={!selectedCamera}
                />
              </label>

              <label className="control-label">
                Contraste: {tempContrast}%
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={tempContrast}
                  onChange={handleContrastChange}
                  onMouseUp={handleContrastCommit}
                  onTouchEnd={handleContrastCommit}
                  className="control-slider"
                  disabled={!selectedCamera}
                />
              </label>
              <label className="control-label">
                Zoom: {tempZoom}%
                <input
                  type="range"
                  min="100"
                  max="200"
                  value={tempZoom}
                  onChange={handleZoomChange}
                  onMouseUp={handleZoomCommit}
                  onTouchEnd={handleZoomCommit}
                  className="control-slider"
                  disabled={!selectedCamera}
                />
              </label>
            </div>
          </div>

        )}
        <div className="save-settings-container">
          <button className="save-settings-button" onClick={saveSettings}>
            Guardar configuración
          </button>
        </div>
      </div>
      <audio ref={audioRef} />
    </div>
  );
}

export default Settings;