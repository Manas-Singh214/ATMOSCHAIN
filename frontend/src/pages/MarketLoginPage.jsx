import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEMO_USERS = [
  { username: 'admin',     pass: 'atmoschain2024', role: 'ADMIN',  desc: 'Platform Overseer Configuration & Protocol Control', color: '#00e5ff', icon: '◈' },
  { username: 'indigo',    pass: 'indigo123',      role: 'BUYER',  desc: 'Aviation Corporation requiring verified carbon offsets', color: '#00e676', icon: '▣' },
  { username: 'ecofarmer', pass: 'eco2024',        role: 'SELLER', desc: 'Waste conversion facility generating certified credits', color: '#ff7043', icon: '⌬' },
];

export default function MarketLoginPage({ onSuccess }) {
  const { login, authError, setAuthError } = useAuth();
  const { isDark, colors } = useTheme();
  
  // New state: user selects an account card first, then enters password
  const [selectedUser, setSelectedUser] = useState(null);
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoginClick = async () => {
    if (!selectedUser) return;
    setLoading(true);
    await new Promise(r => setTimeout(r, 800)); // Animated sequence
    const ok = login(selectedUser.username, passwordInput);
    setLoading(false);
    if (ok) {
        if (onSuccess) onSuccess();
    }
  };

  return (
    <div style={{
      minHeight: '100vh', paddingTop: '60px',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '40px 24px',
    }}>
      
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            style={{
              fontFamily: 'Share Tech Mono, monospace', fontSize: '11px',
              letterSpacing: '0.4em', color: colors.textMuted,
              textTransform: 'uppercase', marginBottom: '16px',
            }}
          >
            ⟡ PROTOCOL AUTHENTICATION ⟡
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            style={{
              fontFamily: 'Orbitron, monospace', fontWeight: 900,
              fontSize: '42px', letterSpacing: '0.12em',
              color: colors.textPrimary, textShadow: isDark ? `0 0 40px ${colors.cyan}44` : 'none',
              marginBottom: '10px'
          }}>
            SELECT IDENTITY
          </motion.h1>
      </div>

      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '1000px', width: '100%' }}>
        {DEMO_USERS.map((usr, i) => {
          const isSelected = selectedUser?.username === usr.username;
          return (
            <motion.div
              key={usr.username}
              layout
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 + 0.2 }}
              onClick={() => { setSelectedUser(usr); setPasswordInput(usr.pass); setAuthError(''); }}
              whileHover={{ scale: isSelected ? 1 : 1.03, y: isSelected ? 0 : -6, borderColor: usr.color }}
              style={{
                flex: '1 1 300px', maxWidth: '340px',
                background: isSelected ? `${usr.color}11` : colors.bgCard,
                border: `2px solid ${isSelected ? usr.color : colors.border}`,
                boxShadow: isSelected ? `0 0 30px ${usr.color}22` : (isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 20px rgba(0,0,0,0.05)'),
                borderRadius: '16px', padding: '28px 24px', cursor: 'pointer',
                display: 'flex', flexDirection: 'column',
                transition: 'all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)',
                position: 'relative', overflow: 'hidden'
              }}
            >
              {isSelected && (
                <motion.div layoutId="highlight" style={{
                  position: 'absolute', top: 0, left: 0, width: '4px', height: '100%',
                  background: usr.color, boxShadow: `0 0 15px ${usr.color}`
                }} />
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
                <div style={{
                  fontSize: '32px', color: usr.color,
                  textShadow: `0 0 20px ${usr.color}66`
                }}>{usr.icon}</div>
                <div style={{
                  fontFamily: 'Share Tech Mono, monospace', fontSize: '11px',
                  letterSpacing: '0.2em', color: usr.color, padding: '4px 10px',
                  background: `${usr.color}22`, borderRadius: '4px', border: `1px solid ${usr.color}55`
                }}>
                  {usr.role}
                </div>
              </div>

              <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '22px', fontWeight: 800, color: colors.textPrimary, letterSpacing: '0.08em', marginBottom: '8px', textTransform: 'uppercase' }}>
                {usr.username}
              </div>
              
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '14px', color: colors.textBody, lineHeight: 1.6, flex: 1, marginBottom: '20px' }}>
                {usr.desc}
              </div>
              
              {/* Login Form Expansion */}
              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    style={{ overflow: 'hidden', borderTop: `1px dashed ${usr.color}55`, paddingTop: '20px' }}
                  >
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '10px', color: colors.textMuted, letterSpacing: '0.1em', marginBottom: '8px', textTransform: 'uppercase' }}>SECURITY PROTOCOL</div>
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <input
                        type="password"
                        readOnly // Prefilled for demo simplicity but acts like an input
                        value={passwordInput}
                        style={{
                          flex: 1, background: 'rgba(0,0,0,0.3)', border: `1px solid ${colors.border}`,
                          color: colors.textPrimary, padding: '12px 14px', borderRadius: '6px',
                          fontFamily: 'JetBrains Mono, monospace', fontSize: '16px', letterSpacing: '0.2em'
                        }}
                      />
                    </div>
                    
                    {authError && (
                      <div style={{ color: colors.red, fontSize: '12px', marginTop: '10px', fontFamily: 'Space Grotesk' }}>⚠ {authError}</div>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}
                      onClick={(e) => { e.stopPropagation(); handleLoginClick(); }}
                      disabled={loading}
                      style={{
                        width: '100%', padding: '14px', marginTop: '14px',
                        fontFamily: 'Orbitron, monospace', fontSize: '13px', fontWeight: 800, letterSpacing: '0.15em',
                        background: usr.color, color: '#000', border: 'none', borderRadius: '6px', cursor: 'pointer',
                        boxShadow: `0 0 20px ${usr.color}44`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                      }}
                    >
                      {loading ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>⚙</motion.div>
                      ) : (
                        `ESTABLISH UPLINK →`
                      )}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
