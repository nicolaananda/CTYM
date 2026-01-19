import { useState, useEffect } from 'react';
import { adminApi, type Message } from '../lib/adminApi';
import { Mail, Trash2, Search, RefreshCw, Eye, ArrowLeft, Clock } from 'lucide-react';
import dompurify from 'dompurify';

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

    const handleDelete = async (id: string, e?: React.MouseEvent) => {
        e?.stopPropagation();
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

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '90vh', overflow: 'hidden' }}>
            {/* Header Area */}
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.5)' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#333', letterSpacing: '-0.5px' }}>
                    Email Inspector
                </h1>
                <button
                    onClick={fetchMessages}
                    className="btn-secondary"
                    style={{ background: 'white' }}
                >
                    <RefreshCw size={18} className={loading ? 'spin' : ''} style={{ marginRight: '0.5rem' }} />
                    Refresh
                </button>
            </div>

            {/* Split View Container */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* LEFT: Message List */}
                <div style={{ width: '400px', display: 'flex', flexDirection: 'column', borderRight: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.3)' }}>

                    {/* Search Bar */}
                    <div style={{ padding: '1rem', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                        <div style={{ position: 'relative' }}>
                            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#999' }} />
                            <input
                                type="text"
                                placeholder="Search emails..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input-field"
                                style={{ paddingLeft: '2.8rem', width: '100%', fontSize: '0.9rem', background: 'white' }}
                            />
                        </div>
                    </div>

                    {/* Scrollable List */}
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading...</div>
                        ) : filteredMessages.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No messages found</div>
                        ) : (
                            <div className="flex-col">
                                {filteredMessages.map(msg => {
                                    const isSelected = selectedMessage?.id === msg.id;
                                    return (
                                        <div
                                            key={msg.id}
                                            onClick={() => setSelectedMessage(msg)}
                                            style={{
                                                padding: '1rem',
                                                borderBottom: '1px solid rgba(0,0,0,0.05)',
                                                cursor: 'pointer',
                                                background: isSelected ? 'white' : 'transparent',
                                                borderLeft: isSelected ? '4px solid #8c52ff' : '4px solid transparent',
                                                transition: 'all 0.1s'
                                            }}
                                            className="hover:bg-white/50"
                                        >
                                            <div className="flex-row justify-between" style={{ marginBottom: '0.2rem' }}>
                                                <span className="truncate" style={{ fontWeight: 700, fontSize: '0.95rem', color: '#333', maxWidth: '70%' }}>
                                                    {msg.from.split('<')[0].replace(/"/g, '')}
                                                </span>
                                                <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                    {new Date(msg.date).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div style={{ fontWeight: 500, fontSize: '0.9rem', color: '#444', marginBottom: '0.2rem' }} className="truncate">
                                                {msg.subject || '(No Subject)'}
                                            </div>
                                            <div className="truncate text-muted" style={{ fontSize: '0.8rem' }}>
                                                → {msg.original_to}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT: Message Detail */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0', background: 'rgba(255,255,255,0.6)', display: 'flex', flexDirection: 'column' }}>
                    {selectedMessage ? (
                        <div className="animate-fade-in" style={{ padding: '2rem', maxWidth: '900px', margin: '0 auto', width: '100%' }}>

                            {/* Toolbar */}
                            <div className="flex-row justify-between" style={{ marginBottom: '2rem' }}>
                                <span className="badge badge-success">Received</span>
                                <button
                                    onClick={() => handleDelete(selectedMessage.id)}
                                    className="btn-secondary"
                                    style={{ color: '#ff4d4d', borderColor: 'rgba(255,77,77,0.3)' }}
                                >
                                    <Trash2 size={18} style={{ marginRight: '0.5rem' }} /> Delete
                                </button>
                            </div>

                            {/* Header */}
                            <div style={{ marginBottom: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid rgba(0,0,0,0.1)' }}>
                                <h2 style={{ fontSize: '1.8rem', lineHeight: 1.3, marginBottom: '1rem', color: '#2d2d2d' }}>
                                    {selectedMessage.subject || '(No Subject)'}
                                </h2>

                                <div className="flex-row" style={{ gap: '1rem', alignItems: 'flex-start' }}>
                                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 700, color: '#666' }}>
                                        {selectedMessage.from.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#333' }}>{selectedMessage.from}</div>
                                        <div className="text-muted" style={{ fontSize: '0.9rem' }}>To: {selectedMessage.original_to}</div>
                                        <div className="flex-row text-muted" style={{ fontSize: '0.85rem', marginTop: '0.3rem', gap: '0.5rem' }}>
                                            <Clock size={14} />
                                            {new Date(selectedMessage.date).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Body */}
                            <div
                                className="email-body"
                                dangerouslySetInnerHTML={{ __html: dompurify.sanitize(selectedMessage.html || selectedMessage.text) }}
                                style={{
                                    background: 'white',
                                    padding: '2rem',
                                    borderRadius: '12px',
                                    boxShadow: '0 2px 10px rgba(0,0,0,0.02)',
                                    minHeight: '300px',
                                    fontFamily: 'Inter, sans-serif'
                                }}
                            />
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#999', opacity: 0.6 }}>
                            <Mail size={80} strokeWidth={1} style={{ marginBottom: '1rem' }} />
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 400 }}>Select a message to view</h3>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
