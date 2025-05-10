import { Circle } from '@rc-component/progress';
import React from 'react';

const CircleBar = ({
  percent = 0, // Porcentaje de progreso
  strokeColor = "#0eff36", // Color del trazo (recibido desde home.js)
  strokeWidth = 6, // Ancho del trazo
  railWidth = 4, // Ancho del riel (opcional, por defecto igual a strokeWidth)
  strokeLinecap = "round", // Forma del extremo del trazo
  gapDegree = 100, // Grado de separación en el círculo
  gapPosition = "bottom", // Posición del espacio en el círculo
  className = "", // Clase personalizada
  style = {}, // Estilo personalizado
  loading = false, // Habilitar progreso indeterminado
}) => {
  return (
    <div
      className={`circle-bar-container ${className}`}
      style={{
        position: "relative",
        width: "380px", // Ajusta el tamaño del contenedor
        height: "auto", // Ajusta el tamaño del contenedor
        ...style,
      }}
    >
      {/* Componente Circle */}
      <Circle
        percent={percent}
        strokeWidth={strokeWidth}
        strokeColor={strokeColor} // Color dinámico recibido desde home.js
        railWidth={railWidth}
        strokeLinecap={strokeLinecap}
        gapDegree={gapDegree}
        gapPosition={gapPosition}
      />
      {/* Texto en el centro */}
      <div
        className="circle-bar-text"
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontSize: "120px",
          fontWeight: "bold",
          color: strokeColor, // El texto también cambia de color
          fontFamily: "'Bebas Neue', 'Space Mono', sans-serif", // Aplica las fuentes
          zIndex: 1, // Asegura que el texto esté encima del círculo
          pointerEvents: "none", // Evita que el texto bloquee interacciones con el círculo
        }}
      >
        {`${percent}%`}
      </div>
    </div>
  );
};

export default CircleBar;