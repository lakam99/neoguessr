import React from 'react';

const ToastContext = React.createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const idRef = React.useRef(0);

  const remove = React.useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback((type, message, opts={}) => {
    const id = ++idRef.current;
    const dur = typeof opts.duration === 'number' ? opts.duration : 3200;
    setToasts((prev) => [...prev, { id, type, message }]);
    if (dur > 0) {
      setTimeout(() => remove(id), dur);
    }
  }, [remove]);

  const api = React.useMemo(() => ({
    toast: {
      success: (msg, opts) => push('success', msg, opts),
      error:   (msg, opts) => push('error', msg, opts),
      info:    (msg, opts) => push('info', msg, opts),
    }
  }), [push]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/* Viewport */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 space-y-2 z-[100] px-3 w-full max-w-md pointer-events-none lg:top-4 lg:right-4 lg:left-auto lg:bottom-auto lg:translate-x-0">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-xl ring-1 ring-white/10 p-3 shadow-lg shadow-black/20 flex items-start gap-3
              ${t.type==='success' ? 'bg-emerald-600/90' : t.type==='error' ? 'bg-rose-600/90' : 'bg-slate-800/95'}`}
          >
            <div className="shrink-0 mt-0.5">
              {t.type==='success' && <span className="inline-block w-2.5 h-2.5 rounded-full bg-white/90" />}
              {t.type==='error' && <span className="inline-block w-2.5 h-2.5 rounded-full bg-white/90" />}
              {t.type==='info' && <span className="inline-block w-2.5 h-2.5 rounded-full bg-white/90" />}
            </div>
            <div className="text-sm text-white/95">{t.message}</div>
            <button
              onClick={() => remove(t.id)}
              className="ml-auto -mr-1 px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20"
            >
              Close
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(){
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
