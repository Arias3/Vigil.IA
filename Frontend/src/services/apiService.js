const API_BASE_URL = 'http://localhost:5000'; // URL base de la API

// Función para enviar una imagen al backend
export const processImage = async (imageBlob) => {
  const formData = new FormData();
  formData.append('image', imageBlob); // Cambia el campo a 'image'

  // Obtiene el token del localStorage
  const token = localStorage.getItem('token');

  try {
    const response = await fetch(`${API_BASE_URL}/process-image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // No agregues 'Content-Type' cuando usas FormData
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al procesar la imagen');
    }

    return await response.json(); // Devuelve los datos de la respuesta
  } catch (error) {
    console.error('Error en la API:', error.message);
    throw error; // Lanza el error para que el frontend lo maneje
  }
};