import { CorePlayer_APlayer } from 'src/Core/Player/APlayer'

export class TDM_Player extends CorePlayer_APlayer {
    constructor(player: mod.Player) {
        super(player)

        this.addListener({
            OnPlayerDeployed: () => {
                mod.DisplayHighlightedWorldLogMessage(
                    mod.Message(
                        `gamemodes.TDM.playerDeployed`,
                        mod.GetObjId(this.player)
                    )
                )
            },
        })
    }
}

