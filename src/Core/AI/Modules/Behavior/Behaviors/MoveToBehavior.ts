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

    override async enter(): Promise<void> {
        mod.DisplayHighlightedWorldLogMessage(mod.Message(202))
        console.log(
            mod.XComponentOf(this.targetPos),
            ' ',
            mod.YComponentOf(this.targetPos),
            ' ',
            mod.ZComponentOf(this.targetPos)
        )

        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) return

        const vehicle = mod.GetVehicleFromPlayer(player)
        const driver = mod.GetPlayerFromVehicleSeat(vehicle, 0)
        if (mod.IsPlayerValid(driver) && mod.Equals(driver, player)) {
            mod.ForcePlayerExitVehicle(player, vehicle)
            await mod.Wait(0)
            await mod.Wait(0)
            mod.ForcePlayerToSeat(player, vehicle, 0)
            mod.AIDefendPositionBehavior(player, this.targetPos, 0, 10)
            // mod.AIValidatedMoveToBehavior(player, this.targetPos)

            return
        }

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
