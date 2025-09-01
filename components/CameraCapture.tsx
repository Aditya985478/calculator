import React, { useState, useRef, useEffect, useCallback } from 'react';
import Icon from './Icon';

interface CameraCaptureProps {
  onCapture: (file: File) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stopStream = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    let isMounted = true;

    const startStream = async () => {
      // Stop any existing stream before starting a new one.
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });

        if (isMounted) {
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        }
      } catch (err) {
        console.error("Camera access error:", err);
        if (isMounted) {
            if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError')) {
                setError("Camera permission denied. Please enable it in your browser settings.");
            } else {
                 setError("Could not access the camera. Please ensure it is not in use by another application.");
            }
        }
      }
    };

    startStream();

    return () => {
      isMounted = false;
      stopStream();
    };
  }, []); // Rerunning this effect can cause issues, so we only run it once.

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current || !stream) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) {
          const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
          stopStream();
          onCapture(file);
        }
      }, 'image/jpeg', 0.95);
    }
  };
  
  const handleClose = () => {
      stopStream();
      onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center" role="dialog" aria-modal="true">
      {error ? (
        <div className="text-white text-center p-8 bg-gray-800 rounded-lg mx-4">
            <h3 className="text-xl font-bold text-red-500 mb-4">Camera Error</h3>
            <p>{error}</p>
            <button onClick={handleClose} className="mt-6 w-full bg-key-orange text-text-on-orange font-semibold py-3 rounded-lg">Close</button>
        </div>
      ) : (
        <>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="absolute top-0 left-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex flex-col justify-between items-center p-6 z-10">
            <div className="w-full flex justify-end">
                <button onClick={handleClose} className="p-3 bg-black bg-opacity-50 rounded-full text-white" aria-label="Close camera">
                    <Icon icon="close" className="w-6 h-6" />
                </button>
            </div>
            
            <div className="w-full flex justify-center">
                 <button 
                    onClick={handleCapture} 
                    className="w-20 h-20 rounded-full bg-white flex items-center justify-center ring-4 ring-white ring-opacity-50 disabled:opacity-50"
                    aria-label="Capture photo"
                    disabled={!stream}
                 >
                    <div className="w-16 h-16 rounded-full bg-white border-2 border-black"></div>
                 </button>
            </div>
          </div>
        </>
      )}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default CameraCapture;
