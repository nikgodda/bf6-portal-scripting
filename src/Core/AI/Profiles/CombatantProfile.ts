import { CoreAI_AProfile } from './AProfile'
import { CoreAI_ITaskScoringEntry } from '../Modules/Task/ITaskScoringEntry'

import { CoreAI_FightBehavior } from '../Modules/Behavior/Behaviors/FightBehavior'
import { CoreAI_ClosestEnemyBehavior } from '../Modules/Behavior/Behaviors/ClosestEnemyBehavior'
import { CoreAI_DefendBehavior } from '../Modules/Behavior/Behaviors/DefendBehavior'
import { CoreAI_MoveToBehavior } from '../Modules/Behavior/Behaviors/MoveToBehavior'

import { CoreAI_FightSensor } from '../Modules/Perception/Sensors/FightSensor'
import { CoreAI_ClosestEnemySensor } from '../Modules/Perception/Sensors/ClosestEnemySensor'
import { CoreAI_ArrivalSensor } from '../Modules/Perception/Sensors/ArrivalSensor'
import { CoreAI_MoveToSensor } from '../Modules/Perception/Sensors/MoveToSensor'
import { CoreAI_MoveToCapturePointSensor } from '../Modules/Perception/Sensors/MoveToCapturePointSensor'
import { CoreAI_VehicleMoveToSensor } from '../Modules/Perception/Sensors/VehicleMoveToSensor'

export interface CoreAI_CombatantProfileOptions {
    fightSensor?: {
        intervalMs?: number
        ttlMs?: number
    }
    closestEnemySensor?: {
        sensitivity?: number
        intervalMs?: number
        ttlMs?: number
    }
    arrivalSensor?: {
        getDefendWPs?: () => mod.Vector[]
        intervalMs?: number
        distanceThreshold?: number
        ttlMs?: number
        cooldownMs?: number
    }
    moveToSensor?: {
        getRoamWPs?: () => mod.Vector[]
        intervalMs?: number
        ttlMs?: number
    }
    vehicleMoveToSensor?: {
        getVehicleWPs?: () => mod.Vector[]
        intervalMs?: number
        ttlMs?: number
    }
    moveToCapturePointSensor?: {
        getCapturePoints?: () => mod.CapturePoint[]
        intervalMs?: number
        ttlMs?: number
    }
}

export class CoreAI_CombatantProfile extends CoreAI_AProfile {
    constructor(options: CoreAI_CombatantProfileOptions = {}) {
        super()

        this.scoring = [
            {
                score: (brain) => {
                    const m = brain.memory
                    return m.get('isFiring') || m.get('damagedBy') ? 200 : 0
                },
                factory: (brain) => new CoreAI_FightBehavior(brain),
            },

            {
                score: (brain) => (brain.memory.get('closestEnemy') ? 150 : 0),
                factory: (brain) =>
                    new CoreAI_ClosestEnemyBehavior(
                        brain,
                        brain.memory.get('closestEnemy')!,
                        mod.MoveSpeed.InvestigateRun
                    ),
            },

            {
                score: (brain) => (brain.memory.get('arrivedPos') ? 120 : 0),
                factory: (brain) =>
                    new CoreAI_DefendBehavior(
                        brain,
                        brain.memory.get('arrivedPos')!,
                        2.0,
                        8.0
                    ),
            },

            {
                score: (brain) => (brain.memory.get('moveToPos') ? 20 : 0),
                factory: (brain) =>
                    new CoreAI_MoveToBehavior(
                        brain,
                        brain.memory.get('moveToPos')!,
                        Math.random() < 0.3
                            ? mod.MoveSpeed.Sprint
                            : mod.MoveSpeed.Run
                    ),
            },
        ] as CoreAI_ITaskScoringEntry[]

        this.sensors = [
            () =>
                new CoreAI_FightSensor(
                    options.fightSensor?.intervalMs,
                    options.fightSensor?.ttlMs
                ),
            () =>
                new CoreAI_ClosestEnemySensor(
                    options.closestEnemySensor?.sensitivity,
                    options.closestEnemySensor?.intervalMs,
                    options.closestEnemySensor?.ttlMs
                ),
        ]

        if (options.arrivalSensor?.getDefendWPs) {
            this.sensors.push(
                () =>
                    new CoreAI_ArrivalSensor(
                        () => options.arrivalSensor!.getDefendWPs!(),
                        options.arrivalSensor?.intervalMs,
                        options.arrivalSensor?.distanceThreshold,
                        options.arrivalSensor?.ttlMs,
                        options.arrivalSensor?.cooldownMs
                    )
            )
        }

        if (options.moveToCapturePointSensor?.getCapturePoints) {
            this.sensors.push(
                () =>
                    new CoreAI_MoveToCapturePointSensor(
                        () =>
                            options.moveToCapturePointSensor!
                                .getCapturePoints!(),
                        options.moveToCapturePointSensor?.intervalMs,
                        options.moveToCapturePointSensor?.ttlMs
                    )
            )
        }

        if (options.moveToSensor?.getRoamWPs) {
            this.sensors.push(
                () =>
                    new CoreAI_MoveToSensor(
                        () => options.moveToSensor!.getRoamWPs!(),
                        options.moveToSensor?.intervalMs,
                        options.moveToSensor?.ttlMs
                    )
            )
        }

        if (options.vehicleMoveToSensor?.getVehicleWPs) {
            this.sensors.push(
                () =>
                    new CoreAI_VehicleMoveToSensor(
                        () => options.vehicleMoveToSensor!.getVehicleWPs!(),
                        options.vehicleMoveToSensor?.intervalMs,
                        options.vehicleMoveToSensor?.ttlMs
                    )
            )
        }
    }
}
