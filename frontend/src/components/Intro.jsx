import { useEffect, useMemo, useState } from "react";
import { reduceMotion } from "../lib/motion.js";

const SEEN_KEY = "s16-intro-seen";
const CELL = 6; // grid size (logo pixels) between brick positions: smaller = finer detail
const SCALE = 0.95; // how large the logo is drawn in the intro
const TIMES = { assemble: 150, reveal: 2300, leave: 3300, done: 3900 };

function wasSeen() {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

// Reads the logo image and returns the centre of every grid cell that is filled.
// Those cell centres are where the bricks settle, so the bricks form the logo itself.
function logoBrickPositions(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      const pts = [];
      for (let y = CELL / 2; y < c.height; y += CELL) {
        for (let x = CELL / 2; x < c.width; x += CELL) {
          const alpha = data[(Math.floor(y) * c.width + Math.floor(x)) * 4 + 3];
          if (alpha > 140) pts.push({ x: (x - c.width / 2) * SCALE, y: (y - c.height / 2) * SCALE });
        }
      }
      resolve(pts);
    };
    img.onerror = () => resolve([]);
    img.src = src;
  });
}

// Opening animation: bricks fly in from around the screen and gather into the S16 logo, then the logo is shown.
// Plays once per browser session, lasts about four seconds, and any click skips it.
export default function Intro() {
  const [show, setShow] = useState(() => !reduceMotion && !wasSeen());
  const [phase, setPhase] = useState(0); // 0 scattered, 1 assembling, 2 logo shown, 3 leaving
  const [targets, setTargets] = useState(null);

  useEffect(() => {
    if (!show) return undefined;
    let alive = true;
    logoBrickPositions("/logo.png").then((pts) => {
      if (alive) setTargets(pts);
    });
    return () => {
      alive = false;
    };
  }, [show]);

  const bricks = useMemo(() => {
    if (!targets || targets.length === 0) return [];
    const w = typeof window !== "undefined" ? window.innerWidth : 1200;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    const bw = CELL * SCALE * 0.96;
    const bh = CELL * SCALE * 0.7;
    const ys = targets.map((t) => t.y);
    const top = Math.min(...ys);
    const span = Math.max(...ys) - top || 1;
    return targets.map((t) => ({
      tx: t.x,
      ty: t.y,
      sx: (Math.random() - 0.5) * w * 0.9,
      sy: -(Math.random() * h * 0.5 + h * 0.2),
      sr: (Math.random() - 0.5) * 240,
      // bricks land from the roofline down, so the logo visibly builds up
      d: `${Math.round(((t.y - top) / span) * 800 + Math.random() * 60)}ms`,
      bw,
      bh,
    }));
  }, [targets]);

  const finish = () => {
    setShow(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* storage blocked: the intro may show again on the next visit */
    }
  };

  useEffect(() => {
    if (!show) return undefined;
    const timers = [
      setTimeout(() => setPhase(1), TIMES.assemble),
      setTimeout(() => setPhase(2), TIMES.reveal),
      setTimeout(() => setPhase(3), TIMES.leave),
      setTimeout(finish, TIMES.done),
    ];
    return () => timers.forEach(clearTimeout);
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!show) return null;

  const cls = ["bi", phase >= 1 && "assemble", phase >= 2 && "reveal", phase >= 3 && "leave"].filter(Boolean).join(" ");

  return (
    <div className={cls} onClick={finish} role="presentation" aria-hidden="true">
      <div className="bi-stage">
        {bricks.map((b, i) => (
          <span
            key={i}
            className="brick"
            style={{
              "--tx": `${b.tx}px`,
              "--ty": `${b.ty}px`,
              "--sx": `${b.sx}px`,
              "--sy": `${b.sy}px`,
              "--sr": `${b.sr}deg`,
              "--d": b.d,
              "--bw": `${b.bw}px`,
              "--bh": `${b.bh}px`,
            }}
          />
        ))}
        <img src="/logo.png" alt="" className="bi-logo" />
      </div>
    </div>
  );
}
