import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// Get token from localStorage
const getToken = () => localStorage.getItem('admin_token');

// Set token in localStorage
const setToken = (token: string) => localStorage.setItem('admin_token', token);

// Remove token
const removeToken = () => localStorage.removeItem('admin_token');

// Create axios instance with auth header
const createAuthClient = () => {
    const token = getToken();
    return axios.create({
        baseURL: API_BASE,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
};

export interface AdminStats {
    totalAddresses: number;
    totalMessages: number;
    activeAddresses: number;
    messagesLast24h: number;
    topDomains: Array<{ domain: string; count: number }>;
}

export interface AdminConfig {
    ttlSeconds: number;
    rateLimitCreatePerMin: number;
    rateLimitFetchPerMin: number;
    maxEmailBytes: number;
    expiredWeb: string;
    allowedDomains: string[];
}

export interface Message {
    id: string;
    from: string;
    subject: string;
    date: string;
    text: string;
    html?: string;
    original_to: string;
    domain: string;
    local: string;
}

export const adminApi = {
    // Auth
    login: async (password: string) => {
        const res = await axios.post<{ token: string }>(`${API_BASE}/admin/login`, { password });
        setToken(res.data.token);
        return res.data;
    },

    logout: () => {
        removeToken();
    },

    isAuthenticated: () => {
        return !!getToken();
    },

    // Stats
    getStats: async () => {
        const client = createAuthClient();
        const res = await client.get<AdminStats>('/admin/stats');
        return res.data;
    },

    // Domains
    getDomains: async () => {
        const client = createAuthClient();
        // Since backend handles backwards compatibility or merger, check backend response structure
        // But we changed backend to return [{name, source}]
        // Let's call it getDomainsWithSource internally for typing clarity if needed, or just update return type
        const res = await client.get<{ domains: Array<{ name: string; source: 'system' | 'custom' }> }>('/admin/domains');
        return res.data.domains;
    },

    getDomainsWithSource: async () => {
        const client = createAuthClient();
        const res = await client.get<{ domains: Array<{ name: string; source: 'system' | 'custom' }> }>('/admin/domains');
        return res.data.domains;
    },

    addDomain: async (domain: string) => {
        const client = createAuthClient();
        const res = await client.post('/admin/domains', { domain });
        return res.data;
    },

    removeDomain: async (domain: string) => {
        const client = createAuthClient();
        const res = await client.delete(`/admin/domains/${domain}`);
        return res.data;
    },

    // Config
    getConfig: async () => {
        const client = createAuthClient();
        const res = await client.get<AdminConfig>('/admin/config');
        return res.data;
    },

    getSettings: async () => {
        const client = createAuthClient();
        const res = await client.get<{ imap_host: string; imap_port: number; imap_user: string; source: string }>('/admin/settings');
        return res.data;
    },

    updateSettings: async (settings: { imap_host: string; imap_port: number; imap_user: string; imap_pass: string }) => {
        const client = createAuthClient();
        const res = await client.post('/admin/settings', settings);
        return res.data;
    },

    // Addresses
    getAddresses: async (offset = 0, limit = 50) => {
        const client = createAuthClient();
        const res = await client.get<{ addresses: string[]; offset: number; limit: number }>(
            `/admin/addresses?offset=${offset}&limit=${limit}`
        );
        return res.data;
    },

    // Messages
    getMessages: async (offset = 0, limit = 50) => {
        const client = createAuthClient();
        const res = await client.get<{ messages: Message[]; offset: number; limit: number }>(
            `/admin/messages?offset=${offset}&limit=${limit}`
        );
        return res.data;
    },

    deleteMessage: async (id: string) => {
        const client = createAuthClient();
        const res = await client.delete<{ status: string }>(`/admin/messages/${id}`);
        return res.data;
    },

    // Health
    getHealth: async () => {
        const client = createAuthClient();
        const res = await client.get<{ redis: string; imap: string }>('/admin/health');
        return res.data;
    },
};
