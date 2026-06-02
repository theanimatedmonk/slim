import { useEffect, useRef, useState } from 'react';
import { Alignment, Fit, Layout, useRive } from '@rive-app/react-webgl2';
import type { ViewModelInstance } from '@rive-app/webgl2';
import type { UploadZonePhase } from '../hooks/useUpload';
import { SLIM_RIVE_SRC, bindUploadIconViewModel } from './uploadIconRiveBinding';

const ARTBOARD = 'icon';
const STATE_MACHINE = 'upload icon';

interface Props {
  zonePhase: UploadZonePhase;
}

function firePhaseTriggers(
  instance: ViewModelInstance,
  prev: UploadZonePhase,
  next: UploadZonePhase
): void {
  if (next === 'uploading' && prev !== 'uploading') {
    instance.trigger('uploading')?.trigger();
  }

  if (next === 'success' && prev === 'uploading') {
    instance.trigger('success')?.trigger();
  }
}

export default function UploadIconRive({ zonePhase }: Props) {
  const prevPhaseRef = useRef<UploadZonePhase>(zonePhase);
  const zonePhaseRef = useRef(zonePhase);
  const instanceRef = useRef<ViewModelInstance | null>(null);
  const boundRef = useRef(false);
  const [isBound, setIsBound] = useState(false);

  zonePhaseRef.current = zonePhase;

  const { rive, RiveComponent, setContainerRef } = useRive(
    {
      src: SLIM_RIVE_SRC,
      artboard: ARTBOARD,
      stateMachines: STATE_MACHINE,
      autoplay: true,
      autoBind: false,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    },
    { shouldResizeCanvasToContainer: true }
  );

  useEffect(() => {
    if (!rive || boundRef.current) return;

    const instance = bindUploadIconViewModel(rive);
    if (!instance) return;

    instanceRef.current = instance;
    boundRef.current = true;
    setIsBound(true);

    const next = zonePhaseRef.current;
    firePhaseTriggers(instance, prevPhaseRef.current, next);
    prevPhaseRef.current = next;
  }, [rive]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!isBound || !instance) return;

    const prev = prevPhaseRef.current;
    const next = zonePhase;
    if (prev === next) return;

    firePhaseTriggers(instance, prev, next);
    prevPhaseRef.current = next;
  }, [zonePhase, isBound]);

  return (
    <div ref={setContainerRef} className="upload-dropzone__icon-rive-wrap">
      <RiveComponent className="upload-dropzone__rive" aria-hidden />
    </div>
  );
}
