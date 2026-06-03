import { Alignment, Fit, Layout, useRive } from '@rive-app/react-webgl2';
import { SLIM_RIVE_SRC } from './uploadIconRiveBinding';

const ARTBOARD = 'icon';
const STATE_MACHINE = 'upload icon';

export default function GuestLandingRive() {
  const { RiveComponent, setContainerRef } = useRive(
    {
      src: SLIM_RIVE_SRC,
      artboard: ARTBOARD,
      stateMachines: STATE_MACHINE,
      autoplay: true,
      layout: new Layout({ fit: Fit.Contain, alignment: Alignment.Center }),
    },
    { shouldResizeCanvasToContainer: true }
  );

  return (
    <div ref={setContainerRef} className="guest-landing__cta-rive-wrap">
      <RiveComponent className="guest-landing__cta-rive" aria-hidden />
    </div>
  );
}
