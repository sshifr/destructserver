import React, { useState, useRef, useEffect, useCallback } from 'react';
import '../styles/IPCamera.css';

const IPCamera = () => {
    const [selectedModel, setSelectedModel] = useState('all.pt');
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState([]);
    const [rtspUrl, setRtspUrl] = useState('');
    const [motionDetection, setMotionDetection] = useState(false);
    const [nightMode, setNightMode] = useState(false);
    const canvasRef = useRef(null);
    const logsContainerRef = useRef(null);
    
    // Состояние для отображения информации об обнаруженных объектах, движении и сцене
    const [detectedObjects, setDetectedObjects] = useState([]);
    const [hasMotion, setHasMotion] = useState(false);
    const [sceneType, setSceneType] = useState(null); // 'day' | 'night' | null

    const models = [
        { id: 'all.pt', name: 'Модель всех объектов' },
        { id: 'violence.pt', name: 'Модель насилия' }
    ];

    const addLog = (message, type = 'info') => {
        setLogs(prevLogs => [...prevLogs, { message, type, timestamp: new Date().toISOString() }]);
    };

    const drawFrame = (imageData) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
        };
        
        img.src = `data:image/jpeg;base64,${imageData}`;
    };

    const startAnalysis = async () => {
        if (!rtspUrl) {
            addLog('Пожалуйста, введите RTSP URL', 'error');
            return;
        }

        setIsProcessing(true);
        addLog('Запуск анализа...');
        addLog(`Параметры: ночной режим = ${nightMode}, датчик движения = ${motionDetection}`);
        
        // Сбрасываем состояние при новом запуске
        setDetectedObjects([]);
        setHasMotion(false);
        setSceneType(null);

        try {
            const params = new URLSearchParams({
                model: selectedModel,
                rtspUrl: rtspUrl,
                motionDetection: motionDetection.toString(),
                nightMode: nightMode.toString()
            });
            
            const url = `/api/start-ip-camera?${params.toString()}`;
            console.log('Requesting URL:', url);
            
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'text/event-stream'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Server response:', errorText);
                throw new Error(`Ошибка запуска анализа: ${response.status} ${response.statusText}\nПроверьте, что сервер запущен на порту 3001`);
            }

            if (!response.headers.get('content-type')?.includes('text/event-stream')) {
                throw new Error('Неверный тип ответа от сервера. Ожидается text/event-stream');
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // Оставляем последнюю неполную строку в буфере

                for (const line of lines) {
                    if (!line.trim()) continue;
                    
                    // Проверяем, что строка начинается с "data: "
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.slice(6); // Убираем "data: " из начала строки
                            const data = JSON.parse(jsonStr);
                            console.log('Parsed data:', data);
                            
                            switch (data.status) {
                                case 'info':
                                    addLog(data.message);
                                    // Используем структурированные данные из JSON, если они есть
                                    if (data.detections && Array.isArray(data.detections)) {
                                        setDetectedObjects(data.detections);
                                    } else {
                                        // Fallback: парсим из текста
                                        const msg = data.message || '';
                                        if (msg.includes('Обнаружено') && msg.includes('объект')) {
                                            const match = msg.match(/Обнаружено (\d+) объектов?: (.+)/);
                                            if (match) {
                                                const objects = match[2].split(', ').map(obj => obj.trim());
                                                setDetectedObjects(objects);
                                            }
                                        } else if (msg.includes('Объекты не обнаружены')) {
                                            setDetectedObjects([]);
                                        }
                                    }
                                    
                                    // Движение из структурированных данных
                                    if (typeof data.motion === 'boolean') {
                                        setHasMotion(data.motion);
                                    } else {
                                        // Fallback: парсим из текста
                                        const msg = data.message || '';
                                        if (msg.includes('Обнаружено движение') || msg.includes('движение в ночном режиме')) {
                                            setHasMotion(true);
                                        } else if (msg.includes('Движение не обнаружено')) {
                                            setHasMotion(false);
                                        }
                                    }
                                    
                                    // Тип сцены из структурированных данных
                                    if (data.scene_type) {
                                        setSceneType(data.scene_type === 'ночная' ? 'night' : 'day');
                                    } else {
                                        // Fallback: парсим из текста
                                        const msg = data.message || '';
                                        if (msg.includes('Текущая сцена:')) {
                                            if (msg.includes('ночная')) {
                                                setSceneType('night');
                                            } else if (msg.includes('дневная')) {
                                                setSceneType('day');
                                            }
                                        } else if (msg.includes('ночная') || msg.includes('ночной')) {
                                            setSceneType('night');
                                        } else if (msg.includes('дневная') || msg.includes('дневной')) {
                                            setSceneType('day');
                                        }
                                    }
                                    break;
                                case 'warning':
                                    addLog(data.message, 'warning');
                                    // Проверяем движение в предупреждениях
                                    if (data.message.includes('движение')) {
                                        setHasMotion(true);
                                    }
                                    break;
                                case 'error':
                                    addLog(data.message, 'error');
                                    break;
                                case 'frame':
                                    drawFrame(data.image);
                                    break;
                                default:
                                    console.log('Unknown status:', data.status);
                                    break;
                            }
                        } catch (e) {
                            console.error('Error parsing line:', line);
                            console.error('Parse error:', e);
                            addLog(`Ошибка обработки данных: ${e.message}`, 'error');
                        }
                    } else {
                        console.log('Skipping non-data line:', line);
                    }
                }
            }
        } catch (error) {
            console.error('Full error:', error);
            addLog(`Ошибка: ${error.message}`, 'error');
        } finally {
            setIsProcessing(false);
        }
    };

    const stopAnalysis = useCallback(async () => {
        try {
            const response = await fetch('/api/stop-ip-camera', {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error('Ошибка остановки анализа');
            }

            addLog('Анализ остановлен');
            setIsProcessing(false);
        } catch (error) {
            addLog(`Ошибка при остановке: ${error.message}`, 'error');
        }
    }, []);

    useEffect(() => {
        return () => {
            if (isProcessing) {
                stopAnalysis();
            }
        };
    }, [isProcessing, stopAnalysis]);

    // Прокрутка логов вниз при появлении новых
    useEffect(() => {
        if (logsContainerRef.current) {
            logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
        }
    }, [logs]);

    return (
        <div className="ip-camera-container">
            <div className="ip-camera-video-container">
                <canvas ref={canvasRef} className="ip-camera-feed" />
            </div>

            <div className="ip-camera-controls">
                <div className="ip-camera-model-select">
                    <label>Модель:</label>
                    <select
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        disabled={isProcessing}
                    >
                        {models.map(model => (
                            <option key={model.id} value={model.id}>
                                {model.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="ip-camera-rtsp-input">
                    <label>RTSP URL:</label>
                    <input
                        type="text"
                        value={rtspUrl}
                        onChange={(e) => setRtspUrl(e.target.value)}
                        placeholder="rtsp://..."
                        disabled={isProcessing}
                    />
                </div>

                <div className="ip-camera-mode-controls">
                    <label className="ip-camera-mode-checkbox">
                        <input
                            type="checkbox"
                            checked={motionDetection}
                            onChange={(e) => setMotionDetection(e.target.checked)}
                            disabled={isProcessing}
                        />
                        Датчик движения
                    </label>

                    <label className="ip-camera-mode-checkbox">
                        <input
                            type="checkbox"
                            checked={nightMode}
                            onChange={(e) => setNightMode(e.target.checked)}
                            disabled={isProcessing}
                        />
                        Ночной режим
                    </label>
                </div>

                <div className="ip-camera-buttons">
                    <button
                        className="ip-camera-start-button"
                        onClick={startAnalysis}
                        disabled={isProcessing || !rtspUrl}
                    >
                        Начать анализ
                    </button>

                    <button
                        className="ip-camera-stop-button"
                        onClick={stopAnalysis}
                        disabled={!isProcessing}
                    >
                        Остановить анализ
                    </button>
                </div>
            </div>

            {/* Секция с информацией об обнаруженных объектах, движении и сцене */}
            {isProcessing && (
                <div className="ip-camera-status-panel">
                    <h3>Текущий статус:</h3>
                    <div className="ip-camera-status-grid">
                        <div className="ip-camera-status-item">
                            <div className="ip-camera-status-label">Обнаружено объектов:</div>
                            <div className="ip-camera-status-value">
                                {detectedObjects.length > 0 ? (
                                    <div className="ip-camera-detected-objects">
                                        {detectedObjects.map((obj, idx) => (
                                            <span key={idx} className="ip-camera-object-tag">{obj}</span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="ip-camera-status-empty">Нет</span>
                                )}
                            </div>
                        </div>
                        
                        <div className="ip-camera-status-item">
                            <div className="ip-camera-status-label">Движение:</div>
                            <div className={`ip-camera-status-value ip-camera-motion-${hasMotion ? 'yes' : 'no'}`}>
                                {hasMotion ? 'Обнаружено' : 'Нет'}
                            </div>
                        </div>
                        
                        <div className="ip-camera-status-item">
                            <div className="ip-camera-status-label">Тип сцены:</div>
                            <div className={`ip-camera-status-value ip-camera-scene-${sceneType || 'unknown'}`}>
                                {sceneType === 'night' ? 'Ночная' : sceneType === 'day' ? 'Дневная' : 'Определяется...'}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="ip-camera-logs-container" ref={logsContainerRef}>
                <h3>Логи анализа:</h3>
                <div className="ip-camera-logs">
                    {logs.map((log, index) => (
                        <div key={index} className={`ip-camera-log ip-camera-log-${log.type}`}>
                            {new Date(log.timestamp).toLocaleTimeString()} - {log.message}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default IPCamera; 