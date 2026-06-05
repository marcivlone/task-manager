import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import TaskFormModal from '../components/TaskFormModal';

export default function Tasks() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [tasks, setTasks] = useState([]);
    const [users, setUsers] = useState([]);
    const [statuses, setStatuses] = useState([]);
    const [filters, setFilters] = useState({ status: '', assigned: '', sort: '' });
    const [loading, setLoading] = useState(true);

    const fetchTasks = async () => {
        try {
            const params = new URLSearchParams(filters);
            const [tasksRes, usersRes, statusesRes] = await Promise.all([
                api.get(`/tasks?${params}`),
                api.get('/users'),
                api.get('/statuses')
            ]);
            setTasks(tasksRes.data);
            setUsers(usersRes.data);
            setStatuses(statusesRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTasks();
    }, [filters]);

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    if (loading) return <div>Загрузка...</div>;

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-3xl font-bold">Задачи</h1>
                <div className="flex gap-2">
                    <button onClick={() => setIsModalOpen(true)} className="bg-green-500 text-white px-4 py-2 rounded">+ Новая задача</button>
                    <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded">Выйти</button>
                </div>
            </div>

            <div className="flex gap-4 mb-4">
                <select name="status" value={filters.status} onChange={handleFilterChange} className="border p-2 rounded">
                    <option value="">Все статусы</option>
                    {statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select name="assigned" value={filters.assigned} onChange={handleFilterChange} className="border p-2 rounded">
                    <option value="">Все ответственные</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
                <select name="sort" value={filters.sort} onChange={handleFilterChange} className="border p-2 rounded">
                    <option value="">Без сортировки</option>
                    <option value="title">По названию</option>
                    <option value="status">По статусу</option>
                    <option value="assigned">По ответственному</option>
                </select>
            </div>

            <table className="min-w-full border">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="border p-2">Название</th>
                        <th className="border p-2">Описание</th>
                        <th className="border p-2">Статус</th>
                        <th className="border p-2">Ответственный</th>
                        <th className="border p-2">Дата</th>
                        <th className="border p-2">Действия</th>
                    </tr>
                </thead>
                <tbody>
                    {tasks.map(task => (
                        <tr key={task.id}>
                            <td className="border p-2">{task.title}</td>
                            <td className="border p-2">{task.description}</td>
                            <td className="border p-2">{task.status_name}</td>
                            <td className="border p-2">{task.assigned_name}</td>
                            <td className="border p-2">{new Date(task.created_at).toLocaleDateString()}</td>
                            <td className="border p-2">
                                <Link to={`/tasks/${task.id}`} className="bg-yellow-500 text-white px-2 py-1 rounded">Открыть</Link>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <TaskFormModal 
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onTaskCreated={(newTask) => setTasks(prev => [newTask, ...prev])}
                users={users}
                statuses={statuses}
            />
        </div>
    );
}