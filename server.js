require('dotenv').config();
const express = require('express');
const session = require('express-session');
const exphbs = require('express-handlebars');
const path = require('path');
const db = require('./db');
const auth = require('./auth');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'mysecretkey';

// Настройка Handlebars (для старых страниц)
app.engine('hbs', exphbs.engine({ 
    extname: 'hbs', 
    defaultLayout: false,
    helpers: { eq: (a, b) => a == b }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'client', 'public')));

// CORS для React (разрешаем запросы с localhost:5173)
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

// Сессии (для старых Handlebars-страниц)
const PgSession = require('connect-pg-simple')(session);
const sessionMiddleware = session({
    store: new PgSession({ pool: db, tableName: 'session', createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET || 'mysecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,       // для localhost
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
});
app.use(sessionMiddleware);

// Middleware для Handlebars-авторизации
function requireAuth(req, res, next) {
    if (req.session.userId) next();
    else res.redirect('/login');
}

// ---------------------- Handlebars маршруты (старые, для совместимости) ----------------------
app.get('/login', (req, res) => { res.render('login'); });
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await auth.authenticateUser(email, password);
    if (!user) return res.render('login', { error: 'Неверный email или пароль' });
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/');
});
app.get('/register', (req, res) => { res.render('register'); });
app.post('/register', async (req, res) => {
    const { username, email, password, confirm } = req.body;
    if (password !== confirm) return res.render('register', { error: 'Пароли не совпадают' });
    if (password.length < 6) return res.render('register', { error: 'Пароль минимум 6 символов' });
    try {
        const newUser = await auth.registerUser(username, email, password);
        req.session.userId = newUser.id;
        req.session.username = newUser.username;
        res.redirect('/');
    } catch (err) {
        res.render('register', { error: 'Пользователь уже существует' });
    }
});
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// Главная страница Handlebars (список задач)
app.get('/', requireAuth, async (req, res) => {
    try {
        let { status, assigned, sort } = req.query;
        let sql = `
            SELECT t.*, u.username as assigned_name, s.name as status_name 
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN statuses s ON t.status_id = s.id
            WHERE 1=1
        `;
        let params = [], idx = 1;
        if (status && status !== '') { sql += ` AND t.status_id = $${idx}`; params.push(status); idx++; }
        if (assigned && assigned !== '') { sql += ` AND t.assigned_to = $${idx}`; params.push(assigned); idx++; }
        switch(sort) {
            case 'title': sql += ' ORDER BY t.title'; break;
            case 'status': sql += ' ORDER BY s.name'; break;
            case 'assigned': sql += ' ORDER BY u.username'; break;
            default: sql += ' ORDER BY t.created_at DESC';
        }
        const tasks = (await db.query(sql, params)).rows;
        const users = (await db.query('SELECT id, username FROM users ORDER BY username')).rows;
        const statuses = (await db.query('SELECT id, name FROM statuses ORDER BY "order"')).rows;
        res.render('home', { tasks, users, statuses, currentStatus: status || '', currentAssigned: assigned || '', currentSort: sort || '', username: req.session.username });
    } catch(err) { res.status(500).send('Ошибка сервера'); }
});

app.post('/add-task', requireAuth, async (req, res) => {
    const { title, description, status_id, assigned_to } = req.body;
    if (!title) return res.status(400).send('Название обязательно');
    await db.query(`INSERT INTO tasks (title, description, created_at, user_id, status_id, assigned_to) VALUES ($1,$2,CURRENT_DATE,$3,$4,$5)`,
        [title, description, req.session.userId, status_id || null, assigned_to || null]);
    res.redirect('/');
});

app.get('/edit-task/:id', requireAuth, async (req, res) => {
    const task = (await db.query('SELECT * FROM tasks WHERE id = $1', [req.params.id])).rows[0];
    if (!task) return res.status(404).send('Задача не найдена');
    const users = (await db.query('SELECT id, username FROM users')).rows;
    const statuses = (await db.query('SELECT id, name FROM statuses ORDER BY "order"')).rows;
    const comments = (await db.query(`SELECT c.*, u.username FROM task_comments c JOIN users u ON c.user_id = u.id WHERE c.task_id = $1 ORDER BY c.created_at ASC`, [req.params.id])).rows;
    res.render('edit', { task, users, statuses, comments, username: req.session.username, userId: req.session.userId });
});
app.post('/edit-task/:id', requireAuth, async (req, res) => {
    const { title, description, status_id, assigned_to } = req.body;
    await db.query(`UPDATE tasks SET title=$1, description=$2, status_id=$3, assigned_to=$4 WHERE id=$5`,
        [title, description, status_id || null, assigned_to || null, req.params.id]);
    res.redirect('/');
});

// ---------------------- API для React (JWT) ----------------------
// Middleware проверки JWT
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Требуется авторизация' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Неверный токен' });
        req.user = user;
        next();
    });
}

// Регистрация (API)
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Все поля обязательны' });
    try {
        const newUser = await auth.registerUser(username, email, password);
        const token = jwt.sign({ id: newUser.id, username: newUser.username, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });
        res.json({ token, user: { id: newUser.id, username: newUser.username, email: newUser.email } });
    } catch (err) {
        res.status(400).json({ error: 'Пользователь уже существует' });
    }
});

// Логин (API)
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await auth.authenticateUser(email, password);
    if (!user) return res.status(401).json({ error: 'Неверные учётные данные' });
    const token = jwt.sign({ id: user.id, username: user.username, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
});

// Получить все задачи (с фильтрацией и сортировкой)
app.get('/api/tasks', authenticateToken, async (req, res) => {
    try {
        let { status, assigned, sort } = req.query;
        let sql = `SELECT t.*, u.username as assigned_name, s.name as status_name FROM tasks t LEFT JOIN users u ON t.assigned_to = u.id LEFT JOIN statuses s ON t.status_id = s.id WHERE 1=1`;
        let params = [], idx = 1;
        if (status && status !== '') { sql += ` AND t.status_id = $${idx}`; params.push(status); idx++; }
        if (assigned && assigned !== '') { sql += ` AND t.assigned_to = $${idx}`; params.push(assigned); idx++; }
        switch(sort) {
            case 'title': sql += ' ORDER BY t.title'; break;
            case 'status': sql += ' ORDER BY s.name'; break;
            case 'assigned': sql += ' ORDER BY u.username'; break;
            default: sql += ' ORDER BY t.created_at DESC';
        }
        const tasks = (await db.query(sql, params)).rows;
        res.json(tasks);
    } catch (err) { res.status(500).json({ error: 'Ошибка сервера' }); }
});

// Создать задачу
app.post('/api/tasks', authenticateToken, async (req, res) => {
    const { title, description, status_id, assigned_to } = req.body;
    if (!title) return res.status(400).json({ error: 'Название обязательно' });
    try {
        const result = await db.query(
            `INSERT INTO tasks (title, description, created_at, user_id, status_id, assigned_to) VALUES ($1,$2,CURRENT_DATE,$3,$4,$5) RETURNING *`,
            [title, description, req.user.id, status_id || null, assigned_to || null]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: 'Ошибка при создании' }); }
});

// Обновить задачу
app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
    const { title, description, status_id, assigned_to } = req.body;
    if (!title) return res.status(400).json({ error: 'Название обязательно' });
    await db.query(`UPDATE tasks SET title=$1, description=$2, status_id=$3, assigned_to=$4 WHERE id=$5`,
        [title, description, status_id || null, assigned_to || null, req.params.id]);
    res.json({ success: true });
});

// Удалить задачу
app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
    await db.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ success: true });
});

// Получить всех пользователей (для списка ответственных)
app.get('/api/users', authenticateToken, async (req, res) => {
    const users = (await db.query('SELECT id, username FROM users ORDER BY username')).rows;
    res.json(users);
});

// Получить все статусы
app.get('/api/statuses', authenticateToken, async (req, res) => {
    const statuses = (await db.query('SELECT id, name FROM statuses ORDER BY "order"')).rows;
    res.json(statuses);
});

// Получить одну задачу по id
app.get('/api/tasks/:id', authenticateToken, async (req, res) => {
    const task = (await db.query(
        `SELECT t.*, u.username as assigned_name, s.name as status_name 
         FROM tasks t
         LEFT JOIN users u ON t.assigned_to = u.id
         LEFT JOIN statuses s ON t.status_id = s.id
         WHERE t.id = $1`,
        [req.params.id]
    )).rows[0];
    if (!task) return res.status(404).json({ error: 'Задача не найдена' });
    res.json(task);
});

// Получить комментарии к задаче
app.get('/api/tasks/:id/comments', authenticateToken, async (req, res) => {
    const comments = (await db.query(
        `SELECT c.*, u.username FROM task_comments c JOIN users u ON c.user_id = u.id WHERE c.task_id = $1 ORDER BY c.created_at ASC`,
        [req.params.id]
    )).rows;
    res.json(comments);
});

// Добавить комментарий (через REST)
app.post('/api/comments', authenticateToken, async (req, res) => {
    const { task_id, message } = req.body;
    if (!message) return res.status(400).json({ error: 'Сообщение не может быть пустым' });
    const result = await db.query(
        `INSERT INTO task_comments (task_id, user_id, message) VALUES ($1,$2,$3) RETURNING id, created_at`,
        [task_id, req.user.id, message]
    );
    const newComment = {
        id: result.rows[0].id,
        task_id,
        user_id: req.user.id,
        username: req.user.username,
        message,
        created_at: result.rows[0].created_at
    };
    // Оповещаем через WebSocket
    io.to(`task_${task_id}`).emit('new_comment', newComment);
    res.json(newComment);
});

// ---------------------- WebSocket (socket.io) ----------------------
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
  }
});
io.use((socket, next) => {
    const authToken = socket.handshake.auth?.token;
    const authHeader = socket.handshake.headers?.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const token = authToken || bearerToken;

    if (token) {
        try {
            socket.user = jwt.verify(token, JWT_SECRET);
            return next();
        } catch (err) {
            return next(new Error('invalid token'));
        }
    }

    sessionMiddleware(socket.request, {}, () => {
        const socketSession = socket.request.session;

        if (socketSession?.userId) {
            socket.user = {
                id: socketSession.userId,
                username: socketSession.username,
            };
        }

        next();
    });
});
io.on('connection', (socket) => {
    const session = socket.request.session;
    const userId = socket.user?.id || session?.userId;
    const username = socket.user?.username || session?.username;
    if (!userId) { 
        socket.disconnect(); 
        return; 
    }
    console.log(`Пользователь ${username} (id:${userId}) подключился`);
    socket.on('join_task', (taskId) => { socket.join(`task_${taskId}`); });
    socket.on('leave_task', (taskId) => { socket.leave(`task_${taskId}`); });
    socket.on('send_comment', async (data) => {
        const { taskId, message } = data;
        if (!message.trim()) return;
        const result = await db.query(
            `INSERT INTO task_comments (task_id, user_id, message) VALUES ($1,$2,$3) RETURNING id, created_at`,
            [taskId, userId, message.trim()]
        );
        const newComment = {
            id: result.rows[0].id,
            task_id: taskId,
            user_id: userId,
            username: username,
            message: message.trim(),
            created_at: result.rows[0].created_at
        };
        io.to(`task_${taskId}`).emit('new_comment', newComment);
    });
});

// Запуск
server.listen(PORT, () => console.log(`Сервер запущен на http://localhost:${PORT}`));
