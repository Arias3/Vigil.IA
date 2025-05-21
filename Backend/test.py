import cv2
import tensorflow as tf
import numpy as np

# Cargar el modelo .h5
model = tf.keras.models.load_model("./models/2105.h5")
class_names = ['Attention', 'EyesClosed', 'Yawning']  # Ajusta si tus clases son diferentes

def preprocess_frame(frame, target_size=(112, 112)):
    # Convertir a escala de grises
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    # Redimensionar
    resized = cv2.resize(gray, target_size, interpolation=cv2.INTER_AREA)
    # Normalizar y expandir dimensiones
    norm = resized / 255.0
    expanded = np.expand_dims(norm, axis=(0, -1))  # (1, 112, 112, 1)
    return expanded, resized

def main():
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("No se pudo acceder a la cámara.")
        return

    print("Presiona 'q' para salir.")

    while True:
        ret, frame = cap.read()
        if not ret:
            print("No se pudo leer el frame de la cámara.")
            break

        input_tensor, display_img = preprocess_frame(frame)
        prediction = model.predict(input_tensor)
        gesture_index = np.argmax(prediction)
        gesture_name = class_names[gesture_index]
        confidence = float(np.max(prediction))

        # Mostrar resultado en la imagen
        display = cv2.cvtColor(display_img, cv2.COLOR_GRAY2BGR)
        cv2.putText(display, f"{gesture_name} ({confidence:.2f})", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.imshow("CNN Webcam Test", display)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()