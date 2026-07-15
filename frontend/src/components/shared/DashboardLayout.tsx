import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useNotifications } from '../../context/NotificationContext.js';
import {
  LayoutDashboard,
  Radio,
  FileText,
  Palette,
  Briefcase,
  ListTodo,
  History,
  FolderOpen,
  Link2,
  Terminal,
  Settings,
  LogOut,
  Bell,
  Search,
} from 'lucide-react';

export const DashboardLayout: React.FC = () => {
  const { operator, logout } = useAuth();
  const { unreadCount, resetUnreadCount } = useNotifications();
  const navigate = useNavigate();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Channels', path: '/channels', icon: Radio },
    { name: 'Content Profiles', path: '/content-profiles', icon: FileText },
    { name: 'Templates', path: '/templates', icon: Palette },
    { name: 'Jobs', path: '/jobs', icon: Briefcase },
    { name: 'Queue', path: '/queue', icon: ListTodo },
    { name: 'Publishing History', path: '/publishing-history', icon: History },
    { name: 'Assets', path: '/assets', icon: FolderOpen },
    { name: 'Connections', path: '/platform-connections', icon: Link2 },
    { name: 'Logs', path: '/logs', icon: Terminal },
    { name: 'Settings', path: '/settings', icon: Settings },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0c0c0e]">
      {/* Sidebar */}
      <aside className="flex w-64 flex-col border-r border-[#1a1a24] bg-[#0e0e12] px-4 py-6">
        {/* Workspace Brand Header */}
        <div className="mb-8 px-2">
          <h1 className="text-xl font-bold tracking-tight text-white">PublishIQ</h1>
          <p className="text-xs text-[#6e6e80]">Workspace: Default Workspace</p>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-purple-600/10 text-purple-400 border-l-2 border-purple-500'
                    : 'text-[#9c9cb0] hover:bg-[#161620] hover:text-white'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer & Logout */}
        <div className="mt-auto border-t border-[#1a1a24] pt-4">
          <div className="flex items-center gap-3 px-2 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600/20 text-purple-400 font-bold text-sm">
              OP
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-xs font-semibold text-white">{operator?.email}</p>
              <p className="text-[10px] text-[#6e6e80]">Operator Session</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[#e15c5c] transition-all hover:bg-red-500/10"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="flex h-16 items-center justify-between border-b border-[#1a1a24] bg-[#0e0e12]/80 px-8 backdrop-blur-md">
          {/* Global Search */}
          <div className="relative w-96">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6e6e80]" />
            <input
              type="text"
              placeholder="Search across channels, profiles, jobs, logs..."
              className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] py-2 pr-4 pl-10 text-sm text-[#e0e0e6] placeholder-[#6e6e80] outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={resetUnreadCount}
              className="relative rounded-full p-2 text-[#9c9cb0] transition hover:bg-[#161620] hover:text-white"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-purple-500 text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            <div className="h-8 w-px bg-[#1a1a24]" />

            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs text-[#9c9cb0]">System Operational</span>
            </div>
          </div>
        </header>

        {/* Route Page Body */}
        <main className="flex-1 overflow-y-auto bg-[#0a0a0c] p-8 text-[#e0e0e6]">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
