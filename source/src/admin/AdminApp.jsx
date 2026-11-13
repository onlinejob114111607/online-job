import { useEffect, useState } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { collection, orderBy, query } from "firebase/firestore";
import { auth, db } from "../firebase";
import { ADMIN_EMAIL } from "../config";
import { AdminCtx, useAppSettingsLive, useQuery, useToastState, useWorkersState } from "./hooks";
import Overview from "./Overview";
import Registrations from "./Registrations";
import Funnel from "./Funnel";
import StoreAdmin from "./StoreAdmin";
import WaSection from "./wa/WaSection";
import TgSection from "./tg/TgSection";
import SettingsPage from "./SettingsPage";
import Logs from "./Logs";
import Health from "./Health";
import Icon from "../components/Icons";
import "../admin.css";
import "../admin-theme.css";

export default function AdminApp() {
  const [user, setUser] = useState(undefined);
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  useEffect(() => {
    document.title = "لوحة التحكم";
  }, []);

  if (user === undefined) return <div className="center-screen"><div className="loader" /></div>;
  if (!user) return <Login />;
  if (user.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase())
    return (
      <div className="center-screen">
        <div className="login-card">
          <h2>غير مصرّح</h2>
          <p className="muted">هذا الحساب ليس حساب الأدمن.</p>
          <button className="btn" onClick={() => signOut(auth)}>
            تسجيل خروج
          </button>
        </div>
      </div>
    );
  return <Shell user={user} />;
}

function Login() {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), pass);
    } catch {
      setErr("الإيميل أو كلمة المرور غير صحيحة");
    }
    setBusy(false);
  }

  return (
    <div className="center-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <img src="./logo-192.png" alt="" width="48" height="48" />
          <b>لوحة التحكم</b>
          <span className="muted">سجّل دخول بحساب الأدمن</span>
        </div>
        <div className="field">
          <label>الإيميل</label>
          <input type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
        </div>
        <div className="field">
          <label>كلمة المرور</label>
          <input type="password" dir="ltr" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="current-password" />
        </div>
        {err && <div className="alert danger">{err}</div>}
        <button className="btn primary block" disabled={busy}>
          {busy ? "جاري الدخول..." : "دخول"}
        </button>
      </form>
    </div>
  );
}

// القائمة مقسومة لمجموعات
const NAV_GROUPS = [
  {
    title: "التسجيل",
    items: [
      ["", "الرئيسية", "grid"],
      ["registrations", "التسجيلات", "list"],
      ["funnel", "المتابعة", "chat"],
    ],
  },
  {
    title: "التسويق",
    items: [
      ["wa", "واتساب", "wa"],
      ["tg", "الصياد", "radar"],
    ],
  },
  { title: "المتجر", items: [["store", "المتجر", "bag"]] },
  {
    title: "النظام",
    items: [
      ["health", "الصحة", "heart"],
      ["logs", "السجل", "logs"],
      ["settings", "الإعدادات", "gear"],
    ],
  },
];
// شريط الموبايل السفلي: أهم 4 صفحات + زر القائمة
const MOBILE_TABS = [
  ["", "الرئيسية", "grid"],
  ["registrations", "التسجيلات", "list"],
  ["funnel", "المتابعة", "chat"],
  ["wa", "واتساب", "wa"],
];
const to = (path) => `/admin${path ? `/${path}` : ""}`;
const navCls = ({ isActive }) => "nav-item" + (isActive ? " active" : "");

function Shell({ user }) {
  const workers = useWorkersState();
  const { app, loaded } = useAppSettingsLive();
  const [toast, showToast] = useToastState();
  const [waAccounts] = useQuery(() => query(collection(db, "wa_accounts"), orderBy("createdAt", "asc")), []);
  const [tgAccounts] = useQuery(() => collection(db, "tg_accounts"), []);
  const [menuOpen, setMenuOpen] = useState(false);
  const loc = useLocation();
  useEffect(() => setMenuOpen(false), [loc.pathname]);

  const ctx = { user, app, appLoaded: loaded, workers, toast: showToast, waAccounts, tgAccounts };

  return (
    <AdminCtx.Provider value={ctx}>
      <div className={"shell" + (menuOpen ? " menu-open" : "")}>
        <header className="shell-top">
          <div className="shell-brand">
            <button className="icon-btn menu-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="القائمة">
              <Icon name={menuOpen ? "close" : "menu"} size={22} />
            </button>
            <img src="./logo-192.png" alt="" width="30" height="30" />
            <b>لوحة التحكم</b>
          </div>
          <div className="shell-status">
            <WorkerPill label="واتساب" on={workers.waOnline} />
            <WorkerPill label="تيليجرام" on={workers.tgOnline} />
            <button className="btn small logout-btn" onClick={() => signOut(auth)} title={user.email}>
              <Icon name="logout" size={18} />
              <span>خروج</span>
            </button>
          </div>
        </header>

        <nav className="shell-nav" aria-label="القائمة الرئيسية">
          <div className="nav-inner">
            {NAV_GROUPS.map((g) => (
              <div className="nav-group" key={g.title}>
                <div className="nav-group-title">{g.title}</div>
                {g.items.map(([path, label, icon]) => (
                  <NavLink key={path} to={to(path)} end={!path} className={navCls}>
                    <span className="nav-icon" aria-hidden="true">
                      <Icon name={icon} size={19} />
                    </span>
                    {label}
                  </NavLink>
                ))}
              </div>
            ))}
            <div className="nav-user" title={user.email}>
              <span className="nav-avatar">{(user.email || "?")[0].toUpperCase()}</span>
              <span className="nav-email">{user.email}</span>
            </div>
          </div>
        </nav>
        <div className="nav-backdrop" onClick={() => setMenuOpen(false)} />

        <main className="shell-main">
          <Routes>
            <Route index element={<Overview />} />
            <Route path="registrations" element={<Registrations />} />
            <Route path="funnel" element={<Funnel />} />
            <Route path="store" element={<StoreAdmin />} />
            <Route path="wa" element={<WaSection />} />
            <Route path="tg" element={<TgSection />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="logs" element={<Logs />} />
            <Route path="health" element={<Health />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>

        <nav className="bottom-nav" aria-label="تنقل سريع">
          {MOBILE_TABS.map(([path, label, icon]) => (
            <NavLink key={path} to={to(path)} end={!path} className={({ isActive }) => "bn-item" + (isActive ? " active" : "")}>
              <Icon name={icon} size={21} />
              <span>{label}</span>
            </NavLink>
          ))}
          <button className={"bn-item" + (menuOpen ? " active" : "")} onClick={() => setMenuOpen((v) => !v)}>
            <Icon name="menu" size={21} />
            <span>المزيد</span>
          </button>
        </nav>
      </div>
      {toast && <div className={`toast ${toast.kind}`}>{toast.msg}</div>}
    </AdminCtx.Provider>
  );
}

function WorkerPill({ label, on }) {
  return (
    <span className={"pill " + (on ? "on" : "off")} title={on ? "شغال" : "مطفي أو ما بيرد"}>
      <i />
      {label}
    </span>
  );
}
