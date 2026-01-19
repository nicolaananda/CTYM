import { useState, useEffect } from 'react';
import { adminApi, type AdminStats } from '../lib/adminApi';
import { BarChart3, Mail, Users, Activity, TrendingUp, RefreshCw } from 'lucide-react';

export default function Dashboard() {
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchStats = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await adminApi.getStats();
            setStats(data);
        } catch (err) {
            setError('Failed to load statistics');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchStats, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading && !stats) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                <RefreshCw className="spin" size={40} color="#667eea" />
                <p style={{ marginTop: '1rem', color: '#666' }}>Loading statistics...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#c33' }}>
                {error}
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#333' }}>
                    <BarChart3 size={32} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    Dashboard
                </h1>
                <button
                    onClick={fetchStats}
                    className="btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                >
                    <RefreshCw size={18} className={loading ? 'spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                <StatCard
                    title="Total Addresses"
                    value={stats?.totalAddresses || 0}
                    icon={<Users size={32} />}
                    color="#667eea"
                />
                <StatCard
                    title="Total Messages"
                    value={stats?.totalMessages || 0}
                    icon={<Mail size={32} />}
                    color="#764ba2"
                />
                <StatCard
                    title="Active Addresses"
                    value={stats?.activeAddresses || 0}
                    icon={<Activity size={32} />}
                    color="#f093fb"
                />
                <StatCard
                    title="Messages (24h)"
                    value={stats?.messagesLast24h || 0}
                    icon={<TrendingUp size={32} />}
                    color="#4facfe"
                />
            </div>

            {/* Domain Stats */}
            <div className="glass-card" style={{ padding: '2rem' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem', color: '#333' }}>
                    Messages by Domain
                </h2>
                {stats?.topDomains && stats.topDomains.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {stats.topDomains.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <div style={{
                                    minWidth: '200px',
                                    fontWeight: 600,
                                    color: '#555'
                                }}>
                                    {item.domain}
                                </div>
                                <div style={{ flex: 1, background: '#f0f0f0', borderRadius: '8px', height: '32px', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{
                                        width: `${Math.min((item.count / (stats.topDomains[0]?.count || 1)) * 100, 100)}%`,
                                        height: '100%',
                                        background: 'linear-gradient(90deg, #667eea, #764ba2)',
                                        borderRadius: '8px',
                                        transition: 'width 0.3s'
                                    }} />
                                </div>
                                <div style={{
                                    minWidth: '60px',
                                    textAlign: 'right',
                                    fontWeight: 700,
                                    color: '#667eea'
                                }}>
                                    {item.count}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ color: '#999', textAlign: 'center', padding: '2rem' }}>
                        No domain statistics available
                    </p>
                )}
            </div>
        </div>
    );
}

interface StatCardProps {
    title: string;
    value: number;
    icon: React.ReactNode;
    color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
    return (
        <div className="glass-card" style={{
            padding: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            transition: 'transform 0.2s, box-shadow 0.2s',
            cursor: 'default'
        }}
            onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.12)';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '';
            }}
        >
            <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '12px',
                background: `linear-gradient(135deg, ${color}, ${color}dd)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                flexShrink: 0
            }}>
                {icon}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                    {title}
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: '#333' }}>
                    {value.toLocaleString()}
                </div>
            </div>
        </div>
    );
}
