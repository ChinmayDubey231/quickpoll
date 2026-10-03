import { useEffect, useRef } from 'react';
import QRCodeLib from 'qrcode';

interface QRCodeProps {
  url: string;
  // Displayed size in CSS pixels; the bitmap is drawn at the screen's pixel density
  size?: number;
  className?: string;
}

// Dark modules on white whatever the theme, since scanners expect that; place
// it on a white tile. The size is fixed up front so nothing shifts once it draws.
export default function QRCode({ url, size = 160, className = '' }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !url) return;
    const scale = Math.min(Math.ceil(window.devicePixelRatio || 1), 3);
    QRCodeLib.toCanvas(canvas, url, {
      width: size * scale,
      margin: 0,
      color: { dark: '#121213', light: '#ffffff' },
    })
      // The library sizes the element to the bitmap; put the display size back
      .then(() => {
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
      })
      .catch(() => {});
  }, [url, size]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="QR code for the poll link"
      className={`block ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
