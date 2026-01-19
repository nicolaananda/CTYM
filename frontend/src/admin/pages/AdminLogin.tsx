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
            // background: transparent - let body mesh show
        }}>
            <div className="glass-card animate-fade-in" style={{
                maxWidth: '400px',
                width: '100%',
                padding: '3rem',
                background: 'rgba(255, 255, 255, 0.8)',
                backdropFilter: 'blur(20px)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                    <div style={{
                        background: 'linear-gradient(135deg, #ff5ac8 0%, #8c52ff 100%)',
                        width: '72px',
                        height: '72px',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 1.5rem',
                        boxShadow: '0 10px 25px rgba(255, 90, 200, 0.4)'
                    }}>
                        <Lock size={32} color="white" />
                    </div>
                    <h1 className="text-gradient" style={{
                        fontSize: '2rem',
                        marginBottom: '0.5rem',
                        fontWeight: 800
                    }}>
                        Admin Access
                    </h1>
                    <p style={{ color: '#666', fontSize: '0.95rem', fontWeight: 500 }}>
                        <Sparkles size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', color: '#ff5ac8' }} />
                        CattyMail System
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, color: '#444', fontSize: '0.9rem' }}>
                            Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="input-field"
                            placeholder="Enter your secure password"
                            style={{ width: '100%' }}
                            required
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div style={{
                            padding: '0.75rem',
                            background: '#fee2e2',
                            color: '#991b1b',
                            borderRadius: '8px',
                            fontSize: '0.9rem',
                            textAlign: 'center',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}>
                            <span style={{ fontWeight: 600 }}>!</span> {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !password}
                        className="btn-primary w-full"
                        style={{
                            width: '100%',
                            justifyContent: 'center',
                            padding: '0.875rem',
                            marginTop: '0.5rem',
                            background: loading ? '#ccc' : undefined
                        }}
                    >
                        {loading ? 'Authenticating...' : 'Login'}
                    </button>
                </form>

                <div style={{
                    marginTop: '2.5rem',
                    textAlign: 'center',
                    color: '#999',
                    fontSize: '0.8rem'
                }}>
                    Protected System • Unauthorized access prohibited
                </div>
            </div>
        </div>
    );
}
