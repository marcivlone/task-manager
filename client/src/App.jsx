import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/login';
import Register from './pages/register';
import Tasks from './pages/tasks';
import TaskDetail from './pages/TaskDetail';

function App() {
    const token = localStorage.getItem('token');
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={!token ? <Login /> : <Navigate to="/tasks" />} />
                <Route path="/register" element={!token ? <Register /> : <Navigate to="/tasks" />} />
                <Route path="/tasks" element={token ? <Tasks /> : <Navigate to="/login" />} />
                <Route path="/tasks/:id" element={token ? <TaskDetail /> : <Navigate to="/login" />} />
                <Route path="*" element={<Navigate to={token ? "/tasks" : "/login"} />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
