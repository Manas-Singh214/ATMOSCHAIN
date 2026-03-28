import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import ReactorCanvas from '../components/ReactorCanvas';
import ResultModal from '../components/ResultModal';

const API = 'http://localhost:8000';

const Lbl = ({ children, style = {} }) => {
  const { colors } = useTheme();
  return (
    <div style={{
      fontFamily: 'Share Tech Mono, monospace', fontSize: '12px',
      letterSpacing: '0.16em', textTransform: 'uppercase',
      color: colors.textMuted, ...style,
    }}>{children}</div>
  );
};

export default function ReactorPage() {
  const { methane: globalMethane, analysisResult, setReactorResult, setCarbonCredits, setUserBalance } = useApp();
  const { colors, isDark } = useTheme();
  const navigate = useNavigate();

  /* Use actual methane from WasteVision detection — locked, not editable */
  const lockedMethane = globalMethane ?? 0;
  const wasteObjects  = analysisResult?.objects || [];
  const hasDetection  = lockedMethane > 0;

  const [isRunning,  setIsRunning]  = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [showModal,  setShowModal]  = useState(false);
  const [result,     setResult]     = useState(null);
  const [liveStats,  setLiveStats]  = useState({ energy: 0, credits: 0, efficiency: 0, co2: 0 });
  const [backendResult, setBackendResult] = useState(null);

  const timerRef     = useRef(null);
  const startTimeRef = useRef(null);
  const DURATION     = 5000;

  /* Instant compute for preview */
  const compute = (val) => ({
    energy:     +(val * 13.9).toFixed(4),
    credits:    +((val * 28) / 1000).toFixed(6),
    efficiency: 92,
    co2:        +(val * 2.75).toFixed(4),
  });

  const startSimulation = async () => {
    if (isRunning || !hasDetection) return;
    setIsRunning(true); setProgress(0); setShowModal(false); setResult(null);
    startTimeRef.current = Date.now();
    const target = compute(lockedMethane);

    /* Kick off animated progress */
    timerRef.current = setInterval(() => {
      const p = Math.min((Date.now() - startTimeRef.current) / DURATION, 1);
      setProgress(p);
      setLiveStats({
        energy:     +(target.energy     * p).toFixed(4),
        credits:    +(target.credits    * p).toFixed(6),
        efficiency: +(92               * p).toFixed(1),
        co2:        +(target.co2       * p).toFixed(4),
      });

      if (p >= 1) {
        clearInterval(timerRef.current);
        finalize(target);
      }
    }, 50);

    /* In parallel — call real backend */
    try {
      const res = await fetch(`${API}/reactor/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          methane_kg:     lockedMethane,
          waste_objects:  wasteObjects,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setBackendResult(data);
      }
    } catch { /* use local compute as fallback */ }
  };

  const finalize = (target) => {
    setIsRunning(false); setProgress(0);
    const final = { ...target, efficiency: 92 };
    setResult(final);
    setReactorResult(final);
    setUserBalance(prev => prev + +final.credits.toFixed(2));
    setCarbonCredits(final.credits);
    setTimeout(() => setShowModal(true), 400);
  };

  useEffect(() => () => clearInterval(timerRef.current), []);

  /* Live projections from detected methane */
  const projections = [
    { label: 'Energy Output',  value: `${(lockedMethane * 13.9).toFixed(4)} kWh`,        color: colors.cyan   },
    { label: 'Carbon Credits', value: `${((lockedMethane * 28) / 1000).toFixed(6)} CCT`, color: colors.green  },
    { label: 'CO₂ Avoided',  value: `${(lockedMethane * 2.75).toFixed(4)} kg`,          color: colors.purple },
  ];

  const telemetry = [
    { label: 'Energy Generated', value: liveStats.energy,     unit: 'kWh', color: colors.cyan,   icon: '⚡' },
    { label: 'Carbon Credits',   value: liveStats.credits,    unit: 'CCT', color: colors.green,  icon: '◈' },
    { label: 'Efficiency',       value: liveStats.efficiency, unit: '%',   color: colors.purple, icon: '⌬' },
    { label: 'CO₂ Avoided',    value: liveStats.co2,        unit: 'kg',  color: colors.orange, icon: '◉' },
  ];

  const panelStyle = {
    background: colors.bgPanel,
    backdropFilter: 'blur(24px)',
    WebkitBackdropFilter: 'blur(24px)',
    transition: 'background 0.3s',
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: '60px', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div className="page-header">
        <h2 style={{ color: colors.cyan }}>⌬ PLASMA REACTOR</h2>
        <Lbl>MODULE 2 · METHANE → ENERGY CONVERSION</Lbl>
        {isRunning && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px',
            fontFamily: 'Share Tech Mono, monospace', fontSize: '12px',
            color: colors.green, letterSpacing: '0.1em' }}>
            <span style={{ width: 7, height: 7, background: colors.green, borderRadius: '50%',
              boxShadow: `0 0 8px ${colors.green}`, display: 'inline-block' }} className="pulse-neon" />
            REACTOR ACTIVE
          </span>
        )}
        <button className="btn-outline" onClick={() => navigate('/marketplace')} style={{ marginLeft: 'auto' }}>
          CCT MARKET →
        </button>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '340px 1fr 340px', minHeight: 0 }}>

        {/* LEFT: Input params */}
        <div style={{ ...panelStyle, borderRight: `1px solid ${colors.divider}`,
          padding: '28px 24px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '20px' }}>

          <Lbl style={{ fontSize: '12px' }}>⚗ DETECTION INPUT</Lbl>

          {/* Methane source display */}
          <div style={{
            background: hasDetection ? colors.greenBg : colors.bgCard,
            border: `1px solid ${hasDetection ? colors.greenBorder : colors.border}`,
            borderRadius: '8px', padding: '18px 20px',
          }}>
            <Lbl style={{ marginBottom: '10px', color: hasDetection ? colors.green : colors.textMuted }}>
              CH₄ FROM WASTEVISION
            </Lbl>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: '38px',
              fontWeight: 700, color: hasDetection ? colors.green : colors.textMuted,
              lineHeight: 1, marginBottom: '6px',
              textShadow: hasDetection && isDark ? `0 0 20px ${colors.green}55` : 'none',
            }}>
              {lockedMethane || '—'}
            </div>
            <div style={{
              fontFamily: 'Share Tech Mono, monospace', fontSize: '11px',
              color: colors.textMuted,
            }}>
              {hasDetection
                ? `${wasteObjects.length} object(s) detected by WasteVision`
                : 'No detection yet — run wastevision_cam.py first'}
            </div>
            {hasDetection && (
              <div style={{
                marginTop: '10px',
                fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px',
                color: colors.green, display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                ✓ Auto-loaded from live camera detection
              </div>
            )}
          </div>

          {/* Waste breakdown */}
          {wasteObjects.length > 0 && (
            <div>
              <Lbl style={{ marginBottom: '10px' }}>WASTE COMPOSITION</Lbl>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {wasteObjects.map((obj, i) => {
                  const color = obj.color || colors.cyan;
                  const ch4   = obj.methane_data?.ch4_kg ?? 0;
                  return (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: colors.bgCard, borderRadius: '5px', padding: '9px 14px',
                      border: `1px solid ${color}33`, borderLeft: `3px solid ${color}`,
                    }}>
                      <div>
                        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '12px', color }}>
                          {obj.label}
                        </div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: colors.textMuted }}>
                          {obj.estimated_mass_kg} kg
                        </div>
                      </div>
                      {ch4 > 0 && (
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 700, color: colors.orange }}>
                          {ch4} kg CH₄
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Projected output */}
          <div>
            <Lbl style={{ marginBottom: '10px' }}>PROJECTED OUTPUT</Lbl>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              {projections.map(item => (
                <div key={item.label} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: colors.bgCard, borderRadius: '5px', padding: '10px 14px',
                  border: `1px solid ${colors.border}`,
                }}>
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '11px', color: colors.textMuted }}>
                    {item.label}
                  </span>
                  <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', fontWeight: 700, color: item.color }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ height: '1px', background: `linear-gradient(90deg, transparent, ${colors.cyanBorderBright || colors.cyan + '55'}, transparent)` }} />

          {/* Start button */}
          {!hasDetection && (
            <div style={{
              background: 'rgba(255,69,105,0.07)',
              border: `1px solid ${colors.red}44`,
              borderRadius: '6px', padding: '12px 16px',
              fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px',
              color: colors.red, textAlign: 'center',
            }}>
              ⚠ Run WasteVision detection first to get methane data
            </div>
          )}

          <button
            className={isRunning ? 'btn-outline' : 'btn-primary'}
            onClick={startSimulation}
            disabled={isRunning || !hasDetection}
            style={{ width: '100%', padding: '15px', fontSize: '12px' }}>
            {isRunning ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '9px', justifyContent: 'center' }}>
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}>⟳</motion.span>
                SIMULATING... {Math.round(progress * 100)}%
              </span>
            ) : hasDetection ? 'INITIATE REACTOR ▶' : 'AWAITING DETECTION...'}
          </button>

          {isRunning && (
            <div>
              <div style={{ background: colors.cyanBg, borderRadius: '2px', height: '5px',
                overflow: 'hidden', border: `1px solid ${colors.cyanBorder}` }}>
                <motion.div style={{
                  height: '100%',
                  background: `linear-gradient(90deg, ${colors.cyan}, ${colors.green})`,
                  width: `${progress * 100}%`,
                  boxShadow: `0 0 10px ${colors.cyan}`,
                }} transition={{ duration: 0.05 }} />
              </div>
            </div>
          )}
        </div>

        {/* CENTER: Canvas */}
        <div style={{ ...panelStyle, background: colors.bgHover ?? colors.bgCard,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 2 }}>
            <span className={`badge ${isRunning ? 'badge-green' : hasDetection ? 'badge-blue' : 'badge-red'}`}
              style={{ padding: '6px 18px', fontSize: '12px' }}>
              {isRunning ? '● REACTOR ACTIVE' : hasDetection ? '◌ READY — DETECTION LOADED' : '◌ STANDBY — NO DETECTION'}
            </span>
          </div>
          <ReactorCanvas isRunning={isRunning} progress={progress} />
          <div style={{
            position: 'absolute', bottom: '20px',
            fontFamily: 'Share Tech Mono, monospace', color: colors.textMuted,
            fontSize: '10px', letterSpacing: '0.24em', textTransform: 'uppercase',
          }}>
            PLASMA GASIFICATION ENGINE v2.1
          </div>
        </div>

        {/* RIGHT: Telemetry */}
        <div style={{ ...panelStyle, borderLeft: `1px solid ${colors.divider}`,
          padding: '28px 24px', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '14px' }}>

          <Lbl style={{ fontSize: '12px', marginBottom: '4px' }}>📡 LIVE TELEMETRY</Lbl>

          {telemetry.map(stat => (
            <motion.div key={stat.label}
              animate={isRunning ? {
                borderColor: [`${stat.color}18`, `${stat.color}4a`, `${stat.color}18`],
              } : {}}
              transition={{ repeat: Infinity, duration: 1.8 }}
              style={{
                background: colors.bgCard, border: `1px solid ${colors.border}`,
                borderRadius: '6px', padding: '18px 20px',
                boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.4)' : '0 2px 10px rgba(0,60,120,0.07)',
              }}>
              <Lbl style={{ marginBottom: '10px' }}>{stat.icon} {stat.label}</Lbl>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '7px' }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: '28px',
                  fontWeight: 700, color: (isRunning || result) ? stat.color : colors.textMuted,
                  textShadow: (isRunning || result) && isDark ? `0 0 18px ${stat.color}55` : 'none',
                }}>{stat.value}</span>
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '12px', color: colors.textMuted }}>
                  {stat.unit}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Completion card */}
          <AnimatePresence>
            {result && !isRunning && (
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: '4px', background: colors.greenBg,
                  border: `1px solid ${colors.greenBorder}`,
                  borderRadius: '8px', padding: '18px 20px',
                }}>
                <Lbl style={{ color: colors.green, marginBottom: '10px' }}>✓ SIMULATION COMPLETE</Lbl>
                <div style={{
                  fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px',
                  color: colors.textBody, lineHeight: 1.8,
                }}>
                  {result.energy} kWh generated<br />
                  {result.credits} CCT credits earned<br />
                  {result.co2} kg CO₂ avoided
                </div>
                <button className="btn-green" onClick={() => setShowModal(true)}
                  style={{ marginTop: '14px', width: '100%', padding: '11px', fontSize: '11px' }}>
                  VIEW FULL REPORT
                </button>
                <button className="btn-outline" onClick={() => navigate('/marketplace')}
                  style={{ marginTop: '8px', width: '100%', padding: '10px', fontSize: '11px' }}>
                  TRADE CREDITS →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ResultModal isOpen={showModal} onClose={() => setShowModal(false)}
        energy={result?.energy ?? 0} credits={result?.credits ?? 0} />
    </div>
  );
}
