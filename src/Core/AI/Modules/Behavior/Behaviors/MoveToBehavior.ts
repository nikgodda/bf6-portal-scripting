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

    private moveToPos: mod.Vector
    private readonly speed: mod.MoveSpeed
    private readonly mode: CoreAI_BehaviorMode
    private readonly arrivalDist: number
    private readonly isValidated: boolean

    constructor(
        brain: CoreAI_Brain,
        pos: mod.Vector,
        speed: mod.MoveSpeed = mod.MoveSpeed.Run,
        mode: CoreAI_BehaviorMode = 'onFoot',
        arrivalDist: number = 3,
        isValidated: boolean = true
    ) {
        super(brain)
        this.moveToPos = pos
        this.speed = speed
        this.mode = mode
        this.arrivalDist = arrivalDist
        this.isValidated = isValidated
    }

    override enter(): void {
        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) {
            return
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
        mod.AIDefendPositionBehavior(player, this.moveToPos, 0, 4)
        // mod.AIValidatedMoveToBehavior(player, this.targetPos)
    }

    private enterOnFootMove(player: mod.Player): void {
        mod.AISetMoveSpeed(player, this.speed)
        this.isValidated
            ? mod.AIValidatedMoveToBehavior(player, this.moveToPos)
            : mod.AIMoveToBehavior(player, this.moveToPos)
    }

    override update(): void {
        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) return

        const memPos = this.brain.memory.get('moveToPos')
        if (!memPos) return

        /* 
        // Conflicts with other Scores
        if (!mod.Equals(memPos, this.moveToPos)) {
            this.moveToPos = memPos
            this.enter()
        } */

        const myPos = mod.GetObjectPosition(player)
        const dist = mod.DistanceBetween(myPos, this.moveToPos)
        const arrivalDist = this.arrivalDist

        if (dist < arrivalDist) {
            this.brain.memory.set('moveToPos', null)
        }
    }

    override exit(): void {
        // No target cleanup here; targeting is managed by the brain.
    }
}
