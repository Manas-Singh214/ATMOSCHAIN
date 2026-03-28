import { motion, AnimatePresence } from 'framer-motion';

export default function ResultModal({ isOpen, onClose, energy, credits }) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(2, 8, 23, 0.85)',
            backdropFilter: 'blur(10px)',
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: 'linear-gradient(135deg, #0d1117 0%, #0a1628 100%)',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              borderRadius: '20px',
              padding: '48px',
              maxWidth: '480px',
              width: '90%',
              textAlign: 'center',
              boxShadow: '0 0 60px rgba(0, 212, 255, 0.2), 0 0 120px rgba(0, 255, 136, 0.1)',
            }}>
            {/* Success icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 400 }}
              style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,255,136,0.2))',
                border: '2px solid rgba(0, 212, 255, 0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '36px', margin: '0 auto 24px',
              }}>
              ⚡
            </motion.div>

            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              style={{ fontSize: '26px', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
              Simulation Complete!
            </motion.h2>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              style={{ color: '#8892a4', marginBottom: '32px', fontSize: '14px' }}>
              Plasma reactor processed successfully
            </motion.p>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                style={{
                  background: 'rgba(0, 212, 255, 0.08)',
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                  borderRadius: '14px',
                  padding: '20px 16px',
                }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>⚡</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '22px', fontWeight: 700, color: '#00d4ff', marginBottom: '4px' }}>
                  {energy} kWh
                </div>
                <div style={{ fontSize: '12px', color: '#8892a4', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Energy Generated
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                style={{
                  background: 'rgba(0, 255, 136, 0.08)',
                  border: '1px solid rgba(0, 255, 136, 0.25)',
                  borderRadius: '14px',
                  padding: '20px 16px',
                }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>🌱</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '22px', fontWeight: 700, color: '#00ff88', marginBottom: '4px' }}>
                  {credits}
                </div>
                <div style={{ fontSize: '12px', color: '#8892a4', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Carbon Credits
                </div>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              style={{
                fontSize: '13px', color: '#00ff88',
                background: 'rgba(0, 255, 136, 0.08)',
                border: '1px solid rgba(0, 255, 136, 0.2)',
                borderRadius: '10px', padding: '10px 16px',
                marginBottom: '24px',
              }}>
              🌍 Credits added to your marketplace balance!
            </motion.div>

            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="btn-primary"
              style={{ width: '100%', fontSize: '16px', padding: '14px' }}>
              Close & Continue →
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
