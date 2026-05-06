const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = 3000;

app.engine('hbs', exphbs.engine({ extname: 'hbs', defaultLayout: false }));
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM tasks ORDER BY created_at DESC');
    const tasks = result.rows;   // tasks — это массив объектов задач
    res.render('home', { tasks });
  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка сервера');
  }
});

app.post('/add-task', async (req, res) => {
  const { title, description } = req.body; // достаём данные из формы
  if (!title) {
    return res.status(400).send('Название задачи не может быть пустым');
  }
  try {
    const query = 'INSERT INTO tasks (title, description, created_at) VALUES ($1, $2, CURRENT_DATE)';
    await db.query(query, [title, description]);
    res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).send('Ошибка при добавлении задачи');
  }
});

app.listen(PORT, () => {
  console.log(`Сервер запущен на http://localhost:${PORT}`);
});