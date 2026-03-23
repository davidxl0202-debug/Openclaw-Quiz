export default function Leaderboard({ players, currentPlayerId, compact }) {
  const sorted = Object.entries(players)
    .map(([id, p]) => ({ id, name: p.name, score: p.score || 0, totalTime: p.totalTime || 0 }))
    .sort((a, b) => b.score - a.score || a.totalTime - b.totalTime);

  const maxScore = sorted.length > 0 ? Math.max(sorted[0].score, 1) : 1;

  if (compact) {
    return (
      <div className="leaderboard compact">
        <h3 className="lb-title">排行榜</h3>
        <div className="lb-list">
          {sorted.slice(0, 10).map((p, i) => (
            <div
              key={p.id}
              className={`lb-row ${p.id === currentPlayerId ? 'lb-me' : ''}`}
            >
              <span className="lb-rank">{getRankIcon(i)}</span>
              <span className="lb-name">{p.name}</span>
              <span className="lb-time">{formatTime(p.totalTime)}</span>
              <span className="lb-score">{p.score}</span>
            </div>
          ))}
          {sorted.length === 0 && (
            <div className="lb-empty">暂无参与者</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard full">
      <h2 className="lb-title-big">最终排行榜</h2>
      {sorted.length >= 3 && (
        <div className="podium">
          <div className="podium-item second">
            <div className="podium-avatar">🥈</div>
            <div className="podium-name">{sorted[1].name}</div>
            <div className="podium-score">{sorted[1].score} 分</div>
            <div className="podium-time">{formatTime(sorted[1].totalTime)}</div>
            <div className="podium-bar" style={{ height: '100px' }}>2</div>
          </div>
          <div className="podium-item first">
            <div className="podium-avatar">🥇</div>
            <div className="podium-name">{sorted[0].name}</div>
            <div className="podium-score">{sorted[0].score} 分</div>
            <div className="podium-time">{formatTime(sorted[0].totalTime)}</div>
            <div className="podium-bar" style={{ height: '140px' }}>1</div>
          </div>
          <div className="podium-item third">
            <div className="podium-avatar">🥉</div>
            <div className="podium-name">{sorted[2].name}</div>
            <div className="podium-score">{sorted[2].score} 分</div>
            <div className="podium-time">{formatTime(sorted[2].totalTime)}</div>
            <div className="podium-bar" style={{ height: '70px' }}>3</div>
          </div>
        </div>
      )}
      <div className="lb-full-list">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className={`lb-full-row ${p.id === currentPlayerId ? 'lb-me' : ''}`}
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            <span className="lb-rank-num">{i + 1}</span>
            <span className="lb-rank-icon">{getRankIcon(i)}</span>
            <span className="lb-name">{p.name}</span>
            <div className="lb-bar-wrap">
              <div
                className="lb-bar"
                style={{ width: `${(p.score / maxScore) * 100}%` }}
              />
            </div>
            <span className="lb-time-full">{formatTime(p.totalTime)}</span>
            <span className="lb-score-big">{p.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(ms) {
  if (!ms) return '0.0s';
  const totalSec = ms / 1000;
  if (totalSec < 60) return totalSec.toFixed(1) + 's';
  const min = Math.floor(totalSec / 60);
  const sec = (totalSec % 60).toFixed(1);
  return `${min}:${sec.padStart(4, '0')}`;
}

function getRankIcon(index) {
  if (index === 0) return '🥇';
  if (index === 1) return '🥈';
  if (index === 2) return '🥉';
  return `#${index + 1}`;
}
