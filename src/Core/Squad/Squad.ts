import { Core_AGameMode } from '../AGameMode'
import { CorePlayer_APlayer } from '../Player/APlayer'
import { CoreAI_FollowerProfile } from '../AI/Profiles/FollowerProfile'
import { BrainComponent } from '../AI/Components/BrainComponent'

export class CoreAI_Squad {
    private members: CorePlayer_APlayer[] = []
    private leader: CorePlayer_APlayer | null = null

    private gameMode: Core_AGameMode
    private teamId: number
    private maxSlots: number

    constructor(
        gameMode: Core_AGameMode,
        teamId: number,
        maxSlots: number = 4
    ) {
        this.gameMode = gameMode
        this.teamId = teamId
        this.maxSlots = maxSlots

        this.gameMode.addListener({
            OngoingGlobal: () => {},
        })
    }

    /* ------------------------------------------------------------
     * Helpers
     * ------------------------------------------------------------ */

    getTeamId(): number {
        return this.teamId
    }

    getMaxSlots(): number {
        return this.maxSlots
    }

    freeSlots(): number {
        return this.maxSlots - this.members.length
    }

    getMembers(): CorePlayer_APlayer[] {
        return this.members
    }

    getLeader(): CorePlayer_APlayer | null {
        return this.leader
    }

    removeMember(ap: CorePlayer_APlayer): void {
        const index = this.members.indexOf(ap)
        if (index === -1) return

        this.members.splice(index, 1)

        if (this.leader === ap) {
            this.leader = this.members[0] ?? null
        }
    }

    /* ------------------------------------------------------------
     * Member management
     * ------------------------------------------------------------ */

    addMember(ap: CorePlayer_APlayer): void {
        if (this.freeSlots() <= 0) return

        this.members.push(ap)

        if (!this.leader) {
            this.leader = ap
        }

        // Followers only (leader keeps its current behavior)
        if (ap === this.leader) {
            return
        }

        const brainComp = ap.getComponent(BrainComponent)
        if (!brainComp) {
            return
        }

        // Assign follower profile
        const profile = new CoreAI_FollowerProfile({
            getPoint: () => this.getSquadPoint(),
        })
        brainComp.brain.installProfile(profile)
    }

    /* ------------------------------------------------------------
     * Squad follow point
     * ------------------------------------------------------------ */

    private getSquadPoint(): mod.Vector | null {
        if (this.leader) {
            if (
                !mod.GetSoldierState(
                    this.leader.player,
                    mod.SoldierStateBool.IsAlive
                )
            ) {
                return null
            }
            return mod.GetObjectPosition(this.leader.player)
        }
        return null
    }
}
