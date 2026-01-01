import { CoreAI_Brain } from '../../Brain'
import { CoreAI_AProfile } from '../../Profiles/AProfile'
import { CoreAI_IdleBehavior } from '../Behavior/Behaviors/IdleBehavior'
import { CoreAI_ITaskScoringEntry } from './ITaskScoringEntry'

export class CoreAI_TaskSelector {
    private brain: CoreAI_Brain
    private profile: CoreAI_AProfile
    private currentIndex: number | null = null

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
        let bestIndex: number | null = null

        // Evaluate profile scoring
        for (let i = 0; i < this.profile.scoring.length; i++) {
            const entry = this.profile.scoring[i]
            const score = entry.score(this.brain)
            if (score > bestScore) {
                bestScore = score
                bestEntry = entry
                bestIndex = i
            }
        }

        // If nothing scores above zero -> idle
        if (!bestEntry || bestScore <= 0) {
            if (current instanceof CoreAI_IdleBehavior) {
                this.currentIndex = null
                return current
            }
            this.currentIndex = null
            return new CoreAI_IdleBehavior(this.brain)
        }

        // TEMP instance only to inspect class
        const temp = bestEntry.factory(this.brain)
        const nextClass = temp.constructor

        // If same class -> never switch (no restarts)
        if (
            current &&
            current.constructor === nextClass &&
            bestIndex !== null &&
            bestIndex === this.currentIndex
        ) {
            return current
        }

        // Switch to new instance
        this.currentIndex = bestIndex
        return temp
    }
}
