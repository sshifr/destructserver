FROM node:22.13.1

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем зависимости
RUN npm install

# Копируем остальные файлы
COPY . .

# Expose порт для React dev server
EXPOSE 3000

# Запускаем dev server
CMD ["npm", "start"]
