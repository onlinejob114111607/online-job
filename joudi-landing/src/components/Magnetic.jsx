import { useRef } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { finePointer, reducedMotion } from "../lib/device";

// زر مغناطيسي: بينجذب للماوس بنعومة
export default function Magnetic({ children, className = "", strength = 0.32, href, onClick, target, style, ...rest }) {
  const ref = useRef(null);
  const cfg = { stiffness: 160, damping: 16, mass: 0.5 };
  const x = useSpring(0, cfg);
  const y = useSpring(0, cfg);
  const ix = useTransform(x, (v) => v * 0.45);
  const iy = useTransform(y, (v) => v * 0.45);
  const active = finePointer && !reducedMotion;

  const move = (e) => {
    if (!active) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const leave = () => {
    x.set(0);
    y.set(0);
  };
  const ext = href && /^https?:/.test(href);

  return (
    <motion.a
      ref={ref}
      href={href}
      onClick={onClick}
      target={target ?? (ext ? "_blank" : undefined)}
      rel={ext ? "noopener" : undefined}
      onPointerMove={move}
      onPointerLeave={leave}
      whileTap={{ scale: 0.96 }}
      style={{ ...style, x, y }}
      className={className}
      data-cursor="hover"
      {...rest}
    >
      <motion.span style={{ x: ix, y: iy }} className="relative z-[1] inline-flex items-center gap-3">
        {children}
      </motion.span>
    </motion.a>
  );
}
