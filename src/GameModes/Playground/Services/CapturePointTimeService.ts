import { CorePlayer_IGameModeEngineEvents } from 'src/Core/IGameModeEngineEvents'
import { PG_GameMode } from '../PG_GameMode'

export class CapturePointTimeService {
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

        let entry = this.captureProgressMap.get(capturePointId)

        if (!entry) {
            entry = {
                captureProgress,
                isCapturing: null,
            }
            this.captureProgressMap.set(capturePointId, entry)
        }

        if (captureProgress < entry.captureProgress) {
            // Neutralization
            if (entry.isCapturing !== false) {
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
            if (entry.isCapturing !== true) {
                mod.SetCapturePointCapturingTime(eventCapturePoint, this.time)
            }

            this.captureProgressMap.set(capturePointId, {
                captureProgress,
                isCapturing: true,
            })
        }
    }
}
