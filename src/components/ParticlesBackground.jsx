import { useMemo } from 'react';

const PARTICLE_COUNT = 30;
const COLORS = ['#00d4ff', '#7c3aed', '#ec4899', '#00ff88'];

export default function ParticlesBackground() {
  const particles = useMemo(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      size: Math.random() * 4 + 1,
      x: Math.random() * 100,
      duration: Math.random() * 30 + 20,
      delay: -(Math.random() * 40),
      opacity: Math.random() * 0.5 + 0.1,
      color: COLORS[i % COLORS.length],
    }));
  }, []);

  return (
    <div className="particles-container" aria-hidden="true">
      <div className="ambient-orb ambient-orb-1" />
      <div className="ambient-orb ambient-orb-2" />
      <div className="ambient-orb ambient-orb-3" />
      <div className="grid-overlay" />
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            '--p-size': p.size + 'px',
            '--p-x': p.x + '%',
            '--p-dur': p.duration + 's',
            '--p-delay': p.delay + 's',
            '--p-color': p.color,
            '--p-opacity': p.opacity,
          }}
        />
      ))}
    </div>
  );
}
