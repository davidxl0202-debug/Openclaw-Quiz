import { useMemo } from 'react';

const RADIUS = 54;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function Timer({ timeLeft, total }) {
  const progress = Math.max(0, Math.min(1, timeLeft / total));
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  const color = useMemo(() => {
    if (timeLeft > 20) return '#00d4ff';
    if (timeLeft > 10) return '#ffaa00';
    return '#ff4444';
  }, [timeLeft]);

  const displayTime = Math.ceil(Math.max(0, timeLeft));
  const isDanger = timeLeft <= 5 && timeLeft > 0;
  const isWarning = timeLeft <= 10 && timeLeft > 5;

  return (
    <div
      className={`timer-container ${isDanger ? 'timer-danger' : ''} ${isWarning ? 'timer-warning' : ''}`}
    >
      <div
        className="timer-glow-ring"
        style={{
          boxShadow: `0 0 ${isDanger ? 50 : 25}px ${color}50, 0 0 ${isDanger ? 100 : 50}px ${color}25`,
        }}
      />
      <svg width="140" height="140" viewBox="0 0 120 120">
        <circle
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
        />
        <circle
          cx="60" cy="60" r={RADIUS}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 60 60)"
          style={{
            transition: 'stroke-dashoffset 0.3s linear, stroke 0.5s ease',
            filter: `drop-shadow(0 0 ${isDanger ? 14 : 8}px ${color}90)`,
          }}
        />
      </svg>
      <div
        className={`timer-text ${isDanger ? 'timer-text-danger' : ''}`}
        style={{ color }}
      >
        {displayTime}
      </div>
    </div>
  );
}
