import React, { useRef } from 'react';

export function Section({ title, hint, children, aside }) {
  return (
    <section className="sec">
      {(title || aside) && (
        <div className="sec-head">
          {title && <h2 className="sec-title">{title}</h2>}
          {aside}
        </div>
      )}
      {hint && <p className="sec-hint">{hint}</p>}
      {children}
    </section>
  );
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} className={value === o.id ? 'on' : ''} onClick={() => onChange(o.id)} type="button">
          {o.name}
        </button>
      ))}
    </div>
  );
}

export function Slider({ id, label, value, min, max, step = 0.1, onChange, format = (v) => v }) {
  return (
    <label className="slider" htmlFor={id}>
      <span className="slider-top">
        <span>{label}</span>
        <span className="slider-val">{format(value)}</span>
      </span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export function Toggle({ id, label, checked, onChange }) {
  return (
    <label className="toggle" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-ui" aria-hidden="true" />
    </label>
  );
}

export function FileButton({ id, accept, multiple, onFiles, children, className = 'btn primary wide', disabled }) {
  const ref = useRef(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.click()} disabled={disabled}>
        {children}
      </button>
      <input
        id={id}
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          e.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}

export function Progress({ value, label }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar" style={{ width: `${Math.round(value * 100)}%` }} />
      {label && <span className="progress-label">{label}</span>}
    </div>
  );
}
