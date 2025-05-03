const fs = require('fs');
const https = require('https');
const path = require('path');
const express = require('express');

// Configuración de paths específica para Windows
const frontendBuildPath = path.join(__dirname, '..', 'build');
const certPath = path.join(__dirname, 'certificates');

// Verificación de archivos
if (!fs.existsSync(frontendBuildPath)) {
  console.error('ERROR: No se encontró la carpeta build');
  console.error('Ejecuta primero: npm run build');
  process.exit(1);
}

const certFiles = {
  key: path.join(certPath, 'localhost+2-key.pem'),
  cert: path.join(certPath, 'localhost+2.pem')
};

// Mensajes de error mejorados para Windows
if (!fs.existsSync(certFiles.key)) {
  console.error(`ERROR: No se encontró ${certFiles.key}`);
  console.error('Ejecuta primero (como Admin):');
  console.error('mkcert -key-file certificates/localhost+2-key.pem -cert-file certificates/localhost+2.pem localhost');
  process.exit(1);
}

// Configuración Express
const app = express();
const port = 8443; // Puerto alternativo para evitar permisos

// Servir archivos estáticos
app.use(express.static(frontendBuildPath));

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.json({ message: 'Funciona en Windows', https: true });
});

// Manejo de rutas para React
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendBuildPath, 'index.html'));
});

// Crear servidor HTTPS con mejor manejo de errores
try {
  const options = {
    key: fs.readFileSync(certFiles.key),
    cert: fs.readFileSync(certFiles.cert)
  };

  const server = https.createServer(options, app);

  server.listen(port, '0.0.0.0', () => {
    console.log(`Servidor HTTPS funcionando en Windows:`);
    console.log(`👉 https://localhost:${port}`);
    console.log(`👉 https://${getLocalIp()}:${port}`);
    console.log('\n⚠️ Si usas Chrome y ves un aviso de seguridad:');
    console.log('1. Haz clic en "Avanzado"');
    console.log('2. Selecciona "Continuar al sitio"');
  });

} catch (error) {
  console.error('Error al iniciar HTTPS:', error.message);
  console.log('\nIniciando servidor HTTP en puerto 3000...');
  app.listen(3000, () => {
    console.log('Servidor HTTP en http://localhost:3000');
  });
}

// Función para obtener IP local (Windows)
function getLocalIp() {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'tu-ip-local';
}