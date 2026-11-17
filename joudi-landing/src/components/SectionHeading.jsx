import SplitText from "./SplitText";
import Reveal from "./Reveal";

export default function SectionHeading({ eyebrow, title, sub, dark = false, align = "center", id }) {
  const a = align === "center" ? "text-center items-center" : "text-right items-start";
  return (
    <div className={`flex flex-col ${a}`}>
      <Reveal as="p" className={`eyebrow mb-4 ${dark ? "text-gold" : "text-gold-deep"}`} y={20}>
        {eyebrow}
      </Reveal>
      <SplitText as="h2" text={title} className={`h-display text-[2.15rem] sm:text-5xl lg:text-6xl ${dark ? "text-ivory" : "text-wine"}`} />
      <Reveal y={20} delay={0.2} className={`hairline mt-6 w-32 ${align === "center" ? "mx-auto" : ""}`} />
      {sub && (
        <Reveal as="p" delay={0.25} className={`mt-6 max-w-xl text-base leading-8 sm:text-lg ${dark ? "text-ivory/70" : "text-ink/70"}`}>
          {sub}
        </Reveal>
      )}
    </div>
  );
}
