import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export const reduceMotion =
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Shared Lenis instance so route changes can jump back to the top.
export const lenisRef = { current: null };

// Starts Lenis smooth scrolling and keeps it in sync with ScrollTrigger.
// Returns a cleanup function.
export function startSmoothScroll() {
  const lenis = new Lenis({
    duration: 0.7,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
  });
  lenisRef.current = lenis;
  lenis.on("scroll", ScrollTrigger.update);
  const tick = (time) => lenis.raf(time * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  return () => {
    gsap.ticker.remove(tick);
    lenis.destroy();
    lenisRef.current = null;
  };
}

export function jumpToTop() {
  if (lenisRef.current) lenisRef.current.scrollTo(0, { immediate: true });
  else window.scrollTo(0, 0);
}

// Wraps each word of an element in a mask so the words can slide up on reveal.
export function splitWords(el) {
  if (!el || el.dataset.split === "done") return [];
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="wrap"><span class="word">${w}</span></span>`).join(" ");
  el.dataset.split = "done";
  return el.querySelectorAll(".word");
}

// Call inside gsap.context(…, scope) so every ScrollTrigger is removed on unmount.
export function revealIn(root) {
  if (!root) return;
  root.querySelectorAll("[data-split]").forEach((el) => {
    const words = splitWords(el);
    // headings already on screen are shown straight away
    if (reduceMotion || !words.length || el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    gsap.from(words, {
      yPercent: 110, duration: 1.2, ease: "expo.out", stagger: 0.07,
      scrollTrigger: { trigger: el, start: "top 85%" },
    });
  });
  if (reduceMotion) return;
  root.querySelectorAll("[data-reveal]").forEach((el) => {
    // content already on screen is shown straight away; only content below the fold waits for scrolling
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
    gsap.from(el, {
      opacity: 0, y: 40, duration: 1.3, ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });
  root.querySelectorAll("[data-parallax] img").forEach((img) => {
    gsap.fromTo(img, { yPercent: -10 }, {
      yPercent: 0, ease: "none",
      scrollTrigger: { trigger: img.parentElement, start: "top bottom", end: "bottom top", scrub: true },
    });
  });
}

export { gsap, ScrollTrigger };
