from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
import cv2
import os
import uuid
import mediapipe as mp

app = Flask(__name__)
CORS(app)  # Habilita CORS para todas las rutas

# Cargar el modelo .h5
model = tf.keras.models.load_model("./models/model1705.h5")
class_names = ["Attention", "Yawning", "EyesClosed"]  # Clases del modelo (ajustadas)
mp_face_detection = mp.solutions.face_detection


def preprocess_image(frame, target_size=(112, 112)):
    try:
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        with mp_face_detection.FaceDetection(
            model_selection=0, min_detection_confidence=0.5
        ) as face_detection:
            results = face_detection.process(rgb)
            if results.detections:
                detection = results.detections[0]
                bboxC = detection.location_data.relative_bounding_box
                ih, iw, _ = frame.shape
                x1 = int(bboxC.xmin * iw)
                y1 = int(bboxC.ymin * ih)
                w = int(bboxC.width * iw)
                h = int(bboxC.height * ih)

                zoom_factor = 1.2
                new_size = int(max(w, h) * zoom_factor)
                center_x, center_y = x1 + w // 2, y1 + h // 2
                x1 = max(0, center_x - new_size // 2)
                y1 = max(0, center_y - new_size // 2)
                x2 = min(iw, center_x + new_size // 2)
                y2 = min(ih, center_y + new_size // 2)

                roi = frame[y1:y2, x1:x2]
                if roi.size == 0:
                    return None, False
            else:
                return None, False

        # Redimensionar a tamaño objetivo
        roi_resized = cv2.resize(roi, target_size, interpolation=cv2.INTER_AREA)
        roi_gray = cv2.cvtColor(roi_resized, cv2.COLOR_BGR2GRAY)
        roi_blur = cv2.GaussianBlur(roi_gray, (3, 3), 0)
        roi_normalized = roi_blur / 255.0
        roi_expanded = np.expand_dims(roi_normalized, axis=(0, -1))  # (1, 112, 112, 1)
        return roi_expanded, True

    except Exception as e:
        print(f"Error en el preprocesamiento: {e}")
        return None, False

@app.route("/process-image", methods=["POST"])
def process_image():
    try:
        # Extraer el token del header (si existe)
        auth_header = request.headers.get("Authorization")
        token = None
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

        if "image" not in request.files:
            return (
                jsonify(
                    {
                        "gesture": 0,
                        "gesture_name": "No face detected",
                        "confidence": 0.0,
                        "token": token,
                    }
                ),
                400,
            )

        # Leer la imagen enviada desde el frontend
        image_file = request.files["image"]
        image_bytes = np.frombuffer(image_file.read(), np.uint8)
        frame = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)

        # Preprocesar la imagen
        roi_expanded, face_detected = preprocess_image(frame)

        if not face_detected:
            # Si no se detecta ningún rostro, devolver gesture 0
            return (
                jsonify(
                    {
                        "gesture": 0,
                        "gesture_name": "No face detected",
                        "confidence": 0.0,
                        "token": token,
                    }
                ),
                200,
            )

        # Realizar la predicción
        prediction = model.predict(roi_expanded)
        gesture_index = (
            np.argmax(prediction) + 1
        )  # Ajustar índice para que comience en 1
        gesture_name = class_names[gesture_index - 1]  # Mapear índice a nombre de clase
        confidence = float(np.max(prediction))

        # Devolver el resultado al frontend
        return (
            jsonify(
                {
                    "gesture": int(gesture_index),
                    "gesture_name": gesture_name,
                    "confidence": confidence,
                    "token": token,
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error procesando la imagen: {e}")
        return jsonify({"error": "Error procesando la imagen"}), 500


if __name__ == "__main__":
    app.run(debug=True)
