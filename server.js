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

// Middleware проверки авторизации
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

// ---------------------- Основные маршруты (требуют авторизации) ----------------------

// Главная страница – список задач с фильтрацией, сортировкой
app.get('/', requireAuth, async (req, res) => {
    try {
        let { status, assigned, sort } = req.query;
        let sql = `
            SELECT t.*, u.username as assigned_name, s.name as status_name 
            FROM tasks t
            LEFT JOIN users u ON t.assigned_to = u.id
            LEFT JOIN statuses s ON t.status_id = s.id
            WHERE t.user_id = $1
        `;
        let params = [req.session.userId];
        let idx = 2;

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
            case 'title':
                sql += ' ORDER BY t.title';
                break;
            case 'status':
                sql += ' ORDER BY s.name';
                break;
            case 'assigned':
                sql += ' ORDER BY u.username';
                break;
            default:
                sql += ' ORDER BY t.created_at DESC';
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

// Старый способ добавления (синхронный) – оставим для совместимости
app.post('/add-task', requireAuth, async (req, res) => {
    const { title, description, status_id, assigned_to } = req.body;
    if (!title) {
        return res.status(400).send('Название задачи обязательно');
    }
    try {
        await db.query(
            `INSERT INTO tasks (title, description, created_at, user_id, status_id, assigned_to)
             VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)`,
            [title, description, req.session.userId, status_id || null, assigned_to || null]
        );
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка при добавлении задачи');
    }
});

// API: создание задачи (AJAX)
app.post('/api/create_task', requireAuth, async (req, res) => {
    const { title, description, status_id, assigned_to } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'Название задачи обязательно' });
    }
    try {
        const result = await db.query(
            `INSERT INTO tasks (title, description, created_at, user_id, status_id, assigned_to)
             VALUES ($1, $2, CURRENT_DATE, $3, $4, $5)
             RETURNING id, title, description, created_at, status_id, assigned_to`,
            [title, description, req.session.userId, status_id || null, assigned_to || null]
        );
        const newTask = result.rows[0];

        // Получаем имена статуса и ответственного
        let statusName = null;
        if (status_id) {
            const statusRes = await db.query('SELECT name FROM statuses WHERE id = $1', [status_id]);
            if (statusRes.rows[0]) statusName = statusRes.rows[0].name;
        }
        let assignedName = null;
        if (assigned_to) {
            const userRes = await db.query('SELECT username FROM users WHERE id = $1', [assigned_to]);
            if (userRes.rows[0]) assignedName = userRes.rows[0].username;
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

// Форма редактирования задачи
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
        res.render('edit', { 
            task: taskRes.rows[0], 
            users: usersRes.rows, 
            statuses: statusesRes.rows 
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
    if (!title) {
        return res.status(400).send('Название задачи обязательно');
    }
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

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});