# API DRAMA CHINA

Aggregator API berbasis Next.js untuk menggabungkan data drama pendek dari banyak provider menjadi satu endpoint yang konsisten.

Project ini menyediakan:
- Home feed gabungan lintas provider
- Search lintas provider
- Resolusi detail episode lintas provider (dengan waterfall fallback)
- Endpoint watch streaming untuk DramaWave

## Tech Stack

- Next.js 16 (App Router)
- React 19
- Node.js runtime via Next API routes

## Menjalankan Project

1. Install dependency:

```bash
npm install
```

2. Jalankan mode development:

```bash
npm run dev
```

3. Buka:

```text
http://localhost:3000
```

Build production:

```bash
npm run build
npm run start
```

Lint:

```bash
npm run lint
```

## Daftar Endpoint

Base URL lokal:

```text
http://localhost:3000
```

### 1) GET /api/home

Mengambil kumpulan section home dari semua provider, lalu dedup berdasarkan internal id.

Contoh request:

```bash
curl "http://localhost:3000/api/home"
```

Contoh response ringkas:

```json
{
	"sections": [
		{
			"id": "melolo_latest",
			"title": "🆕 Melolo Terbaru",
			"type": "melolo",
			"items": [
				{
					"source": "melolo",
					"id": "12345",
					"title": "Contoh Judul",
					"cover": "https://..."
				}
			]
		}
	]
}
```

Jika error:
- Status `500`
- Format: `{ "sections": [], "error": "..." }`

Skema field response:

| Field | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| sections | `array<object>` | Ya | Kumpulan section home lintas provider |
| sections[].id | `string` | Ya | ID section |
| sections[].title | `string` | Ya | Judul section |
| sections[].type | `string` | Ya | Tipe/category section |
| sections[].items | `array<object>` | Ya | Daftar item drama pada section |
| sections[].items[].source | `string` | Ya | Sumber provider (`melolo`, `dramabox`, dll) |
| sections[].items[].id | `string \| number` | Ya | ID drama dari provider |
| sections[].items[].title | `string` | Ya | Judul drama |
| sections[].items[].cover | `string \| null` | Opsional | URL cover/poster |
| sections[].items[].tags | `array<string>` | Opsional | Tag/genre |
| sections[].items[].episodes | `number` | Opsional | Total episode ringkas di card |
| sections[].items[].description | `string` | Opsional | Deskripsi singkat |
| sections[].items[].vip | `boolean` | Opsional | Indikasi konten premium/locked |
| error | `string` | Hanya saat gagal | Pesan error |

### 2) GET /api/search?q=<query>

Melakukan pencarian paralel ke semua provider dan menggabungkan hasil unik.

Contoh request:

```bash
curl "http://localhost:3000/api/search?q=love"
```

Contoh response ringkas:

```json
{
	"query": "love",
	"total": 2,
	"results": [
		{
			"source": "dramabox",
			"id": 1001,
			"title": "Contoh Drama",
			"cover": "https://..."
		}
	],
	"sourceFailed": {
		"dramabox": false,
		"netshort": false,
		"melolo": false,
		"flickreels": false,
		"dramawave": false,
		"reelshort": false,
		"goodshort": false,
		"shortmax": false
	}
}
```

Validasi:
- `q` wajib diisi
- Jika tidak ada `q`, status `400`

Skema field response:

| Field | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| query | `string` | Ya | Kata kunci yang dicari |
| total | `number` | Ya | Jumlah hasil final setelah dedup |
| results | `array<object>` | Ya | Hasil gabungan semua provider |
| results[].source | `string` | Ya | Provider asal hasil |
| results[].id | `string \| number` | Ya | ID drama di provider asal |
| results[].title | `string` | Ya | Judul drama |
| results[].cover | `string \| null` | Opsional | URL cover |
| results[].description | `string \| null` | Opsional | Sinopsis/deskripsi |
| results[].tags | `array<string>` | Opsional | Tag/genre |
| results[].episodes | `number` | Opsional | Total episode (jika disediakan provider) |
| sourceFailed | `object` | Ya | Flag provider yang gagal di-fetch |
| sourceFailed.<provider> | `boolean` | Ya | `true` jika provider gagal |
| error | `string` | Hanya saat gagal | Pesan error |

### 3) GET /api/episode?id=<id>&source=<source>

Mengambil data episode dari provider tertentu, atau fallback waterfall jika `source` tidak diberikan.

Contoh request dengan source:

```bash
curl "http://localhost:3000/api/episode?id=12345&source=melolo"
```

Contoh request tanpa source (waterfall):

```bash
curl "http://localhost:3000/api/episode?id=12345"
```

Urutan fallback saat `source` tidak diisi:

1. melolo
2. netshort
3. flickreels
4. dramawave
5. reelshort
6. goodshort
7. freereels
8. dramanova
9. shortmax
10. dramabox

Validasi:
- `id` wajib diisi
- Jika `id` kosong, status `400`
- Jika tidak ditemukan, status `404`

Skema field response:

| Field | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| source | `string` | Ya | Provider yang berhasil resolve episode |
| id | `string \| number` | Ya | ID series/drama |
| title | `string \| null` | Opsional | Judul series |
| cover | `string \| null` | Opsional | URL cover series |
| description | `string \| null` | Opsional | Sinopsis series |
| totalEpisode | `number` | Ya | Total episode pada response |
| episodes | `array<object>` | Ya | Daftar episode |
| episodes[].id | `string \| number` | Ya | ID episode |
| episodes[].episode | `number` | Ya | Nomor episode |
| episodes[].title | `string` | Ya | Judul episode |
| episodes[].thumbnail | `string \| null` | Opsional | Thumbnail episode |
| episodes[].vip | `boolean` | Ya | Status lock/vip episode |
| episodes[].subtitle | `array<object>` | Ya | Daftar subtitle (bisa kosong) |
| episodes[].subtitle[].lang | `string` | Opsional | Kode bahasa subtitle |
| episodes[].subtitle[].url | `string` | Opsional | URL file subtitle |
| episodes[].videos | `array<object>` | Ya | Daftar stream URL per kualitas |
| episodes[].videos[].quality | `string \| number` | Ya | Label kualitas (`auto`, `720p`, dll) |
| episodes[].videos[].url | `string` | Ya | URL stream video |
| episodes[].videos[].vip | `boolean` | Ya | Status lock URL tersebut |
| error | `string` | Hanya saat gagal | Pesan error |

Catatan integrasi:
- Ada field tambahan provider-spesifik yang bisa muncul (misal `tags`, `viewCount`, `followCount`, `codec`, `bitrate`).
- Frontend/mobile sebaiknya treat field di luar tabel sebagai optional extension.

### 4) GET /api/watch?id=<id>&ep=<ep>

Mengambil data watch/stream episode dari DramaWave.

Contoh request:

```bash
curl "http://localhost:3000/api/watch?id=12345&ep=1"
```

Validasi:
- `id` dan `ep` wajib diisi
- Jika kosong, status `400`
- Jika upstream gagal, status `502`

Skema field response:

| Field | Tipe | Wajib | Keterangan |
| --- | --- | --- | --- |
| `<dynamic>` | `object` | Ya | Payload passthrough dari API watch DramaWave |
| error | `string` | Hanya saat gagal | Pesan error route (`id dan ep wajib diisi` atau `gagal ambil watch`) |

Catatan integrasi:
- Endpoint ini me-return response mentah dari upstream DramaWave.
- Untuk kestabilan client, gunakan defensive parsing (null-safe) karena field upstream bisa berubah.

## Error Contract (Umum)

| Endpoint | Status | Body |
| --- | --- | --- |
| `/api/home` | `500` | `{ "sections": [], "error": "..." }` |
| `/api/search` | `400` | `{ "error": "query (q) wajib diisi" }` |
| `/api/search` | `500` | `{ "error": "...", "results": [], "sourceFailed": { ... } }` |
| `/api/episode` | `400` | `{ "error": "id wajib diisi" }` |
| `/api/episode` | `404` | `{ "error": "..." }` |
| `/api/watch` | `400` | `{ "error": "id dan ep wajib diisi" }` |
| `/api/watch` | `502` | `{ "error": "gagal ambil watch" }` |

## Provider Yang Digabungkan

Provider aktif dalam project:
- dramabox
- netshort
- melolo
- flickreels
- dramawave
- reelshort
- goodshort
- freereels
- dramanova
- shortmax

Catatan:
- Tidak semua endpoint memakai semua provider.
- `sourceFailed` di endpoint search membantu mendeteksi provider mana yang sedang gagal.

## Struktur Folder Penting

```text
app/
	api/
		home/route.js       # endpoint home aggregator
		search/route.js     # endpoint search aggregator
		episode/route.js    # endpoint episode resolver + waterfall
		watch/route.js      # endpoint watch dramawave
lib/
	providers/            # adapter + normalizer per provider
	safeFetch.js          # fetch aman: timeout, retry, safe parse JSON
	headers.js            # shared header antar provider
```

## Catatan Implementasi

- Semua request ke upstream menggunakan `cache: "no-store"` untuk data realtime.
- Utility `safeFetch` menangani timeout, retry, validasi response, dan parsing JSON aman.
- Deduplikasi item dilakukan lewat key internal per source agar hasil gabungan tidak duplikat.

## Disclaimer

Project ini adalah aggregator API untuk keperluan pengembangan/integrasi. Ketersediaan data bergantung pada provider upstream masing-masing.
