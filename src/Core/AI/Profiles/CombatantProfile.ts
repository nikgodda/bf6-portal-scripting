import { CoreAI_AProfile } from './AProfile'
import { CoreAI_ITaskScoringEntry } from '../Modules/Task/ITaskScoringEntry'

import { CoreAI_FightBehavior } from '../Modules/Behavior/Behaviors/FightBehavior'
import { CoreAI_DefendBehavior } from '../Modules/Behavior/Behaviors/DefendBehavior'
import { CoreAI_MoveToBehavior } from '../Modules/Behavior/Behaviors/MoveToBehavior'

import { CoreAI_FightSensor } from '../Modules/Perception/Sensors/FightSensor'
import { CoreAI_ClosestEnemySensor } from '../Modules/Perception/Sensors/MoveTo/ClosestEnemySensor'
import { CoreAI_ArrivalSensor } from '../Modules/Perception/Sensors/ArrivalSensor'
import { CoreAI_OnfootMoveToSensor } from '../Modules/Perception/Sensors/MoveTo/OnfootMoveToSensor'
import { CoreAI_CapturePointMoveToSensor } from '../Modules/Perception/Sensors/MoveTo/CapturePointMoveToSensor'
import { CoreAI_DriverMoveToSensor } from '../Modules/Perception/Sensors/MoveTo/DriverMoveToSensor'

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
        getWPs?: () => mod.Vector[]
        intervalMs?: number
        distanceThreshold?: number
        ttlMs?: number
        cooldownMs?: number
    }
    onfootMoveToSensor?: {
        getWPs?: () => mod.Vector[]
        intervalMs?: number
        ttlMs?: number
    }
    driverMoveToSensor?: {
        getWPs?: () => mod.Vector[]
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

        const getMoveMode = (brain: { player: mod.Player }) => {
            const player = brain.player
            if (!mod.IsPlayerValid(player)) return 'onfoot'

            const inVehicle = mod.GetSoldierState(
                player,
                mod.SoldierStateBool.IsInVehicle
            )
            if (!inVehicle) return 'onfoot'

            const vehicle = mod.GetVehicleFromPlayer(player)
            if (!vehicle) return 'onfoot'

            const driver = mod.GetPlayerFromVehicleSeat(vehicle, 0)
            return mod.IsPlayerValid(driver) && mod.Equals(driver, player)
                ? 'driver'
                : 'onfoot'
        }

        this.scoring = [
            {
                score: (brain) => {
                    const m = brain.memory
                    return m.get('isInBattle') ? 200 : 0
                },
                factory: (brain) => new CoreAI_FightBehavior(brain),
            },

            {
                score: (brain) => (brain.memory.get('closestEnemy') ? 150 : 0),
                factory: (brain) =>
                    new CoreAI_MoveToBehavior(
                        brain,
                        brain.memory.get('moveToPos')!,
                        mod.MoveSpeed.InvestigateRun,
                        brain.memory.get('closestEnemy'),
                        getMoveMode(brain)
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
                            : mod.MoveSpeed.Run,
                        null,
                        getMoveMode(brain)
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

        if (options.arrivalSensor?.getWPs) {
            this.sensors.push(
                () =>
                    new CoreAI_ArrivalSensor(
                        () => options.arrivalSensor!.getWPs!(),
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
                    new CoreAI_CapturePointMoveToSensor(
                        () =>
                            options.moveToCapturePointSensor!
                                .getCapturePoints!(),
                        options.moveToCapturePointSensor?.intervalMs,
                        options.moveToCapturePointSensor?.ttlMs
                    )
            )
        }

        if (options.onfootMoveToSensor?.getWPs) {
            this.sensors.push(
                () =>
                    new CoreAI_OnfootMoveToSensor(
                        () => options.onfootMoveToSensor!.getWPs!(),
                        options.onfootMoveToSensor?.intervalMs,
                        options.onfootMoveToSensor?.ttlMs
                    )
            )
        }

        if (options.driverMoveToSensor?.getWPs) {
            this.sensors.push(
                () =>
                    new CoreAI_DriverMoveToSensor(
                        () => options.driverMoveToSensor!.getWPs!(),
                        options.driverMoveToSensor?.intervalMs,
                        options.driverMoveToSensor?.ttlMs
                    )
            )
        }
    }
}
