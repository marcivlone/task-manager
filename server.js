require('dotenv').config();
const express = require('express');
const session = require('express-session');
const exphbs = require('express-handlebars');
const path = require('path');
const db = require('./db');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Настройка Handlebars
app.engine('hbs', exphbs.engine({ 
    extname: 'hbs', 
    defaultLayout: false,
    helpers: {
        eq: (a, b) => a == b
    }
}));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

// Сессии
const PgSession = require('connect-pg-simple')(session);
app.use(session({
    store: new PgSession({
        pool: db,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'mysecretkey',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// ---------------------- Маршруты авторизации ----------------------
app.get('/login', (req, res) => {
    res.render('login', { title: 'Вход' });
});

app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const user = await auth.authenticateUser(email, password);
    if (!user) {
        return res.render('login', { error: 'Неверный email или пароль' });
    }
    req.session.userId = user.id;
    req.session.username = user.username;
    res.redirect('/');
});

app.get('/register', (req, res) => {
    res.render('register', { title: 'Регистрация' });
});

app.post('/register', async (req, res) => {
    const { username, email, password, confirm } = req.body;
    if (password !== confirm) {
        return res.render('register', { error: 'Пароли не совпадают' });
    }
    if (password.length < 6) {
        return res.render('register', { error: 'Пароль должен быть не менее 6 символов' });
    }
    try {
        const newUser = await auth.registerUser(username, email, password);
        req.session.userId = newUser.id;
        req.session.username = newUser.username;
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.render('register', { error: 'Пользователь с таким email или именем уже существует' });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// ---------------------- Основные маршруты ----------------------
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
        let params = [];
        let idx = 1;
        if (status && status !== '') {
            sql += ` AND t.status_id = $${idx}`;
            params.push(status);
            idx++;
        }
        if (assigned && assigned !== '') {
            sql += ` AND t.assigned_to = $${idx}`;
            params.push(assigned);
            idx++;
        }
        switch(sort) {
            case 'title': sql += ' ORDER BY t.title'; break;
            case 'status': sql += ' ORDER BY s.name'; break;
            case 'assigned': sql += ' ORDER BY u.username'; break;
            default: sql += ' ORDER BY t.created_at DESC';
        }
        const tasksRes = await db.query(sql, params);
        const usersRes = await db.query('SELECT id, username FROM users ORDER BY username');
        const statusesRes = await db.query('SELECT id, name FROM statuses ORDER BY "order"');
        res.render('home', { 
            tasks: tasksRes.rows,
            users: usersRes.rows,
            statuses: statusesRes.rows,
            currentStatus: status || '',
            currentAssigned: assigned || '',
            currentSort: sort || '',
            username: req.session.username
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

// API создание задачи (AJAX)
app.post('/api/create_task', requireAuth, async (req, res) => {
    const { title, description, status_id, assigned_to } = req.body;
    if (!title) return res.status(400).json({ error: 'Название задачи обязательно' });
    try {
        const result = await db.query(
            `INSERT INTO tasks (title, description, created_at, user_id, status_id, assigned_to)
             VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)
             RETURNING id, title, description, created_at, status_id, assigned_to`,
            [title, description, req.session.userId, status_id || null, assigned_to || null]
        );
        const newTask = result.rows[0];
        let statusName = null, assignedName = null;
        if (status_id) {
            const sRes = await db.query('SELECT name FROM statuses WHERE id = $1', [status_id]);
            if (sRes.rows[0]) statusName = sRes.rows[0].name;
        }
        if (assigned_to) {
            const uRes = await db.query('SELECT username FROM users WHERE id = $1', [assigned_to]);
            if (uRes.rows[0]) assignedName = uRes.rows[0].username;
        }
        res.json({
            success: true,
            task: {
                id: newTask.id,
                title: newTask.title,
                description: newTask.description,
                created_at: newTask.created_at,
                status_id: newTask.status_id,
                status_name: statusName,
                assigned_to: newTask.assigned_to,
                assigned_name: assignedName
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при добавлении задачи' });
    }
});

// Страница редактирования задачи (с чатом)
app.get('/edit-task/:id', requireAuth, async (req, res) => {
    const taskId = req.params.id;
    try {
        const taskRes = await db.query(
            'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
            [taskId, req.session.userId]
        );
        if (taskRes.rows.length === 0) {
            return res.status(404).send('Задача не найдена');
        }
        const usersRes = await db.query('SELECT id, username FROM users ORDER BY username');
        const statusesRes = await db.query('SELECT id, name FROM statuses ORDER BY "order"');
        
        // Получаем комментарии к задаче
        const commentsRes = await db.query(
            `SELECT c.*, u.username 
             FROM task_comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.task_id = $1
             ORDER BY c.created_at ASC`,
            [taskId]
        );

        res.render('edit', { 
            task: taskRes.rows[0], 
            users: usersRes.rows, 
            statuses: statusesRes.rows,
            comments: commentsRes.rows,
            username: req.session.username,
            userId: req.session.userId
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

// Обновление задачи
app.post('/edit-task/:id', requireAuth, async (req, res) => {
    const { title, description, status_id, assigned_to } = req.body;
    const taskId = req.params.id;
    if (!title) return res.status(400).send('Название задачи обязательно');
    try {
        await db.query(
            `UPDATE tasks 
             SET title = $1, description = $2, status_id = $3, assigned_to = $4
             WHERE id = $5 AND user_id = $6`,
            [title, description, status_id || null, assigned_to || null, taskId, req.session.userId]
        );
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка при обновлении задачи');
    }
});

// ---------------------- WebSocket (socket.io) ----------------------
const server = require('http').createServer(app);
const io = require('socket.io')(server);

io.use((socket, next) => {
    // Передаём сессию Express в socket.io
    const sessionMiddleware = session({
        store: new PgSession({ pool: db, tableName: 'session', createTableIfMissing: true }),
        secret: process.env.SESSION_SECRET || 'mysecretkey',
        resave: false,
        saveUninitialized: false
    });
    sessionMiddleware(socket.request, {}, next);
});

io.on('connection', (socket) => {
    console.log('Новый клиент подключён');

    // Получаем userId из сессии
    const session = socket.request.session;
    const userId = session.userId;
    const username = session.username;

    if (!userId) {
        socket.disconnect();
        return;
    }

    // Подключение к комнате задачи
    socket.on('join_task', (taskId) => {
        socket.join(`task_${taskId}`);
        socket.taskId = taskId;
        console.log(`Пользователь ${username} присоединился к комнате task_${taskId}`);
    });

    // Обработка отправки сообщения
    socket.on('send_comment', async (data) => {
        const { taskId, message } = data;
        if (!message.trim()) return;
        try {
            const result = await db.query(
                `INSERT INTO task_comments (task_id, user_id, message)
                 VALUES ($1, $2, $3)
                 RETURNING id, created_at`,
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
            // Рассылаем всем в комнату задачи
            io.to(`task_${taskId}`).emit('new_comment', newComment);
        } catch (err) {
            console.error(err);
            socket.emit('comment_error', 'Не удалось сохранить комментарий');
        }
    });

    socket.on('disconnect', () => {
        console.log(`Пользователь ${username} отключился`);
    });
});

// Запуск сервера
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});