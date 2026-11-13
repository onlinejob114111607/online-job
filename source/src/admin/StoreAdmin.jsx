// ============================================================
//  لوحة المتجر: الطلبات، المنتجات، الإعدادات
// ============================================================
import SocialPosts from "./SocialPosts";
import { useEffect, useState } from "react";
import { store } from "./hooks";
import { Empty, SubTabs } from "./ui";
import { useStoreData } from "./store/shared";
import { Reports } from "./store/Reports";
import { Blacklist } from "./store/Blacklist";
import { Orders } from "./store/Orders";
import { Products } from "./store/Products";
import { Reviews } from "./store/Reviews";
import { StoreSettings } from "./store/StoreSettings";
import { Drafts } from "./store/Drafts";
import { TgImport } from "./store/TgImport";
export { FEED_PATH } from "./store/shared";
export { fbFeedUrl } from "./store/shared";
export { storeUrlOf } from "./store/shared";
export { ghRepoOf } from "./store/shared";
export { pagesUrl } from "./store/shared";
export { uploaderOf } from "./store/shared";

export default function StoreAdmin() {
  const data = useStoreData();
  const [tab, setTab] = useState(() => store.get("store.tab", "orders"));
  useEffect(() => store.set("store.tab", tab), [tab]);
  if (!data.loaded) return <Empty>جاري التحميل...</Empty>;
  return (
    <div className="page">
      <SubTabs
        value={tab}
        onChange={setTab}
        tabs={[
          ["orders", "الطلبات"],
          ["social", "منشورات اليوم 📣"],
          ["reports", "الأرباح"],
          ["blacklist", "القائمة السوداء"],
          ["products", "المنتجات", data.products.length || ""],
          ["drafts", "بانتظار المراجعة", data.drafts.length || ""],
          ["tgimport", "قنوات تيليجرام"],
          ["reviews", "التقييمات"],
          ["settings", "إعدادات المتجر"],
        ]}
      />
      {tab === "orders" && <Orders {...data} />}
      {tab === "social" && <SocialPosts {...data} />}
      {tab === "reports" && <Reports {...data} />}
      {tab === "blacklist" && <Blacklist />}
      {tab === "products" && <Products {...data} />}
      {tab === "drafts" && <Drafts {...data} />}
      {tab === "tgimport" && <TgImport {...data} />}
      {tab === "reviews" && <Reviews {...data} />}
      {tab === "settings" && <StoreSettings {...data} />}
    </div>
  );
}
