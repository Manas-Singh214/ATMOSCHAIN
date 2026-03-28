import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const API = 'http://localhost:8000';
const EXCHANGE_RATE = 85.0; // 1 USD = 85 INR

const INITIAL = [
  { id: 1, seller: 'EcoFarm Industries',  credits: 100, price: 10.0, available: true },
  { id: 2, seller: 'GreenTech Corp',      credits: 50,  price: 12.5, available: true },
  { id: 3, seller: 'BioWaste Solutions',  credits: 200, price: 9.0,  available: true },
  { id: 4, seller: 'CleanEnergy Ltd',     credits: 75,  price: 11.0, available: true },
];

const MOCK_BOTS = [
  { name: 'AlphaCorp Bot', type: 'BUYER' },
  { name: 'EcoSystem Bot', type: 'SELLER' },
  { name: 'Global Offset', type: 'BUYER' },
  { name: 'GreenHouse AI', type: 'SELLER' },
];

const Lbl = ({ children, style = {} }) => {
  const { colors } = useTheme();
  return (
    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '11px',
      letterSpacing: '0.16em', textTransform: 'uppercase', color: colors.textMuted, ...style }}>
      {children}
    </div>
  );
};

export default function MarketplacePage() {
  const { userBalance, setUserBalance, userBudget, setUserBudget, userRevenue, setUserRevenue } = useApp();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  
  const [listings, setListings] = useState(INITIAL);
  const [buyQty, setBuyQty] = useState({});
  const [notification, setNotification] = useState(null);
  const [sellForm, setSellForm] = useState({ credits: '', price: '' });
  const [tab, setTab] = useState('buy');
  
  const [currency, setCurrency] = useState('USD');
  const [totalRevenueUSD, setTotalRevenueUSD] = useState(4850.50);
  const [recentTrades, setRecentTrades] = useState([
    { id: 0, text: "Genesis block mined — Market Opened", amount: 0, time: new Date().toLocaleTimeString() }
  ]);
  
  const [buyingContext, setBuyingContext] = useState(null);
  const [paymentState, setPaymentState] = useState('idle');

  // Need a ref for notification to use inside setTimeout safely
  const notifyRef = useRef(null);
  notifyRef.current = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3200);
  };

  useEffect(() => {
    fetch(`${API}/marketplace`)
      .then(r => r.ok ? r.json() : null)
      .then(d => d?.listings && setListings(d.listings))
      .catch(() => {});
  }, []);

  // Bot Trading Simulator (Randomized delays between 8s and 25s, realistic depletion)
  useEffect(() => {
    let timeoutId;
    const executeBotLogic = () => {
      timeoutId = setTimeout(() => {
        const type = Math.random() > 0.4 ? 'BUYER' : 'SELLER';
        const bot = MOCK_BOTS.filter(b => b.type === type)[Math.floor(Math.random() * 2)];

        if (type === 'BUYER') {
           setListings(prev => {
              const active = prev.filter(l => l.available);
              if (active.length > 0) {
                  // Pick random active listing
                  const target = active[Math.floor(Math.random() * active.length)];
                  const maxBuy = Math.min(target.credits, Math.floor(Math.random() * 25) + 5);
                  const cost = +(maxBuy * target.price).toFixed(2);
                  
                  const newListings = prev.map(l => {
                      if (l.id === target.id) {
                          return { ...l, credits: l.credits - maxBuy, available: (l.credits - maxBuy) > 0 };
                      }
                      return l;
                  });

                  setRecentTrades(t => [{id: Date.now(), text: `[BOT] ${bot.name} fulfilled order from ${target.seller}`, amount: maxBuy, price: target.price, total: cost, time: new Date().toLocaleTimeString()}, ...t].slice(0, 50));
                  setTotalRevenueUSD(r => +(r + cost).toFixed(2));
                  
                  // Alert Seller if they got bought!
                  if (target.seller === user?.company) {
                      setUserRevenue(r => r + cost);
                      if (notifyRef.current) notifyRef.current(`🚀 ALERT: ${bot.name} purchased ${maxBuy} of your listed CCTs for $${cost}!`, 'success');
                  }
                  return newListings;
              }
              return prev;
           });
        } else {
           // Seller Bot
           const amt = Math.floor(Math.random() * 80) + 20;
           const price = (Math.random() * 3 + 9).toFixed(2); // $9-$12
           
           setListings(p => [...p, { id: Date.now(), seller: bot.name, credits: amt, price: +price, available: true }]);
           setRecentTrades(t => [{id: Date.now(), text: `[BOT] ${bot.name} injected liquidity`, amount: amt, price: +price, total: +(amt*price).toFixed(2), time: new Date().toLocaleTimeString()}, ...t].slice(0, 50));
        }
        executeBotLogic();
      }, Math.random() * 17000 + 8000);
    };

    executeBotLogic();
    return () => clearTimeout(timeoutId);
  }, [user]);

  /* ----- Buying Workflow ----- */
  const initiateBuy = (listing) => {
    if (user?.role === 'Seller') return notifyRef.current("Sellers cannot buy credits on the market.", "error");
    
    const qty = buyQty[listing.id] || 1;
    if (qty <= 0 || qty > listing.credits) return notifyRef.current("Invalid quantity", "error");
    
    const cost = qty * listing.price;
    if (userBudget < cost) return notifyRef.current(`Insufficient USD budget ($${userBudget.toLocaleString()} available)`, "error");

    setBuyingContext({ listing, qty, cost });
    setPaymentState('processing');

    setTimeout(() => {
       setPaymentState('success');
       setTimeout(() => confirmBuy(listing, qty, cost), 1500);
    }, 2500);
  };

  const confirmBuy = async (listing, qty, cost) => {
    const localUpdate = () => {
      setListings(p => p.map(l =>
        l.id === listing.id ? { ...l, credits: l.credits - qty, available: l.credits - qty > 0 } : l));
      setUserBalance(p => p + qty);
      setUserBudget(p => p - cost);
      setTotalRevenueUSD(p => +(p + cost).toFixed(2));
      
      setRecentTrades(p => [
          { id: Date.now(), text: `[${user?.company || 'GUEST'}] Purchased CCTs`, amount: qty, price: listing.price, total: cost, time: new Date().toLocaleTimeString() },
          ...p
      ]);
      notifyRef.current(`✓ Secured ${qty} CCT from ${listing.seller} for $${cost.toLocaleString()}`);
      setBuyingContext(null);
      setPaymentState('idle');
    };
    try {
      const r = await fetch(`${API}/marketplace/buy`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: listing.id, quantity: qty }),
      });
      const d = await r.json();
      d.success ? localUpdate() : notifyRef.current(d.error, 'error');
    } catch { localUpdate(); }
  };

  /* ----- Selling Workflow ----- */
  const sellCredits = async () => {
    if (user?.role === 'Buyer') return notifyRef.current("Buyers cannot sell credits on the market.", "error");

    const seller = user?.company || 'Anonymous';
    const c = +sellForm.credits, p = +sellForm.price;
    if (!seller || c <= 0 || p <= 0) return notifyRef.current('Invalid values', 'error');
    if (c > userBalance) return notifyRef.current(`Insufficient credits (${userBalance} available)`, 'error');

    const add = (l) => {
      setListings(prev => [...prev, l]);
      setUserBalance(p2 => Math.max(0, p2 - c));
      notifyRef.current(`✓ Listed ${c} CCT at $${p} each`);
      setSellForm({ credits: '', price: '' });
      setRecentTrades(t => [{ id: Date.now(), text: `[${seller}] Placed sell order`, amount: c, price: p, total: c*p, time: new Date().toLocaleTimeString() }, ...t]);
    };
    try {
      const r = await fetch(`${API}/marketplace/sell`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seller, credits: c, price: p }),
      });
      const d = await r.json();
      d.success ? add(d.listing) : add({ id: Date.now(), seller, credits: c, price: p, available: true });
    } catch { add({ id: Date.now(), seller, credits: c, price: p, available: true }); }
  };

  /* ----- Dynamic Stats Payload Based on User Role ----- */
  const totalMarket = listings.reduce((a, l) => a + (l.available ? l.credits : 0), 0);
  const activeSellers = listings.filter(l => l.available).length;
  const avgPrice = listings.length ? (listings.reduce((a, l) => a + l.price, 0) / listings.length).toFixed(2) : '0.00';
  
  const revSymbol = currency === 'USD' ? '$' : '₹';
  const revAmount = (currency === 'USD' ? totalRevenueUSD : totalRevenueUSD * EXCHANGE_RATE).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let summaryStats = [];
  if (user?.role === 'Admin') {
     summaryStats = [
       { label: 'Network Revenue',   value: `${revSymbol}${revAmount}`, unit: currency === 'USD' ? 'USD' : 'INR', color: colors.orange, icon: '◉', isToggle: true },
       { label: 'Total Market Vol',  value: totalMarket,            unit: 'credits',  color: colors.cyan,   icon: '▣' },
       { label: 'Market Average',    value: `$${avgPrice}`,         unit: '/ CCT',   color: colors.green,  icon: '◈' },
       { label: 'Active Sellers',    value: activeSellers,          unit: 'Sellers',  color: colors.purple, icon: '⌬' },
     ];
  } else if (user?.role === 'Buyer') {
     summaryStats = [
       { label: 'Holdings (CCT)',   value: userBalance.toLocaleString('en-US', {maximumFractionDigits:2}), unit: 'credits attached', color: colors.green, icon: '◈' },
       { label: 'Operating Budget', value: `$${userBudget.toLocaleString('en-US')}`, unit: 'USD Available', color: colors.cyan, icon: '▣' },
       { label: 'Offset Target',    value: '450', unit: 'CCT Req', color: colors.orange, icon: '◉' },
       { label: 'Market Average',   value: `$${avgPrice}`, unit: '/ CCT Eval', color: colors.purple, icon: '⌬' },
     ];
  } else {
     // Seller or Guest 
     summaryStats = [
       { label: 'Unlisted CCTs',   value: userBalance.toLocaleString('en-US', {maximumFractionDigits:2}), unit: 'credits attached', color: colors.green, icon: '◈' },
       { label: 'Earned Revenue',  value: `$${userRevenue.toLocaleString('en-US', {minimumFractionDigits: 2})}`, unit: 'USD Total', color: colors.orange, icon: '◉' },
       { label: 'Active Listings', value: listings.filter(l => l.seller === user?.company && l.available).length, unit: 'Orders', color: colors.cyan, icon: '▣' },
       { label: 'Market Average',  value: `$${avgPrice}`, unit: '/ CCT Eval', color: colors.purple, icon: '⌬' },
     ];
  }

  const panelStyle = { background: colors.bgPanel, backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', transition: 'background 0.3s' };
  const cardStyle = { background: colors.bgCard, border: `1px solid ${colors.border}`, borderRadius: '8px', boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 2px 12px rgba(0,60,120,0.08)', transition: 'all 0.3s' };

  return (
    <div style={{ minHeight: '100vh', paddingTop: '60px', display: 'flex', flexDirection: 'column', position: 'relative' }}>

      {/* Payment Overlay Modal */}
      <AnimatePresence>
          {buyingContext && (
              <motion.div 
                 initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                 style={{
                     position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                     background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                     zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'
                 }}>
                 <motion.div 
                    initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                    style={{
                        background: colors.bgCard, border: `2px solid ${paymentState === 'success' ? colors.green : colors.cyan}`,
                        borderRadius: '16px', padding: '40px', maxWidth: '440px', width: '100%', textAlign: 'center',
                        boxShadow: `0 0 60px ${paymentState === 'success' ? colors.green : colors.cyan}33`,
                    }}>
                    
                    <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '12px', color: colors.textMuted, letterSpacing: '0.2em', marginBottom: '30px' }}>
                        SECURE TRANSACTION GATEWAY
                    </div>

                    <div style={{ fontSize: '48px', marginBottom: '20px' }}>
                        {paymentState === 'processing' ? (
                             <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block', color: colors.cyan }}>
                                 ⟳
                             </motion.div>
                        ) : (
                             <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ color: colors.green }}>
                                 ✓
                             </motion.div>
                        )}
                    </div>

                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '20px', fontWeight: 800, color: colors.textPrimary, marginBottom: '10px' }}>
                        {paymentState === 'processing' ? 'PROCESSING PAYMENT...' : 'TRANSACTION COMPLETE'}
                    </div>

                    <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', color: colors.textBody, marginBottom: '30px', lineHeight: 1.6 }}>
                        {paymentState === 'processing' 
                            ? `Authorizing purchase of ${buyingContext.qty} CCT from ${buyingContext.listing.seller} for $${buyingContext.cost.toLocaleString('en-US', {minimumFractionDigits: 2})}. Deducting from Operating Budget.` 
                            : `Credits successfully transferred to your atmospheric wallet. Blockchain ledger updated.`}
                    </div>

                    <div style={{ height: '4px', background: `${colors.cyan}22`, borderRadius: '4px', overflow: 'hidden', marginBottom: '30px' }}>
                        <motion.div 
                           initial={{ width: 0 }} animate={{ width: paymentState === 'success' ? '100%' : '75%' }} 
                           transition={{ duration: paymentState === 'success' ? 0.3 : 2 }}
                           style={{ height: '100%', background: paymentState === 'success' ? colors.green : colors.cyan }} 
                        />
                    </div>
                 </motion.div>
              </motion.div>
          )}
      </AnimatePresence>

      <div className="page-header">
        <h2 style={{ color: colors.green, transition: 'color 0.3s' }}>▣ CCT MARKETPLACE</h2>
        <Lbl>MODULE 3 · CARBON CREDIT TRADING LEDGER</Lbl>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontFamily: 'Share Tech Mono', fontSize: '12px', color: colors.cyan, marginRight: '16px', background: `${colors.cyan}22`, padding: '4px 10px', borderRadius: '4px' }}>
             OPERATOR: {user?.role || 'GUEST'}
          </span>
          <span style={{ width: '7px', height: '7px', background: colors.green, borderRadius: '50%', display: 'inline-block', boxShadow: `0 0 8px ${colors.green}` }} className="pulse-neon" />
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '11px', color: colors.green, letterSpacing: '0.1em' }}>
            MARKET LIVE
          </span>
        </div>
      </div>

      <div style={{ ...panelStyle, flex: 1, padding: '30px 44px', overflowY: 'auto' }}>
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '34px' }}>
          {summaryStats.map((stat, i) => (
            <motion.div key={i}
              whileHover={{ y: -3, boxShadow: isDark ? `0 8px 30px rgba(0,0,0,0.5)` : `0 6px 24px rgba(0,60,120,0.12)` }}
              transition={{ duration: 0.18 }}
              style={{ ...cardStyle, padding: '22px 24px', position: 'relative' }}>
              
              {stat.isToggle && (
                 <button 
                   onClick={() => setCurrency(c => c === 'USD' ? 'INR' : 'USD')}
                   style={{ position: 'absolute', top: '20px', right: '20px', background: `${colors.orange}22`, border: `1px solid ${colors.orange}55`, color: colors.orange, borderRadius: '4px', padding: '4px 10px', fontSize: '10px', fontFamily: 'Share Tech Mono', cursor: 'pointer', transition: 'all 0.2s', zIndex: 10 }}>
                   ⇌ SWITCH {currency === 'USD' ? 'INR' : 'USD'}
                 </button>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                <Lbl>{stat.label}</Lbl>
                <span style={{ fontSize: '18px', color: stat.color, opacity: 0.75, lineHeight: 1 }}>{stat.icon}</span>
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '30px', fontWeight: 700, color: stat.color, lineHeight: 1.0, textShadow: isDark ? `0 0 18px ${stat.color}44` : 'none' }}>
                {stat.value}
              </div>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: '11px', color: colors.textMuted, letterSpacing: '0.1em', marginTop: '6px' }}>{stat.unit}</div>
            </motion.div>
          ))}
        </motion.div>

        <div style={{ display: 'flex', gap: '3px', marginBottom: '26px', padding: '5px', background: colors.bgCard, borderRadius: '8px', width: 'fit-content', border: `1px solid ${colors.border}`, boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,60,120,0.06)' }}>
          {[{ key: 'buy', label: '↓ MARKET BOARD (BUY)' }, { key: 'sell', label: '↑ NEW LISTING (SELL)' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              padding: '10px 26px', borderRadius: '6px', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              background: tab === t.key ? colors.cyanBg : 'transparent',
              color: tab === t.key ? colors.textPrimary : colors.textMuted,
              fontFamily: 'Orbitron, monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em',
              boxShadow: tab === t.key ? (isDark ? '0 0 14px rgba(0,229,255,0.15)' : '0 0 8px rgba(0,95,170,0.1)') : 'none',
            }}>{t.label}</button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: user?.role === 'Admin' ? '1fr 350px' : '1fr', gap: '26px' }}>
          <AnimatePresence mode="wait">
            {/* BUY TAB */}
            {tab === 'buy' && (
              <motion.div key="buy" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div style={{ ...cardStyle, overflow: 'hidden' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Seller Entity</th>
                        <th>Available Volume</th>
                        <th>Price / CCT</th>
                        <th>Total Liquid Value</th>
                        <th>Status</th>
                        <th style={{ width: '100px' }}>Request Qty</th>
                        <th style={{ width: '110px' }}>Action execution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listings.map((listing, i) => (
                        <motion.tr key={listing.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '7px', flexShrink: 0, background: `linear-gradient(135deg, ${colors.cyanBg}, ${colors.greenBg})`, border: `1px solid ${colors.cyanBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>
                                🏭
                              </div>
                              <span style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 600, color: colors.textPrimary }}>
                                {listing.seller}
                                {listing.seller === user?.company && <span style={{fontSize: '10px', marginLeft: '6px', color: colors.cyan, border: `1px solid ${colors.cyan}`, padding: '1px 4px', borderRadius: '4px'}}>YOU</span>}
                              </span>
                            </div>
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '15px', color: colors.cyan, fontWeight: 700 }}>
                            {Math.round(listing.credits)}
                            <span style={{ fontFamily: 'Share Tech Mono', fontSize: '11px', color: colors.textMuted, marginLeft: '5px' }}>CCT</span>
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '15px', color: colors.green, fontWeight: 700 }}>
                            ${listing.price.toFixed(2)}
                          </td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '14px', color: colors.orange }}>
                            ${(listing.credits * listing.price).toFixed(2)}
                          </td>
                          <td>
                            <span className={listing.available ? 'badge badge-green' : 'badge badge-red'}>{listing.available ? '● LIVE' : '✕ SOLD OUT'}</span>
                          </td>
                          <td>
                            <input className="neon-input" type="number" value={buyQty[listing.id] || 1} min="1" max={listing.credits}
                              onChange={e => setBuyQty(p => ({ ...p, [listing.id]: +e.target.value }))}
                              style={{ width: '85px', padding: '8px 12px', fontSize: '14px', background: !listing.available || user?.role === 'Seller' ? 'rgba(0,0,0,0.2)' : 'var(--bg-input)' }}
                              disabled={!listing.available || user?.role === 'Seller'} />
                          </td>
                          <td>
                            <button className="btn-primary" onClick={() => initiateBuy(listing)}
                              disabled={!listing.available || user?.role === 'Seller'}
                              style={{ padding: '9px 20px', fontSize: '10px', background: !listing.available || user?.role==='Seller' ? 'transparent' : '' }}>
                              BUY
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {/* SELL TAB */}
            {tab === 'sell' && (
              <motion.div key="sell" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '440px 1fr', gap: '26px' }}>
                  <div style={{ ...cardStyle, padding: '30px 28px' }}>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '14px', fontWeight: 700, color: colors.cyan, letterSpacing: '0.1em', marginBottom: '26px' }}>
                      ↑ CREATE NEW LISTING
                    </div>
                    
                    {user?.role === 'Buyer' ? (
                       <div style={{ padding: '20px', border: `1px solid ${colors.red}55`, background: 'rgba(255,69,105,0.07)', color: colors.red, borderRadius: '8px', lineHeight: 1.6, fontFamily: 'Space Grotesk', fontSize: '14px' }}>
                         <strong>Access Denied:</strong> Buyer roles cannot originate carbon credits into the market ecosystem. Protocol strictly enforces generation signatures via WasteVision → Plasma Reactor paths restricted to Seller entities.
                       </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                          <Lbl style={{ marginBottom: '9px', display: 'block' }}>Credits to List</Lbl>
                          <input className="neon-input" type="number" placeholder="e.g. 50" value={sellForm.credits}
                            onChange={e => setSellForm(f => ({ ...f, credits: e.target.value }))} min="1" max={userBalance} />
                          <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '13px', color: colors.textMuted, marginTop: '8px' }}>
                            Your wallet bounds: <span style={{ color: colors.green, fontWeight: 600 }}>{userBalance.toFixed(2)} CCT</span> available to list.
                          </div>
                        </div>
                        <div>
                          <Lbl style={{ marginBottom: '9px', display: 'block' }}>Price per Credit ($)</Lbl>
                          <input className="neon-input" type="number" placeholder="e.g. 11.00" value={sellForm.price}
                            onChange={e => setSellForm(f => ({ ...f, price: e.target.value }))} min="0.01" step="0.01" />
                        </div>
                        {sellForm.credits && sellForm.price && (
                          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: colors.greenBg, border: `1px solid ${colors.greenBorder}`, borderRadius: '6px', padding: '16px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Lbl style={{ color: colors.green }}>PREDICTED VALUE</Lbl>
                            <span style={{ fontFamily: 'JetBrains Mono', fontSize: '22px', fontWeight: 700, color: colors.green }}>
                              ${(+sellForm.credits * +sellForm.price).toFixed(2)}
                            </span>
                          </motion.div>
                        )}
                        <button className="btn-green" onClick={sellCredits} style={{ padding: '15px', fontSize: '11px' }}>
                          ↑ LIST CREDITS ON NETWORK
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '12px', color: colors.textMuted, letterSpacing: '0.1em', marginBottom: '18px', textTransform: 'uppercase' }}>
                      Active Network Listings ({listings.length})
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {listings.slice().reverse().map(l => (
                        <motion.div key={l.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} style={{ ...cardStyle, padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '15px', fontWeight: 600, color: colors.textPrimary, marginBottom: '4px' }}>
                                {l.seller} {l.seller === user?.company && <span style={{fontSize: '9px', color: colors.cyan, marginLeft: '6px'}}>(YOU)</span>}
                            </div>
                            <div style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: colors.textMuted }}>{Math.round(l.credits)} CCT @ ${l.price}/ea</div>
                          </div>
                          <span className={`badge ${l.available ? 'badge-green' : 'badge-red'}`}>
                            {l.available ? '● LIVE' : '✕ CLOSED'}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {/* Admin Sidebar Feed */}
          {user?.role === 'Admin' && (
             <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
               <div style={{ ...cardStyle, height: '100%', maxHeight: '600px', display: 'flex', flexDirection: 'column', background: colors.navBg }}>
                 <div style={{ padding: '20px 24px', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: colors.bgPanel }}>
                   <div style={{ fontFamily: 'Orbitron, monospace', fontSize: '13px', color: colors.purple, fontWeight: 700, letterSpacing: '0.1em' }}>
                     NETWORK ACTIVITY
                   </div>
                   <div className="pulse-neon" style={{ width: '8px', height: '8px', background: colors.purple, borderRadius: '50%' }}></div>
                 </div>
                 <div style={{ padding: '14px 24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <AnimatePresence>
                      {recentTrades.map((trade) => (
                         <motion.div 
                            key={trade.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            style={{ paddingBottom: '14px', borderBottom: `1px dashed ${colors.divider}` }}
                         >
                            <div style={{ fontFamily: 'Share Tech Mono', fontSize: '11px', color: colors.textMuted, marginBottom: '6px' }}>
                               {trade.time} — BLOCKCHAIN
                            </div>
                            <div style={{ fontFamily: 'Space Grotesk', fontSize: '14px', color: colors.textPrimary, marginBottom: '4px' }}>
                               {trade.text}
                            </div>
                            {trade.amount > 0 && (
                                <div style={{ fontFamily: 'JetBrains Mono', fontSize: '13px', color: colors.cyan }}>
                                   {trade.amount} CCT @ ${trade.price} ≈ <span style={{ color: colors.green }}>${trade.total.toLocaleString()}</span>
                                </div>
                            )}
                         </motion.div>
                      ))}
                    </AnimatePresence>
                 </div>
               </div>
             </motion.div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 40, x: '-50%' }}
            animate={{ opacity: 1, y: 0,  x: '-50%' }}
            exit={{ opacity: 0, y: 40 }}
            style={{ position: 'fixed', bottom: '28px', left: '50%', background: colors.bgCard, border: `1px solid ${notification.type === 'error' ? colors.red : colors.green}88`, color: notification.type === 'error' ? colors.red : colors.green, fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: '14px', padding: '13px 26px', borderRadius: '8px', zIndex: 500, boxShadow: isDark ? '0 8px 30px rgba(0,0,0,0.4)' : '0 8px 24px rgba(0,60,120,0.15)', backdropFilter: 'blur(24px)', display: 'flex', alignItems: 'center', gap: '9px', whiteSpace: 'nowrap' }}>
            {notification.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
