import React, { useState, useEffect, useMemo } from "react";
import api, { getErrorMessage } from "../../services/api";
import {
  AIRMADIDI_VILLAGES,
  OFFICIAL_POSYANDU_BY_VILLAGE,
  formatScheduleDateIndo,
} from "../../constants/posyanduData";
import {
  Plus,
  Search,
  Edit,
  Trash2,
  X,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

const STATUS_BADGE = {
  TERJADWAL:
    "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800/60",
  SELESAI:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
  DIBATALKAN:
    "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/60",
};

const ManageJadwal = () => {
  const [schedules, setSchedules] = useState([]);
  const [kaders, setKaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState("table"); // "table" | "calendar"
  const [villageFilter, setVillageFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Modal Form State (Tambah & Ubah)
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [villageName, setVillageName] = useState("Airmadidi Atas");
  const [posyanduName, setPosyanduName] = useState("Kel. Airmadidi Atas (SBY)");
  const [scheduleDate, setScheduleDate] = useState("2026-11-03");
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("11:30");
  const [routinePattern, setRoutinePattern] = useState("Minggu ke-1 (Selasa) • 08.00 WITA");
  const [serviceAgenda, setServiceAgenda] = useState(
    "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil"
  );
  const [kaderId, setKaderId] = useState("");
  const [kaderNameFallback, setKaderNameFallback] = useState("");
  const [status, setStatus] = useState("TERJADWAL");
  const [notes, setNotes] = useState("Wajib Membawa FC Kartu Keluarga & Buku KIA");

  useEffect(() => {
    fetchAllData();
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape" && showModal) {
        setShowModal(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showModal]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError("");
      const [schedRes, kaderRes] = await Promise.all([
        api.get("/schedules/"),
        api.get("/admin/kaders").catch(() => ({ data: [] })),
      ]);
      setSchedules(schedRes.data || []);
      setKaders(kaderRes.data || []);
    } catch (err) {
      setError(getErrorMessage(err, "Gagal memuat daftar jadwal Posyandu."));
    } finally {
      setLoading(false);
    }
  };

  const posyanduOptionsForVillage = useMemo(() => {
    return OFFICIAL_POSYANDU_BY_VILLAGE[villageName] || [villageName];
  }, [villageName]);

  const handleVillageChange = (nextVillage) => {
    setVillageName(nextVillage);
    const opts = OFFICIAL_POSYANDU_BY_VILLAGE[nextVillage] || [];
    if (opts.length > 0) {
      setPosyanduName(opts[0]);
    }
    const matchedKader = kaders.find(
      (k) => k.is_active && k.village_name === nextVillage
    );
    if (matchedKader) {
      setKaderId(String(matchedKader.id));
      setKaderNameFallback(matchedKader.full_name);
    } else {
      setKaderId("");
      setKaderNameFallback(`Kader Posyandu ${opts[0] || nextVillage}`);
    }
  };

  const openCreateModal = () => {
    setEditingItem(null);
    setFormError("");
    const defaultVillage = "Airmadidi Atas";
    const defaultPosyandu = OFFICIAL_POSYANDU_BY_VILLAGE[defaultVillage][0];
    setVillageName(defaultVillage);
    setPosyanduName(defaultPosyandu);
    setScheduleDate("2026-11-03");
    setStartTime("08:00");
    setEndTime("11:30");
    setRoutinePattern("Minggu ke-1 • 08.00 WITA");
    setServiceAgenda(
      "Penimbangan, Pengukuran Antropometri, Imunisasi, Vitamin A & ANC Ibu Hamil"
    );
    const matchedKader = kaders.find(
      (k) => k.is_active && k.village_name === defaultVillage
    );
    setKaderId(matchedKader ? String(matchedKader.id) : "");
    setKaderNameFallback(
      matchedKader ? matchedKader.full_name : `Kader Posyandu ${defaultPosyandu}`
    );
    setStatus("TERJADWAL");
    setNotes("Wajib Membawa FC Kartu Keluarga & Buku KIA");
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormError("");
    setVillageName(item.village_name);
    setPosyanduName(item.posyandu_name);
    setScheduleDate(item.schedule_date);
    setStartTime(item.start_time || "08:00");
    setEndTime(item.end_time || "11:30");
    setRoutinePattern(item.routine_pattern || "Bulanan • 08.00 WITA");
    setServiceAgenda(item.service_agenda || "");
    setKaderId(item.kader_id ? String(item.kader_id) : "");
    setKaderNameFallback(item.kader_name || "");
    setStatus(item.status || "TERJADWAL");
    setNotes(item.notes || "Wajib Membawa FC Kartu Keluarga & Buku KIA");
    setShowModal(true);
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);

    const payload = {
      village_name: villageName,
      posyandu_name: posyanduName.trim(),
      schedule_date: scheduleDate,
      start_time: startTime,
      end_time: endTime,
      routine_pattern: routinePattern.trim(),
      service_agenda: serviceAgenda.trim(),
      kader_id: kaderId ? parseInt(kaderId, 10) : null,
      kader_name_fallback: kaderNameFallback.trim() || `Kader ${posyanduName.trim()}`,
      status,
      notes: notes.trim() || "Wajib Membawa FC Kartu Keluarga & Buku KIA",
    };

    try {
      if (editingItem) {
        await api.put(`/schedules/${editingItem.id}`, payload);
      } else {
        await api.post("/schedules/", payload);
      }
      setShowModal(false);
      await fetchAllData();
    } catch (err) {
      setFormError(
        getErrorMessage(
          err,
          "Gagal menyimpan jadwal Posyandu. Periksa apakah terdapat bentrok jadwal."
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (item) => {
    if (
      !window.confirm(
        `Hapus jadwal Posyandu "${item.posyandu_name}" pada tanggal ${item.schedule_date}? Perubahan ini langsung diperbarui di Landing Page dan Dashboard Kader.`
      )
    ) {
      return;
    }
    try {
      await api.delete(`/schedules/${item.id}`);
      await fetchAllData();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal menghapus jadwal Posyandu."));
    }
  };

  const filteredSchedules = useMemo(() => {
    return schedules.filter((s) => {
      if (villageFilter !== "ALL" && s.village_name !== villageFilter) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const match =
          s.posyandu_name?.toLowerCase().includes(q) ||
          s.village_name?.toLowerCase().includes(q) ||
          s.service_agenda?.toLowerCase().includes(q) ||
          s.kader_name?.toLowerCase().includes(q) ||
          s.schedule_date?.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [schedules, villageFilter, statusFilter, search]);

  // Kalender Grid November 2026 (Minggu=1 Nov 2026, 30 hari, kolom Senin s/d Minggu seperti poster)
  const calendarDays = useMemo(() => {
    // 1 Nov 2026 adalah hari Minggu (kolom ke-7 pada kalender Senin-Minggu)
    const leadingEmpty = 6; // Senin (26 Okt) s/d Sabtu (31 Okt) kosong
    const cells = [];
    for (let i = 0; i < leadingEmpty; i += 1) {
      cells.push({ day: null, iso: null, items: [] });
    }
    for (let day = 1; day <= 30; day += 1) {
      const dd = String(day).padStart(2, "0");
      const iso = `2026-11-${dd}`;
      const items = filteredSchedules.filter((s) => s.schedule_date === iso);
      cells.push({ day, iso, items });
    }
    return cells;
  }, [filteredSchedules]);

  const INPUT_CLASS =
    "w-full !min-h-0 h-9 px-3 bg-subtle border border-line rounded-sm !text-[13px] text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:bg-card transition-all";
  const SELECT_CLASS =
    "w-full !min-h-0 h-9 pl-3 pr-10 bg-subtle border border-line rounded-sm !text-[13px] text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/30 focus:border-sky-500 focus:bg-card transition-all cursor-pointer";

  const activeCount = schedules.filter((s) => s.status === "TERJADWAL").length;
  const DEFAULT_NOTE = "Wajib Membawa FC Kartu Keluarga & Buku KIA";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header Halaman */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-line">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            Manajemen Jadwal Posyandu
          </h1>
          <p className="text-sm text-caption mt-1 max-w-2xl leading-relaxed">
            Kelola jadwal pelayanan Posyandu di seluruh Kelurahan dan Desa wilayah kerja Kecamatan Airmadidi. Perubahan langsung disinkronkan ke halaman publik dan Dashboard Kader.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={fetchAllData}
            disabled={loading}
            className="!min-h-0 h-9 px-3 rounded-lg border border-line bg-card hover:bg-muted text-xs font-medium text-heading inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-caption ${loading ? "animate-spin" : ""}`} />
            <span>Segarkan</span>
          </button>

          <button
            type="button"
            onClick={openCreateModal}
            className="btn-interactive !min-h-0 h-9 px-3.5 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Jadwal</span>
          </button>
        </div>
      </div>

      {/* Ringkasan Operasional */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-card p-4 rounded-xl border border-line flex flex-col justify-between gap-1.5">
          <p className="text-xs font-semibold text-caption uppercase tracking-wider">
            Total Titik Terdaftar
          </p>
          <p className="text-2xl font-bold text-heading tabular-nums">
            {schedules.length} Jadwal
          </p>
          <p className="text-xs text-caption">
            Seluruh Kelurahan & Desa binaan Puskesmas Airmadidi
          </p>
        </div>

        <div className="bg-card p-4 rounded-xl border border-line flex flex-col justify-between gap-1.5">
          <p className="text-xs font-semibold text-caption uppercase tracking-wider">
            Jadwal Aktif (Terjadwal)
          </p>
          <p className="text-2xl font-bold text-sky-600 dark:text-sky-400 tabular-nums">
            {activeCount} Titik
          </p>
          <p className="text-xs text-caption">
            Tampil otomatis di halaman publik & Dashboard Kader
          </p>
        </div>

        <div className="bg-card p-4 rounded-xl border border-line flex flex-col justify-between gap-1.5">
          <p className="text-xs font-semibold text-caption uppercase tracking-wider">
            Persyaratan Wajib Warga
          </p>
          <p className="text-base sm:text-lg font-bold text-heading leading-snug">
            FC Kartu Keluarga & Buku KIA
          </p>
          <p className="text-xs text-caption">
            Ketentuan standar saat pendaftaran di Meja 1 Posyandu
          </p>
        </div>
      </div>

      {/* Baris Filter, Pencarian & Mode Tampilan */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Tabel vs Kalender */}
          <div className="inline-flex p-1 bg-subtle border border-line rounded-lg gap-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={`!min-h-0 h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                viewMode === "table"
                  ? "bg-card text-heading shadow-xs border border-line"
                  : "text-caption hover:text-heading border border-transparent"
              }`}
            >
              Daftar Tabel ({filteredSchedules.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode("calendar")}
              className={`!min-h-0 h-8 px-3 rounded-md text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                viewMode === "calendar"
                  ? "bg-card text-heading shadow-xs border border-line"
                  : "text-caption hover:text-heading border border-transparent"
              }`}
            >
              Kalender Nov 2026
            </button>
          </div>

          {/* Filter Desa/Kelurahan */}
          <select
            value={villageFilter}
            onChange={(e) => setVillageFilter(e.target.value)}
            aria-label="Filter berdasarkan Kelurahan atau Desa"
            className="!min-h-0 h-9 pl-3 pr-10 bg-card border border-line rounded-lg text-xs font-medium text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer"
          >
            <option value="ALL">Semua Wilayah Kerja</option>
            {AIRMADIDI_VILLAGES.map((v) => (
              <option key={v} value={v}>
                {v} ({OFFICIAL_POSYANDU_BY_VILLAGE[v]?.length || 1} Titik)
              </option>
            ))}
          </select>

          {/* Filter Status */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter berdasarkan status jadwal"
            className="!min-h-0 h-9 pl-3 pr-10 bg-card border border-line rounded-sm !text-[13px] font-medium text-heading focus:outline-none focus:ring-2 focus:ring-sky-500/30 cursor-pointer"
          >
            <option value="ALL">Semua Status</option>
            <option value="TERJADWAL">Terjadwal</option>
            <option value="SELESAI">Selesai</option>
            <option value="DIBATALKAN">Dibatalkan</option>
          </select>
        </div>

        <div className="relative w-full xl:w-72">
          <input
            type="text"
            placeholder="Cari posyandu, desa, kader..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full !min-h-0 h-9 pl-8 pr-3 bg-card border border-line rounded-sm !text-[13px] text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/30"
          />
          <Search className="w-3.5 h-3.5 text-dim absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* State Error */}
      {error && (
        <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-md flex items-center justify-between gap-3 text-[13px] text-rose-700 dark:text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={fetchAllData}
            className="!min-h-0 h-7 px-2.5 rounded-sm font-semibold underline cursor-pointer"
          >
            Muat Ulang
          </button>
        </div>
      )}

      {/* Tampilan 1: Tabel Daftar Jadwal */}
      {viewMode === "table" ? (
        <div className="bg-card rounded-md border border-line overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-subtle border-b border-line text-[11px] font-semibold uppercase tracking-wider text-caption">
                <tr>
                  <th className="py-3 px-4">Tanggal & Waktu</th>
                  <th className="py-3 px-4">Titik Posyandu</th>
                  <th className="py-3 px-4">Kelurahan / Desa</th>
                  <th className="py-3 px-4">Penanggung Jawab</th>
                  <th className="py-3 px-4">Agenda Layanan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line text-[13px]">
                {loading ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-caption text-xs">
                      Memuat daftar jadwal Posyandu...
                    </td>
                  </tr>
                ) : filteredSchedules.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="p-8 text-center space-y-1.5">
                      <p className="font-semibold text-heading text-sm">
                        Tidak ada jadwal Posyandu yang sesuai dengan filter.
                      </p>
                      <p className="text-caption text-xs">
                        Ubah pilihan filter wilayah atau tambahkan jadwal kegiatan baru.
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredSchedules.map((item) => {
                    const hasCustomNote =
                      item.notes &&
                      item.notes.trim() !== "" &&
                      item.notes.trim().toLowerCase() !== DEFAULT_NOTE.toLowerCase();

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-subtle/60 transition-colors"
                      >
                        <td className="py-3 px-4 whitespace-nowrap align-top">
                          <p className="font-semibold text-heading">
                            {formatScheduleDateIndo(item.schedule_date)}
                          </p>
                          <p className="text-xs text-caption tabular-nums mt-0.5">
                            {item.start_time}–{item.end_time} WITA
                          </p>
                        </td>

                        <td className="py-3 px-4 align-top">
                          <p className="font-semibold text-heading">
                            {item.posyandu_name}
                          </p>
                          {item.routine_pattern && (
                            <p className="text-xs text-caption mt-0.5">
                              {item.routine_pattern.replace(/\s*•\s*\d{2}\.\d{2}\s*WITA/i, "")}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4 whitespace-nowrap align-top text-body">
                          {item.village_name}
                        </td>

                        <td className="py-3 px-4 align-top text-body">
                          {item.kader_name}
                        </td>

                        <td className="py-3 px-4 max-w-xs align-top">
                          <p className="text-xs text-caption leading-relaxed line-clamp-2">
                            {item.service_agenda}
                          </p>
                          {hasCustomNote && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium mt-1">
                              Catatan khusus: {item.notes}
                            </p>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center align-top">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-[6px] text-[11px] font-semibold border ${
                              STATUS_BADGE[item.status] || STATUS_BADGE.TERJADWAL
                            }`}
                          >
                            {item.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-center whitespace-nowrap align-top">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="!min-h-0 h-8 w-8 inline-flex items-center justify-center rounded-sm border border-line bg-card hover:bg-muted text-heading transition-colors cursor-pointer"
                              title="Ubah Jadwal"
                              aria-label={`Ubah jadwal ${item.posyandu_name}`}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSchedule(item)}
                              className="!min-h-0 h-8 w-8 inline-flex items-center justify-center rounded-sm border border-rose-200 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 transition-colors cursor-pointer"
                              title="Hapus Jadwal"
                              aria-label={`Hapus jadwal ${item.posyandu_name}`}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Tampilan 2: Kalender Bulanan November 2026 */
        <div className="bg-card rounded-md border border-line p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 pb-3 border-b border-line">
            <div>
              <h2 className="text-base font-bold text-heading">
                Kalender Jadwal Posyandu • November 2026
              </h2>
              <p className="text-xs text-caption mt-0.5">
                Klik pada item Posyandu di dalam tanggal untuk mengubah jam, tanggal, atau penanggung jawab.
              </p>
            </div>
            <span className="text-xs text-caption">
              Catatan warga: Wajib Membawa FC Kartu Keluarga & Buku KIA
            </span>
          </div>

          <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-semibold text-caption uppercase tracking-wider">
            <div className="py-1.5 bg-subtle rounded-sm border border-line">Sen</div>
            <div className="py-1.5 bg-subtle rounded-sm border border-line">Sel</div>
            <div className="py-1.5 bg-subtle rounded-sm border border-line">Rab</div>
            <div className="py-1.5 bg-subtle rounded-sm border border-line">Kam</div>
            <div className="py-1.5 bg-subtle rounded-sm border border-line">Jum</div>
            <div className="py-1.5 bg-subtle rounded-sm border border-line">Sab</div>
            <div className="py-1.5 bg-subtle rounded-sm border border-line">Min</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
            {calendarDays.map((cell, idx) =>
              cell.day === null ? (
                <div
                  key={`empty-${idx}`}
                  className="hidden sm:block min-h-[96px] rounded-sm bg-subtle/40 border border-line-light"
                />
              ) : (
                <div
                  key={cell.iso}
                  className={`min-h-[96px] p-2 rounded-sm border flex flex-col justify-between transition-colors ${
                    cell.items.length > 0
                      ? "bg-sky-50/40 dark:bg-sky-950/20 border-sky-200 dark:border-sky-800/60"
                      : "bg-card border-line"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-heading tabular-nums">
                      {cell.day}
                    </span>
                  </div>

                  <div className="space-y-1 mt-1.5">
                    {cell.items.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => openEditModal(ev)}
                        className="w-full !min-h-0 h-auto text-left p-2 rounded-[6px] bg-card border border-line hover:border-sky-400 transition-colors cursor-pointer space-y-0.5"
                      >
                        <p className="text-xs font-semibold text-heading leading-snug">
                          {ev.posyandu_name}
                        </p>
                        <p className="text-[11px] text-caption tabular-nums">
                          {ev.start_time}–{ev.end_time} WITA
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {/* Modal Tambah / Ubah Jadwal Posyandu */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 dark:bg-black/80 flex items-center justify-center p-4 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="schedule-modal-title"
        >
          <div className="bg-card border border-line rounded-md max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-prominent space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 id="schedule-modal-title" className="text-base font-bold text-heading">
                  {editingItem ? "Ubah Jadwal Posyandu" : "Tambah Jadwal Posyandu Baru"}
                </h3>
                <p className="text-xs text-caption mt-0.5">
                  Sistem otomatis memeriksa bentrok tanggal, jam, lokasi, dan penugasan kader.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Tutup modal jadwal"
                className="!min-h-0 h-8 w-8 inline-flex items-center justify-center text-dim hover:text-heading hover:bg-muted rounded-sm transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-sm bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveSchedule} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-label mb-1">
                    Kelurahan / Desa (9 Wilayah)
                  </label>
                  <select
                    value={villageName}
                    onChange={(e) => handleVillageChange(e.target.value)}
                    className={SELECT_CLASS}
                    required
                  >
                    {AIRMADIDI_VILLAGES.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-label mb-1">
                    Titik Posyandu (14 Titik Resmi)
                  </label>
                  <input
                    type="text"
                    list="official-posyandu-list"
                    required
                    value={posyanduName}
                    onChange={(e) => setPosyanduName(e.target.value)}
                    placeholder="Pilih atau ketik nama titik Posyandu..."
                    className={INPUT_CLASS}
                  />
                  <datalist id="official-posyandu-list">
                    {posyanduOptionsForVillage.map((pName) => (
                      <option key={pName} value={pName} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-label mb-1">
                    Tanggal Pelaksanaan
                  </label>
                  <input
                    type="date"
                    required
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-label mb-1">
                    Jam Mulai (WITA)
                  </label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-label mb-1">
                    Jam Selesai (WITA)
                  </label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-label mb-1">
                    Kader Penanggung Jawab (Akun)
                  </label>
                  <select
                    value={kaderId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setKaderId(val);
                      const found = kaders.find((k) => String(k.id) === val);
                      if (found) setKaderNameFallback(found.full_name);
                    }}
                    className={SELECT_CLASS}
                  >
                    <option value="">-- Gunakan Nama Tim Kader Wilayah --</option>
                    {kaders
                      .filter((k) => k.is_active)
                      .map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.full_name} ({k.village_name || "Airmadidi"})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-label mb-1">
                    Label Penanggung Jawab Ditampilkan
                  </label>
                  <input
                    type="text"
                    required
                    value={kaderNameFallback}
                    onChange={(e) => setKaderNameFallback(e.target.value)}
                    placeholder="Contoh: Kader Posyandu Kel. Sukur"
                    className={INPUT_CLASS}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-label mb-1">
                    Pola Rutin Bulanan
                  </label>
                  <input
                    type="text"
                    value={routinePattern}
                    onChange={(e) => setRoutinePattern(e.target.value)}
                    placeholder="Contoh: Minggu ke-1 (Senin) • 08.00 WITA"
                    className={INPUT_CLASS}
                  />
                </div>

                <div>
                  <label className="block font-semibold text-label mb-1">
                    Status Pelaksanaan
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className={SELECT_CLASS}
                  >
                    <option value="TERJADWAL">TERJADWAL (Aktif)</option>
                    <option value="SELESAI">SELESAI</option>
                    <option value="DIBATALKAN">DIBATALKAN</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-label mb-1">
                  Agenda Pelayanan Kesehatan
                </label>
                <input
                  type="text"
                  required
                  value={serviceAgenda}
                  onChange={(e) => setServiceAgenda(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block font-semibold text-label mb-1">
                  Catatan Persyaratan Masyarakat (Notes)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Wajib Membawa FC Kartu Keluarga & Buku KIA"
                  className={INPUT_CLASS}
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="!min-h-0 h-9 px-4 border border-line rounded-sm text-[13px] text-caption hover:bg-muted hover:text-heading font-medium transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="!min-h-0 h-9 px-4 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-sm text-[13px] font-semibold transition-colors cursor-pointer"
                >
                  {submitting
                    ? "Menyimpan..."
                    : editingItem
                    ? "Simpan Perubahan"
                    : "Simpan Jadwal Baru"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageJadwal;

