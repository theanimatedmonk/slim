import { useEffect, useRef } from 'react';
import {
  Alignment,
  Fit,
  Layout,
  useRive,
  useViewModel,
  useViewModelInstance,
  useViewModelInstanceTrigger,
} from '@rive-app/react-webgl2';
import {
  ZIP_INSTANCE_NAME,
  ZIP_RIVE_SRC,
  ZIP_VIEW_MODEL,
} from './bulkZipRiveBinding';

const ARTBOARD = 'download zip';
const STATE_MACHINE = 'zip';

interface Props {
  /** Increment to fire the Rive success trigger when a ZIP download completes. */
  successSignal?: number;
}

export default function BulkZipRive({ successSignal = 0 }: Props) {
  const prevSuccessSignalRef = useRef(successSignal);

  const { rive, RiveComponent, setContainerRef } = useRive(
    {
      src: ZIP_RIVE_SRC,
      artboard: ARTBOARD,
      stateMachines: STATE_MACHINE,
      autoplay: true,
      autoBind: false,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    },
    { shouldResizeCanvasToContainer: true }
  );

  const viewModel = useViewModel(rive, { name: ZIP_VIEW_MODEL });
  const viewModelInstance = useViewModelInstance(viewModel, {
    name: ZIP_INSTANCE_NAME,
    rive,
  });
  const { trigger: fireSuccess } = useViewModelInstanceTrigger('success', viewModelInstance);

  useEffect(() => {
    if (successSignal === prevSuccessSignalRef.current) return;
    prevSuccessSignalRef.current = successSignal;
    if (successSignal > 0) {
      fireSuccess?.();
    }
  }, [successSignal, fireSuccess]);

  return (
    <div ref={setContainerRef} className="bulk-action-bar__zip-rive-wrap">
      <RiveComponent className="bulk-action-bar__zip-rive" aria-hidden />
    </div>
  );
}
