import { useEffect, useState } from "react";

type Props = { score: number; size?: number };

export function ScoreGauge({ score, size = 148 }: Props) {
  const [value, setValue] = useState(0);
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    const frame = requestAnimationFrame(() => setValue(score));
    return () => cancelAnimationFrame(frame);
  }, [score]);

  const tone =
    score >= 80 ? "var(--color-success)" : score >= 55 ? "var(--color-accent)" : "var(--color-warning)";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * value) / 100}
          style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-semibold tabular-nums">{score}</span>
        <span className="text-xs tracking-wide text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}
