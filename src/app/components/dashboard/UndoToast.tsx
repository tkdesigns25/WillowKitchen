import React, { useEffect, useRef } from 'react';

interface Props {
  visible: boolean;
  label: string;
  windowMs: number;
  onUndo: () => void;
}

export function UndoToast({ visible, label, windowMs, onUndo }: Props) {
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = progressRef.current;
    if (!el) return;
    if (visible) {
      el.style.transition = 'none';
      el.style.width = '100%';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.transition = `width ${windowMs}ms linear`;
          el.style.width = '0%';
        });
      });
    } else {
      el.style.transition = 'none';
      el.style.width = '100%';
    }
  }, [visible, windowMs]);

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed', bottom: 20, left: '50%',
        transform: `translateX(-50%) translateY(${visible ? '0' : '120px'})`,
        zIndex: 800,
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 16px',
        background: 'var(--wk-ink)', color: 'var(--wk-vellum)',
        border: 'var(--wk-b)', borderRadius: 'var(--wk-r)',
        fontFamily: 'var(--wk-font-ui)', fontSize: 13, fontWeight: 700,
        whiteSpace: 'nowrap',
        transition: 'transform 0.3s ease',
        overflow: 'hidden',
      }}
    >
      <span>{label}.</span>
      <button
        onClick={onUndo}
        style={{
          padding: '4px 10px', background: 'var(--wk-vellum)', border: 'none', borderRadius: 'var(--wk-r)',
          color: 'var(--wk-ink)', fontFamily: 'var(--wk-font-ui)', fontWeight: 900,
          fontSize: 11, letterSpacing: '0.07em', textTransform: 'uppercase', cursor: 'pointer',
        }}
      >
        ↩ Take That Back
      </button>
      <div
        ref={progressRef}
        style={{
          height: 3, background: 'var(--wk-vellum)', borderRadius: 2,
          position: 'absolute', bottom: 0, left: 0, width: '100%',
        }}
      />
    </div>
  );
}
