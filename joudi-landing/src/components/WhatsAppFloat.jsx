import { motion } from "framer-motion";
import { waLink } from "../config";
import { WhatsAppIcon } from "./Icons";

export default function WhatsAppFloat({ show }) {
  return (
    <motion.a
      href={waLink()}
      target="_blank"
      rel="noopener"
      aria-label="اطلبي عبر واتساب"
      initial={{ opacity: 0, scale: 0.6, y: 30 }}
      animate={show ? { opacity: 1, scale: 1, y: 0 } : {}}
      transition={{ duration: 1.2, delay: 2.4, ease: [0.19, 1, 0.22, 1] }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.94 }}
      className="group fixed bottom-5 left-5 z-[90] grid h-[3.6rem] w-[3.6rem] place-items-center rounded-full text-wine-3 sm:bottom-7 sm:left-7"
      style={{ background: "linear-gradient(135deg,#F2E3C4,#C9A36A 55%,#9C7A45)", boxShadow: "0 12px 30px -8px rgba(156,122,69,.8), inset 0 1px 0 rgba(255,255,255,.6)" }}
      data-cursor="hover"
    >
      <span className="absolute inset-0 rounded-full border border-gold" style={{ animation: "wa-pulse 5s ease-out infinite" }} />
      <span className="absolute inset-0 rounded-full border border-gold-light" style={{ animation: "wa-pulse 5s ease-out 0.35s infinite" }} />
      <WhatsAppIcon width="28" height="28" />
      <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-full bg-wine px-4 py-2 font-display text-sm text-gold-pale opacity-0 shadow-lg transition-all duration-500 ease-lux group-hover:translate-x-1 group-hover:opacity-100">
        اطلبي عبر واتساب
      </span>
    </motion.a>
  );
}
