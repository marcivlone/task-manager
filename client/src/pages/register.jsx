import { useState } from 'react';
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
    <div className="min-h-screen flex items-center">
      <div className="w-full max-w-7xl mx-auto px-[8%]">
        <Card className="w-[500px] bg-black/25 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl text-white">
          <CardHeader className="pb-6 text-center">
            <CardTitle className="text-3xl font-bold text-white">
              Создать аккаунт
            </CardTitle>

            <CardDescription className="text-white/70">
              Заполните поля для регистрации
            </CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-200 p-3 rounded-xl mb-4 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm text-white">
                  Имя пользователя
                </label>

                <Input
                  placeholder="ivan123"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white">
                  Email
                </label>

                <Input
                  type="email"
                  placeholder="example@mail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white">
                  Пароль
                </label>

                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm text-white">
                  Повторите пароль
                </label>

                <Input
                  type="password"
                  placeholder="••••••••"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  className="h-11 bg-white/10 border-white/20 text-white placeholder:text-white/50"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base rounded-xl"
              >
                Зарегистрироваться
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-white/70">
              Уже есть аккаунт?{' '}
              <a
                href="/login"
                className="text-white hover:text-white/80 underline"
              >
                Войти
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}