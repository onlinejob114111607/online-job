// رسمة الواجهة: شاشة متوهجة مع لوحات عائمة (بنفسجي + ذهبي) — SVG خفيف بدون صور
export default function HeroArt() {
  return (
    <svg className="lp-art" viewBox="0 0 520 440" role="img" aria-label="شاشة عمل أونلاين" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ha-screen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a2a12" />
          <stop offset="1" stopColor="#1b1430" />
        </linearGradient>
        <linearGradient id="ha-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd666" />
          <stop offset="1" stopColor="#f5a300" />
        </linearGradient>
        <linearGradient id="ha-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#241d48" />
          <stop offset="1" stopColor="#171233" />
        </linearGradient>
        <radialGradient id="ha-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#f5b301" stopOpacity="0.45" />
          <stop offset="1" stopColor="#f5b301" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ha-pglow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#8b5cf6" stopOpacity="0.45" />
          <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
        </radialGradient>
        <filter id="ha-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>

      <ellipse cx="270" cy="230" rx="230" ry="190" fill="url(#ha-pglow)" />
      <ellipse cx="270" cy="200" rx="150" ry="120" fill="url(#ha-glow)" />

      {/* المكتب */}
      <path d="M40 370 L270 300 L500 370 L270 440 Z" fill="#141029" stroke="#2c2356" />

      {/* الشاشة */}
      <rect x="120" y="70" width="300" height="200" rx="14" fill="#0e0b1f" stroke="#3b2f73" strokeWidth="3" />
      <rect x="134" y="84" width="272" height="172" rx="8" fill="url(#ha-screen)" />
      <rect x="134" y="84" width="272" height="172" rx="8" fill="none" stroke="#f5b301" strokeOpacity="0.55" filter="url(#ha-blur)" />
      <rect x="134" y="84" width="272" height="172" rx="8" fill="none" stroke="#f5b301" strokeOpacity="0.8" />
      {/* شريط النافذة */}
      <circle cx="150" cy="99" r="3.5" fill="#f5b301" />
      <circle cx="162" cy="99" r="3.5" fill="#f5b301" fillOpacity="0.6" />
      <circle cx="174" cy="99" r="3.5" fill="#f5b301" fillOpacity="0.35" />
      {/* قائمة جانبية */}
      <rect x="146" y="114" width="58" height="128" rx="6" fill="#000" fillOpacity="0.25" />
      <rect x="153" y="124" width="44" height="10" rx="4" fill="url(#ha-gold)" />
      {[142, 158, 174, 190, 206].map((y) => (
        <rect key={y} x="153" y={y} width="34" height="6" rx="3" fill="#9a8fd0" fillOpacity="0.35" />
      ))}
      {/* المحتوى */}
      <rect x="214" y="114" width="180" height="62" rx="8" fill="#000" fillOpacity="0.22" stroke="#f5b301" strokeOpacity="0.35" />
      <rect x="226" y="126" width="80" height="8" rx="4" fill="#ffd666" fillOpacity="0.85" />
      <rect x="226" y="142" width="120" height="6" rx="3" fill="#cdbfff" fillOpacity="0.35" />
      <path d="M226 166 L262 156 L290 162 L322 146 L382 150" fill="none" stroke="url(#ha-gold)" strokeWidth="3" strokeLinecap="round" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={214 + i * 62} y="186" width="54" height="56" rx="8" fill="#000" fillOpacity="0.22" stroke="#f5b301" strokeOpacity="0.3" />
          <circle cx={226 + i * 62} cy="200" r="4" fill="#f5b301" />
          <rect x={222 + i * 62} y="214" width="38" height="5" rx="2.5" fill="#cdbfff" fillOpacity="0.35" />
          <rect x={222 + i * 62} y="226" width="26" height="5" rx="2.5" fill="#cdbfff" fillOpacity="0.25" />
        </g>
      ))}
      {/* القاعدة */}
      <path d="M245 270 L295 270 L305 312 L235 312 Z" fill="#1a1536" stroke="#3b2f73" />
      <ellipse cx="270" cy="314" rx="62" ry="10" fill="#1a1536" stroke="#3b2f73" />

      {/* لوحة كود عائمة */}
      <g className="lp-float lp-float-1">
        <rect x="18" y="96" width="92" height="110" rx="10" fill="url(#ha-panel)" stroke="#5b47b5" strokeOpacity="0.7" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x="30" y={112 + i * 14} width={[50, 34, 60, 42, 28, 54][i]} height="5" rx="2.5" fill={i % 2 ? "#f5b301" : "#8b5cf6"} fillOpacity="0.8" />
        ))}
        <path d="M110 150 H128" stroke="#f5b301" strokeDasharray="4 4" />
      </g>

      {/* مخطط عائم */}
      <g className="lp-float lp-float-2">
        <rect x="424" y="58" width="84" height="84" rx="10" fill="url(#ha-panel)" stroke="#f5b301" strokeOpacity="0.55" />
        <rect x="452" y="70" width="28" height="12" rx="3" fill="#f5b301" fillOpacity="0.85" />
        <rect x="452" y="96" width="28" height="12" rx="3" fill="#8b5cf6" />
        <rect x="436" y="120" width="22" height="10" rx="3" fill="#f5b301" fillOpacity="0.7" />
        <rect x="474" y="120" width="22" height="10" rx="3" fill="#f5b301" fillOpacity="0.7" />
        <path d="M466 82v14M466 108v6H447v6M466 114h19v6" fill="none" stroke="#f5b301" strokeOpacity="0.8" />
        <path d="M424 120 H412" stroke="#f5b301" strokeDasharray="4 4" />
      </g>

      {/* أيقونة كود */}
      <g className="lp-float lp-float-3">
        <rect x="236" y="10" width="48" height="44" rx="10" fill="url(#ha-panel)" stroke="#8b5cf6" />
        <path d="M253 24l-7 8 7 8M267 24l7 8-7 8" fill="none" stroke="#b197fc" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>

      {/* سيرفرات */}
      <g>
        <rect x="430" y="250" width="56" height="70" rx="8" fill="#16122c" stroke="#3b2f73" />
        {[264, 284, 304].map((y) => (
          <g key={y}>
            <rect x="438" y={y - 6} width="40" height="12" rx="3" fill="#0e0b1f" />
            <circle cx="470" cy={y} r="2" fill="#f5b301" />
            <circle cx="462" cy={y} r="2" fill="#8b5cf6" />
          </g>
        ))}
      </g>
      <g>
        <ellipse cx="80" cy="300" rx="34" ry="10" fill="#1a1536" stroke="#3b2f73" />
        <path d="M46 300v42c0 6 15 10 34 10s34-4 34-10v-42" fill="#16122c" stroke="#3b2f73" />
        <path d="M46 314c0 6 15 10 34 10s34-4 34-10M46 328c0 6 15 10 34 10s34-4 34-10" fill="none" stroke="#f5b301" strokeOpacity="0.85" />
      </g>
      {/* لوحة مفاتيح */}
      <path d="M200 352 L330 330 L380 352 L250 376 Z" fill="#110d24" stroke="#3b2f73" />
    </svg>
  );
}
