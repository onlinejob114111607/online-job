import { useEffect, useState } from "react";
import { store, useAdmin } from "../hooks";
import { SubTabs, WorkerOff } from "../ui";
import Sources from "./Sources";
import Links from "./Links";
import TgAccounts from "./TgAccounts";

export default function TgSection() {
  const { workers, tgAccounts, app } = useAdmin();
  const [tab, setTab] = useState(() => store.get("tg.tab", "links"));
  useEffect(() => store.set("tg.tab", tab), [tab]);

  return (
    <div className="page">
      {!workers.tgOnline && <WorkerOff name="عامل تيليجرام" />}
      {(!app.tg.apiId || !app.tg.apiHash) && (
        <div className="alert warn">
          لازم تدخل api_id و api_hash من الإعدادات ← تيليجرام قبل ما تضيف حسابات (بتجيبهم من my.telegram.org ← API development tools).
        </div>
      )}
      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["links", "الروابط"],
          ["sources", "المصادر"],
          ["accounts", "الحسابات", tgAccounts.length],
        ]}
      />
      {tab === "links" && <Links />}
      {tab === "sources" && <Sources />}
      {tab === "accounts" && <TgAccounts />}
    </div>
  );
}
