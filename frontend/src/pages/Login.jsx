import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Activity,
  User,
  Lock,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Heart,
  MapPin,
  ShieldCheck,
  Sun,
  Moon,
} from "lucide-react";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(username, password);
      if (user.role === "KADER") {
        navigate("/kader/dashboard");
      } else if (user.role === "DOKTER") {
        navigate("/doctor/monitoring");
      } else {
        navigate("/admin/dashboard");
      }
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          "Gagal login. Periksa username dan password Anda."
      );
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen flex bg-page">
      {/* LEFT: Branding Panel (Clean & Minimalist, No Deadspace) */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-[42%] bg-gradient-to-br from-sky-600 via-sky-700 to-indigo-900 p-10 xl:p-14 flex-col justify-between relative overflow-hidden">
        {/* Top: Official Logos & Back link */}
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 shrink-0">
              <img
                src="/logo-minahasa-utara.png"
                alt="Logo Minahasa Utara"
                className="w-9 h-9 object-contain"
              />
              <img
                src="/logo-puskesmas-airmadidi.png"
                alt="Logo Puskesmas Airmadidi"
                className="w-9 h-9 object-contain"
              />
            </div>
            <div>
              <span className="font-bold text-white text-base tracking-tight block">
                Multi-Agent KIA
              </span>
              <p className="text-sky-200 text-xs">UPTD Puskesmas Airmadidi</p>
            </div>
          </div>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs text-sky-100 hover:text-white bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl transition-colors duration-150 backdrop-blur-sm"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Beranda</span>
          </Link>
        </div>

        {/* Subtle ambient lighting decorations (soft, calm, no artificial grid dots) */}
        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-sky-400/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none" />

        {/* Middle: Clean Headline & Description + 3 Poin Fokus KIA */}
        <div className="relative z-10 w-full max-w-lg my-auto py-8 space-y-6">
          <div className="space-y-3">
            <h1 className="text-3xl xl:text-4xl font-bold text-white tracking-tight leading-[1.25]">
              Platform Terpadu Pengawasan 1.000 Hari Pertama Kehidupan
            </h1>
            <p className="text-sky-100/90 text-sm xl:text-base leading-relaxed">
              Membantu kader posyandu, bidan, dan dokter Puskesmas Airmadidi dalam deteksi dini, validasi status gizi, serta intervensi cepat risiko stunting dan pemantauan kesehatan ibu-anak.
            </p>
          </div>

          {/* 3 Poin Fokus KIA (Rapi, Terstruktur, Tanpa Deadspace) */}
          <div className="pt-2 space-y-3.5 border-t border-white/10">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5 border border-white/15">
                <Heart className="w-3.5 h-3.5 text-rose-300" aria-hidden="true" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-snug">
                  Pemantauan 1.000 HPK
                </p>
                <p className="text-sky-200/80 text-xs mt-0.5 leading-relaxed">
                  Pengawasan berkala sejak masa kehamilan hingga anak genap 2 tahun sesuai standar Buku KIA.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5 border border-white/15">
                <MapPin className="w-3.5 h-3.5 text-sky-300" aria-hidden="true" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-snug">
                  Jejaring 9 Wilayah Posyandu
                </p>
                <p className="text-sky-200/80 text-xs mt-0.5 leading-relaxed">
                  Integrasi data posyandu binaan di seluruh desa dan kelurahan se-Kecamatan Airmadidi.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center shrink-0 mt-0.5 border border-white/15">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" aria-hidden="true" />
              </div>
              <div>
                <p className="text-white text-sm font-semibold leading-snug">
                  Deteksi Dini & Pencegahan Stunting
                </p>
                <p className="text-sky-200/80 text-xs mt-0.5 leading-relaxed">
                  Pencatatan antropometri akurat untuk respon intervensi gizi dan rujukan medis tepat waktu.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom subtle spacer to preserve balanced flex-col layout */}
        <div className="relative z-10" />
      </div>

      {/* RIGHT: Login Form */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-12 relative overflow-y-auto">
        {/* Top Bar Right: Theme Toggle & Mobile Back */}
        <div className="flex items-center justify-between w-full">
          <Link
            to="/"
            className="lg:hidden flex items-center gap-1.5 text-xs text-dim hover:text-body transition-colors duration-150"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Beranda</span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={toggleTheme}
              aria-label={
                isDark ? "Ganti ke mode terang" : "Ganti ke mode gelap"
              }
              className="btn-interactive p-2 text-dim hover:text-heading hover:bg-muted rounded-xl transition-all duration-200 cursor-pointer"
            >
              {mounted && isDark ? (
                <Sun className="w-5 h-5 text-amber-500" aria-hidden="true" />
              ) : (
                <Moon className="w-5 h-5 text-sky-600" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Form Container */}
        <div className="w-full max-w-md mx-auto my-auto py-8">
          {/* Mobile branding header */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="flex items-center gap-2 shrink-0">
              <img
                src="/logo-minahasa-utara.png"
                alt="Logo Minahasa Utara"
                className="w-8 h-8 object-contain"
              />
              <img
                src="/logo-puskesmas-airmadidi.png"
                alt="Logo Puskesmas Airmadidi"
                className="w-8 h-8 object-contain"
              />
            </div>
            <div>
              <h1 className="font-bold text-heading text-base tracking-tight">
                Multi-Agent KIA
              </h1>
              <p className="text-xs text-caption font-medium">
                UPTD Puskesmas Airmadidi
              </p>
            </div>
          </div>

          {/* Form Card */}
          <div className="card-interactive bg-card rounded-2xl shadow-elevated border border-line overflow-hidden">
            <div className="px-6 pt-8 pb-2 sm:px-8">
              <h2 className="text-xl font-bold text-heading">Masuk ke Sistem</h2>
              <p className="text-sm text-caption mt-1">
                Khusus Kader Posyandu, Dokter, & Admin Puskesmas Kecamatan Airmadidi
              </p>
            </div>

            <div className="px-6 pb-8 sm:px-8 pt-4">
              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="mb-5 p-3.5 bg-accent-red border border-red-300 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5 animate-slide-up"
                >
                  <AlertCircle
                    className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-500 dark:text-red-400"
                    aria-hidden="true"
                  />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-sm font-semibold text-body mb-1.5"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <User
                      className="w-[18px] h-[18px] text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="login-username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Masukkan username"
                      aria-label="Username"
                      autoComplete="username"
                      className="w-full pl-11 pr-4 py-3 bg-subtle border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-sm font-semibold text-body mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="w-[18px] h-[18px] text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      aria-hidden="true"
                    />
                    <input
                      id="login-password"
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password"
                      aria-label="Password"
                      autoComplete="current-password"
                      className="w-full pl-11 pr-4 py-3 bg-subtle border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all duration-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  aria-label={loading ? "Sedang memproses login" : "Masuk ke sistem"}
                  className="btn-interactive w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md hover:shadow-lg disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-sky-600 transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer"
                >
                  {loading ? (
                    <>
                      <span className="spinner border-white/30 border-t-white" />
                      <span>Memproses Masuk...</span>
                    </>
                  ) : (
                    <>
                      <span>Masuk ke Sistem</span>
                      <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
