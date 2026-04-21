import styles from "./page.module.css";

export default function Home() {
  const baseUrl = "http://localhost:3000";
  const endpoints = [
    {
      id: "01",
      method: "GET",
      path: "/api/home",
      summary: "Ambil section home gabungan dari semua provider.",
      sample: `curl "${baseUrl}/api/home"`,
      tip: "Gunakan endpoint ini untuk populate homepage feed.",
    },
    {
      id: "02",
      method: "GET",
      path: "/api/search?q=kata_kunci",
      summary: "Cari drama lintas provider dengan dedup hasil.",
      sample: `curl "${baseUrl}/api/search?q=love"`,
      tip: "Periksa sourceFailed agar UI bisa tampilkan fallback status provider.",
    },
    {
      id: "03",
      method: "GET",
      path: "/api/episode?id=ID&source=PROVIDER",
      summary:
        "Ambil list episode per provider. Jika source kosong, sistem fallback otomatis.",
      sample: `curl "${baseUrl}/api/episode?id=12345&source=melolo"`,
      extraSample: `curl "${baseUrl}/api/episode?id=12345"`,
      tip: "Simpan source dari hasil search/home untuk request episode yang lebih cepat.",
    },
    {
      id: "04",
      method: "GET",
      path: "/api/watch?id=ID&ep=NO_EPISODE",
      summary: "Ambil payload stream/watch untuk episode tertentu.",
      sample: `curl "${baseUrl}/api/watch?id=12345&ep=1"`,
      tip: "Lakukan null-safe parsing karena response watch bersifat dinamis.",
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.backdrop} aria-hidden="true" />
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.kicker}>API DOCUMENTATION</p>
          <h1>API DRAMA CHINA</h1>
          <p className={styles.subtitle}>
            Dokumentasi praktis untuk integrasi frontend dan mobile client.
            Semua endpoint disusun agar cepat di-scan tim product dan engineer.
          </p>
          <div className={styles.baseUrlBox}>
            <span className={styles.baseUrlLabel}>Base URL</span>
            <code>{baseUrl}</code>
          </div>
        </section>

        <section className={styles.endpointGrid}>
          {endpoints.map((item) => (
            <article key={item.id} className={styles.card}>
              <div className={styles.cardHeader}>
                <span className={styles.index}>{item.id}</span>
                <span className={styles.method}>{item.method}</span>
              </div>
              <h2>{item.path}</h2>
              <p>{item.summary}</p>
              <pre>{item.sample}</pre>
              {item.extraSample ? <pre>{item.extraSample}</pre> : null}
              <p className={styles.tip}>{item.tip}</p>
            </article>
          ))}
        </section>

        <section className={styles.errorPanel}>
          <h3>Error Cepat</h3>
          <ul>
            <li>/api/search: 400 jika q kosong</li>
            <li>/api/episode: 400 jika id kosong, 404 jika tidak ditemukan</li>
            <li>/api/watch: 400 jika id/ep kosong, 502 jika upstream gagal</li>
          </ul>
          <p>
            Saran UX: tampilkan fallback state di client berdasarkan status code
            agar pengguna tetap paham kondisi data saat provider bermasalah.
          </p>
        </section>

        <section className={styles.footerNote}>
          <p>
            Lihat dokumentasi skema field lengkap di README untuk kontrak data
            yang lebih detail.
          </p>
        </section>
      </main>
    </div>
  );
}
