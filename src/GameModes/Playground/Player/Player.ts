import { CorePlayer_APlayer } from 'src/Core/Player/APlayer'
import { CorePlayer_BattleStatsComponent } from 'src/Core/Player/Components/BattleStats/BattleStatsComponent'
import { CorePlayer_ProtectionComponent } from 'src/Core/Player/Components/Protection/ProtectionComponent'

export class Player extends CorePlayer_APlayer {
    protectionComp: CorePlayer_ProtectionComponent

    constructor(player: mod.Player) {
        super(player)

        this.protectionComp = new CorePlayer_ProtectionComponent()
        this.addComponent(this.protectionComp)

        this.addListener({
            OnPlayerDeployed: () => {
                // spawn protection
                this.protectionComp.activate(5)
            },
        })
    }
}
