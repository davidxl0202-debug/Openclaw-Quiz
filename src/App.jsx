import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import AdminPage from './pages/AdminPage';
import PlayerPage from './pages/PlayerPage';
import ParticlesBackground from './components/ParticlesBackground';
import { initFirebase, isFirebaseReady } from './firebase';

function FirebaseSetup({ onConfigured }) {
  const [databaseURL, setDatabaseURL] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [projectId, setProjectId] = useState('');
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSubmit = () => {
    if (!databaseURL) {
      setError('请填写 Database URL');
      return;
    }

    const config = {
      apiKey: apiKey || 'placeholder',
      databaseURL,
      projectId: projectId || 'placeholder',
    };

    try {
      initFirebase(config);
      // Save to localStorage for future use
      try {
        localStorage.setItem('openclaw_quiz_firebase', JSON.stringify(config));
      } catch (_) {}
      onConfigured();
    } catch (err) {
      setError('连接失败: ' + err.message);
    }
  };

  return (
    <div className="page">
      <div className="center-card">
        <div className="card glass-card" style={{ maxWidth: '500px' }}>
          <div className="setup-logo">🦞</div>
          <h1 className="card-title">配置 Firebase</h1>
          <p className="card-desc">
            首次使用需要配置 Firebase Realtime Database 连接
          </p>

          <div className="form-group">
            <label className="form-label">
              Database URL <span className="required">*</span>
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="https://your-project.firebaseio.com"
              value={databaseURL}
              onChange={(e) => {
                setDatabaseURL(e.target.value);
                setError('');
              }}
            />
          </div>

          <button
            className="btn-link"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '收起' : '展开'}高级选项
          </button>

          {showAdvanced && (
            <>
              <div className="form-group">
                <label className="form-label">API Key</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="AIzaSy..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Project ID</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="your-project-id"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                />
              </div>
            </>
          )}

          {error && <p className="form-error">{error}</p>}

          <button className="btn-primary btn-large" onClick={handleSubmit}>
            连接
          </button>

          <div className="setup-help">
            <p>
              如何获取？前往{' '}
              <a
                href="https://console.firebase.google.com"
                target="_blank"
                rel="noreferrer"
              >
                Firebase Console
              </a>{' '}
              创建项目 → 启用 Realtime Database → 复制 URL
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [fbReady, setFbReady] = useState(false);

  useEffect(() => {
    // Try env vars first
    if (import.meta.env.VITE_FIREBASE_DATABASE_URL) {
      try {
        initFirebase();
        setFbReady(true);
        return;
      } catch (_) {}
    }

    // Try saved config
    try {
      const saved = localStorage.getItem('openclaw_quiz_firebase');
      if (saved) {
        const config = JSON.parse(saved);
        initFirebase(config);
        setFbReady(true);
        return;
      }
    } catch (_) {}
  }, []);

  if (!fbReady) {
    return <FirebaseSetup onConfigured={() => setFbReady(true)} />;
  }

  return (
    <>
      <ParticlesBackground />
      <HashRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/play" element={<PlayerPage />} />
        </Routes>
      </HashRouter>
    </>
  );
}
