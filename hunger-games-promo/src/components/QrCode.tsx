import React, {useMemo} from 'react';
import QRCode from 'qrcode';

/** QR-код в SVG, строится прямо при рендере из ссылки в конфиге. */
export const QrCode: React.FC<{text: string; size: number; color?: string; background?: string}> = ({
  text,
  size,
  color = '#0a1a33',
  background = '#ffffff',
}) => {
  const {path, n} = useMemo(() => {
    const qr = QRCode.create(text, {errorCorrectionLevel: 'M'});
    const count = qr.modules.size;
    let d = '';
    for (let r = 0; r < count; r++) {
      for (let c = 0; c < count; c++) {
        if (qr.modules.get(r, c)) d += `M${c} ${r}h1v1h-1z`;
      }
    }
    return {path: d, n: count};
  }, [text]);
  const quiet = 2;
  return (
    <svg
      width={size}
      height={size}
      viewBox={`${-quiet} ${-quiet} ${n + quiet * 2} ${n + quiet * 2}`}
      shapeRendering="crispEdges"
    >
      <rect x={-quiet} y={-quiet} width={n + quiet * 2} height={n + quiet * 2} fill={background} />
      <path d={path} fill={color} />
    </svg>
  );
};
