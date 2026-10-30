import React from "react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { Activity, User as UserIcon, Menu, Sun, Moon } from "lucide-react";

const Navbar = ({ onToggleSidebar }) => {
  const { user, isKader } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header
      className="bg-card border-b border-line sticky top-0 z-30 shadow-card"
      role="banner"
    >
      <div className="px-4 sm:px-6">
        <div className="flex justify-between h-16 items-center">
          {/* Sisi Kiri: Tombol Hamburger Menu (Mobile) & Identitas Sistem */}
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
                  Posyandu Kec. Airmadidi • 1.000 HPK
                </p>
              </div>
            </div>
          </div>

          {/* Sisi Kanan: Theme Toggle & Profil Pengguna Aktif (Logout dipindah ke Sidebar) */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Tombol Pengubah Tema Terang / Gelap */}
            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
              title={isDark ? "Mode Terang" : "Mode Gelap"}
              className="btn-interactive p-2.5 text-caption hover:text-heading hover:bg-muted rounded-xl transition-colors duration-200 cursor-pointer"
            >
              {isDark ? (
                <Sun className="w-[18px] h-[18px]" aria-hidden="true" />
              ) : (
                <Moon className="w-[18px] h-[18px]" aria-hidden="true" />
              )}
            </button>

            {/* Kartu Informasi Akun Pengguna Aktif */}
            <div className="flex items-center gap-2.5 bg-subtle px-3 py-1.5 rounded-xl border border-line">
              <div className="w-8 h-8 rounded-full bg-accent-sky flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                <UserIcon className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="hidden sm:flex flex-col justify-center leading-tight">
                <span className="text-xs font-bold text-heading truncate max-w-[200px]">
                  {user?.full_name || user?.username || (isKader ? "Kader Posyandu" : "Administrator")}
                </span>
                <span className="text-xs text-caption font-medium truncate max-w-[220px] mt-0.5">
                  {isKader
                    ? `${user?.posyandu_name || "Posyandu"} • ${user?.village_name || "Kec. Airmadidi"}`
                    : `${user?.posyandu_name || "Puskesmas Airmadidi"} • ${user?.village_name || "Kec. Airmadidi"}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
