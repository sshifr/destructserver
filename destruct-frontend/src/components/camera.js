import React, { useState, useRef, useEffect } from 'react';
import "../styles/Camera.css";

const baseUrl = '/api';

function Camera() {
  const [cameras, setCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedModel, setSelectedModel] = useState('all.pt');
  const [isProcessing, setIsProcessing] = useState(false);
  const [logs, setLogs] = useState([]);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const logsContainerRef = useRef(null);
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const captureTimerRef = useRef(null);

  // Список доступных моделей
  const availableModels = [
    { id: 'all.pt', name: 'Модель всех объектов' },
    { id: 'violence.pt', name: 'Модель насилия' }
  ];

  // Проверка: доступна ли камера в этом контексте (HTTPS или localhost обязательны)
  const isSecureContext = typeof window !== 'undefined' && (
    window.isSecureContext ||
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );
  const hasMediaDevices = typeof navigator !== 'undefined' && navigator.mediaDevices != null;

  // Получение списка доступных камер
  useEffect(() => {
    if (!isSecureContext || !hasMediaDevices) {
      setLogs(prev => [...prev, {
        message: 'Доступ к камере с этого устройства недоступен: браузер разрешает камеру только по HTTPS или с localhost. Откройте сайт по https://... или с того же компьютера по http://localhost',
        type: 'error'
      }]);
      return;
    }

    async function getCameras() {
      console.log('Getting list of cameras...');
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        console.log('All devices:', devices);

        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('Video devices:', videoDevices);

        // Запрашиваем разрешение на доступ к камере для получения меток
        try {
          await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (error) {
          console.log('Camera permission denied:', error);
        }

        // Повторно получаем список устройств, теперь с метками
        const updatedDevices = await navigator.mediaDevices.enumerateDevices();
        const updatedVideoDevices = updatedDevices.filter(device => device.kind === 'videoinput');

        setCameras(updatedVideoDevices);
        if (updatedVideoDevices.length > 0) {
          console.log('Setting default camera:', updatedVideoDevices[0].deviceId);
          setSelectedCamera(updatedVideoDevices[0].deviceId);
          // Запускаем видео с выбранной камерой
          startVideoStream(updatedVideoDevices[0].deviceId);
        } else {
          console.log('No video devices found');
          setLogs(prev => [...prev, {
            message: 'Камеры не найдены. Пожалуйста, проверьте подключение камеры и разрешения браузера.',
            type: 'error'
          }]);
        }
      } catch (error) {
        console.error('Error getting camera list:', error);
        setLogs(prev => [...prev, {
          message: `Ошибка при получении списка камер: ${error.message}`,
          type: 'error'
        }]);
      }
    }
    getCameras();
  }, [isSecureContext, hasMediaDevices]);

  // Функция для запуска видеопотока
  const startVideoStream = async (deviceId) => {
    try {
      // Останавливаем текущий поток, если он есть
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
    } catch (error) {
      console.error('Error starting video stream:', error);
      setLogs(prev => [...prev, {
        message: `Ошибка при запуске видеопотока: ${error.message}`,
        type: 'error'
      }]);
    }
  };

  // Обработка изменения выбранной камеры
  const handleCameraChange = async (event) => {
    const deviceId = event.target.value;
    setSelectedCamera(deviceId);
    await startVideoStream(deviceId);
  };

  // Функция для отрисовки кадра с боксами
  const drawFrame = (imageData) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Создаем изображение из base64
    const img = new Image();
    img.onload = () => {
      // Устанавливаем размеры canvas равными размерам изображения
      canvas.width = img.width;
      canvas.height = img.height;

      // Очищаем canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Рисуем изображение
      ctx.drawImage(img, 0, 0);
    };
    img.src = `data:image/jpeg;base64,${imageData}`;
  };

  const startWebSocketStream = () => {
    // ws://localhost/api/ws/camera (nginx проксирует на backend /ws/camera)
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsUrl = `${wsProtocol}://${window.location.host}${baseUrl}/ws/camera`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setLogs(prev => [...prev, { message: 'WebSocket подключен', type: 'info' }]);
      ws.send(JSON.stringify({ type: 'init', model: selectedModel }));

      // Начинаем слать кадры (примерно 5 FPS)
      captureTimerRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        const video = videoRef.current;
        if (video.readyState < 2) return;

        const capCanvas = document.createElement('canvas');
        const w = video.videoWidth || 640;
        const h = video.videoHeight || 480;
        capCanvas.width = w;
        capCanvas.height = h;
        const ctx = capCanvas.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);
        const dataUrl = capCanvas.toDataURL('image/jpeg', 0.7);
        ws.send(JSON.stringify({ type: 'frame', image: dataUrl }));
      }, 200);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.status === 'frame' && data.image) {
          drawFrame(data.image);
          return;
        }
        if (data.status && data.message) {
          setLogs(prev => [...prev, { message: data.message, type: data.status }]);
        }
      } catch (e) {
        setLogs(prev => [...prev, { message: `WS parse error: ${e.message}`, type: 'error' }]);
      }
    };

    ws.onerror = () => {
      setLogs(prev => [...prev, { message: 'WebSocket ошибка', type: 'error' }]);
    };

    ws.onclose = () => {
      setLogs(prev => [...prev, { message: 'WebSocket отключен', type: 'info' }]);
    };
  };

  const stopWebSocketStream = () => {
    if (captureTimerRef.current) {
      clearInterval(captureTimerRef.current);
      captureTimerRef.current = null;
    }
    if (wsRef.current) {
      try {
        wsRef.current.send(JSON.stringify({ type: 'stop' }));
      } catch (_) { }
      try {
        wsRef.current.close();
      } catch (_) { }
      wsRef.current = null;
    }
  };

  // Запуск анализа
  const handleStartClick = async () => {
    console.log('Start button clicked');
    console.log('Selected camera:', selectedCamera);
    console.log('Selected model:', selectedModel);

    if (!selectedCamera || isProcessing) {
      console.log('Cannot start: no camera selected or already processing');
      return;
    }

    setIsProcessing(true);
    setLogs([]);

    try {
      // Важно: реальная камера на клиенте, сервер только обрабатывает кадры.
      startWebSocketStream();
    } catch (error) {
      console.error('Error starting WS stream:', error);
      setLogs(prev => [...prev, { message: `Ошибка: ${error.message}`, type: 'error' }]);
      setIsProcessing(false);
    }
  };

  // Остановка анализа
  const handleStopClick = async () => {
    try {
      stopWebSocketStream();
      setIsProcessing(false);
      setLogs(prev => [...prev, { message: 'Анализ остановлен', type: 'info' }]);
    } catch (error) {
      console.error('Ошибка при остановке анализа:', error);
      setLogs(prev => [...prev, { message: `Ошибка при остановке: ${error.message}`, type: 'error' }]);
    }
  };

  // Прокрутка логов вниз
  useEffect(() => {
    if (logsContainerRef.current) {
      const logsElement = logsContainerRef.current.querySelector('.logs');
      if (logsElement) {
        logsElement.scrollTop = logsElement.scrollHeight;
      }
    }
  }, [logs]);

  return (
    <div className="camera-component">
      {(!isSecureContext || !hasMediaDevices) && (
        <div className="camera-insecure-warning" role="alert">
          Доступ к камере с этого устройства недоступен: браузер разрешает камеру только по <strong>HTTPS</strong> или с <strong>localhost</strong>. Откройте сайт по https://… или с того же компьютера по http://localhost.
        </div>
      )}
      <div className="camera-controls">
        <div className="camera-select">
          <label htmlFor="cameraSelect">Выберите камеру:</label>
          <select
            id="cameraSelect"
            value={selectedCamera}
            onChange={handleCameraChange}
            disabled={isProcessing}
          >
            {cameras.map((camera) => (
              <option key={camera.deviceId} value={camera.deviceId}>
                {camera.label || `Камера ${camera.deviceId.slice(0, 5)}...`}
              </option>
            ))}
          </select>
        </div>

        <div className="model-select">
          <label htmlFor="modelSelect">Выберите модель:</label>
          <select
            id="modelSelect"
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isProcessing}
          >
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="video-container">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="camera-feed"
        />
        <canvas
          ref={canvasRef}
          className="detection-canvas"
        />
      </div>

      <div className="buttons-container">
        <button
          className={`button ${isProcessing ? 'button-disabled' : ''}`}
          onClick={handleStartClick}
          disabled={isProcessing}
        >
          Начать
        </button>
        {isProcessing && (
          <button className="button stop-button" onClick={handleStopClick}>
            Остановить
          </button>
        )}
      </div>

      {logs.length > 0 && (
        <div className="logs-container" ref={logsContainerRef}>
          <h3>Результаты анализа:</h3>
          <div className="logs">
            {logs.map((log, index) => (
              <div key={index} className={`log-line log-${log.type}`}>
                {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default Camera;
