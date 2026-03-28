import { Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const nav = [
  { path: '/',            label: 'WasteVision AI', icon: '◎' },
  { path: '/reactor',     label: 'Plasma Reactor',  icon: '⌬' },
  { path: '/marketplace', label: 'CCT Market',      icon: '▣' },
];

export default function Navbar() {
  const location = useLocation();
  const { userBalance, methane } = useApp();
  const { isDark, toggle, colors } = useTheme();
  const { user, logout } = useAuth();

  return (
    <nav style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
      height: '60px',
      background: colors.navBg,
      backdropFilter: 'blur(24px)',
      borderBottom: `1px solid ${colors.navBorder}`,
      display: 'flex', alignItems: 'center',
      padding: '0 22px',
      gap: '0',
      boxShadow: isDark ? '0 2px 20px rgba(0,0,0,0.5)' : '0 2px 16px rgba(0,60,120,0.08)',
      transition: 'background 0.3s, box-shadow 0.3s, border-color 0.3s',
    }}>

      {/* — Logo — */}
      <Link to="/" style={{ textDecoration: 'none', flexShrink: 0, marginRight: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <polyline points="2 12 6 12 8 4 12 20 16 8 18 12 22 12"
                stroke={colors.cyan} strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{
              fontFamily: 'Orbitron, monospace', fontWeight: 800,
              fontSize: '15px', color: colors.cyan,
              letterSpacing: '0.1em',
              textShadow: isDark ? '0 0 14px rgba(0,229,255,0.4)' : 'none',
              transition: 'color 0.3s',
            }}>ATMOSCHAIN</span>
            <span style={{
              fontFamily: 'Share Tech Mono, monospace', fontSize: '9px',
              color: colors.textMuted, letterSpacing: '0.05em',
              alignSelf: 'flex-end', marginBottom: '1px',
            }}>v2.1</span>
          </div>
          <div style={{ display: 'flex', gap: '14px', marginTop: '2px', paddingLeft: '25px' }}>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '9px',
              letterSpacing: '0.1em', color: colors.textMuted }}>
              SYS: <span style={{ color: colors.green }}>ONLINE</span>
            </span>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '9px',
              letterSpacing: '0.1em', color: colors.textMuted }}>
              TELEMETRY: <span style={{ color: colors.green }}>SYNCED</span>
            </span>
          </div>
        </div>
      </Link>

      {/* Separator */}
      <div style={{
        width: '1px', height: '30px', flexShrink: 0,
        background: `linear-gradient(to bottom, transparent, ${colors.cyanBorderBright}, transparent)`,
        marginRight: '24px',
      }} />

      {/* — Nav links — */}
      <div style={{ display: 'flex', gap: '4px', flex: 1 }}>
        {nav.map(item => {
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} style={{ textDecoration: 'none' }}>
              <motion.div
                whileHover={{ backgroundColor: active ? undefined : colors.cyanBg }}
                transition={{ duration: 0.15 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '7px',
                  padding: '8px 18px',
                  fontFamily: 'Orbitron, monospace',
                  fontSize: '11px', fontWeight: active ? 800 : 600,
                  letterSpacing: '0.12em', textTransform: 'uppercase',
                  color: active ? colors.navLinkActive : colors.navLink,
                  background: active ? colors.navActiveBtn : 'transparent',
                  border: `1px solid ${active ? colors.cyan : colors.cyanBorder}`,
                  borderRadius: '5px',
                  boxShadow: active ? (isDark ? '0 0 18px rgba(0,229,255,0.3)' : '0 0 12px rgba(0,95,170,0.2)') : 'none',
                  transition: 'all 0.2s',
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}>
                <span style={{ fontSize: '13px', opacity: 0.85 }}>{item.icon}</span>
                {item.label}
              </motion.div>
            </Link>
          );
        })}
      </div>

      {/* — Right: stats + theme toggle — */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto', flexShrink: 0 }}>
        {methane !== null && (
          <div style={{
            fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
            fontWeight: 600, color: colors.cyan,
            background: colors.cyanBg,
            border: `1px solid ${colors.cyanBorder}`,
            padding: '5px 13px', borderRadius: '5px',
            display: 'flex', alignItems: 'center', gap: '6px',
            transition: 'all 0.3s',
          }}>
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '9px',
              color: colors.textMuted, letterSpacing: '0.08em' }}>CH₄</span>
            {methane}
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '9px',
              color: colors.textMuted }}>kg</span>
          </div>
        )}

        <div style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: '13px',
          fontWeight: 700, color: colors.green,
          background: colors.greenBg,
          border: `1px solid ${colors.greenBorder}`,
          padding: '5px 13px', borderRadius: '5px',
          display: 'flex', alignItems: 'center', gap: '6px',
          transition: 'all 0.3s',
        }}>
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '9px',
            color: colors.textMuted, letterSpacing: '0.08em' }}>CCT</span>
          {userBalance.toFixed(2)}
        </div>

        {/* ── Auth badge + logout ── */}
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              fontFamily: 'Share Tech Mono, monospace', fontSize: '11px',
              color: colors.green, background: colors.greenBg,
              border: `1px solid ${colors.greenBorder}`,
              padding: '5px 12px', borderRadius: '5px',
              letterSpacing: '0.08em', whiteSpace: 'nowrap',
            }}>
              ● {user.username.toUpperCase()}
            </div>
            <button
              onClick={logout}
              title="Logout from Marketplace"
              style={{
                padding: '5px 11px', border: `1px solid ${colors.red}55`,
                background: 'rgba(255,69,105,0.07)', color: colors.red,
                borderRadius: '5px', cursor: 'pointer',
                fontFamily: 'Share Tech Mono, monospace', fontSize: '11px',
                letterSpacing: '0.08em', transition: 'all 0.2s',
              }}
            >
              LOGOUT
            </button>
          </div>
        )}

        {/* ── Theme toggle ── */}
        <motion.button
          onClick={toggle}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 13px',
            border: `1px solid ${colors.cyanBorder}`,
            borderRadius: '20px',
            background: colors.bgCard,
            color: colors.textPrimary,
            fontFamily: 'Share Tech Mono, monospace',
            fontSize: '11px', letterSpacing: '0.1em',
            cursor: 'pointer', transition: 'all 0.25s',
            whiteSpace: 'nowrap',
          }}>
          {/* Sun / Moon icon */}
          <span style={{ fontSize: '14px', lineHeight: 1 }}>
            {isDark ? '☀' : '🌙'}
          </span>
          <span style={{ color: colors.textMuted }}>
            {isDark ? 'LIGHT' : 'DARK'}
          </span>
          {/* Toggle pill */}
          <div style={{
            width: '32px', height: '17px',
            background: isDark ? 'rgba(0,229,255,0.18)' : 'rgba(0,95,170,0.18)',
            border: `1px solid ${isDark ? 'rgba(0,229,255,0.4)' : 'rgba(0,95,170,0.4)'}`,
            borderRadius: '10px', position: 'relative', flexShrink: 0,
            transition: 'background 0.3s',
          }}>
            <motion.div
              animate={{ left: isDark ? '2px' : '17px' }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              style={{
                position: 'absolute', width: '11px', height: '11px',
                borderRadius: '50%', top: '2px',
                background: isDark ? 'rgba(0,229,255,0.85)' : '#005faa',
              }} />
          </div>
        </motion.button>
      </div>
    </nav>
  );
}
