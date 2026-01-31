"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Hls from "hls.js";

function toSrcLang(lang) {
  if (!lang) return "id";
  // dramawave pakai "id-ID" / "en-US"
  // ambil bagian depannya
  return String(lang).split("-")[0].split("_")[0] || "id";
}

export default function Player({ episodes = [] }) {
  const [index, setIndex] = useState(0);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // jaga2 kalau episodes berubah dan index out of range
  useEffect(() => {
    if (!Array.isArray(episodes) || episodes.length === 0) return;
    setIndex((i) => Math.min(i, episodes.length - 1));
  }, [episodes]);

  const current = episodes?.[index];
  const src = current?.videos?.[0]?.url || "";
  const subtitles = useMemo(() => current?.subtitle || [], [current]);

  const handleEnded = () => {
    setIndex((i) => (i < episodes.length - 1 ? i + 1 : i));
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    // destroy HLS lama
    if (hlsRef.current) {
      try {
        hlsRef.current.destroy();
      } catch {}
      hlsRef.current = null;
    }

    // reset video src
    video.pause();
    video.removeAttribute("src");
    video.load();

    // HLS
    if (src.includes(".m3u8") && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        // kalau mau lebih stabil di mobile:
        // lowLatencyMode: true,
      });
      hls.loadSource(src);
      hls.attachMedia(video);
      hlsRef.current = hls;
    } else {
      video.src = src;
    }

    // iOS Safari native HLS:
    // kalau browser support native m3u8, video.src di atas sudah cukup

    video.play().catch(() => {});
  }, [index, src]);

  // penting: cleanup saat unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) {
        try {
          hlsRef.current.destroy();
        } catch {}
        hlsRef.current = null;
      }
    };
  }, []);

  if (!episodes?.length) {
    return (
      <div className="w-full text-white/70">
        Tidak ada episode.
      </div>
    );
  }

  const isVip = Boolean(current?.vip);

  return (
    <div className="w-full">
      {/* VIDEO */}
      <div className="aspect-video bg-black rounded-lg overflow-hidden shadow-lg mb-4 relative">
        <video
          key={current?.id ?? index}
          ref={videoRef}
          controls
          playsInline
          className="w-full h-full"
          onEnded={handleEnded}
        >
          {subtitles.map((sub, i) => (
            <track
              key={`${sub.lang || "sub"}_${i}_${sub.url || ""}`}
              kind="subtitles"
              src={`/api/subtitle?url=${encodeURIComponent(sub.url)}`}
              srcLang={toSrcLang(sub.lang)}
              label={sub.name || sub.lang || `Subtitle ${i + 1}`}
              default={i === 0}
            />
          ))}
        </video>

        {isVip && (
          <div className="absolute inset-0 pointer-events-none flex items-end justify-end p-3">
            <span className="text-xs bg-white/15 text-white px-2 py-1 rounded">
              VIP
            </span>
          </div>
        )}
      </div>

      {/* CONTROLS */}
      <div className="flex items-center justify-between mb-5 text-sm">
        <button
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          className="px-4 py-2 rounded bg-white/10 text-white
                     hover:bg-white/20 disabled:opacity-40"
        >
          ⬅ Prev
        </button>

        <span className="text-white/70">
          Episode {current?.episode ?? index + 1} / {episodes.length}
        </span>

        <button
          onClick={() => setIndex((i) => Math.min(episodes.length - 1, i + 1))}
          disabled={index === episodes.length - 1}
          className="px-4 py-2 rounded bg-white/10 text-white
                     hover:bg-white/20 disabled:opacity-40"
        >
          Next ➡
        </button>
      </div>

      {/* EPISODE LIST */}
      <div className="flex flex-wrap gap-2">
        {episodes.map((ep, i) => (
          <button
            key={ep.id ?? i}
            onClick={() => setIndex(i)}
            className={`px-3 py-1.5 text-xs rounded-full border transition
              ${
                i === index
                  ? "bg-white text-black border-white"
                  : "border-white/20 text-white/70 hover:bg-white/10"
              }`}
          >
            Ep {ep.episode ?? i + 1}
            {ep.vip ? " 🔒" : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
