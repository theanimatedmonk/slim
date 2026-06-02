import { useEffect } from 'react';
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

interface Props {
  /** 0–100, should match the % label under the bar */
  progress: number;
  /** When false, canvas preloads off-screen (idle). */
  active?: boolean;
}

export default function UploadProgressRive({ progress, active = true }: Props) {
  const clamped = Math.min(100, Math.max(0, Math.round(progress)));

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

  useEffect(() => {
    if (!viewModelInstance || !setProgress) return;
    setProgress(clamped);
  }, [clamped, viewModelInstance, setProgress]);

  return (
    <div
      ref={setContainerRef}
      className="upload-dropzone__progress-wrap"
      role={active ? 'progressbar' : undefined}
      aria-hidden={!active}
      aria-valuemin={active ? 0 : undefined}
      aria-valuemax={active ? 100 : undefined}
      aria-valuenow={active ? clamped : undefined}
      aria-label={active ? 'Upload progress' : undefined}
    >
      <RiveComponent className="upload-dropzone__rive-progress" aria-hidden />
    </div>
  );
}
