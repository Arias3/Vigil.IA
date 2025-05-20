import React, { useState, useEffect, useCallback } from 'react';
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

// Función para obtener la imagen del avatar según el gesto
const getAvatarImage = (gesture) => {
  switch (gesture) {
    case 0:
      return "0.png"; // No face detected
    case 1:
      return "1.png"; // Attention
    case 2:
      return "3.png"; // EyesClosed
    case 3:
      return "2.png"; // Yawning
    default:
      return "0.png"; // Imagen predeterminada
  }
};
const percentInput = 0; // Valor de ejemplo para el porcentaje
const gestureInput = 0; // Valor de ejemplo para el gesto

function Home() {
  const navigate = useNavigate();
  const { isDarkTheme } = useTheme();

  // Estados para configuraciones
  // eslint-disable-next-line
  const [brightness, setBrightness] = useState(100); // Correcto
  // eslint-disable-next-line
  const [contrast, setContrast] = useState(100); // Correcto
  // eslint-disable-next-line
  const [zoom, setZoom] = useState(1); // Correcto
  // eslint-disable-next-line
  const [selectedAvatar, setSelectedAvatar] = useState(0); // Correcto
  // eslint-disable-next-line
  const [selectedAlarm, setSelectedAlarm] = useState('default'); // Correcto

  // Estados para percent y gesture
  const [percent] = useState(percentInput || 90); // Valor inicial de percent
  const [gesture] = useState(gestureInput || 3); // Valor inicial de gesture

  // Estados derivados
  const [strokeColor, setStrokeColor] = useState(GradePercent(percent));
  const [avatarCaption, setAvatarCaption] = useState(getAvatarCaption(percent));
  const [avatarImage, setAvatarImage] = useState(getAvatarImage(gesture));

  const [dialogOpen, setDialogOpen] = useState(true);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);

  const [prevGesture, setPrevGesture] = useState(gesture); // Estado previo
  const [transitionVideo, setTransitionVideo] = useState(null); // Video de transición
  const [showTransition, setShowTransition] = useState(false); // Mostrar video

  const getTransitionVideo = (from, to) => {
    // Mapear los gestos a letras
    const map = { 1: 'a', 3: 'b', 2: 'c' }; // 1: Atento, 3: Boztezo, 2: Ojos cerrados
    if (from === to) return null;
    if (!map[from] || !map[to]) return null;
    // Ejemplo: a-b1, a-b2, etc. Puedes alternar entre 1 y 2 si quieres variedad
    return `${map[from]}-${map[to]}1.mp4`;
  };

  // Efecto para actualizar los componentes cuando cambian percent o gesture
  useEffect(() => {
    setStrokeColor(GradePercent(percent, gesture)); // Actualiza el color dinámico
    setAvatarCaption(getAvatarCaption(percent)); // Actualiza el caption del avatar
    setAvatarImage(getAvatarImage(gesture)); // Actualiza la imagen del avatar
  }, [percent, gesture]);

  // Efecto para iniciar la captura de video cuando se otorgan permisos
  useEffect(() => {
    if (cameraPermissionGranted) {
      console.log("Permisos de cámara otorgados. Iniciando la API...");
      startCameraAPI();
    }
    // eslint-disable-next-line
  }, [cameraPermissionGranted]);

  useEffect(() => {
    if (prevGesture !== gesture) {
      const videoName = getTransitionVideo(prevGesture, gesture);
      if (videoName) {
        setTransitionVideo(videoName);
        setShowTransition(true);
        // Oculta el video después de 2 segundos y actualiza el avatar
        setTimeout(() => {
          setShowTransition(false);
          setPrevGesture(gesture);
          setAvatarImage(getAvatarImage(gesture));
        }, 2000);
        return; // No actualices el avatar aún
      }
    }
    setAvatarImage(getAvatarImage(gesture));
    setPrevGesture(gesture);
    // eslint-disable-next-line
  }, [gesture]);

  const GoToSettings = () => {
    navigate('/settings');
  };

  const startCameraAPI = useCallback(async () => {
    console.log("Iniciando la API de la cámara...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.play();

      const canvas = document.createElement('canvas');
      canvas.width = 112;
      canvas.height = 112;
      const context = canvas.getContext('2d');

      // Captura imágenes a 1 FPS
      const captureFrame = () => {
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
              setAvatarCaption(getAvatarCaption(data.confidence * 100));
              setAvatarImage(getAvatarImage(data.gesture));
            } catch (error) {
              console.error("Error al enviar la imagen:", error.message);
            }
          }
        }, 'image/jpeg');

        setTimeout(captureFrame, 2000); // Captura el siguiente frame después de 1 segundo
      };

      captureFrame(); // Inicia la captura de frames

      // Detener la cámara cuando sea necesario
      return () => {
        stream.getTracks().forEach((track) => track.stop());
      };
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
  // eslint-disable-next-line
  const sendImageToAPI = async (imageData) => {
    try {
      const blob = await fetch(imageData).then((res) => res.blob());
      const data = await processImage(blob); // Llama a la función del servicio
      console.log("Respuesta del backend:", data);

      // Actualiza la interfaz según el resultado
      setAvatarCaption(getAvatarCaption(data.confidence * 100));
      setAvatarImage(getAvatarImage(data.gesture));
    } catch (error) {
      console.error("Error al enviar la imagen:", error.message);
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
                src={require(`../assets/${transitionVideo}`)}
                autoPlay
                onEnded={() => setShowTransition(false)}
                style={{ width: 180, height: 180 }}
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
          <CircleBar percent={percent} strokeColor={strokeColor} />
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
    </div>
  );
}

export default Home;