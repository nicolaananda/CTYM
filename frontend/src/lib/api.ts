import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

export interface Address {
  email: string;
  local: string;
  domain: string;
  expires_at: string;
}

export interface Message {
  id: string;
  from: string;
  subject: string;
  date: string;
  text: string;
  html?: string;
  original_to: string;
}

export const api = {
  createRandomAddress: async (domainStr: string) => {
    const res = await axios.post<Address>(`${API_BASE}/address/random`, { domain: domainStr });
    return res.data;
  },

  createCustomAddress: async (domainStr: string, local: string) => {
    const res = await axios.post<Address>(`${API_BASE}/address/custom`, { domain: domainStr, local });
    return res.data;
  },

  getInbox: async (domainStr: string, local: string, limit = 50, before?: number) => {
    const params = { limit, before };
    const res = await axios.get<Message[]>(`${API_BASE}/inbox/${domainStr}/${local}`, { params });
    return res.data;
  },

  getMessage: async (id: string) => {
    const res = await axios.get<Message>(`${API_BASE}/message/${id}`);
    return res.data;
  },

  getStatus: async () => {
    const res = await axios.get<{ expired: boolean; expirationDate?: string; message?: string }>(`${API_BASE}/status`);
    return res.data;
  },

  getDomains: async () => {
    const res = await axios.get<{ domains: string[] }>(`${API_BASE}/domains`);
    return res.data.domains;
  }
};
