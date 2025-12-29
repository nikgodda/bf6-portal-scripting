import { Core_AGameMode } from 'src/Core/AGameMode'
import { CorePlayer_APlayerManager } from 'src/Core/Player/APlayerManager'
import { TDM_PlayerManager } from './Player/TDM_PlayerManager'
import { CorePlayer_APlayer } from 'src/Core/Player/APlayer'

export class TDM_GameMode extends Core_AGameMode {
    protected override createPlayerManager(): CorePlayer_APlayerManager {
        return new TDM_PlayerManager()
    }

    private teamScores = new Map<number, number>()

    private AI_UNSPAWN_DELAY = 5

    protected override OnGameModeStarted(): void {
        mod.SetFriendlyFire(true)
        mod.SetGameModeTargetScore(100)

        /*
         *
         */
        mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams)
        mod.SetScoreboardColumnNames(
            mod.Message(`gamemodes.PRSR.scoreboard.score`),
            mod.Message(`gamemodes.PRSR.scoreboard.kills`),
            mod.Message(`gamemodes.PRSR.scoreboard.deaths`),
            mod.Message(`gamemodes.PRSR.scoreboard.teamKills`),
            mod.Message(`gamemodes.PRSR.scoreboard.killStreak`)
        )
        mod.SetScoreboardColumnWidths(1, 0.5, 0.5, 0.5, 0.5)

        /*
         *
         */
        this.playerManager.spawnBot(
            mod.SoldierClass.Assault,
            1,
            mod.GetObjectPosition(mod.GetHQ(1)),
            mod.Message(`core.ai.bots.1`),
            this.AI_UNSPAWN_DELAY,
            true
        )

        /* this.playerManager.spawnBot(
            mod.SoldierClass.Assault,
            1,
            mod.GetObjectPosition(mod.GetHQ(1)),
            mod.Message(`core.ai.bots.2`),
            this.AI_UNSPAWN_DELAY,
            true
        ) */

        const vehicleSpawner = mod.SpawnObject(
            mod.RuntimeSpawn_Common.VehicleSpawner,
            mod.GetObjectPosition(mod.GetHQ(2)),
            mod.CreateVector(0, 0, 0)
        )

        mod.SetVehicleSpawnerVehicleType(
            vehicleSpawner,
            mod.VehicleList.Marauder
        )

        mod.Wait(10).then(() => {
            mod.ForceVehicleSpawnerSpawn(vehicleSpawner)
        })
    }

    private vehicle: mod.Vehicle | null = null

    protected override OnVehicleSpawned(eventVehicle: mod.Vehicle): void {
        mod.DisplayNotificationMessage(mod.Message(333))
        this.vehicle = eventVehicle
    }

    protected override OnLogicalPlayerJoinGame(lp: CorePlayer_APlayer): void {
        if (lp.isAI()) {
            mod.Wait(15).then(() => {
                if (this.vehicle) {
                    mod.ForcePlayerToSeat(lp.player, this.vehicle, -1)
                }
                mod.AIValidatedMoveToBehavior(
                    lp.player,
                    mod.GetObjectPosition(mod.GetHQ(1))
                )
            })
        }
    }

    protected override OnPlayerEarnedKill(
        eventPlayer: mod.Player,
        eventOtherPlayer: mod.Player,
        eventDeathType: mod.DeathType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void {
        const team = mod.GetTeam(eventPlayer)
        const otherTeam = mod.GetTeam(eventOtherPlayer)

        if (mod.Equals(team, otherTeam)) {
            return
        }

        const teamScore = this.addTeamScore(team, 1)

        mod.SetGameModeScore(team, teamScore)
    }

    protected override OnPlayerLeaveGame(eventNumber: number): void {
        const lp = this.playerManager.getById(eventNumber)
        if (!lp) return

        // Respawn persistent bot
        if (lp.isPersistentAI()) {
            this.playerManager.respawnBot(
                lp,
                mod.GetObjectPosition(mod.GetHQ(1)),
                this.AI_UNSPAWN_DELAY
            )
        }
    }

    protected override OngoingGlobal(): void {
        mod.SetScoreboardHeader(
            mod.Message(
                `gamemodes.TDM.scoreboard.team1`,
                mod.GetGameModeScore(mod.GetTeam(1))
            ),
            mod.Message(
                `gamemodes.TDM.scoreboard.team2`,
                mod.GetGameModeScore(mod.GetTeam(2))
            )
        )
    }

    private addTeamScore(team: mod.Team, deltaScore: number): number {
        const teamId = mod.GetObjId(team)
        const currentScore =
            this.teamScores.get(teamId) ?? mod.GetGameModeScore(team)
        const nextScore = currentScore + deltaScore
        this.teamScores.set(teamId, nextScore)
        return nextScore
    }
}
