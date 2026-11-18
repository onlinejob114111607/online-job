// بيانات حقيقية من المتجر (نفس ملف الكتالوج اللي بيقرأه المتجر) — بتتحدث لحالها مع كل تحديث للمتجر
import { useEffect, useState } from "react";
import { SHOP_BASE, categoryUrl } from "../config";

let cache = null;
function load() {
  if (!cache) {
    const t = Math.floor(Date.now() / 600000);
    cache = fetch(`${SHOP_BASE}catalog.json?t=${t}`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(shape)
      .catch(() => null);
  }
  return cache;
}

const ok = (p) => p && p.id && p.available !== false && p.images?.[0];

function shape(d) {
  const all = (d.products || []).filter(ok);
  const byNew = [...all].sort((a, b) => (b.order || 0) - (a.order || 0) || (b.createdAt || 0) - (a.createdAt || 0));
  const order = d.settings?.categories || [];
  const groups = new Map();
  for (const p of byNew) {
    if (!p.category) continue;
    if (!groups.has(p.category)) groups.set(p.category, []);
    groups.get(p.category).push(p);
  }
  const catImgs = d.settings?.categoryImages || {};
  const cats = [...groups.entries()]
    .map(([name, list]) => ({ name, count: list.length, img: catImgs[name] || list[0].images[0], link: categoryUrl(name), rank: order.indexOf(name) }))
    .sort((a, b) => (a.rank < 0) - (b.rank < 0) || a.rank - b.rank || b.count - a.count)
    .slice(0, 8);
  // منتجات: المميزة أول، وبعدين الأحدث، بدون تكرار
  const seen = new Set();
  const products = [...byNew.filter((p) => p.featured || p.flashPrice), ...byNew].filter((p) => !seen.has(p.id) && seen.add(p.id)).slice(0, 14);
  const feedback = (d.feedbackFeed || []).filter((f) => f && f.img).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 12);
  return { cats, products, feedback, currency: d.settings?.currency || "₪", total: all.length };
}

export function useCatalog() {
  const [data, setData] = useState(null);
  useEffect(() => {
    let on = true;
    load().then((d) => on && setData(d || { cats: [], products: [], feedback: [], currency: "₪", total: 0 }));
    return () => (on = false);
  }, []);
  return data;
}
