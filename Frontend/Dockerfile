# Etapa de desarrollo
FROM node:lts-alpine3.21

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar archivos de configuración e instalar dependencias
COPY package*.json ./
RUN npm install

# Copiar el resto del código
COPY . .

# Exponer el puerto por defecto de React
EXPOSE 3000

# Comando para iniciar el servidor de desarrollo
CMD ["npm", "start"]
