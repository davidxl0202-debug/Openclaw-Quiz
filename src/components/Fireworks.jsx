import { useMemo, useEffect, useState } from 'react';

const COLORS = ['#00d4ff', '#7c3aed', '#ec4899', '#00ff88', '#ffd700', '#ff6b6b', '#fff'];

export default function Fireworks({ show }) {
  const [visible, setVisible] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (show) {
      setKey((k) => k + 1);
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
  }, [show]);

  if (!visible) return null;

  return <FireworksBurst key={key} />;
}

function FireworksBurst() {
  const bursts = useMemo(() => {
    // 3 explosion centers at different positions
    const centers = [
      { cx: 50, cy: 40 },
      { cx: 30, cy: 50 },
      { cx: 70, cy: 45 },
    ];

    return centers.map((center, bi) => {
      const particles = Array.from({ length: 50 }, (_, i) => {
        const angle = (Math.random() * 360) * (Math.PI / 180);
        const velocity = Math.random() * 250 + 80;
        const size = Math.random() * 7 + 2;
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const duration = Math.random() * 1.2 + 0.8;
        const delay = bi * 0.4 + Math.random() * 0.2;
        const isSparkle = Math.random() > 0.6;

        return {
          id: `${bi}-${i}`,
          x: Math.cos(angle) * velocity,
          y: Math.sin(angle) * velocity - (Math.random() * 60),
          size: isSparkle ? size * 0.6 : size,
          color,
          duration,
          delay,
          isSparkle,
        };
      });

      return { ...center, particles, id: bi };
    });
  }, []);

  return (
    <div className="fireworks-overlay" aria-hidden="true">
      {bursts.map((burst) => (
        <div
          key={burst.id}
          className="fireworks-center"
          style={{ left: burst.cx + '%', top: burst.cy + '%' }}
        >
          {burst.particles.map((p) => (
            <div
              key={p.id}
              className={`fw-particle ${p.isSparkle ? 'fw-sparkle' : ''}`}
              style={{
                '--fw-x': p.x + 'px',
                '--fw-y': p.y + 'px',
                '--fw-size': p.size + 'px',
                '--fw-color': p.color,
                '--fw-dur': p.duration + 's',
                '--fw-delay': p.delay + 's',
              }}
            />
          ))}
          {/* Ring burst effect */}
          <div
            className="fw-ring"
            style={{
              '--fw-delay': burst.id * 0.4 + 's',
              '--fw-color': COLORS[burst.id % COLORS.length],
            }}
          />
        </div>
      ))}
      {/* Falling sparkles */}
      {Array.from({ length: 30 }, (_, i) => (
        <div
          key={`trail-${i}`}
          className="fw-trail"
          style={{
            '--trail-x': Math.random() * 100 + '%',
            '--trail-delay': Math.random() * 1.5 + 0.5 + 's',
            '--trail-dur': Math.random() * 1.5 + 1 + 's',
            '--fw-color': COLORS[Math.floor(Math.random() * COLORS.length)],
            '--trail-size': (Math.random() * 4 + 2) + 'px',
          }}
        />
      ))}
    </div>
  );
}
