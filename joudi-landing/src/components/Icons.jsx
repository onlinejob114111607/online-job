const base = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" };

export const WhatsAppIcon = (p) => (
  <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" {...p}>
    <path fill="currentColor" d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38a9.9 9.9 0 0 0 4.74 1.21c5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2Zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.2 8.2 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 4.54 0 8.24 3.7 8.24 8.24 0 4.55-3.7 8.24-8.24 8.24Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.43.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.43-.06-.13-.56-1.35-.77-1.84-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.1-.23-.16-.48-.28Z" />
  </svg>
);
export const FacebookIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...p}>
    <path fill="currentColor" d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.87.25-1.46 1.5-1.46h1.55V4.45A20 20 0 0 0 14.3 4.3c-2.25 0-3.8 1.37-3.8 3.9v2.3H8v3h2.5V21h3Z" />
  </svg>
);
export const InstagramIcon = (p) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" {...base} strokeWidth="1.6" {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="3.9" />
    <circle cx="17.3" cy="6.7" r=".6" fill="currentColor" />
  </svg>
);
export const ArrowIcon = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...base} strokeWidth="1.6" {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const BagIcon = (p) => (
  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" {...base} strokeWidth="1.6" {...p}>
    <path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z" />
    <path d="M9 10V7a3 3 0 0 1 6 0v3" />
  </svg>
);

// أيقونات بطاقات «لماذا جودي»
export const CardIcons = [
  (p) => (
    <svg viewBox="0 0 48 48" {...base} {...p}>
      <path d="M24 6l4.6 9.6 10.4 1.4-7.6 7.2 1.9 10.3L24 29.6l-9.3 4.9 1.9-10.3L9 17l10.4-1.4L24 6Z" />
      <path d="M24 38v4M17 40l-1.5 3M31 40l1.5 3" opacity=".6" />
    </svg>
  ),
  (p) => (
    <svg viewBox="0 0 48 48" {...base} {...p}>
      <path d="M24 5l15 5.5v11c0 9.6-6.4 17.3-15 21-8.6-3.7-15-11.4-15-21v-11L24 5Z" />
      <path d="M17 24l5 5 9-10" />
    </svg>
  ),
  (p) => (
    <svg viewBox="0 0 48 48" {...base} {...p}>
      <path d="M24 43s-13-12.2-13-22a13 13 0 0 1 26 0c0 9.8-13 22-13 22Z" />
      <circle cx="24" cy="21" r="4.5" />
    </svg>
  ),
  (p) => (
    <svg viewBox="0 0 48 48" {...base} {...p}>
      <path d="M8 12a5 5 0 0 1 5-5h22a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H21l-8 7v-7a5 5 0 0 1-5-5V12Z" />
      <path d="M24 24.5s-6-3.6-6-7.6a3.2 3.2 0 0 1 6-1.6 3.2 3.2 0 0 1 6 1.6c0 4-6 7.6-6 7.6Z" />
    </svg>
  ),
];

// أيقونات ثقة ثابتة (لما ما في WebGL)
export const TrustFallbackIcons = [
  (p) => (
    <svg viewBox="0 0 48 48" {...base} {...p}>
      <path d="M4 13h24v19H4zM28 19h8l7 7v6h-15z" />
      <circle cx="12" cy="35" r="3.5" />
      <circle cx="35" cy="35" r="3.5" />
    </svg>
  ),
  (p) => (
    <svg viewBox="0 0 48 48" {...base} {...p}>
      <circle cx="26" cy="13" r="7" />
      <path d="M26 10v6M4 36l7-6c2-1.7 4-2 6-2h8a3 3 0 0 1 0 6h-6m6 0 11-6a3 3 0 0 1 3 5l-12 8c-2 1-4 1.5-6 1.5H4" />
    </svg>
  ),
  (p) => (
    <svg viewBox="0 0 48 48" {...base} {...p}>
      <circle cx="20" cy="20" r="12" />
      <path d="M29 29l12 12M15 20l4 4 7-8" />
    </svg>
  ),
  (p) => (
    <svg viewBox="0 0 48 48" {...base} {...p}>
      <path d="M8 12a5 5 0 0 1 5-5h22a5 5 0 0 1 5 5v14a5 5 0 0 1-5 5H21l-8 7v-7a5 5 0 0 1-5-5V12Z" />
      <circle cx="17" cy="19" r="1.4" fill="currentColor" />
      <circle cx="24" cy="19" r="1.4" fill="currentColor" />
      <circle cx="31" cy="19" r="1.4" fill="currentColor" />
    </svg>
  ),
];
