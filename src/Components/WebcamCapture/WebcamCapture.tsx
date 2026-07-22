import { useEffect, useRef, useState } from 'react';
import { Modal, Button, Alert } from 'antd';
import { CameraOutlined } from '@ant-design/icons';

interface WebcamCaptureProps {
  buttonLabel?: string;
  onCapture: (file: File) => void;
}

/**
 * Bouton "Prendre une photo" qui ouvre une fenêtre de capture webcam (getUserMedia)
 * et renvoie directement un File au parent, sans passage par un fichier externe.
 * Reste facultatif : si la webcam n'est pas disponible/autorisée, l'agent garde
 * la possibilité d'utiliser l'upload de fichier classique à côté de ce bouton.
 */
const WebcamCapture = ({ buttonLabel = 'Prendre une photo', onCapture }: WebcamCaptureProps) => {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);

    navigator.mediaDevices?.getUserMedia({ video: { width: 640, height: 480 } })
      .then(stream => {
        if (cancelled) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch(() => {
        setError("Impossible d'accéder à la webcam. Vérifiez les permissions ou utilisez le téléversement classique.");
      });

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [open]);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(blob => {
      if (!blob) return;
      const file = new File([blob], `photo_webcam_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      setOpen(false);
    }, 'image/jpeg', 0.9);
  };

  return (
    <>
      <Button icon={<CameraOutlined />} onClick={() => setOpen(true)}>
        {buttonLabel}
      </Button>

      <Modal
        title="Capture photo (webcam)"
        open={open}
        onCancel={() => setOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setOpen(false)}>Annuler</Button>,
          <Button key="capture" type="primary" icon={<CameraOutlined />} onClick={handleCapture} disabled={!!error}>
            Capturer
          </Button>
        ]}
        destroyOnClose
        centered
      >
        {error ? (
          <Alert type="warning" showIcon message={error} />
        ) : (
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', borderRadius: 8 }} />
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </Modal>
    </>
  );
};

export default WebcamCapture;
