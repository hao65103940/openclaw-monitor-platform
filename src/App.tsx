import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Trace from './pages/Trace';
import Analytics from './pages/Analytics';
import Configs from './pages/Configs';
import Logs from './pages/Logs';
import dayjs from 'dayjs';

function Layout({ children }: { children: React.ReactNode }) {
  const [currentTime, setCurrentTime] = useState(dayjs());

  // 动态更新时间（每秒）
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(dayjs());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* 顶部导航 */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-primary-400">🔍 Agent 监控平台</h1>
              <div className="flex space-x-4">
                <Link to="/" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors">
                  📊 仪表盘
                </Link>
                <Link to="/trace" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors">
                  🔗 执行链路
                </Link>
                <Link to="/analytics" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors">
                  📈 性能分析
                </Link>
                <Link to="/configs" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors">
                  ⚙️ 配置管理
                </Link>
                <Link to="/logs" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-700 transition-colors">
                  📝 日志查看
                </Link>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-400 font-mono">
                {currentTime.format('YYYY-MM-DD HH:mm:ss')}
              </span>
            </div>
          </div>
        </div>
      </nav>

      {/* 主要内容 */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/trace" element={<Trace />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/configs" element={<Configs />} />
          <Route path="/logs" element={<Logs />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
