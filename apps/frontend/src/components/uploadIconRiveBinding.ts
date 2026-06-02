import type { Rive, ViewModelInstance } from '@rive-app/webgl2';

export const SLIM_RIVE_SRC = '/slim.riv';
export const ICON_VIEW_MODEL = 'UploadDrawer';
export const ICON_INSTANCE_NAME = 'Instance';

export function bindUploadIconViewModel(rive: Rive): ViewModelInstance | null {
  const viewModel = rive.viewModelByName(ICON_VIEW_MODEL);
  if (!viewModel) return null;

  const instance =
    viewModel.instanceByName(ICON_INSTANCE_NAME) ??
    viewModel.defaultInstance() ??
    viewModel.instance();

  rive.bindViewModelInstance(instance);
  return instance;
}
