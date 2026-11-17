import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { reducedMotion } from "../lib/device";

// دخول ناعم: fade + blur + slide، أو mask reveal للصور
export default function Reveal({ children, as: Tag = "div", variant = "fade", delay = 0, y = 48, className = "", start = "top 86%", stagger = 0, ...rest }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    const targets = stagger ? el.children : el;
    const ctx = gsap.context(() => {
      if (variant === "mask") {
        gsap.fromTo(
          targets,
          { clipPath: "inset(100% 0% 0% 0%)", scale: 1.12 },
          { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 1.8, ease: "expo.out", delay, stagger, scrollTrigger: { trigger: el, start, once: true } }
        );
      } else {
        gsap.fromTo(
          targets,
          { opacity: 0, y, filter: "blur(12px)" },
          { opacity: 1, y: 0, filter: "blur(0px)", duration: 1.5, ease: "power3.out", delay, stagger, scrollTrigger: { trigger: el, start, once: true }, clearProps: "filter" }
        );
      }
    }, el);
    return () => ctx.revert();
  }, []);
  return (
    <Tag ref={ref} className={className} {...rest}>
      {children}
    </Tag>
  );
}
