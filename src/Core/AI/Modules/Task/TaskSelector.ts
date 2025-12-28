import { CoreAI_Brain } from '../../Brain'
import { CoreAI_AProfile } from '../../Profiles/AProfile'
import { CoreAI_IdleBehavior } from '../Behavior/Behaviors/IdleBehavior'
import { CoreAI_ITaskScoringEntry } from './ITaskScoringEntry'

export class CoreAI_TaskSelector {
    private brain: CoreAI_Brain
    private profile: CoreAI_AProfile

    constructor(brain: CoreAI_Brain, profile: CoreAI_AProfile) {
        this.brain = brain
        this.profile = profile
    }

    setProfile(profile: CoreAI_AProfile): void {
        this.profile = profile
    }

    chooseNextBehavior() {
        const current = this.brain.behaviorController.currentBehavior()

        let bestEntry: CoreAI_ITaskScoringEntry | null = null
        let bestScore = -Infinity

        // Evaluate profile scoring
        for (const entry of this.profile.scoring) {
            const score = entry.score(this.brain)
            if (score > bestScore) {
                bestScore = score
                bestEntry = entry
            }
        }

        // If nothing scores above zero -> idle
        if (!bestEntry || bestScore <= 0) {
            if (current instanceof CoreAI_IdleBehavior) {
                return current
            }
            return new CoreAI_IdleBehavior(this.brain)
        }

        // TEMP instance only to inspect class
        const temp = bestEntry.factory(this.brain)
        const nextClass = temp.constructor

        // If same class -> never switch (no restarts)
        if (current && current.constructor === nextClass) {
            return current
        }

        // Switch to new class
        return bestEntry.factory(this.brain)
    }
}
