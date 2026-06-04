import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

export default function Register() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (password !== confirm) {
            setError('Пароли не совпадают');
            return;
        }
        try {
            const response = await api.post('/register', { username, email, password });
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            navigate('/tasks');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка регистрации');
        }
    };

    return (
        <div className="max-w-md mx-auto mt-10 p-6 border rounded shadow">
            <h2 className="text-2xl font-bold mb-4">Регистрация</h2>
            {error && <div className="text-red-500 mb-2">{error}</div>}
            <form onSubmit={handleSubmit}>
                <input type="text" placeholder="Имя пользователя" className="w-full p-2 border rounded mb-2"
                    value={username} onChange={e => setUsername(e.target.value)} />
                <input type="email" placeholder="Email" className="w-full p-2 border rounded mb-2"
                    value={email} onChange={e => setEmail(e.target.value)} />
                <input type="password" placeholder="Пароль" className="w-full p-2 border rounded mb-2"
                    value={password} onChange={e => setPassword(e.target.value)} />
                <input type="password" placeholder="Повторите пароль" className="w-full p-2 border rounded mb-2"
                    value={confirm} onChange={e => setConfirm(e.target.value)} />
                <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">Зарегистрироваться</button>
            </form>
            <p className="mt-2 text-center">Уже есть аккаунт? <a href="/login" className="text-blue-500">Вход</a></p>
        </div>
    );
}