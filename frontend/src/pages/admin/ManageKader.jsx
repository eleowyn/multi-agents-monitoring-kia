import React, { useState, useEffect } from "react";
import api, { getErrorMessage } from "../../services/api";
import { Plus, Search, Shield, X, Trash2 } from "lucide-react";

const ManageKader = () => {
  const [kaders, setKaders] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [posyanduName, setPosyanduName] = useState("");
  const [villageName, setVillageName] = useState("Airmadidi Atas");
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE, INACTIVE
  const [selectedIds, setSelectedIds] = useState([]);
  const [deletingBulk, setDeletingBulk] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchKaders();
  }, []);

  const fetchKaders = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/kaders");
      setKaders(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddKader = async (e) => {
    e.preventDefault();
    try {
      await api.post("/admin/kaders", {
        username,
        email,
        password,
        full_name: fullName,
        posyandu_name: posyanduName,
        village_name: villageName,
      });
      alert("Kader baru berhasil didaftarkan!");
      setShowAddModal(false);
      setUsername("");
      setEmail("");
      setPassword("");
      setFullName("");
      setPosyanduName("");
      fetchKaders();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal menambahkan kader."));
    }
  };

  const handleToggleStatus = async (id, currentStatus, name) => {
    const nextAction = currentStatus ? "menonaktifkan" : "mengaktifkan kembali";
    if (!window.confirm(`Apakah Anda yakin ingin ${nextAction} akun kader ${name}?`)) {
      return;
    }
    try {
      const res = await api.put(`/admin/kaders/${id}/toggle-status`);
      setKaders((prev) =>
        prev.map((k) => (k.id === id ? { ...k, is_active: res.data.is_active } : k))
      );
    } catch (err) {
      alert(getErrorMessage(err, "Gagal mengubah status aktif kader."));
    }
  };

  const handleBulkStatus = async (isActive) => {
    if (selectedIds.length === 0) return;
    const actionText = isActive ? "mengaktifkan kembali" : "menonaktifkan";
    if (
      !window.confirm(
        `Apakah Anda yakin ingin ${actionText} ${selectedIds.length} akun kader terpilih?`
      )
    ) {
      return;
    }
    try {
      setUpdatingStatus(true);
      const res = await api.post("/admin/kaders/bulk-status", {
        ids: selectedIds,
        is_active: isActive,
      });
      alert(res.data.message || `Status ${selectedIds.length} kader berhasil diperbarui.`);
      setSelectedIds([]);
      fetchKaders();
    } catch (err) {
      alert(getErrorMessage(err, `Gagal ${actionText} kader terpilih.`));
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filtered = kaders.filter((k) => {
    const matchQuery =
      k.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      k.username?.toLowerCase().includes(search.toLowerCase()) ||
      k.village_name?.toLowerCase().includes(search.toLowerCase()) ||
      k.posyandu_name?.toLowerCase().includes(search.toLowerCase());
    if (!matchQuery) return false;
    if (statusFilter === "ACTIVE") return k.is_active;
    if (statusFilter === "INACTIVE") return !k.is_active;
    return true;
  });

  const handleToggleAll = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.map((k) => k.id));
    }
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleDeleteSingle = async (id, name) => {
    if (!window.confirm(`Apakah Anda yakin ingin menghapus akun kader ${name}?`)) {
      return;
    }
    try {
      const res = await api.delete(`/admin/kaders/${id}`);
      alert(res.data.message || `Kader ${name} berhasil dihapus.`);
      setSelectedIds((prev) => prev.filter((item) => item !== id));
      fetchKaders();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal menghapus kader."));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Apakah Anda yakin ingin menghapus ${selectedIds.length} akun kader terpilih? Kader yang memiliki data kunjungan pasien akan dilindungi demi integritas data.`
      )
    ) {
      return;
    }
    try {
      setDeletingBulk(true);
      const res = await api.post("/admin/kaders/bulk-delete", { ids: selectedIds });
      alert(res.data.message || `${res.data.deleted_count} kader berhasil dihapus.`);
      setSelectedIds([]);
      fetchKaders();
    } catch (err) {
      alert(getErrorMessage(err, "Gagal menghapus kader terpilih."));
    } finally {
      setDeletingBulk(false);
    }
  };

  const INPUT_CLASS =
    "w-full px-3.5 py-2.5 bg-subtle border border-line rounded-xl text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all duration-200";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line-light">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-heading tracking-tight">
            Kelola Kader Posyandu
          </h1>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="btn-interactive flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Tambah Kader Baru
        </button>
      </div>

      {/* Filter status & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 p-1 bg-subtle border border-line rounded-xl self-start">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "ALL"
                ? "bg-card text-heading shadow-sm border border-line-light"
                : "text-dim hover:text-heading"
            }`}
          >
            Semua ({kaders.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "ACTIVE"
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm border border-emerald-200 dark:border-emerald-800/50"
                : "text-dim hover:text-heading"
            }`}
          >
            Aktif ({kaders.filter((k) => k.is_active).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("INACTIVE")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              statusFilter === "INACTIVE"
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 shadow-sm border border-amber-200 dark:border-amber-800/50"
                : "text-dim hover:text-heading"
            }`}
          >
            Nonaktif ({kaders.filter((k) => !k.is_active).length})
          </button>
        </div>

        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Cari nama, username, posyandu, atau desa kader..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-card border border-line rounded-xl text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 transition-all duration-200"
          />
          <Search className="w-4 h-4 text-dim absolute left-3 top-2.5" />
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-2xl animate-fade-in shadow-sm">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-sky-800 dark:text-sky-200">
            <span className="px-2.5 py-1 bg-sky-600 text-white rounded-lg text-xs font-bold shadow-sm">
              {selectedIds.length}
            </span>
            <span>Kader terpilih untuk tindakan massal</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl text-xs font-medium text-caption hover:bg-muted hover:text-heading transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus(false)}
              disabled={updatingStatus}
              className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              title="Nonaktifkan akun kader terpilih"
            >
              Nonaktifkan
            </button>
            <button
              type="button"
              onClick={() => handleBulkStatus(true)}
              disabled={updatingStatus}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              title="Aktifkan kembali akun kader terpilih"
            >
              Aktifkan
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={deletingBulk}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
              title="Hapus akun kader terpilih"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {deletingBulk ? "Menghapus..." : "Hapus Terpilih"}
            </button>
          </div>
        </div>
      )}

      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-label border-b border-line">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={handleToggleAll}
                    className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-line cursor-pointer"
                    aria-label="Pilih semua kader"
                  />
                </th>
                <th className="p-3">Nama Kader</th>
                <th className="p-3">Username & Email</th>
                <th className="p-3">Posyandu</th>
                <th className="p-3">Desa / Kelurahan</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {loading ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-dim">
                    Memuat data kader...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-dim italic">
                    Tidak ada data kader ditemukan.
                  </td>
                </tr>
              ) : (
                filtered.map((k) => (
                  <tr
                    key={k.id}
                    className={`table-row-interactive hover:bg-accent-sky transition-colors duration-150 ${
                      selectedIds.includes(k.id) ? "bg-sky-50/60 dark:bg-sky-950/20" : ""
                    } ${!k.is_active ? "bg-slate-50/30 dark:bg-slate-900/10" : ""}`}
                  >
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(k.id)}
                        onChange={() => handleToggleRow(k.id)}
                        className="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-line cursor-pointer"
                        aria-label={`Pilih kader ${k.full_name}`}
                      />
                    </td>
                    <td className="p-3 font-bold text-heading">
                      {k.full_name}
                    </td>
                    <td className="p-3 text-body">
                      <p className="font-semibold text-heading">{k.username}</p>
                      <p className="text-[11px] text-caption">{k.email}</p>
                    </td>
                    <td className="p-3 text-body">
                      {k.posyandu_name || "-"}
                    </td>
                    <td className="p-3 text-body">
                      {k.village_name || "-"}
                    </td>
                    <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <label className="inline-flex items-center cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={k.is_active}
                          onChange={() => handleToggleStatus(k.id, k.is_active, k.full_name)}
                          className="sr-only peer"
                        />
                        <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-sky-600"></div>
                        <span className={`ms-3 text-xs font-semibold ${k.is_active ? "text-sky-700 dark:text-sky-300" : "text-slate-400"}`}>
                          {k.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </label>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteSingle(k.id, k.full_name)}
                        className="btn-interactive p-1.5 text-rose-600 dark:text-rose-400 hover:bg-accent-red rounded-lg transition-colors duration-150 cursor-pointer"
                        title="Hapus Akun Kader"
                        aria-label={`Hapus kader ${k.full_name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddModal(false);
          }}
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-card border border-line rounded-2xl max-w-md w-full p-6 shadow-prominent space-y-4 animate-scale-in">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-heading">
                Tambah Akun Kader Posyandu
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-xl transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddKader} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-label mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Nama kader..."
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block font-semibold text-label mb-1">Username</label>
                <input
                  type="text"
                  required
                  placeholder="Username login..."
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block font-semibold text-label mb-1">Email</label>
                <input
                  type="email"
                  required
                  placeholder="kader@posyandu.go.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div>
                <label className="block font-semibold text-label mb-1">Password</label>
                <input
                  type="password"
                  required
                  placeholder="Password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-label mb-1">
                    Nama Posyandu
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Posyandu Mawar"
                    value={posyanduName}
                    onChange={(e) => setPosyanduName(e.target.value)}
                    className={INPUT_CLASS}
                  />
                </div>
                <div>
                  <label className="block font-semibold text-label mb-1">Desa</label>
                  <select
                    value={villageName}
                    onChange={(e) => setVillageName(e.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="Airmadidi Atas">Airmadidi Atas</option>
                    <option value="Airmadidi Bawah">Airmadidi Bawah</option>
                    <option value="Sarongsong Satu">Sarongsong Satu</option>
                    <option value="Sarongsong Dua">Sarongsong Dua</option>
                    <option value="Sukur">Sukur</option>
                    <option value="Rap-Rap">Rap-Rap</option>
                    <option value="Sawangan">Sawangan</option>
                    <option value="Sampiri">Sampiri</option>
                    <option value="Tanggari">Tanggari</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-interactive px-4 py-2 border border-line rounded-xl text-caption hover:bg-muted hover:text-heading transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn-interactive px-4 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl font-bold transition-colors cursor-pointer"
                >
                  Daftarkan Kader
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageKader;
