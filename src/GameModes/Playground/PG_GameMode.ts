import { Core_AGameMode } from 'src/Core/AGameMode'
import { CorePlayer_APlayerManager } from 'src/Core/Player/APlayerManager'
import { CorePlayer_APlayer } from 'src/Core/Player/APlayer'
import { CoreAI_Brain } from 'src/Core/AI/Brain'
import { CoreAI_CombatantProfile } from 'src/Core/AI/Profiles/CombatantProfile'
import { CorePlayer_BrainComponent } from 'src/Core/Player/Components/AI/BrainComponent'
import { Core_SquadManager } from 'src/Core/Squad/SquadManager'
import { PlayerManager } from './Player/PlayerManager'
import { CoreAI_BaseProfile } from 'src/Core/AI/Profiles/BaseProfile'
import { CapturePointTimeService } from './Services/CapturePointTimeService'

export class PG_GameMode extends Core_AGameMode {
    protected override createPlayerManager(): CorePlayer_APlayerManager {
        return new PlayerManager()
    }

    private AI_UNSPAWN_DELAY = 10
    private AI_COUNT_TEAM_1 = 1
    private AI_COUNT_TEAM_2 = 0

    private squadManager: Core_SquadManager | null = null

    public static infantryProfile: CoreAI_BaseProfile =
        new CoreAI_CombatantProfile({
            fightSensor: {
                ttlMs: 10_000,
            },
            closestEnemySensor: {},
            /* roamSensor: {
                getWPs: () => PG_GameMode.getRangeWPs(1000, 1010),
                ttlMs: 4_000,
            }, */
            vehicleToDriveSensor: {
                radius: 100,
            },
            capturePointSensor: {},
        })

    public static driverProfile: CoreAI_BaseProfile =
        new CoreAI_CombatantProfile({
            fightSensor: {
                ttlMs: 10_000,
            },
            roamSensor: {
                getWPs: () => PG_GameMode.getRangeWPs(1106, 1107),
                ttlMs: 60_000,
            },
            capturePointSensor: {},
            /* arrivalSensor: {
                getWPs: () => this.getRangeWPs(1106, 1107),
                ttlMs: 20_000,
                cooldownMs: 40_000,
            }, */
        })

    protected override OnGameModeStarted(): void {
        // One-time game setup (rules, scoreboard, AI bootstrap)
        // mod.SetAIToHumanDamageModifier(2)
        mod.SetFriendlyFire(true)
        new CapturePointTimeService(this, 5)

        // mod.EnableGameModeObjective(mod.GetCapturePoint(2), false)

        mod.SetCapturePointOwner(mod.GetCapturePoint(1), mod.GetTeam(2))
        mod.SetCapturePointOwner(mod.GetCapturePoint(2), mod.GetTeam(128))
        console.log(
            mod.GetObjId(mod.GetCurrentOwnerTeam(mod.GetCapturePoint(2)))
        )

        // Spawn initial logical bots
        for (let i = 1; i <= this.AI_COUNT_TEAM_1; i++) {
            mod.Wait(1).then(() =>
                this.playerManager.spawnLogicalBot(
                    mod.SoldierClass.Engineer,
                    1,
                    mod.GetObjectPosition(mod.GetHQ(1)),
                    mod.Message(`core.ai.bots.${i}`),
                    this.AI_UNSPAWN_DELAY
                )
            )
        }

        for (let j = 1; j <= this.AI_COUNT_TEAM_2; j++) {
            mod.Wait(1).then(() =>
                this.playerManager.spawnLogicalBot(
                    mod.SoldierClass.Engineer,
                    2,
                    mod.GetObjectPosition(mod.GetHQ(2)),
                    mod.Message(`core.ai.bots.${this.AI_COUNT_TEAM_1 + j}`),
                    this.AI_UNSPAWN_DELAY
                )
            )
        }
    }

    /*
     *
     */

    protected override async OnLogicalPlayerJoinGame(
        lp: CorePlayer_APlayer
    ): Promise<void> {
        // Attach AI brain to logical AI players only
        if (lp.isAI()) {
            /* if (lp.teamId === 1) {
                await mod.Wait(5)
                mod.ForcePlayerToSeat(lp.player, this.vehicle!, -1)
            } */

            const brain = new CoreAI_Brain(
                lp.player,
                PG_GameMode.infantryProfile,
                true
            )

            lp.addComponent(new CorePlayer_BrainComponent(brain))
        }

        // Ensure squad system exists and register the player
        if (!this.squadManager) {
            this.squadManager = new Core_SquadManager(this, 2)
        }

        // this.squadManager.addToSquad(lp)
    }

    protected override OnPlayerLeaveGame(eventNumber: number): void {
        const lp = this.playerManager.getById(eventNumber)
        if (!lp) return

        // Keep logical AI persistent by respawning its identity
        if (lp.isLogicalAI()) {
            this.playerManager.respawnLogicalBot(
                lp,
                mod.GetObjectPosition(mod.GetHQ(lp.teamId)),
                this.AI_UNSPAWN_DELAY
            )
        }
    }

    private static getRangeWPs(from: number, to: number): mod.Vector[] {
        const out: mod.Vector[] = []

        for (let id = from; id <= to; id++) {
            const wp = mod.GetSpatialObject(id)
            out.push(mod.GetObjectPosition(wp))
        }

        return out
    }
}
