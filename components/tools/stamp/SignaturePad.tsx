"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

type Pt = { x: number; y: number; w: number };
type Stroke = { color: string; pts: Pt[] };

export type SignaturePadHandle = {
  /** Render the strokes at `scale`× onto a transparent canvas (untrimmed). */
  toCanvas: (scale?: number) => HTMLCanvasElement | null;
  clear: () => void;
  isEmpty: () => boolean;
};

/**
 * Draw-your-signature pad. Pointer events (mouse, pen, finger), coalesced
 * samples, and quadratic smoothing through stroke midpoints. Pen pressure
 * and speed vary the line width slightly, like ink.
 */
const SignaturePad = forwardRef<SignaturePadHandle, { color: string; thickness: number; onChange?: (empty: boolean) => void }>(
  function SignaturePad({ color, thickness, onChange }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const strokes = useRef<Stroke[]>([]);
    const current = useRef<{ stroke: Stroke; last: { x: number; y: number; t: number }; pid: number } | null>(null);
    const [size, setSize] = useState({ w: 0, h: 0 });
    const [count, setCount] = useState(0);

    const drawStroke = useCallback((ctx: CanvasRenderingContext2D, s: Stroke, k: number) => {
      const p = s.pts;
      ctx.strokeStyle = s.color;
      ctx.fillStyle = s.color;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      if (p.length === 1) {
        ctx.beginPath();
        ctx.arc(p[0].x * k, p[0].y * k, (p[0].w * k) / 2, 0, Math.PI * 2);
        ctx.fill();
        return;
      }
      // Segment by segment so the width can change along the stroke.
      for (let i = 1; i < p.length; i++) {
        const a = i === 1 ? p[0] : { x: (p[i - 2].x + p[i - 1].x) / 2, y: (p[i - 2].y + p[i - 1].y) / 2 };
        const b = { x: (p[i - 1].x + p[i].x) / 2, y: (p[i - 1].y + p[i].y) / 2 };
        const end = i === p.length - 1 ? p[i] : b;
        ctx.beginPath();
        ctx.lineWidth = ((p[i - 1].w + p[i].w) / 2) * k;
        ctx.moveTo(a.x * k, a.y * k);
        ctx.quadraticCurveTo(p[i - 1].x * k, p[i - 1].y * k, end.x * k, end.y * k);
        ctx.stroke();
      }
    }, []);

    const redraw = useCallback(() => {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) return;
      const dpr = c.width / Math.max(1, c.clientWidth);
      ctx.clearRect(0, 0, c.width, c.height);
      for (const s of strokes.current) drawStroke(ctx, s, dpr);
      if (current.current) drawStroke(ctx, current.current.stroke, dpr);
    }, [drawStroke]);

    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const ro = new ResizeObserver(() => setSize({ w: c.clientWidth, h: c.clientHeight }));
      ro.observe(c);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      const c = canvasRef.current;
      if (!c || !size.w) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      c.width = Math.round(size.w * dpr);
      c.height = Math.round(size.h * dpr);
      redraw();
    }, [size, redraw]);

    const pos = (e: { clientX: number; clientY: number }) => {
      const r = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const widthFor = (e: PointerEvent | React.PointerEvent, speed: number) => {
      const pressure = e.pointerType === "pen" && e.pressure > 0 ? 0.6 + e.pressure * 0.8 : 1;
      const speedFactor = Math.max(0.65, Math.min(1.15, 1.15 - speed * 0.12));
      return thickness * pressure * speedFactor;
    };

    const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      const p = pos(e);
      current.current = { stroke: { color, pts: [{ ...p, w: widthFor(e, 0) }] }, last: { ...p, t: e.timeStamp }, pid: e.pointerId };
      redraw();
    };

    const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const cur = current.current;
      if (!cur || cur.pid !== e.pointerId) return;
      const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
      for (const ev of events.length ? events : [e.nativeEvent]) {
        const p = pos(ev);
        const dist = Math.hypot(p.x - cur.last.x, p.y - cur.last.y);
        if (dist < 0.8) continue;
        const dt = Math.max(1, ev.timeStamp - cur.last.t);
        const speed = dist / dt; // px per ms
        const prevW = cur.stroke.pts[cur.stroke.pts.length - 1].w;
        const w = prevW * 0.7 + widthFor(ev, speed) * 0.3;
        cur.stroke.pts.push({ ...p, w });
        cur.last = { ...p, t: ev.timeStamp };
      }
      redraw();
    };

    const onUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const cur = current.current;
      if (!cur || cur.pid !== e.pointerId) return;
      strokes.current.push(cur.stroke);
      current.current = null;
      setCount(strokes.current.length);
      onChange?.(false);
      redraw();
    };

    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          strokes.current = [];
          current.current = null;
          setCount(0);
          onChange?.(true);
          redraw();
        },
        isEmpty: () => strokes.current.length === 0,
        toCanvas: (scale = 3) => {
          const c = canvasRef.current;
          if (!c || !strokes.current.length) return null;
          const out = document.createElement("canvas");
          out.width = Math.round(c.clientWidth * scale);
          out.height = Math.round(c.clientHeight * scale);
          const ctx = out.getContext("2d");
          if (!ctx) return null;
          for (const s of strokes.current) drawStroke(ctx, s, scale);
          return out;
        },
      }),
      [drawStroke, onChange, redraw]
    );

    return (
      <div className="relative">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          aria-label="Signature drawing area. Draw with your finger, a pen or the mouse."
          role="img"
          className="block w-full h-44 sm:h-48 rounded-lg border border-dashed border-black/25 dark:border-white/25 bg-white cursor-crosshair"
          style={{ touchAction: "none" }}
        />
        <div className="pointer-events-none absolute left-6 right-6 bottom-10 border-b border-zinc-300" aria-hidden="true" />
        {count === 0 && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-zinc-400">Sign here</span>
        )}
      </div>
    );
  }
);

export default SignaturePad;
