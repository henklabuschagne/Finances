import { Outlet, Link, useLocation } from 'react-router';
import { 
  LayoutDashboard, 
  Receipt, 
  FolderOpen, 
  Tag, 
  Upload as UploadIcon,
  Wallet,
  LogOut
} from 'lucide-react';
import { cn } from './ui/utils';
import { Button } from './ui/button';
import { toast } from 'sonner';

export function Layout() {
  const location = useLocation();

  const handleLogout = () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('financeDashboardAuth');
      toast.success('Logged out successfully');
      // Reload the page to trigger authentication check
      window.location.reload();
    }
  };

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/transactions', label: 'Transactions', icon: Receipt },
    { path: '/budget', label: 'Budget', icon: Wallet },
    { path: '/files', label: 'Files', icon: FolderOpen },
    { path: '/categories', label: 'Categories', icon: Tag },
    { path: '/upload', label: 'Upload', icon: UploadIcon },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">FinanceTracker</h1>
          <p className="text-sm text-slate-600 mt-1">Manage your finances</p>
        </div>
        
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                      isActive 
                        ? 'bg-blue-50 text-blue-700 font-medium' 
                        : 'text-slate-700 hover:bg-slate-100'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <Button
            onClick={handleLogout}
            variant="outline"
            className="w-full justify-start text-slate-700 hover:text-red-600 hover:bg-red-50 hover:border-red-200"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
          
          <div className="text-xs text-slate-500">
            <p>© 2026 FinanceTracker</p>
            <p className="mt-1">Track your spending wisely</p>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}