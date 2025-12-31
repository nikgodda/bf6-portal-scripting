import { CoreAI_ABehavior } from './ABehavior'
import { CoreAI_Brain } from '../../../Brain'

type CoreAI_MoveToMode = 'onfoot' | 'driver'

/**
 * MoveToBehavior:
 * - Starts movement in enter()
 * - Runs as long as memory.moveToPos exists
 * - Stopped automatically when TTL clears moveToPos
 * - Optional target enables AISetTarget during movement
 * - Mode selects on-foot or driver logic (never both)
 *
 * TTL-driven memory replaces durationMs logic.
 */
export class CoreAI_MoveToBehavior extends CoreAI_ABehavior {
    public name = 'moveto'

    private readonly targetPos: mod.Vector
    private readonly speed: mod.MoveSpeed
    private readonly target: mod.Player | null
    private readonly mode: CoreAI_MoveToMode

    constructor(
        brain: CoreAI_Brain,
        pos: mod.Vector,
        speed: mod.MoveSpeed,
        target: mod.Player | null = null,
        mode: CoreAI_MoveToMode = 'onfoot'
    ) {
        super(brain)
        this.targetPos = pos
        this.speed = speed
        this.target = target
        this.mode = mode
    }

    override async enter(): Promise<void> {
        mod.DisplayHighlightedWorldLogMessage(mod.Message(999))

        /* console.log(
            mod.XComponentOf(this.targetPos),
            ' ',
            mod.YComponentOf(this.targetPos),
            ' ',
            mod.ZComponentOf(this.targetPos)
        ) */

        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) return

        if (this.target && mod.IsPlayerValid(this.target)) {
            mod.AISetTarget(player, this.target)
        } else {
            mod.AISetTarget(player)
        }

        if (this.mode === 'driver') {
            await this.enterDriverMove(player)
            return
        }

        this.enterOnFootMove(player)
    }

    private async enterDriverMove(player: mod.Player): Promise<void> {
        const vehicle = mod.GetVehicleFromPlayer(player)
        if (!vehicle) return

        mod.ForcePlayerExitVehicle(player, vehicle)
        await mod.Wait(0)
        await mod.Wait(0)
        mod.ForcePlayerToSeat(player, vehicle, 0)
        mod.AIDefendPositionBehavior(player, this.targetPos, 0, 10)
        // mod.AIValidatedMoveToBehavior(player, this.targetPos)
    }

    private enterOnFootMove(player: mod.Player): void {
        mod.AISetMoveSpeed(player, this.speed)
        mod.AIValidatedMoveToBehavior(player, this.targetPos)
    }

    override update(): void {
        // Nothing needed here anymore.
        // TTL in memory determines when this behavior stops being selected.
    }

    override exit(): void {
        if (this.target && mod.IsPlayerValid(this.brain.player)) {
            mod.AISetTarget(this.brain.player)
        }
    }
}
