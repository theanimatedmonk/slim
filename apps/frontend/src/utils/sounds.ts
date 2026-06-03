const DELETE_SRC = '/audio%20files/delete.mp3';

let deleteAudio: HTMLAudioElement | null = null;

export function playDeleteSound() {
  if (!deleteAudio) {
    deleteAudio = new Audio(DELETE_SRC);
    deleteAudio.preload = 'auto';
  }

  deleteAudio.pause();
  deleteAudio.currentTime = 0;
  void deleteAudio.play().catch(() => {});
}
