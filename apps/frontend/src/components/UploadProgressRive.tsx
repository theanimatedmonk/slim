import { useEffect, useRef } from 'react';
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceNumber,
} from '@rive-app/react-webgl2';
import {
  PROGRESS_RIVE_SRC,
  PROGRESS_INSTANCE_NAME,
  PROGRESS_VIEW_MODEL,
} from './uploadProgressRiveBinding';

const ARTBOARD = 'progress bar';
const STATE_MACHINE = 'progress bar';
/** Higher = snappier catch-up to the real upload %. */
const SMOOTH_SPEED = 10;

interface Props {
  /** 0–100, should match the % label under the bar */
  progress: number;
  /** When false, canvas preloads off-screen (idle). */
  active?: boolean;
}

export default function UploadProgressRive({ progress, active = true }: Props) {
  const target = Math.min(100, Math.max(0, progress));
  const targetRef = useRef(target);
  const displayRef = useRef(0);
  targetRef.current = target;

  const { RiveComponent, setContainerRef, rive } = useRive(
    {
      src: PROGRESS_RIVE_SRC,
      artboard: ARTBOARD,
      stateMachines: STATE_MACHINE,
      autoplay: true,
      autoBind: false,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    },
    { shouldResizeCanvasToContainer: true }
  );

  const viewModel = useViewModel(rive, { name: PROGRESS_VIEW_MODEL });
  const viewModelInstance = useViewModelInstance(viewModel, {
    name: PROGRESS_INSTANCE_NAME,
    rive,
  });
  const { setValue: setProgress } = useViewModelInstanceNumber('progress', viewModelInstance);
  const wasActiveRef = useRef(active);

  const pushProgress = (value: number) => {
    displayRef.current = value;
    setProgress?.(value);
  };

  // Rive artboard defaults progress ~50; always override once the view model binds.
  useEffect(() => {
    if (!viewModelInstance || !setProgress) return;
    pushProgress(0);
  }, [viewModelInstance, setProgress]);

  useEffect(() => {
    if (!setProgress) return;

    if (active && !wasActiveRef.current) {
      pushProgress(0);
    } else if (!active) {
      pushProgress(0);
    }

    wasActiveRef.current = active;
  }, [active, setProgress]);

  useEffect(() => {
    if (!viewModelInstance || !setProgress) return;

    let rafId = 0;
    let lastFrame = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      const goal = active ? targetRef.current : 0;
      let next = displayRef.current;

      if (!active && goal === 0) {
        next = 0;
      } else {
        const alpha = 1 - Math.exp(-SMOOTH_SPEED * dt);
        next = displayRef.current + (goal - displayRef.current) * alpha;
        if (active) {
          next = Math.max(displayRef.current, next);
        }
      }

      if (Math.abs(next - displayRef.current) > 0.01) {
        pushProgress(next);
      }

      const atRest =
        !active && displayRef.current === 0 && targetRef.current === 0;
      const needsUpdate = Math.abs(goal - displayRef.current) > 0.01;
      if (!atRest && (active || needsUpdate)) {
        rafId = requestAnimationFrame(tick);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [viewModelInstance, setProgress, active]);

  return (
    <div
      ref={setContainerRef}
      className="upload-dropzone__progress-wrap"
      role={active ? 'progressbar' : undefined}
      aria-hidden={!active}
      aria-valuemin={active ? 0 : undefined}
      aria-valuemax={active ? 100 : undefined}
      aria-valuenow={active ? Math.round(target) : undefined}
      aria-label={active ? 'Upload progress' : undefined}
    >
      <RiveComponent className="upload-dropzone__rive-progress" aria-hidden />
    </div>
  );
}
