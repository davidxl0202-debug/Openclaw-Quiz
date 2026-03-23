import { useState, useEffect, useRef, useCallback } from 'react';
import { getDb, ref, set, onValue, update } from '../firebase';
import { questions, QUESTION_TIME, CORRECT_SCORE, BONUS_RANKS } from '../questions';
import Timer from '../components/Timer';
import Leaderboard from '../components/Leaderboard';
import Fireworks from '../components/Fireworks';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState('create'); // create | lobby | question | result | finished
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState({});
  const [currentQ, setCurrentQ] = useState(-1);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(QUESTION_TIME);
  const [questionResults, setQuestionResults] = useState(null);
  const [serverOffset, setServerOffset] = useState(0);
  const timerRef = useRef(null);
  const unsubscribers = useRef([]);
  const answerUnsubRef = useRef(null);

  // Track server time offset
  useEffect(() => {
    const db = getDb();
    if (!db) return;
    const unsub = onValue(ref(db, '.info/serverTimeOffset'), (snap) => {
      setServerOffset(snap.val() || 0);
    });
    return unsub;
  }, []);

  // Timer tick
  useEffect(() => {
    if (phase !== 'question' || !questionStartTime) return;

    const tick = () => {
      const elapsed = (Date.now() + serverOffset - questionStartTime) / 1000;
      const remaining = Math.max(0, QUESTION_TIME - elapsed);
      setTimeLeft(remaining);
    };

    timerRef.current = setInterval(tick, 100);
    tick();

    return () => clearInterval(timerRef.current);
  }, [phase, questionStartTime, serverOffset]);

  // Cleanup all listeners on unmount
  useEffect(() => {
    return () => {
      unsubscribers.current.forEach((unsub) => {
        try { unsub(); } catch (_) {}
      });
      if (answerUnsubRef.current) {
        try { answerUnsubRef.current(); } catch (_) {}
      }
    };
  }, []);

  const createRoom = async () => {
    const db = getDb();
    const code = generateRoomCode();

    await set(ref(db, `rooms/${code}`), {
      status: 'waiting',
      currentQuestion: -1,
      questionStartTime: 0,
    });

    setRoomCode(code);
    setPhase('lobby');

    // Listen to players
    const unsub = onValue(ref(db, `players/${code}`), (snap) => {
      setPlayers(snap.val() || {});
    });
    unsubscribers.current.push(unsub);
  };

  const startQuestion = useCallback(
    async (index) => {
      const db = getDb();
      const now = Date.now() + serverOffset;

      await update(ref(db, `rooms/${roomCode}`), {
        status: 'question',
        currentQuestion: index,
        questionStartTime: now,
      });

      setCurrentQ(index);
      setQuestionStartTime(now);
      setPhase('question');
      setAnswers({});
      setQuestionResults(null);
      setTimeLeft(QUESTION_TIME);

      // Clean up previous answer listener before creating new one
      if (answerUnsubRef.current) {
        answerUnsubRef.current();
        answerUnsubRef.current = null;
      }

      // Listen to answers for this question
      const unsub = onValue(ref(db, `answers/${roomCode}/${index}`), (snap) => {
        setAnswers(snap.val() || {});
      });
      answerUnsubRef.current = unsub;
    },
    [roomCode, serverOffset],
  );

  const showResults = useCallback(async () => {
    clearInterval(timerRef.current);
    const db = getDb();
    const q = questions[currentQ];

    // Read current answers
    const currentAnswers = { ...answers };

    // Calculate scores
    const results = [];
    Object.entries(currentAnswers).forEach(([pid, ans]) => {
      const correct = ans.choice === q.correctAnswer;
      results.push({
        playerId: pid,
        name: players[pid]?.name || '未知',
        choice: ans.choice,
        correct,
        timeTaken: ans.timeTaken || 30000,
        baseScore: correct ? CORRECT_SCORE : 0,
        bonus: 0,
        total: 0,
      });
    });

    // Sort correct answers by time for bonus
    const correctResults = results
      .filter((r) => r.correct)
      .sort((a, b) => a.timeTaken - b.timeTaken);

    correctResults.forEach((r, i) => {
      if (i < BONUS_RANKS) {
        r.bonus = BONUS_RANKS - i; // 1st: +10, 2nd: +9, ..., 10th: +1
      }
      r.total = r.baseScore + r.bonus;
    });

    // Update wrong answer totals
    results.forEach((r) => {
      if (!r.correct) r.total = 0;
    });

    // 1) Update admin UI instantly
    setQuestionResults(results);
    setPhase('result');

    // 2) Write ONLY status — smallest possible write for fastest delivery
    await set(ref(db, `rooms/${roomCode}/status`), 'result');

    // 3) Write other room fields + scores in background (non-blocking)
    const backgroundUpdates = {};
    backgroundUpdates[`rooms/${roomCode}/lastCorrectAnswer`] = q.correctAnswer;
    results.forEach((r) => {
      const currentScore = players[r.playerId]?.score || 0;
      const currentTotalTime = players[r.playerId]?.totalTime || 0;
      backgroundUpdates[`players/${roomCode}/${r.playerId}/score`] =
        currentScore + r.total;
      backgroundUpdates[`players/${roomCode}/${r.playerId}/totalTime`] =
        currentTotalTime + r.timeTaken;
    });

    // Also update totalTime for players who didn't answer (add full question time)
    Object.keys(players).forEach((pid) => {
      if (!currentAnswers[pid]) {
        const currentTotalTime = players[pid]?.totalTime || 0;
        backgroundUpdates[`players/${roomCode}/${pid}/totalTime`] =
          currentTotalTime + QUESTION_TIME * 1000;
      }
    });

    update(ref(db), backgroundUpdates);
  }, [answers, currentQ, players, roomCode]);

  const nextOrFinish = useCallback(async () => {
    const next = currentQ + 1;
    if (next >= questions.length) {
      const db = getDb();
      await update(ref(db, `rooms/${roomCode}`), { status: 'finished' });
      setPhase('finished');
    } else {
      await startQuestion(next);
    }
  }, [currentQ, roomCode, startQuestion]);

  const playerCount = Object.keys(players).length;
  const answerCount = Object.keys(answers).length;
  const sortedPlayers = Object.entries(players)
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  // ========== RENDER ==========

  // Create Room
  if (phase === 'create') {
    return (
      <div className="page">
        <button className="btn-back" onClick={() => navigate('/')}>
          ← 返回首页
        </button>
        <div className="center-card">
          <div className="card glass-card">
            <h1 className="card-title">创建答题房间</h1>
            <p className="card-desc">
              创建房间后，将房间码分享给参与者即可开始
            </p>
            <button className="btn-primary btn-large" onClick={createRoom}>
              ⚡ 创建房间
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Lobby
  if (phase === 'lobby') {
    const joinUrl = `${window.location.origin}${window.location.pathname}#/play?room=${roomCode}`;

    return (
      <div className="page">
        <div className="admin-layout">
          <div className="main-area">
            <div className="card glass-card">
              <h2 className="card-title">等待参与者加入</h2>
              <div className="room-code-display">
                <span className="room-code-label">房间码</span>
                <span className="room-code-value">{roomCode}</span>
              </div>

              <div className="qr-section">
                <p className="qr-hint">扫码加入</p>
                <div className="qr-wrapper">
                  <QRCodeSVG
                    value={joinUrl}
                    size={180}
                    bgColor="transparent"
                    fgColor="#ffffff"
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>

              <div className="player-count">
                <span className="count-number">{playerCount}</span>
                <span className="count-label">位参与者在线</span>
              </div>
              <div className="player-tags">
                {sortedPlayers.map((p) => (
                  <span key={p.id} className="player-tag">
                    {p.name}
                  </span>
                ))}
              </div>
              {playerCount > 0 ? (
                <button
                  className="btn-primary btn-large pulse"
                  onClick={() => startQuestion(0)}
                >
                  开始答题
                </button>
              ) : (
                <p className="waiting-hint">等待参与者加入...</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Active Question
  if (phase === 'question') {
    const q = questions[currentQ];
    const allAnswered = answerCount >= playerCount && playerCount > 0;
    const timeUp = timeLeft <= 0;

    return (
      <div className="page admin-playing">
        <div className="admin-layout">
          <div className="main-area">
            <div className="question-header">
              <span className="q-progress">
                第 {currentQ + 1} / {questions.length} 题
              </span>
              <span className="q-tag">【{q.tag}】</span>
            </div>

            <Timer timeLeft={timeLeft} total={QUESTION_TIME} />

            <div className="card glass-card question-card">
              <h2 className="q-text">{q.question}</h2>
              <div className="options-grid">
                {q.options.map((opt) => (
                  <div
                    key={opt.key}
                    className="option-item admin-option"
                  >
                    <span className="option-key">{opt.key}</span>
                    <span className="option-text">{opt.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {(timeUp || allAnswered) && (
              <button className="btn-primary btn-large" onClick={showResults}>
                显示结果
              </button>
            )}
          </div>

          <div className="sidebar">
            <div className="answer-status-panel">
              <h3 className="as-title">答题状态</h3>
              <div className="as-summary">
                <span className="as-submitted">{answerCount}</span>
                <span className="as-separator">/</span>
                <span className="as-total">{playerCount}</span>
                <span className="as-label">已提交</span>
              </div>
              <div className="as-progress-bar">
                <div
                  className="as-progress-fill"
                  style={{ width: playerCount > 0 ? `${(answerCount / playerCount) * 100}%` : '0%' }}
                />
              </div>
              <div className="as-list">
                {sortedPlayers.map((p) => {
                  const ans = answers[p.id];
                  const hasAnswered = !!ans;
                  return (
                    <div key={p.id} className={`as-row ${hasAnswered ? 'as-done' : 'as-pending'}`}>
                      <span className="as-indicator">{hasAnswered ? '✓' : '···'}</span>
                      <span className="as-name">{p.name}</span>
                      {hasAnswered && ans.timeTaken && (
                        <span className="as-time">{(ans.timeTaken / 1000).toFixed(1)}s</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Question Results
  if (phase === 'result') {
    const q = questions[currentQ];
    const correctCount = questionResults
      ? questionResults.filter((r) => r.correct).length
      : 0;
    const bonusWinners = questionResults
      ? questionResults
          .filter((r) => r.bonus > 0)
          .sort((a, b) => b.bonus - a.bonus)
      : [];

    return (
      <div className="page admin-playing">
        <div className="admin-layout">
          <div className="main-area">
            <div className="question-header">
              <span className="q-progress">
                第 {currentQ + 1} / {questions.length} 题 · 结果
              </span>
            </div>

            <div className="card glass-card result-card">
              <h3 className="result-question">{q.question}</h3>
              <div className="correct-answer-display">
                <span className="correct-label">正确答案</span>
                <span className="correct-value">
                  {q.correctAnswer}.{' '}
                  {q.options.find((o) => o.key === q.correctAnswer)?.text}
                </span>
              </div>

              <div className="result-stats">
                <div className="stat-item">
                  <span className="stat-number">{correctCount}</span>
                  <span className="stat-label">人答对</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">
                    {(questionResults?.length || 0) - correctCount}
                  </span>
                  <span className="stat-label">人答错</span>
                </div>
                <div className="stat-item">
                  <span className="stat-number">
                    {playerCount - (questionResults?.length || 0)}
                  </span>
                  <span className="stat-label">未作答</span>
                </div>
              </div>

              {bonusWinners.length > 0 && (
                <div className="bonus-section">
                  <h4>速度加分</h4>
                  <div className="bonus-list">
                    {bonusWinners.map((r, i) => (
                      <div key={r.playerId} className="bonus-item">
                        <span className="bonus-rank">#{i + 1}</span>
                        <span className="bonus-name">{r.name}</span>
                        <span className="bonus-time">
                          {(r.timeTaken / 1000).toFixed(1)}s
                        </span>
                        <span className="bonus-points">+{r.bonus}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="fun-fact">
                <span className="fun-fact-icon">💡</span>
                <p>{q.funFact}</p>
              </div>
            </div>

            <button className="btn-primary btn-large" onClick={nextOrFinish}>
              {currentQ + 1 >= questions.length
                ? '查看最终排名'
                : `下一题 (${currentQ + 2}/${questions.length})`}
            </button>
          </div>

          <div className="sidebar">
            <div className="q-leaderboard-panel">
              <h3 className="qlb-title">本题排行</h3>
              <div className="qlb-list">
                {(() => {
                  // Correct answers sorted by speed
                  const correct = (questionResults || [])
                    .filter((r) => r.correct)
                    .sort((a, b) => a.timeTaken - b.timeTaken);
                  // Wrong answers
                  const wrong = (questionResults || [])
                    .filter((r) => !r.correct);
                  // Players who didn't answer
                  const answeredIds = new Set((questionResults || []).map((r) => r.playerId));
                  const noAnswer = sortedPlayers.filter((p) => !answeredIds.has(p.id));

                  return (
                    <>
                      {correct.map((r, i) => (
                        <div key={r.playerId} className="qlb-row qlb-correct">
                          <span className="qlb-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                          <span className="qlb-name">{r.name}</span>
                          <span className="qlb-time">{(r.timeTaken / 1000).toFixed(1)}s</span>
                          <span className="qlb-score">+{r.total}</span>
                        </div>
                      ))}
                      {wrong.map((r) => (
                        <div key={r.playerId} className="qlb-row qlb-wrong">
                          <span className="qlb-rank">✗</span>
                          <span className="qlb-name">{r.name}</span>
                          <span className="qlb-tag-wrong">答错</span>
                        </div>
                      ))}
                      {noAnswer.map((p) => (
                        <div key={p.id} className="qlb-row qlb-noanswer">
                          <span className="qlb-rank">—</span>
                          <span className="qlb-name">{p.name}</span>
                          <span className="qlb-tag-na">未答</span>
                        </div>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Finished
  if (phase === 'finished') {
    return (
      <div className="page admin-finished">
        <Fireworks show={true} />
        <div className="finished-content">
          <h1 className="gradient-text finished-title">答题结束!</h1>
          <Leaderboard players={players} />
          <button
            className="btn-secondary btn-large"
            onClick={() => navigate('/')}
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
