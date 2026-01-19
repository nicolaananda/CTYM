import { useState, useEffect } from 'react';
import { adminApi, type Message } from '../lib/adminApi';
import { Mail, Trash2, Search, RefreshCw, Eye } from 'lucide-react';

export default function EmailViewer() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

    const fetchMessages = async () => {
        setLoading(true);
        try {
            const data = await adminApi.getMessages(0, 100);
            setMessages(data.messages || []);
        } catch (err) {
            console.error('Failed to fetch messages', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this message?')) return;

        try {
            await adminApi.deleteMessage(id);
            setMessages(messages.filter(m => m.id !== id));
            if (selectedMessage?.id === id) {
                setSelectedMessage(null);
            }
        } catch (err) {
            alert('Failed to delete message');
        }
    };

    const filteredMessages = messages.filter(m =>
        m.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.original_to.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (selectedMessage) {
        return (
            <div style={{ padding: '2rem' }}>
                <button
                    onClick={() => setSelectedMessage(null)}
                    className="btn-secondary"
                    style={{ marginBottom: '1rem' }}
                >
                    ← Back to List
                </button>

                <div className="glass-card" style={{ padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>{selectedMessage.subject}</h2>
                    <div style={{ marginBottom: '1rem', color: '#666' }}>
                        <div><strong>From:</strong> {selectedMessage.from}</div>
                        <div><strong>To:</strong> {selectedMessage.original_to}</div>
                        <div><strong>Date:</strong> {new Date(selectedMessage.date).toLocaleString()}</div>
                    </div>
                    <div
                        dangerouslySetInnerHTML={{ __html: selectedMessage.html || selectedMessage.text }}
                        style={{
                            padding: '1rem',
                            background: '#f9f9f9',
                            borderRadius: '8px',
                            minHeight: '200px'
                        }}
                    />
                    <button
                        onClick={() => handleDelete(selectedMessage.id)}
                        className="btn-primary"
                        style={{ marginTop: '1rem', background: '#ff4d4d' }}
                    >
                        <Trash2 size={18} /> Delete Message
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>
                    <Mail size={32} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
                    Email Viewer
                </h1>
                <button onClick={fetchMessages} className="btn-secondary">
                    <RefreshCw size={18} className={loading ? 'spin' : ''} /> Refresh
                </button>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ position: 'relative' }}>
                    <Search size={20} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                    <input
                        type="text"
                        placeholder="Search by sender, subject, or recipient..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="input-field"
                        style={{ paddingLeft: '3rem', width: '100%' }}
                    />
                </div>
            </div>

            <div className="glass-card" style={{ padding: '1rem' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '2rem' }}>
                        <RefreshCw className="spin" size={32} color="#667eea" />
                    </div>
                ) : filteredMessages.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#999' }}>
                        <Mail size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                        <p>No messages found</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {filteredMessages.map(msg => (
                            <div
                                key={msg.id}
                                style={{
                                    padding: '1rem',
                                    background: '#f9f9f9',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    transition: 'all 0.2s',
                                    cursor: 'pointer'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                                onMouseLeave={(e) => e.currentTarget.style.background = '#f9f9f9'}
                            >
                                <div style={{ flex: 1 }} onClick={() => setSelectedMessage(msg)}>
                                    <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{msg.subject || '(No Subject)'}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                                        From: {msg.from} → To: {msg.original_to}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '0.25rem' }}>
                                        {new Date(msg.date).toLocaleString()}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedMessage(msg);
                                        }}
                                        className="btn-icon"
                                        title="View"
                                    >
                                        <Eye size={18} />
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(msg.id);
                                        }}
                                        className="btn-icon"
                                        title="Delete"
                                        style={{ color: '#ff4d4d' }}
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ marginTop: '1rem', textAlign: 'center', color: '#999', fontSize: '0.9rem' }}>
                Showing {filteredMessages.length} of {messages.length} messages
            </div>
        </div>
    );
}
