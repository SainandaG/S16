import { useEffect, useRef } from "react";
import { createStage, updateTurnkey } from "../three/villaScene.js";

// Key-turn reveal. `progressRef.current` (0..1) is written by the page's ScrollTrigger.
// `textRef` is the overlay text element, faded in by the page.
export default function TurnkeyScene({ progressRef, textRef }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const st = createStage(canvasRef.current, wrapRef.current, true);
    let cur = 0;
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
        updateTurnkey(st, cur);

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
    </div>
  );
}
