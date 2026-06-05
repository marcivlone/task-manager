import axios from 'axios';

const api = axios.create({
    baseURL: '/api',   // адрес бэкенда (порт 3000)
    headers: { 'Content-Type': 'application/json' },
});

// Интерцептор: перед каждым запросом добавляет токен авторизации (если он есть в localStorage)
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;