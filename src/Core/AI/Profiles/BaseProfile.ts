import { CoreAI_AProfile, CoreAI_SensorOptions } from './AProfile'
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

export type CoreAI_BaseProfileOptions = CoreAI_SensorOptions

export class CoreAI_BaseProfile extends CoreAI_AProfile {
    constructor(options: CoreAI_BaseProfileOptions = {}) {
        super()

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
                        this.getMoveMode(brain)
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
                        this.getMoveMode(brain)
                    ),
            },
        ] as CoreAI_ITaskScoringEntry[]
        this.buildSensors(options)
    }
    protected getMoveMode(brain: { player: mod.Player }): 'onfoot' | 'driver' {
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

    /**
     * Shared sensor wiring for universal profiles.
     * Extend this class to add game-mode specific sensors.
     */

    protected buildSensors(options: CoreAI_BaseProfileOptions): void {
        this.addSensorIf(
            options.fightSensor,
            () =>
                new CoreAI_FightSensor(
                    options.fightSensor?.intervalMs,
                    options.fightSensor?.ttlMs
                )
        )

        this.addSensorIf(
            options.closestEnemySensor,
            () =>
                new CoreAI_ClosestEnemySensor(
                    options.closestEnemySensor?.sensitivity,
                    options.closestEnemySensor?.intervalMs,
                    options.closestEnemySensor?.ttlMs
                )
        )

        this.addSensorIf(
            options.arrivalSensor?.getWPs,
            () =>
                new CoreAI_ArrivalSensor(
                    () => options.arrivalSensor!.getWPs!(),
                    options.arrivalSensor?.intervalMs,
                    options.arrivalSensor?.distanceThreshold,
                    options.arrivalSensor?.ttlMs,
                    options.arrivalSensor?.cooldownMs
                )
        )

        this.addSensorIf(
            options.moveToCapturePointSensor?.getCapturePoints,
            () =>
                new CoreAI_CapturePointMoveToSensor(
                    () => options.moveToCapturePointSensor!.getCapturePoints!(),
                    options.moveToCapturePointSensor?.intervalMs,
                    options.moveToCapturePointSensor?.ttlMs
                )
        )

        this.addSensorIf(
            options.onfootMoveToSensor?.getWPs,
            () =>
                new CoreAI_OnfootMoveToSensor(
                    () => options.onfootMoveToSensor!.getWPs!(),
                    options.onfootMoveToSensor?.intervalMs,
                    options.onfootMoveToSensor?.ttlMs
                )
        )

        this.addSensorIf(
            options.driverMoveToSensor?.getWPs,
            () =>
                new CoreAI_DriverMoveToSensor(
                    () => options.driverMoveToSensor!.getWPs!(),
                    options.driverMoveToSensor?.intervalMs,
                    options.driverMoveToSensor?.ttlMs
                )
        )
    }
}
