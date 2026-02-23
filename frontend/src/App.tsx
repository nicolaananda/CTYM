import { useState, useEffect, useRef } from 'react';
import { api, type Message } from './lib/api';
import dompurify from 'dompurify';
import { Mail, RefreshCw, Copy, ArrowLeft, Trash2, Sparkles, XCircle, CheckCircle } from 'lucide-react';

/* Types for Toast */
type ToastType = 'success' | 'error' | 'info';
interface ToastMsg {
  id: number;
  type: ToastType;
  text: string;
}

function App() {
  const [address, setAddress] = useState<{ local: string, domain: string, expires_at?: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(null);
  const [loading, setLoading] = useState(false);
  const [customLocal, setCustomLocal] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [availableDomains, setAvailableDomains] = useState<string[]>(['catty.my.id']); // Fallback default
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [expirationDate, setExpirationDate] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [extractedOtp, setExtractedOtp] = useState<string | null>(null);

  // Helper to show toast
  const showToast = (text: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  // Fetch available domains on mount
  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const domains = await api.getDomains();
        if (domains && domains.length > 0) {
          setAvailableDomains(domains);
          // Set default if not set
          if (!selectedDomain) {
            setSelectedDomain(domains[0]);
          }
        }
      } catch (err) {
        console.error('Failed to fetch domains', err);
      }
    };
    fetchDomains();
  }, []);

  // Check expiration status on mount
  useEffect(() => {
    const checkExpiration = async () => {
      try {
        const status = await api.getStatus();
        setIsExpired(status.expired);
        if (status.expirationDate) {
          setExpirationDate(status.expirationDate);
        }
      } catch (err) {
        console.error('Failed to check expiration', err);
      }
    };
    checkExpiration();
  }, []);

  // Load saved address on mount
  useEffect(() => {
    const saved = localStorage.getItem('catty_address');
    if (saved) {
      setAddress(JSON.parse(saved));
    }
  }, []);

  // SSE + fallback polling for inbox updates
  useEffect(() => {
    if (!address) return;

    const fetchInbox = async () => {
      try {
        const msgs = await api.getInbox(address.domain, address.local);
        setMessages(msgs || []);
      } catch (err) {
        console.error("Inbox fetch error", err);
      }
    };

    fetchInbox(); // Initial fetch

    // Connect to SSE stream for real-time push
    const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';
    const sseUrl = `${API_BASE}/stream/${address.domain}/${address.local}`;
    const es = new EventSource(sseUrl);

    es.addEventListener('new_message', () => {
      fetchInbox(); // Immediately reload when new email arrives
    });

    es.onerror = () => {
      // SSE connection dropped, it will auto-reconnect
      console.warn('SSE connection lost, browser will auto-reconnect');
    };

    // Fallback poll every 30s in case SSE misses something
    pollTimer.current = setInterval(fetchInbox, 30000);

    // Update countdown timer every minute
    const updateTimeRemaining = () => {
      if (!address?.expires_at) return;
      const t = Date.parse(address.expires_at) - Date.now();
      if (t <= 0) {
        setTimeRemaining('Expired');
        setIsExpired(true);
      } else {
        const hours = Math.floor((t / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((t / 1000 / 60) % 60);
        setTimeRemaining(`${hours}h ${minutes}m`);
      }
    };

    updateTimeRemaining();
    countdownTimer.current = setInterval(updateTimeRemaining, 60000);

    return () => {
      es.close();
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (countdownTimer.current) clearInterval(countdownTimer.current);
    };
  }, [address]);

  // Manual refresh
  const handleManualRefresh = async () => {
    if (!address || refreshing) return;
    setRefreshing(true);
    try {
      const msgs = await api.getInbox(address.domain, address.local);
      setMessages(msgs || []);
    } catch (err) {
      console.error("Refresh error", err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRandom = async () => {
    setLoading(true);
    try {
      const targetDomain = selectedDomain || availableDomains[0];
      const res = await api.createRandomAddress(targetDomain);
      const newAddr = { local: res.local, domain: res.domain, expires_at: res.expires_at };
      setAddress(newAddr);
      localStorage.setItem('catty_address', JSON.stringify(newAddr));
      setMessages([]);
      setSelectedMsg(null);
      showToast("Magic Address Created! ✨", "success");
    } catch (err) {
      showToast("Failed to create address", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customLocal) return;

    let targetLocal = customLocal.trim();
    let targetDomain = selectedDomain || availableDomains[0];

    // Smart Parsing: Check if user entered a full email
    if (targetLocal.includes('@')) {
      const parts = targetLocal.split('@');
      if (parts.length >= 2) {
        const potentialDomain = parts.pop();
        const potentialLocal = parts.join('@');

        if (potentialDomain && availableDomains.includes(potentialDomain)) {
          targetLocal = potentialLocal;
          targetDomain = potentialDomain;
          setSelectedDomain(potentialDomain);
        } else {
          showToast(`Invalid domain. Allowed: ${availableDomains.join(', ')}`, 'error');
          return;
        }
      }
    }

    // Validation
    const validPattern = /^[a-z0-9._-]+$/;
    if (!validPattern.test(targetLocal)) {
      showToast("Username can only contain letters, numbers, dots, underscores, and dashes.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await api.createCustomAddress(targetDomain, targetLocal);
      const newAddr = { local: res.local, domain: res.domain, expires_at: res.expires_at };
      setAddress(newAddr);
      localStorage.setItem('catty_address', JSON.stringify(newAddr));
      setMessages([]);
      setSelectedMsg(null);
      showToast("Custom Address Claimed! 🚀", "success");
    } catch (err) {
      showToast("Address unavailable or invalid", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setAddress(null);
    localStorage.removeItem('catty_address');
    setMessages([]);
    setSelectedMsg(null);
    showToast("Session Ended", "info");
  };

  const copyToClipboard = () => {
    if (address) {
      navigator.clipboard.writeText(`${address.local}@${address.domain}`);
      showToast("Address Copied! 📋", "success");
    }
  };

  const extractOtp = (subject: string, body: string) => {
    // Regex looking for 4-8 consecutive digits
    // With optional context words around it (e.g. "code", "otp", "verifikasi", "verification")
    const combinedText = (subject + " " + body).replace(/<[^>]*>?/gm, ''); // Strip HTML tags for cleaner matching

    // Look for patterns like "code is 123456" or "OTP: 1234"
    const contextRegex = /(?:code|otp|pin|token|verifikasi|verification|password|passcode)[\s:=-]+([0-9]{4,8})/i;
    const contextMatch = combinedText.match(contextRegex);
    if (contextMatch && contextMatch[1]) {
      return contextMatch[1];
    }

    // Fallback: just find the first isolated 4-8 digit number
    const isolatedRegex = /(?:\b|^)([0-9]{4,8})(?:\b|$)/;
    const isolatedMatch = combinedText.match(isolatedRegex);
    if (isolatedMatch && isolatedMatch[1]) {
      return isolatedMatch[1];
    }

    return null;
  };

  const selectMessage = async (id: string) => {
    try {
      const msg = await api.getMessage(id);
      setSelectedMsg(msg);
      setExtractedOtp(extractOtp(msg.subject, msg.text || msg.html || ''));
    } catch (err) {
      console.error(err);
    }
  };

  // Show expiration screen if expired
  if (isExpired) {
    return (
      <div className="container-center w-full" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="glass-card animate-fade-in" style={{ maxWidth: '600px', padding: '3rem', textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <XCircle size={80} color="#ff4d4d" style={{ margin: '0 auto' }} />
          </div>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#333' }}>Service Expired</h1>
          <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '1.5rem' }}>
            This CattyMail service has expired and is no longer available.
          </p>
          {expirationDate && (
            <p style={{ fontSize: '1rem', color: '#999', marginBottom: '2rem' }}>
              Expiration date: <strong>{new Date(expirationDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</strong>
            </p>
          )}
          <p style={{ fontSize: '0.9rem', color: '#999' }}>
            For inquiries, please contact: <a href="https://nicola.id" style={{ color: '#ff69b4', textDecoration: 'underline' }}>nicola.id</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && <CheckCircle size={20} color="#4CAF50" />}
            {t.type === 'error' && <XCircle size={20} color="#ff4d4d" />}
            {t.type === 'info' && <Sparkles size={20} color="#ff69b4" />}
            {t.text}
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3.5rem', background: 'linear-gradient(45deg, #FF69B4, #FF1493)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', filter: 'drop-shadow(0 2px 10px rgba(255,105,180,0.3))' }}>
          <Sparkles size={48} color="#FF69B4" fill="#FF69B4" /> CattyMail
        </h1>
      </div>

      {selectedMsg ? (
        <div className="glass-card animate-fade-in w-full" style={{ maxWidth: '800px' }}>
          <button onClick={() => setSelectedMsg(null)} className="btn-secondary flex-row" style={{ marginBottom: '1.5rem', border: 'none', paddingLeft: 0 }}>
            <ArrowLeft size={20} /> Back to Inbox
          </button>

          <div style={{ borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{selectedMsg.subject}</h2>
            <div className="flex-row justify-between text-muted text-sm" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
              <span>From: <b>{selectedMsg.from}</b></span>
              <span>{new Date(selectedMsg.date).toLocaleString()}</span>
            </div>
          </div>

          {extractedOtp && (
            <div style={{ background: 'linear-gradient(135deg, #fff0f5 0%, #ffe6f0 100%)', border: '2px dashed #ffb3d9', borderRadius: '15px', padding: '1.5rem', marginBottom: '2rem', textAlign: 'center', boxShadow: '0 4px 15px rgba(255,105,180,0.1)' }}>
              <div style={{ color: '#ff69b4', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Verification Code
              </div>
              <div className="flex-row" style={{ justifyContent: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#333', letterSpacing: '4px', fontFamily: 'monospace' }}>
                  {extractedOtp}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(extractedOtp);
                    showToast("Code Copied! 📋", "success");
                  }}
                  className="btn-icon"
                  style={{ background: '#ff69b4', color: 'white', padding: '0.6rem', borderRadius: '50%' }}
                  title="Copy Code"
                >
                  <Copy size={20} />
                </button>
              </div>
            </div>
          )}

          <div
            className="email-body"
            dangerouslySetInnerHTML={{ __html: dompurify.sanitize(selectedMsg.html || selectedMsg.text) }}
            style={{ lineHeight: '1.6', color: '#444' }}
          />
        </div>
      ) : !address ? (
        <div className="flex-col w-full items-center">
          <div className="glass-card animate-fade-in" style={{ width: '100%', maxWidth: '520px', padding: '3rem', position: 'relative', overflow: 'visible' }}>
            {/* Decorative Elements */}
            <div style={{ position: 'absolute', top: '-25px', right: '-25px', background: 'white', padding: '1rem', borderRadius: '50%', boxShadow: '0 8px 30px rgba(255,105,180,0.3)', transform: 'rotate(15deg)' }}>
              <Sparkles size={36} color="#FF69B4" fill="#FFC0CB" />
            </div>

            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h3 style={{ marginBottom: '0.8rem', fontSize: '2.5rem', color: '#2d2d2d', lineHeight: 1.2 }}>
                Get Your <br /><span className="text-gradient">Temporary Email</span>
              </h3>
              <p className="text-muted" style={{ fontSize: '1.1rem', lineHeight: 1.5 }}>
                Instant. Anonymous. Auto-expires in 24 hours.<br />No sign-up required.
              </p>
            </div>

            <div className="flex-col" style={{ gap: '1.5rem' }}>
              {/* Domain Selection */}
              <div className="select-wrapper">
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  className="input-field custom-select text-center"
                  style={{ fontWeight: 600, color: '#444' }}
                >
                  {availableDomains.map(d => (
                    <option key={d} value={d}>@{d}</option>
                  ))}
                </select>
              </div>

              {/* Main CTA */}
              <button
                onClick={handleRandom}
                disabled={loading}
                className="btn-primary w-full btn-lg"
                style={{ justifyContent: 'center' }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Sparkles size={20} fill="white" /> Create Instant Email</span>
                {loading && <RefreshCw className="spin" size={24} style={{ marginLeft: 'auto' }} />}
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0' }}>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.1), transparent)' }}></div>
                <span className="text-muted text-sm" style={{ fontFamily: 'Outfit', letterSpacing: '2px', fontWeight: 700, fontSize: '0.75rem', color: '#999' }}>OR ENTER YOUR OWN</span>
                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.1), transparent)' }}></div>
              </div>

              {/* Custom Input Form - STACKED LAYOUT */}
              <form onSubmit={handleCustom} className="flex-col" style={{ gap: '1rem', width: '100%' }}>
                <input
                  type="text"
                  placeholder="e.g. myname"
                  value={customLocal}
                  onChange={(e) => setCustomLocal(e.target.value)}
                  className="input-field text-center"
                  style={{ maxWidth: '100%' }}
                />
                <button
                  type="submit"
                  disabled={loading || !customLocal}
                  className="btn-primary w-full btn-lg"
                  style={{
                    justifyContent: 'center',
                    opacity: customLocal ? 1 : 0.7,
                    marginTop: '0.5rem',
                    background: customLocal ? 'linear-gradient(135deg, #8c52ff 0%, #ff5ac8 100%)' : '#ccc'
                  }}
                >
                  <span style={{ textAlign: 'center' }}>Use This Address</span>
                  <ArrowLeft size={18} style={{ transform: 'rotate(180deg)', marginLeft: '8px' }} />
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card animate-fade-in w-full" style={{ maxWidth: '800px', padding: '0' }}>
          {/* Header */}
          <div style={{ padding: '2rem', background: 'rgba(255,255,255,0.4)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.5)' }}>
            <div className="text-muted text-sm" style={{ letterSpacing: '1px', fontWeight: 600 }}>YOUR TEMPORARY INBOX</div>

            <div className="flex-row" style={{ background: 'linear-gradient(135deg, #fff 0%, #fff0f5 100%)', padding: '0.8rem 1.5rem', borderRadius: '50px', border: '1px solid #ffdbed', boxShadow: '0 8px 16px rgba(255,105,180,0.1)', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '1.3rem', fontWeight: '700', color: '#333', background: 'linear-gradient(90deg, #333, #666)', WebkitBackgroundClip: 'text', textAlign: 'center', wordBreak: 'break-all' }}>
                {address.local}@{address.domain}
              </span>
              <button
                onClick={copyToClipboard}
                className="btn-icon"
                style={{ marginLeft: '0.4rem', color: '#ff69b4', background: 'rgba(255,255,255,0.8)', padding: '0.4rem', borderRadius: '50%' }}
                title="Copy to clipboard"
              >
                <Copy size={18} />
              </button>
            </div>

            <button onClick={handleLogout} className="text-muted text-sm" style={{ background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Trash2 size={14} /> Delete & Create New
            </button>
            {timeRemaining && (
              <div className="text-sm" style={{ fontWeight: 600, color: timeRemaining === 'Expired' ? '#ff4d4d' : '#999', marginTop: '-0.5rem' }}>
                Expires in {timeRemaining}
              </div>
            )}
          </div>

          {/* Inbox List */}
          <div style={{ padding: '0' }}>
            <div className="flex-row justify-between" style={{ padding: '1rem 2rem', borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(255,255,255,0.2)' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#555' }}>Inbox <span style={{ background: '#ff69b4', color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem', verticalAlign: 'middle' }}>{messages.length}</span></h3>
              <button onClick={handleManualRefresh} className="btn-icon" title="Refresh inbox">
                <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
              </button>
            </div>

            <div style={{ maxHeight: '500px', overflowY: 'auto', background: 'rgba(255,255,255,0.3)' }}>
              {messages.length === 0 ? (
                <div style={{ padding: '5rem 2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  <div style={{ background: 'rgba(255,255,255,0.5)', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                    <Mail size={40} style={{ opacity: 0.4, color: '#ff69b4' }} />
                  </div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>No messages yet</p>
                  <p className="text-sm" style={{ opacity: 0.7 }}>Emails sent to this address will appear here automatically.</p>
                </div>
              ) : (
                <div className="flex-col" style={{ gap: '0.8rem', padding: '1rem' }}>
                  {messages.map(msg => {
                    // Extract name from "Name <email>" format if present
                    const senderName = msg.from.split('<')[0].replace(/"/g, '').trim();
                    const initial = senderName.charAt(0).toUpperCase();

                    return (
                      <div
                        key={msg.id}
                        onClick={() => selectMessage(msg.id)}
                        className="message-item"
                        style={{
                          margin: '0',
                          padding: '1rem',
                          background: 'rgba(255,255,255,0.6)',
                          boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '1rem',
                          border: '1px solid rgba(255,255,255,0.5)'
                        }}
                      >
                        {/* Avatar */}
                        <div className="avatar">
                          {initial}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <div className="flex-row justify-between" style={{ marginBottom: 0, flexWrap: 'nowrap' }}>
                            <span className="truncate" style={{ fontWeight: 700, color: '#333', fontSize: '1rem' }}>
                              {senderName}
                            </span>
                            <span className="text-sm text-muted" style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                              {new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className="truncate" style={{ color: '#666', fontSize: '0.95rem' }}>
                            {msg.subject || "(No Subject)"}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Footer & Disclaimer Trigger */}
      <footer style={{ marginTop: 'auto', paddingTop: '2rem', paddingBottom: '1rem', textAlign: 'center' }}>
        <button
          onClick={() => setShowDisclaimer(true)}
          className="text-muted text-sm"
          style={{ background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', opacity: 0.7, transition: 'opacity 0.2s' }}
        >
          Disclaimer & Terms
        </button>
      </footer>

      {/* Disclaimer Modal */}
      {showDisclaimer && (
        <div className="modal-backdrop" onClick={() => setShowDisclaimer(false)}>
          <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
            <div className="flex-row justify-between" style={{ marginBottom: '1rem' }}>
              <h2 style={{ fontSize: '1.5rem', color: '#333' }}>Disclaimer</h2>
              <button
                onClick={() => setShowDisclaimer(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem' }}
              >
                <XCircle size={24} color="#666" />
              </button>
            </div>

            <div className="modal-body text-muted">
              <p><strong>CattyMail</strong> is a disposable email service provided "as is".</p>
              <ul style={{ paddingLeft: '1.2rem', margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <li>Emails are public-facing if anticipated (magic addresses are safer).</li>
                <li>All messages and addresses are strictly deleted after <strong>24 hours</strong>.</li>
                <li>Do not use for banking, legal, or sensitive personal data.</li>
                <li>We are not responsible for lost data or missed messages.</li>
              </ul>
              <p style={{ fontSize: '0.9rem', marginTop: '1.5rem', textAlign: 'center', opacity: 0.8 }}>
                Built by nicola.id
              </p>
            </div>

            <button
              onClick={() => setShowDisclaimer(false)}
              className="btn-primary w-full"
              style={{ marginTop: '1.5rem' }}
            >
              Understood
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
