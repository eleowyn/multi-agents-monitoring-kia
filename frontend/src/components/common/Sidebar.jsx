import React, { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  ClipboardList,
  Users,
  LayoutDashboard,
  UserCheck,
  ShieldAlert,
  X,
} from "lucide-react";

const Sidebar = ({ isOpen, onClose }) => {
  const { isKader, isAdmin } = useAuth();

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const kaderLinks = [
    { to: "/kader/input-kunjungan", label: "Input Kunjungan", icon: ClipboardList },
    { to: "/kader/data-pasien", label: "Data & Riwayat Pasien", icon: Users },
  ];

  const adminLinks = [
    { to: "/admin/dashboard", label: "Dashboard Agregat", icon: LayoutDashboard },
    { to: "/admin/manage-pasien", label: "Kelola Data Pasien", icon: Users },
    { to: "/admin/manage-kader", label: "Kelola Kader & Posyandu", icon: UserCheck },
    { to: "/admin/audit-logs", label: "Audit Log Evaluator AI", icon: ShieldAlert },
  ];

  const links = isKader ? kaderLinks : adminLinks;

  const sidebarContent = (
    <div className="space-y-1">
      <p className="px-3 text-[11px] font-bold text-dim uppercase tracking-wider mb-3">
        {isKader ? "Menu Pelayanan Kader" : "Menu Administrator"}
      </p>
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                isActive
                  ? "bg-accent-sky text-sky-700 dark:text-sky-300 font-semibold shadow-sm border border-sky-200 dark:border-sky-800/50"
                  : "text-label hover:bg-muted hover:text-heading"
              }`
            }
            aria-label={link.label}
          >
            <Icon className="w-[18px] h-[18px] flex-shrink-0" aria-hidden="true" />
            <span>{link.label}</span>
          </NavLink>
        );
      })}
    </div>
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex w-64 bg-card border-r border-line min-h-[calc(100vh-4rem)] p-4 flex-col justify-between"
        role="navigation"
        aria-label="Navigasi utama"
      >
        {sidebarContent}
      </aside>

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-line p-4 flex flex-col justify-between lg:hidden transform transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        role="navigation"
        aria-label="Navigasi utama"
        aria-hidden={!isOpen}
      >
        <div className="flex justify-end mb-2">
          <button
            onClick={onClose}
            aria-label="Tutup menu navigasi"
            className="p-2 text-dim hover:text-label hover:bg-muted rounded-xl transition-colors duration-200"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
};

export default Sidebar;
