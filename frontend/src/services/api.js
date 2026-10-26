import axios from 'axios';

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor untuk menyisipkan Bearer Token JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor response untuk menangani 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user_data');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const getErrorMessage = (err, fallback = 'Terjadi kesalahan pada sistem.') => {
  if (!err?.response?.data) {
    return err?.message || fallback;
  }
  const detail = err.response.data.detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        const field = item.loc ? item.loc[item.loc.length - 1] : '';
        return field ? `Kolom '${field}': ${item.msg}` : item.msg;
      })
      .join(' | ');
  }
  return fallback;
};

/**
 * Unduh dokumen PDF laporan (WeasyPrint) dengan token JWT.
 * Backend otomatis me-render ulang PDF jika file lama belum tersedia.
 */
export const downloadReportPdf = async (reportId, patientName, visitDate) => {
  try {
    const res = await api.get(`/reports/${reportId}/download-pdf`, {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeName = String(patientName || 'Pasien').replace(/\s+/g, '_');
    link.href = url;
    link.download = `Laporan_KIA_${safeName}_${visitDate || reportId}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(url), 1000);
  } catch (err) {
    let message = 'Gagal mengunduh dokumen PDF laporan.';
    const data = err?.response?.data;
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text());
        if (parsed?.detail) message = parsed.detail;
      } catch {
        /* abaikan: respons bukan JSON */
      }
    } else {
      message = getErrorMessage(err, message);
    }
    alert(message);
  }
};

export default api;
