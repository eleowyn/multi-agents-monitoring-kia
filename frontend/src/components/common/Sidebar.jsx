import React, { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  ClipboardList,
  Users,
  FileText,
  LayoutDashboard,
  UserCheck,
  ShieldAlert,
  FileEdit,
  X,
  HeartPulse,
} from "lucide-react";
import api from "../../services/api";

const Sidebar = ({ isOpen, onClose }) => {
  const { isKader, isAdmin } = useAuth();
  const [pendingRevisions, setPendingRevisions] = React.useState(0);

  useEffect(() => {
    if (isAdmin) {
      api
        .get("/revisions/", { params: { status: "PENDING" } })
        .then((res) => setPendingRevisions(res.data?.length || 0))
        .catch(() => {});
    }
  }, [isAdmin, isOpen]);

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
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const kaderLinks = [
    { to: "/kader/dashboard", label: "Dashboard Posyandu", icon: LayoutDashboard },
    { to: "/kader/monitoring-kia", label: "Pusat Monitoring 1.000 HPK", icon: HeartPulse },
    { to: "/kader/input-kunjungan", label: "Input Kunjungan", icon: ClipboardList },
    { to: "/kader/data-pasien", label: "Data & Riwayat Pasien", icon: Users },
    { to: "/kader/laporan-kia", label: "Arsip Laporan KIA", icon: FileText },
  ];

  const adminLinks = [
    { to: "/admin/dashboard", label: "Dashboard Agregat", icon: LayoutDashboard },
    { to: "/admin/monitoring-kia", label: "Pusat Monitoring 1.000 HPK", icon: HeartPulse },
    { to: "/admin/reports", label: "Kelola Laporan Kunjungan", icon: FileText },
    { to: "/admin/manage-pasien", label: "Kelola Data Pasien", icon: Users },
    { to: "/admin/manage-kader", label: "Kelola Kader & Posyandu", icon: UserCheck },
    { to: "/admin/revisions", label: "Validasi Revisi Data", icon: FileEdit, count: pendingRevisions },
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
              `flex items-center gap-3 px-3.5 py-3 rounded-xl font-medium text-sm transition-all duration-150 active:scale-[0.98] ${
                isActive
                  ? "bg-accent-sky text-sky-700 dark:text-sky-300 font-semibold shadow-xs border border-sky-200 dark:border-sky-800/50 translate-x-1"
                  : "text-label hover:bg-muted hover:text-heading hover:translate-x-1"
              }`
            }
            aria-label={link.label}
          >
            <Icon
              className="w-[18px] h-[18px] flex-shrink-0 transition-transform duration-150 group-hover:scale-110"
              aria-hidden="true"
            />
            <span className="flex-1">{link.label}</span>
            {link.count > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
                {link.count}
              </span>
            )}
          </NavLink>
        );
      })}
    </div>
  );

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/40 dark:bg-black/60 z-40 lg:hidden animate-fade-in"
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
            className="btn-interactive p-2 text-dim hover:text-label hover:bg-muted rounded-xl transition-colors duration-200 cursor-pointer"
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
