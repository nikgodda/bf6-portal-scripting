import { CoreAI_AProfile } from './AProfile'
import { CoreAI_ITaskScoringEntry } from '../Modules/Task/ITaskScoringEntry'

import { CoreAI_FightBehavior } from '../Modules/Behavior/Behaviors/FightBehavior'
import { CoreAI_DefendBehavior } from '../Modules/Behavior/Behaviors/DefendBehavior'
import { CoreAI_IdleBehavior } from '../Modules/Behavior/Behaviors/IdleBehavior'
import { CoreAI_FollowBehavior } from '../Modules/Behavior/Behaviors/FollowBehavior'

import { CoreAI_FightSensor } from '../Modules/Perception/Sensors/FightSensor'
import { ArrivalSensor } from '../Modules/Perception/Sensors/ArrivalSensor'
import { CoreAI_ClosestEnemyBehavior } from '../Modules/Behavior/Behaviors/ClosestEnemyBehavior'
import { CoreAI_ClosestEnemySensor } from '../Modules/Perception/Sensors/ClosestEnemySensor'

export class CoreAI_FollowerProfile extends CoreAI_AProfile {
    constructor(private readonly getPoint: () => mod.Vector | null) {
        super()

        this.scoring = [
            // Fight has top priority
            {
                score: (brain) => {
                    return brain.memory.get('isFiring') ||
                        brain.memory.get('damagedBy')
                        ? 200
                        : 0
                },
                factory: (brain) => new CoreAI_FightBehavior(brain),
            },

            // Closest enemy
            {
                score: (brain) => {
                    return brain.memory.get('closestEnemy') ? 150 : 0
                },
                factory: (brain) =>
                    new CoreAI_ClosestEnemyBehavior(
                        brain,
                        brain.memory.get('closestEnemy')!,
                        mod.MoveSpeed.InvestigateRun
                    ),
            },

            // Defend when arrived
            {
                score: (brain) => (brain.memory.get('arrivedPos') ? 100 : 0),
                factory: (brain) =>
                    new CoreAI_DefendBehavior(
                        brain,
                        brain.memory.get('arrivedPos')!,
                        1.0,
                        6.0
                    ),
            },

            // Follow (always enabled)
            {
                score: (brain) => {
                    const target = this.getPoint()
                    if (!target) return 0

                    const myPos = mod.GetObjectPosition(brain.player)
                    const dist = mod.DistanceBetween(myPos, target)

                    // If far from leader, high priority
                    if (
                        dist > 8.0 &&
                        dist < 40.0 &&
                        !brain.memory.get('closestEnemy')
                    ) {
                        return 250
                    }

                    // If close, normal follow priority
                    return 50
                },
                factory: (brain) => {
                    return new CoreAI_FollowBehavior(brain, this.getPoint, 4000)
                },
            },

            {
                score: () => 1,
                factory: (brain) => new CoreAI_IdleBehavior(brain),
            },
        ] as CoreAI_ITaskScoringEntry[]

        this.sensors = [
            () => new CoreAI_FightSensor(),
            () => new CoreAI_ClosestEnemySensor(),

            // Arrival sensor only
            () =>
                new ArrivalSensor(
                    () => {
                        const p = this.getPoint()
                        return p ? [p] : []
                    },
                    1000,
                    6.0,
                    4000,
                    0
                ),
        ]
    }
}
