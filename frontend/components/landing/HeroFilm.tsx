"use client";
// Landing hero: a seamless 10 s Blender loop (tools/blender/aegis_scene.py) of AEGIS-1 over Earth,
// with a PulseBrief packet crossing the link. NASA ISS model + NASA Blue/Black Marble imagery.
// Reduced motion: the poster frame only. Small screens get the 720p file.
import { useEffect, useRef, useState } from "react";
import { BASE_PATH } from "@/lib/config";

const src = (f: string) => `${BASE_PATH}/media/${f}`;

export function HeroFilm() {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setStill(mq.matches);
      if (mq.matches) ref.current?.pause();
      else ref.current?.play().catch(() => {});
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return (
    <video
      ref={ref}
      className="absolute inset-0 h-full w-full object-cover object-[50%_70%]"
      poster={src("hero-poster.jpg")}
      autoPlay={!still}
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden
    >
      <source src={src("hero-1080.webm")} type="video/webm" media="(min-width: 900px)" />
      <source src={src("hero-1080.mp4")} type="video/mp4" media="(min-width: 900px)" />
      <source src={src("hero-720.mp4")} type="video/mp4" />
    </video>
  );
}
