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

      <header style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '1.5rem 5%', display: 'flex', zIndex: 10 }}>
        <h1 style={{ color: '#e50914', fontSize: '2.5rem', letterSpacing: '-1px', textTransform: 'uppercase', margin: 0, fontWeight: 900 }}>CattyMail</h1>
      </header>

      {selectedMsg ? (
        <div className="glass-card animate-fade-in w-full" style={{ maxWidth: '800px', marginTop: '4rem', background: '#181818', border: 'none', borderRadius: '4px' }}>
          <button onClick={() => setSelectedMsg(null)} className="btn-secondary flex-row" style={{ marginTop: '-1rem', marginBottom: '1.5rem', border: 'none', paddingLeft: 0, background: 'transparent', color: '#b3b3b3' }}>
            <ArrowLeft size={20} /> <span style={{ marginLeft: '0.4rem' }}>Back to Inbox</span>
          </button>

          <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#fff' }}>{selectedMsg.subject}</h2>
            <div className="flex-row justify-between text-muted text-sm" style={{ flexWrap: 'wrap', gap: '0.5rem', color: '#b3b3b3' }}>
              <span>From: <b style={{ color: '#fff' }}>{selectedMsg.from}</b></span>
              <span>{new Date(selectedMsg.date).toLocaleString()}</span>
            </div>
          </div>

          {extractedOtp && (
            <div style={{ background: '#333', border: '1px solid #444', borderRadius: '4px', padding: '1.5rem', marginBottom: '2rem', textAlign: 'center' }}>
              <div style={{ color: '#b3b3b3', fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Verification Code
              </div>
              <div className="flex-row" style={{ justifyContent: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 800, color: '#fff', letterSpacing: '4px', fontFamily: 'monospace' }}>
                  {extractedOtp}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(extractedOtp);
                    showToast("Code Copied! 📋", "success");
                  }}
                  className="btn-icon"
                  style={{ background: '#e50914', color: 'white', padding: '0.6rem', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
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
            style={{ lineHeight: '1.6', color: '#000', background: '#fff', padding: '2rem', borderRadius: '4px' }}
          />
        </div>
      ) : !address ? (
        <div className="flex-col w-full items-center justify-center animate-fade-in" style={{ minHeight: '80vh', textAlign: 'center', padding: '0 20px', zIndex: 5, position: 'relative' }}>
          <div style={{ maxWidth: '900px', width: '100%' }}>
            <h1 style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', fontWeight: 900, marginBottom: '1rem', lineHeight: 1.1, color: '#fff' }}>Unlimited temporary emails, <br />inboxes, and more</h1>
            <p style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#fff', fontWeight: 500 }}>Read anywhere. Cancel anytime.</p>
            <p style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: '#fff', fontWeight: 400 }}>Ready to read? Enter a username or generate a random one to auto-create an inbox.</p>

            <form onSubmit={handleCustom} className="flex-row" style={{ gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '2rem' }}>
              <div style={{ flex: '1 1 auto', minWidth: '300px', maxWidth: '500px', display: 'flex', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px', overflow: 'hidden' }}>
                <input
                  type="text"
                  placeholder="Email address"
                  value={customLocal}
                  onChange={(e) => setCustomLocal(e.target.value)}
                  style={{ flex: 1, background: 'transparent', border: 'none', padding: '1.25rem 1rem', color: 'white', fontSize: '1rem', outline: 'none' }}
                />
                <select
                  value={selectedDomain}
                  onChange={(e) => setSelectedDomain(e.target.value)}
                  style={{ background: 'transparent', border: 'none', borderLeft: '1px solid rgba(255,255,255,0.4)', padding: '0 1rem', color: '#fff', fontSize: '1rem', outline: 'none', cursor: 'pointer', appearance: 'none', minWidth: '120px' }}
                >
                  {availableDomains.map(d => (
                    <option key={d} value={d} style={{ color: 'black' }}>@{d}</option>
                  ))}
                </select>
              </div>

              <button
                type={customLocal ? "submit" : "button"}
                onClick={(e) => {
                  if (!customLocal) { e.preventDefault(); handleRandom(); }
                }}
                disabled={loading}
                className="btn-primary btn-lg"
                style={{ fontSize: '1.5rem', padding: '0.8rem 2rem', fontWeight: 700, borderRadius: '4px', whiteSpace: 'nowrap' }}
              >
                {loading ? <RefreshCw className="spin" size={24} /> : (customLocal ? 'Get Started >' : 'Random >')}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="animate-fade-in w-full" style={{ maxWidth: '1000px', marginTop: '4rem', padding: '0 20px' }}>
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
            <h2 style={{ color: '#fff', fontSize: '1.8rem', fontWeight: 600, margin: 0 }}>
              Inbox <span style={{ fontSize: '1rem', color: '#b3b3b3', fontWeight: 400, marginLeft: '0.5rem' }}>({messages.length})</span>
            </h2>
            <div className="flex-row" style={{ gap: '0.5rem' }}>
              <div style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', padding: '0.5rem 1rem', borderRadius: '4px', color: '#fff', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 600 }}>{address.local}</span><span style={{ color: '#b3b3b3' }}>@{address.domain}</span>
                <button onClick={copyToClipboard} style={{ background: 'none', border: 'none', color: '#b3b3b3', padding: '0 0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Copy email">
                  <Copy size={16} />
                </button>
              </div>
              <button onClick={handleManualRefresh} className="btn-icon" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Refresh inbox">
                <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
              </button>
              <button onClick={handleLogout} className="btn-icon" style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(229, 9, 20, 0.4)', color: '#e50914', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Delete address">
                <Trash2 size={18} />
              </button>
            </div>
          </div>

          {timeRemaining && (
            <div style={{ color: timeRemaining === 'Expired' ? '#e50914' : '#b3b3b3', fontSize: '0.85rem', marginBottom: '1.5rem', textAlign: 'right' }}>
              Expires in {timeRemaining}
            </div>
          )}

          {/* Inbox List resembling a Netflix Row / Stack */}
          <div style={{ background: '#181818', borderRadius: '4px', overflow: 'hidden', border: '1px solid #333' }}>
            {messages.length === 0 ? (
              <div style={{ padding: '4rem 2rem', textAlign: 'center', color: '#b3b3b3' }}>
                <Mail size={48} style={{ opacity: 0.3, marginBottom: '1rem', color: '#fff' }} />
                <p style={{ fontSize: '1.2rem', fontWeight: 500, color: '#fff' }}>No messages yet</p>
                <p style={{ fontSize: '0.95rem', marginTop: '0.5rem' }}>Auto-refreshing... Emails sent to this address will appear here.</p>
              </div>
            ) : (
              <div className="flex-col" style={{ gap: '1px', background: '#333' }}>
                {messages.map(msg => {
                  const senderName = msg.from.split('<')[0].replace(/"/g, '').trim();
                  const initial = senderName.charAt(0).toUpperCase();

                  return (
                    <div
                      key={msg.id}
                      onClick={() => selectMessage(msg.id)}
                      className="message-item"
                      style={{
                        padding: '1.2rem 1.5rem',
                        background: '#181818',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1.2rem',
                        cursor: 'pointer',
                        margin: 0,
                        border: 'none',
                        borderBottom: '1px solid #333',
                        borderRadius: 0,
                        transition: 'background 0.2s'
                      }}
                    >
                      <div className="avatar" style={{ background: '#e50914', color: '#fff', width: '40px', height: '40px', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        {initial}
                      </div>

                      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        <div className="flex-row justify-between" style={{ marginBottom: 0, flexWrap: 'nowrap' }}>
                          <span className="truncate" style={{ fontWeight: 600, color: '#fff', fontSize: '1.05rem' }}>
                            {senderName}
                          </span>
                          <span style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', color: '#b3b3b3' }}>
                            {new Date(msg.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="truncate" style={{ color: '#b3b3b3', fontSize: '0.95rem' }}>
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
