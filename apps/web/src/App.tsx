import { Route, Routes } from 'react-router-dom';
import Dashboard from '@/pages/Dashboard';
import StockDetail from '@/pages/StockDetail';
import Settings from '@/pages/Settings';

export default function App() {
  return (
    <div className="min-h-screen bg-app text-fg">
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/stock/:symbol" element={<StockDetail />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  );
}

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center text-fg-muted">
      404 — 找不到此頁面
    </div>
  );
}