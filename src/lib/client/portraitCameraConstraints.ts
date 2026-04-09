/**
 * Video constraints aligned with storefront portrait camera frames (`aspect-[3/4]`).
 * Hints the device to use a tall stream so preview fills the frame without letterboxing.
 */
export const PORTRAIT_FRAME_ASPECT = 3 / 4;

export function getPortraitCameraVideoConstraints(): MediaTrackConstraints {
  return {
    facingMode: 'environment',
    aspectRatio: { ideal: PORTRAIT_FRAME_ASPECT },
    width: { ideal: 1080 },
    height: { ideal: 1440 },
  };
}

const portraitFallbackConstraints: MediaTrackConstraints = {
  facingMode: 'environment',
  width: { ideal: 720 },
  height: { ideal: 1280 },
};

/**
 * Opens the rear camera with portrait-friendly constraints, falling back if the
 * device rejects `aspectRatio` (e.g. some desktop webcams).
 */
export async function getPortraitCameraMediaStream(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      video: getPortraitCameraVideoConstraints(),
    });
  } catch {
    return await navigator.mediaDevices.getUserMedia({
      video: portraitFallbackConstraints,
    });
  }
}
