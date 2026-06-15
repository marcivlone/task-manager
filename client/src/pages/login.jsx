import { useState } from 'react';
import { LogIn, LockKeyhole, Mail } from 'lucide-react';
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

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const response = await api.post('/login', {
        email,
        password,
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));

      window.location.href = '/tasks';
    } catch (err) {
      setError(err.response?.data?.error || 'Ошибка входа');
    }
  };

  return (
    <main className="auth-page">
      <Card className="auth-card">
        <CardHeader className="auth-header">
          <div className="auth-icon">
            <LogIn aria-hidden="true" />
          </div>

          <CardTitle className="auth-title">
            Вход в аккаунт
          </CardTitle>

          <CardDescription className="auth-description">
            Введите email и пароль, чтобы продолжить работу с задачами.
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

            <Button
              type="submit"
              className="auth-submit"
            >
              <LogIn aria-hidden="true" />
              Войти
            </Button>
          </form>

          <p className="auth-switch">
            Нет аккаунта?{' '}
            <a
              href="/register"
              className="auth-link"
            >
              Зарегистрироваться
            </a>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
