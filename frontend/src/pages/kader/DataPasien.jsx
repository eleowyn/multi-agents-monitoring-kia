import React, { useState, useEffect, useRef } from "react";
import api from "../../services/api";
import {
  Users,
  Search,
  GitFork,
  AlertTriangle,
  X,
  RefreshCw,
  FileSearch,
} from "lucide-react";

const SkeletonRow = () => (
  <tr>
    <td className="p-4"><div className="skeleton skeleton-text w-36" /><div className="skeleton skeleton-text short w-28 mt-1.5" /></td>
    <td className="p-4"><div className="skeleton w-20 h-5 rounded-full" /></td>
    <td className="p-4"><div className="skeleton skeleton-text w-24" /></td>
    <td className="p-4"><div className="skeleton skeleton-text w-28" /></td>
    <td className="p-4 text-center"><div className="skeleton w-32 h-8 rounded-xl mx-auto" /></td>
  </tr>
);

const SkeletonCard = () => (
  <div className="p-4 bg-card rounded-xl border border-line space-y-3">
    <div className="flex justify-between items-start">
      <div><div className="skeleton skeleton-text w-36" /><div className="skeleton skeleton-text short w-28 mt-1" /></div>
      <div className="skeleton w-16 h-5 rounded-full" />
    </div>
    <div className="flex gap-4"><div className="skeleton skeleton-text w-24" /><div className="skeleton skeleton-text w-28" /></div>
    <div className="skeleton w-full h-9 rounded-xl" />
  </div>
);

const DataPasien = () => {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [selectedLongitudinal, setSelectedLongitudinal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const modalRef = useRef(null);

  useEffect(() => { fetchPatients(); }, [filterType]);

  const fetchPatients = async () => {
    try {
      setLoading(true); setError("");
      const params = {};
      if (filterType) params.patient_type = filterType;
      const res = await api.get("/patients/", { params });
      setPatients(res.data);
    } catch (e) {
      setError("Gagal memuat data pasien. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewLongitudinal = async (patientId) => {
    try {
      const res = await api.get(`/patients/${patientId}/longitudinal`);
      setSelectedLongitudinal(res.data);
    } catch (e) {
      setError("Gagal mengambil data riwayat longitudinal.");
    }
  };

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === "Escape" && selectedLongitudinal) setSelectedLongitudinal(null); };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [selectedLongitudinal]);

  useEffect(() => {
    if (selectedLongitudinal && modalRef.current) modalRef.current.focus();
  }, [selectedLongitudinal]);

  const filtered = patients.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.nik.includes(search),
  );

  const filterButtons = [
    { value: "", label: "Semua", activeClass: "bg-sky-600 text-white border-sky-600" },
    { value: "MOTHER", label: "Ibu Hamil", activeClass: "bg-pink-600 text-white border-pink-600" },
    { value: "CHILD", label: "Anak / Baduta", activeClass: "bg-blue-600 text-white border-blue-600" },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-heading">Direktori & Riwayat Pasien KIA</h2>
        <p className="text-sm text-caption mt-1">Pelacakan rekam medis longitudinal ibu dan anak lintas fase 1.000 HPK</p>
      </div>

      {error && (
        <div role="alert" aria-live="polite" className="p-4 bg-accent-red border border-red-300 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3 animate-slide-up">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 dark:text-red-400" aria-hidden="true" />
            <span>{error}</span>
          </div>
          <button onClick={fetchPatients} aria-label="Coba muat ulang data" className="flex items-center gap-1.5 px-3 py-1.5 bg-red-100 dark:bg-red-900/40 hover:bg-red-200 dark:hover:bg-red-900/60 text-red-700 dark:text-red-300 rounded-lg text-xs font-semibold transition-colors duration-200 flex-shrink-0">
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />Coba Lagi
          </button>
        </div>
      )}

      {/* Filter & Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1" role="search">
          <input type="text" placeholder="Cari berdasarkan nama atau 16 digit NIK..." value={search} onChange={(e) => setSearch(e.target.value)}
            aria-label="Cari pasien berdasarkan nama atau NIK"
            className="w-full pl-10 pr-4 py-3 bg-card border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all duration-200"
          />
          <Search className="w-[18px] h-[18px] text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
        </div>
        <div className="flex gap-2" role="group" aria-label="Filter tipe pasien">
          {filterButtons.map((btn) => (
            <button key={btn.value} onClick={() => setFilterType(btn.value)} aria-pressed={filterType === btn.value}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
                filterType === btn.value ? btn.activeClass : "bg-card border-line text-label hover:bg-muted hover:border-line"
              }`}
            >{btn.label}</button>
          ))}
        </div>
      </div>

      {!loading && (
        <p className="text-xs text-dim font-medium" aria-live="polite">
          Menampilkan {filtered.length} dari {patients.length} pasien
        </p>
      )}

      {/* Desktop Table */}
      <div className="hidden md:block bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        {loading ? (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-label border-b border-line">
              <tr>
                <th className="p-4 font-semibold">NIK & Nama Pasien</th>
                <th className="p-4 font-semibold">Tipe & Jenis Kelamin</th>
                <th className="p-4 font-semibold">Tanggal Lahir</th>
                <th className="p-4 font-semibold">Desa / Posyandu</th>
                <th className="p-4 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">{[...Array(5)].map((_, i) => <SkeletonRow key={i} />)}</tbody>
          </table>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <FileSearch className="w-12 h-12 text-dim mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-caption">{search ? "Tidak ada pasien yang cocok" : "Belum ada data pasien"}</p>
            <p className="text-xs text-dim mt-1">{search ? "Coba ubah kata kunci pencarian atau filter" : "Data pasien akan muncul setelah didaftarkan oleh kader"}</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-label border-b border-line">
              <tr>
                <th className="p-4 font-semibold">NIK & Nama Pasien</th>
                <th className="p-4 font-semibold">Tipe & Jenis Kelamin</th>
                <th className="p-4 font-semibold">Tanggal Lahir</th>
                <th className="p-4 font-semibold">Desa / Posyandu</th>
                <th className="p-4 font-semibold text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-accent-sky transition-colors duration-150">
                  <td className="p-4">
                    <p className="font-semibold text-heading">{p.name}</p>
                    <p className="text-xs text-dim mt-0.5">NIK: {p.nik}</p>
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                      p.patient_type === "MOTHER"
                        ? "bg-accent-pink text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/50"
                        : "bg-accent-blue text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
                    }`}>
                      {p.patient_type === "MOTHER" ? "Ibu Hamil" : `Anak (${p.gender || "-"})`}
                    </span>
                  </td>
                  <td className="p-4 text-label">{p.birth_date}</td>
                  <td className="p-4 text-label">{p.village_name || "Airmadidi"}</td>
                  <td className="p-4 text-center">
                    <button onClick={() => handleViewLongitudinal(p.id)} aria-label={`Lihat riwayat longitudinal ${p.name}`}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-accent-sky hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 rounded-xl font-semibold text-xs transition-colors duration-200 border border-sky-200 dark:border-sky-800/50"
                    >
                      <GitFork className="w-3.5 h-3.5" aria-hidden="true" />Riwayat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {loading ? (
          [...Array(4)].map((_, i) => <SkeletonCard key={i} />)
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center bg-card rounded-2xl border border-line">
            <FileSearch className="w-10 h-10 text-dim mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-semibold text-caption">{search ? "Tidak ada pasien yang cocok" : "Belum ada data pasien"}</p>
            <p className="text-xs text-dim mt-1 px-4">{search ? "Coba ubah kata kunci pencarian" : "Data pasien akan muncul setelah didaftarkan"}</p>
          </div>
        ) : (
          filtered.map((p) => (
            <div key={p.id} className="p-4 bg-card rounded-xl border border-line shadow-card space-y-3 hover:border-sky-300 dark:hover:border-sky-700 transition-colors duration-200">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold text-heading text-sm">{p.name}</p>
                  <p className="text-xs text-dim mt-0.5">NIK: {p.nik}</p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  p.patient_type === "MOTHER"
                    ? "bg-accent-pink text-pink-700 dark:text-pink-300 border border-pink-200 dark:border-pink-800/50"
                    : "bg-accent-blue text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
                }`}>
                  {p.patient_type === "MOTHER" ? "Ibu" : `Anak (${p.gender || "-"})`}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-caption">
                <span>Lahir: {p.birth_date}</span>
                <span>Desa: {p.village_name || "Airmadidi"}</span>
              </div>
              <button onClick={() => handleViewLongitudinal(p.id)} aria-label={`Lihat riwayat longitudinal ${p.name}`}
                className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-accent-sky hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 rounded-xl font-semibold text-xs transition-colors duration-200 border border-sky-200 dark:border-sky-800/50"
              >
                <GitFork className="w-3.5 h-3.5" aria-hidden="true" />Riwayat Longitudinal
              </button>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {selectedLongitudinal && (
        <div className="fixed inset-0 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in" style={{ backgroundColor: "var(--c-overlay)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedLongitudinal(null); }}
          role="dialog" aria-modal="true" aria-labelledby="modal-longitudinal-title"
        >
          <div ref={modalRef} tabIndex={-1} className="bg-card rounded-2xl max-w-2xl w-full p-6 shadow-prominent space-y-4 max-h-[85vh] overflow-y-auto animate-scale-in border border-line">
            <div className="flex justify-between items-start border-b border-line-light pb-4">
              <div>
                <h3 id="modal-longitudinal-title" className="text-base font-bold text-heading">Riwayat Longitudinal: {selectedLongitudinal.patient.name}</h3>
                <p className="text-xs text-caption mt-0.5">NIK: {selectedLongitudinal.patient.nik}</p>
              </div>
              <button onClick={() => setSelectedLongitudinal(null)} aria-label="Tutup modal riwayat longitudinal"
                className="p-2 text-dim hover:text-label hover:bg-muted rounded-xl transition-colors duration-200"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {selectedLongitudinal.mother && (
              <div className="p-4 bg-accent-pink border border-pink-200 dark:border-pink-800/50 rounded-xl text-xs space-y-1.5">
                <p className="font-semibold text-pink-900 dark:text-pink-200 flex items-center gap-1.5">
                  <span>Data Ibu Kandung:</span>
                  <strong>{selectedLongitudinal.mother.name}</strong> (NIK: {selectedLongitudinal.mother.nik})
                </p>
                <p className="text-pink-700 dark:text-pink-300 text-xs">
                  Terekam {selectedLongitudinal.maternal_visits.length} riwayat kunjungan kehamilan ibu.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-body">Daftar Kunjungan Pasien</h4>
              {selectedLongitudinal.child_visits.length === 0 ? (
                <div className="text-center py-8 bg-subtle rounded-xl border border-line">
                  <FileSearch className="w-8 h-8 text-dim mx-auto mb-2" aria-hidden="true" />
                  <p className="text-xs text-caption">Belum ada catatan kunjungan.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedLongitudinal.child_visits.map((cv, i) => (
                    <div key={i} className="p-3.5 bg-subtle border border-line rounded-xl text-xs flex justify-between items-center hover:bg-muted transition-colors duration-150">
                      <div>
                        <p className="font-semibold text-heading">{cv.phase} — {cv.visit_date}</p>
                        <p className="text-xs text-caption mt-0.5">
                          {cv.age_in_months !== null && `Usia: ${cv.age_in_months} bln • `}
                          {cv.child_weight_kg && `BB: ${cv.child_weight_kg} kg • `}
                          {cv.child_length_cm && `TB: ${cv.child_length_cm} cm`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataPasien;
