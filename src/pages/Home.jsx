import { useNavigate } from 'react-router-dom';

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page home-page">
      <div className="home-bg-effect" />
      <div className="home-content">
        <div className="home-logo">🦞</div>
        <h1 className="home-title">
          <span className="gradient-text">OpenClaw</span> Quiz
        </h1>
        <p className="home-subtitle">在线多人实时答题系统</p>
        <p className="home-desc">
          15 道 OpenClaw 知识挑战 · 30 秒限时作答 · 实时排行榜
        </p>
        <div className="home-buttons">
          <button
            className="btn-primary btn-large"
            onClick={() => navigate('/admin')}
          >
            <span className="btn-icon">⚡</span>
            管理员
            <span className="btn-hint">创建答题房间</span>
          </button>
          <button
            className="btn-secondary btn-large"
            onClick={() => navigate('/play')}
          >
            <span className="btn-icon">🎮</span>
            参与者
            <span className="btn-hint">加入答题房间</span>
          </button>
        </div>
      </div>
      <div className="home-footer">
        Powered by Firebase · Built with React
      </div>
    </div>
  );
}
