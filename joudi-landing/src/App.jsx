import { useEffect, useState } from "react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Preloader from "./components/Preloader";
import Cursor from "./components/Cursor";
import Nav from "./components/Nav";
import WhatsAppFloat from "./components/WhatsAppFloat";
import HeroSequence from "./sections/HeroSequence";
import Why from "./sections/Why";
import Collections from "./sections/Collections";
import Products from "./sections/Products";
import HowTo from "./sections/HowTo";
import Testimonials from "./sections/Testimonials";
import FinalCta from "./sections/FinalCta";
import Footer from "./sections/Footer";
import { initSmoothScroll, lenis } from "./lib/smooth";
import { listenPointer } from "./lib/store";

export default function App() {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    initSmoothScroll();
    listenPointer();
    const r = () => ScrollTrigger.refresh();
    document.fonts?.ready.then(r);
    window.addEventListener("load", r);
    return () => window.removeEventListener("load", r);
  }, []);

  return (
    <>
      <Cursor />
      <Preloader
        onReveal={() => setRevealed(true)}
        onDone={() => {
          lenis?.start();
          ScrollTrigger.refresh();
        }}
      />
      <Nav show={revealed} />
      <main>
        <HeroSequence revealed={revealed} />
        <Why />
        <Collections />
        <Products />
        <HowTo />
        <Testimonials />
        <FinalCta />
      </main>
      <Footer />
      <WhatsAppFloat show={revealed} />
    </>
  );
}
