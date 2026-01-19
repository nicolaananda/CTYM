import { useState } from 'react';
import { adminApi } from '../lib/adminApi';
import { Lock, Sparkles } from 'lucide-react';

interface AdminLoginProps {
    onLoginSuccess: () => void;
}

export default function AdminLogin({ onLoginSuccess }: AdminLoginProps) {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await adminApi.login(password);
            onLoginSuccess();
        } catch (err) {
            setError('Invalid password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
        }}>
            <div className="glass-card animate-fade-in" style={{
                maxWidth: '400px',
                width: '100%',
                padding: '3rem',
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(10px)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
                    }}>
                        <Lock size={40} color="white" />
                    </div>
                    <h1 style={{
                        fontSize: '2rem',
                        marginBottom: '0.5rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        <Sparkles size={24} style={{ display: 'inline', marginRight: '0.5rem' }} />
                        Admin Panel
                    </h1>
                    <p style={{ color: '#666', fontSize: '0.95rem' }}>CattyMail Administration</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '0.5rem',
                            fontWeight: 600,
                            color: '#333',
                            fontSize: '0.9rem'
                        }}>
                            Admin Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field"
                            placeholder="Enter admin password"
                            style={{
                                width: '100%',
                                padding: '0.75rem 1rem',
                                fontSize: '1rem',
                                border: '2px solid #e0e0e0',
                                borderRadius: '8px',
                                transition: 'all 0.2s'
                            }}
                            required
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            background: '#fee',
                            border: '1px solid #fcc',
                            borderRadius: '8px',
                            color: '#c33',
                            fontSize: '0.9rem',
                            textAlign: 'center'
                        }}>
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="btn-primary w-full"
                        style={{
                            padding: '0.875rem',
                            fontSize: '1rem',
                            fontWeight: 600,
                            background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)'
                        }}
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <div style={{
                    marginTop: '2rem',
                    paddingTop: '1.5rem',
                    borderTop: '1px solid #e0e0e0',
                    textAlign: 'center'
                }}>
                    <p style={{ fontSize: '0.85rem', color: '#999' }}>
                        Secure admin access • CattyMail v1.0
                    </p>
                </div>
            </div>
        </div>
    );
}
