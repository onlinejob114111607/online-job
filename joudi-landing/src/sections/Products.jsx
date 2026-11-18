import SectionHeading from "../components/SectionHeading";
import Reveal from "../components/Reveal";
import Magnetic from "../components/Magnetic";
import { STORE_URL, productUrl } from "../config";
import { useCatalog } from "../lib/catalog";

// منتجات حقيقية من المتجر بشريطين متحركين باتجاهين — بيوقفوا لما تمرّ عليهم
const money = (n) => Number(n || 0).toLocaleString("en-US");

function Card({ p, cur }) {
  const old = p.oldPrice > p.price ? p.oldPrice : 0;
  const pct = old ? Math.round((1 - p.price / old) * 100) : 0;
  return (
    <a href={productUrl(p.id)} target="_blank" rel="noopener" className="prod-card group" data-cursor="view" data-cursor-label="اطلب">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.3rem] bg-wine-3">
        <img src={p.images[0]} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover transition-transform duration-[1.2s] ease-lux group-hover:scale-110" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-coal/85 via-transparent to-transparent" />
        {pct > 0 && <span className="absolute right-3 top-3 rounded-full bg-gold px-3 py-1 font-display text-xs font-bold text-wine-3">-{pct}%</span>}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="line-clamp-2 font-display text-[0.98rem] font-bold leading-7 text-ivory">{p.name}</h3>
          <div className="mt-1 flex items-baseline gap-2">
            <b className="text-gold-grad font-display text-xl">
              {money(p.price)} {cur}
            </b>
            {old > 0 && <s className="text-xs text-ivory/50">{money(old)}</s>}
          </div>
        </div>
      </div>
    </a>
  );
}

function Row({ list, cur, reverse, dur }) {
  if (!list.length) return null;
  return (
    <div className="marquee group/m">
      <div className={`marquee-track ${reverse ? "rev" : ""}`} style={{ animationDuration: `${dur}s` }}>
        {[...list, ...list].map((p, i) => (
          <Card key={p.id + "-" + i} p={p} cur={cur} />
        ))}
      </div>
    </div>
  );
}

export default function Products() {
  const data = useCatalog();
  const list = data?.products || [];
  if (data && !list.length) return null;
  const half = Math.ceil(list.length / 2);
  return (
    <section id="products" className="grain relative overflow-hidden bg-wine-3 py-24 text-ivory sm:py-32">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_20%_10%,rgba(245,179,1,.16),transparent_70%),radial-gradient(60%_60%_at_90%_90%,rgba(139,92,246,.35),transparent_70%)]" />
      <div className="container-lux relative">
        <SectionHeading dark eyebrow="NEW ARRIVALS" title="وصل حديثاً للمتجر" sub={data ? `${data.total}+ منتج بالمتجر… هاي عيّنة صغيرة، والأسعار والصور مباشرة من المتجر.` : "عم نجيب أحدث المنتجات…"} />
      </div>
      <Reveal className="relative mt-12 space-y-5 sm:mt-16">
        {data ? (
          <>
            <Row list={list.slice(0, half)} cur={data.currency} dur={Math.max(28, half * 6)} />
            <Row list={list.slice(half)} cur={data.currency} reverse dur={Math.max(32, (list.length - half) * 7)} />
          </>
        ) : (
          <div className="flex gap-5 overflow-hidden px-5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="prod-card aspect-[4/5] animate-pulse rounded-[1.3rem] bg-white/5" />
            ))}
          </div>
        )}
      </Reveal>
      <div className="relative mt-14 flex justify-center">
        <Magnetic href={STORE_URL} className="btn-gold">
          شوف كل المنتجات
        </Magnetic>
      </div>
    </section>
  );
}
