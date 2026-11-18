import{r as c,j as f}from"./react-CT_KzUjf.js";import{C as g,a as x,u as M}from"./r3f-D-Af3A0q.js";import{Q as p,r as h,s as y,i as w}from"./index-Dr6yhoyg.js";import{ai as S,l as m,V as P,ak as A}from"./three-pEjeCVNw.js";import"./motion-B8UFSrxG.js";function T(o){const s=document.createElement("canvas");s.width=900,s.height=420;const i=s.getContext("2d");i.fillStyle="#fff",i.textAlign="center",i.textBaseline="middle",i.direction="rtl",i.font="700 300px 'El Messiri', serif",i.fillText("جودي",900/2,420/2+20);const d=i.getImageData(0,0,900,420).data,n=[];for(let e=0;e<420;e+=3)for(let t=0;t<900;t+=3)d[(e*900+t)*4+3]>128&&n.push([t,e]);const a=new Float32Array(o*3);for(let e=0;e<o;e++){const t=n[Math.floor(Math.random()*n.length)]||[450,210];a[e*3]=(t[0]-900/2)/420*2+(Math.random()-.5)*.01,a[e*3+1]=-(t[1]-420/2)/420*2,a[e*3+2]=(Math.random()-.5)*.12}return a}const W=`
  uniform float uTime; uniform float uP; uniform float uPixel; uniform float uScale; uniform vec2 uMouse;
  attribute vec3 aTarget; attribute float aSeed;
  varying float vA;
  void main(){
    float delay = aSeed * 0.35;
    float t = clamp((uP - delay) / (1.0 - 0.35), 0.0, 1.0);
    t = 1.0 - pow(1.0 - t, 3.0);
    vec3 target = aTarget * uScale;
    // حركة دائمة خفيفة حتى بعد التشكّل
    target.x += sin(uTime * 0.8 + aSeed * 50.0) * 0.012 * uScale;
    target.y += cos(uTime * 0.7 + aSeed * 40.0) * 0.012 * uScale;
    vec3 p = mix(position, target, t);
    // يتنحّى عن الماوس
    vec2 d = p.xy - uMouse;
    float f = exp(-dot(d, d) * 3.0) * 0.18 * t;
    p.xy += normalize(d + 0.0001) * f;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + aSeed * 80.0);
    gl_PointSize = (3.5 + aSeed * 5.5) * uPixel * (1.0 + (1.0 - t) * 0.6) * (4.0 / -mv.z);
    vA = tw * (0.4 + t * 0.6) * 1.25;
  }
`,H=`
  varying float vA;
  void main(){
    float d = length(gl_PointCoord - 0.5);
    float a = pow(smoothstep(0.5, 0.0, d), 2.0);
    vec3 c = mix(vec3(0.79, 0.64, 0.42), vec3(1.0, 0.93, 0.78), a);
    gl_FragColor = vec4(c, a * vA);
  }
`;function b({count:o}){const l=c.useRef(),{viewport:r,size:s}=x(),i=c.useMemo(()=>{const n=new S,a=new Float32Array(o*3),e=new Float32Array(o);for(let t=0;t<o;t++){const u=2+Math.random()*4,v=Math.random()*Math.PI*2;a[t*3]=Math.cos(v)*u*1.4,a[t*3+1]=Math.sin(v)*u*.8,a[t*3+2]=(Math.random()-.5)*3,e[t]=Math.random()}return n.setAttribute("position",new m(a,3)),n.setAttribute("aTarget",new m(T(o),3)),n.setAttribute("aSeed",new m(e,1)),n},[o]),d=c.useMemo(()=>({uTime:{value:0},uP:{value:0},uPixel:{value:1},uScale:{value:1},uMouse:{value:new P(9,9)}}),[]);return M((n,a)=>{const e=l.current.uniforms;e.uTime.value+=h?0:Math.min(a,.05);const t=h?1:y.cta;e.uP.value+=(t-e.uP.value)*Math.min(1,a*2.2),e.uPixel.value=r.dpr,e.uScale.value=Math.min(r.width*.3,.82);const u=w();e.uMouse.value.set(u.x*r.width/2,u.y*r.height/2)}),f.jsx("points",{geometry:i,frustumCulled:!1,"position-y":r.height*(s.width<768?.2:.17),children:f.jsx("shaderMaterial",{ref:l,uniforms:d,vertexShader:W,fragmentShader:H,transparent:!0,depthWrite:!1,blending:A})})}function z({active:o}){const[l,r]=c.useState(!1);return c.useEffect(()=>{const s=document.fonts;if(!s)return r(!0);s.load("700 300px 'El Messiri'","جودي").finally(()=>r(!0))},[]),f.jsx(g,{dpr:p.dpr,frameloop:o?"always":"never",camera:{position:[0,0,4],fov:45},gl:{antialias:!1,alpha:!0},style:{position:"absolute",inset:0},"aria-hidden":"true",children:l&&f.jsx(b,{count:p.ctaParticles})})}export{z as default};
