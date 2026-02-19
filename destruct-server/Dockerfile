FROM python:3.9.6-slim

# Устанавливаем системные зависимости для OpenCV и других библиотек
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    ffmpeg \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Устанавливаем Node.js отдельно для лучшей кэшируемости
# Используем retry для обработки временных сетевых ошибок
RUN for i in 1 2 3; do \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y --no-install-recommends nodejs && \
    break || sleep 5; \
    done && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Проверяем версию Node.js и npm
RUN node --version && npm --version

WORKDIR /app

# Копируем package.json и устанавливаем Node.js зависимости
COPY package*.json ./
RUN npm install

# Копируем requirements.txt и устанавливаем Python зависимости
COPY requirements.txt .
# Обновляем pip/setuptools/wheel, иначе PEP517 сборки (например, openai-whisper) могут падать с pkg_resources
RUN python -m pip install --no-cache-dir --upgrade pip wheel "setuptools<70"
RUN pip install --no-cache-dir -r requirements.txt
# Устанавливаем openai-whisper отдельно без build isolation (иначе может падать с pkg_resources)
RUN pip install --no-cache-dir --no-build-isolation "openai-whisper==20231117"

# Копируем остальные файлы
COPY . .

# Expose порт для backend
EXPOSE 3001

# Запускаем сервер
CMD ["npm", "start"]
