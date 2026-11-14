// Small procedural textures (canvas), created once on the client.
import * as THREE from "three";

let glow: THREE.Texture | null = null;
let ring: THREE.Texture | null = null;
let solar: THREE.Texture | null = null;
let foil: THREE.Texture | null = null;

/** Soft radial glow for additive sprites. */
export function glowTexture() {
  if (glow) return glow;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.18, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.45, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glow = new THREE.CanvasTexture(c);
  return glow;
}

/** Thin ring, for station pulses and landing bursts. */
export function ringTexture() {
  if (ring) return ring;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 40, 64, 64, 62);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.9)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  ring = new THREE.CanvasTexture(c);
  return ring;
}

/** Photovoltaic blanket: deep blue cells, silver bus lines. */
export function solarTexture() {
  if (solar) return solar;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#0b1a3d";
  g.fillRect(0, 0, 512, 256);
  const cols = 16;
  const rows = 8;
  const cw = 512 / cols;
  const ch = 256 / rows;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const grad = g.createLinearGradient(i * cw, j * ch, (i + 1) * cw, (j + 1) * ch);
      const k = 0.85 + Math.random() * 0.15;
      grad.addColorStop(0, `rgb(${22 * k},${52 * k},${118 * k})`);
      grad.addColorStop(1, `rgb(${12 * k},${30 * k},${78 * k})`);
      g.fillStyle = grad;
      g.fillRect(i * cw + 1.5, j * ch + 1.5, cw - 3, ch - 3);
      g.strokeStyle = "rgba(160,190,230,0.18)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(i * cw + cw / 2, j * ch + 2);
      g.lineTo(i * cw + cw / 2, (j + 1) * ch - 2);
      g.stroke();
    }
  }
  g.strokeStyle = "rgba(200,210,225,0.55)";
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, 509, 253);
  solar = new THREE.CanvasTexture(c);
  solar.colorSpace = THREE.SRGBColorSpace;
  solar.anisotropy = 4;
  return solar;
}

/** Crinkled gold multi-layer insulation. */
export function foilTexture() {
  if (foil) return foil;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b8893a";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    const w = 10 + Math.random() * 40;
    const h = 4 + Math.random() * 18;
    const l = Math.random();
    g.fillStyle = l > 0.5 ? `rgba(255,224,150,${0.08 + l * 0.18})` : `rgba(80,50,10,${0.06 + l * 0.18})`;
    g.save();
    g.translate(x, y);
    g.rotate(Math.random() * Math.PI);
    g.fillRect(-w / 2, -h / 2, w, h);
    g.restore();
  }
  foil = new THREE.CanvasTexture(c);
  foil.colorSpace = THREE.SRGBColorSpace;
  foil.wrapS = foil.wrapT = THREE.RepeatWrapping;
  return foil;
}
