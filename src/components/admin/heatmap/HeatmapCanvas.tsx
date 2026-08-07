import { useEffect, useMemo, useRef, useState } from 'react';
import { idealRSSIAt, rssiToColor, type Point3D } from '../../../lib/rfPhysics';

const MAX_CANVAS_WIDTH = 640;
const MAX_CANVAS_HEIGHT = 460;
const CELL_PX = 8;
const BEACON_HIT_RADIUS_PX = 16;

interface Props {
  roomWidthM: number;
  roomLengthM: number;
  beaconXY: { x: number; y: number };
  beaconHeightM: number;
  phoneHeightM: number;
  rssiAt1m: number;
  pathLossExponent: number;
  onBeaconMove: (xy: { x: number; y: number }) => void;
  testPhoneXY: { x: number; y: number } | null;
  onDropTestPhone: (xy: { x: number; y: number }) => void;
}

/**
 * Top-down 2D grid rendering of the room, color-coded by simulated RSSI (Section 1.2). Beacon
 * height and phone height stay as separate numeric controls in the parent's control panel rather
 * than being drag-controlled here — a flat canvas can't sensibly support free 3D dragging without
 * pulling in a 3D rendering library the rest of this dashboard doesn't use, so "drag a beacon
 * across a room grid" is implemented as horizontal (x,y) dragging on this top-down plane, which is
 * what actually varies while an admin is deciding where to mount it in a room's floor plan.
 */
export function HeatmapCanvas({
  roomWidthM,
  roomLengthM,
  beaconXY,
  beaconHeightM,
  phoneHeightM,
  rssiAt1m,
  pathLossExponent,
  onBeaconMove,
  testPhoneXY,
  onDropTestPhone,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDraggingBeacon, setIsDraggingBeacon] = useState(false);
  const [hoverMeter, setHoverMeter] = useState<{ x: number; y: number } | null>(null);
  const [hoverPixel, setHoverPixel] = useState<{ x: number; y: number } | null>(null);
  const justDraggedRef = useRef(false);

  const scale = useMemo(
    () => Math.max(8, Math.min(MAX_CANVAS_WIDTH / roomWidthM, MAX_CANVAS_HEIGHT / roomLengthM)),
    [roomWidthM, roomLengthM],
  );
  const canvasWidth = Math.round(roomWidthM * scale);
  const canvasHeight = Math.round(roomLengthM * scale);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const beaconPoint: Point3D = { x: beaconXY.x, y: beaconXY.y, z: beaconHeightM };

    for (let py = 0; py < canvasHeight; py += CELL_PX) {
      for (let px = 0; px < canvasWidth; px += CELL_PX) {
        const meterX = (px + CELL_PX / 2) / scale;
        const meterY = (py + CELL_PX / 2) / scale;
        const rssi = idealRSSIAt(beaconPoint, { x: meterX, y: meterY, z: phoneHeightM }, rssiAt1m, pathLossExponent);
        ctx.fillStyle = rssiToColor(rssi);
        ctx.fillRect(px, py, CELL_PX, CELL_PX);
      }
    }

    // 1-meter gridlines for spatial reference against the raw color field.
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let m = 1; m < roomWidthM; m++) {
      const px = Math.round(m * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, canvasHeight);
      ctx.stroke();
    }
    for (let m = 1; m < roomLengthM; m++) {
      const py = Math.round(m * scale) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(canvasWidth, py);
      ctx.stroke();
    }

    // Beacon marker.
    const beaconPx = beaconXY.x * scale;
    const beaconPy = beaconXY.y * scale;
    ctx.beginPath();
    ctx.arc(beaconPx, beaconPy, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(beaconPx, beaconPy, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#2563eb';
    ctx.fill();

    // Test phone pin, if the admin has dropped one.
    if (testPhoneXY) {
      const pinPx = testPhoneXY.x * scale;
      const pinPy = testPhoneXY.y * scale;
      ctx.beginPath();
      ctx.arc(pinPx, pinPy, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#7c3aed';
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(pinPx, pinPy, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#7c3aed';
      ctx.fill();
    }
  }, [canvasWidth, canvasHeight, scale, beaconXY, beaconHeightM, phoneHeightM, rssiAt1m, pathLossExponent, roomWidthM, roomLengthM, testPhoneXY]);

  const eventToMeter = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    return {
      meter: { x: Math.max(0, Math.min(roomWidthM, px / scale)), y: Math.max(0, Math.min(roomLengthM, py / scale)) },
      pixel: { x: px, y: py },
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { pixel } = eventToMeter(e);
    const beaconPx = beaconXY.x * scale;
    const beaconPy = beaconXY.y * scale;
    const dist = Math.hypot(pixel.x - beaconPx, pixel.y - beaconPy);
    if (dist <= BEACON_HIT_RADIUS_PX) {
      setIsDraggingBeacon(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { meter, pixel } = eventToMeter(e);
    setHoverMeter(meter);
    setHoverPixel(pixel);
    if (isDraggingBeacon) {
      onBeaconMove(meter);
    }
  };

  const handleMouseUp = () => {
    if (isDraggingBeacon) {
      justDraggedRef.current = true;
      setIsDraggingBeacon(false);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    const { meter } = eventToMeter(e);
    onDropTestPhone(meter);
  };

  const hoverRSSI = hoverMeter
    ? idealRSSIAt({ x: beaconXY.x, y: beaconXY.y, z: beaconHeightM }, { x: hoverMeter.x, y: hoverMeter.y, z: phoneHeightM }, rssiAt1m, pathLossExponent)
    : null;

  return (
    <div className="relative inline-block select-none">
      <canvas
        ref={canvasRef}
        style={{ width: canvasWidth, height: canvasHeight, cursor: isDraggingBeacon ? 'grabbing' : 'crosshair' }}
        className="rounded-xl border border-white/10 shadow-inner"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setHoverMeter(null); setHoverPixel(null); setIsDraggingBeacon(false); }}
        onClick={handleClick}
      />
      {hoverMeter && hoverPixel && hoverRSSI !== null && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg bg-slate-950/90 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
          style={{ left: hoverPixel.x + 14, top: hoverPixel.y - 12 }}
        >
          <div className="font-mono">{hoverRSSI.toFixed(1)} dBm</div>
          <div className="text-[10px] text-slate-300">
            {hoverMeter.x.toFixed(1)}m, {hoverMeter.y.toFixed(1)}m
          </div>
        </div>
      )}
    </div>
  );
}
