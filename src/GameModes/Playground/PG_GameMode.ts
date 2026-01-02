import { Core_AGameMode } from 'src/Core/AGameMode'
import { CorePlayer_APlayerManager } from 'src/Core/Player/APlayerManager'
import { CorePlayer_APlayer } from 'src/Core/Player/APlayer'
import { CoreAI_Brain } from 'src/Core/AI/Brain'
import { CoreAI_CombatantProfile } from 'src/Core/AI/Profiles/CombatantProfile'
import { CoreAI_BrainComponent } from 'src/Core/AI/Components/BrainComponent'
import { Core_SquadManager } from 'src/Core/Squad/SquadManager'
import { PlayerManager } from './Player/PlayerManager'
import { CoreAI_BaseProfile } from 'src/Core/AI/Profiles/BaseProfile'

export class PG_GameMode extends Core_AGameMode {
    protected override createPlayerManager(): CorePlayer_APlayerManager {
        return new PlayerManager()
    }

    private AI_UNSPAWN_DELAY = 10
    private AI_COUNT_TEAM_1 = 1
    private AI_COUNT_TEAM_2 = 0

    private squadManager: Core_SquadManager | null = null

    private defInfantryProfile: CoreAI_BaseProfile =
        new CoreAI_CombatantProfile({
            fightSensor: {},
            /* closestEnemySensor: {}, */
            RoamSensor: {
                getWPs: () => this.geRangeWPs(1000, 1010),
                ttlMs: 4000,
            },
            vehicleToDriveSensor: {
                radius: 200,
            },
        })

    private defVehicleProfile: CoreAI_BaseProfile = new CoreAI_CombatantProfile(
        {
            fightSensor: {
                ttlMs: 10000,
            },
            RoamSensor: {
                getWPs: () => this.geRangeWPs(1107, 1109),
                ttlMs: 60000,
            },
            /* arrivalSensor: {
                getWPs: () => this.geRangeWPs(1100, 1107),
                ttlMs: 20000,
            }, */
        }
    )

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

        mod.Wait(30).then(() => {
            const vehicleSpawner = mod.SpawnObject(
                mod.RuntimeSpawn_Common.VehicleSpawner,
                mod.GetObjectPosition(mod.GetSpatialObject(1106)),
                mod.CreateVector(0, 0, 0)
            )

            mod.SetVehicleSpawnerVehicleType(
                vehicleSpawner,
                mod.VehicleList.Abrams
            )
            mod.ForceVehicleSpawnerSpawn(vehicleSpawner)
        })

        mod.Wait(31).then(() => {
            const vehicleSpawner1 = mod.SpawnObject(
                mod.RuntimeSpawn_Common.VehicleSpawner,
                mod.GetObjectPosition(mod.GetSpatialObject(1107)),
                mod.CreateVector(0, 0, 0)
            )

            mod.SetVehicleSpawnerVehicleType(
                vehicleSpawner1,
                mod.VehicleList.Abrams
            )
            mod.ForceVehicleSpawnerSpawn(vehicleSpawner1)
        })
    }

    /*
     *
     */

    protected override OnVehicleSpawned(eventVehicle: mod.Vehicle): void {
        mod.DisplayHighlightedWorldLogMessage(mod.Message(666))
    }

    protected override OnPlayerEnterVehicleSeat(
        eventPlayer: mod.Player,
        eventVehicle: mod.Vehicle,
        eventSeat: mod.Object
    ): void {
        const lp = this.playerManager.get(eventPlayer)
        if (!lp) return

        const brainComp = lp.getComponent(CoreAI_BrainComponent)
        if (!brainComp) {
            return
        }

        const seat = mod.GetPlayerVehicleSeat(eventPlayer)

        if (seat !== 0) {
            return
        }

        brainComp.brain.installProfile(this.defVehicleProfile)
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
                this.defInfantryProfile,
                true
            )

            lp.addComponent(new CoreAI_BrainComponent(brain))
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

    private geRangeWPs(from: number, to: number): mod.Vector[] {
        const out: mod.Vector[] = []

        for (let id = from; id <= to; id++) {
            const wp = mod.GetSpatialObject(id)
            out.push(mod.GetObjectPosition(wp))
        }

        return out
    }
}
