import { CoreAI_ASensor } from './ASensor'
import { CoreAI_SensorContext } from './SensorContext'

/**
 * FightSensor:
 * Detects combat by raycasting toward nearby enemies.
 *
 * Writes:
 * - memory.isInBattle (TTL-based boolean)
 *
 * Notes:
 * - OnRayCastHit is used to confirm nearby enemy presence.
 * - No POIs.
 * - No behaviors spawned.
 * - TaskSelector checks memory.isInBattle to understand combat state.
 */
export class CoreAI_FightSensor extends CoreAI_ASensor {
    constructor(
        intervalMs: number = 1000,
        private readonly ttlMs: number = 10000
    ) {
        super(intervalMs)
    }

    protected update(ctx: CoreAI_SensorContext): void {
        if (ctx.memory.get('isInBattle')) {
            return
        }

        const player = ctx.player
        if (!mod.IsPlayerValid(player)) return

        const myEyesPos = mod.GetSoldierState(
            player,
            mod.SoldierStateVector.EyePosition
        )
        const myTeamId = mod.GetObjId(mod.GetTeam(player))
        const enemyTeam = mod.GetTeam(myTeamId === 1 ? 2 : 1)

        const allPlayers = mod.AllPlayers()
        const count = mod.CountOf(allPlayers)

        const RAYCAST_START_OFFSET = 1

        for (let i = 0; i < count; i++) {
            const p = mod.ValueInArray(allPlayers, i) as mod.Player
            if (!mod.IsPlayerValid(p)) continue
            if (!mod.Equals(mod.GetTeam(p), enemyTeam)) continue
            if (!mod.GetSoldierState(p, mod.SoldierStateBool.IsAlive)) continue

            const targetPos = mod.GetObjectPosition(p)
            const dir = mod.DirectionTowards(myEyesPos, targetPos)
            const start = mod.Add(
                myEyesPos,
                mod.Multiply(dir, RAYCAST_START_OFFSET)
            )

            mod.RayCast(player, start, targetPos)
        }
    }

    override onRayCastHit?(
        ctx: CoreAI_SensorContext,
        eventPoint: mod.Vector,
        eventNormal: mod.Vector
    ): void {
        const player = ctx.player
        if (!mod.IsPlayerValid(player)) return

        const myTeamId = mod.GetObjId(mod.GetTeam(player))
        const enemyTeam = mod.GetTeam(myTeamId === 1 ? 2 : 1)

        const enemy = mod.ClosestPlayerTo(eventPoint, enemyTeam)
        if (!mod.IsPlayerValid(enemy)) return

        const enemyPos = mod.GetObjectPosition(enemy)
        const hitDist = mod.DistanceBetween(eventPoint, enemyPos)

        // mod.DisplayHighlightedWorldLogMessage(mod.Message(hitDist))

        if (hitDist > 1.0) return

        mod.DisplayHighlightedWorldLogMessage(
            mod.Message(ctx.memory.get('isInBattle') ? 111 : 222)
        )

        ctx.memory.set('isInBattle', true, this.ttlMs)
    }
}
