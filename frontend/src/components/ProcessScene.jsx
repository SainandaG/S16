import { useEffect, useRef } from "react";
import { createStage, updateProcess } from "../three/villaScene.js";

// Renders the villa build. `progressRef.current` (0..1) is written by the page's ScrollTrigger.
export default function ProcessScene({ progressRef }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const st = createStage(canvasRef.current, wrapRef.current, false);
    // a fixed preview point (?p=…) starts already in that state instead of easing in
    const preview = new URLSearchParams(window.location.search).get("p");
    let cur = preview !== null && !Number.isNaN(Number(preview)) ? Math.min(1, Math.max(0, Number(preview))) : 0;
    let visible = true;
    let raf = 0;

    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    io.observe(wrapRef.current);

    const onResize = () => st.resize();
    window.addEventListener("resize", onResize);
    st.resize();

    const loop = () => {
      cur += (progressRef.current - cur) * 0.25; // ease toward the scroll position
      if (visible) {
        updateProcess(st, cur);
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
  }, [progressRef]);

  return (
    <div ref={wrapRef} className="stage-wrap">
      <canvas ref={canvasRef} className="webgl" />
    </div>
  );
}
