import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';

const API = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';
const POLL_MS = 1500; // poll backend every 1.5s for latest detection stats

/* ── Label ─────────────────────────────────────────────────────── */
const Lbl = ({ children, style = {} }) => {
  const { colors } = useTheme();
  return (
    <div style={{
      fontFamily: 'Share Tech Mono, monospace', fontSize: '12px',
      letterSpacing: '0.18em', textTransform: 'uppercase',
      color: colors.textMuted, ...style,
    }}>{children}</div>
  );
};

/* ── Single object card ────────────────────────────────────────── */
function ObjectCard({ obj, index, colors }) {
  const color = obj.color || '#00e5ff';
  const md    = obj.methane_data || {};
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{
        background: colors.bgCard,
        border: `1px solid ${color}44`,
        borderLeft: `4px solid ${color}`,
        borderRadius: '8px',
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '13px', fontWeight: 700, color, letterSpacing: '0.06em' }}>
          {obj.label}
        </div>
        <div style={{
          background: `${color}22`, border: `1px solid ${color}55`,
          color, borderRadius: '4px',
          fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
          padding: '2px 10px', fontWeight: 700,
        }}>
          {Math.round((obj.confidence || 0) * 100)}%
        </div>
      </div>

      <div style={{
        fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px',
        color: colors.textBody, lineHeight: 1.5, marginBottom: '10px',
      }}>
        {obj.description}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        {[
          { label: 'MASS',    value: `${obj.estimated_mass_kg} kg`,       color: colors.textSecondary },
          { label: 'CH₄',    value: `${md.ch4_kg ?? 0} kg`,              color: colors.orange, hide: !md.ch4_kg },
          { label: 'CREDITS', value: `${md.carbon_credits ?? 0} CCT`,    color: colors.green,  hide: !md.carbon_credits },
        ].filter(s => !s.hide || s.label === 'MASS').map(stat => (
          <div key={stat.label} style={{
            background: colors.bgPanel,
            border: `1px solid ${colors.border}`,
            borderRadius: '4px', padding: '6px 10px',
          }}>
            <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '9px', color: colors.textMuted, marginBottom: '3px' }}>
              {stat.label}
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ── Stat tile ─────────────────────────────────────────────────── */
function Stat({ label, value, unit, color, glow }) {
  const { isDark } = useTheme();
  return (
    <div style={{
      flex: 1, padding: '16px 18px',
      borderRadius: '8px',
      background: `${color}0d`,
      border: `1px solid ${color}33`,
      boxShadow: glow && isDark ? `0 0 24px ${color}22` : 'none',
    }}>
      <div style={{
        fontFamily: 'Share Tech Mono, monospace', fontSize: '10px',
        letterSpacing: '0.18em', color: `${color}bb`,
        textTransform: 'uppercase', marginBottom: '8px',
      }}>{label}</div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace', fontSize: '24px',
        fontWeight: 700, color, lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontFamily: 'Share Tech Mono, monospace', fontSize: '10px',
        color: `${color}88`, marginTop: '4px',
      }}>{unit}</div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { setMethane, setAnalysisResult } = useApp();
  const { isDark, colors } = useTheme();

  const [detection, setDetection]   = useState(null);
  const [camStatus, setCamStatus]   = useState('disconnected'); // 'disconnected' | 'connected' | 'idle'
  const [lastUpdate, setLastUpdate] = useState(null);
  const [initialized, setInit]      = useState(false);
  const [error, setError]           = useState('');
  const pollRef = useRef(null);

  // ── WebRTC & Canvas State ──
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [wsDetections, setWsDetections] = useState([]); // For drawing boxes
  const videoRef = useRef(null);
  const extractCanvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const streamRef = useRef(null);
  const frameIntervalRef = useRef(null);
  const wsRef = useRef(null);

  /* Start Camera */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 1280, height: 720, facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      streamRef.current = stream;
      setIsCameraActive(true);
      setError('');
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Please allow camera access. " + err.message);
    }
  };

  /* Stop Camera */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    setWsDetections([]);
  }, []);

  /* WebSocket Connection for Frame Stream */
  useEffect(() => {
    if (!initialized) return;

    const connectWs = () => {
      const ws = new WebSocket(WS_URL);
      ws.onopen = () => setCamStatus('connected');
      ws.onclose = () => {
        setCamStatus('disconnected');
        setTimeout(connectWs, 3000); // Reconnect
      };
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.detections) {
            setWsDetections(data.detections);
          }
        } catch(e) {
          console.error("Failed to parse WS detections", e);
        }
      }
      wsRef.current = ws;
    };
    
    connectWs();
    return () => {
      if (wsRef.current) wsRef.current.close();
      stopCamera();
    }
  }, [initialized, stopCamera]);

  /* Extract frames and send to WS */
  useEffect(() => {
    if (isCameraActive) {
      frameIntervalRef.current = setInterval(() => {
        if (videoRef.current && extractCanvasRef.current) {
          const video = videoRef.current;
          const canvas = extractCanvasRef.current;
          if (video.videoWidth === 0) return;
          
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(dataUrl);
            setLastUpdate(new Date().toISOString());
          }
        }
      }, 500); // 2 FPS for stability & processing time vs UX
    } else {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    }
    return () => {
      if (frameIntervalRef.current) clearInterval(frameIntervalRef.current);
    }
  }, [isCameraActive]);

  /* Draw Box Overlay */
  useEffect(() => {
    if (!overlayCanvasRef.current || !videoRef.current) return;
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;
    if (video.videoWidth === 0) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    wsDetections.forEach(det => {
      const [x1, y1, x2, y2] = det.box;
      const width = x2 - x1;
      const height = y2 - y1;
      const detColor = det.color || '#00e5ff';

      // Draw Stroke
      ctx.lineWidth = 3;
      ctx.strokeStyle = detColor;
      ctx.strokeRect(x1, y1, width, height);
      
      // Cyberpunk Corners
      ctx.beginPath();
      ctx.moveTo(x1, y1 + 15); ctx.lineTo(x1, y1); ctx.lineTo(x1 + 15, y1);
      ctx.moveTo(x2 - 15, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + 15);
      ctx.moveTo(x1, y2 - 15); ctx.lineTo(x1, y2); ctx.lineTo(x1 + 15, y2);
      ctx.moveTo(x2 - 15, y2); ctx.lineTo(x2, y2); ctx.lineTo(x2, y2 - 15);
      ctx.lineWidth = 5;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Label Badge
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.fillRect(x1, y1 - 30, Math.max(160, width), 30);
      
      ctx.fillStyle = detColor;
      ctx.font = 'bold 16px "Share Tech Mono", monospace';
      ctx.fillText(`[${det.label}] ${Math.round(det.confidence * 100)}%`, x1 + 8, y1 - 8);
    });
  }, [wsDetections, isCameraActive]);

  /* Poll backend for globally updated latest detection state (keeps reactor synced) */
  useEffect(() => {
    if (!initialized) return;

    const poll = async () => {
      try {
        const res = await fetch(`${API}/detection/latest`);
        if (!res.ok) throw new Error();
        const det  = await res.json();

        setDetection(det);
        
        // Sync methane to global state
        if (det.totals?.ch4_kg > 0) {
          setMethane(det.totals.ch4_kg);
          setAnalysisResult(det);
        }
      } catch (err) {
        if (!isCameraActive) {
          setError('Backend offline — please run uvicorn server.');
        }
      }
    };

    poll();
    pollRef.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [initialized, setMethane, setAnalysisResult, isCameraActive]);

  /* ── LANDING SPLASH ─────────────────────────────────────────── */
  if (!initialized) {
    return (
      <div style={{
        minHeight: '100vh', paddingTop: '60px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '60px 40px 40px',
      }}>
        {isDark && (
          <div style={{
            position: 'fixed', left: '18px', top: '80px',
            fontFamily: 'Share Tech Mono, monospace', fontSize: '9px',
            color: 'rgba(0,229,255,0.16)', lineHeight: '1.9',
            pointerEvents: 'none', userSelect: 'none',
          }}>
            <div>INIT: WASTEVISION AI KERNEL</div>
            <div style={{ color: 'rgba(0,230,118,0.16)' }}>YOLOV8 + PYTORCH</div>
            <div style={{ color: 'rgba(0,230,118,0.16)' }}>PLASMA GASIFICATION</div>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.65 }}
          style={{ maxWidth: '860px', width: '100%', textAlign: 'center' }}
        >
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            style={{
              fontFamily: 'Share Tech Mono, monospace', fontSize: '13px',
              letterSpacing: '0.32em', textTransform: 'uppercase',
              color: colors.textMuted, marginBottom: '20px',
            }}>
            ⟡ ENVIRONMENTAL INTELLIGENCE PROTOCOL ⟡
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.22, duration: 0.5 }}
            style={{
              fontFamily: 'Orbitron, monospace', fontWeight: 900,
              fontSize: 'clamp(42px, 9vw, 88px)',
              color: colors.textPrimary, letterSpacing: '0.06em',
              lineHeight: 1.0, marginBottom: '20px',
              textShadow: isDark ? '0 0 60px rgba(0,229,255,0.12)' : 'none',
            }}>
            ATMOSCHAIN
          </motion.h1>

          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.36, duration: 0.5 }}
            style={{ height: '2px', width: '160px', margin: '0 auto 26px',
              background: `linear-gradient(90deg, transparent, ${colors.cyan}, transparent)` }} />

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.44 }}
            style={{
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '18px',
              fontWeight: 400, lineHeight: 1.8, color: colors.textBody,
              maxWidth: '580px', margin: '0 auto 44px',
            }}>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54 }}
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
              marginBottom: '44px', background: colors.cyanBg,
              border: `1px solid ${colors.cyanBorder}`,
              borderRadius: '10px', overflow: 'hidden',
              boxShadow: isDark ? '0 4px 24px rgba(0,0,0,0.5)' : '0 4px 20px rgba(0,60,120,0.08)',
            }}>
            {[
              { icon: '◎', label: 'WASTEVISION',   desc: 'Live WebRTC feed + YOLOv8 inference integrated into browser.', highlight: true },
              { icon: '⌬', label: 'PLASMA SIM', desc: 'Thermodynamic energy recovery from detected methane.' },
              { icon: '▣', label: 'CCT LEDGER', desc: 'Carbon credit generation & blockchain trading.' },
            ].map((card, i) => (
              <motion.div key={i} whileHover={{ background: colors.bgCardHover }}
                style={{
                  padding: '28px 22px',
                  background: card.highlight ? colors.cyanBg : colors.bgCard,
                  borderLeft: i > 0 ? `1px solid ${colors.border}` : 'none',
                  textAlign: 'center',
                }}>
                <div style={{ fontSize: '26px', color: colors.cyan, marginBottom: '12px',
                  textShadow: isDark ? '0 0 16px rgba(0,229,255,0.5)' : 'none' }}>
                  {card.icon}
                </div>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '13px', fontWeight: 700,
                  letterSpacing: '0.14em', color: colors.textPrimary, marginBottom: '10px' }}>
                  {card.label}
                </div>
                <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px',
                  color: colors.textBody, lineHeight: 1.7 }}>
                  {card.desc}
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.button
            className="btn-primary"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
            onClick={() => setInit(true)}
            style={{
              padding: '18px 60px', fontSize: '14px',
              boxShadow: isDark ? '0 0 40px rgba(0,229,255,0.35)' : '0 4px 24px rgba(0,95,170,0.3)',
            }}>
            INITIALIZE SYSTEM →
          </motion.button>
        </motion.div>
      </div>
    );
  }

  /* ── DETECTION DASHBOARD ────────────────────────────────────── */
  const objects = detection?.objects || [];
  const totals  = detection?.totals  || { count: 0, ch4_kg: 0, co2e_kg: 0, energy_kwh: 0, credits: 0 };
  const isWsConnected = camStatus === 'connected';

  return (
    <div style={{ minHeight: '100vh', paddingTop: '60px', display: 'flex', flexDirection: 'column' }}>
      <div className="page-header">
        <h2 style={{ color: colors.cyan }}>◎ WASTEVISION UI</h2>
        <Lbl>MODULE 1 · WEBRTC OPENCV YOLOV8 DETECTION</Lbl>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: isWsConnected ? colors.green : colors.red,
            boxShadow: `0 0 8px ${isWsConnected ? colors.green : colors.red}`,
            display: 'inline-block',
          }} className={isWsConnected ? 'pulse-neon' : ''} />
          <span style={{
            fontFamily: 'Share Tech Mono, monospace', fontSize: '12px',
            color: isWsConnected ? colors.green : colors.red, letterSpacing: '0.1em',
          }}>
            {isWsConnected ? 'BACKEND LINK CONNECTED' : 'SERVER OFFLINE'}
          </span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'minmax(500px, 1.2fr) 1fr' }}>

        {/* LEFT PANEL: Camera integration */}
        <div className="panel-left" style={{
          borderRight: `1px solid ${colors.divider}`,
          padding: '28px 34px',
          display: 'flex', flexDirection: 'column', gap: '22px',
        }}>
          
          {/* CAMERA FEED */}
          <div style={{
            background: colors.bgCard,
            border: `1px solid ${isCameraActive ? colors.cyanBorder : colors.border}`,
            borderRadius: '10px', overflow: 'hidden', position: 'relative',
            minHeight: '380px', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <canvas ref={extractCanvasRef} style={{ display: 'none' }} />
            
            <video 
              ref={videoRef} 
              autoPlay playsInline muted 
              style={{ width: '100%', height: 'auto', display: isCameraActive ? 'block' : 'none' }}
            />
            <canvas 
              ref={overlayCanvasRef} 
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: isCameraActive ? 'block' : 'none', pointerEvents: 'none' }}
            />
            
            {!isCameraActive && (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '14px', opacity: 0.6 }}>📷</div>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '15px', color: colors.textSecondary }}>
                  CAMERA OFFLINE
                </div>
              </div>
            )}
            
            {/* Overlay recording indicator */}
            {isCameraActive && (
               <div style={{ position: 'absolute', top: '16px', right: '16px', display: 'flex', gap: '8px', alignItems: 'center', background: 'rgba(0,0,0,0.6)', padding: '6px 12px', borderRadius: '4px' }}>
                 <span style={{width: '10px', height: '10px', background: colors.red, borderRadius: '50%'}} className="pulse-neon"></span>
                 <span style={{fontFamily: 'Share Tech Mono', fontSize: '13px', color: '#fff', letterSpacing: '0.1em'}}>LIVE REC</span>
               </div>
            )}
          </div>
          
          {/* Controls */}
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
            {!isCameraActive ? (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={startCamera}
                style={{
                  fontFamily: 'Orbitron, monospace', fontSize: '13px', fontWeight: 600,
                  padding: '12px 30px', border: `1px solid ${colors.cyan}`,
                  background: colors.cyanBg, color: colors.textPrimary, letterSpacing: '0.1em', cursor: 'pointer',
                  borderRadius: '4px'
              }}>
                [ START CAMERA ]
              </motion.button>
            ) : (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                onClick={stopCamera}
                style={{
                  fontFamily: 'Orbitron, monospace', fontSize: '13px', fontWeight: 600,
                  padding: '12px 30px', border: `1px solid ${colors.red}`,
                  background: 'rgba(255,69,105,0.1)', color: colors.textPrimary, letterSpacing: '0.1em', cursor: 'pointer',
                  borderRadius: '4px'
              }}>
                [ STOP FEED ]
              </motion.button>
            )}
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                background: 'rgba(255,69,105,0.07)',
                border: `1px solid ${colors.red}55`,
                borderRadius: '6px', padding: '12px 16px',
                fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px',
                color: colors.red,
              }}>
              ⚠ {error}
            </motion.div>
          )}

        </div>

        {/* RIGHT PANEL: Results exactly functioning as expected */}
        <div className="panel-right" style={{
          padding: '28px 34px',
          display: 'flex', flexDirection: 'column', gap: '18px',
        }}>
          <Lbl>▣ METRICS & DETECTIONS</Lbl>

          <AnimatePresence>
            {totals.count > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div style={{
                  textAlign: 'center', padding: '22px',
                  background: colors.cyanBg,
                  border: `1px solid ${colors.cyanBorderBright || colors.cyan + '55'}`,
                  borderRadius: '10px',
                }}>
                  <Lbl style={{ marginBottom: '10px' }}>TOTAL METHANE POTENTIAL</Lbl>
                  <motion.div
                    key={totals.ch4_kg}
                    initial={{ scale: 0.9 }} animate={{ scale: 1 }}
                    style={{
                      fontFamily: 'JetBrains Mono, monospace', fontSize: '48px',
                      fontWeight: 700, color: colors.cyan, lineHeight: 1,
                      textShadow: isDark ? '0 0 30px rgba(0,229,255,0.5)' : 'none',
                      marginBottom: '6px',
                    }}>
                    {totals.ch4_kg}
                  </motion.div>
                  <Lbl>KG CH₄ FROM {totals.count} OBJECT(S)</Lbl>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <Stat label="CO₂e" value={totals.co2e_kg}   unit="kg avoided" color={colors.orange} />
                  <Stat label="ENERGY" value={totals.energy_kwh} unit="kWh"       color={colors.cyan} glow />
                  <Stat label="CREDITS" value={totals.credits}  unit="CCT"        color={colors.green} />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="btn-primary"
                  onClick={() => navigate('/reactor')}
                  style={{ width: '100%', padding: '16px', fontSize: '13px' }}>
                  SEND TO PLASMA REACTOR →
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <Lbl>WASTELOG ({objects.length})</Lbl>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '450px', overflowY: 'auto' }}>
              <AnimatePresence mode="popLayout">
                {objects.length === 0 ? (
                  <motion.div key="empty"
                    initial={{ opacity: 0 }} animate={{ opacity: 0.6 }}
                    style={{
                      textAlign: 'center', padding: '40px 20px',
                      background: colors.bgCard,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                    }}>
                    <div style={{ fontSize: '36px', marginBottom: '14px' }}>🔍</div>
                    <div style={{
                      fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px',
                      color: colors.textSecondary, lineHeight: 1.6,
                    }}>
                       Active camera feed to classify waste automatically.
                    </div>
                  </motion.div>
                ) : (
                  objects.map((obj, i) => (
                    <ObjectCard key={`${obj.label}-${i}`} obj={obj} index={i} colors={colors} />
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
