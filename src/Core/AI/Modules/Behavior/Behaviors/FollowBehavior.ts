import { CoreAI_ABehavior } from './ABehavior'
import { CoreAI_Brain } from '../../../Brain'

export class CoreAI_FollowBehavior extends CoreAI_ABehavior {
    public name = 'follow'

    private readonly getPos: () => mod.Vector | null
    private lastPos: mod.Vector | null = null

    constructor(
        brain: CoreAI_Brain,
        getPos: () => mod.Vector | null,
        intervalMs: number = 5000 // safe, avoids engine stutter
    ) {
        super(brain)
        this.getPos = getPos
        this.intervalMs = intervalMs
    }

    override enter(): void {
        this.lastPos = this.getPos()
        this.issueMove()
    }

    override update(): void {
        const pos = this.getPos()
        if (!pos) return

        if (pos !== this.lastPos) {
            this.lastPos = pos
            this.issueMove()
        }
    }

    private issueMove(): void {
        const pos = this.lastPos
        if (!pos) return

        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) return

        const myPos = mod.GetObjectPosition(player)
        const dist = mod.DistanceBetween(myPos, pos)

        // dynamic speed logic
        let speed: mod.MoveSpeed
        if (dist > 20) speed = mod.MoveSpeed.Sprint
        else if (dist > 10) speed = mod.MoveSpeed.Run
        else speed = mod.MoveSpeed.InvestigateRun

        mod.AISetMoveSpeed(player, speed)
        mod.AIValidatedMoveToBehavior(player, pos)
    }
}
