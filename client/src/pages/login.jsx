import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await api.post('/login', { email, password });
            // Сохраняем токен и данные пользователя в localStorage (хранилище браузера)
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            // Перенаправляем на страницу со списком задач
            navigate('/tasks');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка входа');
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow">
            <h2 className="text-2xl font-bold mb-4">Вход</h2>
            {error && <div className="text-red-500 mb-2">{error}</div>}
            <form onSubmit={handleSubmit}>
                <input
                    type="email"
                    placeholder="Email"
                    className="w-full p-2 border rounded mb-2"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Пароль"
                    className="w-full p-2 border rounded mb-2"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">
                    Войти
                </button>
            </form>
            <p className="mt-2 text-center">
                Нет аккаунта? <a href="/register" className="text-blue-500">Регистрация</a>
            </p>
        </div>
    );
}