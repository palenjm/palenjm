import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, LogOut, Home, Search, MessageSquare, Upload } from "lucide-react";

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: Home, testId: "nav-dashboard" },
    { path: "/search", label: "Search", icon: Search, testId: "nav-search" },
    { path: "/chat", label: "Chat", icon: MessageSquare, testId: "nav-chat" },
    { path: "/upload", label: "Upload", icon: Upload, testId: "nav-upload" }
  ];

  return (
    <nav className="glass border-b border-white/30 sticky top-0 z-50" data-testid="navbar">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate('/dashboard')}
          >
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg" style={{ fontFamily: 'Manrope' }}>DMRS</h1>
              <p className="text-xs text-slate-500">NEMSU</p>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Button
                  key={item.path}
                  variant={isActive ? "default" : "ghost"}
                  onClick={() => navigate(item.path)}
                  className="gap-2"
                  data-testid={item.testId}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
            <Button variant="outline" onClick={onLogout} data-testid="logout-button">
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
