import { useRef, useLayoutEffect, useEffect, type ReactNode } from 'react';
import { useContextBridge, FiberProvider } from 'its-fine';
import { createRoot } from '@pixi/react';

/**
 * Drop-in replacement for @pixi/react's <Application> that does NOT
 * re-set application properties (width, height, background, etc.) on
 * every re-render. The original <Application> calls app[key]=value for
 * all options on every render, which causes a canvas flash.
 *
 * root.render() in @pixi/react is async. When sub-agents spawn, rapid
 * React re-renders cause multiple concurrent root.render() calls that
 * race each other — one may clear the canvas while another hasn't
 * finished, producing a dark flash.
 *
 * Fix: serialize render calls so only the latest pending JSX is rendered
 * after the current async render completes. This coalesces intermediate
 * updates and eliminates the race.
 */

interface StableApplicationProps {
  children: ReactNode;
  className?: string;
  width?: number;
  height?: number;
  background?: number;
  antialias?: boolean;
  resolution?: number;
  autoDensity?: boolean;
  [key: string]: unknown;
}

function StableApplicationInner({
  children,
  className,
  ...applicationProps
}: StableApplicationProps) {
  const Bridge = useContextBridge();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const initializedRef = useRef(false);
  // Serialize async root.render() calls to prevent concurrent races
  const renderingRef = useRef(false);
  const pendingJsxRef = useRef<ReactNode | null>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!rootRef.current) {
      rootRef.current = createRoot(canvas);
    }

    const root = rootRef.current;
    const jsx = <Bridge>{children}</Bridge>;

    if (!initializedRef.current) {
      // First render: pass all options to initialize the Pixi app
      initializedRef.current = true;
      renderingRef.current = true;
      root.render(jsx, applicationProps).then(() => {
        renderingRef.current = false;
        // Flush any pending update that arrived during init
        const pending = pendingJsxRef.current;
        if (pending !== null) {
          pendingJsxRef.current = null;
          doRender(root, pending);
        }
      });
    } else if (renderingRef.current) {
      // A render is in-flight — just stash the latest JSX (coalesce)
      pendingJsxRef.current = jsx;
    } else {
      doRender(root, jsx);
    }
  });

  function doRender(root: ReturnType<typeof createRoot>, jsx: ReactNode) {
    renderingRef.current = true;
    root.render(jsx, {}).then(() => {
      renderingRef.current = false;
      // If another update arrived while we were rendering, flush it
      const pending = pendingJsxRef.current;
      if (pending !== null) {
        pendingJsxRef.current = null;
        doRender(root, pending);
      }
    });
  }

  useEffect(() => {
    return () => {
      // Cleanup: destroy the Pixi app on unmount
      const root = rootRef.current;
      if (root) {
        try {
          root.applicationState?.app?.destroy(true);
        } catch (e) {
          console.warn('[StableApplication] Cleanup error:', e);
        }
        rootRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []);

  return <canvas ref={canvasRef} className={className} />;
}

export function StableApplication(props: StableApplicationProps) {
  return (
    <FiberProvider>
      <StableApplicationInner {...props} />
    </FiberProvider>
  );
}
