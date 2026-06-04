import { useState } from 'react';
import api from '../api';

export default function TaskFormModal({ isOpen, onClose, onTaskCreated, users, statuses }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [status_id, setStatusId] = useState('');
    const [assigned_to, setAssignedTo] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            setError('Название обязательно');
            return;
        }
        try {
            const response = await api.post('/tasks', { title, description, status_id, assigned_to });
            onTaskCreated(response.data); // добавляем новую задачу в список
            onClose(); // закрываем модалку
            // очищаем форму
            setTitle('');
            setDescription('');
            setStatusId('');
            setAssignedTo('');
            setError('');
        } catch (err) {
            setError(err.response?.data?.error || 'Ошибка создания');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded shadow-lg w-full max-w-md">
                <h2 className="text-2xl font-bold mb-4">Новая задача</h2>
                {error && <div className="text-red-500 mb-2">{error}</div>}
                <form onSubmit={handleSubmit}>
                    <input type="text" placeholder="Название" className="w-full p-2 border rounded mb-2"
                        value={title} onChange={e => setTitle(e.target.value)} required />
                    <textarea placeholder="Описание" className="w-full p-2 border rounded mb-2"
                        value={description} onChange={e => setDescription(e.target.value)} rows="3" />
                    <select className="w-full p-2 border rounded mb-2" value={status_id} onChange={e => setStatusId(e.target.value)}>
                        <option value="">Без статуса</option>
                        {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select className="w-full p-2 border rounded mb-2" value={assigned_to} onChange={e => setAssignedTo(e.target.value)}>
                        <option value="">Не назначен</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 rounded">Отмена</button>
                        <button type="submit" className="px-4 py-2 bg-blue-500 text-white rounded">Создать</button>
                    </div>
                </form>
            </div>
        </div>
    );
}