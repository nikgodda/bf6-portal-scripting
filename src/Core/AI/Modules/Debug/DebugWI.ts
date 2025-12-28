import { CoreAI_Brain } from '../../Brain'

export interface CoreAI_IDebugWI {
    index: number
    worldIcon: mod.WorldIcon
}

export class CoreAI_DebugWI {
    private behaviorWI: CoreAI_IDebugWI
    private distanceWI: CoreAI_IDebugWI
    private battleWI: CoreAI_IDebugWI
    private moveWI: CoreAI_IDebugWI

    constructor(private receiver: mod.Player, private brain: CoreAI_Brain) {
        this.behaviorWI = { index: 0, worldIcon: this.spawnWI(receiver) }
        this.distanceWI = { index: 1, worldIcon: this.spawnWI(receiver) }
        this.battleWI = { index: 2, worldIcon: this.spawnWI(receiver) }
        this.moveWI = { index: 3, worldIcon: this.spawnWI(receiver) }
    }

    update() {
        if (
            !mod.IsPlayerValid(this.brain.player) ||
            !mod.GetSoldierState(
                this.brain.player,
                mod.SoldierStateBool.IsAlive
            )
        ) {
            mod.EnableWorldIconText(this.behaviorWI.worldIcon, false)
            mod.EnableWorldIconText(this.distanceWI.worldIcon, false)
            mod.EnableWorldIconText(this.battleWI.worldIcon, false)
            mod.EnableWorldIconText(this.moveWI.worldIcon, false)
            return
        }

        mod.EnableWorldIconText(this.behaviorWI.worldIcon, true)
        mod.EnableWorldIconText(this.distanceWI.worldIcon, true)
        mod.EnableWorldIconText(this.battleWI.worldIcon, true)
        mod.EnableWorldIconText(this.moveWI.worldIcon, true)

        // @stringkeys core.ai.debug.brain.behaviors: fight, closestenemy, defend, idle, moveto, follow

        this.updateWI(
            this.behaviorWI,
            mod.Message(
                `core.ai.debug.brain.behaviors.${
                    this.brain.behaviorController.currentBehavior().name
                }`
            )
        )
        switch (this.brain.behaviorController.currentBehavior().name) {
            case 'fight':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(1, 0, 0)
                )
                break
            case 'closestenemy':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(1, 0, 1)
                )
                break
            case 'defend':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(0, 1, 1)
                )
                break
            case 'moveto':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(0, 1, 0)
                )
                break
            case 'follow':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(1, 1, 0)
                )
                break
            case 'idle':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(1, 1, 1)
                )
                break
        }
        this.updateWI(
            this.distanceWI,
            mod.Message(
                `core.ai.debug.brain.distance`,
                Math.floor(
                    mod.DistanceBetween(
                        mod.GetObjectPosition(this.brain.player),
                        mod.GetObjectPosition(this.receiver)
                    )
                ),
                mod.GetObjId(mod.GetTeam(this.brain.player))
            )
        )
        this.updateWI(
            this.battleWI,
            mod.Message(
                `core.ai.debug.brain.memory.battle`,
                this.brain.memory.getTimeRemaining('isFiring'),
                this.brain.memory.getTimeRemaining('damagedBy'),
                this.brain.memory.getTimeRemaining('closestEnemy')
            )
        )
        this.updateWI(
            this.moveWI,
            mod.Message(
                `core.ai.debug.brain.memory.calm`,
                this.brain.memory.getTimeRemaining('moveToPos'),
                this.brain.memory.getTimeRemaining('arrivedPos')
            )
        )
    }

    private round2decimal(num: number): number {
        const factor = 10 /* * 10 // 100 */
        return Math.round(num * factor) / factor
    }

    private getIconOffset(d: number): number {
        const base = 1.9
        const upStart = 2
        const upEnd = 40
        const downEnd = 70
        const peakDelta = 0.9 // 2.8 - 1.9

        if (d <= upStart) return base
        if (d >= downEnd) return base

        // rising part: 2..40
        if (d < upEnd) {
            const t = (d - upStart) / (upEnd - upStart) // 0..1
            const bump = Math.pow(t, 0.5) // sqrt: fast early rise
            return base + peakDelta * bump
        }

        // falling part: 40..70
        const t = (d - upEnd) / (downEnd - upEnd) // 0..1
        const bump = Math.pow(1 - t, 0.8) // slower fall
        return base + peakDelta * bump
    }

    /**
     * Returns the vertical world offset for stacked icons.
     *
     * index = 0 -> base icon
     * index = 1 -> first icon above it
     * index = 2 -> second icon above it
     *
     * The gap is scaled by distance so icons appear visually snapped.
     */
    private getStackedIconOffset(d: number, index: number, gap = 0.4): number {
        // Base icon offset using your existing curve
        const baseOffset = this.getIconOffset(d)

        // Reference distance at which gap looks correct visually.
        // 20m is a good default for human-readable marker stacking.
        const reference = 20

        // Scale gap according to distance to compensate for perspective shrinking
        const scale = d / reference

        // Index=0 gives base offset
        if (index === 0) return baseOffset

        // Each stacked icon sits on top of the previous one
        return baseOffset + index * gap * scale
    }

    private spawnWI(receiver: mod.Player): mod.WorldIcon {
        const wi = mod.SpawnObject(
            mod.RuntimeSpawn_Common.WorldIcon,
            mod.CreateVector(0, 0, 0),
            mod.CreateVector(0, 0, 0)
        )
        mod.SetWorldIconOwner(wi, receiver)
        mod.SetWorldIconColor(wi, mod.CreateVector(1, 1, 1))
        mod.SetWorldIconText(wi, mod.Message(''))
        mod.EnableWorldIconText(wi, true)

        return wi
    }

    private updateWI(wi: CoreAI_IDebugWI, mes: mod.Message): void {
        mod.SetWorldIconPosition(
            wi.worldIcon,
            mod.CreateVector(
                mod.XComponentOf(mod.GetObjectPosition(this.brain.player)),
                mod.YComponentOf(mod.GetObjectPosition(this.brain.player)) +
                    this.getStackedIconOffset(
                        mod.DistanceBetween(
                            mod.GetObjectPosition(this.brain.player),
                            mod.GetObjectPosition(this.receiver)
                        ),
                        wi.index,
                        0.6
                    ),
                mod.ZComponentOf(mod.GetObjectPosition(this.brain.player))
            )
        )
        mod.SetWorldIconText(wi.worldIcon, mes)
    }
}
