import React, { useState, useEffect } from 'react';
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
      return "0.png";
    case 1:
      return "1.png";
    case 2:
      return "2.png";
    case 3:
      return "3.png";
    default:
      return "0.png"; // Imagen predeterminada
  }
};
const percentInput = 0; // Valor de ejemplo para el porcentaje
const gestureInput = 0; // Valor de ejemplo para el gesto

function Home() {
  const navigate = useNavigate();
  const { isDarkTheme } = useTheme();
  // Estados para percent y gesture
  const [percent] = useState(percentInput || 50); // Valor inicial de percent
  const [gesture] = useState(gestureInput || 2); // Valor inicial de gesture

  // Estados derivados
  const [strokeColor, setStrokeColor] = useState(GradePercent(percent));
  const [avatarCaption, setAvatarCaption] = useState(getAvatarCaption(percent));
  const [avatarImage, setAvatarImage] = useState(getAvatarImage(gesture));

  const [dialogOpen, setDialogOpen] = useState(true);
  const [cameraPermissionGranted, setCameraPermissionGranted] = useState(false);

  // Efecto para actualizar los componentes cuando cambian percent o gesture
  useEffect(() => {
    setStrokeColor(GradePercent(percent, gesture)); // Actualiza el color dinámico
    setAvatarCaption(getAvatarCaption(percent)); // Actualiza el caption del avatar
    setAvatarImage(getAvatarImage(gesture)); // Actualiza la imagen del avatar
  }, [percent, gesture]);

  // Efecto para manejar permisos de cámara
  useEffect(() => {
    if (cameraPermissionGranted) {
      console.log("Permisos de cámara otorgados. Iniciando la API...");
      startCameraAPI(); // Inicia la API si los permisos fueron otorgados
    }
  }, [cameraPermissionGranted]);

  // Función para verificar y solicitar permisos de la cámara
  const requestCameraPermission = async () => {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' });
      if (permission.state === 'granted') {
        console.log("Permisos de cámara ya otorgados.");
        setCameraPermissionGranted(true);
        setDialogOpen(false); // Cierra el diálogo
        startCameraAPI(); // Inicia la API
      } else if (permission.state === 'prompt') {
        // Si el estado es "prompt", solicita permisos con getUserMedia
        await navigator.mediaDevices.getUserMedia({ video: true });
        setCameraPermissionGranted(true);
        setDialogOpen(false);
        startCameraAPI();
      } else {
        console.error("Permiso de cámara denegado.");
        setCameraPermissionGranted(false);
      }
    } catch (error) {
      console.error("Error al solicitar permisos de cámara:", error);
      setCameraPermissionGranted(false);
    }
  };

  const GoToSettings = () => {
    navigate('/settings');
  };

  const startCameraAPI = () => {
    console.log("Iniciando la API de la cámara...");
    // Aquí puedes agregar la lógica para iniciar la API
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
            <img
              src={require(`../assets/${avatarImage}`)}
              alt="Avatar"
              className="home-avatar-image"
            />
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