import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.js';
import { useNotifications } from '../../context/NotificationContext.js';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client.js';
import {
  LayoutDashboard,
  Radio,
  FileText,
  FileCode,
  Palette,
  Briefcase,
  ListTodo,
  History,
  FolderOpen,
  Tags,
  Layers,
  Link2,
  Terminal,
  Settings,
  LogOut,
  Bell,
  Search,
  Loader2,
  ExternalLink
} from 'lucide-react';

interface SearchResult {
  channels: any[];
  generatedContents: any[];
  jobs: any[];
  publishingRecords: any[];
  assets: any[];
  templates: any[];
  prompts: any[];
  contentProfiles: any[];
}

export const DashboardLayout: React.FC = () => {
  const { operator, logout } = useAuth();
  const { unreadCount, resetUnreadCount } = useNotifications();
  const navigate = useNavigate();

  const [searchVal, setSearchVal] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchVal);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchVal]);

  // Global Search Query
  const { data: searchResults, isFetching } = useQuery<{ data: SearchResult }>({
    queryKey: ['global-search', debouncedQuery],
    queryFn: async () => {
      const res = await apiClient.get('/search', { params: { q: debouncedQuery } });
      return res.data;
    },
    enabled: debouncedQuery.trim().length >= 2,
  });

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Channels', path: '/channels', icon: Radio },
    { name: 'Workspaces', path: '/workspaces', icon: Layers },
    { name: 'Content Types', path: '/content-types', icon: Tags },
    { name: 'Content Profiles', path: '/content-profiles', icon: FileText },
    { name: 'Prompts', path: '/prompts', icon: FileCode },
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

  const handleResultClick = (targetPath: string) => {
    setSearchVal('');
    navigate(targetPath);
  };

  const hasResults = searchResults?.data && (
    searchResults.data.channels.length > 0 ||
    searchResults.data.generatedContents.length > 0 ||
    searchResults.data.jobs.length > 0 ||
    searchResults.data.publishingRecords.length > 0 ||
    searchResults.data.assets.length > 0 ||
    searchResults.data.templates.length > 0 ||
    searchResults.data.prompts.length > 0 ||
    searchResults.data.contentProfiles.length > 0
  );

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
        <header className="flex h-16 items-center justify-between border-b border-[#1a1a24] bg-[#0e0e12]/80 px-8 backdrop-blur-md z-30">
          {/* Global Search */}
          <div className="relative w-96">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#6e6e80]" />
            <input
              type="text"
              placeholder="Search across channels, profiles, jobs, logs..."
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              className="w-full rounded-lg border border-[#1a1a24] bg-[#161620] py-2 pr-4 pl-10 text-sm text-[#e0e0e6] placeholder-[#6e6e80] outline-none transition-all focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
            />
            {isFetching && (
              <Loader2 className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin text-purple-400" />
            )}

            {/* Dropdown Results Overlay */}
            {searchVal.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-12 z-50 bg-[#0f0f16] border border-[#1d1d2d] rounded-xl shadow-2xl p-4 max-h-[30rem] overflow-y-auto backdrop-blur-lg">
                {!hasResults && !isFetching ? (
                  <div className="text-xs text-[#6e6e80] py-4 text-center">No search matches found.</div>
                ) : (
                  <div className="space-y-4">
                    {/* Channels */}
                    {searchResults?.data.channels.length ? (
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#6e6e80] mb-1.5">Channels</div>
                        {searchResults.data.channels.map((ch: any) => (
                          <div
                            key={ch.id}
                            onClick={() => handleResultClick('/channels')}
                            className="flex justify-between items-center px-2.5 py-1.5 text-xs text-[#e0e0e6] hover:bg-[#1c1c2e] hover:text-white rounded-lg cursor-pointer transition-colors"
                          >
                            <span>{ch.name}</span>
                            <Radio className="h-3.5 w-3.5 text-[#9c9cb0]" />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Prompts */}
                    {searchResults?.data.prompts.length ? (
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#6e6e80] mb-1.5">Prompts</div>
                        {searchResults.data.prompts.map((p: any) => (
                          <div
                            key={p.id}
                            onClick={() => handleResultClick('/prompts')}
                            className="flex justify-between items-center px-2.5 py-1.5 text-xs text-[#e0e0e6] hover:bg-[#1c1c2e] hover:text-white rounded-lg cursor-pointer transition-colors"
                          >
                            <span>{p.name}</span>
                            <FileCode className="h-3.5 w-3.5 text-[#9c9cb0]" />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Templates */}
                    {searchResults?.data.templates.length ? (
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#6e6e80] mb-1.5">Templates</div>
                        {searchResults.data.templates.map((t: any) => (
                          <div
                            key={t.id}
                            onClick={() => handleResultClick('/templates')}
                            className="flex justify-between items-center px-2.5 py-1.5 text-xs text-[#e0e0e6] hover:bg-[#1c1c2e] hover:text-white rounded-lg cursor-pointer transition-colors"
                          >
                            <span>{t.name}</span>
                            <Palette className="h-3.5 w-3.5 text-[#9c9cb0]" />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Content Profiles */}
                    {searchResults?.data.contentProfiles.length ? (
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#6e6e80] mb-1.5">Profiles</div>
                        {searchResults.data.contentProfiles.map((cp: any) => (
                          <div
                            key={cp.id}
                            onClick={() => handleResultClick('/content-profiles')}
                            className="flex justify-between items-center px-2.5 py-1.5 text-xs text-[#e0e0e6] hover:bg-[#1c1c2e] hover:text-white rounded-lg cursor-pointer transition-colors"
                          >
                            <span>{cp.tone} / {cp.writingStyle}</span>
                            <FileText className="h-3.5 w-3.5 text-[#9c9cb0]" />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Jobs */}
                    {searchResults?.data.jobs.length ? (
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#6e6e80] mb-1.5">Jobs & Pipeline</div>
                        {searchResults.data.jobs.map((job: any) => (
                          <div
                            key={job.id}
                            onClick={() => handleResultClick('/jobs')}
                            className="flex justify-between items-center px-2.5 py-1.5 text-xs text-[#e0e0e6] hover:bg-[#1c1c2e] hover:text-white rounded-lg cursor-pointer transition-colors"
                          >
                            <span className="truncate max-w-[14rem]">{job.generatedText || job.failureReason}</span>
                            <Briefcase className="h-3.5 w-3.5 text-[#9c9cb0]" />
                          </div>
                        ))}
                      </div>
                    ) : null}

                    {/* Publishing History */}
                    {searchResults?.data.publishingRecords.length ? (
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-wider text-[#6e6e80] mb-1.5">Publications</div>
                        {searchResults.data.publishingRecords.map((pub: any) => (
                          <div
                            key={pub.id}
                            onClick={() => handleResultClick('/publishing-history')}
                            className="flex justify-between items-center px-2.5 py-1.5 text-xs text-[#e0e0e6] hover:bg-[#1c1c2e] hover:text-white rounded-lg cursor-pointer transition-colors"
                          >
                            <span className="truncate max-w-[14rem]">{pub.platformPostId || pub.publishedUrl || pub.errorDetails}</span>
                            <ExternalLink className="h-3.5 w-3.5 text-[#9c9cb0]" />
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                resetUnreadCount();
                navigate('/notifications');
              }}
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
