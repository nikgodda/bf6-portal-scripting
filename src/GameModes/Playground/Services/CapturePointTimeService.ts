import { CorePlayer_IGameModeEngineEvents } from 'src/Core/IGameModeEngineEvents'
import { PG_GameMode } from '../PG_GameMode'

export class CapturePointTimeService
    implements CorePlayer_IGameModeEngineEvents
{
    private readonly captureProgressMap = new Map<
        number,
        {
            captureProgress: number
            isCapturing: boolean | null
        }
    >()

    constructor(
        private readonly gameMode: PG_GameMode,
        private readonly time: number = 3
    ) {
        this.gameMode.addListener(this)
    }

    OngoingCapturePoint(eventCapturePoint: mod.CapturePoint): void {
        const captureProgress = mod.GetCaptureProgress(eventCapturePoint)

        if (captureProgress === 0 || captureProgress === 1) {
            return
        }

        const capturePointId = mod.GetObjId(eventCapturePoint)

        const captureProgressMapEntry =
            this.captureProgressMap.get(capturePointId)

        if (!captureProgressMapEntry) {
            this.captureProgressMap.set(capturePointId, {
                captureProgress,
                isCapturing: null,
            })
        }

        if (captureProgress < captureProgressMapEntry!.captureProgress) {
            // Neutralization
            if (captureProgressMapEntry?.isCapturing !== false) {
                mod.SetCapturePointNeutralizationTime(
                    eventCapturePoint,
                    this.time
                )
            }

            this.captureProgressMap.set(capturePointId, {
                captureProgress,
                isCapturing: false,
            })
        } else {
            // Capturing
            if (captureProgressMapEntry?.isCapturing !== true) {
                mod.SetCapturePointCapturingTime(eventCapturePoint, this.time)
            }

            this.captureProgressMap.set(capturePointId, {
                captureProgress,
                isCapturing: true,
            })
        }
    }
}
