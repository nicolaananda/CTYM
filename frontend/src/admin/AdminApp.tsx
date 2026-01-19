import { useState, useEffect } from 'react';
import { adminApi } from './lib/adminApi';
import AdminLogin from './pages/AdminLogin';
import Dashboard from './pages/Dashboard';
import EmailViewer from './pages/EmailViewer';
import SystemMonitoring from './pages/SystemMonitoring';
import DomainManagement from './pages/DomainManagement';
import Settings from './pages/Settings';
import { LayoutDashboard, Mail, Activity, LogOut, Menu, X, Globe, Settings as SettingsIcon } from 'lucide-react';

type Page = 'dashboard' | 'emails' | 'monitoring' | 'domains' | 'settings';

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
        { id: 'domains' as Page, label: 'Domains', icon: <Globe size={20} /> },
        { id: 'monitoring' as Page, label: 'Monitoring', icon: <Activity size={20} /> },
        { id: 'settings' as Page, label: 'Settings', icon: <SettingsIcon size={20} /> },
    ];

    return (
        <div className="admin-layout">
            {/* Sidebar */}
            <div className={`admin-sidebar ${!sidebarOpen ? 'collapsed' : ''}`}>
                <div className="admin-sidebar-header">
                    <h2 className="admin-brand">
                        CattyMail
                    </h2>
                    <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.2rem', fontWeight: 500 }}>Admin Panel</p>
                </div>

                <nav className="admin-nav">
                    {menuItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setCurrentPage(item.id)}
                            className={`admin-sidebar-link ${currentPage === item.id ? 'active' : ''}`}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </nav>

                <div style={{ padding: '2rem' }}>
                    <button
                        onClick={handleLogout}
                        className="admin-sidebar-link"
                        style={{ border: '1px solid rgba(0,0,0,0.1)', color: '#d32f2f' }}
                    >
                        <LogOut size={20} />
                        {sidebarOpen && "Logout"}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="admin-main">
                {/* Top Bar */}
                <div className="admin-topbar">
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="admin-toggle-btn"
                    >
                        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#333', letterSpacing: '-0.5px' }}>
                        {menuItems.find(m => m.id === currentPage)?.label}
                    </h1>
                </div>

                {/* Page Content */}
                <div className="admin-content-scroll">
                    {currentPage === 'dashboard' && <Dashboard />}
                    {currentPage === 'emails' && <EmailViewer />}
                    {currentPage === 'domains' && <DomainManagement />}
                    {currentPage === 'monitoring' && <SystemMonitoring />}
                    {currentPage === 'settings' && <Settings />}
                </div>
            </div>
        </div>
    );
}
