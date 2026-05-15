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
app.engine('hbs', exphbs.engine({ extname: 'hbs', defaultLayout: false }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Для чтения данных из форм
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Настройка сессий
const PgSession = require('connect-pg-simple')(session);
app.use(session({
    store: new PgSession({
        pool: db,            // используем тот же пул, что и для запросов
        tableName: 'session', // таблица для сессий (создастся автоматически)
        createTableIfMissing: true
    }),
    secret: process.env.SESSION_SECRET || 'mysecretkey', // в .env поставьте свой секрет
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 дней
}));

// Middleware: проверка авторизации
function requireAuth(req, res, next) {
    if (req.session.userId) {
        next();
    } else {
        res.redirect('/login');
    }
}

// Статическая папка (если нужна)
app.use(express.static('public'));

// ---------- Страницы авторизации ----------

// Страница логина
app.get('/login', (req, res) => {
    res.render('login', { title: 'Вход' });
});

// Обработка логина
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

// Страница регистрации
app.get('/register', (req, res) => {
    res.render('register', { title: 'Регистрация' });
});

// Обработка регистрации
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
        // Ошибка уникальности (email или username уже заняты)
        console.error(err);
        res.render('register', { error: 'Пользователь с таким email или именем уже существует' });
    }
});

// Выход
app.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

// ---------- Защищённые маршруты (требуют авторизации) ----------

// Главная страница со списком задач текущего пользователя
app.get('/', requireAuth, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC',
            [req.session.userId]
        );
        const tasks = result.rows;
        res.render('home', { tasks, username: req.session.username });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

// Добавление задачи (только для текущего пользователя)
app.post('/add-task', requireAuth, async (req, res) => {
    const { title, description } = req.body;
    if (!title) {
        return res.status(400).send('Название задачи обязательно');
    }
    try {
        await db.query(
            'INSERT INTO tasks (title, description, created_at, user_id) VALUES ($1, $2, CURRENT_DATE, $3)',
            [title, description, req.session.userId]
        );
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка при добавлении задачи');
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});