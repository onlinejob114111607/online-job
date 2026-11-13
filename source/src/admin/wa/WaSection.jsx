import { useEffect, useState } from "react";
import { collection, doc, query, updateDoc, where } from "firebase/firestore";
import { db } from "../../firebase";
import { store, useAdmin, useQuery } from "../hooks";
import { SubTabs, Tag, WorkerOff } from "../ui";
import { waStateOf } from "./waShared";
import Accounts from "./Accounts";
import Groups from "./Groups";
import PostForm from "./PostForm";
import Posts from "./Posts";
import Performance from "./Performance";
import Templates from "./Templates";

export default function WaSection() {
  const { waAccounts, workers } = useAdmin();
  const [tab, setTab] = useState(() => store.get("wa.tab", "post"));
  const [accId, setAccId] = useState(() => store.get("wa.acc", ""));
  const [draft, setDraft] = useState(null);

  useEffect(() => store.set("wa.tab", tab), [tab]);
  useEffect(() => {
    if (!waAccounts.length) return;
    if (!waAccounts.some((a) => a.id === accId)) setAccId(waAccounts[0].id);
  }, [waAccounts, accId]);
  useEffect(() => {
    if (accId) store.set("wa.acc", accId);
  }, [accId]);

  const acc = waAccounts.find((a) => a.id === accId) || null;

  const [groups] = useQuery(() => (accId ? query(collection(db, "wa_groups"), where("accountId", "==", accId)) : null), [accId]);
  const [posts] = useQuery(() => (accId ? query(collection(db, "wa_posts"), where("accountId", "==", accId)) : null), [accId]);

  const sortedGroups = [...groups].sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
  const sortedPosts = [...posts]
    .sort((a, b) => (b.createdAt?.toMillis?.() ?? Infinity) - (a.createdAt?.toMillis?.() ?? Infinity))
    .slice(0, 80);
  const scoped = ["post", "posts", "groups", "perf"].includes(tab);
  const active = posts.filter((p) => ["queued", "sending", "scheduled"].includes(p.status)).length;

  return (
    <div className="page">
      {!workers.waOnline && <WorkerOff name="عامل الواتساب" />}

      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["post", "نشر"],
          ["posts", "المنشورات", active],
          ["groups", "المجموعات"],
          ["perf", "الأداء"],
          ["templates", "القوالب"],
          ["accounts", "الحسابات", waAccounts.length],
        ]}
      />

      {scoped && waAccounts.length > 0 && (
        <div className="acc-bar">
          <span className="muted small-text">الحساب:</span>
          <select value={accId} onChange={(e) => setAccId(e.target.value)}>
            {waAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.phone ? `(+${a.phone})` : ""}
              </option>
            ))}
          </select>
          {acc && <Tag kind={waStateOf(acc, workers.waOnline)[1]}>{waStateOf(acc, workers.waOnline)[0]}</Tag>}
          {acc?.risk && acc.risk.score >= 30 && (
            <Tag kind={acc.risk.score >= 60 ? "bad" : "wait"} title={(acc.risk.why || []).join("، ")}>
              {acc.risk.score >= 80 ? "🔴" : acc.risk.score >= 60 ? "🟠" : "🟡"} خطر الحظر {acc.risk.score}/100
            </Tag>
          )}
          {acc && (acc.postPausedUntil?.toMillis?.() || 0) > Date.now() && (
            <>
              <Tag kind="bad" title={acc.postPauseWhy || ""}>
                ⏸ النشر واقف لحماية الرقم لحد {new Date(acc.postPausedUntil.toMillis()).toLocaleTimeString("ar-EG", { hour: "numeric", minute: "2-digit" })}
              </Tag>
              <button className="btn small" onClick={() => confirm(`ترجّع النشر هلأ؟ ${acc.postPauseWhy ? `(وقف بسبب: ${acc.postPauseWhy})` : ""}`) && updateDoc(doc(db, "wa_accounts", acc.id), { postPausedUntil: null, postPauseWhy: null })}>
                كمّل هلأ
              </button>
            </>
          )}
        </div>
      )}

      {scoped && !waAccounts.length && (
        <div className="panel">
          <h3>ما في حسابات لسا</h3>
          <p className="muted">
            روح لتبويب <b>الحسابات</b> وأضف أول رقم واتساب.
          </p>
          <button className="btn primary" onClick={() => setTab("accounts")}>
            إضافة حساب
          </button>
        </div>
      )}

      {tab === "post" && acc && <PostForm acc={acc} groups={sortedGroups} draft={draft} onDraftUsed={() => setDraft(null)} onPosted={() => setTab("posts")} />}
      {tab === "posts" && acc && (
        <Posts
          posts={sortedPosts}
          onCopy={(text) => {
            setDraft(text);
            setTab("post");
          }}
        />
      )}
      {tab === "groups" && acc && <Groups acc={acc} groups={sortedGroups} />}
      {tab === "perf" && acc && <Performance acc={acc} posts={posts} groups={groups} />}
      {tab === "templates" && (
        <Templates
          onUse={(text) => {
            setDraft(text);
            setTab("post");
          }}
        />
      )}
      {tab === "accounts" && (
        <Accounts
          selectedId={accId}
          onSelect={(id) => {
            setAccId(id);
            setTab("post");
          }}
        />
      )}
    </div>
  );
}
