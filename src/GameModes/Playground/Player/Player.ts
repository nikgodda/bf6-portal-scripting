import { CoreAI_BrainComponent } from 'src/Core/AI/Components/BrainComponent'
import { CorePlayer_APlayer } from 'src/Core/Player/APlayer'
import { CorePlayer_ProtectionComponent } from 'src/Core/Player/Components/Protection/ProtectionComponent'
import { PG_GameMode } from '../PG_GameMode'

export class Player extends CorePlayer_APlayer {
    protectionComp: CorePlayer_ProtectionComponent

    constructor(player: mod.Player) {
        super(player)

        this.protectionComp = new CorePlayer_ProtectionComponent()
        this.addComponent(this.protectionComp)

        this.addListener({
            OnPlayerDeployed: () => {
                // spawn protection
                this.isLogicalAI()
                    ? this.protectionComp.activate(5)
                    : this.protectionComp.activate(5)

                const brainComp = this.getComponent(CoreAI_BrainComponent)
                if (brainComp) {
                    brainComp.brain.installProfile(PG_GameMode.infantryProfile)
                }

                // mod.SetCameraTypeForPlayer(this.player, mod.Cameras.ThirdPerson)
                // mod.AIEnableShooting(this.player, false)
            },

            OnPlayerEnterVehicleSeat: (eventVehicle, eventSeat) => {
                const brainComp = this.getComponent(CoreAI_BrainComponent)
                if (brainComp) {
                    if (mod.GetPlayerVehicleSeat(this.player) !== 0) {
                        return
                    }

                    brainComp.brain.installProfile(PG_GameMode.driverProfile)
                }
            },

            OnPlayerExitVehicle: (eventVehicle) => {
                const brainComp = this.getComponent(CoreAI_BrainComponent)
                if (brainComp) {
                    brainComp.brain.installProfile(PG_GameMode.infantryProfile)
                }
            },
        })
    }
}
