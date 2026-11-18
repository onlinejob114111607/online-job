import{j as s}from"./react-CT_KzUjf.js";import{c as S,L as p}from"./r3f-D-Af3A0q.js";import{x as w,C as y,ap as b,a as C,at as z}from"./three-pEjeCVNw.js";function B({resolution:e=256}){return s.jsxs(S,{resolution:e,frames:1,children:[s.jsx("color",{attach:"background",args:["#6b4c3b"]}),s.jsx(p,{form:"rect",intensity:2.6,color:"#FFF4E2",position:[0,6,2],"rotation-x":Math.PI/2,scale:[10,6,1]}),s.jsx(p,{form:"rect",intensity:1.6,color:"#FFE7C2",position:[-6,2,3],"rotation-y":Math.PI/2.4,scale:[4,8,1]}),s.jsx(p,{form:"rect",intensity:1.2,color:"#F2C98F",position:[6,1.5,-1],"rotation-y":-Math.PI/2.2,scale:[3,8,1]}),s.jsx(p,{form:"ring",intensity:2.2,color:"#FFF0D6",position:[2,3,6],scale:2.2,onUpdate:o=>o.lookAt(0,0,0)}),s.jsx(p,{form:"rect",intensity:.8,color:"#6D4FD6",position:[0,-3,-5],scale:[12,4,1]}),s.jsx(p,{form:"rect",intensity:1.4,color:"#FFE3B5",position:[0,-4,3],"rotation-x":-Math.PI/2,scale:[10,6,1]})]})}const I=(e=.16)=>new w({color:new y("#F7C75A"),metalness:1,roughness:e,clearcoat:.4,clearcoatRoughness:.15,envMapIntensity:1.35}),_=()=>new w({color:new y("#3B2496"),roughness:.42,metalness:.05,sheen:1,sheenRoughness:.35,sheenColor:new y("#FFD677"),clearcoat:.35,clearcoatRoughness:.3,envMapIntensity:.9});function d(e,o){const a=Math.sin(e*127.1+o*311.7)*43758.5453;return a-Math.floor(a)}function j(e,o){const a=Math.floor(e),t=Math.floor(o),n=e-a,r=o-t,l=n*n*(3-2*n),v=r*r*(3-2*r),i=d(a,t),f=d(a+1,t),h=d(a,t+1),m=d(a+1,t+1);return i+(f-i)*l+(h-i)*v+(i-f-h+m)*l*v}function M(e,o){let a=0,t=.5;for(let n=0;n<5;n++)a+=t*j(e,o),e*=2.02,o*=2.02,t*=.5;return a}let c=null;function N(e=512){if(c)return c;const o=document.createElement("canvas");o.width=e,o.height=e/2;const a=o.getContext("2d"),t=a.createImageData(o.width,o.height),n=[246,239,228];for(let r=0;r<o.height;r++)for(let l=0;l<o.width;l++){const v=l/o.width*6,i=r/o.height*3,f=M(v,i),h=Math.abs(Math.sin((v*.9+i*1.7+f*5.5)*1.6)),m=Math.pow(1-h,14),F=Math.pow(1-Math.abs(Math.sin((v*1.9-i*.6+f*7)*2.2)),30)*.5,g=(M(v*1.3+9,i*1.3)-.5)*18,u=(r*o.width+l)*4,x=m*70+F*50;t.data[u]=n[0]+g-x*.75,t.data[u+1]=n[1]+g-x*.85,t.data[u+2]=n[2]+g-x*.8+m*6,m>.6&&(t.data[u]+=18*m,t.data[u+1]+=8*m),t.data[u+3]=255}return a.putImageData(t,0,0),c=new b(o),c.colorSpace=C,c.wrapS=c.wrapT=z,c.anisotropy=4,c}const A=()=>new w({map:N(),roughness:.22,metalness:0,clearcoat:1,clearcoatRoughness:.12,envMapIntensity:.8}),D=`
  uniform float uTime;
  uniform float uAmp;
  uniform vec2 uMouse;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vUv;
  varying float vH;

  float wave(vec2 p){
    float t = uTime * 0.28;
    // طيّات كبيرة ناعمة متل الحرير المعلّق
    float warp = sin(p.y * 0.35 + t * 0.6) * 1.1;
    float h = sin(p.x * 0.95 + warp + t) * 0.42;
    h += sin(p.x * 1.9 - p.y * 0.45 + warp - t * 0.9) * 0.16;
    h += sin((p.x * 0.5 + p.y * 0.9) * 1.1 + t * 0.7) * 0.2;
    float d = length(p - uMouse * vec2(4.0, 2.5));
    h += sin(d * 2.0 - t * 4.0) * 0.05 * exp(-d * 0.35);
    return h * uAmp;
  }

  void main(){
    vUv = uv;
    vec3 p = position;
    // الطرف السفلي بيتدلّى أكتر
    float hang = smoothstep(0.0, 1.0, 1.0 - uv.y);
    float e = 0.02;
    float h  = wave(p.xy) * (0.6 + hang * 0.6);
    float hx = wave(p.xy + vec2(e, 0.0)) * (0.6 + hang * 0.6);
    float hy = wave(p.xy + vec2(0.0, e)) * (0.6 + hang * 0.6);
    p.z += h;
    vec3 n = normalize(vec3(-(hx - h) / e, -(hy - h) / e, 1.0));
    vH = h;
    vN = normalize(normalMatrix * n);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`,U=`
  uniform vec3 uColor;
  uniform vec3 uDeep;
  uniform vec3 uSheen;
  uniform vec3 uGold;
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vView;
  varying vec2 vUv;
  varying float vH;

  void main(){
    vec3 N = normalize(vN);
    if(!gl_FrontFacing) N = -N;
    vec3 V = normalize(vView);
    vec3 L1 = normalize(vec3(0.35, 0.8, 0.55));
    vec3 L2 = normalize(vec3(-0.8, 0.25, 0.45));
    float dif = max(dot(N, L1), 0.0);
    float wrap = max((dot(N, L2) + 0.4) / 1.4, 0.0) * 0.35;
    vec3 col = mix(uDeep, uColor, smoothstep(0.05, 0.95, dif) + wrap * 0.5);
    // لمعة الساتان: حزمة عريضة بلون الحرير + خط ضوء رفيع
    vec3 H = normalize(L1 + V);
    float nh = max(dot(N, H), 0.0);
    float broad = pow(nh, 14.0);
    float sharp = pow(nh, 160.0);
    col += uColor * 1.15 * broad;
    col += uSheen * sharp * 0.9;
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    col += uGold * fres * 0.12;
    // تلاشي ناعم عند الأطراف
    float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x) * smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
    gl_FragColor = vec4(col, edge * uOpacity);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`,E=`
  uniform float uTime;
  uniform float uSize;
  uniform float uPixel;
  uniform vec3 uBox;
  attribute float aSeed;
  attribute float aScale;
  varying float vAlpha;
  void main(){
    vec3 p = position;
    float t = uTime * (0.05 + aSeed * 0.06);
    p.y = mod(p.y + t * uBox.y + uBox.y * 0.5, uBox.y) - uBox.y * 0.5;
    p.x += sin(uTime * 0.3 + aSeed * 40.0) * 0.25;
    p.z += cos(uTime * 0.25 + aSeed * 30.0) * 0.2;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aScale * uPixel * (1.0 / -mv.z);
    float tw = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed * 2.0) + aSeed * 90.0);
    float fadeY = smoothstep(uBox.y * 0.5, uBox.y * 0.3, abs(p.y));
    vAlpha = tw * fadeY;
  }
`,L=`
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vAlpha;
  void main(){
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float core = smoothstep(0.5, 0.0, d);
    float glow = pow(core, 2.4);
    gl_FragColor = vec4(uColor * (0.8 + glow * 0.8), glow * vAlpha * uOpacity);
  }
`;export{B as S,D as a,E as b,_ as c,L as d,I as g,A as m,U as s};
