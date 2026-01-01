import { CoreUI_Colors } from 'src/Core/UI/UIColors'
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
    /* private targetWI: mod.WorldIcon
    private hitWI: mod.WorldIcon
    private hitClosestEnemyWI: mod.WorldIcon */

    constructor(
        intervalMs: number = 500,
        private readonly ttlMs: number = 10000
    ) {
        super(intervalMs)

        /* this.targetWI = mod.SpawnObject(
            mod.RuntimeSpawn_Common.WorldIcon,
            mod.CreateVector(0, 0, 0),
            mod.CreateVector(0, 0, 0)
        )
        mod.SetWorldIconOwner(this.targetWI, mod.GetTeam(1))
        mod.SetWorldIconImage(this.targetWI, mod.WorldIconImages.Skull)
        mod.EnableWorldIconImage(this.targetWI, true)
        mod.SetWorldIconColor(this.targetWI, CoreUI_Colors.RedDark)

        this.hitWI = mod.SpawnObject(
            mod.RuntimeSpawn_Common.WorldIcon,
            mod.CreateVector(0, 0, 0),
            mod.CreateVector(0, 0, 0)
        )
        mod.SetWorldIconOwner(this.hitWI, mod.GetTeam(1))
        mod.SetWorldIconImage(this.hitWI, mod.WorldIconImages.Skull)
        mod.EnableWorldIconImage(this.hitWI, true)
        mod.SetWorldIconColor(this.hitWI, CoreUI_Colors.GreenDark)

        this.hitClosestEnemyWI = mod.SpawnObject(
            mod.RuntimeSpawn_Common.WorldIcon,
            mod.CreateVector(0, 0, 0),
            mod.CreateVector(0, 0, 0)
        )
        mod.SetWorldIconOwner(this.hitClosestEnemyWI, mod.GetTeam(1))
        mod.SetWorldIconImage(this.hitClosestEnemyWI, mod.WorldIconImages.Alert)
        mod.EnableWorldIconImage(this.hitClosestEnemyWI, true)
        mod.SetWorldIconColor(this.hitClosestEnemyWI, CoreUI_Colors.BlueDark) */
    }

    protected update(ctx: CoreAI_SensorContext): void {
        if (ctx.memory.get('isInBattle')) {
            return
        }

        const player = ctx.player
        if (!mod.IsPlayerValid(player)) return

        const isFiring = mod.GetSoldierState(
            player,
            mod.SoldierStateBool.IsFiring
        )
        if (isFiring) {
            ctx.memory.set('isInBattle', true, this.ttlMs)
            return
        }

        const myEyesPos = mod.GetSoldierState(
            player,
            mod.SoldierStateVector.EyePosition
        )
        const myTeamId = mod.GetObjId(mod.GetTeam(player))

        const allPlayers = mod.AllPlayers()
        const count = mod.CountOf(allPlayers)

        const RAYCAST_START_OFFSET = 5

        for (let i = 0; i < count; i++) {
            const p = mod.ValueInArray(allPlayers, i) as mod.Player
            if (!mod.IsPlayerValid(p)) continue

            if (mod.GetObjId(mod.GetTeam(p)) === myTeamId) continue

            if (!mod.GetSoldierState(p, mod.SoldierStateBool.IsAlive)) continue

            let targetPos = mod.GetSoldierState(
                p,
                mod.SoldierStateVector.EyePosition
            )

            if (mod.GetSoldierState(p, mod.SoldierStateBool.IsInVehicle)) {
                const vehicle = mod.GetVehicleFromPlayer(p)

                const vehiclePos = mod.GetVehicleState(
                    vehicle,
                    mod.VehicleStateVector.VehiclePosition
                )

                targetPos = mod.CreateVector(
                    mod.XComponentOf(vehiclePos),
                    mod.YComponentOf(vehiclePos) + 1,
                    mod.ZComponentOf(vehiclePos)
                )
            }

            const dir = mod.DirectionTowards(myEyesPos, targetPos)
            const start = mod.Add(
                myEyesPos,
                mod.Multiply(dir, RAYCAST_START_OFFSET)
            )
            mod.RayCast(player, start, targetPos)

            // mod.SetWorldIconPosition(this.targetWI, targetPos)
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
        const enemyTeamId = mod.GetTeam(myTeamId === 1 ? 2 : 1)

        const enemy = mod.ClosestPlayerTo(eventPoint, enemyTeamId)

        if (!mod.IsPlayerValid(enemy)) return

        let enemyPos = mod.GetSoldierState(
            enemy,
            mod.SoldierStateVector.EyePosition
        )

        let maxHitDist = 0.4

        if (mod.GetSoldierState(enemy, mod.SoldierStateBool.IsInVehicle)) {
            maxHitDist = 5.1

            const ep = mod.GetSoldierState(
                enemy,
                mod.SoldierStateVector.GetPosition
            )
            enemyPos = mod.CreateVector(
                mod.XComponentOf(ep),
                mod.YComponentOf(ep) + 1,
                mod.ZComponentOf(ep)
            )
        }

        // mod.SetWorldIconPosition(this.hitWI, eventPoint)
        // mod.SetWorldIconPosition(this.hitClosestEnemyWI, enemyPos)

        const hitDist = mod.DistanceBetween(eventPoint, enemyPos)

        // mod.DisplayHighlightedWorldLogMessage(mod.Message(hitDist))

        if (hitDist > maxHitDist) return

        ctx.memory.set('isInBattle', true, this.ttlMs)
    }

    override onDamaged?(
        ctx: CoreAI_SensorContext,
        eventOtherPlayer: mod.Player,
        eventDamageType: mod.DamageType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void {
        ctx.memory.set('isInBattle', true, this.ttlMs)
    }
}
