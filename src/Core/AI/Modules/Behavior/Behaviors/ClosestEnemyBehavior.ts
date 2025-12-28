import { CoreAI_ABehavior } from './ABehavior'
import { CoreAI_Brain } from '../../../Brain'

/**
 * ClosestEnemyBehavior:
 * Moves toward an enemy detected by ClosestEnemySensor.
 *
 * - Snapshots enemy position once (no tracking)
 * - Aiming only if enemy valid at enter()
 * - Movement is engine-driven
 */
export class CoreAI_ClosestEnemyBehavior extends CoreAI_ABehavior {
    public name = 'closestenemy'

    private readonly enemy: mod.Player
    private readonly speed: mod.MoveSpeed

    constructor(brain: CoreAI_Brain, enemy: mod.Player, speed: mod.MoveSpeed) {
        super(brain)
        this.enemy = enemy
        this.speed = speed
    }

    override enter(): void {
        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) return

        // Aim at enemy if valid
        if (mod.IsPlayerValid(this.enemy)) {
            mod.AISetTarget(player, this.enemy)
        } else {
            mod.AISetTarget(player)
        }

        // Snapshot enemy position
        const pos = mod.GetObjectPosition(this.enemy)
        if (!pos) return

        mod.AISetMoveSpeed(player, this.speed)
        mod.AIValidatedMoveToBehavior(player, pos)
    }

    override update(): void {
        // Movement is handled by engine; behavior has nothing to update
    }

    override exit(): void {
        // Clear target on behavior exit
        const player = this.brain.player
        if (mod.IsPlayerValid(player)) {
            mod.AISetTarget(player)
        }
    }
}
