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

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

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
    <div className="min-h-screen flex items-center">
      <div className="w-full max-w-7xl mx-auto px-[8%]">
        <Card className="w-[460px] bg-black/25 backdrop-blur-xl border border-white/10 shadow-2xl rounded-3xl text-white">
          <CardHeader className="pb-6 text-center">
            <CardTitle className="text-4xl font-extrabold text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.4)]">
              Добро пожаловать
            </CardTitle>

            <CardDescription className="text-slate-200 text-base">
              Войдите в свой аккаунт
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

              <Button
                type="submit"
                className="w-full h-11 text-base rounded-xl"
              >
                Войти
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-white/70">
              Нет аккаунта?{' '}
              <a
                href="/register"
                className="text-white hover:text-white/80 underline"
              >
                Зарегистрироваться
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}