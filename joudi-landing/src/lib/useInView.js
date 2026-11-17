import { useEffect, useState } from "react";

// هل العنصر قريب من الشاشة؟ (لتشغيل/إيقاف المشاهد ثلاثية الأبعاد)
export default function useInView(ref, margin = "200px") {
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setV(e.isIntersecting), { rootMargin: margin });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return v;
}
