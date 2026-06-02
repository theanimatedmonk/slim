import type { Rive, ViewModelInstance } from '@rive-app/webgl2';

export const PROGRESS_RIVE_SRC = '/progress-bar.riv';
export const PROGRESS_VIEW_MODEL = 'UploadDrawer';
export const PROGRESS_INSTANCE_NAME = 'Instance';

export function bindUploadProgressViewModel(rive: Rive): ViewModelInstance | null {
  const viewModel = rive.viewModelByName(PROGRESS_VIEW_MODEL);
  if (!viewModel) return null;

  const instance =
    viewModel.instanceByName(PROGRESS_INSTANCE_NAME) ??
    viewModel.defaultInstance() ??
    viewModel.instance();

  rive.bindViewModelInstance(instance);
  return instance;
}

export function setUploadProgress(instance: ViewModelInstance, progress: number): void {
  const clamped = Math.min(100, Math.max(0, progress));
  const prop = instance.number('progress');
  if (prop) {
    prop.value = clamped;
  }
}
