import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../api';

const socket = io('http://localhost:3000', {
    withCredentials: true
});

export default function TaskDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);
    const [comments, setComments] = useState([]);
    const [message, setMessage] = useState('');
    const [users, setUsers] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [editMode, setEditMode] = useState(false);
    const [form, setForm] = useState({ title: '', description: '', status_id: '', assigned_to: '' });

    useEffect(() => {
        fetchTask();
        fetchComments();
        fetchUsersAndStatuses();

        // Подключаемся к комнате задачи
        socket.emit('join_task', id);
        console.log(`🎧 Присоединились к комнате задачи ${id}`);

        // Слушаем новые комментарии
        socket.on('new_comment', (comment) => {
            console.log('📩 Получен новый комментарий:', comment);
            if (Number(comment.task_id) === Number(id)) {
                setComments(prev => [...prev, comment]);
            }
        });

        // Логи подключения WebSocket
        socket.on('connect', () => console.log('✅ WebSocket connected'));
        socket.on('disconnect', () => console.log('❌ WebSocket disconnected'));
        socket.on('connect_error', (err) => console.error('WebSocket error:', err));

        return () => {
            socket.off('new_comment');
            socket.off('connect');
            socket.off('disconnect');
            socket.off('connect_error');
        };
    }, [id]);

    const fetchTask = async () => {
        const res = await api.get(`/tasks/${id}`);
        setTask(res.data);
        setForm({
            title: res.data.title,
            description: res.data.description || '',
            status_id: res.data.status_id || '',
            assigned_to: res.data.assigned_to || ''
        });
    };

    const fetchComments = async () => {
        const res = await api.get(`/tasks/${id}/comments`);
        setComments(res.data);
    };

    const fetchUsersAndStatuses = async () => {
        const [usersRes, statusesRes] = await Promise.all([
            api.get('/users'),
            api.get('/statuses')
        ]);
        setUsers(usersRes.data);
        setStatuses(statusesRes.data);
    };

    const handleSubmitComment = async (e) => {
        e.preventDefault();
        if (!message.trim()) return;
        console.log('📤 Отправка сообщения:', message);
        socket.emit('send_comment', { taskId: id, message });
        setMessage('');
    };

    const handleUpdateTask = async (e) => {
        e.preventDefault();
        await api.put(`/tasks/${id}`, form);
        setEditMode(false);
        fetchTask();
    };

    const handleDelete = async () => {
        if (confirm('Удалить задачу?')) {
            await api.delete(`/tasks/${id}`);
            navigate('/tasks');
        }
    };

    if (!task) return <div>Загрузка...</div>;

    return (
        <div className="container mx-auto p-4">
            <div className="mb-4 flex justify-between items-center">
                <h1 className="text-3xl font-bold">Задача #{id}</h1>
                <div>
                    <button onClick={() => setEditMode(!editMode)} className="bg-blue-500 text-white px-4 py-2 rounded mr-2">
                        {editMode ? 'Отмена' : 'Редактировать'}
                    </button>
                    <button onClick={handleDelete} className="bg-red-500 text-white px-4 py-2 rounded">Удалить</button>
                </div>
            </div>

            {editMode ? (
                <form onSubmit={handleUpdateTask} className="mb-6 border p-4 rounded">
                    <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full p-2 border rounded mb-2" required />
                    <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full p-2 border rounded mb-2" rows="3" />
                    <select value={form.status_id} onChange={e => setForm({...form, status_id: e.target.value})} className="w-full p-2 border rounded mb-2">
                        <option value="">Без статуса</option>
                        {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <select value={form.assigned_to} onChange={e => setForm({...form, assigned_to: e.target.value})} className="w-full p-2 border rounded mb-2">
                        <option value="">Не назначен</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                    </select>
                    <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded">Сохранить</button>
                </form>
            ) : (
                <div className="mb-6 border p-4 rounded">
                    <p><strong>Название:</strong> {task.title}</p>
                    <p><strong>Описание:</strong> {task.description || '—'}</p>
                    <p><strong>Статус:</strong> {task.status_name || '—'}</p>
                    <p><strong>Ответственный:</strong> {task.assigned_name || '—'}</p>
                    <p><strong>Дата создания:</strong> {new Date(task.created_at).toLocaleDateString()}</p>
                </div>
            )}

            <div className="mt-8">
                <h2 className="text-2xl font-bold mb-4">Чат</h2>
                <div className="border rounded p-4 h-80 overflow-y-auto mb-4 bg-gray-50">
                    {comments.map(c => (
                        <div key={c.id} className="mb-2">
                            <strong>{c.username}</strong> <small className="text-gray-500">{new Date(c.created_at).toLocaleString()}</small>
                            <p>{c.message}</p>
                        </div>
                    ))}
                </div>
                <form onSubmit={handleSubmitComment} className="flex gap-2">
                    <input type="text" value={message} onChange={e => setMessage(e.target.value)} placeholder="Ваше сообщение..." className="flex-1 p-2 border rounded" required />
                    <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">Отправить</button>
                </form>
            </div>
        </div>
    );
}