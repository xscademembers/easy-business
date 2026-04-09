/**
 * Clamp camera zoom to minimum (widest field of view / 1×) when the browser exposes it.
 * No-op if unsupported — common on desktop and some mobile WebViews.
 */
export async function resetCameraZoomTo1x(stream: MediaStream): Promise<void> {
  const track = stream.getVideoTracks()[0];
  if (!track?.getCapabilities) return;

  const caps = track.getCapabilities() as MediaTrackCapabilities & {
    zoom?: { min: number; max: number; step?: number };
  };

  const z = caps.zoom;
  if (z == null || typeof z.min !== 'number') return;

  const zoomMin = z.min;
  const withAdvanced = {
    advanced: [{ zoom: zoomMin }],
  } as unknown as MediaTrackConstraints;
  const flatZoom = { zoom: zoomMin } as unknown as MediaTrackConstraints;

  try {
    await track.applyConstraints(withAdvanced);
  } catch {
    try {
      await track.applyConstraints(flatZoom);
    } catch {
      /* optional */
    }
  }
}
