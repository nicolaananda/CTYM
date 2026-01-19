import { useState, useEffect } from 'react';
import { adminApi } from '../lib/adminApi';
import { Globe, Plus, Trash2, RefreshCw } from 'lucide-react';

interface Domain {
    name: string;
    source: 'system' | 'custom';
}

export default function DomainManagement() {
    const [domains, setDomains] = useState<Domain[]>([]);
    const [loading, setLoading] = useState(true);
    const [newDomain, setNewDomain] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState('');

    const fetchDomains = async () => {
        setLoading(true);
        try {
            // @ts-ignore - Updated API signature
            const data = await adminApi.getDomainsWithSource();
            setDomains(data);
        } catch (err) {
            console.error('Failed to fetch domains', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDomains();
    }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDomain) return;

        setAdding(true);
        setError('');
        try {
            await adminApi.addDomain(newDomain);
            setNewDomain('');
            fetchDomains();
        } catch (err) {
            setError('Failed to add domain');
        } finally {
            setAdding(false);
        }
    };

    const handleDelete = async (domain: string) => {
        if (!confirm(`Are you sure you want to delete ${domain}?`)) return;

        try {
            await adminApi.removeDomain(domain);
            setDomains(domains.filter(d => d.name !== domain));
        } catch (err) {
            alert('Failed to delete domain');
        }
    };

    return (
        <div className="flex-col gap-4">
            <div className="flex-row justify-end mb-4">
                <button onClick={fetchDomains} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <RefreshCw size={18} className={loading ? 'spin' : ''} />
                    Refresh Data
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {/* Add Domain Card */}
                <div className="glass-card" style={{ padding: '2rem', height: 'fit-content' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={20} /> Add New Domain
                    </h2>
                    <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666', fontWeight: 500 }}>
                                Domain Name
                            </label>
                            <input
                                type="text"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                className="input-field"
                                placeholder="e.g. example.com"
                                style={{ width: '100%' }}
                            />
                        </div>
                        {error && (
                            <div style={{
                                padding: '0.75rem',
                                background: '#fee2e2',
                                color: '#991b1b',
                                borderRadius: '8px',
                                fontSize: '0.9rem'
                            }}>
                                {error}
                            </div>
                        )}

                        <div style={{
                            padding: '1rem',
                            background: 'rgba(102, 126, 234, 0.1)',
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            color: '#4a5568',
                            borderLeft: '4px solid #667eea',
                            lineHeight: 1.5
                        }}>
                            <strong>Note:</strong> Make sure to configure DNS MX records for this domain to point to this server.
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={adding || !newDomain}
                            style={{ width: '100%', justifyContent: 'center' }}
                        >
                            {adding ? <RefreshCw className="spin" size={18} /> : <Plus size={18} />}
                            Add Domain
                        </button>
                    </form>
                </div>

                {/* Domain List */}
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(0,0,0,0.05)', background: 'rgba(255,255,255,0.3)' }}>
                        <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Active Domains</h2>
                    </div>

                    <div className="admin-table-container" style={{ margin: '1rem', boxShadow: 'none', background: 'transparent', border: 'none' }}>
                        {domains.length === 0 ? (
                            <div style={{ padding: '3rem', textAlign: 'center', color: '#999' }}>
                                No domains found.
                            </div>
                        ) : (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>Domain Name</th>
                                        <th>Source</th>
                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {domains.map((d, idx) => (
                                        <tr key={idx}>
                                            <td style={{ fontWeight: 600 }}>{d.name}</td>
                                            <td>
                                                <span className={`badge ${d.source === 'system' ? 'badge-info' : 'badge-success'}`}>
                                                    {d.source === 'system' ? 'System (Env)' : 'Custom (DB)'}
                                                </span>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                {d.source === 'custom' ? (
                                                    <button
                                                        onClick={() => handleDelete(d.name)}
                                                        className="btn-secondary"
                                                        style={{
                                                            padding: '0.4rem 0.6rem',
                                                            color: '#ff4d4d',
                                                            borderColor: 'rgba(255, 77, 77, 0.2)',
                                                            fontSize: '0.8rem'
                                                        }}
                                                        title="Delete Domain"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                ) : (
                                                    <span style={{ fontSize: '0.8rem', color: '#ccc', fontStyle: 'italic' }}>
                                                        Protected
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
