import { CoreAI_ASensor } from '../Modules/Perception/Sensors/ASensor'
import { CoreAI_ITaskScoringEntry } from '../Modules/Task/ITaskScoringEntry'

/**
 * CoreAI_AProfile:
 * Base AI profile.
 *
 * Contains:
 *  - scoring: list of behavior scoring entries
 *  - sensors: list of sensor factory functions
 *
 * Each sensor factory returns a new sensor instance:
 *    () => new SomeSensor(...)
 *
 * This ensures every AI brain receives fresh, isolated sensors.
 */
export abstract class CoreAI_AProfile {
    /** Task scoring table for behaviors. */
    scoring: CoreAI_ITaskScoringEntry[] = []

    /** Sensor factories. Each returns a new CoreAI_ASensor instance. */
    sensors: (() => CoreAI_ASensor)[] = []
}
