import { useEffect, useRef, useState } from "react";
import { createStage, updateTurnkey } from "../three/villaScene.js";

// Plays a short two-part click using the Web Audio API.
function makeClicker() {
  let ctx = null;
  let on = false;
  return {
    toggle() {
      try {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === "suspended") ctx.resume();
      } catch {
        return false; // audio unsupported
      }
      on = !on;
      return on;
    },
    play() {
      if (!on || !ctx || ctx.state !== "running") return;
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * 0.05);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.1));
      const src = ctx.createBufferSource();
      const g1 = ctx.createGain();
      g1.gain.value = 0.4;
      src.buffer = buf;
      src.connect(g1).connect(ctx.destination);
      src.start(t);
      const osc = ctx.createOscillator();
      const g2 = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 1800;
      g2.gain.setValueAtTime(0.12, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.connect(g2).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.13);
    },
  };
}

// Key-turn reveal. `progressRef.current` (0..1) is written by the page's ScrollTrigger.
// `textRef` is the overlay text element, faded in by the page.
export default function TurnkeyScene({ progressRef, textRef }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const clicker = useRef(makeClicker());
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    const st = createStage(canvasRef.current, wrapRef.current, true);
    let cur = 0;
    let clicked = false;
    let visible = true;
    let raf = 0;

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(wrapRef.current);

    const onResize = () => st.resize();
    window.addEventListener("resize", onResize);
    st.resize();

    const loop = () => {
      cur += (progressRef.current - cur) * 0.3;
      if (visible) {
        const turned = updateTurnkey(st, cur);
        if (turned && !clicked) { clicked = true; clicker.current.play(); }
        if (cur < 0.28) clicked = false;

        const t = Math.min(1, Math.max(0, (cur - 0.6) / 0.2));
        const eased = t * t * (3 - 2 * t);
        if (textRef.current) {
          textRef.current.style.opacity = eased;
          textRef.current.style.transform = `translateY(${30 * (1 - eased)}px)`;
        }
        st.renderer.render(st.scene, st.camera);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", onResize);
      st.dispose();
    };
  }, [progressRef, textRef]);

  return (
    <div ref={wrapRef} className="turnkey-stage">
      <canvas ref={canvasRef} className="webgl" />
      <button
        className="sound-btn"
        onClick={() => setSoundOn(clicker.current.toggle())}
        aria-pressed={soundOn}
      >
        Sound: {soundOn ? "On" : "Off"}
      </button>
    </div>
  );
}
