import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Activity, LogOut, User as UserIcon, Menu, Sun, Moon } from "lucide-react";

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout, isKader } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header
      className="bg-card border-b border-line sticky top-0 z-30 shadow-card"
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Left: Hamburger + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={onToggleSidebar}
              aria-label="Buka menu navigasi"
              className="lg:hidden p-2 -ml-2 text-caption hover:text-heading hover:bg-muted rounded-xl transition-colors duration-200"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>

            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-sky-600 text-white rounded-xl shadow-md">
                <Activity className="w-5 h-5" aria-hidden="true" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-base font-bold text-heading leading-tight">
                  Multi-Agent KIA
                </h1>
                <p className="text-xs text-caption font-medium">
                  Posyandu Kec. Airmadidi &bull; 1.000 HPK
                </p>
              </div>
            </div>
          </div>

          {/* Right: Theme Toggle + User + Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme toggle */}
            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
              title={isDark ? "Mode Terang" : "Mode Gelap"}
              className="p-2.5 text-caption hover:text-heading hover:bg-muted rounded-xl transition-colors duration-200"
            >
              {isDark ? (
                <Sun className="w-[18px] h-[18px]" aria-hidden="true" />
              ) : (
                <Moon className="w-[18px] h-[18px]" aria-hidden="true" />
              )}
            </button>

            {/* User info */}
            <div className="flex items-center gap-2.5 bg-subtle px-3 py-1.5 rounded-xl border border-line">
              <div className="w-8 h-8 rounded-full bg-accent-sky flex items-center justify-center text-sky-600 dark:text-sky-400">
                <UserIcon className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="text-left hidden sm:block">
                <p className="text-xs font-semibold text-body leading-tight">
                  {user?.full_name}
                </p>
                <p className="text-[11px] text-caption font-medium leading-tight">
                  {isKader
                    ? `Kader • ${user?.posyandu_name}`
                    : "Admin Puskesmas"}
                </p>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={logout}
              aria-label="Keluar dari sistem"
              title="Keluar"
              className="p-2.5 text-dim hover:text-red-500 hover:bg-accent-red rounded-xl transition-colors duration-200"
            >
              <LogOut className="w-[18px] h-[18px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
