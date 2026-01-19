import { useState, useEffect } from 'react';
import { adminApi } from './lib/adminApi';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import EmailViewer from './pages/EmailViewer';
import SystemMonitoring from './pages/SystemMonitoring';
import { LayoutDashboard, Mail, Activity, LogOut, Menu, X } from 'lucide-react';

type Page = 'dashboard' | 'emails' | 'monitoring';

export default function AdminApp() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentPage, setCurrentPage] = useState<Page>('dashboard');
    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        setIsAuthenticated(adminApi.isAuthenticated());
    }, []);

    const handleLogout = () => {
        adminApi.logout();
        setIsAuthenticated(false);
    };

    if (!isAuthenticated) {
        return <AdminLogin onLoginSuccess={() => setIsAuthenticated(true)} />;
    }

    const menuItems = [
        { id: 'dashboard' as Page, label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { id: 'emails' as Page, label: 'Email Viewer', icon: <Mail size={20} /> },
        { id: 'monitoring' as Page, label: 'Monitoring', icon: <Activity size={20} /> },
    ];

    return (
        <div style={{ display: 'flex', minHeight: '100vh', background: '#f5f5f5' }}>
            {/* Sidebar */}
            <div style={{
                width: sidebarOpen ? '260px' : '0',
                background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                transition: 'width 0.3s',
                overflow: 'hidden',
                position: 'relative',
                boxShadow: '2px 0 10px rgba(0,0,0,0.1)'
            }}>
                <div style={{ padding: '2rem 1.5rem' }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        CattyMail
                    </h2>
                    <p style={{ fontSize: '0.85rem', opacity: 0.8 }}>Admin Panel</p>
                </div>

                <nav style={{ padding: '0 1rem' }}>
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setCurrentPage(item.id)}
                            style={{
                                width: '100%',
                                padding: '0.875rem 1rem',
                                marginBottom: '0.5rem',
                                background: currentPage === item.id ? 'rgba(255,255,255,0.2)' : 'transparent',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                fontSize: '0.95rem',
                                fontWeight: currentPage === item.id ? 600 : 400,
                                transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                                if (currentPage !== item.id) {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (currentPage !== item.id) {
                                    e.currentTarget.style.background = 'transparent';
                                }
                            }}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div style={{ position: 'absolute', bottom: '2rem', left: '1rem', right: '1rem' }}>
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%',
                            padding: '0.875rem 1rem',
                            background: 'rgba(255,255,255,0.1)',
                            border: '1px solid rgba(255,255,255,0.3)',
                            borderRadius: '8px',
                            color: 'white',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            fontSize: '0.95rem',
                            transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                    >
                        <LogOut size={20} />
                        Logout
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                {/* Top Bar */}
                <div style={{
                    background: 'white',
                    padding: '1rem 2rem',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem'
                }}>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                    <h1 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#333' }}>
                        {menuItems.find(m => m.id === currentPage)?.label}
                    </h1>
                </div>

                {/* Page Content */}
                <div style={{ flex: 1, overflow: 'auto' }}>
                    {currentPage === 'dashboard' && <Dashboard />}
                    {currentPage === 'emails' && <EmailViewer />}
                    {currentPage === 'monitoring' && <SystemMonitoring />}
                </div>
            </div>
        </div>
    );
}
