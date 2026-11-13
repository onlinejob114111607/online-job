// عناصر واجهة مشتركة للوحة التحكم
export function Tag({ kind = "", children, title }) {
  return (
    <span className={`tag ${kind}`} title={title}>
      {children}
    </span>
  );
}

export function Kpi({ label, value, sub, color, hint }) {
  return (
    <div className="kpi" style={color ? { "--c": color } : undefined} title={hint}>
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">
        {value}
        {sub !== undefined && sub !== null && sub !== "" && <span className="kpi-sub">{sub}</span>}
      </div>
    </div>
  );
}

export function Panel({ title, actions, children, className = "" }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="panel-head">
          {title && <h3 className="panel-title">{title}</h3>}
          {actions && <div className="panel-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }) {
  return <div className="empty">{children}</div>;
}

export function SubTabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map(([k, l, n]) => (
        <button key={k} className={"tab" + (value === k ? " active" : "")} onClick={() => onChange(k)}>
          {l}
          {n ? <span className="tab-count">{n}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, actions, wide }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={"modal" + (wide ? " wide" : "")} onClick={(e) => e.stopPropagation()}>
        {title && <h3>{title}</h3>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, inline }) {
  return (
    <div className={"field" + (inline ? " field-inline" : "")}>
      {label && <label>{label}</label>}
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" />
      <span className="toggle-text">
        {label}
        {hint && <small>{hint}</small>}
      </span>
    </label>
  );
}

export function Progress({ parts }) {
  return (
    <div className="progress">
      {parts.map(([pct, cls], i) => (
        <i key={i} className={cls} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
      ))}
    </div>
  );
}

export function WorkerOff({ name }) {
  return (
    <div className="alert warn">
      {name} مطفي على الجوال — الأوامر رح تستنى لحد ما يشتغل.
    </div>
  );
}

export function HBars({ items, total }) {
  if (!total) return <div className="muted">لا يوجد بيانات</div>;
  return (
    <div className="hbars">
      {items.map(([label, n, color]) => (
        <div className="hbar" key={label}>
          <div className="hbar-head">
            <span>{label}</span>
            <span className="muted">
              {n} · {Math.round((n / total) * 100)}%
            </span>
          </div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(n / total) * 100}%`, background: color || undefined }} />
          </div>
        </div>
      ))}
    </div>
  );
}
