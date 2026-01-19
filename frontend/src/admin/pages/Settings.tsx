import { useState, useEffect } from 'react';
import { adminApi } from '../lib/adminApi';
import { Settings as SettingsIcon, Save, RefreshCw, Server, Mail } from 'lucide-react';

interface SettingsData {
    imap_host: string;
    imap_port: number;
    imap_user: string;
    source: string;
}

export default function Settings() {
    const [settings, setSettings] = useState<SettingsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [newPass, setNewPass] = useState('');

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getSettings();
            setSettings(data);
        } catch (err) {
            console.error('Failed to fetch settings', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;

        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            await adminApi.updateSettings({
                imap_host: settings.imap_host,
                imap_port: settings.imap_port,
                imap_user: settings.imap_user,
                imap_pass: newPass // Only sending if set, handled by backend? backend expects pass
            });
            setMessage({ type: 'success', text: 'Settings updated successfully' });
            // Reload to confirming source change
            fetchSettings();
        } catch (err) {
            setMessage({ type: 'error', text: 'Failed to update settings' });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading settings...</div>;
    if (!settings) return <div className="p-8 text-center">Failed to load settings</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>

            <div className="glass-card" style={{ maxWidth: '600px', padding: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Server size={20} /> IMAP Configuration
                </h2>

                {message.text && (
                    <div style={{
                        padding: '1rem',
                        borderRadius: '8px',
                        marginBottom: '1.5rem',
                        background: message.type === 'success' ? '#dcfce7' : '#fee2e2',
                        color: message.type === 'success' ? '#166534' : '#991b1b',
                        fontSize: '0.9rem'
                    }}>
                        {message.text}
                    </div>
                )}

                <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(240, 244, 255, 0.5)', borderRadius: '8px' }}>
                    <span style={{ fontSize: '0.9rem', color: '#666', marginRight: '0.5rem' }}>Current Configuration Source:</span>
                    <span className={`badge ${settings.source === 'system' ? 'badge-info' : 'badge-success'}`}>
                        {settings.source === 'system' ? 'Environment Variables' : 'Custom (Database)'}
                    </span>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#444' }}>IMAP Host</label>
                        <input
                            type="text"
                            className="input-field"
                            value={settings.imap_host}
                            onChange={(e) => setSettings({ ...settings, imap_host: e.target.value })}
                            placeholder="mail.example.com"
                            style={{ width: '100%' }}
                            required
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#444' }}>Port</label>
                            <input
                                type="number"
                                className="input-field"
                                value={settings.imap_port}
                                onChange={(e) => setSettings({ ...settings, imap_port: parseInt(e.target.value) })}
                                placeholder="993"
                                style={{ width: '100%' }}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#444' }}>
                            <Mail size={14} style={{ display: 'inline', verticalAlign: 'baseline', marginRight: '4px' }} />
                            Username / Email
                        </label>
                        <input
                            type="text"
                            className="input-field"
                            value={settings.imap_user}
                            onChange={(e) => setSettings({ ...settings, imap_user: e.target.value })}
                            placeholder="user@example.com"
                            style={{ width: '100%' }}
                            required
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.9rem', color: '#444' }}>Password</label>
                        <input
                            type="password"
                            className="input-field"
                            value={newPass}
                            onChange={(e) => setNewPass(e.target.value)}
                            placeholder={settings.source === 'system' ? '(Hidden from Environment)' : '(Leave blank to keep unchanged)'}
                            style={{ width: '100%' }}
                        />
                        <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
                            {settings.source === 'system'
                                ? 'Password is hidden when using Environment Variables. Enter a new password to override.'
                                : 'Leave blank to keep the current password.'}
                        </p>
                    </div>

                    <button
                        type="submit"
                        className="btn-primary"
                        disabled={saving}
                        style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '0.5rem', width: '100%' }}
                    >
                        {saving ? <RefreshCw className="spin" size={18} /> : <Save size={18} />}
                        Save Configuration
                    </button>
                </form>
            </div>
        </div>
    );
}
