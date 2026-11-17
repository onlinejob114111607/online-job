import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "./device";
import { scroll } from "./store";

gsap.registerPlugin(ScrollTrigger);
gsap.defaults({ ease: "power3.out", duration: 1.2 });

export let lenis = null;

export function initSmoothScroll() {
  if (reducedMotion) return null;
  lenis = new Lenis({
    duration: 1.25,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // expo.out
    smoothWheel: true,
    wheelMultiplier: 0.9,
    touchMultiplier: 1.4,
  });
  lenis.on("scroll", (e) => {
    scroll.velocity = e.velocity || 0;
    ScrollTrigger.update();
  });
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop(); // بيشتغل بعد شاشة التحميل
  return lenis;
}

export function scrollToEl(target) {
  if (lenis) lenis.scrollTo(target, { duration: 2, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else document.querySelector(target)?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
}
