import { CoreUI_Colors } from 'src/Core/UI/UIColors'
import { CoreAI_Brain } from '../../Brain'
import { CoreAI_MemoryFields } from '../Memory/MemoryManager'

// @stringkeys core.ai.debug.brain.memory: closestEnemy {}, vehicleToDrive {}, isInBattle {}, roamPos {}, arrivedPos {}

export interface CoreAI_IDebugWI {
    index: number
    worldIcon: mod.WorldIcon
}

export class CoreAI_DebugWI {
    /* private behavior: CoreAI_IDebugWI
    private stats: CoreAI_IDebugWI
    private battle: CoreAI_IDebugWI
    private calm: CoreAI_IDebugWI */

    private roamPos_wi: mod.WorldIcon
    private vehicleToDrive_wi: mod.WorldIcon

    private memoryWIs: Map<keyof CoreAI_MemoryFields, mod.WorldIcon> = new Map()

    constructor(private receiver: mod.Player, private brain: CoreAI_Brain) {
        let i = 0
        for (const key of Object.keys(this.brain.memory.data) as Array<
            keyof typeof this.brain.memory.data
        >) {
            const wi = mod.SpawnObject(
                mod.RuntimeSpawn_Common.WorldIcon,
                mod.CreateVector(0, 0, 0),
                mod.CreateVector(0, 0, 0)
            )
            mod.SetWorldIconOwner(wi, receiver)

            this.memoryWIs.set(key, wi)
            i++
            /* console.log(
                'memory key: ',
                key,
                'value: ',
                this.brain.memory.data[key],
                'remaining: ',
                this.brain.memory.getTimeRemaining(key)
            ) */
        }

        /* this.calm = { index: 3, worldIcon: this.spawn_wi(player) }
        this.battle = { index: 2, worldIcon: this.spawn_wi(player) }
        this.stats = { index: 1, worldIcon: this.spawn_wi(player) }
        this.behavior = { index: 0, worldIcon: this.spawn_wi(player) } */

        this.roamPos_wi = mod.SpawnObject(
            mod.RuntimeSpawn_Common.WorldIcon,
            mod.CreateVector(0, 0, 0),
            mod.CreateVector(0, 0, 0)
        )
        mod.SetWorldIconOwner(this.roamPos_wi, receiver)
        mod.SetWorldIconImage(this.roamPos_wi, mod.WorldIconImages.Skull)
        mod.EnableWorldIconImage(this.roamPos_wi, true)
        mod.SetWorldIconColor(this.roamPos_wi, CoreUI_Colors.YellowDark)

        this.vehicleToDrive_wi = mod.SpawnObject(
            mod.RuntimeSpawn_Common.WorldIcon,
            mod.CreateVector(0, 0, 0),
            mod.CreateVector(0, 0, 0)
        )
        mod.SetWorldIconOwner(this.vehicleToDrive_wi, receiver)
        mod.SetWorldIconImage(this.vehicleToDrive_wi, mod.WorldIconImages.Bomb)
        mod.EnableWorldIconImage(this.vehicleToDrive_wi, true)
        mod.SetWorldIconColor(this.vehicleToDrive_wi, CoreUI_Colors.BlueDark)
    }

    update() {
        let i = 0
        for (const [key, wi] of this.memoryWIs) {
            if (
                !mod.IsPlayerValid(this.brain.player) ||
                !mod.GetSoldierState(
                    this.brain.player,
                    mod.SoldierStateBool.IsAlive
                )
            ) {
                mod.EnableWorldIconText(wi, false)
                continue
            }

            mod.SetWorldIconColor(
                wi,
                this.brain.memory.getTimeRemaining(key) === 0
                    ? CoreUI_Colors.White
                    : CoreUI_Colors.GreenLight
            )
            mod.EnableWorldIconText(wi, true)
            mod.SetWorldIconPosition(
                wi,
                mod.CreateVector(
                    mod.XComponentOf(mod.GetObjectPosition(this.brain.player)),
                    mod.YComponentOf(mod.GetObjectPosition(this.brain.player)) +
                        this.getStackedIconOffset(
                            mod.DistanceBetween(
                                mod.GetObjectPosition(this.brain.player),
                                mod.GetObjectPosition(this.receiver)
                            ),
                            i,
                            0.6
                        ),
                    mod.ZComponentOf(mod.GetObjectPosition(this.brain.player))
                )
            )
            mod.SetWorldIconText(
                wi,
                mod.Message(
                    `core.ai.debug.brain.memory.${key}`,
                    this.brain.memory.getTimeRemaining(key)
                )
            )

            i++
        }
        /* if (this.brain.memory.get('roamPos')) {
            mod.SetWorldIconPosition(
                this.roamPos_wi,
                this.brain.memory.get('roamPos')!
            )
            mod.EnableWorldIconImage(this.roamPos_wi, true)
            mod.SetWorldIconText(
                this.roamPos_wi,
                mod.Message(this.brain.memory.getTimeRemaining('roamPos'))
            )
            mod.EnableWorldIconText(this.roamPos_wi, true)
        } else {
            mod.EnableWorldIconImage(this.roamPos_wi, false)
            mod.EnableWorldIconText(this.roamPos_wi, false)
        }

        if (this.brain.memory.get('vehicleToDrive')) {
            mod.SetWorldIconPosition(
                this.vehicleToDrive_wi,
                mod.GetVehicleState(
                    this.brain.memory.get('vehicleToDrive')!,
                    mod.VehicleStateVector.VehiclePosition
                )
            )
            mod.EnableWorldIconImage(this.vehicleToDrive_wi, true)
            mod.SetWorldIconText(
                this.vehicleToDrive_wi,
                mod.Message(
                    this.brain.memory.getTimeRemaining('vehicleToDrive')
                )
            )
            mod.EnableWorldIconText(this.vehicleToDrive_wi, true)
        } else {
            mod.EnableWorldIconImage(this.vehicleToDrive_wi, false)
            mod.EnableWorldIconText(this.vehicleToDrive_wi, false)
        } */
        /**
         *
         */
        /* if (
            !mod.IsPlayerValid(this.brain.player) ||
            !mod.GetSoldierState(
                this.brain.player,
                mod.SoldierStateBool.IsAlive
            )
        ) {
            mod.EnableWorldIconText(this.behavior.worldIcon, false)
            mod.EnableWorldIconText(this.stats.worldIcon, false)
            mod.EnableWorldIconText(this.battle.worldIcon, false)
            mod.EnableWorldIconText(this.calm.worldIcon, false)
            return
        }

        mod.EnableWorldIconText(this.behavior.worldIcon, true)
        mod.EnableWorldIconText(this.stats.worldIcon, true)
        mod.EnableWorldIconText(this.battle.worldIcon, true)
        mod.EnableWorldIconText(this.calm.worldIcon, true) */
        // @stringkeys core.ai.debug.brain.behaviors: fight, defend, idle, moveto
        /**
         * Behavior
         */
        /* this.update_wi(
            this.behavior,
            mod.Message(
                `core.ai.debug.brain.behaviors.${
                    this.brain.behaviorController.currentBehavior().name
                }`
            )
        ) */
        // Behavior Colors
        /* switch (this.brain.behaviorController.currentBehavior().name) {
            case 'fight':
                mod.SetWorldIconColor(
                    this.behavior.worldIcon,
                    mod.CreateVector(1, 0, 0)
                )
                break
            case 'defend':
                mod.SetWorldIconColor(
                    this.behavior.worldIcon,
                    mod.CreateVector(0, 1, 1)
                )
                break
            case 'moveto':
                mod.SetWorldIconColor(
                    this.behavior.worldIcon,
                    mod.CreateVector(0, 1, 0)
                )
                break
            case 'idle':
                mod.SetWorldIconColor(
                    this.behavior.worldIcon,
                    mod.CreateVector(1, 1, 1)
                )
                break
        } */
        /**
         * Stats (distance + team)
         */
        /* this.update_wi(
            this.stats,
            mod.Message(
                `core.ai.debug.brain.distance`,
                Math.floor(
                    mod.DistanceBetween(
                        mod.GetObjectPosition(this.brain.player),
                        mod.GetObjectPosition(this.player)
                    )
                ),
                mod.GetObjId(mod.GetTeam(this.brain.player))
            )
        ) */
        /**
         * Battle Memory fields
         */
        /* this.update_wi(
            this.battle,
            mod.Message(
                `core.ai.debug.brain.memory.battle`,
                this.brain.memory.getTimeRemaining('isInBattle'),
                this.brain.memory.getTimeRemaining('closestEnemy')
            )
        ) */
        /**
         * Calm Memory fields
         */
        /* this.update_wi(
            this.calm,
            mod.Message(
                `core.ai.debug.brain.memory.calm`,
                this.brain.memory.getTimeRemaining('arrivedPos'),
                this.brain.memory.getTimeRemaining('vehicleToDrive')
            )
        ) */
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

    private spawn_wi(receiver: mod.Player): mod.WorldIcon {
        const wi = mod.SpawnObject(
            mod.RuntimeSpawn_Common.WorldIcon,
            mod.CreateVector(0, 0, 0),
            mod.CreateVector(0, 0, 0)
        )
        mod.SetWorldIconOwner(wi, receiver)
        // mod.SetWorldIconColor(wi, mod.CreateVector(1, 1, 1))
        // mod.SetWorldIconText(wi, mod.Message(''))
        // mod.EnableWorldIconText(wi, true)

        return wi
    }

    private update_wi(wi: CoreAI_IDebugWI, mes: mod.Message): void {
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
