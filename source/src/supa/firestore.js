// ============================================================
//  بديل "firebase/firestore" فوق Supabase (للوحة والموقع والمتجر)
//  نفس أسماء الدوال، فالكود القديم بيشتغل بدون تغيير.
//  بيتفعّل من vite.config.js لما يكون SUPABASE.url معبّى بـ src/config.js
// ============================================================
import { createStore, OPS, Timestamp, autoId, getField } from "./docstore.js";
import { supabase } from "./client.js";

export { Timestamp };

const store = createStore(supabase);
const split = (p) => String(p).split("/").filter(Boolean);

// ---------- المراجع ----------
class CollectionReference {
  constructor(path) {
    this.type = "collection";
    this.path = path;
    this.id = split(path).at(-1);
    this._col = path;
    this._spec = { filters: [], orders: [] };
  }
}
class DocumentReference {
  constructor(path) {
    const seg = split(path);
    this.type = "document";
    this.path = seg.join("/");
    this.id = seg.at(-1);
    this._col = seg.slice(0, -1).join("/");
  }
  get parent() {
    return new CollectionReference(this._col);
  }
}
class Query {
  constructor(col, spec) {
    this.type = "query";
    this._col = col;
    this._spec = spec;
  }
}

export const getFirestore = () => ({ type: "firestore" });

export function collection(base, ...segs) {
  const prefix = base?.type === "document" ? base.path : base?.type === "collection" ? base.path : "";
  return new CollectionReference([...split(prefix), ...segs.flatMap(split)].join("/"));
}

export function doc(base, ...segs) {
  if (base?.type === "collection") {
    const extra = segs.flatMap(split);
    return new DocumentReference([...split(base.path), ...(extra.length ? extra : [autoId()])].join("/"));
  }
  const prefix = base?.type === "document" ? base.path : "";
  return new DocumentReference([...split(prefix), ...segs.flatMap(split)].join("/"));
}

export const where = (field, op, value) => ({ kind: "where", f: [String(field), op, value] });
export const orderBy = (field, dir = "asc") => ({ kind: "order", o: [String(field), dir] });
export const limit = (n) => ({ kind: "limit", n });
export const documentId = () => "__name__";

export function query(base, ...cons) {
  const spec = { filters: [...(base._spec?.filters || [])], orders: [...(base._spec?.orders || [])], limit: base._spec?.limit };
  for (const c of cons) {
    if (c.kind === "where") spec.filters.push(c.f);
    else if (c.kind === "order") spec.orders.push(c.o);
    else if (c.kind === "limit") spec.limit = c.n;
  }
  return new Query(base._col, spec);
}

// ---------- اللقطات ----------
class DocumentSnapshot {
  constructor(ref, row) {
    this.ref = ref;
    this.id = ref.id;
    this._row = row;
    this.metadata = { hasPendingWrites: false, fromCache: false };
  }
  exists() {
    return !!this._row;
  }
  data() {
    return this._row ? { ...this._row.data } : undefined;
  }
  get(field) {
    return this._row ? getField(this._row.data, field) : undefined;
  }
}
class QuerySnapshot {
  constructor(col, rows, changes) {
    this._col = col;
    this.docs = rows.map((r) => new DocumentSnapshot(new DocumentReference(`${col}/${r.id}`), r));
    this.size = this.docs.length;
    this.empty = this.size === 0;
    this._changes = changes;
    this.metadata = { hasPendingWrites: false, fromCache: false };
  }
  forEach(fn) {
    this.docs.forEach(fn);
  }
  docChanges() {
    if (!this._changes) return this.docs.map((d, i) => ({ type: "added", doc: d, newIndex: i, oldIndex: -1 }));
    return this._changes.map((c) => ({ type: c.type, doc: new DocumentSnapshot(new DocumentReference(`${this._col}/${c.row.id}`), c.row), newIndex: c.newIndex, oldIndex: c.oldIndex }));
  }
}

// ---------- القراءة ----------
export async function getDoc(ref) {
  return new DocumentSnapshot(ref, await store.getDoc(ref._col, ref.id));
}
export const getDocFromServer = getDoc;
export async function getDocs(q) {
  return new QuerySnapshot(q._col, await store.query(q._col, q._spec || {}));
}
export const getDocsFromServer = getDocs;
export async function getCountFromServer(q) {
  const n = await store.count(q._col, q._spec || {});
  return { data: () => ({ count: n }) };
}

export function onSnapshot(target, ...args) {
  const fns = args.filter((a) => typeof a === "function");
  const obs = args.find((a) => a && typeof a === "object" && (a.next || a.error));
  const next = fns[0] || obs?.next;
  const error = fns[1] || obs?.error;
  if (target.type === "document") {
    return store.watchDoc(target._col, target.id, (row) => next?.(new DocumentSnapshot(target, row)), error);
  }
  return store.watchQuery(target._col, target._spec || {}, ({ rows, changes }) => next?.(new QuerySnapshot(target._col, rows, changes)), error);
}

// ---------- الكتابة ----------
const one = (t, ref, data) => store.write([{ t, col: ref._col, id: ref.id, data }]).then(() => undefined);
export const setDoc = (ref, data, opts = {}) => one(opts.merge || opts.mergeFields ? "merge" : "set", ref, data);
export function updateDoc(ref, data, ...rest) {
  if (typeof data === "string" || Array.isArray(data)) {
    const obj = { [String(data)]: rest[0] };
    for (let i = 1; i + 1 < rest.length; i += 2) obj[String(rest[i])] = rest[i + 1];
    data = obj;
  }
  return one("update", ref, data);
}
export const deleteDoc = (ref) => store.write([{ t: "delete", col: ref._col, id: ref.id }]).then(() => undefined);
export async function addDoc(colRef, data) {
  const ref = doc(colRef);
  await one("set", ref, data);
  return ref;
}

export function writeBatch() {
  const ops = [];
  const b = {
    set(ref, data, opts = {}) {
      ops.push({ t: opts.merge ? "merge" : "set", col: ref._col, id: ref.id, data });
      return b;
    },
    update(ref, data) {
      ops.push({ t: "update", col: ref._col, id: ref.id, data });
      return b;
    },
    delete(ref) {
      ops.push({ t: "delete", col: ref._col, id: ref.id });
      return b;
    },
    async commit() {
      for (let i = 0; i < ops.length; i += 400) await store.write(ops.slice(i, i + 400));
    },
  };
  return b;
}

export async function runTransaction(_db, fn) {
  for (let attempt = 1; ; attempt++) {
    const reads = new Map();
    const ops = [];
    const t = {
      async get(ref) {
        const row = await store.getDoc(ref._col, ref.id);
        reads.set(ref.path, row ? { exists: true, updated_at: row.updatedAt } : { exists: false });
        return new DocumentSnapshot(ref, row);
      },
      set: (ref, data, opts = {}) => (ops.push({ t: opts.merge ? "merge" : "set", col: ref._col, id: ref.id, data }), t),
      update: (ref, data) => (ops.push({ t: "update", col: ref._col, id: ref.id, data }), t),
      delete: (ref) => (ops.push({ t: "delete", col: ref._col, id: ref.id }), t),
    };
    const result = await fn(t);
    try {
      await store.write(ops.map((o) => ({ ...o, ...(reads.has(`${o.col}/${o.id}`) ? { expect: reads.get(`${o.col}/${o.id}`) } : {}) })));
      return result;
    } catch (e) {
      if (e?.code === "aborted" && attempt < 6) continue;
      throw e;
    }
  }
}

// ---------- قيم خاصة ----------
export const serverTimestamp = OPS.now;
export const increment = OPS.inc;
export const arrayUnion = OPS.union;
export const arrayRemove = OPS.remove;
export const deleteField = OPS.del;

// توافق مع "firebase/firestore/lite" وتهيئات قديمة
export const initializeFirestore = () => getFirestore();
export const enableIndexedDbPersistence = async () => {};
