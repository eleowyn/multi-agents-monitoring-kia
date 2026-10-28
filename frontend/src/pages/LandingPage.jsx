import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import {
  Heart,
  MapPin,
  ArrowRight,
  CheckCircle2,
  Sun,
  Moon,
  Baby,
  Utensils,
  Droplets,
  Clock,
  X,
  ChevronRight,
  Menu,
  AlertTriangle,
  Phone,
  Mail,
  ExternalLink,
  Sparkles,
} from "lucide-react";

const PHASES_1000_HPK = [
  {
    id: "fase-1",
    badge: "Fase 1 • 270 Hari",
    title: "Masa Kehamilan (Trimester 1 – 3)",
    icon: Heart,
    iconColor: "text-rose-500",
    summary:
      "Pemeriksaan kehamilan (ANC) minimal 6 kali, pemenuhan gizi ibu, konsumsi rutin Tablet Tambah Darah (TTD), dan deteksi dini risiko kehamilan.",
    points: [
      {
        label: "1. Pemeriksaan Kehamilan Terpadu (ANC Minimal 6 Kali)",
        text: "Kunjungan pemeriksaan dilakukan minimal 6 kali (2x Trimester 1, 1x Trimester 2, dan 3x Trimester 3 termasuk minimal 2x pemeriksaan oleh dokter/USG). Pemeriksaan meliputi timbang berat badan, ukur Lingkar Lengan Atas (LiLA normal ≥ 23,5 cm), tekanan darah, Tinggi Fundus Uteri (TFU), denyut jantung janin, dan cek Hemoglobin (Hb normal ≥ 11,0 g/dL).",
      },
      {
        label: "2. Gizi Ibu Hamil & Bahan Pangan Lokal Minahasa Utara",
        text: "Ibu hamil memerlukan tambahan 1 porsi makan setiap hari (3x makan utama + 2x selingan padat gizi). Utamakan 2 lauk protein hewani setiap kali makan seperti ikan tude/cakalang segar, telur ayam rebus/dadar (1–2 butir/hari), hati ayam, daging, disertai sayur daun kelor, daun katuk, bayam, dan buah segar.",
      },
      {
        label: "3. Aturan Minum Tablet Tambah Darah (TTD) & Susu Ibu Hamil",
        text: "Minum 1 tablet TTD setiap malam sebelum tidur dengan air putih atau air jeruk manis (minimal 90 tablet selama hamil). Bila mengonsumsi Susu Ibu Hamil pada pagi/sore hari, beri jeda minimal 2 jam dari TTD, teh, atau kopi agar penyerapan zat besi berjalan optimal.",
      },
      {
        label: "4. Istirahat, Aktivitas Ringan & Stimulasi Janin",
        text: "Lakukan jalan pagi santai atau senam hamil ringan 20–30 menit bila kehamilan sehat. Tidur malam 7–8 jam dengan posisi miring ke kiri pada Trimester 2–3 untuk memperlancar aliran darah dan oksigen ke plasenta.",
      },
    ],
    dangerSigns: [
      "Perdarahan dari jalan lahir atau keluar air ketuban sebelum waktunya.",
      "Bengkak pada wajah, tangan, atau kaki disertai sakit kepala hebat atau pandangan kabur (gejala tekanan darah tinggi/preeklamsia).",
      "Demam tinggi atau muntah terus-menerus hingga ibu tidak bisa makan dan minum.",
      "Gerakan janin berkurang (kurang dari 10 kali gerakan dalam 12 jam pada Trimester 3).",
    ],
  },
  {
    id: "fase-2",
    badge: "Fase 2 • 0 – 28 Hari",
    title: "Bayi Baru Lahir (Neonatus)",
    icon: Baby,
    iconColor: "text-amber-500",
    summary:
      "Inisiasi Menyusu Dini (IMD), pemberian kolostrum & ASI eksklusif murni, perawatan tali pusat kering, serta kunjungan neonatal KN1–KN3.",
    points: [
      {
        label: "1. Inisiasi Menyusu Dini (IMD) & Kunjungan Neonatal (KN1–KN3)",
        text: "Segera setelah lahir dilakukan kontak kulit-ke-kulit (IMD) minimal 1 jam, penimbangan berat lahir (normal ≥ 2.500 gram), pengukuran panjang badan (normal ≥ 48 cm), injeksi Vitamin K1, salep mata, dan imunisasi HB-0. Pantau kesehatan bayi pada KN1 (6–48 jam), KN2 (hari ke-3 s/d 7), dan KN3 (hari ke-8 s/d 28).",
      },
      {
        label: "2. ASI Eksklusif Murni & Keajaiban Kolostrum",
        text: "Berikan hanya ASI sesering mungkin (8–12 kali sehari atau setiap 2–3 jam). Jangan membuang kolostrum (ASI pertama yang berwarna kekuningan kental) karena kaya antibodi alami. Dilarang memberikan air putih, madu, air gula, atau pisang kerok pada bayi baru lahir.",
      },
      {
        label: "3. Gizi Ibu Menyusui (Booster ASI Alami)",
        text: "Ibu menyusui membutuhkan tambahan +500 kkal/hari: makan bergizi 3–4x sehari dengan lauk ikan tude/cakalang kuah kuning, telur, hati ayam, sayur bening daun katuk & daun kelor, serta minum air putih minimal 12–14 gelas sehari.",
      },
      {
        label: "4. Kehangatan Tubuh & Perawatan Metode Kanguru (PMK)",
        text: "Jaga suhu tubuh bayi tetap hangat (36,5–37,5°C) dan rawat tali pusat secara bersih serta kering terbuka. Khusus bayi berat lahir rendah (BBLR < 2.500 g), lakukan Perawatan Metode Kanguru (kontak kulit bayi langsung ke dada ibu/ayah).",
      },
    ],
    dangerSigns: [
      "Bayi tidak mau menyusu, hisapan sangat lemah, atau memuntahkan semua ASI.",
      "Tubuh bayi teraba dingin (< 36,5°C) atau demam tinggi (≥ 37,5°C).",
      "Napas cepat (≥ 60 kali/menit), tarikan dinding dada ke dalam, atau bayi tampak merintih.",
      "Kulit bayi tampak kuning sejak hari pertama lahir atau menjalar hingga telapak tangan dan kaki.",
    ],
  },
  {
    id: "fase-3",
    badge: "Fase 3 • 1 – 24 Bulan",
    title: "Bayi & Anak Baduta",
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    summary:
      "ASI eksklusif 0–6 bulan, MP-ASI padat protein hewani lokal mulai 6 bulan, pemantauan timbangan bulanan di Posyandu, dan imunisasi lengkap.",
    points: [
      {
        label: "1. Penimbangan & Pengukuran Rutin Setiap Bulan di Posyandu",
        text: "Bawa anak ke Posyandu sebulan sekali untuk timbang Berat Badan (BB), ukur Panjang/Tinggi Badan (PB/TB), dan Lingkar Kepala. Pastikan grafik KMS naik setiap bulan; bila berat badan tidak naik 2 kali berturut-turut (2T), segera konsultasikan ke petugas kesehatan.",
      },
      {
        label: "2. Tahapan Tekstur & Porsi MP-ASI Kaya Protein Hewani",
        text: "Usia 6–8 bulan: bubur kental saring 2–3x/hari (mulai 2–3 sdm hingga 1/2 mangkuk 250 mL). Usia 9–11 bulan: nasi tim/cincang halus 3–4x/hari (1/2–3/4 mangkuk). Usia 12–24 bulan: makanan keluarga 3–4x/hari (3/4–1 mangkuk penuh). Wajib sertakan protein hewani setiap makan.",
      },
      {
        label: "3. ASI Lanjutan Hingga 2 Tahun, Vitamin A & Imunisasi",
        text: "Lanjutkan pemberian ASI hingga anak genap berusia 24 bulan. Pastikan anak mendapatkan kapsul Vitamin A setiap bulan Februari & Agustus di Posyandu (Biru untuk 6–11 bulan, Merah untuk 12–59 bulan) serta imunisasi dasar dan lanjutan lengkap.",
      },
      {
        label: "4. Stimulasi Bermain, Bicara & Kebersihan Lingkungan (PHBS)",
        text: "Rangsang kemampuan gerak kasar, gerak halus, bicara, dan kemandirian anak melalui permainan interaktif tanpa gawai (screen time). Biasakan cuci tangan pakai sabun, gunakan air bersih, dan pastikan anak tidur cukup 11–14 jam sehari.",
      },
    ],
    dangerSigns: [
      "Berat badan anak tidak naik 2 bulan berturut-turut (2T) atau berada di bawah garis merah KMS.",
      "Tinggi badan anak terlihat lebih pendek dibandingkan anak seusianya (indikasi risiko stunting).",
      "Diare berulang, batuk/demam lama (> 2 minggu), atau anak tampak sangat kurus dan lemas.",
      "Keterlambatan perkembangan gerak atau bicara sesuai tahapan usianya di Buku KIA.",
    ],
  },
];

const NUTRITION_GUIDES = [
  {
    id: "makanan",
    title: "Panduan Makanan & MP-ASI Lokal",
    badge: "Nutrisi Harian",
    icon: Utensils,
    iconColor: "text-emerald-500",
    summary:
      "Pemanfaatan sumber protein hewani lokal Minahasa Utara, pengaturan tekstur sesuai usia, dan penambahan lemak sehat.",
    details: [
      {
        subtitle: "1. Utamakan Protein Hewani Setiap Kali Makan",
        content:
          "Protein hewani mengandung asam amino esensial lengkap serta zat besi dan seng yang mudah diserap tubuh untuk pertumbuhan tulang dan otak. Manfaatkan bahan segar yang mudah diperoleh di Airmadidi:\n• Ikan tude, cakalang, malalugis, atau ikan gabus (pastikan bebas duri)\n• Telur ayam atau telur puyuh (1–2 butir setiap hari)\n• Hati ayam dan daging ayam/sapi cincang",
      },
      {
        subtitle: "2. Lemak Tambahan & Sayuran Segar",
        content:
          "• Tambahkan 1 sendok teh minyak kelapa, mentega, atau santan matang pada setiap porsi MP-ASI untuk mencukupi kebutuhan kalori tumbuh kejar.\n• Padukan dengan sayuran lokal kaya vitamin seperti daun kelor, daun katuk, bayam, wortel, labu kuning, serta buah pepaya, pisang, dan jeruk manis.",
      },
      {
        subtitle: "3. Contoh Jadwal Makan Anak Baduta (5 Waktu Makan)",
        content:
          "• 07.00 (Pagi): Bubur/Nasi tim ikan tude suwir + telur rebus + bening daun kelor\n• 10.00 (Selingan Pagi): Bubur kacang hijau santan / buah pisang & pepaya\n• 12.30 (Siang): Nasi tim/lembek hati ayam & tempe + sup wortel\n• 16.00 (Selingan Sore): Puding susu telur / perkedel tahu kukus\n• 18.30 (Malam): Nasi tim ikan cakalang kuah kuning + sayur bayam (+ ASI sesuai keinginan anak)",
      },
    ],
  },
  {
    id: "susu-asi",
    title: "Panduan ASI, Susu & Suplementasi",
    badge: "ASI & Suplemen",
    icon: Droplets,
    iconColor: "text-sky-500",
    summary:
      "Aturan ASI eksklusif 0–6 bulan, ASI lanjutan hingga 2 tahun, aturan jeda susu ibu hamil dengan TTD, serta larangan Susu Kental Manis.",
    details: [
      {
        subtitle: "1. ASI Adalah Nutrisi Terbaik (Usia 0 – 24 Bulan)",
        content:
          "• Usia 0–6 bulan: Berikan HANYA ASI Eksklusif 8–12 kali sehari tanpa tambahan makanan atau minuman lain.\n• Usia 6–24 bulan: ASI tetap dilanjutkan hingga usia 2 tahun sebagai sumber antibodi dan energi pendamping MP-ASI.",
      },
      {
        subtitle: "2. Susu Ibu Hamil & Aturan Jeda 2 Jam dengan TTD",
        content:
          "• Ibu hamil dianjurkan minum Susu Ibu Hamil terfortifikasi asam folat, kalsium, dan zat besi (1–2 gelas sehari pada pagi/sore hari).\n• Jangan meminum Tablet Tambah Darah (TTD) bersamaan dengan susu, teh, atau kopi. Berikan jeda minimal 2 jam karena kalsium dan tanin menghambat penyerapan zat besi.",
      },
      {
        subtitle: "3. Larangan Susu Kental Manis (SKM) & Indikasi Medis",
        content:
          "• Dilarang menyeduh Susu Kental Manis (SKM) sebagai minuman susu bagi bayi dan balita karena kandungan gulanya sangat tinggi dan miskin protein.\n• Apabila anak mengalami gangguan pertumbuhan berat (gizi kurang/buruk atau stunting), konsultasikan ke Dokter/Petugas Gizi UPTD Puskesmas Airmadidi untuk penanganan gizi medis yang tepat.",
      },
    ],
  },
  {
    id: "aktivitas",
    title: "Aktivitas Fisik, Tidur & Stimulasi",
    badge: "Tumbuh Kembang",
    icon: Baby,
    iconColor: "text-amber-500",
    summary:
      "Stimulasi bermain sesuai kelompok usia, kebutuhan tidur malam untuk hormon pertumbuhan, dan kebersihan keluarga.",
    details: [
      {
        subtitle: "1. Stimulasi Anak Sesuai Tahapan Usia",
        content:
          "• Usia 0–6 bulan: Peluk dan ajak bayi mengobrol/tersenyum, latihan tengkurap (tummy time) dalam pengawasan, dan gantung mainan berwarna cerah.\n• Usia 6–12 bulan: Latih duduk mandiri, merangkak, berdiri berpegangan, permainan cilukba, dan belajar memegang makanan sendiri (finger food).\n• Usia 12–24 bulan: Latih berjalan lancar, menyusun balok, menyebutkan nama benda/anggota tubuh, makan bersama keluarga tanpa gawai (HP/TV).",
      },
      {
        subtitle: "2. Tidur Berkualitas & Perilaku Hidup Bersih Sehat (PHBS)",
        content:
          "• Anak usia 0–24 bulan membutuhkan total waktu tidur 11–14 jam sehari (termasuk tidur siang) karena hormon pertumbuhan bekerja paling optimal saat anak tidur nyenyak di malam hari.\n• Cegah infeksi berulang (diare dan cacingan) dengan selalu mencuci tangan pakai sabun di air mengalir serta menjaga kebersihan peralatan makan anak.",
      },
    ],
  },
];

const GOLDEN_AGE_FUN_FACTS = [
  {
    id: "fact-1",
    badge: "Fakta #1 • Perkembangan Otak",
    title: "80% Otak Anak Terbentuk Sebelum Usia 2 Tahun",
    shortDesc:
      "Saat lahir ukuran otak bayi sekitar 25% otak dewasa, dan berkembang pesat mencapai 80% tepat pada usia 24 bulan (1.000 HPK).",
    fullDetail:
      "Pada periode emas 1.000 Hari Pertama Kehidupan (sejak dalam kandungan hingga anak berusia 2 tahun), otak anak membentuk hingga 1.000 sambungan sel saraf baru setiap detiknya. Asupan protein hewani (seperti ikan, telur, dan ASI) serta stimulasi kasih sayang orang tua adalah bahan bakar utama pembentukan kecerdasan anak yang tidak dapat diulang di usia dewasa.",
  },
  {
    id: "fact-2",
    badge: "Fakta #2 • Keajaiban ASI Pertama",
    title: "Kolostrum Adalah 'Imunisasi Pertama' Alami Bayi",
    shortDesc:
      "Cairan ASI pertama yang berwarna kekuningan kental mengandung jutaan antibodi pelindung tubuh bayi baru lahir.",
    fullDetail:
      "Pada 1–3 hari pertama setelah melahirkan, payudara ibu menghasilkan Kolostrum yang berwarna kekuningan dan kental. Meski jumlahnya tampak sedikit (beberapa sendok teh), cairan ini sangat kaya akan Imunoglobulin A (IgA), sel darah putih, dan Vitamin A yang melapisi dinding usus bayi agar terlindung dari kuman penyebab diare dan infeksi.",
  },
  {
    id: "fact-3",
    badge: "Fakta #3 • Ukuran Lambung Bayi",
    title: "Lambung Bayi Hari Pertama Hanya Sebesar Kelereng",
    shortDesc:
      "Ibu tidak perlu khawatir ASI terasa sedikit di hari pertama, karena lambung bayi baru lahir hanya menampung 5–7 mL sekali minum.",
    fullDetail:
      "Banyak ibu cemas ASI belum keluar deras di hari pertama melahirkan. Faktanya, ukuran lambung bayi berusia 1 hari hanya sebesar kelereng/buah ceri (kapasitas 5–7 mL atau sekitar 1 sendok teh). Pada hari ke-3 lambung membesar seukuran bola bekel (22–27 mL), dan usia 1 minggu seukuran bola pingpong (45–60 mL). Semakin sering bayi disusui, produksi ASI ibu akan otomatis meningkat mengikuti kebutuhan bayi.",
  },
  {
    id: "fact-4",
    badge: "Fakta #4 • Rahasia Tinggi Badan",
    title: "Hormon Pertumbuhan Bekerja Maksimal Saat Tidur Malam",
    shortDesc:
      "Hingga 70% hormon pertumbuhan (Growth Hormone) anak dilepaskan ketika anak tidur lelap pada malam hari.",
    fullDetail:
      "Selain makanan bergizi seimbang, tidur yang cukup dan teratur sangat menentukan pertumbuhan panjang/tinggi badan anak. Puncak pelepasan hormon pertumbuhan terjadi saat anak berada dalam fase tidur dalam (deep sleep) di malam hari sekitar pukul 21.00 hingga 02.00 dini hari. Membiasakan anak tidur lebih awal membantu pertumbuhan tulang lebih optimal.",
  },
  {
    id: "fact-5",
    badge: "Fakta #5 • Pangan Lokal",
    title: "1 Butir Telur & Ikan Tude Sehari Efektif Cegah Stunting",
    shortDesc:
      "Bahan pangan lokal di sekitar kita memiliki nilai gizi setara dengan bahan makanan impor yang mahal.",
    fullDetail:
      "Ikan laut segar yang melimpah di Minahasa Utara seperti ikan tude, cakalang, dan malalugis kaya akan Omega-3 (DHA/EPA) serta protein berkualitas tinggi. Begitu pula 1 butir telur ayam setiap hari dan sayur daun kelor yang mengandung kalsium serta zat besi tinggi. Memberikan lauk hewani lokal setiap kali makan terbukti secara ilmiah menurunkan risiko stunting secara signifikan.",
  },
  {
    id: "fact-6",
    badge: "Fakta #6 • Stimulasi Sejak Hamil",
    title: "Janin Sudah Mengenali Suara Ibu Sejak Usia 20 Minggu",
    shortDesc:
      "Mengajak janin mengobrol dan mengelus perut sejak Trimester 2 merangsang pendengaran dan ketenangan emosi bayi.",
    fullDetail:
      "Memasuki usia kehamilan 20 minggu (5 bulan), organ pendengaran janin mulai berfungsi dan ia dapat mendengar detak jantung serta suara ibunya. Ketika ibu dan ayah rutin mengajak janin berbicara dengan lembut, detak jantung janin menjadi lebih tenang dan proses perkembangan bahasa anak setelah lahir menjadi lebih cepat terstimulasi.",
  },
];

const POSYANDU_5_STEPS = [
  {
    step: "Langkah 1",
    title: "Pendaftaran Ibu & Anak",
    shortDesc: "Pencatatan kehadiran di Posyandu dengan membawa Buku KIA (buku pink).",
    fullDetail:
      "Keluarga membawa Buku KIA saat datang ke Posyandu. Kader mencatat identitas ibu hamil, bayi baru lahir, atau baduta pada kartu bantu pemeriksaan serta menghitung usia kehamilan atau usia bulan anak.",
  },
  {
    step: "Langkah 2",
    title: "Penimbangan & Pengukuran",
    shortDesc: "Timbang berat badan, ukur panjang/tinggi badan, lingkar kepala, dan LiLA.",
    fullDetail:
      "Kader melakukan penimbangan Berat Badan (BB), pengukuran Panjang/Tinggi Badan (PB/TB), Lingkar Kepala anak, serta pengukuran Lingkar Lengan Atas (LiLA) bagi ibu hamil menggunakan alat ukur terstandar.",
  },
  {
    step: "Langkah 3",
    title: "Pencatatan Grafik Buku KIA",
    shortDesc: "Plotting titik pertumbuhan pada grafik KMS untuk memantau kenaikan bulanan.",
    fullDetail:
      "Hasil pengukuran dicatat ke dalam Kartu Menuju Sehat (KMS) di Buku KIA dan sistem pemantauan Posyandu untuk melihat apakah grafik tumbuh kembang anak naik sesuai jalurnya atau memerlukan perhatian khusus.",
  },
  {
    step: "Langkah 4",
    title: "Pelayanan Kesehatan & Gizi",
    shortDesc: "Pemberian Vitamin A, Tablet Tambah Darah (TTD), imunisasi, dan PMT.",
    fullDetail:
      "Bidan Desa dan petugas kesehatan UPTD Puskesmas Airmadidi memberikan pelayanan imunisasi dasar/lanjutan, kapsul Vitamin A, Tablet Tambah Darah (TTD) bagi ibu hamil, pemeriksaan kehamilan, serta Pemberian Makanan Tambahan (PMT) berbahan pangan lokal.",
  },
  {
    step: "Langkah 5",
    title: "Penyuluhan & Konseling Keluarga",
    shortDesc: "Edukasi menu makan harian, cara menyusui, dan stimulasi bermain di rumah.",
    fullDetail:
      "Kader dan tenaga kesehatan memberikan penjelasan ramah kepada ibu/keluarga mengenai contoh menu MP-ASI lokal di rumah, jadwal pemberian ASI/susu, cara merangsang tumbuh kembang anak sesuai usia, serta rujukan ke Puskesmas bila ditemukan tanda bahaya.",
  },
];

const VILLAGES_AIRMADIDI = [
  { name: "Kelurahan Sarongsong Satu", posyandu: "Posyandu Anggrek & Lokasi Induk Puskesmas", schedule: "Minggu ke-2 • 08.00 WITA" },
  { name: "Kelurahan Sarongsong Dua", posyandu: "Posyandu Dahlia & Cempaka", schedule: "Minggu ke-2 • 08.00 WITA" },
  { name: "Kelurahan Airmadidi Atas", posyandu: "Posyandu Mawar & Melati", schedule: "Minggu ke-1 • 08.00 WITA" },
  { name: "Kelurahan Airmadidi Bawah", posyandu: "Posyandu Bougenville", schedule: "Minggu ke-1 • 08.30 WITA" },
  { name: "Kelurahan Sukur", posyandu: "Posyandu Kasih Ibu & Poskesdes Sukur", schedule: "Minggu ke-2 • 08.30 WITA" },
  { name: "Kelurahan Rap-Rap", posyandu: "Posyandu Teratai", schedule: "Minggu ke-3 • 08.00 WITA" },
  { name: "Desa Sawangan", posyandu: "Posyandu Flamboyan", schedule: "Minggu ke-3 • 08.00 WITA" },
  { name: "Desa Sampiri", posyandu: "Posyandu Kamboja", schedule: "Minggu ke-3 • 08.30 WITA" },
  { name: "Desa Tanggari", posyandu: "Posyandu Kenanga & Pustu Tanggari", schedule: "Minggu ke-3 • 09.00 WITA" },
];

const GOOGLE_MAPS_URL = "https://maps.app.goo.gl/EYaF5jMDJizmTPXZ9";
const INSTAGRAM_URL = "https://www.instagram.com/uptd_puskesmas_airmadidi";
const FACEBOOK_URL = "https://www.facebook.com/search/top/?q=UPTD%20Puskesmas%20Airmadidi";

const LandingPage = () => {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [selectedModal, setSelectedModal] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const dashboardPath = user
    ? user.role === "ADMIN"
      ? "/admin/dashboard"
      : "/kader/dashboard"
    : "/login";

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setSelectedModal(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-page text-body flex flex-col">
      {/* ─── Clean Single-Line Top Navbar with Official Logos ─── */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b border-line">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12 h-16 flex items-center justify-between gap-4">
          {/* Brand with Official Minahasa Utara & Puskesmas Airmadidi Logos */}
          <Link to="/" className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 shrink-0">
              <img
                src="/logo-minahasa-utara.png"
                alt="Logo Kabupaten Minahasa Utara"
                className="w-8 h-8 object-contain"
              />
              <img
                src="/logo-puskesmas-airmadidi.png"
                alt="Logo UPTD Puskesmas Airmadidi"
                className="w-9 h-9 object-contain rounded-md bg-white p-0.5 border border-line-light"
              />
            </div>
            <div className="leading-tight">
              <span className="font-bold text-heading text-base tracking-tight block whitespace-nowrap">
                UPTD Puskesmas Airmadidi
              </span>
              <span className="text-xs text-caption hidden sm:block whitespace-nowrap">
                Pelayanan Posyandu & KIA 1.000 HPK &bull; Minahasa Utara
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden xl:flex items-center gap-6 text-sm font-medium text-label">
            <a href="#fase-1000-hpk" className="hover:text-heading transition-colors whitespace-nowrap">
              3 Fase 1.000 HPK
            </a>
            <a href="#panduan-gizi" className="hover:text-heading transition-colors whitespace-nowrap">
              Gizi & ASI
            </a>
            <a href="#fun-facts-golden-age" className="hover:text-heading transition-colors whitespace-nowrap">
              Fun Facts Golden Age
            </a>
            <a href="#alur-posyandu" className="hover:text-heading transition-colors whitespace-nowrap">
              5 Langkah Posyandu
            </a>
            <a href="#profil-lokasi" className="hover:text-heading transition-colors whitespace-nowrap">
              Profil & Lokasi
            </a>
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Mode terang" : "Mode gelap"}
              className="p-2 text-caption hover:text-heading hover:bg-subtle rounded-xl border border-line transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <Link
              to={dashboardPath}
              className="btn-interactive hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all whitespace-nowrap"
            >
              <span>{user ? "Buka Dashboard" : "Login Petugas"}</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </Link>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label="Menu navigasi"
              className="xl:hidden p-2 text-caption hover:text-heading hover:bg-subtle rounded-xl border border-line cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-line bg-card px-5 py-4 space-y-3 animate-fade-in">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm font-medium text-label">
              <a
                href="#fase-1000-hpk"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-subtle hover:text-heading"
              >
                3 Fase 1.000 HPK
              </a>
              <a
                href="#panduan-gizi"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-subtle hover:text-heading"
              >
                Panduan Gizi & ASI
              </a>
              <a
                href="#fun-facts-golden-age"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-subtle hover:text-heading"
              >
                Fun Facts Golden Age
              </a>
              <a
                href="#alur-posyandu"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-subtle hover:text-heading"
              >
                5 Langkah Posyandu
              </a>
              <a
                href="#profil-lokasi"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-subtle hover:text-heading"
              >
                Profil & Lokasi Puskesmas
              </a>
            </div>
            <div className="pt-2 sm:hidden">
              <Link
                to={dashboardPath}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-sky-600 text-white rounded-xl text-sm font-semibold"
              >
                <span>{user ? "Buka Dashboard" : "Login Petugas"}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* ─── Hero Section (Clean Neutral Surface, Pill Badge Removed, Uncluttered) ─── */}
      <section className="border-b border-line bg-card">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12 py-12 sm:py-18">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-5 animate-slide-in-up">
              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-bold text-heading tracking-tight leading-[1.2]">
                Kawal Tumbuh Kembang Anak & Kesehatan Ibu di Masa Emas 1.000 Hari Pertama Kehidupan
              </h1>

              <p className="text-base text-caption leading-relaxed max-w-2xl">
                Pusat informasi layanan Kesehatan Ibu dan Anak (KIA) UPTD Puskesmas Airmadidi serta Posyandu
                se-Kecamatan Airmadidi, Kabupaten Minahasa Utara. Panduan praktis bagi ibu hamil dan keluarga
                untuk mencegah stunting serta mengoptimalkan tumbuh kembang buah hati sejak dalam kandungan hingga usia 2 tahun.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href="#fase-1000-hpk"
                  className="btn-interactive inline-flex items-center gap-2 px-5 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-sm font-semibold shadow-xs transition-all"
                >
                  <span>Pelajari Panduan 1.000 HPK</span>
                  <ArrowRight className="w-4 h-4" />
                </a>
                <a
                  href="#profil-lokasi"
                  className="btn-interactive inline-flex items-center gap-2 px-5 py-3 bg-subtle hover:bg-muted text-heading border border-line rounded-xl text-sm font-semibold transition-all"
                >
                  <span>Lokasi & Layanan Puskesmas</span>
                </a>
              </div>
            </div>

            {/* Right Column: 4 Clean Typographic Stat Cards (No Excessive Icons) */}
            <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-slide-in-up stagger-1">
              <a
                href="#fase-1000-hpk"
                className="card-interactive p-5 rounded-2xl bg-subtle border border-line flex flex-col justify-between gap-2"
              >
                <span className="text-xs font-semibold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                  Periode Emas
                </span>
                <div>
                  <p className="text-2xl font-bold text-heading">1.000 Hari</p>
                  <p className="text-sm font-medium text-label mt-0.5">Kehamilan s/d Usia 2 Tahun</p>
                  <p className="text-xs text-caption mt-1 leading-relaxed">
                    270 hari di dalam kandungan ditambah 730 hari dua tahun pertama kehidupan anak.
                  </p>
                </div>
              </a>

              <a
                href="#fun-facts-golden-age"
                className="card-interactive p-5 rounded-2xl bg-subtle border border-line flex flex-col justify-between gap-2"
              >
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                  Golden Age
                </span>
                <div>
                  <p className="text-2xl font-bold text-heading">80% Otak Anak</p>
                  <p className="text-sm font-medium text-label mt-0.5">Tumbuh Sebelum Usia 2 Tahun</p>
                  <p className="text-xs text-caption mt-1 leading-relaxed">
                    Masa paling menentukan bagi kecerdasan, daya tahan tubuh, dan tinggi badan anak.
                  </p>
                </div>
              </a>

              <a
                href="#panduan-gizi"
                className="card-interactive p-5 rounded-2xl bg-subtle border border-line flex flex-col justify-between gap-2"
              >
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                  Nutrisi Keluarga
                </span>
                <div>
                  <p className="text-2xl font-bold text-heading">ASI & MP-ASI</p>
                  <p className="text-sm font-medium text-label mt-0.5">Pangan Lokal Minahasa</p>
                  <p className="text-xs text-caption mt-1 leading-relaxed">
                    Panduan ASI eksklusif, ikan tude/cakalang, telur, hati ayam, dan daun kelor.
                  </p>
                </div>
              </a>

              <a
                href="#profil-lokasi"
                className="card-interactive p-5 rounded-2xl bg-subtle border border-line flex flex-col justify-between gap-2"
              >
                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider">
                  Jejaring Layanan
                </span>
                <div>
                  <p className="text-2xl font-bold text-heading">9 Desa / Kel.</p>
                  <p className="text-sm font-medium text-label mt-0.5">Posyandu Kec. Airmadidi</p>
                  <p className="text-xs text-caption mt-1 leading-relaxed">
                    Pelayanan Posyandu, Pustu, dan Poskesdes binaan UPTD Puskesmas Airmadidi.
                  </p>
                </div>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 1: 3 Fase 1.000 HPK (Minimalist Cards) ─── */}
      <section
        id="fase-1000-hpk"
        className="py-14 sm:py-18 max-w-[1440px] w-full mx-auto px-5 sm:px-8 lg:px-12 space-y-8"
      >
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-caption">
            Panduan Kesehatan Ibu & Anak
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            3 Fase Penting dalam 1.000 Hari Pertama Kehidupan
          </h2>
          <p className="text-sm sm:text-base text-caption leading-relaxed">
            Pilih masing-masing fase untuk membaca panduan pemeriksaan rutin, asupan gizi harian, serta tanda bahaya yang perlu diwaspadai.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PHASES_1000_HPK.map((phase) => {
            const Icon = phase.icon;
            return (
              <div
                key={phase.id}
                onClick={() =>
                  setSelectedModal({
                    type: "phase",
                    badge: phase.badge,
                    title: phase.title,
                    points: phase.points,
                    dangerSigns: phase.dangerSigns,
                  })
                }
                className="group card-interactive cursor-pointer rounded-2xl border border-line bg-card p-6 flex flex-col justify-between gap-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-subtle border border-line flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${phase.iconColor}`} />
                    </div>
                    <span className="text-xs font-medium text-caption px-2.5 py-1 rounded-md bg-subtle border border-line">
                      {phase.badge}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-heading">{phase.title}</h3>
                    <p className="text-sm text-caption leading-relaxed">{phase.summary}</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-line-light flex items-center justify-between text-sm font-semibold text-label group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                  <span>Lihat panduan lengkap</span>
                  <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Section 2: Panduan Praktis Gizi Lokal, ASI/Susu & Aktivitas ─── */}
      <section id="panduan-gizi" className="py-14 sm:py-18 bg-card border-y border-line">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12 space-y-8">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-caption">
              Pedoman Gizi & Perawatan Harian
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
              Panduan Makanan/MP-ASI, ASI & Stimulasi Anak
            </h2>
            <p className="text-sm sm:text-base text-caption leading-relaxed">
              Pemenuhan gizi seimbang berbahan pangan lokal Minahasa Utara serta stimulasi harian sesuai Buku KIA Kemenkes RI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {NUTRITION_GUIDES.map((guide) => {
              const Icon = guide.icon;
              return (
                <div
                  key={guide.id}
                  onClick={() =>
                    setSelectedModal({
                      type: "nutrition",
                      badge: guide.badge,
                      title: guide.title,
                      details: guide.details,
                    })
                  }
                  className="group card-interactive cursor-pointer p-6 bg-page rounded-2xl border border-line flex flex-col justify-between gap-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-card border border-line flex items-center justify-center">
                        <Icon className={`w-5 h-5 ${guide.iconColor}`} />
                      </div>
                      <span className="text-xs font-medium text-caption px-2.5 py-1 rounded-md bg-card border border-line">
                        {guide.badge}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-heading">{guide.title}</h3>
                      <p className="text-sm text-caption leading-relaxed">{guide.summary}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-line flex items-center justify-between text-sm font-semibold text-label group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                    <span>Lihat detail & contoh menu</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Section 3: Tahukah Bunda? Fun Facts Masa Golden Age 1.000 HPK ─── */}
      <section
        id="fun-facts-golden-age"
        className="py-14 sm:py-18 max-w-[1440px] w-full mx-auto px-5 sm:px-8 lg:px-12 space-y-8"
      >
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-caption flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Tahukah Bunda? • Fakta Kesehatan Ibu & Anak</span>
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            Fakta Menarik Seputar Masa Golden Age (1.000 HPK)
          </h2>
          <p className="text-sm sm:text-base text-caption leading-relaxed">
            Pengetahuan sederhana namun penting bagi orang tua untuk mendukung tumbuh kembang optimal buah hati sejak dalam kandungan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {GOLDEN_AGE_FUN_FACTS.map((fact) => (
            <div
              key={fact.id}
              onClick={() =>
                setSelectedModal({
                  type: "step",
                  badge: fact.badge,
                  title: fact.title,
                  content: fact.fullDetail,
                })
              }
              className="group card-interactive cursor-pointer p-6 bg-card rounded-2xl border border-line flex flex-col justify-between gap-5"
            >
              <div className="space-y-3">
                <span className="inline-block text-xs font-medium text-caption px-2.5 py-1 rounded-md bg-subtle border border-line">
                  {fact.badge}
                </span>
                <h3 className="text-base sm:text-lg font-bold text-heading leading-snug">
                  {fact.title}
                </h3>
                <p className="text-sm text-caption leading-relaxed">{fact.shortDesc}</p>
              </div>

              <div className="pt-3 border-t border-line-light flex items-center justify-between text-xs font-semibold text-label group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                <span>Baca penjelasan lengkap</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Section 4: Alur 5 Langkah Pelayanan Posyandu ─── */}
      <section id="alur-posyandu" className="py-14 sm:py-18 bg-card border-y border-line">
        <div className="max-w-[1440px] w-full mx-auto px-5 sm:px-8 lg:px-12 space-y-8">
          <div className="max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-caption">
              Alur Pelayanan Masyarakat
            </p>
            <h2 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
              5 Langkah Pelayanan di Posyandu
            </h2>
            <p className="text-sm sm:text-base text-caption leading-relaxed">
              Tahapan pelayanan kesehatan ibu hamil, bayi, dan balita saat berkunjung ke Posyandu di Kecamatan Airmadidi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {POSYANDU_5_STEPS.map((item, idx) => (
              <div
                key={idx}
                onClick={() =>
                  setSelectedModal({
                    type: "step",
                    badge: `${item.step} Posyandu`,
                    title: item.title,
                    content: item.fullDetail,
                  })
                }
                className="group card-interactive cursor-pointer p-5 bg-page rounded-2xl border border-line flex flex-col justify-between gap-5"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-caption px-2.5 py-1 rounded-md bg-card border border-line">
                      {item.step}
                    </span>
                    <span className="text-xs font-bold text-dim">0{idx + 1}</span>
                  </div>
                  <h3 className="text-base font-bold text-heading leading-snug">{item.title}</h3>
                  <p className="text-sm text-caption leading-relaxed">{item.shortDesc}</p>
                </div>

                <div className="pt-3 border-t border-line flex items-center justify-between text-xs font-semibold text-label group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                  <span>Lihat detail</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 5: Profil, Layanan, Lokasi Google Maps & Jejaring 9 Desa/Kelurahan ─── */}
      <section
        id="profil-lokasi"
        className="py-14 sm:py-18 max-w-[1440px] w-full mx-auto px-5 sm:px-8 lg:px-12 space-y-10"
      >
        <div className="max-w-2xl space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-caption">
            Profil & Wilayah Kerja Puskesmas
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold text-heading tracking-tight">
            UPTD Puskesmas Airmadidi & Jejaring Posyandu
          </h2>
          <p className="text-sm sm:text-base text-caption leading-relaxed">
            Fasilitas Kesehatan Tingkat Pertama (FKTP) di Kabupaten Minahasa Utara dengan tata nilai pelayanan{" "}
            <strong className="text-heading">SEHATI</strong> (Santun, Empati, Harmonis, Adil, Tanggap, Inovatif).
          </p>
        </div>

        {/* Profile, Services & Interactive Map Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Left: Puskesmas Profile, Services & Social Media */}
          <div className="lg:col-span-6 p-6 bg-card rounded-2xl border border-line flex flex-col justify-between gap-6">
            <div className="space-y-5">
              {/* Official Identity Header */}
              <div className="flex items-center gap-4 pb-4 border-b border-line">
                <img
                  src="/logo-puskesmas-airmadidi.png"
                  alt="Logo UPTD Puskesmas Airmadidi"
                  className="w-16 h-16 object-contain rounded-xl bg-white p-1 border border-line shrink-0"
                />
                <div>
                  <span className="text-xs font-semibold text-caption uppercase tracking-wider">
                    Dinas Kesehatan Kab. Minahasa Utara
                  </span>
                  <h3 className="text-xl font-bold text-heading">UPTD Puskesmas Airmadidi</h3>
                  <p className="text-xs text-caption mt-0.5">
                    Motto: <strong className="text-heading">SEHATI</strong> &bull; Santun, Empati, Harmonis, Adil, Tanggap, Inovatif
                  </p>
                </div>
              </div>

              {/* Services Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-subtle rounded-xl border border-line space-y-1.5">
                  <p className="font-bold text-heading">Layanan Dalam Gedung</p>
                  <ul className="text-xs text-caption space-y-1 leading-relaxed list-disc pl-4">
                    <li>Poli KIA, KB & Pemeriksaan Ibu Hamil (ANC Terpadu)</li>
                    <li>Konseling Gizi, Laktasi (ASI) & MP-ASI</li>
                    <li>Imunisasi Bayi & Baduta Rutin</li>
                    <li>Pemeriksaan Laboratorium (Hb, Golongan Darah, Skrining)</li>
                  </ul>
                </div>

                <div className="p-4 bg-subtle rounded-xl border border-line space-y-1.5">
                  <p className="font-bold text-heading">Layanan Luar Gedung</p>
                  <ul className="text-xs text-caption space-y-1 leading-relaxed list-disc pl-4">
                    <li>Pelayanan Posyandu Rutin di 9 Kelurahan & Desa</li>
                    <li>Jejaring Pustu (Pustu Tanggari) & Poskesdes (Sukur)</li>
                    <li>Kunjungan Rumah Ibu Hamil Risiko Tinggi & Neonatus</li>
                    <li>Penyuluhan Gizi & Pencegahan Stunting</li>
                  </ul>
                </div>
              </div>

              {/* Contact & Social Media */}
              <div className="space-y-2.5 pt-1 text-sm">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="text-xs sm:text-sm text-body">
                    Kompleks Pasar Airmadidi, Kelurahan Sarongsong I, Kecamatan Airmadidi, Kabupaten Minahasa Utara, Sulawesi Utara 95371
                  </span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-sky-500 shrink-0" />
                  <span className="text-xs sm:text-sm text-body">
                    Kontak Layanan Puskesmas: <strong className="text-heading">0813-4076-0004</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Social Media & Maps Links */}
            <div className="pt-4 border-t border-line flex flex-wrap items-center gap-2.5">
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-interactive inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white transition-colors"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Buka di Google Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-interactive inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-subtle hover:bg-muted text-heading border border-line transition-colors"
              >
                <span>Instagram: @uptd_puskesmas_airmadidi</span>
                <ExternalLink className="w-3 h-3 text-caption" />
              </a>

              <a
                href={FACEBOOK_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-interactive inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-subtle hover:bg-muted text-heading border border-line transition-colors"
              >
                <span>Facebook: Puskesmas Airmadidi</span>
                <ExternalLink className="w-3 h-3 text-caption" />
              </a>
            </div>
          </div>

          {/* Right: Embedded Google Maps Location */}
          <div className="lg:col-span-6 bg-card rounded-2xl border border-line overflow-hidden flex flex-col justify-between">
            <div className="p-4 border-b border-line flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-bold text-heading">Peta Lokasi UPTD Puskesmas Airmadidi</p>
                <p className="text-xs text-caption">Kelurahan Sarongsong Satu, Kecamatan Airmadidi</p>
              </div>
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:underline shrink-0"
              >
                <span>Rute Petunjuk Arah</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="w-full h-72 sm:h-80 lg:flex-1 bg-subtle">
              <iframe
                title="Peta Lokasi UPTD Puskesmas Airmadidi"
                src="https://www.google.com/maps?q=Puskesmas+Airmadidi+Sarongsong+Minahasa+Utara&output=embed"
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>

        {/* 9 Desa & Kelurahan Posyandu Grid (Clean Minimalist without Repetitive Icons) */}
        <div className="space-y-4 pt-2">
          <h3 className="text-lg font-bold text-heading">
            Jejaring Posyandu di 9 Kelurahan & Desa se-Kecamatan Airmadidi
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {VILLAGES_AIRMADIDI.map((v, idx) => (
              <div
                key={idx}
                className="p-5 bg-card rounded-2xl border border-line flex flex-col justify-between gap-2"
              >
                <div>
                  <h4 className="text-base font-bold text-heading">{v.name}</h4>
                  <p className="text-sm text-label font-medium mt-0.5">{v.posyandu}</p>
                </div>
                <p className="text-xs text-caption flex items-center gap-1.5 pt-2 border-t border-line-light">
                  <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                  <span>Jadwal Rutin: {v.schedule}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Standard Website Footer ─── */}
      <footer className="mt-auto border-t border-line bg-card pt-12 pb-8">
        <div className="max-w-[1440px] mx-auto px-5 sm:px-8 lg:px-12 space-y-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8 lg:gap-10">
            {/* Col 1: Official Logos & Short Description */}
            <div className="lg:col-span-4 space-y-4">
              <div className="flex items-center gap-3">
                <img
                  src="/logo-minahasa-utara.png"
                  alt="Logo Kabupaten Minahasa Utara"
                  className="w-8 h-8 object-contain"
                />
                <img
                  src="/logo-puskesmas-airmadidi.png"
                  alt="Logo UPTD Puskesmas Airmadidi"
                  className="w-9 h-9 object-contain rounded-md bg-white p-0.5 border border-line-light"
                />
                <span className="font-bold text-heading text-base tracking-tight">
                  UPTD Puskesmas Airmadidi
                </span>
              </div>
              <p className="text-sm text-caption leading-relaxed max-w-sm">
                Portal informasi pelayanan Posyandu dan pemantauan Kesehatan Ibu & Anak pada masa Golden Age 1.000 Hari Pertama Kehidupan (HPK) di Kecamatan Airmadidi, Kabupaten Minahasa Utara.
              </p>
            </div>

            {/* Col 2: Navigasi Cepat */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-sm font-bold text-heading">Navigasi</h4>
              <ul className="space-y-2.5 text-sm text-caption">
                <li>
                  <a href="#fase-1000-hpk" className="hover:text-heading transition-colors">
                    3 Fase 1.000 HPK
                  </a>
                </li>
                <li>
                  <a href="#panduan-gizi" className="hover:text-heading transition-colors">
                    Edukasi Gizi & ASI
                  </a>
                </li>
                <li>
                  <a href="#fun-facts-golden-age" className="hover:text-heading transition-colors">
                    Fun Facts Golden Age
                  </a>
                </li>
                <li>
                  <a href="#alur-posyandu" className="hover:text-heading transition-colors">
                    5 Langkah Posyandu
                  </a>
                </li>
                <li>
                  <a href="#profil-lokasi" className="hover:text-heading transition-colors">
                    Profil & Lokasi Puskesmas
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 3: Media Sosial & Jam Layanan */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="text-sm font-bold text-heading">Jadwal & Media Sosial</h4>
              <ul className="space-y-2.5 text-sm text-caption">
                <li>
                  <p className="font-medium text-heading">Poli KIA & Gizi Puskesmas</p>
                  <p className="text-xs text-caption">Senin – Sabtu, 08.00 – 14.00 WITA</p>
                </li>
                <li>
                  <a
                    href={INSTAGRAM_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-heading transition-colors inline-flex items-center gap-1"
                  >
                    <span>Instagram: @uptd_puskesmas_airmadidi</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>
                  <a
                    href={FACEBOOK_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-heading transition-colors inline-flex items-center gap-1"
                  >
                    <span>Facebook: Puskesmas Airmadidi</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 4: Contact Person, Email & Location */}
            <div className="lg:col-span-3 space-y-3">
              <h4 className="text-sm font-bold text-heading">Hubungi Kami</h4>
              <ul className="space-y-2.5 text-sm text-caption">
                <li className="flex items-start gap-2.5">
                  <Phone className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-heading">Contact Person (Layanan KIA)</p>
                    <p className="text-xs text-caption">0813-4076-0004</p>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <Mail className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-heading">Email</p>
                    <a
                      href="mailto:pkmairmadidi@gmail.com"
                      className="text-xs text-caption hover:text-heading transition-colors"
                    >
                      pkmairmadidi@gmail.com
                    </a>
                  </div>
                </li>
                <li className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <a
                    href={GOOGLE_MAPS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-caption hover:text-heading leading-relaxed transition-colors"
                  >
                    Kompleks Pasar Airmadidi, Kel. Sarongsong I, Kec. Airmadidi, Minahasa Utara 95371
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar: Copyright & All Rights Reserved */}
          <div className="pt-6 border-t border-line flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-caption">
            <p>
              &copy; {new Date().getFullYear()} UPTD Puskesmas Airmadidi & Posyandu Kecamatan Airmadidi. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <a
                href={GOOGLE_MAPS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-heading transition-colors"
              >
                Google Maps
              </a>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-heading transition-colors"
              >
                Instagram
              </a>
              <Link
                to={dashboardPath}
                className="font-semibold text-heading hover:text-sky-600 dark:hover:text-sky-400 transition-colors inline-flex items-center gap-1"
              >
                <span>{user ? "Dashboard Petugas" : "Portal Petugas"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* ═══ Clean Neutral Detail Modal Pop-up ═══ */}
      {selectedModal && (
        <div
          className="fixed inset-0 z-50 bg-overlay backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedModal(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="landing-modal-title"
        >
          <div className="bg-card border border-line rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-prominent overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-line flex items-start justify-between gap-4">
              <div className="space-y-1">
                <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-medium bg-subtle text-caption border border-line">
                  {selectedModal.badge}
                </span>
                <h3 id="landing-modal-title" className="text-lg sm:text-xl font-bold text-heading">
                  {selectedModal.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedModal(null)}
                aria-label="Tutup jendela detail"
                className="p-2 text-dim hover:text-heading hover:bg-subtle rounded-xl transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4">
              {selectedModal.type === "phase" && (
                <>
                  <div className="space-y-3">
                    {selectedModal.points.map((pt, idx) => (
                      <div key={idx} className="p-4 bg-subtle rounded-xl border border-line space-y-1.5">
                        <p className="text-sm font-bold text-heading flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0" />
                          <span>{pt.label}</span>
                        </p>
                        <p className="text-sm text-body leading-relaxed pl-6">{pt.text}</p>
                      </div>
                    ))}
                  </div>

                  {selectedModal.dangerSigns && (
                    <div className="p-4 bg-subtle border border-line rounded-xl space-y-2">
                      <p className="text-sm font-bold text-heading flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>Tanda Bahaya (Segera Periksa ke UPTD Puskesmas Airmadidi):</span>
                      </p>
                      <ul className="text-sm text-body space-y-1.5 pl-6 list-disc">
                        {selectedModal.dangerSigns.map((ds, dIdx) => (
                          <li key={dIdx} className="leading-relaxed">
                            {ds}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {selectedModal.type === "nutrition" && (
                <div className="space-y-3">
                  {selectedModal.details.map((item, idx) => (
                    <div key={idx} className="p-4 bg-subtle rounded-xl border border-line space-y-1.5">
                      <h4 className="text-sm font-bold text-heading">{item.subtitle}</h4>
                      <p className="text-sm text-body leading-relaxed whitespace-pre-line">{item.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {selectedModal.type === "step" && (
                <div className="p-4 bg-subtle rounded-xl border border-line">
                  <p className="text-sm sm:text-base text-body leading-relaxed">{selectedModal.content}</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-line bg-subtle flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedModal(null)}
                className="px-4 py-2 bg-card hover:bg-muted text-heading border border-line rounded-xl text-sm font-semibold cursor-pointer transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
