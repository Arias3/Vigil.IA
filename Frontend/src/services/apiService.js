const API_BASE_URL = 'http://localhost:5000'; // URL base de la API

// Función para enviar un video al backend
export const processVideo = async (videoFile) => {
  const formData = new FormData();
  formData.append('video', videoFile);

  try {
    const response = await fetch(`${API_BASE_URL}/process-video`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al procesar el video');
    }

    return await response.json(); // Devuelve los datos de la respuesta
  } catch (error) {
    console.error('Error en la API:', error.message);
    throw error; // Lanza el error para que el frontend lo maneje
  }
};