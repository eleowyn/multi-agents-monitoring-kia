import React, { useState, useEffect } from "react";
import api, { getErrorMessage } from "../../services/api";
import { UserCheck, Plus, Search, Shield, X } from "lucide-react";

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

  const INPUT_CLASS =
    "w-full px-3.5 py-2.5 bg-subtle border border-line rounded-xl text-xs text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all duration-200";

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-5 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-line-light">
        <div>
          <h2 className="text-xl font-bold text-heading">
            Kelola Kader Posyandu
          </h2>
          <p className="text-xs text-caption mt-0.5">
            Manajemen akun petugas kader aktif di wilayah Puskesmas Kecamatan
            Airmadidi
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl text-xs font-bold shadow-sm hover:shadow-md transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Tambah Kader Baru
        </button>
      </div>

      <div className="bg-card rounded-2xl border border-line shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-muted text-label border-b border-line">
              <tr>
                <th className="p-3">Nama Kader</th>
                <th className="p-3">Username & Email</th>
                <th className="p-3">Posyandu</th>
                <th className="p-3">Desa / Kelurahan</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-light">
              {kaders.map((k) => (
                <tr key={k.id} className="hover:bg-accent-sky transition-colors duration-150">
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
                  <td className="p-3 text-center">
                    <span className="px-2.5 py-0.5 bg-accent-emerald text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 rounded-full text-[10px] font-bold">
                      Aktif
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in"
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
                  className="px-4 py-2 border border-line rounded-xl text-caption hover:bg-muted hover:text-heading transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white rounded-xl font-bold transition-colors"
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
