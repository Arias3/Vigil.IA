from flask import Flask, request, jsonify
from flask_cors import CORS
import tensorflow as tf
import numpy as np
import cv2
import pandas as pd
import os
import uuid
import mediapipe as mp
import threading
import math
import time
from functools import wraps
from custom_layers.layers import (
    DrowsinessIndexLayer,
    AttentionConsecutiveAdjustment,
    EyesClosedConsecutiveAdjustment,
    YawningConsecutiveAdjustment,
    CombinedConsecutiveAdjustment,
    ExtremeValueAdjustment
)
from custom_layers.constraints import MinMaxValueConstraint
from sklearn.preprocessing import LabelEncoder
from tensorflow.keras.preprocessing.sequence import pad_sequences

app = Flask(__name__)
CORS(app)

# ================= FUNCIONES AUXILIARES =================
def crear_encoder_gestos():
    """Crea y ajusta el encoder de gestos igual que durante el entrenamiento"""
    encoder = LabelEncoder()
    encoder.fit(GESTOS_VALIDOS)
    return encoder

# ================= CONFIGURACIÓN =================
EXCEL_FILE = "gesture_sequence.xlsx"
MAX_RECORDS = 240
class_names = ["Attention", "EyesClosed", "Yawning"]
mp_face_detection = mp.solutions.face_detection
GESTOS_VALIDOS = ['Attention', 'Yawning', 'EyesClosed']
MAX_LEN = 240
gesture_encoder = crear_encoder_gestos()  # Usando tu función existente
excel_lock = threading.Lock()
MAX_RETRIES = 3
RETRY_DELAY = 0.1

# Configuración de modelos personalizados
custom_objects = {
    'MinMaxValueConstraint': MinMaxValueConstraint,
    'DrowsinessIndexLayer': DrowsinessIndexLayer,
    'AttentionConsecutiveAdjustment': AttentionConsecutiveAdjustment,
    'EyesClosedConsecutiveAdjustment': EyesClosedConsecutiveAdjustment,
    'YawningConsecutiveAdjustment': YawningConsecutiveAdjustment,
    'CombinedConsecutiveAdjustment': CombinedConsecutiveAdjustment,
    'ExtremeValueAdjustment': ExtremeValueAdjustment
}

# Carga de modelos
lstm_model = tf.keras.models.load_model(
    "./models/Modelo_6_capas_2.h5",
    custom_objects=custom_objects,
    compile=False
)

cnn_model = tf.keras.models.load_model("./models/model1805.h5")

def synchronized_excel_access(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        last_exception = None
        for attempt in range(MAX_RETRIES):
            try:
                with excel_lock:
                    result = func(*args, **kwargs)
                return result
            except Exception as e:
                last_exception = e
                time.sleep(RETRY_DELAY)
        print(f"Failed to access Excel file after {MAX_RETRIES} attempts: {last_exception}")
        # Return safe default values depending on the function
        if func.__name__ == "get_drowsiness_index":
            return 0.0
        elif func.__name__ == "update_gesture_sequence":
            return pd.DataFrame({'Step': range(1, MAX_RECORDS + 1), 'Gesture': ['Attention'] * MAX_RECORDS})
        else:
            raise last_exception
    return wrapper

# ================= FUNCIONES MEJORADAS =================
@synchronized_excel_access
def initialize_excel():
    """Inicializa el archivo Excel con 240 registros de 'Attention'"""
    if not os.path.exists(EXCEL_FILE):
        df = pd.DataFrame({
            'Step': range(1, MAX_RECORDS + 1),
            'Gesture': ['Attention'] * MAX_RECORDS
        })
        df.to_excel(EXCEL_FILE, index=False)
    else:
        # Verificar que el archivo existente tenga el formato correcto
        try:
            df = pd.read_excel(EXCEL_FILE)
            if len(df) < MAX_RECORDS:
                missing = MAX_RECORDS - len(df)
                new_rows = pd.DataFrame({
                    'Step': range(len(df) + 1, len(df) + missing + 1),
                    'Gesture': ['Attention'] * missing
                })
                df = pd.concat([df, new_rows], ignore_index=True)
                df.to_excel(EXCEL_FILE, index=False)
        except:
            # Si hay algún error con el archivo existente, lo recreamos
            df = pd.DataFrame({
                'Step': range(1, MAX_RECORDS + 1),
                'Gesture': ['Attention'] * MAX_RECORDS
            })
            df.to_excel(EXCEL_FILE, index=False)

@synchronized_excel_access
def update_gesture_sequence(new_gesture):
    """Actualiza la secuencia de gestos con el nuevo gesto"""
    # Validar el gesto
    valid_gestures = ['Attention', 'Yawning', 'EyesClosed']
    gesture = new_gesture if new_gesture in valid_gestures else 'Attention'
    
    try:
        df = pd.read_excel(EXCEL_FILE)
    except:
        initialize_excel()
        df = pd.read_excel(EXCEL_FILE)
    
    # Verificar integridad del DataFrame
    if 'Step' not in df.columns or 'Gesture' not in df.columns:
        initialize_excel()
        df = pd.read_excel(EXCEL_FILE)
    
    # Verificar si hay menos de 240 registros y completar con 'Attention'
    if len(df) < MAX_RECORDS:
        missing = MAX_RECORDS - len(df)
        new_rows = pd.DataFrame({
            'Step': range(len(df) + 1, len(df) + missing + 1),
            'Gesture': ['Attention'] * missing
        })
        df = pd.concat([df, new_rows], ignore_index=True)
    
    # Asegurar que tenemos exactamente MAX_RECORDS registros
    df = df.tail(MAX_RECORDS).copy()
    df['Step'] = range(1, MAX_RECORDS + 1)  # Reindexar pasos
    
    # Desplazar todos los gestos hacia arriba (Step 240 → 239, 239 → 238, etc.)
    df['Gesture'] = df['Gesture'].shift(-1)
    df.loc[df['Step'] == MAX_RECORDS, 'Gesture'] = gesture
    
    # Guardar el archivo actualizado
    df.to_excel(EXCEL_FILE, index=False)
    
    return df

@synchronized_excel_access
def get_drowsiness_index():
    """Calcula el índice de somnolencia replicando exactamente el preprocesamiento del entrenamiento"""
    try:
        # 1. Leer y procesar el archivo (igual que procesar_archivo())
        df = pd.read_excel(EXCEL_FILE)
        
        # Validación de estructura
        if 'Gesture' not in df.columns:
            print("❌ Error: Archivo no contiene columna 'Gesture'")
            return 0.0
            
        # Limpieza idéntica al entrenamiento
        df = df.dropna(subset=['Gesture'])
        df = df[df['Gesture'].isin(GESTOS_VALIDOS)]
        
        if len(df) == 0:
            print("⚠️ Advertencia: Archivo vacío después de limpieza, usando secuencia por defecto")
            secuencia_gestos = ['Attention'] * MAX_LEN
        else:
            secuencia_gestos = df['Gesture'].tail(MAX_LEN).tolist()
            # Si no hay suficientes gestos, completamos con 'Attention' al inicio
            if len(secuencia_gestos) < MAX_LEN:
                secuencia_gestos = ['Attention'] * (MAX_LEN - len(secuencia_gestos)) + secuencia_gestos
        
        # 2. Codificación idéntica al entrenamiento
        secuencia_codificada = gesture_encoder.transform(secuencia_gestos)
        
        # 3. Padding y reshape (igual que preparar_datos())
        secuencia_padded = pad_sequences(
            [secuencia_codificada],
            maxlen=MAX_LEN,
            padding='post',
            truncating='post'
        )
        
        # Conversión a float32 para compatibilidad con el modelo
        X = secuencia_padded.reshape((1, MAX_LEN, 1)).astype(np.float32)
        
        # 4. Predicción (manteniendo el formato de salida original)
        extreme_adjusted_index, _ = lstm_model.predict(X, verbose=0)
        confidence = float(extreme_adjusted_index[0][0]) * 100
        
        # Aseguramos que el resultado esté en el rango correcto
        return min(max(round(confidence), 0), 100)
    
    except Exception as e:
        print(f"❌ Error crítico en get_drowsiness_index(): {str(e)}")
        return 0.0

def preprocess_image(frame, target_size=(112, 112)):
    """Preprocesa la imagen para el modelo CNN"""
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

# ================= RUTAS FLASK =================
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

        # Realizar la predicción con el modelo CNN
        prediction = cnn_model.predict(roi_expanded)
        gesture_index = np.argmax(prediction) + 1
        gesture_name = class_names[gesture_index - 1]

        print(f"Predicción: {gesture_name} ({gesture_index})")
        
        # Actualizar la secuencia de gestos y calcular el índice
        update_gesture_sequence(gesture_name)
        drowsiness_index = get_drowsiness_index()
        adjusted_drowsiness_index = drowsiness_index/100
        
        # Devolver el resultado al frontend
        return (
            jsonify(
                {
                    "gesture": int(gesture_index),
                    "gesture_name": gesture_name,
                    "confidence": adjusted_drowsiness_index,
                    "token": token,
                }
            ),
            200,
        )

    except Exception as e:
        print(f"Error procesando la imagen: {e}")
        return jsonify({"error": "Error procesando la imagen"}), 500

# ================= INICIO =================
if __name__ == "__main__":
    initialize_excel()
    app.run(debug=True)