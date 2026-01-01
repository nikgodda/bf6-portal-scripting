import { CoreAI_AProfile, CoreAI_SensorOptions } from './AProfile'
import { CoreAI_ITaskScoringEntry } from '../Modules/Task/ITaskScoringEntry'

import { CoreAI_FightBehavior } from '../Modules/Behavior/Behaviors/FightBehavior'
import { CoreAI_DefendBehavior } from '../Modules/Behavior/Behaviors/DefendBehavior'
import { CoreAI_EnterVehicleBehavior } from '../Modules/Behavior/Behaviors/EnterVehicleBehavior'
import { CoreAI_MoveToBehavior } from '../Modules/Behavior/Behaviors/MoveToBehavior'

import { CoreAI_FightSensor } from '../Modules/Perception/Sensors/FightSensor'
import { CoreAI_ClosestEnemySensor } from '../Modules/Perception/Sensors/MoveTo/ClosestEnemySensor'
import { CoreAI_VehicleToDriveSensor } from '../Modules/Perception/Sensors/Vehicle/VehicleToDriveSensor'
import { CoreAI_ArrivalSensor } from '../Modules/Perception/Sensors/ArrivalSensor'
import { CoreAI_OnFootMoveToSensor } from '../Modules/Perception/Sensors/MoveTo/OnFootMoveToSensor'
import { CoreAI_CapturePointMoveToSensor } from '../Modules/Perception/Sensors/MoveTo/CapturePointMoveToSensor'
import { CoreAI_OnDriveMoveToSensor } from '../Modules/Perception/Sensors/MoveTo/OnDriveMoveToSensor'

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
                factory: (brain) =>
                    new CoreAI_FightBehavior(brain, this.getMoveMode(brain)),
            },

            {
                score: (brain) => (brain.memory.get('closestEnemy') ? 150 : 0),
                factory: (brain) => {
                    const enemy = brain.memory.get('closestEnemy')!
                    const pos = mod.GetSoldierState(
                        enemy,
                        mod.SoldierStateVector.GetPosition
                    )

                    return new CoreAI_MoveToBehavior(
                        brain,
                        pos,
                        mod.MoveSpeed.InvestigateRun,
                        this.getMoveMode(brain)
                    )
                },
            },

            {
                score: (brain) => {
                    const vehicle = brain.memory.get('vehicleToDrive')
                    if (!vehicle) return 0

                    if (
                        mod.GetSoldierState(
                            brain.player,
                            mod.SoldierStateBool.IsInVehicle
                        )
                    ) {
                        return 0
                    }

                    const occupant = mod.GetPlayerFromVehicleSeat(vehicle, 0)
                    if (mod.IsPlayerValid(occupant)) return 0

                    return 90
                },
                factory: (brain) => {
                    // mod.DisplayHighlightedWorldLogMessage(mod.Message(555))

                    const vehicle = brain.memory.get('vehicleToDrive')!
                    const vPos = mod.GetVehicleState(
                        vehicle,
                        mod.VehicleStateVector.VehiclePosition
                    )
                    const dist = mod.DistanceBetween(
                        mod.GetObjectPosition(brain.player),
                        vPos
                    )

                    if (dist <= 3.0) {
                        return new CoreAI_EnterVehicleBehavior(
                            brain,
                            vehicle,
                            0,
                            3.0
                        )
                    }

                    return new CoreAI_MoveToBehavior(
                        brain,
                        vPos,
                        mod.MoveSpeed.Sprint,
                        'onFoot',
                        2.0,
                        false
                    )
                },
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
                factory: (brain) => {
                    const mode = this.getMoveMode(brain)

                    return new CoreAI_MoveToBehavior(
                        brain,
                        brain.memory.get('moveToPos')!,
                        Math.random() < 0.3
                            ? mod.MoveSpeed.Sprint
                            : mod.MoveSpeed.Run,
                        mode,
                        mode === 'onFoot' ? 3.0 : 6.0
                    )
                },
            },
        ] as CoreAI_ITaskScoringEntry[]

        this.buildSensors(options)
    }

    /**
     *
     */

    protected getMoveMode(brain: { player: mod.Player }): 'onFoot' | 'onDrive' {
        const player = brain.player
        if (!mod.IsPlayerValid(player)) return 'onFoot'

        const inVehicle = mod.GetSoldierState(
            player,
            mod.SoldierStateBool.IsInVehicle
        )
        if (!inVehicle) return 'onFoot'

        const vehicle = mod.GetVehicleFromPlayer(player)
        if (!vehicle) return 'onFoot'

        const driver = mod.GetPlayerFromVehicleSeat(vehicle, 0)
        return mod.IsPlayerValid(driver) && mod.Equals(driver, player)
            ? 'onDrive'
            : 'onFoot'
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
            options.vehicleToDriveSensor,
            () =>
                new CoreAI_VehicleToDriveSensor(
                    options.vehicleToDriveSensor?.radius,
                    options.vehicleToDriveSensor?.intervalMs,
                    options.vehicleToDriveSensor?.ttlMs
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
            options.onFootMoveToSensor?.getWPs,
            () =>
                new CoreAI_OnFootMoveToSensor(
                    () => options.onFootMoveToSensor!.getWPs!(),
                    options.onFootMoveToSensor?.intervalMs,
                    options.onFootMoveToSensor?.ttlMs
                )
        )

        this.addSensorIf(
            options.onDriveMoveToSensor?.getWPs,
            () =>
                new CoreAI_OnDriveMoveToSensor(
                    () => options.onDriveMoveToSensor!.getWPs!(),
                    options.onDriveMoveToSensor?.intervalMs,
                    options.onDriveMoveToSensor?.ttlMs
                )
        )
    }
}
