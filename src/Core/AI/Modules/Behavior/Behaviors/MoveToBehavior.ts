import { CoreAI_ABehavior } from './ABehavior'
import { CoreAI_Brain } from '../../../Brain'
import { CoreAI_BehaviorMode } from '../BehaviorController'

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
    private readonly mode: CoreAI_BehaviorMode

    constructor(
        brain: CoreAI_Brain,
        pos: mod.Vector,
        speed: mod.MoveSpeed,
        target: mod.Player | null = null,
        mode: CoreAI_BehaviorMode = 'onFoot'
    ) {
        super(brain)
        this.targetPos = pos
        this.speed = speed
        this.target = target
        this.mode = mode
    }

    override enter(): void {
        // mod.DisplayHighlightedWorldLogMessage(mod.Message(999))

        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) {
            return
        }

        if (this.target && mod.IsPlayerValid(this.target)) {
            mod.AISetTarget(player, this.target)
        } else {
            mod.AISetTarget(player)
        }

        if (this.mode === 'onDrive') {
            this.enterOnDriveMove(player)
            return
        }

        this.enterOnFootMove(player)
    }

    private async enterOnDriveMove(player: mod.Player): Promise<void> {
        const vehicle = mod.GetVehicleFromPlayer(player)

        mod.ForcePlayerExitVehicle(player, vehicle)
        await mod.Wait(0)
        await mod.Wait(0)
        mod.ForcePlayerToSeat(player, vehicle, 0)
        mod.AISetMoveSpeed(player, mod.MoveSpeed.Sprint)
        // mod.AIBattlefieldBehavior(player)
        mod.AIDefendPositionBehavior(player, this.targetPos, 0, 4)
        // mod.AIValidatedMoveToBehavior(player, this.targetPos)
    }

    private enterOnFootMove(player: mod.Player): void {
        mod.AISetMoveSpeed(player, this.speed)
        mod.AIValidatedMoveToBehavior(player, this.targetPos)
    }

    override update(): void {
        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) return

        const memPos = this.brain.memory.get('moveToPos')
        if (!memPos) return

        const myPos = mod.GetObjectPosition(player)
        const dist = mod.DistanceBetween(myPos, this.targetPos)
        const arrivalDist = this.mode === 'onDrive' ? 10.0 : 3.0

        if (dist < arrivalDist) {
            this.brain.memory.set('moveToPos', null)
        }
    }

    override exit(): void {
        if (this.target && mod.IsPlayerValid(this.brain.player)) {
            mod.AISetTarget(this.brain.player)
        }
    }
}
