import { useState, useEffect, useRef, useCallback } from 'react';
import { getDb, ref, set, onValue, update, get } from '../firebase';
import { questions, QUESTION_TIME } from '../questions';
import Timer from '../components/Timer';
import Leaderboard from '../components/Leaderboard';
import Fireworks from '../components/Fireworks';
import { useNavigate, useSearchParams } from 'react-router-dom';

function generatePlayerId() {
  return 'p_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function saveSession(pid, room, name) {
  try {
    sessionStorage.setItem('oc_pid', pid);
    sessionStorage.setItem('oc_room', room);
    sessionStorage.setItem('oc_name', name);
  } catch (_) {}
}

function clearSession() {
  try {
    sessionStorage.removeItem('oc_pid');
    sessionStorage.removeItem('oc_room');
    sessionStorage.removeItem('oc_name');
  } catch (_) {}
}

function getSavedSession() {
  try {
    const pid = sessionStorage.getItem('oc_pid');
    const room = sessionStorage.getItem('oc_room');
    const name = sessionStorage.getItem('oc_name');
    if (pid && room && name) return { pid, room, name };
  } catch (_) {}
  return null;
}

export default function PlayerPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const savedSession = useRef(getSavedSession());
  const [phase, setPhase] = useState('join'); // join | waiting | countdown | question | answered | result | finished
  const [countdown, setCountdown] = useState(0);
  const [roomCode, setRoomCode] = useState(() =>
    searchParams.get('room')?.toUpperCase() || savedSession.current?.room || ''
  );
  const [playerName, setPlayerName] = useState(() => savedSession.current?.name || '');
  const [playerId] = useState(() => savedSession.current?.pid || generatePlayerId());
  const [error, setError] = useState('');
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState({});
  const [currentQ, setCurrentQ] = useState(-1);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [myScore, setMyScore] = useState(0);
  const [lastResult, setLastResult] = useState(null); // { correct, baseScore, bonus, total }
  const [serverOffset, setServerOffset] = useState(0);
  const [myTimeTaken, setMyTimeTaken] = useState(null);
  const timerRef = useRef(null);
  const unsubscribers = useRef([]);
  const answeredQuestions = useRef(new Set());

  // Track server time offset
  useEffect(() => {
    const db = getDb();
    if (!db) return;
    const unsub = onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
      setServerOffset(snap.val() || 0);
    });
    return unsub;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      unsubscribers.current.forEach((unsub) => {
        try { unsub(); } catch (_) {}
      });
    };
  }, []);

  // Set up room & player listeners
  const connectToRoom = useCallback((code) => {
    const db = getDb();

    const roomUnsub = onValue(ref(db, `rooms/${code}`), (snap) => {
      const data = snap.val();
      if (!data) return;
      setRoom(data);
    });
    unsubscribers.current.push(roomUnsub);

    const playersUnsub = onValue(ref(db, `players/${code}`), (snap) => {
      const data = snap.val() || {};
      setPlayers(data);
      if (data[playerId]) {
        setMyScore(data[playerId].score || 0);
      }
    });
    unsubscribers.current.push(playersUnsub);
  }, [playerId]);

  // Auto-rejoin on mount if session exists
  useEffect(() => {
    const session = savedSession.current;
    if (!session) return;

    const db = getDb();
    if (!db) return;

    get(ref(db, `players/${session.room}/${session.pid}`)).then((snap) => {
      if (!snap.exists()) {
        clearSession();
        return;
      }
      // Also check room still exists
      return get(ref(db, `rooms/${session.room}`));
    }).then((roomSnap) => {
      if (!roomSnap || !roomSnap.exists()) {
        clearSession();
        return;
      }
      const roomData = roomSnap.val();
      if (roomData.status === 'finished') {
        clearSession();
        return;
      }
      connectToRoom(session.room);
      setPhase('waiting'); // Room listener will update to correct phase
    }).catch(() => {
      clearSession();
    });
  }, [connectToRoom]);

  const joinRoom = async () => {
    const code = roomCode.trim().toUpperCase();
    const name = playerName.trim();

    if (!code) { setError('请输入房间码'); return; }
    if (!name) { setError('请输入昵称'); return; }

    const db = getDb();
    try {
      const snap = await get(ref(db, `rooms/${code}`));
      if (!snap.exists()) {
        setError('房间不存在，请检查房间码');
        return;
      }

      const roomData = snap.val();
      if (roomData.status === 'finished') {
        setError('该房间的答题已结束');
        return;
      }

      // Check for duplicate nickname
      const playersSnap = await get(ref(db, `players/${code}`));
      const existingPlayers = playersSnap.val() || {};
      const nameExists = Object.values(existingPlayers).some(
        (p) => p.name.toLowerCase() === name.toLowerCase()
      );
      if (nameExists) {
        setError('该昵称已被使用，请换一个');
        return;
      }

      // Write player data
      await set(ref(db, `players/${code}/${playerId}`), {
        name,
        score: 0,
        joinedAt: Date.now() + serverOffset,
      });

      // Save session for reconnect on refresh
      saveSession(playerId, code, name);

      // Set up listeners
      connectToRoom(code);

      setRoomCode(code);
      setPhase('waiting');
      setError('');
    } catch (err) {
      setError('连接失败，请检查网络');
      console.error(err);
    }
  };

  // React to room state changes
  useEffect(() => {
    if (!room) return;

    if (room.status === 'countdown') {
      const qIndex = room.currentQuestion;
      setCurrentQ(qIndex);
      setSelectedAnswer(null);
      setLastResult(null);
      setMyTimeTaken(null);
      // Calculate remaining countdown from server time
      if (room.countdownEnd) {
        const remaining = Math.ceil((room.countdownEnd - Date.now() - serverOffset) / 1000);
        setCountdown(Math.max(1, Math.min(remaining, 5)));
      } else {
        setCountdown(5);
      }
      setPhase('countdown');
    } else if (room.status === 'question') {
      const qIndex = room.currentQuestion;
      if (qIndex !== currentQ) {
        setCurrentQ(qIndex);
        setSelectedAnswer(null);
        setLastResult(null);
        setMyTimeTaken(null);
        if (answeredQuestions.current.has(qIndex)) {
          setPhase('answered');
        } else {
          setPhase('question');
        }
      }
    } else if (room.status === 'result') {
      setPhase('result');
    } else if (room.status === 'finished') {
      setPhase('finished');
      clearInterval(timerRef.current);
    } else if (room.status === 'waiting') {
      setPhase('waiting');
    }
  }, [room, currentQ]);

  // Sync room when page becomes visible again (covers background/tab-switch scenarios)
  useEffect(() => {
    if (phase === 'join' || !roomCode) return;

    const db = getDb();
    if (!db) return;

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        get(ref(db, `rooms/${roomCode}`)).then((snap) => {
          const data = snap.val();
          if (data) setRoom(data);
        }).catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [phase, roomCode]);

  // Countdown tick for pre-question phase
  useEffect(() => {
    if (phase !== 'countdown') return;
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, countdown]);

  // Timer for question phase
  useEffect(() => {
    if ((phase !== 'question' && phase !== 'answered') || !room?.questionStartTime) return;

    const tick = () => {
      const elapsed = (Date.now() + serverOffset - room.questionStartTime) / 1000;
      const remaining = Math.max(0, QUESTION_TIME - elapsed);
      setTimeLeft(remaining);
    };

    timerRef.current = setInterval(tick, 100);
    tick();

    return () => clearInterval(timerRef.current);
  }, [phase, room?.questionStartTime, serverOffset]);

  // 选择选项（仅本地高亮，不提交）
  const selectOption = (choice) => {
    if (phase === 'answered' || timeLeft <= 0) return;
    setSelectedAnswer(choice);
  };

  // 确认提交答案（写入 Firebase，锁定）
  const confirmAnswer = async () => {
    if (!selectedAnswer || phase === 'answered' || timeLeft <= 0) return;

    const timeTaken = Date.now() + serverOffset - room.questionStartTime;

    setMyTimeTaken(timeTaken);
    answeredQuestions.current.add(currentQ);
    setPhase('answered');

    const db = getDb();
    await set(ref(db, `answers/${roomCode}/${currentQ}/${playerId}`), {
      choice: selectedAnswer,
      timeTaken,
    });
  };

  // 撤回答案（再想想）
  const retractAnswer = async () => {
    if (phase !== 'answered' || timeLeft <= 0) return;

    answeredQuestions.current.delete(currentQ);
    setMyTimeTaken(null);
    setPhase('question');

    const db = getDb();
    await set(ref(db, `answers/${roomCode}/${currentQ}/${playerId}`), null);
  };

  // Check result when entering result phase — use local state for instant feedback
  useEffect(() => {
    if (phase !== 'result' || currentQ < 0) return;

    const q = questions[currentQ];

    if (answeredQuestions.current.has(currentQ) && selectedAnswer) {
      const correct = selectedAnswer === q.correctAnswer;
      setLastResult({
        correct,
        choice: selectedAnswer,
        timeTaken: myTimeTaken,
      });
    } else {
      setLastResult({ correct: false, choice: null, timeTaken: null });
    }
  }, [phase, currentQ, selectedAnswer, myTimeTaken]);

  // ========== RENDER ==========

  // Join Room
  if (phase === 'join') {
    return (
      <div className="page">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← 返回首页
        </button>
        <div className="center-card">
          <div className="card glass-card">
            <h1 className="card-title">加入答题房间</h1>
            <div className="form-group">
              <label className="form-label">房间码</label>
              <input
                className="form-input"
                type="text"
                placeholder="输入 6 位房间码"
                maxLength={6}
                value={roomCode}
                onChange={(e) => {
                  setRoomCode(e.target.value.toUpperCase());
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              />
            </div>
            <div className="form-group">
              <label className="form-label">昵称</label>
              <input
                className="form-input"
                type="text"
                placeholder="输入你的昵称"
                maxLength={12}
                value={playerName}
                onChange={(e) => {
                  setPlayerName(e.target.value);
                  setError('');
                }}
                onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
              />
            </div>
            {error && <p className="form-error">{error}</p>}
            <button className="btn-primary btn-large" onClick={joinRoom}>
              🎮 加入房间
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Waiting
  if (phase === 'waiting') {
    const playerCount = Object.keys(players).length;
    return (
      <div className="page">
        <div className="center-card">
          <div className="card glass-card">
            <div className="waiting-animation">
              <div className="pulse-ring" />
              <span className="waiting-icon">🦞</span>
            </div>
            <h2 className="card-title">等待管理员开始答题</h2>
            <p className="card-desc">
              房间码: <strong>{roomCode}</strong>
            </p>
            <p className="card-desc">
              你好, <strong>{playerName}</strong>! 当前{' '}
              <strong>{playerCount}</strong> 人在线
            </p>
            <div className="player-tags">
              {Object.entries(players).map(([id, p]) => (
                <span
                  key={id}
                  className={`player-tag ${id === playerId ? 'player-tag-me' : ''}`}
                >
                  {p.name}
                  {id === playerId ? ' (我)' : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Countdown before question
  if (phase === 'countdown') {
    const q = questions[currentQ];
    return (
      <div className="page countdown-page">
        <div className="countdown-container">
          <span className="countdown-q-hint">第 {currentQ + 1} / {questions.length} 题</span>
          <span className="countdown-tag">【{q.tag}】</span>
          <div className="countdown-circle" key={countdown}>
            <span className="countdown-number">{countdown}</span>
          </div>
          <span className="countdown-label">准备好了吗？</span>
        </div>
      </div>
    );
  }

  // Question / Answered
  if (phase === 'question' || phase === 'answered') {
    const q = questions[currentQ];
    const timeUp = timeLeft <= 0;

    return (
      <div className="page admin-playing">
        <div className="admin-layout">
          <div className="main-area">
            <div className="question-header player-header">
              <span className="q-progress">
                第 {currentQ + 1} / {questions.length} 题
              </span>
              <span className="q-tag">【{q.tag}】</span>
              <span className="q-score">我的分数: {myScore}</span>
            </div>

            <Timer timeLeft={timeLeft} total={QUESTION_TIME} />

            <div className="card glass-card question-card">
              <h2 className="q-text">{q.question}</h2>
              <div className="options-grid">
                {q.options.map((opt) => {
                  const isSelected = selectedAnswer === opt.key;
                  const locked = phase === 'answered';
                  const disabled = timeUp || locked;

                  return (
                    <button
                      key={opt.key}
                      className={`option-item option-btn ${
                        isSelected ? 'option-selected' : ''
                      } ${disabled && !isSelected ? 'option-disabled' : ''} ${locked && isSelected ? 'option-locked' : ''}`}
                      onClick={() => selectOption(opt.key)}
                      disabled={disabled}
                    >
                      <span className="option-key">{opt.key}</span>
                      <span className="option-text">{opt.text}</span>
                      {isSelected && <span className="selected-check">{locked ? '🔒' : '✓'}</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedAnswer && phase !== 'answered' && !timeUp && (
              <button className="btn-primary btn-large btn-confirm pulse" onClick={confirmAnswer}>
                确认提交
              </button>
            )}

            {phase === 'answered' && !timeUp && (
              <div className="answered-hint">
                <span>✅ 答案已提交</span>
                <button className="btn-retract" onClick={retractAnswer}>
                  再想想
                </button>
              </div>
            )}

            {phase === 'answered' && timeUp && (
              <div className="waiting-result-hint">
                <div className="waiting-result-dots">
                  <span></span><span></span><span></span>
                </div>
                <span>等待公布结果...</span>
              </div>
            )}

            {timeUp && phase !== 'answered' && !selectedAnswer && (
              <div className="waiting-result-hint">
                <div className="waiting-result-dots">
                  <span></span><span></span><span></span>
                </div>
                <span>未作答，等待公布结果...</span>
              </div>
            )}

            {timeUp && phase !== 'answered' && selectedAnswer && (
              <div className="waiting-result-hint">
                <div className="waiting-result-dots">
                  <span></span><span></span><span></span>
                </div>
                <span>未确认提交，等待公布结果...</span>
              </div>
            )}
          </div>

          <div className="sidebar">
            <Leaderboard players={players} currentPlayerId={playerId} compact />
          </div>
        </div>
      </div>
    );
  }

  // Result
  if (phase === 'result') {
    const q = questions[currentQ];
    const correctOpt = q.options.find((o) => o.key === q.correctAnswer);

    return (
      <div className="page admin-playing">
        <Fireworks show={lastResult?.correct} />
        <div className="admin-layout">
          <div className="main-area">
            <div className="center-card" style={{ maxWidth: '600px' }}>
              <div className="card glass-card result-card">
                {lastResult?.correct ? (
                  <div className="result-banner correct-banner">
                    <span className="result-emoji">🎉</span>
                    <span>回答正确!</span>
                  </div>
                ) : (
                  <div className="result-banner wrong-banner">
                    <span className="result-emoji">😢</span>
                    <span>{lastResult?.choice ? '回答错误' : '未作答'}</span>
                  </div>
                )}

                <div className="correct-answer-display">
                  <span className="correct-label">正确答案</span>
                  <span className="correct-value">
                    {q.correctAnswer}. {correctOpt?.text}
                  </span>
                </div>

                {lastResult?.correct && lastResult?.timeTaken && (
                  <p className="result-time">
                    用时 {(lastResult.timeTaken / 1000).toFixed(1)} 秒
                  </p>
                )}

                <div className="fun-fact">
                  <span className="fun-fact-icon">💡</span>
                  <p>{q.funFact}</p>
                </div>

                <div className="my-score-display">
                  当前总分: <span className="score-value">{myScore}</span>
                </div>

                <p className="waiting-hint">等待管理员进入下一题...</p>
              </div>
            </div>
          </div>

          <div className="sidebar">
            <Leaderboard players={players} currentPlayerId={playerId} compact />
          </div>
        </div>
      </div>
    );
  }

  // Finished
  if (phase === 'finished') {
    return (
      <div className="page">
        <Fireworks show={true} />
        <div className="finished-content player-finished">
          <h1 className="gradient-text finished-title">答题结束!</h1>
          <div className="my-final-score-compact">
            <span>我的得分</span>
            <span className="score-value-compact">{myScore}</span>
          </div>
          <Leaderboard players={players} currentPlayerId={playerId} />
          <button
            className="btn-secondary btn-large"
            onClick={() => { clearSession(); navigate('/'); }}
            style={{ marginTop: '1rem' }}
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return null;
}
