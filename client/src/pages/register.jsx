import { useState } from 'react';
import { LockKeyhole, Mail, UserRound, UserPlus } from 'lucide-react';
import api from '../api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Пароли не совпадают');
      return;
    }

    try {
      const response = await api.post('/register', {
        username,
        email,
        password,
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      window.location.href = '/tasks';
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка регистрации');
    }
  };

  return (
    <main className="auth-page">
      <Card className="auth-card auth-card--wide">
        <CardHeader className="auth-header">
          <div className="auth-icon">
            <UserPlus aria-hidden="true" />
          </div>

          <CardTitle className="auth-title">
            Создать аккаунт
          </CardTitle>

          <CardDescription className="auth-description">
            Заполните данные, чтобы перейти к задачам.
          </CardDescription>
        </CardHeader>

        <CardContent className="auth-content">
          {error && (
            <div className="auth-error">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="auth-label">
              <span>Имя пользователя</span>
              <span className="auth-input-wrap">
                <UserRound aria-hidden="true" className="auth-field-icon" />
                <Input
                  placeholder="ivan123"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="auth-input"
                />
              </span>
            </label>

            <label className="auth-label">
              <span>Email</span>
              <span className="auth-input-wrap">
                <Mail aria-hidden="true" className="auth-field-icon" />
                <Input
                  type="email"
                  placeholder="example@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="auth-input"
                />
              </span>
            </label>

            <label className="auth-label">
              <span>Пароль</span>
              <span className="auth-input-wrap">
                <LockKeyhole aria-hidden="true" className="auth-field-icon" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="auth-input"
                />
              </span>
            </label>

            <label className="auth-label">
              <span>Повторите пароль</span>
              <span className="auth-input-wrap">
                <LockKeyhole aria-hidden="true" className="auth-field-icon" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="auth-input"
                />
              </span>
            </label>

            <Button
              type="submit"
              className="auth-submit"
            >
              <UserPlus aria-hidden="true" />
              Зарегистрироваться
            </Button>
          </form>

          <p className="auth-switch">
            Уже есть аккаунт?{' '}
            <a
              href="/login"
              className="auth-link"
            >
              Войти
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
