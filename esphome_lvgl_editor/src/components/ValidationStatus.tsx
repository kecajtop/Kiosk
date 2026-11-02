import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { selfTestRoundTrip } from '../utils/yamlConverter';

// Live "would this still load back correctly?" indicator. Re-runs a short
// while after every edit (debounced, so a drag doesn't trigger it mid-move)
// and lets you open a report of exactly what drifted, instead of only
// finding out when an Export/Save produces broken YAML.
export const ValidationStatus: React.FC = () => {
  const { config, rawEsphomeYaml } = useEditorStore();
  const [result, setResult] = useState<{ ok: boolean; issues: string[] } | null>(null);
  const [checking, setChecking] = useState(true);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runCheck = () => {
    setChecking(true);
    setResult(selfTestRoundTrip(config, rawEsphomeYaml));
    setChecking(false);
  };

  useEffect(() => {
    setChecking(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runCheck, 700);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, rawEsphomeYaml]);

  const ok = result?.ok ?? true;
  const issueCount = result?.issues.length ?? 0;

  const colors = checking
    ? { bg: '#333', fg: '#aaa', border: '#444' }
    : ok
      ? { bg: '#1a3a1a', fg: '#4ec94e', border: '#3a6a3a' }
      : { bg: '#3a2a1a', fg: '#f0a500', border: '#604a1a' };

  return (
    <>
      <button
        onClick={() => { runCheck(); setOpen(true); }}
        title="Check that the current dashboard would still export and load back correctly"
        style={{
          backgroundColor: colors.bg, color: colors.fg, border: `1px solid ${colors.border}`,
          borderRadius: '4px', padding: '8px 12px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: '6px', fontSize: '14px'
        }}
      >
        {checking ? null : ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        {checking ? 'Checking…' : ok ? 'Validate: OK' : `Validate: ${issueCount} issue${issueCount !== 1 ? 's' : ''}`}
      </button>

      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
          }}
          onClick={() => setOpen(false)}
        >
          <div
            style={{
              backgroundColor: '#1e1e1e', border: '1px solid #555', borderRadius: '8px', padding: '24px',
              width: '560px', maxWidth: '95vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '14px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {ok ? <CheckCircle2 size={20} color="#4ec94e" /> : <AlertTriangle size={20} color="#f0a500" />}
                <span style={{ color: '#fff', fontWeight: 700, fontSize: '16px' }}>
                  {ok ? 'Looks good' : 'Round-trip problems found'}
                </span>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ margin: 0, color: '#aaa', fontSize: '13px' }}>
              This re-generates the YAML for the dashboard exactly as Export/Save would, then re-loads it
              and compares it against what is currently on screen — the same check that runs before a save
              to an ESPHome file, run here on demand against whatever you're currently editing.
            </p>

            {ok ? (
              <p style={{ margin: 0, color: '#4ec94e', fontSize: '13px' }}>
                No drift detected: exporting and reloading this dashboard right now would reproduce it exactly.
              </p>
            ) : (
              <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '50vh' }}>
                {(result?.issues ?? []).map((issue, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                    background: '#2a2a2a', borderRadius: '6px', padding: '8px 12px',
                    borderLeft: '3px solid #f0a500'
                  }}>
                    <AlertTriangle size={14} color="#f0a500" style={{ marginTop: '2px', flexShrink: 0 }} />
                    <span style={{ color: '#e0e0e0', fontSize: '13px' }}>{issue}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: '#61dafb', color: '#000', border: 'none',
                  borderRadius: '4px', padding: '7px 18px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
