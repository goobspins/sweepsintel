import { useState } from 'react';

import StateReportForm from '../forms/StateReportForm';

interface StateReportLauncherProps {
  stateCode: string;
  stateName: string;
  casinos: Array<{ id: number; name: string }>;
  providers: Array<{ id: number; name: string }>;
}

export default function StateReportLauncher({
  stateCode,
  stateName,
  casinos,
  providers,
}: StateReportLauncherProps) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      {message ? <div className="toast">{message}</div> : null}
      <button type="button" className="launch-button" onClick={() => setOpen(true)}>
        {'Report a state availability change ->'}
      </button>
      {open ? (
        <StateReportForm
          stateCode={stateCode}
          stateName={stateName}
          casinos={casinos}
          providers={providers}
          onClose={() => setOpen(false)}
          onSuccess={setMessage}
        />
      ) : null}
      <style>{`
        .launch-button {
          border:none; border-radius:999px; padding:.85rem 1rem; background:var(--color-primary);
          color:#fff; font:inherit; font-weight:700; cursor:pointer;
        }
        .toast {
          position:sticky; top:1rem; z-index:20; justify-self:start; padding:.85rem 1rem;
          border-radius:999px; font-weight:700; background:#ecfdf5; color:#065f46; margin-bottom:1rem;
        }
      `}</style>
    </>
  );
}
