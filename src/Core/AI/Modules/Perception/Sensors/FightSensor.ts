import { CoreAI_ASensor } from './ASensor'
import { CoreAI_SensorContext } from './SensorContext'

/**
 * FightSensor:
 * Detects weapon firing.
 *
 * Writes:
 * - memory.isFiring (TTL-based boolean)
 *
 * Notes:
 * - Damage events are handled directly by the Brain.
 * - No POIs.
 * - No behaviors spawned.
 * - TaskSelector checks memory.isFiring to understand combat state.
 */
export class CoreAI_FightSensor extends CoreAI_ASensor {
    constructor(
        intervalMs: number = 50,
        private readonly ttlMs: number = 5000
    ) {
        super(intervalMs)
    }

    protected update(ctx: CoreAI_SensorContext): void {
        const player = ctx.player
        if (!mod.IsPlayerValid(player)) return

        const isFiring = mod.GetSoldierState(
            player,
            mod.SoldierStateBool.IsFiring
        )

        if (!isFiring) return

        // TTL-based firing flag
        ctx.memory.set('isFiring', true, this.ttlMs)
    }

    override onDamaged?(
        ctx: CoreAI_SensorContext,
        eventOtherPlayer: mod.Player,
        eventDamageType: mod.DamageType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void {
        // Set damagedBy with configured TTL
        ctx.memory.set('damagedBy', eventOtherPlayer, this.ttlMs)
    }
}
