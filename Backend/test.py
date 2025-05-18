import cv2
import tensorflow as tf
import numpy as np

# Cargar el modelo .h5
model = tf.keras.models.load_model("./models/Drownsinness.h5")
class_names = ['Attention', 'EyesClosed', 'Yawning']  # Clases del modelo

# Cargar clasificador Haar Cascade para detección de rostros
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

def preprocess_frame(frame, target_size=(64, 64)):
    try:
        # Convertir a escala de grises para detección facial
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)

        # Detección de rostros
        faces = face_cascade.detectMultiScale(gray, 1.1, 5, minSize=(100, 100))

        if len(faces) > 0:
            # Tomar el primer rostro detectado
            x, y, w, h = faces[0]

            # Aumentar área en 20% manteniendo el centro
            zoom_factor = 1.2
            new_size = int(max(w, h) * zoom_factor)
            center_x, center_y = x + w // 2, y + h // 2

            # Calcular nuevos bordes
            x1 = max(0, center_x - new_size // 2)
            y1 = max(0, center_y - new_size // 2)
            x2 = min(frame.shape[1], center_x + new_size // 2)
            y2 = min(frame.shape[0], center_y + new_size // 2)

            # Recortar región de interés
            roi = gray[y1:y2, x1:x2]
        else:
            # Si no se detecta rostro, usar la imagen completa
            roi = gray

        # Redimensionar a tamaño objetivo
        roi_resized = cv2.resize(roi, target_size, interpolation=cv2.INTER_AREA)

        # Convertir a RGB (el modelo espera 3 canales)
        roi_rgb = cv2.cvtColor(roi_resized, cv2.COLOR_GRAY2RGB)

        # Normalizar los valores de píxeles entre 0 y 1
        roi_normalized = roi_rgb / 255.0

        # Expandir dimensiones para que sea compatible con el modelo (1, 64, 64, 3)
        roi_expanded = np.expand_dims(roi_normalized, axis=0)

        return roi_resized, roi_expanded, len(faces) > 0

    except Exception as e:
        print(f"Error en el preprocesamiento: {e}")
        return None, None, False

def main():
    # Capturar video desde la cámara
    cap = cv2.VideoCapture(0)  # Usa la cámara predeterminada (ID 0)

    if not cap.isOpened():
        print("Error: No se pudo acceder a la cámara.")
        return

    print("Presiona 'q' para salir.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("Error: No se pudo leer el frame de la cámara.")
            break

        # Preprocesar el frame
        roi_resized, roi_expanded, face_detected = preprocess_frame(frame)

        if roi_expanded is not None:
            # Realizar la predicción
            prediction = model.predict(roi_expanded)
            gesture_index = np.argmax(prediction)
            gesture_name = class_names[gesture_index]
            confidence = float(np.max(prediction))

            # Mostrar la imagen procesada en una ventana
            roi_display = cv2.resize(roi_resized, (200, 200), interpolation=cv2.INTER_AREA)
            cv2.putText(roi_display, f"Gesture: {gesture_name}", (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, 255, 2)
            cv2.putText(roi_display, f"Confidence: {confidence:.2f}", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, 255, 2)

            cv2.imshow("Processed ROI", roi_display)

        else:
            # Si no se detecta rostro, mostrar un mensaje
            blank_frame = np.zeros((200, 200), dtype=np.uint8)
            cv2.putText(blank_frame, "No face detected", (10, 100), cv2.FONT_HERSHEY_SIMPLEX, 0.6, 255, 2)
            cv2.imshow("Processed ROI", blank_frame)

        # Salir si se presiona la tecla 'q'
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    # Liberar la cámara y cerrar las ventanas
    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()