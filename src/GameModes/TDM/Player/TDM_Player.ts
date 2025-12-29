import { CorePlayer_APlayer } from 'src/Core/Player/APlayer'
import { CorePlayer_BattleStatsComponent } from 'src/Core/Player/Components/BattleStats/BattleStatsComponent'
import { CorePlayer_ProtectionComponent } from 'src/Core/Player/Components/Protection/ProtectionComponent'

export class TDM_Player extends CorePlayer_APlayer {
    protectionComp: CorePlayer_ProtectionComponent
    battleStatsComp: CorePlayer_BattleStatsComponent

    constructor(player: mod.Player) {
        super(player)

        this.protectionComp = new CorePlayer_ProtectionComponent()
        this.addComponent(this.protectionComp)

        this.battleStatsComp = new CorePlayer_BattleStatsComponent()
        this.addComponent(this.battleStatsComp)

        this.addListener({
            OnPlayerDeployed: () => {
                this.protectionComp.activate(5)
                this.battleStatsComp.clearKillStreak()
            },

            OnPlayerDied: () => {
                this.battleStatsComp.addDeath()

                mod.Wait(0.1).then(() => {
                    mod.Kill(this.player)
                })
            },

            OnPlayerEarnedKill: (
                eventOtherPlayer,
                eventDeathType,
                eventWeaponUnlock
            ) => {
                if (!eventOtherPlayer) {
                    return
                }

                if (
                    mod.Equals(
                        mod.GetTeam(this.player),
                        mod.GetTeam(eventOtherPlayer.player)
                    )
                ) {
                    if (!mod.Equals(this.player, eventOtherPlayer.player)) {
                        this.battleStatsComp.addTeamKill()
                    }
                } else {
                    this.battleStatsComp.addKill()
                    this.battleStatsComp.addKillStreak()
                    this.battleStatsComp.addScore(
                        100 + (this.battleStatsComp.getKillStreak() - 1) * 10
                    )
                }
            },

            OngoingPlayer: () => {
                if (!mod.IsPlayerValid(this.player)) {
                    return
                }

                mod.SetScoreboardPlayerValues(
                    this.player,
                    this.battleStatsComp.getScore(),
                    this.battleStatsComp.getKills(),
                    this.battleStatsComp.getDeaths(),
                    this.battleStatsComp.getTeamKills(),
                    this.battleStatsComp.getKillStreak()
                )
            },
        })
    }
}
