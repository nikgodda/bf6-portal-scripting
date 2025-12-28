import { CoreAI_ABehavior } from './ABehavior'
import { CoreAI_Brain } from '../../../Brain'

/**
 * FightBehavior:
 * Activated when the threat is high enough for combat.
 *
 * Engine handles all dynamic combat: aiming, targeting, firing, strafing, cover.
 * This behavior does not end by itself; TaskSelector decides when to exit.
 */
export class CoreAI_FightBehavior extends CoreAI_ABehavior {
    public name = 'fight'

    constructor(brain: CoreAI_Brain) {
        super(brain)
    }

    override enter(): void {
        const player = this.brain.player
        if (mod.IsPlayerValid(player)) {
            mod.AIBattlefieldBehavior(player)
        }
    }

    override update(): void {
        // Engine handles combat; nothing to update
    }

    override exit(): void {
        // No cleanup required for fight mode in this architecture
    }
}
