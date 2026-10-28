import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/AuthContext";
import HpkTimelineStepper from "../../components/kader/HpkTimelineStepper";
import KmsDigitalChart from "../../components/kader/KmsDigitalChart";
import {
  HeartPulse,
  Users,
  Search,
  Filter,
  RefreshCw,
  Baby,
  Heart,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  FileText,
  PlusCircle,
  GraduationCap,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";

const MonitoringKia = () => {
  const { user, isKader, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State Pasien & Pencarian
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(searchParams.get("patient_id") || "");
  const [selectedLongitudinal, setSelectedLongitudinal] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState(""); // "" | "MOTHER" | "CHILD"

  // State Loading & Error
  const [loadingPatients, setLoadingPatients] = useState(true);
  const [loadingLongitudinal, setLoadingLongitudinal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  // 1. Ambil daftar pasien saat mount / ganti filter
  useEffect(() => {
    fetchPatientsList();
  }, [filterType]);

  const fetchPatientsList = async () => {
    try {
      setLoadingPatients(true);
      setError("");
      const params = {};
      if (filterType) params.patient_type = filterType;
      const res = await api.get("/patients/", { params: { limit: 250, ...params } });
      const data = res.data || [];
      setPatients(data);

      // Otomatis pilih pasien pertama jika belum ada yang terpilih
      if (data.length > 0 && !selectedPatientId) {
        setSelectedPatientId(String(data[0].id));
      }
    } catch (err) {
      console.error(err);
      setError("Gagal memuat daftar pasien. Silakan periksa koneksi backend.");
    } finally {
      setLoadingPatients(false);
    }
  };

  // 2. Ambil data longitudinal ketika pasien terpilih berubah
  useEffect(() => {
    if (!selectedPatientId) return;
    fetchPatientLongitudinal(selectedPatientId);
    setSearchParams({ patient_id: selectedPatientId }, { replace: true });
  }, [selectedPatientId]);

  const fetchPatientLongitudinal = async (patientId, isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      else setLoadingLongitudinal(true);
      setError("");

      const res = await api.get(`/patients/${patientId}/longitudinal`);
      setSelectedLongitudinal(res.data);
    } catch (err) {
      console.error(err);
      setError("Gagal mengambil data riwayat longitudinal pasien.");
      setSelectedLongitudinal(null);
    } finally {
      setLoadingLongitudinal(false);
      setRefreshing(false);
    }
  };

  // Filter pencarian nama/NIK
  const filteredPatients = patients.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.nik.includes(searchQuery)
  );

  const selectedPatient = selectedLongitudinal?.patient || patients.find((p) => String(p.id) === String(selectedPatientId));
  const isChild = selectedPatient?.patient_type === "CHILD";
  const visits = selectedLongitudinal?.visits || (isChild ? selectedLongitudinal?.child_visits : selectedLongitudinal?.maternal_visits) || [];
  const hpkStatus = selectedLongitudinal?.hpk_status || selectedPatient?.hpk_status || null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* ═══ Header Pusat Monitoring KIA ═══ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-line-light">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="p-2 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 rounded-xl border border-sky-200 dark:border-sky-800/50">
              <HeartPulse className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
              Pusat Monitoring KIA 1.000 HPK
            </h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Monitoring Aktif
            </span>
          </div>
          <p className="text-xs sm:text-sm text-caption mt-1">
            Pemantauan Kontinu Ibu Hamil &amp; Tumbuh Kembang Baduta &bull; Wilayah Kerja {user?.village_name || "Kecamatan Airmadidi"}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => selectedPatientId && fetchPatientLongitudinal(selectedPatientId, true)}
            disabled={loadingLongitudinal || refreshing || !selectedPatientId}
            className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 bg-card border border-line hover:bg-muted text-label hover:text-heading rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-sky-600 dark:text-sky-400 ${refreshing ? "animate-spin" : ""}`} />
            <span>{refreshing ? "Menyegarkan..." : "Segarkan"}</span>
          </button>

          {isKader && (
            <button
              onClick={() => navigate("/kader/input-kunjungan")}
              className="btn-interactive flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition-colors duration-200 cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Input Kunjungan</span>
            </button>
          )}
        </div>
      </div>

      {/* ═══ Alert Error bila ada ═══ */}
      {error && (
        <div className="p-4 bg-accent-red border border-red-300 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => selectedPatientId && fetchPatientLongitudinal(selectedPatientId)}
            className="px-3 py-1 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold"
          >
            Coba Lagi
          </button>
        </div>
      )}

      {/* ═══ Bilah Pemilih Pasien Cepat (Quick Patient Selector) ═══ */}
      <div className="bg-card rounded-2xl border border-line shadow-card p-4 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Kolom Pencarian */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-caption absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari pasien berdasarkan nama atau NIK..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-subtle border border-line rounded-xl text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
            />
          </div>

          {/* Filter Jenis Pasien */}
          <div className="inline-flex rounded-xl border border-line p-0.5 bg-subtle shrink-0">
            <button
              onClick={() => setFilterType("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${filterType === "" ? "bg-sky-600 text-white" : "text-caption hover:text-heading"}`}
            >
              Semua ({patients.length})
            </button>
            <button
              onClick={() => setFilterType("CHILD")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${filterType === "CHILD" ? "bg-sky-600 text-white" : "text-caption hover:text-heading"}`}
            >
              Baduta (Anak)
            </button>
            <button
              onClick={() => setFilterType("MOTHER")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${filterType === "MOTHER" ? "bg-pink-600 text-white" : "text-caption hover:text-heading"}`}
            >
              Ibu Hamil
            </button>
          </div>
        </div>

        {/* Pemilih Pasien Dropdown / Chips */}
        <div>
          <label htmlFor="patient-select-input" className="text-[11px] font-bold text-caption uppercase tracking-wider block mb-1">
            Pilih Sasaran Pasien yang Dipantau:
          </label>
          <select
            id="patient-select-input"
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-card border border-line rounded-xl text-xs font-semibold text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/40 cursor-pointer"
          >
            {filteredPatients.length === 0 ? (
              <option value="">Tidak ada pasien yang sesuai filter</option>
            ) : (
              filteredPatients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.patient_type === "CHILD" ? "Anak / Baduta" : "Ibu Hamil"}) &bull; NIK: {p.nik} &bull; {p.village_name || "Airmadidi"}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* ═══ Kartu Profil Pasien Terpilih ═══ */}
      {selectedPatient && (
        <div className="bg-card rounded-2xl border border-line shadow-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${isChild ? "bg-sky-50 dark:bg-sky-950/40 text-sky-600 border-sky-200 dark:border-sky-800" : "bg-pink-50 dark:bg-pink-950/40 text-pink-600 border-pink-200 dark:border-pink-800"}`}>
              {isChild ? <Baby className="w-6 h-6" /> : <Heart className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-heading">
                  {selectedPatient.name}
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${isChild ? "bg-sky-100 text-sky-800 border-sky-200" : "bg-pink-100 text-pink-800 border-pink-200"}`}>
                  {isChild ? "Fase 3: Baduta (1-24 Bln)" : "Fase 1: Ibu Hamil"}
                </span>
                {hpkStatus?.is_graduation_milestone && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    🎓 Lulus 1.000 HPK
                  </span>
                )}
              </div>
              <p className="text-xs text-caption mt-0.5 flex items-center gap-2 flex-wrap">
                <span>NIK: <strong>{selectedPatient.nik}</strong></span>
                <span>&bull;</span>
                <span>Desa: <strong>{selectedPatient.village_name || "Airmadidi"}</strong></span>
                <span>&bull;</span>
                <span>Jumlah Kunjungan: <strong>{visits.length} Kali</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {isKader && (
              <button
                onClick={() => navigate(`/kader/data-pasien`)}
                className="btn-interactive inline-flex items-center gap-1.5 px-3 py-2 bg-subtle border border-line rounded-xl text-xs font-semibold text-caption hover:text-heading transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Buka Profil Penuh</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ═══ Komponen 1: Garis Waktu Interaktif 1.000 HPK (Prioritas 3) ═══ */}
      <HpkTimelineStepper
        patient={selectedPatient}
        hpkStatus={hpkStatus}
        childVisits={selectedLongitudinal?.child_visits || (isChild ? visits : [])}
        maternalVisits={selectedLongitudinal?.maternal_visits || (!isChild ? visits : [])}
        maternalSummary={selectedLongitudinal?.maternal_summary}
        onSelectVisit={(v) => console.log("Selected visit:", v)}
      />

      {/* ═══ Komponen 2: Grafik Pertumbuhan Pita Warna KMS Digital (Prioritas 2) ═══ */}
      <KmsDigitalChart
        patient={selectedPatient}
        visits={visits}
        loading={loadingLongitudinal}
      />
    </div>
  );
};

export default MonitoringKia;

