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
        <div className="flex-col gap-4">
            <div className="flex-row justify-between mb-4">
                <div className="text-muted">Overview of system performance</div>
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
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '1.5rem',
                marginBottom: '2rem'
            }}>
                <StatCard
                    title="Total Addresses"
                    value={stats?.totalAddresses || 0}
                    icon={<Users size={28} />}
                    color="#ff5ac8"
                />
                <StatCard
                    title="Total Messages"
                    value={stats?.totalMessages || 0}
                    icon={<Mail size={28} />}
                    color="#8c52ff"
                />
                <StatCard
                    title="Active Addresses"
                    value={stats?.activeAddresses || 0}
                    icon={<Activity size={28} />}
                    color="#34d399"
                />
                <StatCard
                    title="Messages (24h)"
                    value={stats?.messagesLast24h || 0}
                    icon={<TrendingUp size={28} />}
                    color="#fbbf24"
                />
            </div>

            {/* Domain Stats - Redesigned as Table */}
            <div className="admin-table-container">
                <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                    <h3 style={{ fontSize: '1.2rem', color: '#444' }}>Top Domains by Volume</h3>
                </div>
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th>Domain</th>
                            <th>Usage Distribution</th>
                            <th style={{ textAlign: 'right' }}>Message Count</th>
                        </tr>
                    </thead>
                    <tbody>
                        {stats?.topDomains && stats.topDomains.length > 0 ? (
                            stats.topDomains.map((item, idx) => (
                                <tr key={idx}>
                                    <td style={{ fontWeight: 600, color: '#555' }}>
                                        {item.domain}
                                    </td>
                                    <td style={{ width: '50%' }}>
                                        <div style={{ background: 'rgba(0,0,0,0.05)', borderRadius: '8px', height: '12px', overflow: 'hidden', width: '100%' }}>
                                            <div style={{
                                                width: `${Math.min((item.count / (stats.topDomains[0]?.count || 1)) * 100, 100)}%`,
                                                height: '100%',
                                                background: 'linear-gradient(90deg, #ff5ac8, #8c52ff)',
                                                borderRadius: '8px',
                                                transition: 'width 0.5s ease-out'
                                            }} />
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'Outfit' }}>
                                        {item.count.toLocaleString()}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={3} className="text-center" style={{ padding: '3rem', color: '#999' }}>
                                    No domain statistics available yet.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
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
        <div className="stat-card-enhanced">
            <div className="stat-icon-wrapper" style={{ color: color }}>
                {icon}
            </div>
            <div style={{ fontSize: '0.9rem', color: '#888', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.5px' }}>
                {title}
            </div>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, marginTop: '0.5rem', color: '#2d2d2d' }}>
                {value.toLocaleString()}
            </div>
        </div>
    );
}
