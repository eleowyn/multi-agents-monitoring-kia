import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar from "./components/common/Navbar";
import Sidebar from "./components/common/Sidebar";

import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import KaderDashboard from "./pages/kader/KaderDashboard";
import InputKunjungan from "./pages/kader/InputKunjungan";
import ValidasiLaporan from "./pages/kader/ValidasiLaporan";
import DataPasien from "./pages/kader/DataPasien";
import ArsipLaporan from "./pages/kader/ArsipLaporan";
import MonitoringKia from "./pages/kader/MonitoringKia";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManagePasien from "./pages/admin/ManagePasien";
import ManageKader from "./pages/admin/ManageKader";
import AuditLogs from "./pages/admin/AuditLogs";
import AdminRevisions from "./pages/admin/AdminRevisions";
import ManageReports from "./pages/admin/ManageReports";
import DoctorMonitoring from "./pages/doctor/DoctorMonitoring";

const ProtectedLayout = ({ children, allowedRole, allowedRoles }) => {
  const { user, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page">
        <div className="text-center space-y-3 animate-fade-in">
          <div className="spinner w-8 h-8 border-sky-600 border-t-transparent mx-auto" />
          <p className="text-sm text-caption font-medium">Memuat sesi...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const isAllowed = allowedRoles
    ? allowedRoles.includes(user.role)
    : allowedRole
    ? user.role === allowedRole
    : true;

  if (!isAllowed) {
    let redirectPath = "/admin/dashboard";
    if (user.role === "KADER") redirectPath = "/kader/dashboard";
    if (user.role === "DOKTER") redirectPath = "/doctor/monitoring";
    return <Navigate to={redirectPath} replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-page">
      <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex flex-1 relative">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main
          className="flex-1 bg-page overflow-y-auto min-h-[calc(100vh-4rem)]"
          id="main-content"
          role="main"
        >
          {children}
        </main>
      </div>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/kader/dashboard"
            element={
              <ProtectedLayout allowedRole="KADER">
                <KaderDashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/kader/monitoring-kia"
            element={
              <ProtectedLayout allowedRoles={["KADER", "ADMIN", "DOKTER"]}>
                <MonitoringKia />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin/monitoring-kia"
            element={
              <ProtectedLayout allowedRoles={["KADER", "ADMIN", "DOKTER"]}>
                <MonitoringKia />
              </ProtectedLayout>
            }
          />
          <Route
            path="/kader/input-kunjungan"
            element={
              <ProtectedLayout allowedRole="KADER">
                <InputKunjungan />
              </ProtectedLayout>
            }
          />
          <Route
            path="/kader/validasi-laporan/:reportId"
            element={
              <ProtectedLayout allowedRoles={["KADER", "ADMIN", "DOKTER"]}>
                <ValidasiLaporan />
              </ProtectedLayout>
            }
          />
          <Route
            path="/kader/data-pasien"
            element={
              <ProtectedLayout allowedRole="KADER">
                <DataPasien />
              </ProtectedLayout>
            }
          />
          <Route
            path="/kader/laporan-kia"
            element={
              <ProtectedLayout allowedRole="KADER">
                <ArsipLaporan />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedLayout allowedRole="ADMIN">
                <AdminDashboard />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin/manage-pasien"
            element={
              <ProtectedLayout allowedRole="ADMIN">
                <ManagePasien />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin/manage-kader"
            element={
              <ProtectedLayout allowedRole="ADMIN">
                <ManageKader />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin/audit-logs"
            element={
              <ProtectedLayout allowedRole="ADMIN">
                <AuditLogs />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin/revisions"
            element={
              <ProtectedLayout allowedRoles={["ADMIN", "DOKTER"]}>
                <AdminRevisions />
              </ProtectedLayout>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedLayout allowedRole="ADMIN">
                <ManageReports />
              </ProtectedLayout>
            }
          />
          <Route
            path="/doctor/monitoring"
            element={
              <ProtectedLayout allowedRoles={["DOKTER", "ADMIN"]}>
                <DoctorMonitoring />
              </ProtectedLayout>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
