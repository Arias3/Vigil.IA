from flask import Flask, request, jsonify
import tensorflow as tf
import numpy as np
import cv2
import os

app = Flask(__name__)

# Cargar el modelo .h5
model = tf.keras.models.load_model("./models/Drownsinness.h5")
class_names = ['Attention', 'EyesClosed', 'Yawning']  # Clases del modelo

# Cargar clasificador Haar Cascade para detección de rostros
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

# Ruta para procesar el video
@app.route('/process-video', methods=['POST'])
def process_video():
    if 'video' not in request.files:
        return jsonify({"error": "No video file provided"}), 400

    video_file = request.files['video']
    video_path = os.path.join("temp", video_file.filename)
    video_file.save(video_path)

    # Procesar el video (ejemplo: extraer un frame y predecir)
    cap = cv2.VideoCapture(video_path)
    success, frame = cap.read()
    cap.release()

    if not success:
        return jsonify({"error": "Failed to process video"}), 500

    # Convertir el frame a escala de grises para detección facial
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

    # Detectar rostros en el frame
    faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(100, 100))

    if len(faces) == 0:
        # Si no se detecta ningún rostro, devolver un mensaje de error
        os.remove(video_path)  # Limpia el archivo temporal
        return jsonify({"error": "No face detected in the video"}), 400

    # Tomar el primer rostro detectado
    x, y, w, h = faces[0]

    # Recortar la región del rostro
    roi = frame[y:y+h, x:x+w]

    # Normalizar y expandir dimensiones para el modelo
    roi_normalized = roi / 255.0  # Normalizar valores entre 0 y 1
    roi_expanded = np.expand_dims(roi_normalized, axis=0)  # (1, h, w, 3)

    # Realizar la predicción
    prediction = model.predict(roi_expanded)
    gesture_index = np.argmax(prediction)  # Índice de la clase con mayor probabilidad
    gesture_name = class_names[gesture_index]  # Nombre de la clase

    # Limpia el archivo temporal
    os.remove(video_path)

    return jsonify({
        "gesture": int(gesture_index),
        "gesture_name": gesture_name,
        "confidence": float(np.max(prediction))  # Confianza de la predicción
    })

if __name__ == '__main__':
    # Crear carpeta temporal si no existe
    if not os.path.exists("temp"):
        os.makedirs("temp")
    app.run(debug=True)