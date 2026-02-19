import React, { useEffect, useRef } from 'react';
import '../styles/ProgressModal.css';

function ProgressModal({
    isOpen,
    progress,
    currentFrame,
    totalFrames,
    logs,
    imageUrl,
    detectedObjects,
    onClose,
    onStop
}) {
    const modalRef = useRef(null);
    const logsRef = useRef(null);

    useEffect(() => {
        if (logsRef.current) {
            logsRef.current.scrollTop = logsRef.current.scrollHeight;
        }
    }, [logs]);

    useEffect(() => {
        const handleEscape = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const progressPercent = totalFrames > 0
        ? Math.round((currentFrame / totalFrames) * 100)
        : progress || 0;

    return (
        <div className="progress-modal-overlay" onClick={onClose}>
            <div className="progress-modal-content" onClick={(e) => e.stopPropagation()} ref={modalRef}>
                <div className="progress-modal-header">
                    <h2>Обработка в процессе</h2>
                    <button className="progress-modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>

                <div className="progress-modal-body">
                    {/* Изображение/видео с боксами */}
                    {imageUrl && (
                        <div className="progress-modal-preview">
                            {imageUrl.startsWith('data:image') ? (
                                <img src={imageUrl} alt="Preview with detections" />
                            ) : imageUrl.endsWith('.mp4') || imageUrl.endsWith('.avi') || imageUrl.endsWith('.mov') ? (
                                <video src={imageUrl} controls autoPlay muted />
                            ) : (
                                <img src={imageUrl} alt="Preview" />
                            )}
                        </div>
                    )}

                    {/* Ползунок прогресса */}
                    <div className="progress-modal-progress-section">
                        <div className="progress-info">
                            <span className="progress-text">
                                {totalFrames > 0
                                    ? `Кадр ${currentFrame} из ${totalFrames}`
                                    : 'Обработка...'}
                            </span>
                            <span className="progress-percent">{progressPercent}%</span>
                        </div>
                        <div className="progress-bar-container">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                    </div>

                    {/* Обнаруженные объекты */}
                    {detectedObjects && detectedObjects.length > 0 && (
                        <div className="progress-modal-detections">
                            <h3>Обнаружено:</h3>
                            <div className="detected-objects-list">
                                {detectedObjects.map((obj, idx) => (
                                    <span key={idx} className="detected-object-tag">
                                        {obj}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Логи */}
                    <div className="progress-modal-logs" ref={logsRef}>
                        <h3>Лог обработки:</h3>
                        <div className="logs-content">
                            {logs.length === 0 ? (
                                <div className="log-entry info">Ожидание начала обработки...</div>
                            ) : (
                                logs.map((log, index) => (
                                    <div key={index} className={`log-entry ${log.type || 'info'}`}>
                                        {log.message}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="progress-modal-footer">
                    <button className="progress-modal-stop-btn" onClick={onStop}>
                        <i className="fas fa-stop"></i> Остановить
                    </button>
                </div>
            </div>
        </div>
    );
}

export default ProgressModal;
