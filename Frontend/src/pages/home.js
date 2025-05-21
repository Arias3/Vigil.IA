import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { IoMdSettings } from "react-icons/io";
import CircleBar from '../components/CircleBar';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Button from '@mui/material/Button';
import { processImage } from '../services/apiService';
import './Home.css';
import alarm1 from '../assets/audio/alarm1.mp3';
import alarm2 from '../assets/audio/alarm2.mp3';
import alarm3 from '../assets/audio/alarm3.mp3';

const alarms = {
  alarm1: { name: "Alarma 1", file: alarm1 },
  alarm2: { name: "Alarma 2", file: alarm2 },
  alarm3: { name: "Alarma 3", file: alarm3 }
};


// Función para mapear el porcentaje a un color (de verde a rojo)
const GradePercent = (percent, gesture) => {
  if (gesture === 0) {
    // Si no se detecta un rostro, devuelve un color gris
    return `rgb(128, 128, 128)`; // Gris
  }
  const red = Math.min(255, Math.floor((percent / 100) * 255)); // Incrementa el rojo
  const green = Math.min(255, Math.floor(((100 - percent) / 100) * 255)); // Decrementa el verde
  return `rgb(${red}, ${green}, 0)`; // Devuelve el color en formato RGB
};

// Función para obtener el caption del avatar según el porcentaje
const getAvatarCaption = (percent) => {
  if (percent >= 90) return "¡Alerta! Detente y descansa, es peligroso continuar.";
  if (percent >= 70) return "¡Cuidado! Tu nivel de somnolencia es alto, considera una pausa.";
  if (percent >= 50) return "Parece que estás cansado, un descanso podría ayudarte.";
  if (percent >= 30) return "Mantente alerta, podrías estar empezando a sentir cansancio.";
  if (percent >= 10) return "Vas bien, pero no bajes la guardia.";
  return "¡Estás completamente atento, sigue así!";
};

// Función para obtener la imagen del avatar según el gesto y el avatar seleccionado
const getAvatarImage = (gesture, avatarNum = '1') => {
  if (!avatarNum) avatarNum = '1';
  if (gesture === 0) return `0.png`; // No face detected
  if (gesture === 1) return `a${avatarNum}.png`; // Attention
  if (gesture === 2) return `c${avatarNum}.png`; // EyesClosed
  if (gesture === 3) return `b${avatarNum}.png`; // Yawning
  return `a${avatarNum}.png`;
};

function Home() {
  const navigate = useNavigate();
  const { isDarkTheme } = useTheme();

  // Estados actualizados
  const [percent, setPercent] = useState(0); // Ahora es mutable
  const [gestureAvatar, setGestureAvatar] = useState(1); // 1 = Attention por defecto
  const [gesture] = useState(0); // Ahora es mutable
  const [strokeColor, setStrokeColor] = useState(GradePercent(0, 0));
  const [avatarCaption, setAvatarCaption] = useState(getAvatarCaption(0));
  const [avatarImage, setAvatarImage] = useState(getAvatarImage(1, '1'));
  const [prevGestureAvatar, setPrevGestureAvatar] = useState(gestureAvatar);


  // Estados para configuraciones
  // eslint-disable-next-line
  const [brightness, setBrightness] = useState(100); // Correcto
  // eslint-disable-next-line
  const [contrast, setContrast] = useState(100); // Correcto
  // eslint-disable-next-line
  const [zoom, setZoom] = useState(1); // Correcto
  // eslint-disable-next-line
  const [selectedAvatar, setSelectedAvatar] = useState('1'); // Siempre string
  // eslint-disable-next-line
  const [selectedAlarm, setSelectedAlarm] = useState('default'); // Correcto

  const [dialogOpen, setDialogOpen] = useState(true);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);

  const [prevGesture, setPrevGesture] = useState(gesture); // Estado previo
  const [transitionVideo, setTransitionVideo] = useState(null); // Video de transición
  const [showTransition, setShowTransition] = useState(false); // Mostrar video

  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const capturingRef = useRef(false);

  useEffect(() => {
    const savedAvatar = localStorage.getItem('selectedAvatar');
    if (savedAvatar) {
      setSelectedAvatar(savedAvatar);
    } else {
      setSelectedAvatar('1');
    }
  }, []);

  useEffect(() => {
    if (gestureAvatar === 2 || percent > 70) { // 2 = EyesClosed
      const selected = localStorage.getItem('selectedAlarm') || 'alarm1';
      if (audioRef.current) {
        if (audioRef.current.paused || audioRef.current.ended) {
          audioRef.current.src = alarms[selected].file;
          audioRef.current.play().catch(e => console.log("Error al reproducir:", e));
        }
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [gestureAvatar, percent]);

  useEffect(() => {
    if (prevGestureAvatar !== gestureAvatar) {
      const transition = getTransitionVideo(prevGestureAvatar, gestureAvatar);
      if (transition) {
        setTransitionVideo(transition);
        setShowTransition(true);
        setTimeout(() => {
          setShowTransition(false);
          setPrevGestureAvatar(gestureAvatar);
          setAvatarImage(getAvatarImage(gestureAvatar, selectedAvatar));
        }, 2000); // Duración del video
        return;
      }
      setPrevGestureAvatar(gestureAvatar);
      setAvatarImage(getAvatarImage(gestureAvatar, selectedAvatar));
    }
    // eslint-disable-next-line
  }, [gestureAvatar, selectedAvatar]);

  useEffect(() => {
    if (showTransition && videoRef.current) {
      videoRef.current.playbackRate = 2;
    }
  }, [showTransition, transitionVideo]);

  const [gestureHistory, setGestureHistory] = useState([]);

  const postprocessGesture = (newGesture) => {
    setGestureHistory(prev => {
      const updated = [...prev, newGesture].slice(-5);
      return updated;
    });
  };

  useEffect(() => {
    if (gestureHistory.length === 5 && gestureHistory.every(g => g === gestureHistory[0])) {
      setGestureAvatar(gestureHistory[0]);
    }
    // eslint-disable-next-line
  }, [gestureHistory]);




  // Función para obtener el video de transición entre gestos
  function getTransitionVideo(prevGesture, nextGesture) {
    // Map gestos a letras
    const gestureMap = { 1: 'a', 3: 'b', 2: 'c' }; // 1: Atento, 3: Bostezo, 2: Ojos cerrados
    const avatarNum = localStorage.getItem('selectedAvatar') || '1';

    // Si no hay transición o es el mismo gesto, no hay video
    if (prevGesture === nextGesture) return null;

    const from = gestureMap[prevGesture];
    const to = gestureMap[nextGesture];

    // Si alguno no está definido, no hay transición
    if (!from || !to) return null;

    // Ejemplo: a-c1.mp4, c-a1.mp4, etc.
    return { src: `transitions/${from}-${to}${avatarNum}.mp4`, reverse: false };
  }

  // Efecto para actualizar los componentes cuando cambian percent o gesture
  useEffect(() => {
    setStrokeColor(GradePercent(percent, gestureAvatar));
    setAvatarCaption(getAvatarCaption(percent));
    setAvatarImage(getAvatarImage(gestureAvatar, selectedAvatar));
  }, [percent, gestureAvatar, selectedAvatar]);

  // Efecto para iniciar la captura de video cuando se otorgan permisos
  useEffect(() => {
    if (cameraPermissionGranted) {
      console.log("Permisos de cámara otorgados. Iniciando la API...");
      startCameraAPI();
    }
    // eslint-disable-next-line
  }, [cameraPermissionGranted]);

  const stopCameraAPI = useCallback(() => {
    capturingRef.current = false; // Detén el ciclo de captura
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);



  const GoToSettings = () => {
    stopCameraAPI();
    navigate('/settings');
  };

  useEffect(() => {
    return () => {
      stopCameraAPI();
    };
  }, [stopCameraAPI]);

  const startCameraAPI = useCallback(async () => {
    console.log("Iniciando la API de la cámara...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      capturingRef.current = true; // Inicia la captura

      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      const canvas = document.createElement('canvas');
      canvas.width = 112;
      canvas.height = 112;
      const context = canvas.getContext('2d');

      // Captura imágenes a 1 FPS
      const captureFrame = () => {
        if (!capturingRef.current) return;
        // Leer valores de localStorage
        const brightness = parseInt(localStorage.getItem('brightness') || '100', 10);
        const contrast = parseInt(localStorage.getItem('contrast') || '100', 10);
        const zoom = parseFloat(localStorage.getItem('zoom') || '80');

        // Calcula el factor de zoom (por ejemplo, 80 = sin zoom, 160 = 2x zoom)
        const scale = zoom / 80;

        // Calcula el área a recortar del video (más pequeño = más zoom)
        const cropW = video.videoWidth / scale;
        const cropH = video.videoHeight / scale;
        const cropX = (video.videoWidth - cropW) / 2;
        const cropY = (video.videoHeight - cropH) / 2;

        // Limpia el canvas
        context.clearRect(0, 0, canvas.width, canvas.height);

        // Dibuja el área recortada del video escalada al canvas completo (zoom in real)
        context.filter = `brightness(${brightness}%) contrast(${contrast}%)`;
        context.drawImage(
          video,
          cropX, cropY, cropW, cropH, // área fuente (recorte)
          0, 0, canvas.width, canvas.height // área destino (canvas completo)
        );
        context.filter = 'none';

        // Envía la imagen al backend
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const data = await processImage(blob);
              // Postprocesamiento del gesto
              // Actualiza el confidence directamente, sin filtro
              console.log("Gesto detectado:", data.gesture_name);
              setPercent(data.confidence * 100);
              postprocessGesture(data.gesture);

              // El resto de tus actualizaciones de estado van aquí,
              // pero el gesto mostrado será el filtrado por el historial
            } catch (error) {
              console.error("Error al enviar la imagen:", error.message);
            }
          }
        }, 'image/jpeg');

        setTimeout(() => {
          if (capturingRef.current) captureFrame();
        }, 500);
      };

      captureFrame(); // Inicia la captura de frames

    } catch (error) {
      console.error("Error al iniciar la captura de video:", error);
    }
  }, []);

  const requestCameraPermission = async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' });
      if (permission.state === 'granted') {
        console.log("Permisos de cámara ya otorgados.");
        setCameraPermissionGranted(true);
        setDialogOpen(false); // Cierra el diálogo
      } else if (permission.state === 'prompt') {
        await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraPermissionGranted(true);
        setDialogOpen(false);
      } else {
        console.error("Permiso de cámara denegado.");
        setCameraPermissionGranted(false);
      }
    } catch (error) {
      console.error("Error al solicitar permisos de cámara:", error);
      setCameraPermissionGranted(false);
    }
  };


  return (
    <div className={`home-container ${isDarkTheme ? 'dark-theme' : 'light-theme'}`}>
      {/* Diálogo para notificar sobre el uso de la cámara */}
      <Dialog open={dialogOpen}>
        <DialogTitle>Permiso para usar la cámara</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Esta aplicación necesita acceso a tu cámara para analizar tu nivel de atención. Por favor, otorga los permisos necesarios.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={requestCameraPermission} color="primary">
            Iniciar Captura
          </Button>
          <Button onClick={GoToSettings} color="primary">
            Configuración
          </Button>
        </DialogActions>
      </Dialog>
      {/* Botón de configuración flotante */}
      <button
        className="home-settings-floating-button"
        onClick={GoToSettings}
        aria-label="Configuración"
      >
        <IoMdSettings className="home-settings-icon" />
      </button>

      {/* Contenedor principal */}
      <div className="home-container">
        {/* Contenedor izquierdo (Avatar) */}
        <div className="home-left-container">
          <div className="home-avatar-container">

            {showTransition && transitionVideo ? (
              <video
                ref={videoRef}
                src={require(`../assets/${transitionVideo.src}`)}
                autoPlay
                onEnded={() => setShowTransition(false)}
                className="home-avatar-image"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center",
                  borderRadius: "20%",
                  transition: "all 0.3s ease"
                  // Ya no necesitas transform
                }}
              />
            ) : (
              <img
                src={require(`../assets/${avatarImage}`)}
                alt="Avatar"
                className="home-avatar-image"
              />
            )}

          </div>
          {/* Label debajo del avatar */}
          <div
            className="home-avatar-label"
            style={{ fontFamily: "'Bebas Neue', 'Space Mono', sans-serif", fontSize: "30px" }}
          >
            {avatarCaption}
          </div>
        </div>

        {/* Contenedor derecho (Canvas) */}
        <div className="home-right-container">
          <CircleBar percent={Math.round(percent)} strokeColor={strokeColor} />
        </div>
      </div>

      {/* Contenedor inferior */}
      <div
        className="home-bottom-container"
        style={{
          backgroundColor: strokeColor, // Aplica el color dinámico como fondo
          height: "80px", // Ajusta la altura del contenedor (puedes personalizarlo)
          transition: "background-color 0.3s ease", // Transición suave para el cambio de color
        }}
      ></div>
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}

export default Home;