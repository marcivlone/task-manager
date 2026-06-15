import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  LogOut,
  Plus,
  UserRound,
} from 'lucide-react';
import api from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

const FALLBACK_STATUS_LABELS = {
  1: 'Новая',
  2: 'В работе',
  3: 'Завершена',
};

const getStatusLabel = (statusId, statusName) => {
  if (statusName && !statusName.includes('?')) {
    return statusName;
  }

  return FALLBACK_STATUS_LABELS[Number(statusId)] || 'Новая';
};

const getStatusKind = (statusId, statusName) => {
  const label = getStatusLabel(statusId, statusName).toLowerCase();

  if (Number(statusId) === 3 || label.includes('done') || label.includes('готов') || label.includes('выполн') || label.includes('заверш')) {
    return 'done';
  }

  if (Number(statusId) === 2 || label.includes('progress') || label.includes('работ') || label.includes('процесс')) {
    return 'progress';
  }

  if (label.includes('block') || label.includes('ошиб') || label.includes('проблем')) {
    return 'blocked';
  }

  return 'new';
};

const formatTaskDate = (date) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Без даты';
  }

  return parsedDate.toLocaleDateString('ru-RU');
};

export default function Tasks() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [filters, setFilters] = useState({ status: '', assigned: '', sort: '' });
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    status_id: '',
    assigned_to: '',
  });
  const [createError, setCreateError] = useState('');

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams(filters);
      const [tasksRes, usersRes, statusesRes] = await Promise.all([
        api.get(`/tasks?${params}`),
        api.get('/users'),
        api.get('/statuses'),
      ]);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setStatuses(Array.isArray(statusesRes.data) ? statusesRes.data : []);
    } catch (err) {
      console.error(err);
      setTasks([]);
      setUsers([]);
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [filters]);

  useEffect(() => {
    document.body.classList.add('tasks-background');

    return () => {
      document.body.classList.remove('tasks-background');
    };
  }, []);

  const handleFilterChange = (key, value) => {
    const actualValue = value === 'all' || value === 'none' ? '' : value;
    setFilters((prev) => ({ ...prev, [key]: actualValue }));
  };

  const handleCreateTask = async () => {
    if (!newTask.title.trim()) {
      setCreateError('Название обязательно');
      return;
    }

    const payload = {
      title: newTask.title,
      description: newTask.description,
      status_id: newTask.status_id === 'none' ? null : newTask.status_id,
      assigned_to: newTask.assigned_to === 'none' ? null : newTask.assigned_to,
    };

    try {
      const response = await api.post('/tasks', payload);
      const selectedStatus = statuses.find((status) => String(status.id) === String(payload.status_id));
      const selectedUser = users.find((user) => String(user.id) === String(payload.assigned_to));
      const createdTask = {
        ...response.data,
        status_id: payload.status_id,
        assigned_to: payload.assigned_to,
        status_name: selectedStatus?.name,
        assigned_name: selectedUser?.username,
      };

      setTasks((prev) => [createdTask, ...prev]);
      setIsDialogOpen(false);
      setNewTask({ title: '', description: '', status_id: '', assigned_to: '' });
      setCreateError('');
    } catch (err) {
      setCreateError(err.response?.data?.error || 'Ошибка создания');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  };

  if (loading) {
    return <div className="tasks-loading">Загрузка...</div>;
  }

  return (
    <main className="task-page">
      <div className="task-layout">
        <header className="task-toolbar">
          <div className="task-heading">
            <div className="task-heading-icon">
              <ClipboardList aria-hidden="true" />
            </div>
            <div>
              <h1>Задачи</h1>
              <p>Найдено: {tasks.length}</p>
            </div>
          </div>

          <div className="task-actions">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="task-primary-button">
                  <Plus aria-hidden="true" />
                  Новая задача
                </Button>
              </DialogTrigger>
              <DialogContent className="task-create-dialog">
                <DialogHeader>
                  <DialogTitle className="task-dialog-title">Создание задачи</DialogTitle>
                </DialogHeader>
                <div className="task-form">
                  <Input
                    className="task-field"
                    placeholder="Название"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  />
                  <Textarea
                    className="task-field task-textarea"
                    placeholder="Описание"
                    rows={3}
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  />
                  <Select
                    value={newTask.status_id || 'none'}
                    onValueChange={(value) => setNewTask({ ...newTask, status_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger className="task-select">
                      <SelectValue placeholder="Без статуса" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="task-select-menu">
                      <SelectItem value="none">Без статуса</SelectItem>
                      {Array.isArray(statuses) && statuses.map((status) => (
                        <SelectItem key={status.id} value={String(status.id)}>
                          {getStatusLabel(status.id, status.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={newTask.assigned_to || 'none'}
                    onValueChange={(value) => setNewTask({ ...newTask, assigned_to: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger className="task-select">
                      <SelectValue placeholder="Не назначен" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="task-select-menu">
                      <SelectItem value="none">Не назначен</SelectItem>
                      {Array.isArray(users) && users.map((user) => (
                        <SelectItem key={user.id} value={String(user.id)}>
                          {user.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {createError && <div className="task-form-error">{createError}</div>}
                  <Button onClick={handleCreateTask} className="task-submit-button">
                    Создать
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button className="task-logout-button" onClick={handleLogout}>
              <LogOut aria-hidden="true" />
              Выйти
            </Button>
          </div>
        </header>

        <section className="task-filters">
          <label>
            <span>Статус</span>
            <Select
              value={filters.status === '' ? 'all' : filters.status}
              onValueChange={(value) => handleFilterChange('status', value)}
            >
              <SelectTrigger className="task-select">
                <SelectValue placeholder="Все статусы" />
              </SelectTrigger>
              <SelectContent position="popper" className="task-select-menu">
                <SelectItem value="all">Все статусы</SelectItem>
                {Array.isArray(statuses) && statuses.map((status) => (
                  <SelectItem key={status.id} value={String(status.id)}>
                    {getStatusLabel(status.id, status.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label>
            <span>Ответственный</span>
            <Select
              value={filters.assigned === '' ? 'all' : filters.assigned}
              onValueChange={(value) => handleFilterChange('assigned', value)}
            >
              <SelectTrigger className="task-select">
                <SelectValue placeholder="Все ответственные" />
              </SelectTrigger>
              <SelectContent position="popper" className="task-select-menu">
                <SelectItem value="all">Все ответственные</SelectItem>
                {Array.isArray(users) && users.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {user.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <label>
            <span>Сортировка</span>
            <Select
              value={filters.sort === '' ? 'none' : filters.sort}
              onValueChange={(value) => handleFilterChange('sort', value)}
            >
              <SelectTrigger className="task-select">
                <SelectValue placeholder="Без сортировки" />
              </SelectTrigger>
              <SelectContent position="popper" className="task-select-menu">
                <SelectItem value="none">Без сортировки</SelectItem>
                <SelectItem value="title">По названию</SelectItem>
                <SelectItem value="status">По статусу</SelectItem>
                <SelectItem value="assigned">По ответственному</SelectItem>
              </SelectContent>
            </Select>
          </label>
        </section>

        {tasks.length === 0 ? (
          <section className="tasks-empty">Нет задач</section>
        ) : (
          <section className="task-grid">
            {tasks.map((task) => {
              const statusLabel = getStatusLabel(task.status_id, task.status_name);
              const statusKind = getStatusKind(task.status_id, task.status_name);

              return (
                <article key={task.id} className={`task-card task-card--${statusKind}`}>
                  <div className="task-card-head">
                    <h2>{task.title}</h2>
                    <span className="task-status-badge">
                      <span className="task-status-dot" />
                      {statusLabel}
                    </span>
                  </div>

                  <p className="task-description">
                    {task.description || 'Описание отсутствует'}
                  </p>

                  <div className="task-meta">
                    <div>
                      <UserRound aria-hidden="true" />
                      <span>{task.assigned_name || 'Не назначен'}</span>
                    </div>
                    <div>
                      <CalendarDays aria-hidden="true" />
                      <span>{formatTaskDate(task.created_at)}</span>
                    </div>
                  </div>

                  <Button className="task-open-button" onClick={() => navigate(`/tasks/${task.id}`)}>
                    Открыть
                    <ArrowUpRight aria-hidden="true" />
                  </Button>
                </article>
              );
            })}
          </section>
        )}
      </div>
    </main>
  );
}
