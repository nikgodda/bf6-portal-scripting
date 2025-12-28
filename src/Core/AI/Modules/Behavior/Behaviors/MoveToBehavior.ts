import { CoreAI_ABehavior } from './ABehavior'
import { CoreAI_Brain } from '../../../Brain'

/**
 * MoveToBehavior:
 * - Starts movement in enter()
 * - Runs as long as memory.moveToPos exists
 * - Stopped automatically when TTL clears moveToPos
 *
 * TTL-driven memory replaces durationMs logic.
 */
export class CoreAI_MoveToBehavior extends CoreAI_ABehavior {
    public name = 'moveto'

    private readonly targetPos: mod.Vector
    private readonly speed: mod.MoveSpeed

    constructor(brain: CoreAI_Brain, pos: mod.Vector, speed: mod.MoveSpeed) {
        super(brain)
        this.targetPos = pos
        this.speed = speed
    }

    override enter(): void {
        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) return

        mod.AISetMoveSpeed(player, this.speed)
        mod.AIValidatedMoveToBehavior(player, this.targetPos)
    }

    override update(): void {
        // Nothing needed here anymore.
        // TTL in memory determines when this behavior stops being selected.
    }

    override exit(): void {
        // No cleanup needed
    }
}
