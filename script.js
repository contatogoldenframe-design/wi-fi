// ==================== API CLIENT ====================
const API_URL = '/api';

const api = {
    async request(path, options = {}) {
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        };

        const res = await fetch(`${API
