import { CoreAI_AProfile } from './AProfile'
import { CoreAI_ITaskScoringEntry } from '../Modules/Task/ITaskScoringEntry'

import { CoreAI_FightBehavior } from '../Modules/Behavior/Behaviors/FightBehavior'
import { CoreAI_ClosestEnemyBehavior } from '../Modules/Behavior/Behaviors/ClosestEnemyBehavior'
import { CoreAI_DefendBehavior } from '../Modules/Behavior/Behaviors/DefendBehavior'
import { CoreAI_MoveToBehavior } from '../Modules/Behavior/Behaviors/MoveToBehavior'

import { CoreAI_FightSensor } from '../Modules/Perception/Sensors/FightSensor'
import { CoreAI_ClosestEnemySensor } from '../Modules/Perception/Sensors/ClosestEnemySensor'
import { ArrivalSensor } from '../Modules/Perception/Sensors/ArrivalSensor'
import { MoveToSensor } from '../Modules/Perception/Sensors/MoveToSensor'
import { MoveToCapturePointSensor } from '../Modules/Perception/Sensors/MoveToCapturePointSensor'

export class CoreAI_CombatantProfile extends CoreAI_AProfile {
    constructor(
        private readonly getDefendWPs: () => mod.Vector[],
        private readonly getRoamWPs: () => mod.Vector[],
        private readonly getCapturePoints: () => mod.CapturePoint[]
    ) {
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
            () => new CoreAI_FightSensor(),
            () => new CoreAI_ClosestEnemySensor(),

            () =>
                new ArrivalSensor(
                    () => this.getDefendWPs(),
                    500,
                    6.0,
                    10000,
                    15000
                ),

            () => new MoveToCapturePointSensor(() => this.getCapturePoints()),
            () => new MoveToSensor(() => this.getRoamWPs()),
        ]
    }
}
