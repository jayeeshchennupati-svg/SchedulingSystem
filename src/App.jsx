import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Crown, Mail, Lock, KeyRound, LogOut, Users, Clock, CheckCircle2, Pause, Play, Calendar, Download, GripVertical, Plus, AlertCircle, Settings, ChevronRight, Shield, X, Info, BarChart3, FileDown, Trash2, RefreshCw } from 'lucide-react';
import emailjs from '@emailjs/browser';
import { db, doc, onSnapshot, setDoc, getDoc } from './firebase';

// ============ STORAGE HELPERS ============
const SK = {
  USERS: 'mq:users',
  QUEUE: 'mq:queue',
  CURRENT: 'mq:current',
  HISTORY: 'mq:history',
  MORATORIUM: 'mq:moratorium',
  DOMAINS: 'mq:domains',
  SESSION: 'mq:session',
  OTPS: 'mq:otps',
  DELAYED: 'mq:delayed',
  NEXT_ALERTED: 'mq:next_alerted',
  EMAIL_LOG: 'mq:email_log',
};

const STATE_DOC = 'queueApp/mainState';

const sget = async (k, def = null) => {
  try {
    if (db) {
      const snap = await getDoc(doc(db, STATE_DOC));
      if (snap.exists() && snap.data()[k] !== undefined) {
        return snap.data()[k];
      }
      return def;
    }
    if (window?.storage?.get) {
      const r = await window.storage.get(k, true);
      return r ? JSON.parse(r.value) : def;
    }
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) : def;
  } catch { return def; }
};
const sset = async (k, v) => {
  try {
    if (db) {
      await setDoc(doc(db, STATE_DOC), { [k]: v }, { merge: true });
      return;
    }
    if (window?.storage?.set) {
      await window.storage.set(k, JSON.stringify(v), true);
      return;
    }
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
};

const formatMinutes = (mins) => {
  const rounded = Math.max(0, Math.round(mins));
  if (rounded < 60) return `${rounded} minutes`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
};

const getRemainingCurrentMinutes = (current) => {
  if (!current) return 0;
  const startedAt = current.calledAt ? new Date(current.calledAt).getTime() : Date.now();
  const elapsed = (Date.now() - startedAt) / 60000;
  return Math.max(0, (current.duration || 0) - elapsed);
};

const estimateWaitMinutes = (queue, current, targetIndex) => {
  const beforeMins = queue.slice(0, targetIndex).reduce((sum, item) => sum + (item.duration || 0), 0);
  return beforeMins + getRemainingCurrentMinutes(current);
};

const sendEmail = async ({ to, subject, body, push }) => {
  try {
    const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
    const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
    const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;
    
    if (serviceId && serviceId !== 'your-emailjs-service-id') {
      await emailjs.send(serviceId, templateId, {
        to_email: to,
        subject: subject,
        message: body
      }, { publicKey });
      return true;
    } else {
      console.warn("EmailJS is not configured.");
      if (push) push('EmailJS configuration missing. Email failed.', 'error');
      return false;
    }
  } catch (e) {
    console.error("EmailJS Error", e);
    if (push) {
      push(`EmailJS Error: ${e.text || e.message || 'Check console'}`, 'error');
    }
    return false;
  }
};

// ============ SEED DATA ============
const seedIfEmpty = async () => {
  const users = await sget(SK.USERS, null);
  if (!users) {
    await sset(SK.USERS, [
      { id: 'admin', email: 'admin@powermech.net', password: 'admin@P0wer', name: 'Executive Assistant', role: 'EA', verified: true },
      { id: 'pres', email: 'president@queue.local', password: 'ChangeMePres123!', name: 'The President', role: 'PRESIDENT', verified: true },
    ]);
  }
  const domains = await sget(SK.DOMAINS, null);
  if (!domains) await sset(SK.DOMAINS, ['queue.local']);
  if ((await sget(SK.QUEUE, null)) === null) await sset(SK.QUEUE, []);
  if ((await sget(SK.HISTORY, null)) === null) await sset(SK.HISTORY, []);
  if ((await sget(SK.DELAYED, null)) === null) await sset(SK.DELAYED, []);
};

// ============ DESIGN TOKENS ============
const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  :root {
    --bg-deepest: #0a0d14;
    --bg-deep: #0f1320;
    --bg-card: #161b2c;
    --bg-elevated: #1d2438;
    --bg-hover: #242c44;
    --border: rgba(212, 175, 55, 0.15);
    --border-strong: rgba(212, 175, 55, 0.35);
    --gold: #d4af37;
    --gold-bright: #f0c75e;
    --gold-dim: #8a7128;
    --ivory: #f5f1e8;
    --text-primary: #f5f1e8;
    --text-secondary: #a8a496;
    --text-tertiary: #6b6858;
    --crimson: #c54545;
    --emerald: #4a8c5e;
    --slate: #4a5878;
  }

  * { box-sizing: border-box; }
  html, body, #root { margin: 0; padding: 0; min-height: 100vh; background: var(--bg-deepest); }
  body { font-family: 'Outfit', sans-serif; color: var(--text-primary); }

  .mq-app {
    min-height: 100vh;
    background:
      radial-gradient(ellipse at top left, rgba(212, 175, 55, 0.08) 0%, transparent 50%),
      radial-gradient(ellipse at bottom right, rgba(74, 88, 120, 0.1) 0%, transparent 50%),
      linear-gradient(180deg, #0a0d14 0%, #0f1320 100%);
    background-attachment: fixed;
    color: var(--text-primary);
    font-family: 'Outfit', sans-serif;
  }

  .mq-grain::before {
    content: '';
    position: fixed; inset: 0; pointer-events: none; z-index: 1;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.4'/%3E%3C/svg%3E");
    opacity: 0.04;
  }

  .mq-display { font-family: 'Cormorant Garamond', serif; font-weight: 500; letter-spacing: -0.02em; }
  .mq-mono { font-family: 'JetBrains Mono', monospace; }

  .mq-card {
    background: linear-gradient(180deg, var(--bg-card) 0%, var(--bg-deep) 100%);
    border: 1px solid var(--border);
    border-radius: 4px;
    position: relative;
  }
  .mq-card-elevated {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: 4px;
  }

  .mq-btn {
    font-family: 'Outfit', sans-serif;
    font-weight: 500;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-size: 0.75rem;
    padding: 0.75rem 1.5rem;
    border-radius: 2px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex; align-items: center; gap: 0.5rem;
    white-space: nowrap;
  }
  .mq-btn-gold {
    background: linear-gradient(180deg, var(--gold-bright) 0%, var(--gold) 100%);
    color: #0a0d14;
    border-color: var(--gold);
    box-shadow: 0 4px 14px rgba(212, 175, 55, 0.25);
  }
  .mq-btn-gold:hover { background: var(--gold-bright); transform: translateY(-1px); box-shadow: 0 6px 20px rgba(212, 175, 55, 0.35); }
  .mq-btn-ghost {
    background: transparent; color: var(--text-primary); border-color: var(--border-strong);
  }
  .mq-btn-ghost:hover { background: var(--bg-hover); border-color: var(--gold); }
  .mq-btn-danger {
    background: transparent; color: var(--crimson); border-color: rgba(197, 69, 69, 0.4);
  }
  .mq-btn-danger:hover { background: rgba(197, 69, 69, 0.1); }

  .mq-input {
    width: 100%;
    background: var(--bg-deepest);
    border: 1px solid var(--border);
    border-radius: 2px;
    padding: 0.85rem 1rem;
    color: var(--text-primary);
    font-family: 'Outfit', sans-serif;
    font-size: 0.95rem;
    transition: border-color 0.2s;
  }
  .mq-input:focus {
    outline: none; border-color: var(--gold);
    box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.1);
  }
  .mq-input::placeholder { color: var(--text-tertiary); }
  textarea.mq-input { resize: vertical; min-height: 100px; }

  .mq-label {
    display: block;
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--gold);
    margin-bottom: 0.5rem;
  }

  .mq-divider-ornament {
    display: flex; align-items: center; justify-content: center; gap: 0.75rem; color: var(--gold); margin: 1rem 0;
  }
  .mq-divider-ornament::before, .mq-divider-ornament::after {
    content: ''; flex: 1; height: 1px;
    background: linear-gradient(90deg, transparent, var(--border-strong), transparent);
  }

  .mq-tile {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 3px;
    padding: 1rem 1.25rem;
    transition: all 0.25s ease;
    cursor: grab;
    display: flex; align-items: center; gap: 1rem;
  }
  .mq-tile:hover { border-color: var(--border-strong); background: var(--bg-elevated); }
  .mq-tile.dragging { opacity: 0.4; cursor: grabbing; }
  .mq-tile.drag-over { border-color: var(--gold); background: var(--bg-hover); }
  .mq-tile.delayed-tile { border-left: 3px solid var(--crimson); }

  .mq-pos-badge {
    width: 38px; height: 38px;
    display: flex; align-items: center; justify-content: center;
    border: 1px solid var(--gold);
    border-radius: 50%;
    color: var(--gold);
    font-family: 'Outfit', sans-serif;
    font-size: 1.25rem; font-weight: 600;
    flex-shrink: 0;
  }
  .mq-pos-badge.current {
    background: var(--gold); color: #0a0d14;
    box-shadow: 0 0 20px rgba(212, 175, 55, 0.5);
  }

  .mq-tab {
    padding: 0.75rem 1.25rem;
    color: var(--text-secondary);
    font-size: 0.85rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    background: none; border-left: none; border-right: none; border-top: none;
    font-family: 'Outfit', sans-serif;
  }
  .mq-tab:hover { color: var(--text-primary); }
  .mq-tab.active { color: var(--gold); border-bottom-color: var(--gold); }

  .mq-stat-num { font-family: 'Outfit', sans-serif; font-size: 2.75rem; font-weight: 600; line-height: 1; color: var(--gold); }
  .mq-stat-label { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-secondary); margin-top: 0.5rem; }

  @keyframes mq-fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .mq-fade { animation: mq-fade-in 0.4s ease both; }

  @keyframes mq-pulse-gold {
    0%, 100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.4); }
    50% { box-shadow: 0 0 0 12px rgba(212, 175, 55, 0); }
  }
  .mq-pulse { animation: mq-pulse-gold 2s infinite; }

  .mq-toast {
    position: fixed; top: 24px; right: 24px; z-index: 100;
    background: var(--bg-elevated);
    border: 1px solid var(--border-strong);
    border-left: 3px solid var(--gold);
    padding: 1rem 1.25rem;
    border-radius: 3px;
    max-width: 380px;
    box-shadow: 0 12px 40px rgba(0,0,0,0.5);
    animation: mq-fade-in 0.3s ease both;
  }
  .mq-toast.error { border-left-color: var(--crimson); }
  .mq-toast.success { border-left-color: var(--emerald); }

  .mq-modal-bg {
    position: fixed; inset: 0; z-index: 200;
    background: rgba(10, 13, 20, 0.85);
    backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: 1.5rem;
  }
  .mq-modal {
    background: var(--bg-card);
    border: 1px solid var(--border-strong);
    border-radius: 4px;
    max-width: 520px; width: 100%;
    max-height: 90vh; overflow-y: auto;
    box-shadow: 0 30px 80px rgba(0,0,0,0.7);
  }

  .mq-link {
    color: var(--gold); cursor: pointer; text-decoration: none;
    font-size: 0.85rem;
    transition: color 0.2s;
  }
  .mq-link:hover { color: var(--gold-bright); text-decoration: underline; }

  .mq-corner {
    position: absolute; width: 14px; height: 14px;
    border-color: var(--gold); border-style: solid; border-width: 0;
  }
  .mq-corner.tl { top: -1px; left: -1px; border-top-width: 1px; border-left-width: 1px; }
  .mq-corner.tr { top: -1px; right: -1px; border-top-width: 1px; border-right-width: 1px; }
  .mq-corner.bl { bottom: -1px; left: -1px; border-bottom-width: 1px; border-left-width: 1px; }
  .mq-corner.br { bottom: -1px; right: -1px; border-bottom-width: 1px; border-right-width: 1px; }

  .mq-table { width: 100%; border-collapse: collapse; }
  .mq-table th {
    text-align: left; font-size: 0.7rem;
    text-transform: uppercase; letter-spacing: 0.1em;
    color: var(--gold); font-weight: 500;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border-strong);
  }
  .mq-table td {
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--border);
    font-size: 0.9rem;
    color: var(--text-primary);
  }
  .mq-table tr:hover td { background: var(--bg-elevated); }

  .mq-chip {
    display: inline-block; padding: 0.2rem 0.6rem;
    font-size: 0.7rem; text-transform: uppercase;
    letter-spacing: 0.08em; border-radius: 2px;
    border: 1px solid var(--border-strong);
    color: var(--text-secondary);
  }
  .mq-chip.gold { color: var(--gold); border-color: var(--gold); }
  .mq-chip.crimson { color: var(--crimson); border-color: rgba(197, 69, 69, 0.5); }
  .mq-chip.emerald { color: var(--emerald); border-color: rgba(74, 140, 94, 0.5); }

  .mq-otp-input {
    width: 50px; height: 60px;
    text-align: center;
    font-size: 1.5rem;
    font-family: 'Outfit', sans-serif;
    font-weight: 600;
    background: var(--bg-deepest);
    border: 1px solid var(--border);
    border-radius: 3px;
    color: var(--gold);
  }
  .mq-otp-input:focus { outline: none; border-color: var(--gold); }

  .mq-banner {
    background: linear-gradient(90deg, rgba(197, 69, 69, 0.15), rgba(197, 69, 69, 0.05));
    border: 1px solid rgba(197, 69, 69, 0.4);
    border-left: 4px solid var(--crimson);
    padding: 1rem 1.25rem;
    border-radius: 3px;
    display: flex; align-items: center; gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .mq-section-title {
    font-family: 'Cormorant Garamond', serif;
    font-size: 1.75rem;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: var(--ivory);
    margin: 0 0 0.25rem 0;
  }
  .mq-section-sub {
    color: var(--text-secondary);
    font-size: 0.85rem;
    margin: 0 0 1.5rem 0;
  }

  ::-webkit-scrollbar { width: 8px; height: 8px; }
  ::-webkit-scrollbar-track { background: var(--bg-deepest); }
  ::-webkit-scrollbar-thumb { background: var(--bg-elevated); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--border-strong); }
  .mq-wheel::-webkit-scrollbar { display: none; }
`;

// ============ TOAST SYSTEM ============
function useToasts() {
  const [toasts, setToasts] = useState([]);
  const push = (msg, kind = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };
  return { toasts, push };
}

const ToastStack = ({ toasts }) => (
  <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 8 }}>
    {toasts.map(t => (
      <div key={t.id} className={`mq-toast ${t.kind}`} style={{ position: 'relative', top: 0, right: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          {t.kind === 'success' ? <CheckCircle2 size={18} color="var(--emerald)" /> :
           t.kind === 'error' ? <AlertCircle size={18} color="var(--crimson)" /> :
           <Info size={18} color="var(--gold)" />}
          <div style={{ fontSize: '0.9rem', lineHeight: 1.4 }}>{t.msg}</div>
        </div>
      </div>
    ))}
  </div>
);

// ============ UI COMPONENTS ============
function WheelColumn({ items, value, onChange }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (ref.current) {
      const idx = items.indexOf(value);
      if (idx !== -1) {
        ref.current.scrollTop = idx * 40;
      }
    }
  }, [value, items]);

  const handleScroll = (e) => {
    const el = e.target;
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      const idx = Math.round(el.scrollTop / 40);
      if (items[idx] && items[idx] !== value) onChange(items[idx]);
    }, 100);
  };

  return (
    <div ref={ref} onScroll={handleScroll} className="mq-wheel" style={{ height: 120, overflowY: 'scroll', scrollSnapType: 'y mandatory', scrollbarWidth: 'none', position: 'relative' }}>
      <div style={{ height: 40 }} />
      {items.map(it => (
        <div key={it} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', scrollSnapAlign: 'center', fontSize: it === value ? '1.5rem' : '1.1rem', color: it === value ? 'var(--gold)' : 'var(--text-tertiary)', fontWeight: it === value ? 600 : 400, transition: 'all 0.2s', cursor: 'pointer' }} onClick={() => onChange(it)}>
          {it}
        </div>
      ))}
      <div style={{ height: 40 }} />
    </div>
  );
}

function WheelTimePicker({ value, onChange }) {
  const defaultVal = value || '12:00';
  const [h24, m] = defaultVal.split(':');
  const isPm = parseInt(h24) >= 12;
  const h12 = (parseInt(h24) % 12) || 12;
  
  const hStr = String(h12).padStart(2, '0');
  const mStr = String(m).padStart(2, '0');
  const ampm = isPm ? 'PM' : 'AM';

  const hours = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
  const periods = ['AM', 'PM'];

  const update = (newH, newM, newP) => {
    let h = parseInt(newH);
    if (newP === 'PM' && h < 12) h += 12;
    if (newP === 'AM' && h === 12) h = 0;
    onChange(`${String(h).padStart(2, '0')}:${newM}`);
  };

  useEffect(() => {
    if (!value) onChange('12:00');
  }, [value, onChange]);

  return (
    <div style={{ display: 'flex', gap: 10, background: 'var(--bg-deepest)', border: '1px solid var(--border)', borderRadius: 4, padding: '10px 0', justifyContent: 'center', position: 'relative' }}>
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 40, marginTop: -20, background: 'rgba(212, 175, 55, 0.05)', pointerEvents: 'none', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }} />
      <WheelColumn items={hours} value={hStr} onChange={v => update(v, mStr, ampm)} />
      <div style={{ display: 'flex', alignItems: 'center', color: 'var(--gold)', fontWeight: 600, zIndex: 1 }}>:</div>
      <WheelColumn items={minutes} value={mStr} onChange={v => update(hStr, v, ampm)} />
      <div style={{ width: 10 }} />
      <WheelColumn items={periods} value={ampm} onChange={v => update(hStr, mStr, v)} />
    </div>
  );
}

// ============ AUTH SCREENS ============
const Brand = ({ size = 'lg' }) => (
  <div style={{ textAlign: 'center', marginBottom: size === 'lg' ? 32 : 16 }}>
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
      <Crown size={size === 'lg' ? 32 : 22} color="var(--gold)" strokeWidth={1.5} />
      <div className="mq-display" style={{ fontSize: size === 'lg' ? '2rem' : '1.4rem', color: 'var(--ivory)', fontWeight: 600 }}>
        The Antechamber
      </div>
    </div>
    {size === 'lg' && (
      <>
        <div className="mq-divider-ornament" style={{ maxWidth: 280, margin: '0 auto 8px' }}>
          <div style={{ fontSize: '0.65rem', letterSpacing: '0.3em', textTransform: 'uppercase' }}>◆</div>
        </div>
        <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
          Audience with the President
        </div>
      </>
    )}
  </div>
);

function AuthScreen({ onLogin, push, onUsersChanged }) {
  const [mode, setMode] = useState('login'); // login | signup | forgot | otp
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [pendingOtp, setPendingOtp] = useState('');
  const [otpFor, setOtpFor] = useState(null); // 'signup' | 'forgot'
  const [newPwd, setNewPwd] = useState('');
  const [domains, setDomains] = useState([]);

  useEffect(() => { sget(SK.DOMAINS, []).then(setDomains); }, [mode]);

  const isAllowedDomain = (mail) => {
    const d = mail.split('@')[1]?.toLowerCase();
    return d && domains.includes(d);
  };

  const handleLogin = async () => {
    const users = await sget(SK.USERS, []);
    const u = users.find(x => x.email.toLowerCase() === email.toLowerCase() && x.password === password);
    if (!u) return push('Invalid credentials.', 'error');
    if (!u.verified) return push('Account not verified.', 'error');
    await sset(SK.SESSION, { id: u.id, email: u.email, role: u.role, name: u.name });
    onLogin(u);
  };

  const sendOtp = async (purpose) => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setPendingOtp(code);
    setOtpFor(purpose);
    setMode('otp');
    await sendEmail({
      to: email,
      subject: 'Your verification code',
      body: `Your OTP is ${code}. It expires after one use.`,
      push,
    });
    push('OTP has been sent to your email.', 'success');
  };

  const handleSignup = async () => {
    if (!email || !password || !name) return push('All fields required.', 'error');
    if (!isAllowedDomain(email)) return push(`Email domain not permitted. Allowed: ${domains.join(', ')}`, 'error');
    const users = await sget(SK.USERS, []);
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) return push('Email already registered.', 'error');
    await sendOtp('signup');
  };

  const handleForgot = async () => {
    if (!email) return push('Enter your email.', 'error');
    const users = await sget(SK.USERS, []);
    if (!users.some(u => u.email.toLowerCase() === email.toLowerCase())) return push('No account found.', 'error');
    await sendOtp('forgot');
  };

  const verifyOtp = async () => {
    if (otp !== pendingOtp) return push('Incorrect OTP.', 'error');
    const users = await sget(SK.USERS, []);
    if (otpFor === 'signup') {
      const newUser = {
        id: 'u_' + Date.now(),
        email, password, name,
        role: 'EMPLOYEE',
        verified: true,
      };
      await sset(SK.USERS, [...users, newUser]);
      await sendEmail({
        to: email,
        subject: 'Account created successfully',
        body: `Welcome ${name}. Your account has been created and verified.`,
        push,
      });
      onUsersChanged?.();
      push('Account created. Please sign in.', 'success');
      setMode('login'); setOtp(''); setPassword('');
    } else if (otpFor === 'forgot') {
      if (!newPwd) return push('Enter new password.', 'error');
      const updated = users.map(u => u.email.toLowerCase() === email.toLowerCase() ? { ...u, password: newPwd } : u);
      await sset(SK.USERS, updated);
      onUsersChanged?.();
      push('Password reset. Please sign in.', 'success');
      setMode('login'); setOtp(''); setNewPwd(''); setPassword('');
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative', zIndex: 2 }}>
      <div className="mq-card mq-fade" style={{ maxWidth: 460, width: '100%', padding: '3rem 2.5rem', position: 'relative' }}>
        <span className="mq-corner tl" /><span className="mq-corner tr" /><span className="mq-corner bl" /><span className="mq-corner br" />

        <Brand />

        {mode === 'login' && (
          <>
            <h2 className="mq-display" style={{ fontSize: '1.5rem', textAlign: 'center', margin: '0 0 8px', color: 'var(--ivory)' }}>Sign In</h2>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 28 }}>
              Request your audience
            </p>
            <div style={{ marginBottom: 16 }}>
              <label className="mq-label">Email Address</label>
              <input className="mq-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@queue.local" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="mq-label">Password</label>
              <input className="mq-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
            </div>
            <button className="mq-btn mq-btn-gold" style={{ width: '100%', justifyContent: 'center', padding: '1rem' }} onClick={handleLogin}>
              Enter <ChevronRight size={14} />
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, fontSize: '0.85rem' }}>
              <span className="mq-link" onClick={() => { setMode('signup'); setEmail(''); setPassword(''); }}>Create Account</span>
              <span className="mq-link" onClick={() => { setMode('forgot'); setPassword(''); }}>Forgot Password?</span>
            </div>
          </>
        )}

        {mode === 'signup' && (
          <>
            <h2 className="mq-display" style={{ fontSize: '1.5rem', textAlign: 'center', margin: '0 0 8px', color: 'var(--ivory)' }}>Register</h2>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 28 }}>
              Verified employees only · Domains: <span style={{ color: 'var(--gold)' }}>{domains.join(', ')}</span>
            </p>
            <div style={{ marginBottom: 14 }}>
              <label className="mq-label">Full Name</label>
              <input className="mq-input" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Doe" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label className="mq-label">Company Email</label>
              <input className="mq-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@queue.local" />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label className="mq-label">Choose Password</label>
              <input className="mq-input" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>
            <button className="mq-btn mq-btn-gold" style={{ width: '100%', justifyContent: 'center', padding: '1rem' }} onClick={handleSignup}>
              Send OTP <Mail size={14} />
            </button>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <span className="mq-link" onClick={() => setMode('login')}>← Back to sign in</span>
            </div>
          </>
        )}

        {mode === 'forgot' && (
          <>
            <h2 className="mq-display" style={{ fontSize: '1.5rem', textAlign: 'center', margin: '0 0 8px', color: 'var(--ivory)' }}>Reset Password</h2>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 28 }}>
              We'll send a one-time code to your email
            </p>
            <div style={{ marginBottom: 24 }}>
              <label className="mq-label">Registered Email</label>
              <input className="mq-input" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <button className="mq-btn mq-btn-gold" style={{ width: '100%', justifyContent: 'center', padding: '1rem' }} onClick={handleForgot}>
              Send OTP <KeyRound size={14} />
            </button>
            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <span className="mq-link" onClick={() => setMode('login')}>← Back to sign in</span>
            </div>
          </>
        )}

        {mode === 'otp' && (
          <>
            <h2 className="mq-display" style={{ fontSize: '1.5rem', textAlign: 'center', margin: '0 0 8px', color: 'var(--ivory)' }}>Verification</h2>
            <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 28 }}>
              Code sent to <span style={{ color: 'var(--gold)' }}>{email}</span>
            </p>
            <div style={{ marginBottom: 20 }}>
              <label className="mq-label">6-Digit Code</label>
              <input className="mq-input mq-mono" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="••••••" style={{ fontSize: '1.5rem', textAlign: 'center', letterSpacing: '0.5em' }} />
            </div>
            {otpFor === 'forgot' && (
              <div style={{ marginBottom: 20 }}>
                <label className="mq-label">New Password</label>
                <input className="mq-input" type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
              </div>
            )}
            <button className="mq-btn mq-btn-gold" style={{ width: '100%', justifyContent: 'center', padding: '1rem' }} onClick={verifyOtp}>
              Verify <Shield size={14} />
            </button>
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <span className="mq-link" onClick={() => setMode('login')}>Cancel</span>
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ============ EMPLOYEE VIEW ============
function EmployeeView({ user, push, refresh, queue, current, moratorium }) {
  const [showForm, setShowForm] = useState(false);
  const [showDelayPicker, setShowDelayPicker] = useState(false);
  const [delayTime, setDelayTime] = useState('');
  const [purpose, setPurpose] = useState('');
  const [topic, setTopic] = useState('');
  const [duration, setDuration] = useState('15');

  const myCurrent = current && current.userId === user.id;
  const myEntry = queue.find(q => q.userId === user.id);
  const activeQueue = queue.filter(q => !q.delayed || Date.now() >= new Date(q.delayUntil).getTime());
  
  let myPosition = null;
  if (myEntry) {
    if (myEntry.delayed && Date.now() < new Date(myEntry.delayUntil).getTime()) {
      myPosition = 'Delayed';
    } else {
      myPosition = activeQueue.indexOf(myEntry) + 1;
    }
  }

  const inSomeForm = myCurrent || myEntry;
  const isFirstInLine = !current && myPosition === 1 && !moratorium?.active;

  const submitRequest = async () => {
    if (!topic.trim() || !purpose.trim()) return push('All fields required.', 'error');
    const q = await sget(SK.QUEUE, []);
    const entry = {
      id: 'm_' + Date.now(),
      userId: user.id,
      userName: user.name,
      email: user.email,
      topic, purpose, duration: parseInt(duration),
      requestedAt: new Date().toISOString(),
      delayed: false,
    };
    const nextQueue = [...q, entry];
    await sset(SK.QUEUE, nextQueue);
    const position = nextQueue.length;
    const waitMinutes = estimateWaitMinutes(nextQueue, current, position - 1);
    await sendEmail({
      to: user.email,
      subject: 'Meeting request received',
      body: `Hello ${user.name}, your request "${topic}" is confirmed. Your queue position is ${position} and the estimated wait time is ${formatMinutes(waitMinutes)}.`,
      push,
    });
    push('Meeting requested. You are in the queue.', 'success');
    setShowForm(false); setTopic(''); setPurpose(''); setDuration('15');
    refresh();
  };

  const requestDelay = async () => {
    if (!delayTime) return push('Please select a time', 'error');
    const [h, m] = delayTime.split(':');
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m), 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    const delayUntil = d.toISOString();
    const delayedHistory = await sget(SK.DELAYED, []);

    if (myCurrent) {
      const cur = await sget(SK.CURRENT, null);
      if (!cur || cur.userId !== user.id) return;
      const delayedEntry = { ...cur, delayed: true, delayUntil };
      const q = await sget(SK.QUEUE, []);
      await sset(SK.QUEUE, [delayedEntry, ...q]);
      await sset(SK.DELAYED, [...delayedHistory, cur.userId]);
      await sset(SK.CURRENT, null);
      push(`Meeting delayed until ${delayTime}.`, 'success');
      setShowDelayPicker(false);
      refresh();
      return;
    }

    if (myEntry) {
      const q = await sget(SK.QUEUE, []);
      const newQueue = q.map(x => x.id === myEntry.id ? { ...x, delayed: true, delayUntil } : x);
      await sset(SK.QUEUE, newQueue);
      if (!myEntry.delayed) await sset(SK.DELAYED, [...delayedHistory, myEntry.userId]);
      push(`Meeting delayed until ${delayTime}.`, 'success');
      setShowDelayPicker(false);
      refresh();
    }
  };

  const joinMeetingNow = async () => {
    if (!isFirstInLine || !myEntry) return;
    const q = await sget(SK.QUEUE, []);
    if (!q.length || q[0].id !== myEntry.id) return push('You are no longer first in queue.', 'error');
    await sset(SK.QUEUE, q.slice(1));
    await sset(SK.CURRENT, { ...myEntry, calledAt: new Date().toISOString() });
    push('You have joined the meeting.', 'success');
    refresh();
  };

  const cancelRequest = async () => {
    const q = await sget(SK.QUEUE, []);
    await sset(SK.QUEUE, q.filter(x => x.id !== myEntry.id));
    push('Meeting request withdrawn.', 'info');
    refresh();
  };

  return (
    <div className="mq-fade" style={{ maxWidth: 920, margin: '0 auto', padding: '2rem' }}>
      {moratorium?.active && (
        <div className="mq-banner">
          <Pause size={20} color="var(--crimson)" />
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>Moratorium in effect</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {moratorium.duration} · {moratorium.reason || 'No meetings will be conducted at this time.'}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32 }}>
        <div>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
            Welcome
          </div>
          <h1 className="mq-display" style={{ fontSize: '2.5rem', margin: 0, color: 'var(--ivory)' }}>{user.name}</h1>
        </div>
        {!inSomeForm && !moratorium?.active && (
          <button className="mq-btn mq-btn-gold" onClick={() => setShowForm(true)}>
            <Plus size={14} /> Request Audience
          </button>
        )}
      </div>

      {myCurrent && (
        <div className="mq-card mq-pulse" style={{ padding: '2.5rem', textAlign: 'center', marginBottom: 24, position: 'relative', borderColor: 'var(--gold)' }}>
          <span className="mq-corner tl" /><span className="mq-corner tr" /><span className="mq-corner bl" /><span className="mq-corner br" />
          <Crown size={40} color="var(--gold)" style={{ marginBottom: 12 }} />
          <h2 className="mq-display" style={{ fontSize: '2rem', color: 'var(--gold)', margin: '0 0 8px' }}>You are being summoned</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '0 0 24px' }}>The President will see you now</p>
          <button className="mq-btn mq-btn-ghost" onClick={() => setShowDelayPicker(true)}>
            <Clock size={14} /> Schedule for Later
          </button>
        </div>
      )}

      {!myCurrent && myEntry && !isFirstInLine && (
        <div className="mq-card" style={{ padding: '2.5rem', textAlign: 'center', position: 'relative' }}>
          <span className="mq-corner tl" /><span className="mq-corner tr" /><span className="mq-corner bl" /><span className="mq-corner br" />
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 16 }}>
            {myPosition === 'Delayed' ? 'Status' : 'Your Position in the Queue'}
          </div>
          <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: myPosition === 'Delayed' ? '3rem' : '5rem', color: 'var(--gold)', lineHeight: 1, fontWeight: 600 }}>
            {myPosition}
          </div>
          {myPosition !== 'Delayed' && (
            <div style={{ color: 'var(--text-secondary)', marginTop: 12, fontStyle: 'italic', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem' }}>
              of {activeQueue.length} awaiting audience
            </div>
          )}
          <div className="mq-divider-ornament" style={{ maxWidth: 200, margin: '24px auto' }}>◆</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 360, margin: '0 auto', lineHeight: 1.6 }}>
            You will receive an email notification when you are next in line. Please remain ready.
          </div>
          <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="mq-btn mq-btn-ghost" onClick={() => setShowDelayPicker(true)}>
              <Clock size={14} /> Schedule for Later
            </button>
            <button className="mq-btn mq-btn-danger" onClick={cancelRequest}>
              <X size={14} /> Withdraw Request
            </button>
          </div>
          {myEntry.delayed && (
            <div style={{ marginTop: 16 }}>
              <span className="mq-chip crimson">Previously Delayed</span>
            </div>
          )}
        </div>
      )}

      {!inSomeForm && (
        <div className="mq-card" style={{ padding: '4rem 2rem', textAlign: 'center', position: 'relative' }}>
          <span className="mq-corner tl" /><span className="mq-corner tr" /><span className="mq-corner bl" /><span className="mq-corner br" />
          <Calendar size={48} color="var(--gold-dim)" style={{ marginBottom: 16 }} />
          <h2 className="mq-display" style={{ fontSize: '1.75rem', color: 'var(--ivory)', margin: '0 0 8px' }}>No active request</h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 24px', lineHeight: 1.6 }}>
            Submit a meeting request to join the queue. Your position is held privately and you'll be notified by email when your turn approaches.
          </p>
          {!moratorium?.active && (
            <button className="mq-btn mq-btn-gold" onClick={() => setShowForm(true)}>
              <Plus size={14} /> Request Audience
            </button>
          )}
        </div>
      )}

      {isFirstInLine && (
        <div className="mq-card mq-pulse" style={{ padding: '2.5rem', textAlign: 'center', borderColor: 'var(--gold)', position: 'relative' }}>
          <span className="mq-corner tl" /><span className="mq-corner tr" /><span className="mq-corner bl" /><span className="mq-corner br" />
          <Crown size={40} color="var(--gold)" style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 600, color: 'var(--ivory)', fontSize: '1.5rem', marginBottom: 8 }}>You are next in line!</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginBottom: 24 }}>
            No meeting is currently active. The President's office is open.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button className="mq-btn mq-btn-gold" onClick={joinMeetingNow} style={{ padding: '1rem 2rem', fontSize: '0.9rem' }}>
              <Play size={16} /> Join Meeting Now
            </button>
            <button className="mq-btn mq-btn-ghost" onClick={() => setShowDelayPicker(true)} style={{ padding: '1rem 2rem', fontSize: '0.9rem' }}>
              <Clock size={16} /> Schedule for Later
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="mq-modal-bg" onClick={() => setShowForm(false)}>
          <div className="mq-modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '2rem 2rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <h2 className="mq-display" style={{ fontSize: '1.6rem', margin: 0, color: 'var(--ivory)' }}>Request Audience</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>Detail the purpose of your meeting</p>
            </div>
            <div style={{ padding: '1.5rem 2rem 2rem' }}>
              <div style={{ marginBottom: 16 }}>
                <label className="mq-label">Topic / Subject</label>
                <input className="mq-input" value={topic} onChange={e => setTopic(e.target.value)} placeholder="Q4 budget reallocation" />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label className="mq-label">Detailed Purpose</label>
                <textarea className="mq-input" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Briefly describe what you wish to discuss..." />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label className="mq-label">Estimated Duration (minutes)</label>
                <select className="mq-input" value={duration} onChange={e => setDuration(e.target.value)}>
                  <option value="10">10 minutes</option>
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                  <option value="60">1 hour</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button className="mq-btn mq-btn-ghost" onClick={() => setShowForm(false)}>Cancel</button>
                <button className="mq-btn mq-btn-gold" onClick={submitRequest}>Submit Request</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showDelayPicker && (
        <div className="mq-modal-bg" onClick={() => setShowDelayPicker(false)}>
          <div className="mq-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h2 className="mq-display" style={{ fontSize: '1.4rem', margin: 0, color: 'var(--ivory)' }}>Schedule for Later</h2>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <label className="mq-label" style={{ textAlign: 'center', marginBottom: 12 }}>Select Time</label>
              <div style={{ marginBottom: 24 }}>
                <WheelTimePicker value={delayTime} onChange={setDelayTime} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="mq-btn mq-btn-ghost" onClick={() => setShowDelayPicker(false)}>Cancel</button>
                <button className="mq-btn mq-btn-gold" onClick={requestDelay}>Confirm Delay</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ ADMIN / EA / PRESIDENT VIEW ============
function AdminView({ user, push, refresh, queue, current, moratorium, history, allUsers, domains }) {
  const [tab, setTab] = useState('queue');
  const [showMorat, setShowMorat] = useState(false);
  const [moratDuration, setMoratDuration] = useState('30 minutes');
  const [moratReason, setMoratReason] = useState('');

  const callNext = async () => {
    if (moratorium?.active) return push('Cannot call next during moratorium.', 'error');
    if (current) return push('A meeting is already in progress.', 'error');
    if (queue.length === 0) return push('Queue is empty.', 'info');
    const q = [...queue];
    const activeIndex = q.findIndex(x => !x.delayed || Date.now() >= new Date(x.delayUntil).getTime());
    if (activeIndex === -1) return push('No users are currently available (all delayed).', 'info');
    const [next] = q.splice(activeIndex, 1);
    await sset(SK.QUEUE, q);
    await sset(SK.CURRENT, { ...next, calledAt: new Date().toISOString() });
    await sendEmail({
      to: next.email,
      subject: 'It is your turn now',
      body: `Hello ${next.userName}, you are now called in for your meeting with the President.`,
      push,
    });
    push(`${next.userName} has been summoned. Email notification sent.`, 'success');
    refresh();
  };

  const completeMeeting = async () => {
    if (!current) return;
    const h = await sget(SK.HISTORY, []);
    const completed = {
      ...current,
      completedAt: new Date().toISOString(),
      status: 'COMPLETED',
    };
    await sset(SK.HISTORY, [...h, completed]);
    await sset(SK.CURRENT, null);
    push(`Meeting with ${current.userName} marked complete.`, 'success');
    refresh();
  };

  const applyMoratorium = async () => {
    await sset(SK.MORATORIUM, {
      active: true,
      duration: moratDuration,
      reason: moratReason,
      appliedAt: new Date().toISOString(),
      appliedBy: user.name,
    });
    push(`Moratorium applied: ${moratDuration}. All participants notified.`, 'success');
    setShowMorat(false); setMoratReason('');
    refresh();
  };

  const liftMoratorium = async () => {
    await sset(SK.MORATORIUM, { active: false });
    push('Moratorium lifted. Queue resumed.', 'success');
    refresh();
  };

  return (
    <div className="mq-fade" style={{ maxWidth: 1240, margin: '0 auto', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: '0.75rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 8 }}>
            {user.role === 'PRESIDENT' ? 'Office of the President' : 'Executive Assistant'}
          </div>
          <h1 className="mq-display" style={{ fontSize: '2.5rem', margin: 0, color: 'var(--ivory)' }}>Command Console</h1>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {moratorium?.active ? (
            <button className="mq-btn mq-btn-gold" onClick={liftMoratorium}>
              <Play size={14} /> Lift Moratorium
            </button>
          ) : (
            <button className="mq-btn mq-btn-ghost" onClick={() => setShowMorat(true)}>
              <Pause size={14} /> Apply Moratorium
            </button>
          )}
        </div>
      </div>

      {moratorium?.active && (
        <div className="mq-banner">
          <Pause size={20} color="var(--crimson)" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>Moratorium active — Queue is frozen</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Duration: {moratorium.duration} · Applied by {moratorium.appliedBy}
              {moratorium.reason && ` · "${moratorium.reason}"`}
            </div>
          </div>
        </div>
      )}

      {/* Stat row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { num: queue.length, label: 'In Queue' },
          { num: current ? 1 : 0, label: 'In Session' },
          { num: history.filter(h => isToday(h.completedAt)).length, label: 'Today Completed' },
          { num: history.length, label: 'All Time' },
        ].map((s, i) => (
          <div key={i} className="mq-card" style={{ padding: '1.5rem', position: 'relative' }}>
            <span className="mq-corner tl" /><span className="mq-corner br" />
            <div className="mq-stat-num">{s.num}</div>
            <div className="mq-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24, overflowX: 'auto' }}>
        {[
          { k: 'queue', l: 'Live Queue', i: <Users size={14} /> },
          { k: 'history', l: 'History', i: <Clock size={14} /> },
          { k: 'reports', l: 'Reports', i: <BarChart3 size={14} /> },
          { k: 'settings', l: 'Settings', i: <Settings size={14} /> },
        ].map(t => (
          <button key={t.k} className={`mq-tab ${tab === t.k ? 'active' : ''}`} onClick={() => setTab(t.k)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {t.i} {t.l}
          </button>
        ))}
      </div>

      {tab === 'queue' && (
        <QueueTab
          queue={queue} current={current} moratorium={moratorium}
          callNext={callNext} completeMeeting={completeMeeting}
          push={push} refresh={refresh}
        />
      )}
      {tab === 'history' && <HistoryTab history={history} />}
      {tab === 'reports' && <ReportsTab history={history} push={push} />}
      {tab === 'settings' && <SettingsTab user={user} domains={domains} allUsers={allUsers} push={push} refresh={refresh} />}

      {showMorat && (
        <div className="mq-modal-bg" onClick={() => setShowMorat(false)}>
          <div className="mq-modal" onClick={e => e.stopPropagation()}>
            <div style={{ padding: '2rem 2rem 1rem', borderBottom: '1px solid var(--border)' }}>
              <h2 className="mq-display" style={{ fontSize: '1.6rem', margin: 0, color: 'var(--ivory)' }}>Apply Moratorium</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '6px 0 0' }}>
                Freeze all meeting activity. All participants will be notified.
              </p>
            </div>
            <div style={{ padding: '1.5rem 2rem 2rem' }}>
              <div style={{ marginBottom: 16 }}>
                <label className="mq-label">Duration</label>
                <select className="mq-input" value={moratDuration} onChange={e => setMoratDuration(e.target.value)}>
                  <option>15 minutes</option>
                  <option>30 minutes</option>
                  <option>1 hour</option>
                  <option>2 hours</option>
                  <option>Half day</option>
                  <option>Full day</option>
                  <option>Until further notice</option>
                </select>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label className="mq-label">Reason (optional)</label>
                <textarea className="mq-input" value={moratReason} onChange={e => setMoratReason(e.target.value)} placeholder="Board meeting in session..." />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button className="mq-btn mq-btn-ghost" onClick={() => setShowMorat(false)}>Cancel</button>
                <button className="mq-btn mq-btn-gold" onClick={applyMoratorium}>Apply Moratorium</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const isToday = (iso) => {
  if (!iso) return false;
  const d = new Date(iso); const t = new Date();
  return d.toDateString() === t.toDateString();
};

// ============ QUEUE TAB ============
function QueueTab({ queue, current, moratorium, callNext, completeMeeting, push, refresh }) {
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [adminDelayTarget, setAdminDelayTarget] = useState(null);
  const [adminDelayTime, setAdminDelayTime] = useState('');

  const activeQueue = useMemo(() => queue.filter(q => !q.delayed || Date.now() >= new Date(q.delayUntil).getTime()), [queue]);
  const delayedQueue = useMemo(() => queue.filter(q => q.delayed && Date.now() < new Date(q.delayUntil).getTime()), [queue]);

  const onDragStart = (i) => setDragIdx(i);
  const onDragOver = (e, i) => { e.preventDefault(); setOverIdx(i); };
  const onDragEnd = () => { setDragIdx(null); setOverIdx(null); };
  const onDrop = async (e, i) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === i) return onDragEnd();
    
    const draggedItem = activeQueue[dragIdx];
    const targetItem = activeQueue[i];

    const newQ = [...queue];
    const actualDragIdx = newQ.findIndex(x => x.id === draggedItem.id);
    const [moved] = newQ.splice(actualDragIdx, 1);
    
    const actualTargetIdx = newQ.findIndex(x => x.id === targetItem.id);
    newQ.splice(actualTargetIdx, 0, moved);

    await sset(SK.QUEUE, newQ);
    push('Queue reordered.', 'success');
    onDragEnd();
    refresh();
  };

  const adminRequestDelay = async () => {
    if (!adminDelayTarget) return;
    if (!adminDelayTime) return push('Please select a time', 'error');
    const [h, m] = adminDelayTime.split(':');
    const d = new Date();
    d.setHours(parseInt(h), parseInt(m), 0, 0);
    if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
    const delayUntil = d.toISOString();
    
    if (current && current.id === adminDelayTarget) {
      const delayedEntry = { ...current, delayed: true, delayUntil };
      const newQueue = [delayedEntry, ...queue];
      await sset(SK.QUEUE, newQueue);
      await sset(SK.CURRENT, null);
    } else {
      const newQueue = queue.map(x => x.id === adminDelayTarget ? { ...x, delayed: true, delayUntil } : x);
      await sset(SK.QUEUE, newQueue);
    }
    push('User rescheduled.', 'success');
    setAdminDelayTarget(null);
    setAdminDelayTime('');
    refresh();
  };

  const removeFromQueue = async (id) => {
    const newQ = queue.filter(q => q.id !== id);
    await sset(SK.QUEUE, newQ);
    push('Removed from queue.', 'info');
    refresh();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 24 }}>
      {/* Current Meeting */}
      <div>
        <h3 className="mq-section-title" style={{ fontSize: '1.4rem' }}>In Session</h3>
        <p className="mq-section-sub">The meeting currently underway</p>
        {current ? (
          <div className="mq-card" style={{ padding: '1.5rem', display: 'flex', alignItems: 'center', gap: 16, position: 'relative', borderColor: 'var(--gold)' }}>
            <span className="mq-corner tl" /><span className="mq-corner tr" /><span className="mq-corner bl" /><span className="mq-corner br" />
            <div className="mq-pos-badge current"><Crown size={16} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '1.05rem', color: 'var(--ivory)' }}>{current.userName}</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                {current.topic} · {current.duration} min · Started {timeAgo(current.calledAt)}
              </div>
              {current.delayed && <span className="mq-chip crimson" style={{ marginTop: 6 }}>Returning from delay</span>}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="mq-btn mq-btn-ghost" onClick={() => setAdminDelayTarget(current.id)}>
                <Clock size={14} /> Reschedule
              </button>
              <button className="mq-btn mq-btn-gold" onClick={completeMeeting}>
                <CheckCircle2 size={14} /> Mark Complete
              </button>
            </div>
          </div>
        ) : (
          <div className="mq-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            <p style={{ margin: '0 0 16px', fontFamily: 'Cormorant Garamond, serif', fontSize: '1.2rem', fontStyle: 'italic' }}>
              No meeting in session
            </p>
            {queue.length > 0 && !moratorium?.active && (
              <button className="mq-btn mq-btn-gold" onClick={callNext}>
                <ChevronRight size={14} /> Summon Next
              </button>
            )}
            {moratorium?.active && (
              <p style={{ color: 'var(--crimson)', fontSize: '0.85rem', margin: 0 }}>Moratorium prevents new sessions</p>
            )}
          </div>
        )}
      </div>

      {/* Queue */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <div>
            <h3 className="mq-section-title" style={{ fontSize: '1.4rem' }}>The Queue</h3>
            <p className="mq-section-sub">Drag to reorder · {activeQueue.length} active, {delayedQueue.length} scheduled for later</p>
          </div>
        </div>
        {activeQueue.length === 0 && delayedQueue.length === 0 ? (
          <div className="mq-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <Users size={36} color="var(--gold-dim)" style={{ marginBottom: 12 }} />
            <p style={{ color: 'var(--text-secondary)', margin: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: '1.1rem', fontStyle: 'italic' }}>
              The queue is empty
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeQueue.map((q, i) => (
              <div
                key={q.id}
                className={`mq-tile ${dragIdx === i ? 'dragging' : ''} ${overIdx === i ? 'drag-over' : ''}`}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragOver={(e) => onDragOver(e, i)}
                onDrop={(e) => onDrop(e, i)}
                onDragEnd={onDragEnd}
              >
                <GripVertical size={16} color="var(--text-tertiary)" style={{ flexShrink: 0 }} />
                <div className="mq-pos-badge">{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ fontWeight: 600, color: 'var(--ivory)' }}>{q.userName}</div>
                    <span className="mq-chip">{q.duration}m</span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.topic} — {q.purpose}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => setAdminDelayTarget(q.id)} style={{ background: 'transparent', border: 'none', color: 'var(--gold)', cursor: 'pointer', padding: 6 }} title="Reschedule">
                    <Clock size={16} />
                  </button>
                  <button onClick={() => removeFromQueue(q.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 6 }} title="Remove">
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
            
            {delayedQueue.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <h4 className="mq-section-sub" style={{ margin: '0 0 12px', color: 'var(--gold)' }}>Scheduled for Later</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {delayedQueue.map((q) => (
                    <div key={q.id} className="mq-tile delayed-tile" style={{ opacity: 0.8, cursor: 'default' }}>
                      <Clock size={16} color="var(--crimson)" style={{ flexShrink: 0, marginLeft: 8 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 600, color: 'var(--ivory)' }}>{q.userName}</div>
                          <span className="mq-chip crimson">
                            Delayed until {new Date(q.delayUntil).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                          {q.topic}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button onClick={() => setAdminDelayTarget(q.id)} style={{ background: 'transparent', border: 'none', color: 'var(--gold)', cursor: 'pointer', padding: 6 }} title="Reschedule">
                          <Clock size={16} />
                        </button>
                        <button onClick={() => removeFromQueue(q.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 6 }} title="Remove">
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {adminDelayTarget && (
        <div className="mq-modal-bg" onClick={() => setAdminDelayTarget(null)}>
          <div className="mq-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border)' }}>
              <h2 className="mq-display" style={{ fontSize: '1.4rem', margin: 0, color: 'var(--ivory)' }}>Reschedule User</h2>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <label className="mq-label" style={{ textAlign: 'center', marginBottom: 12 }}>Select Time</label>
              <div style={{ marginBottom: 24 }}>
                <WheelTimePicker value={adminDelayTime} onChange={setAdminDelayTime} />
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button className="mq-btn mq-btn-ghost" onClick={() => setAdminDelayTarget(null)}>Cancel</button>
                <button className="mq-btn mq-btn-gold" onClick={adminRequestDelay}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const timeAgo = (iso) => {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h}h ago`;
};

// ============ HISTORY TAB ============
function HistoryTab({ history }) {
  const sorted = [...history].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
  return (
    <div>
      <h3 className="mq-section-title">Meeting History</h3>
      <p className="mq-section-sub">All completed audiences with the President</p>
      {sorted.length === 0 ? (
        <div className="mq-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          No completed meetings yet.
        </div>
      ) : (
        <div className="mq-card" style={{ overflow: 'hidden' }}>
          <table className="mq-table">
            <thead>
              <tr>
                <th>Date</th><th>Attendee</th><th>Topic</th><th>Duration</th><th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(h => (
                <tr key={h.id}>
                  <td>{new Date(h.completedAt).toLocaleString()}</td>
                  <td><strong>{h.userName}</strong></td>
                  <td>{h.topic}</td>
                  <td>{h.duration} min</td>
                  <td>
                    {h.delayed && <span className="mq-chip crimson">Delayed</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============ REPORTS TAB ============
function ReportsTab({ history, push }) {
  const today = new Date();
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  const [startDate, setStartDate] = useState(monthAgo.toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(today.toISOString().slice(0, 10));

  const filtered = useMemo(() => {
    const s = new Date(startDate); s.setHours(0,0,0,0);
    const e = new Date(endDate); e.setHours(23,59,59,999);
    return history.filter(h => {
      const d = new Date(h.completedAt);
      return d >= s && d <= e;
    });
  }, [history, startDate, endDate]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const totalMins = filtered.reduce((a, b) => a + (b.duration || 0), 0);
    const delayed = filtered.filter(h => h.delayed).length;
    const byPerson = {};
    filtered.forEach(h => { byPerson[h.userName] = (byPerson[h.userName] || 0) + 1; });
    const top = Object.entries(byPerson).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { total, totalMins, delayed, top };
  }, [filtered]);

  const downloadCSV = () => {
    const rows = [
      ['Date', 'Attendee', 'Email', 'Topic', 'Purpose', 'Duration (min)', 'Delayed'],
      ...filtered.map(h => [
        new Date(h.completedAt).toLocaleString(),
        h.userName, h.email || '', h.topic, h.purpose,
        h.duration, h.delayed ? 'Yes' : 'No',
      ])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `meeting-report-${startDate}-to-${endDate}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    push('Report downloaded.', 'success');
  };

  return (
    <div>
      <h3 className="mq-section-title">Reports & Analytics</h3>
      <p className="mq-section-sub">Filter by date range and download as CSV</p>

      <div className="mq-card" style={{ padding: '1.5rem', marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 16, alignItems: 'end' }}>
          <div>
            <label className="mq-label">Start Date</label>
            <input className="mq-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="mq-label">End Date</label>
            <input className="mq-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
          <button className="mq-btn mq-btn-gold" onClick={downloadCSV}>
            <FileDown size={14} /> Download CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { num: stats.total, label: 'Meetings' },
          { num: stats.totalMins, label: 'Total Minutes' },
          { num: stats.delayed, label: 'Delayed' },
          { num: stats.total > 0 ? Math.round(stats.totalMins / stats.total) : 0, label: 'Avg Length' },
        ].map((s, i) => (
          <div key={i} className="mq-card" style={{ padding: '1.5rem' }}>
            <div className="mq-stat-num">{s.num}</div>
            <div className="mq-stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="mq-card" style={{ padding: '1.5rem' }}>
          <h4 className="mq-display" style={{ fontSize: '1.2rem', margin: '0 0 16px', color: 'var(--ivory)' }}>Top Attendees</h4>
          {stats.top.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No data in this range.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.top.map(([name, count], i) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'Outfit, sans-serif', fontWeight: 600, color: 'var(--gold)', fontSize: '1.3rem', width: 24 }}>{i + 1}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', color: 'var(--ivory)' }}>{name}</div>
                    <div style={{ height: 4, background: 'var(--bg-deepest)', borderRadius: 2, overflow: 'hidden', marginTop: 4 }}>
                      <div style={{ height: '100%', background: 'var(--gold)', width: `${(count / stats.top[0][1]) * 100}%` }} />
                    </div>
                  </div>
                  <span className="mq-mono" style={{ color: 'var(--gold)', fontSize: '0.85rem' }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mq-card" style={{ padding: '1.5rem' }}>
          <h4 className="mq-display" style={{ fontSize: '1.2rem', margin: '0 0 16px', color: 'var(--ivory)' }}>Recent Meetings</h4>
          {filtered.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No data in this range.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 280, overflowY: 'auto' }}>
              {filtered.slice(0, 10).map(h => (
                <div key={h.id} style={{ padding: '8px 12px', borderLeft: '2px solid var(--gold-dim)', background: 'var(--bg-deepest)' }}>
                  <div style={{ fontSize: '0.9rem', color: 'var(--ivory)' }}>{h.userName} — {h.topic}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {new Date(h.completedAt).toLocaleString()} · {h.duration}m
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ SETTINGS TAB ============
function SettingsTab({ user, domains, allUsers, push, refresh }) {
  const [newDomain, setNewDomain] = useState('');

  const addDomain = async () => {
    const d = newDomain.trim().toLowerCase().replace(/^@/, '');
    if (!d || !d.includes('.')) return push('Invalid domain.', 'error');
    if (domains.includes(d)) return push('Domain already permitted.', 'error');
    await sset(SK.DOMAINS, [...domains, d]);
    push(`Domain @${d} added.`, 'success');
    setNewDomain('');
    refresh();
  };

  const removeDomain = async (d) => {
    await sset(SK.DOMAINS, domains.filter(x => x !== d));
    push(`Domain @${d} removed.`, 'info');
    refresh();
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div>
        <h3 className="mq-section-title">Allowed Email Domains</h3>
        <p className="mq-section-sub">Only users with these domains may register</p>
        <div className="mq-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {domains.map(d => (
              <div key={d} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-deepest)', borderRadius: 3 }}>
                <span className="mq-mono" style={{ color: 'var(--gold)' }}>@{d}</span>
                <button onClick={() => removeDomain(d)} style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="mq-input" value={newDomain} onChange={e => setNewDomain(e.target.value)} placeholder="example.com" onKeyDown={e => e.key === 'Enter' && addDomain()} />
            <button className="mq-btn mq-btn-gold" onClick={addDomain}>Add</button>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mq-section-title">Registered Users</h3>
        <p className="mq-section-sub">{allUsers.length} accounts</p>
        <div className="mq-card" style={{ padding: '1rem', maxHeight: 420, overflowY: 'auto' }}>
          {allUsers.map(u => (
            <div key={u.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '0.95rem', color: 'var(--ivory)' }}>{u.name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{u.email}</div>
              </div>
              {user.email === 'admin@powermech.net' && user.id !== u.id ? (
                <select 
                  value={u.role} 
                  onChange={async (e) => {
                    const updatedUsers = allUsers.map(usr => usr.id === u.id ? { ...usr, role: e.target.value } : usr);
                    await sset(SK.USERS, updatedUsers);
                    refresh();
                    push(`${u.name} is now ${e.target.value}`, 'success');
                  }}
                  className="mq-input"
                  style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', background: 'var(--bg-deep)', height: '32px' }}
                >
                  <option value="EMPLOYEE">Employee</option>
                  <option value="EA">EA</option>
                  <option value="PRESIDENT">President</option>
                </select>
              ) : (
                <span className={`mq-chip ${u.role === 'PRESIDENT' ? 'gold' : u.role === 'EA' ? 'emerald' : ''}`}>
                  {u.role}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============ TOP NAV ============
function TopNav({ user, onLogout, refresh }) {
  return (
    <nav style={{
      borderBottom: '1px solid var(--border)',
      background: 'rgba(10, 13, 20, 0.7)',
      backdropFilter: 'blur(12px)',
      padding: '1rem 2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Crown size={22} color="var(--gold)" strokeWidth={1.5} />
        <div>
          <div className="mq-display" style={{ fontSize: '1.2rem', color: 'var(--ivory)', lineHeight: 1, fontWeight: 600 }}>The Antechamber</div>
          <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-tertiary)', marginTop: 2 }}>
            Audience with the President
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.9rem', color: 'var(--ivory)' }}>{user.name}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--gold)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{user.role}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} className="mq-btn mq-btn-ghost" style={{ padding: '0.5rem 0.9rem' }} title="Sync Data">
            <RefreshCw size={14} />
          </button>
          <button onClick={onLogout} className="mq-btn mq-btn-ghost" style={{ padding: '0.5rem 0.9rem' }} title="Sign Out">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </nav>
  );
}

// ============ MAIN APP ============
export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const [history, setHistory] = useState([]);
  const [moratorium, setMoratorium] = useState({ active: false });
  const [allUsers, setAllUsers] = useState([]);
  const [domains, setDomains] = useState([]);

  const { toasts, push } = useToasts();
  const refresh = () => setTick(t => t + 1);

  useEffect(() => {
    (async () => {
      await seedIfEmpty();
      const session = await sget(SK.SESSION, null);
      if (session) setUser(session);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const [q, c, h, m, u, d] = await Promise.all([
        sget(SK.QUEUE, []),
        sget(SK.CURRENT, null),
        sget(SK.HISTORY, []),
        sget(SK.MORATORIUM, { active: false }),
        sget(SK.USERS, []),
        sget(SK.DOMAINS, []),
      ]);
      setQueue(q); setCurrent(c); setHistory(h);
      setMoratorium(m); setAllUsers(u); setDomains(d);
    })();
  }, [tick, user]);

  useEffect(() => {
    if (db) {
      const unsub = onSnapshot(doc(db, 'queueApp/mainState'), (snap) => {
        if (snap.exists()) refresh();
      });
      return () => unsub();
    } else {
      const onStorage = () => refresh();
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
  }, []);

  useEffect(() => {
    (async () => {
      if (current || queue.length === 0) return;
      const first = queue[0];
      if (!first?.userId) return;
      const lastNotified = await sget(SK.NEXT_ALERTED, null);
      if (lastNotified === first.userId) return;
      await sendEmail({
        to: first.email,
        subject: 'You are next in line',
        body: `Hello ${first.userName}, you are now next in the queue and should be ready to join.`,
        push: push,
      });
      await sset(SK.NEXT_ALERTED, first.userId);
    })();
  }, [queue, current]);

  // Auto-poll for delay reactivation: when delayUntil passes, no special action needed
  // because the entry is already in queue at correct position. The "delayed" flag
  // remains for visual indicator. Real system would email at delayUntil.
  useEffect(() => {
    const interval = setInterval(() => refresh(), 15000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await sset(SK.SESSION, null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="mq-app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <style>{styles}</style>
        <Crown size={32} color="var(--gold)" />
      </div>
    );
  }

  return (
    <div className="mq-app mq-grain">
      <style>{styles}</style>
      <ToastStack toasts={toasts} />
      {!user ? (
        <AuthScreen onLogin={(u) => { setUser(u); refresh(); }} push={push} onUsersChanged={refresh} />
      ) : (
        <>
          <TopNav user={user} onLogout={handleLogout} refresh={refresh} />
          {(user.role === 'EA' || user.role === 'PRESIDENT') ? (
            <AdminView
              user={user} push={push} refresh={refresh}
              queue={queue} current={current} moratorium={moratorium}
              history={history} allUsers={allUsers} domains={domains}
            />
          ) : (
            <EmployeeView
              user={user} push={push} refresh={refresh}
              queue={queue} current={current} moratorium={moratorium}
            />
          )}
        </>
      )}
    </div>
  );
}
