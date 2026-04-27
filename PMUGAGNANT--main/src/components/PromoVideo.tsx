"use client";

import { useRef, useState } from "react";

export default function PromoVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleSound = () => {
    const nextMuted = !muted;

    if (videoRef.current) {
      videoRef.current.muted = nextMuted;
    }

    setMuted(nextMuted);
  };

  return (
    <div className="my-8 flex flex-col items-center px-4">
      <div className="relative w-full max-w-[400px]">
        <video
          ref={videoRef}
          src="/videos/turfedge-pub.mp4"
          poster="/videos/turfedge-pub-poster.jpg"
          autoPlay
          muted={muted}
          loop
          playsInline
          className="w-full rounded-2xl"
          style={{
            boxShadow: "0 0 24px rgba(26, 74, 46, 0.6)",
          }}
        />
        <button
          type="button"
          onClick={toggleSound}
          className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur-sm"
        >
          {muted ? "Activer le son" : "Couper le son"}
        </button>
      </div>
      <p className="mt-3 text-center text-sm opacity-60">
        PMU Gagnant - pronostics mesures, bankroll protegee
      </p>
    </div>
  );
}
