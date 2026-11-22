import React, { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';
import { serializePageForPreview } from '../utils/lvglPreviewSerializer';
import { renderLvglScene } from '../wasm/lvglPreview';
import { parseHexColor } from '../utils/colorUtils';

// Pokazuje stronę renderowaną przez PRAWDZIWY LVGL (skompilowany do WebAssembly, patrz
// wasm/README.md), a nie przez przybliżenie CSS używane w CanvasWidget.tsx. To widok
// tylko-do-podglądu w v1: nie da się w nim przeciągać/edytować widgetów (edycja zostaje
// w zwykłym Canvas.tsx) — to jedyny sposób, żeby sprawdzić, jak layout faktycznie wygląda
// w realnym LVGL, bez przebudowy ESPHome.
export const RealLvglPreview: React.FC = () => {
  const { displaySize, previewScale, config, currentPageId } = useEditorStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const scaleFactor = previewScale / 100;
  const bgColor = config.bg_color ? parseHexColor(config.bg_color) : '#000000';

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setRendering(true);
      const scene = serializePageForPreview(config, currentPageId);
      renderLvglScene(displaySize.width, displaySize.height, scene)
        .then((rgba) => {
          if (cancelled) return;
          setError(null);
          const canvas = canvasRef.current;
          if (!canvas) return;
          canvas.width = displaySize.width;
          canvas.height = displaySize.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          // TS 5.7+ zapożycza generyczny typ `Uint8ClampedArray<ArrayBufferLike>` z HEAPU8
          // (bufor WASM może być `SharedArrayBuffer` przy ALLOW_MEMORY_GROWTH), ale w runtime
          // to zwykła, świeżo zaalokowana tablica — rzutowanie jest tu bezpieczne.
          const imageData = new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, displaySize.width, displaySize.height);
          ctx.putImageData(imageData, 0, 0);
        })
        .catch((err) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        })
        .finally(() => {
          if (!cancelled) setRendering(false);
        });
    }, 150); // debounce - unikamy przerenderowania przy każdym pojedynczym znaku wpisywanym w polu

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [config, currentPageId, displaySize.width, displaySize.height]);

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#252526',
        padding: '20px',
        overflow: 'auto',
        position: 'relative'
      }}
    >
      <div style={{
        position: 'absolute',
        top: '10px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '12px',
        color: '#fff',
        backgroundColor: '#1e1e1e',
        padding: '4px 12px',
        borderRadius: '4px',
        border: '1px solid #444',
        zIndex: 1000,
        fontWeight: 500,
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span>🔍 Prawdziwy podgląd LVGL</span>
        {rendering && <span style={{ color: '#888' }}>renderowanie…</span>}
      </div>

      <div
        style={{
          width: displaySize.width * scaleFactor,
          height: displaySize.height * scaleFactor,
          position: 'relative',
          flexShrink: 0
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: displaySize.width,
            height: displaySize.height,
            backgroundColor: bgColor,
            border: '2px solid #444',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            transform: `scale(${scaleFactor})`,
            transformOrigin: 'top left',
            imageRendering: 'pixelated'
          }}
        />
      </div>

      {error && (
        <div style={{
          marginTop: '16px',
          maxWidth: '480px',
          color: '#ff8080',
          fontSize: '13px',
          textAlign: 'center',
          backgroundColor: '#2c1a1a',
          border: '1px solid #663333',
          borderRadius: '4px',
          padding: '10px 14px'
        }}>
          Błąd renderowania podglądu LVGL: {error}
        </div>
      )}

      <p style={{ marginTop: '16px', fontSize: '12px', color: '#888', maxWidth: '480px', textAlign: 'center' }}>
        Ten widok renderuje stronę przez prawdziwą bibliotekę LVGL (WebAssembly) — nie da się w
        nim jeszcze przeciągać widgetów. Edycja działa normalnie w widoku "Edycja". Nie wszystkie
        typy widgetów i właściwości są jeszcze obsługiwane (patrz wasm/README.md).
      </p>
    </div>
  );
};
