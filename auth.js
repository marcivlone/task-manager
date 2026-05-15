const bcrypt = require('bcrypt');
const db = require('./db');

// Регистрация
async function registerUser(username, email, password) {
    // Хэшируем пароль
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    const query = `
        INSERT INTO users (username, email, password_hash)
        VALUES ($1, $2, $3)
        RETURNING id, username, email
    `;
    const values = [username, email, passwordHash];
    const result = await db.query(query, values);
    return result.rows[0];
}

// Проверка логина
async function authenticateUser(email, password) {
    const query = 'SELECT id, username, email, password_hash FROM users WHERE email = $1';
    const result = await db.query(query, [email]);
    if (result.rows.length === 0) return null;

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return null;

    return { id: user.id, username: user.username, email: user.email };
}

module.exports = { registerUser, authenticateUser };