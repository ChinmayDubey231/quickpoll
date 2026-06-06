import { useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

export default function QRCode({ url, size = 160 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCodeLib.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: { dark: '#1e1b4b', light: '#ffffff' },
    });
  }, [url, size]);

  return (
    <div className="flex flex-col items-center gap-2">
      <canvas ref={canvasRef} className="rounded-lg" />
      <p className="text-xs text-gray-400">Scan to vote</p>
    </div>
  );
}
