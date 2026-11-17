import { useLayoutEffect, useRef, useEffect, createElement } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "../lib/device";

// العنوان بيظهر كلمة كلمة (الحروف العربية بتضل موصولة ببعض)
export default function SplitText({ text, as = "h2", className = "", delay = 0, stagger = 0.075, play, start = "top 82%", duration = 1.4 }) {
  const ref = useRef(null);
  const tl = useRef(null);
  const lines = text.split("\n");

  useLayoutEffect(() => {
    const el = ref.current;
    const words = el.querySelectorAll(".split-word > span");
    if (reducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.set(words, { yPercent: 115, opacity: 0, filter: "blur(10px)", rotate: 2 });
      tl.current = gsap.timeline({ paused: true }).to(words, {
        yPercent: 0,
        opacity: 1,
        filter: "blur(0px)",
        rotate: 0,
        duration,
        ease: "expo.out",
        stagger,
        delay,
      });
      if (play === undefined) {
        ScrollTrigger.create({ trigger: el, start, once: true, onEnter: () => tl.current.play() });
      }
    }, el);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (play && tl.current) tl.current.play();
  }, [play]);

  let i = 0;
  return createElement(
    as,
    { ref, className, "aria-label": text.replace(/\n/g, " ") },
    lines.map((line, li) => (
      <span key={li} className="block" aria-hidden="true">
        {line.split(" ").map((w, wi, arr) => (
          <span key={wi} className="split-word" data-i={i++}>
            <span>{w}</span>
            {wi < arr.length - 1 ? " " : null}
          </span>
        ))}
      </span>
    ))
  );
}
