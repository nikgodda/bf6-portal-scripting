import { Core_AGameMode } from 'src/Core/AGameMode'
import { CorePlayer_APlayerManager } from 'src/Core/Player/APlayerManager'
import { TDM_PlayerManager } from './Player/TDM_PlayerManager'

export class TDM_GameMode extends Core_AGameMode {
    protected override createPlayerManager(): CorePlayer_APlayerManager {
        return new TDM_PlayerManager()
    }

    protected override OnGameModeStarted(): void {
        mod.DisplayNotificationMessage(mod.Message(`gamemodes.TDM.gamemodeStarted`))
    }
}

