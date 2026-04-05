"use client";

import { animate, motion, useMotionValue, useMotionValueEvent } from "framer-motion";
import { useEffect, useState } from "react";

type Props = {
  value: number;
  theatreCap?: number;
  isRunning: boolean;
};

const ARC = 251.2;

function strokeForImpact(absPct: number): string {
  const t = Math.min(absPct / 40, 1);
  if (t < 0.45) return "#22c55e";
  if (t < 0.75) return "#f59e0b";
  return "#ef4444";
}

export function ImpactGauge({ value, theatreCap = 34, isRunning }: Props) {
  const mv = useMotionValue(0);
  const [label, setLabel] = useState(0);

  useMotionValueEvent(mv, "change", (v) => setLabel(Math.round(v * 10) / 10));

  useEffect(() => {
    if (isRunning) {
      const controls = animate(mv, -theatreCap * 0.95, {
        duration: 3.2,
        ease: "easeInOut",
      });
      return () => controls.stop();
    }
    const controls = animate(mv, value, { type: "spring", stiffness: 70, damping: 18 });
    return () => controls.stop();
  }, [isRunning, value, theatreCap, mv]);

  const dashOffset = useMotionValue(ARC);

  useMotionValueEvent(mv, "change", (v) => {
    const fill = (Math.min(Math.abs(v), 45) / 45) * ARC;
    dashOffset.set(ARC - fill);
  });

  const [stroke, setStroke] = useState("#22c55e");
  useMotionValueEvent(mv, "change", (v) => setStroke(strokeForImpact(Math.abs(v))));

  return (
    <div className="flex flex-col items-center">
      <svg width="220" height="130" viewBox="0 0 220 130" className="overflow-visible">
        <path
          d="M 30 100 A 80 80 0 0 1 190 100"
          fill="none"
          stroke="#e4e4e7"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <motion.path
          d="M 30 100 A 80 80 0 0 1 190 100"
          fill="none"
          stroke={stroke}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={ARC}
          style={{ strokeDashoffset: dashOffset }}
        />
      </svg>
      <p className="-mt-2 font-mono text-xl font-bold tabular-nums text-zinc-900">
        {label}
        <span className="text-base font-medium text-zinc-500"> pts</span>
      </p>
      <p className="mt-1 text-xs text-zinc-500">Gauge shifts green → amber → red under stress</p>
    </div>
  );
}
