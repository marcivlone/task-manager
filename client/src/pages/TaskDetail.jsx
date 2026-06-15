import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarDays,
  MessageCircle,
  Save,
  Send,
  Trash2,
  UserRound,
} from 'lucide-react';
import { io } from 'socket.io-client';
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const socketUrl = import.meta.env.VITE_SOCKET_URL?.trim();
const socketOptions = {
  autoConnect: false,
  withCredentials: true,
};
const socket = socketUrl ? io(socketUrl, socketOptions) : io(socketOptions);

const FALLBACK_STATUS_LABELS = {
  1: 'Новая',
  2: 'В работе',
  3: 'Завершена',
};

const getStatusLabel = (statusId, statusName) => {
  if (statusName && !statusName.includes('?')) {
    return statusName;
  }

  return FALLBACK_STATUS_LABELS[Number(statusId)] || 'Без статуса';
};

const getStatusKind = (statusId, statusName) => {
  const label = getStatusLabel(statusId, statusName).toLowerCase();

  if (
    Number(statusId) === 3 ||
    label.includes('done') ||
    label.includes('готов') ||
    label.includes('выполн') ||
    label.includes('заверш')
  ) {
    return 'done';
  }

  if (
    Number(statusId) === 2 ||
    label.includes('progress') ||
    label.includes('работ') ||
    label.includes('процесс')
  ) {
    return 'progress';
  }

  if (label.includes('block') || label.includes('ошиб') || label.includes('проблем')) {
    return 'blocked';
  }

  return 'new';
};

const formatDate = (date) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return 'Без даты';
  }

  return parsedDate.toLocaleDateString('ru-RU');
};

const formatDateTime = (date) => {
  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return parsedDate.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getCurrentUser = () => {
  try {
    return JSON.parse(localStorage.getItem('user') || '{}');
  } catch {
    return {};
  }
};

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [task, setTask] = useState(null);
  const [comments, setComments] = useState([]);
  const [message, setMessage] = useState('');
  const [chatError, setChatError] = useState('');
  const [users, setUsers] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    status_id: '',
    assigned_to: '',
  });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const statusLabel = getStatusLabel(task?.status_id, task?.status_name);
  const statusKind = getStatusKind(task?.status_id, task?.status_name);
  const currentUser = getCurrentUser();

  const appendComment = useCallback((comment) => {
    setComments((prev) => {
      if (prev.some((item) => String(item.id) === String(comment.id))) {
        return prev;
      }

      return [...prev, comment];
    });
  }, []);

  const fetchTask = useCallback(async () => {
    const res = await api.get(`/tasks/${id}`);
    setTask(res.data);
    setForm({
      title: res.data.title,
      description: res.data.description || '',
      status_id: res.data.status_id ? String(res.data.status_id) : 'none',
      assigned_to: res.data.assigned_to ? String(res.data.assigned_to) : 'none',
    });
  }, [id]);

  const fetchComments = useCallback(async () => {
    const res = await api.get(`/tasks/${id}/comments`);
    setComments(res.data);
  }, [id]);

  const fetchUsersAndStatuses = useCallback(async () => {
    const [usersRes, statusesRes] = await Promise.all([
      api.get('/users'),
      api.get('/statuses'),
    ]);
    setUsers(usersRes.data);
    setStatuses(statusesRes.data);
  }, []);

  useEffect(() => {
    fetchTask();
    fetchComments();
    fetchUsersAndStatuses();

    const handleConnect = () => {
      socket.emit('join_task', id);
    };

    const handleNewComment = (comment) => {
      if (String(comment.task_id) === String(id)) {
        appendComment(comment);
      }
    };

    const handleConnectError = (err) => {
      console.warn('Socket connection error:', err.message);
    };

    socket.auth = { token: localStorage.getItem('token') || '' };
    socket.on('connect', handleConnect);
    socket.on('new_comment', handleNewComment);
    socket.on('connect_error', handleConnectError);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.emit('leave_task', id);
      socket.off('connect', handleConnect);
      socket.off('new_comment', handleNewComment);
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    };
  }, [appendComment, fetchComments, fetchTask, fetchUsersAndStatuses, id]);

  useEffect(() => {
    document.body.classList.add('tasks-background');

    return () => {
      document.body.classList.remove('tasks-background');
    };
  }, []);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    const text = message.trim();

    if (!text) return;

    setMessage('');
    setChatError('');

    try {
      const res = await api.post('/comments', {
        task_id: id,
        message: text,
      });
      appendComment(res.data);
    } catch (err) {
      setMessage(text);
      setChatError(err.response?.data?.error || 'Не удалось отправить сообщение');
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    await api.put(`/tasks/${id}`, {
      ...form,
      status_id: form.status_id === 'none' ? null : form.status_id,
      assigned_to: form.assigned_to === 'none' ? null : form.assigned_to,
    });
    setEditMode(false);
    fetchTask();
  };

  const handleDelete = async () => {
    await api.delete(`/tasks/${id}`);
    navigate('/tasks');
  };

  if (!task) {
    return <div className="tasks-loading">Загрузка...</div>;
  }

  return (
    <main className="task-detail-page">
      <header className={`task-detail-hero task-detail-hero--${statusKind}`}>
        <div className="task-detail-hero-copy">
          <Button className="task-detail-back-button" onClick={() => navigate('/tasks')}>
            <ArrowLeft aria-hidden="true" />
            К задачам
          </Button>

          <div>
            <p className="task-detail-kicker">Задача #{id}</p>
            <h1>{task.title}</h1>
            <p className="task-detail-hero-description">
              {task.description || 'Описание отсутствует'}
            </p>
          </div>

          <div className="task-detail-meta-row">
            <span className="task-status-badge">
              <span className="task-status-dot" />
              {statusLabel}
            </span>
            <span className="task-detail-meta-pill">
              <UserRound aria-hidden="true" />
              {task.assigned_name || 'Не назначен'}
            </span>
            <span className="task-detail-meta-pill">
              <CalendarDays aria-hidden="true" />
              {formatDate(task.created_at)}
            </span>
          </div>
        </div>

        <div className="task-detail-actions">
          <Button
            className="task-detail-secondary-button"
            onClick={() => setEditMode(!editMode)}
          >
            {editMode ? 'Отмена' : 'Редактировать'}
          </Button>
          <Button
            className="task-detail-danger-button"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 aria-hidden="true" />
            Удалить
          </Button>
        </div>
      </header>

      <div className="task-detail-grid">
        <section className="task-detail-panel task-detail-info-panel">
          <div className="task-detail-section-head">
            <span>Информация</span>
            <strong>{editMode ? 'Режим редактирования' : 'Просмотр задачи'}</strong>
          </div>

          {editMode ? (
            <form onSubmit={handleUpdateTask} className="task-detail-form">
              <label className="task-detail-label">
                <span>Название</span>
                <Input
                  className="task-detail-field"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Название задачи"
                  required
                />
              </label>

              <label className="task-detail-label">
                <span>Описание</span>
                <Textarea
                  className="task-detail-field task-detail-textarea"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Что нужно сделать?"
                  rows={5}
                />
              </label>

              <div className="task-detail-form-grid">
                <label className="task-detail-label">
                  <span>Статус</span>
                  <Select
                    value={form.status_id}
                    onValueChange={(value) => setForm({ ...form, status_id: value })}
                  >
                    <SelectTrigger className="task-detail-select">
                      <SelectValue placeholder="Статус" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="task-detail-select-menu">
                      <SelectItem value="none">Без статуса</SelectItem>
                      {statuses.map((s) => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {getStatusLabel(s.id, s.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>

                <label className="task-detail-label">
                  <span>Ответственный</span>
                  <Select
                    value={form.assigned_to}
                    onValueChange={(value) => setForm({ ...form, assigned_to: value })}
                  >
                    <SelectTrigger className="task-detail-select">
                      <SelectValue placeholder="Ответственный" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="task-detail-select-menu">
                      <SelectItem value="none">Не назначен</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
              </div>

              <Button type="submit" className="task-detail-save-button">
                <Save aria-hidden="true" />
                Сохранить изменения
              </Button>
            </form>
          ) : (
            <div className="task-detail-summary">
              <div>
                <span className="task-detail-summary-label">Название</span>
                <h2>{task.title}</h2>
              </div>

              <div>
                <span className="task-detail-summary-label">Описание</span>
                <p>{task.description || 'Описание отсутствует'}</p>
              </div>

              <div className="task-detail-stats">
                <div>
                  <span>Статус</span>
                  <strong>{statusLabel}</strong>
                </div>
                <div>
                  <span>Ответственный</span>
                  <strong>{task.assigned_name || 'Не назначен'}</strong>
                </div>
                <div>
                  <span>Дата создания</span>
                  <strong>{formatDate(task.created_at)}</strong>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="task-detail-panel task-chat-panel">
          <div className="task-chat-head">
            <div>
              <span>Обсуждение</span>
              <h2>Чат задачи</h2>
            </div>
            <div className="task-chat-counter">
              <MessageCircle aria-hidden="true" />
              {comments.length}
            </div>
          </div>

          <div className="task-chat-list">
            {comments.length === 0 ? (
              <div className="task-chat-empty">
                <MessageCircle aria-hidden="true" />
                <strong>Пока нет сообщений</strong>
                <span>Напишите первое сообщение по задаче.</span>
              </div>
            ) : (
              comments.map((comment) => {
                const isOwnMessage =
                  Number(comment.user_id) === Number(currentUser.id) ||
                  comment.username === currentUser.username;

                return (
                  <article
                    key={comment.id}
                    className={`task-message ${isOwnMessage ? 'task-message--own' : ''}`}
                  >
                    <div className="task-message-bubble">
                      <div className="task-message-meta">
                        <strong>{comment.username || 'Пользователь'}</strong>
                        <time>{formatDateTime(comment.created_at)}</time>
                      </div>
                      <p>{comment.message}</p>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {chatError && <div className="task-chat-error">{chatError}</div>}

          <form onSubmit={handleSubmitComment} className="task-chat-form">
            <Input
              className="task-chat-input"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ваше сообщение..."
              required
            />
            <Button type="submit" className="task-chat-send-button">
              <Send aria-hidden="true" />
            </Button>
          </form>
        </section>
      </div>

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="task-delete-dialog">
          <DialogHeader>
            <DialogTitle>Подтверждение удаления</DialogTitle>
            <DialogDescription>
              Вы уверены, что хотите удалить задачу? Это действие нельзя отменить.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="task-detail-secondary-button"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              className="task-detail-danger-button"
              onClick={handleDelete}
            >
              <Trash2 aria-hidden="true" />
              Удалить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
