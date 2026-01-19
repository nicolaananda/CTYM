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
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>
                    <Globe size={32} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    Domain Management
                </h1>
                <button onClick={fetchDomains} className="btn-secondary">
                    <RefreshCw size={18} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                {/* Add Domain Card */}
                <div className="glass-card" style={{ padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Add New Domain</h2>
                    <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: '#666' }}>
                                Domain Name (e.g. example.com)
                            </label>
                            <input
                                type="text"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                className="input-field"
                                placeholder="Enter domain..."
                                style={{ width: '100%' }}
                            />
                        </div>
                        {error && <div style={{ color: '#ff4d4d', fontSize: '0.9rem' }}>{error}</div>}

                        <div style={{
                            padding: '1rem',
                            background: '#f0f4ff',
                            borderRadius: '8px',
                            fontSize: '0.85rem',
                            color: '#555',
                            borderLeft: '4px solid #667eea'
                        }}>
                            <strong>Note:</strong> Make sure to configure MX records for this domain to point to your server, and set up forwarding if needed in your DNS/Mail Provider.
                        </div>

                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={adding || !newDomain}
                            style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}
                        >
                            {adding ? <RefreshCw className="spin" size={18} /> : <Plus size={18} />}
                            Add Domain
                        </button>
                    </form>
                </div>

                {/* Domain List */}
                <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
                    <div style={{ padding: '1.5rem', borderBottom: '1px solid #eee' }}>
                        <h2 style={{ fontSize: '1.25rem' }}>Active Domains</h2>
                    </div>

                    {domains.length === 0 ? (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No domains found</div>
                    ) : (
                        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                            {domains.map((d, idx) => (
                                <div key={idx} style={{
                                    padding: '1rem 1.5rem',
                                    borderBottom: '1px solid #f0f0f0',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{d.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: d.source === 'system' ? '#666' : '#667eea' }}>
                                            Source: {d.source === 'system' ? 'System (Env)' : 'Custom (DB)'}
                                        </div>
                                    </div>

                                    {d.source === 'custom' && (
                                        <button
                                            onClick={() => handleDelete(d.name)}
                                            className="btn-icon"
                                            title="Delete Domain"
                                            style={{ color: '#ff4d4d' }}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                    {d.source === 'system' && (
                                        <div title="Cannot delete system domain" style={{ opacity: 0.3 }}>
                                            <Trash2 size={18} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
