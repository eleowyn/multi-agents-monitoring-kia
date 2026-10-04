import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Activity,
  User,
  Lock,
  ArrowRight,
  AlertCircle,
  Heart,
  Shield,
  BarChart3,
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

  useEffect(() => { setMounted(true); }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const user = await login(username, password);
      navigate(user.role === "KADER" ? "/kader/input-kunjungan" : "/admin/dashboard");
    } catch (err) {
      setError(err.response?.data?.detail || "Gagal login. Periksa username dan password Anda.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (userType) => {
    if (userType === "kader") { setUsername("kader1"); setPassword("kader123"); }
    else { setUsername("admin"); setPassword("admin123"); }
  };

  const features = [
    { icon: Heart, title: "Monitoring 1.000 HPK", desc: "Deteksi dini risiko stunting, BBLR, dan KEK berbasis data antropometri" },
    { icon: BarChart3, title: "Analisis Multi-Agent AI", desc: "3 agen cerdas (Deterministic + RAG + Verifier) untuk rekomendasi akurat" },
    { icon: Shield, title: "Sitasi Terverifikasi", desc: "Rekomendasi di-grounding terhadap Buku KIA & PNPK Stunting 2022" },
  ];

  return (
    <div className="min-h-screen flex bg-page">
      {/* ——— LEFT: Branding Panel (desktop only) ——— */}
      <div
        className="hidden lg:flex lg:w-[48%] xl:w-[45%] relative flex-col justify-between overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 40%, #075985 100%)" }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.3) 0%, transparent 70%)", transform: "translate(30%, -30%)" }} aria-hidden="true" />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10" style={{ background: "radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%)", transform: "translate(-30%, 30%)" }} aria-hidden="true" />

        <div className="relative z-10 p-10 xl:p-14 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Multi-Agent AI KIA</h1>
              <p className="text-sky-200 text-xs font-medium">Posyandu Kecamatan Airmadidi</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <h2 className="text-3xl xl:text-4xl font-bold text-white leading-tight mb-4">
              Sistem Cerdas<br />
              <span className="text-sky-200">Kesehatan Ibu & Anak</span>
            </h2>
            <p className="text-sky-100 text-sm leading-relaxed max-w-md mb-10">
              Platform monitoring kesehatan berbasis AI untuk deteksi dini risiko pada 1.000 Hari Pertama Kehidupan di wilayah Posyandu Kecamatan Airmadidi.
            </p>
            <div className="space-y-5">
              {features.map((feat, i) => {
                const Icon = feat.icon;
                return (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-sky-200" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">{feat.title}</p>
                      <p className="text-sky-200/80 text-xs leading-relaxed mt-0.5">{feat.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <p className="text-sky-300/60 text-xs mt-8">© 2024 — Skripsi Sistem Multi-Agent AI KIA</p>
        </div>
      </div>

      {/* ——— RIGHT: Login Form ——— */}
      <div className="flex-1 flex items-center justify-center p-5 sm:p-8 relative">
        {/* Theme toggle (floating) */}
        <button
          onClick={toggleTheme}
          aria-label={isDark ? "Beralih ke mode terang" : "Beralih ke mode gelap"}
          className="absolute top-5 right-5 p-2.5 text-caption hover:text-heading hover:bg-muted rounded-xl transition-colors duration-200"
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <div className={`w-full max-w-md transition-all duration-500 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-sky-600 rounded-xl flex items-center justify-center shadow-md">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-heading leading-tight">Multi-Agent AI KIA</h1>
              <p className="text-xs text-caption font-medium">Posyandu Kec. Airmadidi</p>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-card rounded-2xl shadow-elevated border border-line overflow-hidden">
            <div className="px-6 pt-8 pb-2 sm:px-8">
              <h2 className="text-xl font-bold text-heading">Masuk ke Sistem</h2>
              <p className="text-sm text-caption mt-1">Silakan masukkan kredensial akun Anda</p>
            </div>

            <div className="px-6 pb-8 sm:px-8 pt-4">
              {error && (
                <div role="alert" aria-live="polite" className="mb-5 p-3.5 bg-accent-red border border-red-300 dark:border-red-800/50 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-start gap-2.5 animate-slide-up">
                  <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-red-500 dark:text-red-400" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-5" noValidate>
                <div>
                  <label htmlFor="login-username" className="block text-sm font-semibold text-body mb-1.5">Username</label>
                  <div className="relative">
                    <User className="w-[18px] h-[18px] text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                    <input
                      id="login-username" type="text" required value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Masukkan username" aria-label="Username" autoComplete="username"
                      className="w-full pl-11 pr-4 py-3 bg-subtle border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-sm font-semibold text-body mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="w-[18px] h-[18px] text-dim absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                    <input
                      id="login-password" type="password" required value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password" aria-label="Password" autoComplete="current-password"
                      className="w-full pl-11 pr-4 py-3 bg-subtle border border-line rounded-xl text-sm text-heading placeholder:text-dim focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500 focus:bg-card transition-all duration-200"
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading}
                  aria-label={loading ? "Sedang memproses login" : "Masuk ke sistem"}
                  className="w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white font-semibold rounded-xl text-sm shadow-md hover:shadow-lg disabled:opacity-55 disabled:cursor-not-allowed disabled:hover:bg-sky-600 transition-all duration-200 flex items-center justify-center gap-2.5"
                >
                  {loading ? (
                    <><span className="spinner border-white/30 border-t-white" /><span>Memproses Masuk...</span></>
                  ) : (
                    <><span>Masuk ke Sistem</span><ArrowRight className="w-4 h-4" aria-hidden="true" /></>
                  )}
                </button>
              </form>

              <div className="mt-7 pt-6 border-t border-line-light">
                <p className="text-xs font-semibold text-dim uppercase tracking-wider mb-3 text-center">Pintasan Demo Akun</p>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => handleQuickDemo("kader")} aria-label="Isi otomatis akun demo Kader Posyandu"
                    className="py-2.5 px-3 bg-subtle hover:bg-accent-sky hover:text-sky-700 dark:hover:text-sky-300 hover:border-sky-200 dark:hover:border-sky-800/50 active:bg-sky-100 dark:active:bg-sky-900/40 border border-line rounded-xl text-xs font-semibold transition-all duration-200 text-label text-center"
                  >
                    Kader Posyandu
                  </button>
                  <button type="button" onClick={() => handleQuickDemo("admin")} aria-label="Isi otomatis akun demo Admin Puskesmas"
                    className="py-2.5 px-3 bg-subtle hover:bg-accent-sky hover:text-sky-700 dark:hover:text-sky-300 hover:border-sky-200 dark:hover:border-sky-800/50 active:bg-sky-100 dark:active:bg-sky-900/40 border border-line rounded-xl text-xs font-semibold transition-all duration-200 text-label text-center"
                  >
                    Admin Puskesmas
                  </button>
                </div>
              </div>
            </div>
          </div>

          <p className="lg:hidden text-center text-xs text-dim mt-6">© 2024 — Sistem Multi-Agent AI KIA</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
