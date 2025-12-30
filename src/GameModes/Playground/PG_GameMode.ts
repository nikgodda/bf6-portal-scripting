import { Core_AGameMode } from 'src/Core/AGameMode'
import { CorePlayer_APlayerManager } from 'src/Core/Player/APlayerManager'
import { CorePlayer_APlayer } from 'src/Core/Player/APlayer'
import { CoreAI_Brain } from 'src/Core/AI/Brain'
import { CoreAI_CombatantProfile } from 'src/Core/AI/Profiles/CombatantProfile'
import { BrainComponent } from 'src/Core/AI/Components/BrainComponent'
import { Core_SquadManager } from 'src/Core/Squad/SquadManager'
import { PlayerManager } from './Player/PlayerManager'

export class PG_GameMode extends Core_AGameMode {
    protected override createPlayerManager(): CorePlayer_APlayerManager {
        return new PlayerManager()
    }

    private AI_UNSPAWN_DELAY = 10
    private AI_COUNT_TEAM_1 = 1
    private AI_COUNT_TEAM_2 = 1

    private squadManager: Core_SquadManager | null = null

    protected override OnGameModeStarted(): void {
        // One-time game setup (rules, scoreboard, AI bootstrap)
        mod.SetAIToHumanDamageModifier(2)
        mod.SetFriendlyFire(true)

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

        /*
         *
         */
        const vehicleSpawner = mod.SpawnObject(
            mod.RuntimeSpawn_Common.VehicleSpawner,
            mod.GetObjectPosition(mod.GetHQ(1)),
            mod.CreateVector(0, 0, 0)
        )

        mod.SetVehicleSpawnerVehicleType(vehicleSpawner, mod.VehicleList.Abrams)
        mod.ForceVehicleSpawnerSpawn(vehicleSpawner)

        // mod.Wait(7).then(() => {
        mod.SetVehicleSpawnerVehicleType(vehicleSpawner, mod.VehicleList.Abrams)
        mod.ForceVehicleSpawnerSpawn(vehicleSpawner)
        // })
    }

    /*
     *
     */

    private vehicle: mod.Vehicle | null = null

    protected override OnVehicleSpawned(eventVehicle: mod.Vehicle): void {
        this.vehicle = eventVehicle
    }

    protected override OnPlayerExitVehicle(
        eventPlayer: mod.Player,
        eventVehicle: mod.Vehicle
    ): void {}

    /*
     *
     */

    protected override async OnLogicalPlayerJoinGame(
        lp: CorePlayer_APlayer
    ): Promise<void> {
        // if (2 > 1) return

        // Attach AI brain to logical AI players only
        if (lp.isLogicalAI()) {
            if (lp.teamId === 1) {
                await mod.Wait(5)
                mod.ForcePlayerToSeat(lp.player, this.vehicle!, -1)
            }

            const brain = new CoreAI_Brain(
                lp.player,
                new CoreAI_CombatantProfile({
                    vehicleMoveToSensor: {
                        getVehicleWPs: () => /* this.getRoamWps(1100, 1105) */ [
                            mod.GetObjectPosition(mod.GetHQ(1)),
                            mod.GetObjectPosition(mod.GetHQ(3)),
                            mod.GetObjectPosition(mod.GetHQ(4)),
                        ],
                        ttlMs: 20000,
                    },
                    arrivalSensor: {
                        getDefendWPs: () => [],
                        ttlMs: 4000,
                    },
                }),
                true
            )

            lp.addComponent(new BrainComponent(brain))
        }

        // Ensure squad system exists and register the player
        /* if (!this.squadManager) {
            this.squadManager = new Core_SquadManager(this, 2)
        }

        this.squadManager.addToSquad(lp) */
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

    private getRoamWps(from: number, to: number): mod.Vector[] {
        const out: mod.Vector[] = []

        for (let id = from; id <= to; id++) {
            const wp = mod.GetSpatialObject(id)
            out.push(mod.GetObjectPosition(wp))
        }

        return out
    }
}
