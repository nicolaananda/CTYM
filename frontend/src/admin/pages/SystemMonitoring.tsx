import { useState, useEffect } from 'react';
import { adminApi } from '../lib/adminApi';
import { Activity, Database, Server, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

export default function SystemMonitoring() {
    const [health, setHealth] = useState<{ redis: string; imap: string } | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchHealth = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getHealth();
            setHealth(data);
        } catch (err) {
            console.error('Failed to fetch health', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 10000); // Every 10s
        return () => clearInterval(interval);
    }, []);

    const getStatusIcon = (status: string) => {
        if (status === 'connected' || status === 'ok') {
            return <CheckCircle size={24} color="#4CAF50" />;
        }
        return <XCircle size={24} color="#ff4d4d" />;
    };

    const getStatusColor = (status: string) => {
        if (status === 'connected' || status === 'ok') return '#4CAF50';
        return '#ff4d4d';
    };

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>
                    <Activity size={32} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    System Monitoring
                </h1>
                <button onClick={fetchHealth} className="btn-secondary">
                    <RefreshCw size={18} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {/* Redis Status */}
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #ff6b6b, #ee5a6f)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <Database size={28} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>Redis</h3>
                            <p style={{ fontSize: '0.85rem', color: '#666' }}>Database</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {health && getStatusIcon(health.redis)}
                        <span style={{
                            fontWeight: 600,
                            color: health ? getStatusColor(health.redis) : '#999',
                            textTransform: 'capitalize'
                        }}>
                            {health?.redis || 'Unknown'}
                        </span>
                    </div>
                </div>

                {/* IMAP Status */}
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '12px',
                            background: 'linear-gradient(135deg, #667eea, #764ba2)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white'
                        }}>
                            <Server size={28} />
                        </div>
                        <div>
                            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.25rem' }}>IMAP</h3>
                            <p style={{ fontSize: '0.85rem', color: '#666' }}>Mail Server</p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {health && getStatusIcon(health.imap)}
                        <span style={{
                            fontWeight: 600,
                            color: health ? getStatusColor(health.imap) : '#999',
                            textTransform: 'capitalize'
                        }}>
                            {health?.imap || 'Unknown'}
                        </span>
                    </div>
                </div>
            </div>

            {/* System Info */}
            <div className="glass-card" style={{ padding: '2rem', marginTop: '1.5rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>System Information</h2>
                <div style={{ display: 'grid', gap: '1rem' }}>
                    <InfoRow label="Application" value="CattyMail Admin Panel" />
                    <InfoRow label="Version" value="1.0.0" />
                    <InfoRow label="Environment" value="Production" />
                    <InfoRow label="Last Check" value={new Date().toLocaleString()} />
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '0.75rem',
            background: '#f9f9f9',
            borderRadius: '8px'
        }}>
            <span style={{ fontWeight: 600, color: '#666' }}>{label}</span>
            <span style={{ color: '#333' }}>{value}</span>
        </div>
    );
}
