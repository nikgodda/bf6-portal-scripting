import * as modlib from 'modlib'

// -------- FILE: src\Core\Player\IPlayerEvents.ts --------
export interface CorePlayer_IPlayerEvents {
    // Lifecycle
    OnPlayerJoinGame?(joinedPlayer: CorePlayer_APlayer): void
    OnPlayerLeaveGame?(): void

    OnPlayerDeployed?(): void
    OnPlayerDied?(
        eventOtherPlayer: CorePlayer_APlayer | undefined,
        eventDeathType: mod.DeathType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void
    OnPlayerUndeploy?(): void

    // Damage / kills
    OnPlayerDamaged?(
        eventOtherPlayer: CorePlayer_APlayer | undefined,
        eventDamageType: mod.DamageType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void
    OnPlayerEarnedKill?(
        eventOtherPlayer: CorePlayer_APlayer | undefined,
        eventDeathType: mod.DeathType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void
    OnPlayerEarnedKillAssist?(
        eventOtherPlayer: CorePlayer_APlayer | undefined
    ): void
    OnMandown?(eventOtherPlayer: CorePlayer_APlayer | undefined): void
    OnRevived?(eventOtherPlayer: CorePlayer_APlayer | undefined): void

    // Interactions / triggers
    OnPlayerInteract?(eventInteractPoint: mod.InteractPoint): void
    OnPlayerEnterAreaTrigger?(eventAreaTrigger: mod.AreaTrigger): void
    OnPlayerExitAreaTrigger?(eventAreaTrigger: mod.AreaTrigger): void
    OnPlayerEnterCapturePoint?(eventCapturePoint: mod.CapturePoint): void
    OnPlayerExitCapturePoint?(eventCapturePoint: mod.CapturePoint): void

    // Vehicles
    OnPlayerEnterVehicle?(eventVehicle: mod.Vehicle): void
    OnPlayerExitVehicle?(eventVehicle: mod.Vehicle): void
    OnPlayerEnterVehicleSeat?(
        eventVehicle: mod.Vehicle,
        eventSeat: mod.Object
    ): void
    OnPlayerExitVehicleSeat?(
        eventVehicle: mod.Vehicle,
        eventSeat: mod.Object
    ): void

    // Team / UI
    OnPlayerSwitchTeam?(eventTeam: mod.Team): void
    OnPlayerUIButtonEvent?(
        eventUIWidget: mod.UIWidget,
        eventUIButtonEvent: mod.UIButtonEvent
    ): void

    // Raycast
    OnRayCastHit?(eventPoint: mod.Vector, eventNormal: mod.Vector): void
    OnRayCastMissed?(): void

    // Spawner
    // OnSpawnerSpawned?(eventSpawner: mod.Spawner): void

    // AI movement
    OnAIMoveToFailed?(): void
    OnAIMoveToRunning?(): void
    OnAIMoveToSucceeded?(): void

    // Waypoint idle
    OnAIWaypointIdleFailed?(): void
    OnAIWaypointIdleRunning?(): void
    OnAIWaypointIdleSucceeded?(): void

    // Parachute
    OnAIParachuteRunning?(): void
    OnAIParachuteSucceeded?(): void

    // Ongoing tick
    OngoingPlayer?(): void

    /*
     *
     */
    OnLogicalPlayerJoinGame?(lp: CorePlayer_APlayer): void
}

// -------- FILE: src\Core\Player\Components\AI\LogicalAIComponent.ts --------
export class CorePlayer_LogicalAIComponent implements CorePlayer_IComponent {
    public soldierClass: mod.SoldierClass
    public displayName: mod.Message
    public spawner: mod.Spawner

    private ap!: CorePlayer_APlayer

    constructor(
        classType: mod.SoldierClass,
        displayName: mod.Message,
        spawner: mod.Spawner
    ) {
        this.soldierClass = classType
        this.displayName = displayName
        this.spawner = spawner
    }

    onAttach(ap: CorePlayer_APlayer): void {
        this.ap = ap
    }

    onDetach(ap: CorePlayer_APlayer): void {
        // No cleanup needed for now
    }

    public get player(): mod.Player {
        return this.ap.player
    }
}

// -------- FILE: src\Core\Player\APlayer.ts --------
/**
 * CorePlayer_APlayer
 *
 * Logical player abstraction.
 * Represents a persistent identity across soldier respawns.
 *
 * - Used for both human players and AI bots
 * - Does NOT know about AI or brains
 * - Extended via components
 */
export abstract class CorePlayer_APlayer {
    public player: mod.Player
    public readonly id: number

    public teamId: number = 0

    protected listeners: CorePlayer_IPlayerEvents[] = []
    protected components: CorePlayer_IComponent[] = []

    private static nextId: number = 1

    constructor(player: mod.Player) {
        this.player = player
        this.id = CorePlayer_APlayer.nextId++

        this.teamId = mod.GetObjId(mod.GetTeam(player))
    }

    isAI(): boolean {
        return mod.GetSoldierState(
            this.player,
            mod.SoldierStateBool.IsAISoldier
        )
    }

    isLogicalAI(): boolean {
        return !!this.logicalAIComp
    }

    /* ------------------------------------------------------------
     * Common component shortcuts
     * ------------------------------------------------------------ */

    public get logicalAIComp():
        | CorePlayer_LogicalAIComponent
        | undefined {
        return this.getComponent(CorePlayer_LogicalAIComponent)
    }

    /* ------------------------------------------------------------
     * Event system
     * ------------------------------------------------------------ */

    public addListener(listener: CorePlayer_IPlayerEvents): void {
        this.listeners.push(listener)
    }

    public removeListener(listener: CorePlayer_IPlayerEvents): void {
        this.listeners = this.listeners.filter((l) => l !== listener)
    }

    public clearListeners(): void {
        this.listeners = []
    }

    public emit<E extends keyof CorePlayer_IPlayerEvents>(
        event: E,
        ...args: Parameters<NonNullable<CorePlayer_IPlayerEvents[E]>>
    ): void {
        for (const listener of this.listeners) {
            const fn = listener[event]
            if (typeof fn === 'function') {
                ;(fn as (...a: any[]) => void).call(listener, ...args)
            }
        }
    }

    /* ------------------------------------------------------------
     * Component system
     * ------------------------------------------------------------ */

    public addComponent(component: CorePlayer_IComponent): void {
        this.components.push(component)
        component.onAttach(this)
    }

    public removeComponent<T extends CorePlayer_IComponent>(
        ctor: new (...args: any[]) => T
    ): void {
        this.components = this.components.filter((c) => {
            if (c instanceof ctor) {
                c.onDetach(this)
                return false
            }
            return true
        })
    }

    public getComponent<T extends CorePlayer_IComponent>(
        ctor: new (...args: any[]) => T
    ): T | undefined {
        return this.components.find((c) => c instanceof ctor) as T | undefined
    }

    public getComponents(): readonly CorePlayer_IComponent[] {
        return this.components
    }

    /* ------------------------------------------------------------
     * Soldier rebinding
     * ------------------------------------------------------------ */

    public rebindTo(newPlayer: mod.Player): void {
        this.player = newPlayer
        this.teamId = mod.GetObjId(mod.GetTeam(newPlayer))

        for (const component of this.components) {
            const anyComp = component as any
            if (typeof anyComp.onRebind === 'function') {
                anyComp.onRebind(newPlayer)
            }
        }
    }
}

/* ------------------------------------------------------------
 * Component interface
 * ------------------------------------------------------------ */

export interface CorePlayer_IComponent {
    onAttach(ap: CorePlayer_APlayer): void
    onDetach(ap: CorePlayer_APlayer): void
}

// -------- FILE: src\Core\IGameModeEngineEvents.ts --------
export interface CorePlayer_IGameModeCustomEvents {}

export interface CorePlayer_IGameModeEngineEvents {
    OngoingGlobal?(): void
    OngoingAreaTrigger?(eventAreaTrigger: mod.AreaTrigger): void
    OngoingCapturePoint?(eventCapturePoint: mod.CapturePoint): void
    OngoingEmplacementSpawner?(
        eventEmplacementSpawner: mod.EmplacementSpawner
    ): void
    OngoingHQ?(eventHQ: mod.HQ): void
    OngoingInteractPoint?(eventInteractPoint: mod.InteractPoint): void
    OngoingLootSpawner?(eventLootSpawner: mod.LootSpawner): void
    OngoingMCOM?(eventMCOM: mod.MCOM): void
    OngoingPlayer?(eventPlayer: mod.Player): void
    OngoingRingOfFire?(eventRingOfFire: mod.RingOfFire): void
    OngoingSector?(eventSector: mod.Sector): void
    OngoingSpawner?(eventSpawner: mod.Spawner): void
    OngoingSpawnPoint?(eventSpawnPoint: mod.SpawnPoint): void
    OngoingTeam?(eventTeam: mod.Team): void
    OngoingVehicle?(eventVehicle: mod.Vehicle): void
    OngoingVehicleSpawner?(eventVehicleSpawner: mod.VehicleSpawner): void
    OngoingWaypointPath?(eventWaypointPath: mod.WaypointPath): void
    OngoingWorldIcon?(eventWorldIcon: mod.WorldIcon): void

    OnAIMoveToFailed?(eventPlayer: mod.Player): void
    OnAIMoveToRunning?(eventPlayer: mod.Player): void
    OnAIMoveToSucceeded?(eventPlayer: mod.Player): void
    OnAIParachuteRunning?(eventPlayer: mod.Player): void
    OnAIParachuteSucceeded?(eventPlayer: mod.Player): void
    OnAIWaypointIdleFailed?(eventPlayer: mod.Player): void
    OnAIWaypointIdleRunning?(eventPlayer: mod.Player): void
    OnAIWaypointIdleSucceeded?(eventPlayer: mod.Player): void

    OnCapturePointCaptured?(eventCapturePoint: mod.CapturePoint): void
    OnCapturePointCapturing?(eventCapturePoint: mod.CapturePoint): void
    OnCapturePointLost?(eventCapturePoint: mod.CapturePoint): void

    OnGameModeEnding?(): void
    OnGameModeStarted?(): void

    OnMandown?(eventPlayer: mod.Player, eventOtherPlayer: mod.Player): void

    OnMCOMArmed?(eventMCOM: mod.MCOM): void
    OnMCOMDefused?(eventMCOM: mod.MCOM): void
    OnMCOMDestroyed?(eventMCOM: mod.MCOM): void

    OnPlayerDamaged?(
        eventPlayer: mod.Player,
        eventOtherPlayer: mod.Player,
        eventDamageType: mod.DamageType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void

    OnPlayerDeployed?(eventPlayer: mod.Player): void

    OnPlayerDied?(
        eventPlayer: mod.Player,
        eventOtherPlayer: mod.Player,
        eventDeathType: mod.DeathType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void

    OnPlayerEarnedKill?(
        eventPlayer: mod.Player,
        eventOtherPlayer: mod.Player,
        eventDeathType: mod.DeathType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void

    OnPlayerEarnedKillAssist?(
        eventPlayer: mod.Player,
        eventOtherPlayer: mod.Player
    ): void

    OnPlayerEnterAreaTrigger?(
        eventPlayer: mod.Player,
        eventAreaTrigger: mod.AreaTrigger
    ): void

    OnPlayerEnterCapturePoint?(
        eventPlayer: mod.Player,
        eventCapturePoint: mod.CapturePoint
    ): void

    OnPlayerEnterVehicle?(
        eventPlayer: mod.Player,
        eventVehicle: mod.Vehicle
    ): void

    OnPlayerEnterVehicleSeat?(
        eventPlayer: mod.Player,
        eventVehicle: mod.Vehicle,
        eventSeat: mod.Object
    ): void

    OnPlayerExitAreaTrigger?(
        eventPlayer: mod.Player,
        eventAreaTrigger: mod.AreaTrigger
    ): void

    OnPlayerExitCapturePoint?(
        eventPlayer: mod.Player,
        eventCapturePoint: mod.CapturePoint
    ): void

    OnPlayerExitVehicle?(
        eventPlayer: mod.Player,
        eventVehicle: mod.Vehicle
    ): void

    OnPlayerExitVehicleSeat?(
        eventPlayer: mod.Player,
        eventVehicle: mod.Vehicle,
        eventSeat: mod.Object
    ): void

    OnPlayerInteract?(
        eventPlayer: mod.Player,
        eventInteractPoint: mod.InteractPoint
    ): void

    OnPlayerJoinGame?(eventPlayer: mod.Player): void
    OnPlayerLeaveGame?(eventNumber: number): void

    OnPlayerSwitchTeam?(eventPlayer: mod.Player, eventTeam: mod.Team): void

    OnPlayerUIButtonEvent?(
        eventPlayer: mod.Player,
        eventUIWidget: mod.UIWidget,
        eventUIButtonEvent: mod.UIButtonEvent
    ): void

    OnPlayerUndeploy?(eventPlayer: mod.Player): void

    OnRayCastHit?(
        eventPlayer: mod.Player,
        eventPoint: mod.Vector,
        eventNormal: mod.Vector
    ): void

    OnRayCastMissed?(eventPlayer: mod.Player): void

    OnRevived?(eventPlayer: mod.Player, eventOtherPlayer: mod.Player): void

    OnRingOfFireZoneSizeChange?(
        eventRingOfFire: mod.RingOfFire,
        eventNumber: number
    ): void

    OnSpawnerSpawned?(eventPlayer: mod.Player, eventSpawner: mod.Spawner): void

    OnTimeLimitReached?(): void

    OnVehicleDestroyed?(eventVehicle: mod.Vehicle): void
    OnVehicleSpawned?(eventVehicle: mod.Vehicle): void

    /**
     * Fired when a logical AI player identity becomes active.
     *
     * This mirrors human OnPlayerJoinGame semantics,
     * but ONLY for logical AI.
     *
     * This is NOT an engine event.
     */
    OnLogicalPlayerJoinGame?(lp: CorePlayer_APlayer): void
}

// -------- FILE: src\Core\Player\APlayerManager.ts --------
/**
 * CorePlayer_APlayerManager
 *
 * Manages the lifecycle and mapping of logical players (APlayer).
 * Converts raw engine mod.Player events into logical high-level events.
 *
 * Flow:
 *   Engine Event -> GameMode._internal -> PlayerManager -> APlayer.emit
 *
 * Notes:
 * - APlayer represents any logical player (human or AI).
 * - AI-specific data is stored via AIComponent attached to APlayer.
 * - NPCs that are not Logical Players are NOT handled here.
 */

type CorePlayer_PlayerCtor<T extends CorePlayer_APlayer = CorePlayer_APlayer> =
    new (player: mod.Player) => T

export class CorePlayer_APlayerManager<
    TPlayer extends CorePlayer_APlayer = CorePlayer_APlayer
> {
    protected players = new Map<number, TPlayer>()
    private readonly PlayerClass: CorePlayer_PlayerCtor<TPlayer>

    constructor(PlayerClass: CorePlayer_PlayerCtor<TPlayer>) {
        this.PlayerClass = PlayerClass
    }

    protected createPlayer(player: mod.Player): TPlayer {
        return new this.PlayerClass(player)
    }

    /* ------------------------------------------------------------
     *
     * ------------------------------------------------------------ */

    notifyGameModeOnLogicalPlayerJoin?: (lp: CorePlayer_APlayer) => void

    /* ------------------------------------------------------------
     * Player registration
     * ------------------------------------------------------------ */

    public async OnPlayerJoinGame(player: mod.Player): Promise<void> {
        // Ignore AI soldiers here.
        // Logical AI is handled in OnSpawnerSpawned.
        if (mod.GetSoldierState(player, mod.SoldierStateBool.IsAISoldier)) {
            return
        }

        const lp = this.get(player)
        if (lp) {
            return // already logical
        }

        // Human player has team 0 on join. We wait till team init. After we can change team if need
        await mod.Wait(2)

        const logicalPlayer = this.createPlayer(player)
        this.players.set(mod.GetObjId(player), logicalPlayer)

        // Notify GameMode + observers
        this.notifyGameModeOnLogicalPlayerJoin?.(logicalPlayer)
    }

    removePlayer(playerId: number): void {
        const lp = this.players.get(playerId)
        if (lp) {
            lp.clearListeners()
        }
        this.players.delete(playerId)
    }

    /* ------------------------------------------------------------
     * Lookup helpers
     * ------------------------------------------------------------ */

    get(player: mod.Player): TPlayer | undefined {
        if (!mod.IsPlayerValid(player)) return undefined
        return this.players.get(mod.GetObjId(player))
    }

    getById(id: number): TPlayer | undefined {
        return this.players.get(id)
    }

    allPlayers(): TPlayer[] {
        return [...this.players.values()]
    }

    /* ------------------------------------------------------------
     * Ongoing
     * ------------------------------------------------------------ */

    tick(eventPlayer: mod.Player): void {
        const lp = this.get(eventPlayer)
        lp?.emit('OngoingPlayer')
    }

    /* ------------------------------------------------------------
     * Lifecycle events
     * ------------------------------------------------------------ */

    OnPlayerDeployed(lp: TPlayer): void {
        lp.emit('OnPlayerDeployed')
    }

    OnPlayerDied(
        lp: TPlayer,
        other: TPlayer | undefined,
        deathType: mod.DeathType,
        weapon: mod.WeaponUnlock
    ): void {
        lp.emit('OnPlayerDied', other, deathType, weapon)
    }

    OnPlayerUndeploy(lp: TPlayer): void {
        lp.emit('OnPlayerUndeploy')
    }

    /* ------------------------------------------------------------
     * Combat events
     * ------------------------------------------------------------ */

    OnPlayerDamaged(
        lp: TPlayer,
        other: TPlayer | undefined,
        damageType: mod.DamageType,
        weapon: mod.WeaponUnlock
    ): void {
        lp.emit('OnPlayerDamaged', other, damageType, weapon)
    }

    OnPlayerEarnedKill(
        lp: TPlayer,
        other: TPlayer | undefined,
        deathType: mod.DeathType,
        weapon: mod.WeaponUnlock
    ): void {
        lp.emit('OnPlayerEarnedKill', other, deathType, weapon)
    }

    OnPlayerEarnedKillAssist(lp: TPlayer, other: TPlayer | undefined): void {
        lp.emit('OnPlayerEarnedKillAssist', other)
    }

    OnMandown(lp: TPlayer, other: TPlayer | undefined): void {
        lp.emit('OnMandown', other)
    }

    OnRevived(lp: TPlayer, other: TPlayer | undefined): void {
        lp.emit('OnRevived', other)
    }

    /* ------------------------------------------------------------
     * Interaction events
     * ------------------------------------------------------------ */

    OnPlayerInteract(lp: TPlayer, interact: mod.InteractPoint): void {
        lp.emit('OnPlayerInteract', interact)
    }

    OnPlayerEnterAreaTrigger(lp: TPlayer, trigger: mod.AreaTrigger): void {
        lp.emit('OnPlayerEnterAreaTrigger', trigger)
    }

    OnPlayerExitAreaTrigger(lp: TPlayer, trigger: mod.AreaTrigger): void {
        lp.emit('OnPlayerExitAreaTrigger', trigger)
    }

    OnPlayerEnterCapturePoint(lp: TPlayer, cp: mod.CapturePoint): void {
        lp.emit('OnPlayerEnterCapturePoint', cp)
    }

    OnPlayerExitCapturePoint(lp: TPlayer, cp: mod.CapturePoint): void {
        lp.emit('OnPlayerExitCapturePoint', cp)
    }

    /* ------------------------------------------------------------
     * Vehicle events
     * ------------------------------------------------------------ */

    OnPlayerEnterVehicle(lp: TPlayer, veh: mod.Vehicle): void {
        lp.emit('OnPlayerEnterVehicle', veh)
    }

    OnPlayerExitVehicle(lp: TPlayer, veh: mod.Vehicle): void {
        lp.emit('OnPlayerExitVehicle', veh)
    }

    OnPlayerEnterVehicleSeat(
        lp: TPlayer,
        vehicle: mod.Vehicle,
        seat: mod.Object
    ): void {
        lp.emit('OnPlayerEnterVehicleSeat', vehicle, seat)
    }

    OnPlayerExitVehicleSeat(
        lp: TPlayer,
        vehicle: mod.Vehicle,
        seat: mod.Object
    ): void {
        lp.emit('OnPlayerExitVehicleSeat', vehicle, seat)
    }

    /* ------------------------------------------------------------
     * UI / Team
     * ------------------------------------------------------------ */

    OnPlayerSwitchTeam(lp: TPlayer, team: mod.Team): void {
        lp.emit('OnPlayerSwitchTeam', team)
    }

    OnPlayerUIButtonEvent(
        lp: TPlayer,
        widget: mod.UIWidget,
        evt: mod.UIButtonEvent
    ): void {
        lp.emit('OnPlayerUIButtonEvent', widget, evt)
    }

    /* ------------------------------------------------------------
     * Raycast
     * ------------------------------------------------------------ */

    OnRayCastHit(lp: TPlayer, point: mod.Vector, normal: mod.Vector): void {
        lp.emit('OnRayCastHit', point, normal)
    }

    OnRayCastMissed(lp: TPlayer): void {
        lp.emit('OnRayCastMissed')
    }

    /* ------------------------------------------------------------
     * AI Spawner Respawn System
     * ------------------------------------------------------------ */

    private spawnerMap = new Map<
        number,
        {
            lp?: TPlayer
            teamId: number
            soldierClass: mod.SoldierClass
            displayName: mod.Message
        }
    >()

    public OnSpawnerSpawned(
        eventPlayer: mod.Player,
        eventSpawner: mod.Spawner
    ): void {
        const spawnerId = mod.GetObjId(eventSpawner)
        const entry = this.spawnerMap.get(spawnerId)

        if (!entry) {
            return
        }

        let lp = entry.lp

        if (!lp) {
            // First spawn -> create LP
            lp = this.createPlayer(eventPlayer)

            // Attach AI identity
            lp.addComponent(
                new CorePlayer_LogicalAIComponent(
                    entry.soldierClass,
                    entry.displayName,
                    eventSpawner
                )
            )

            this.players.set(mod.GetObjId(eventPlayer), lp)

            this.notifyGameModeOnLogicalPlayerJoin?.(lp)
        } else {
            // Respawn -> rebind LP
            this.removeMappingFor(lp)
            lp.rebindTo(eventPlayer)
            this.players.set(mod.GetObjId(eventPlayer), lp)
        }

        this.spawnerMap.delete(spawnerId)
    }

    private removeMappingFor(lp: TPlayer): void {
        for (const [soldierId, mapped] of this.players.entries()) {
            if (mapped.id === lp.id) {
                this.players.delete(soldierId)
                break
            }
        }
    }

    /* ------------------------------------------------------------
     * Bot spawner API
     * ------------------------------------------------------------ */

    public spawnLogicalBot(
        soldierClass: mod.SoldierClass,
        teamId: number,
        pos: mod.Vector,
        displayName: mod.Message,
        unspawnDelay: number,
        lp?: TPlayer
    ): void {
        const spawner = mod.SpawnObject(
            mod.RuntimeSpawn_Common.AI_Spawner,
            pos,
            mod.CreateVector(0, 0, 0)
        )

        mod.AISetUnspawnOnDead(spawner, false)
        mod.SetUnspawnDelayInSeconds(spawner, unspawnDelay)

        const spawnerId = mod.GetObjId(spawner)

        this.spawnerMap.set(spawnerId, {
            lp,
            teamId,
            soldierClass,
            displayName,
        })

        mod.SpawnAIFromAISpawner(
            spawner,
            soldierClass,
            displayName,
            mod.GetTeam(teamId)
        )
    }

    public respawnLogicalBot(
        lp: TPlayer,
        spawnPos: mod.Vector,
        unspawnDelay: number
    ): void {
        if (!lp.logicalAIComp) {
            return
        }

        this.spawnLogicalBot(
            lp.logicalAIComp.soldierClass,
            lp.teamId,
            spawnPos,
            lp.logicalAIComp.displayName,
            unspawnDelay,
            lp
        )
    }

    /* ------------------------------------------------------------
     * AI compact movement events
     * ------------------------------------------------------------ */

    OnAIMoveToFailed(lp: TPlayer): void {
        lp.emit('OnAIMoveToFailed')
    }

    OnAIMoveToRunning(lp: TPlayer): void {
        lp.emit('OnAIMoveToRunning')
    }

    OnAIMoveToSucceeded(lp: TPlayer): void {
        lp.emit('OnAIMoveToSucceeded')
    }

    /* ------------------------------------------------------------
     * AI Parachute
     * ------------------------------------------------------------ */

    OnAIParachuteRunning(lp: TPlayer): void {
        lp.emit('OnAIParachuteRunning')
    }

    OnAIParachuteSucceeded(lp: TPlayer): void {
        lp.emit('OnAIParachuteSucceeded')
    }

    /* ------------------------------------------------------------
     * AI Waypoint Idle
     * ------------------------------------------------------------ */

    OnAIWaypointIdleFailed(lp: TPlayer): void {
        lp.emit('OnAIWaypointIdleFailed')
    }

    OnAIWaypointIdleRunning(lp: TPlayer): void {
        lp.emit('OnAIWaypointIdleRunning')
    }

    OnAIWaypointIdleSucceeded(lp: TPlayer): void {
        lp.emit('OnAIWaypointIdleSucceeded')
    }
}

// -------- FILE: src\Core\AGameMode.ts --------
// Routes all engine events through Core_AGameMode hooks and emits them for observers, mirroring the engine API 1:1.
type GameModeEventFn = (...args: any[]) => void

export abstract class Core_AGameMode<
    TCustomEvents extends {
        [K in keyof TCustomEvents]: GameModeEventFn | undefined
    } = {}
> {
    protected playerManager!: CorePlayer_APlayerManager

    constructor() {}

    protected abstract createPlayerManager(): CorePlayer_APlayerManager

    /** Helper: map engine player to logical player, or undefined if invalid. */
    protected lp(eventPlayer: mod.Player): CorePlayer_APlayer | undefined {
        return this.playerManager.get(eventPlayer)
    }

    protected lpId(eventNumber: number): CorePlayer_APlayer | undefined {
        return this.playerManager.getById(eventNumber)
    }

    /* ------------------------------------------------------------
     * Protected hooks (to be overridden in game modes)
     * ------------------------------------------------------------ */

    // Ongoing
    protected OngoingGlobal(): void {}
    protected OngoingAreaTrigger(eventAreaTrigger: mod.AreaTrigger): void {}
    protected OngoingCapturePoint(eventCapturePoint: mod.CapturePoint): void {}
    protected OngoingEmplacementSpawner(
        eventEmplacementSpawner: mod.EmplacementSpawner
    ): void {}
    protected OngoingHQ(eventHQ: mod.HQ): void {}
    protected OngoingInteractPoint(
        eventInteractPoint: mod.InteractPoint
    ): void {}
    protected OngoingLootSpawner(eventLootSpawner: mod.LootSpawner): void {}
    protected OngoingMCOM(eventMCOM: mod.MCOM): void {}
    protected OngoingPlayer(eventPlayer: mod.Player): void {}
    protected OngoingRingOfFire(eventRingOfFire: mod.RingOfFire): void {}
    protected OngoingSector(eventSector: mod.Sector): void {}
    protected OngoingSpawner(eventSpawner: mod.Spawner): void {}
    protected OngoingSpawnPoint(eventSpawnPoint: mod.SpawnPoint): void {}
    protected OngoingTeam(eventTeam: mod.Team): void {}
    protected OngoingVehicle(eventVehicle: mod.Vehicle): void {}
    protected OngoingVehicleSpawner(
        eventVehicleSpawner: mod.VehicleSpawner
    ): void {}
    protected OngoingWaypointPath(eventWaypointPath: mod.WaypointPath): void {}
    protected OngoingWorldIcon(eventWorldIcon: mod.WorldIcon): void {}

    // AI movement and waypoint events
    protected OnAIMoveToFailed(eventPlayer: mod.Player): void {}
    protected OnAIMoveToRunning(eventPlayer: mod.Player): void {}
    protected OnAIMoveToSucceeded(eventPlayer: mod.Player): void {}

    protected OnAIParachuteRunning(eventPlayer: mod.Player): void {}
    protected OnAIParachuteSucceeded(eventPlayer: mod.Player): void {}

    protected OnAIWaypointIdleFailed(eventPlayer: mod.Player): void {}
    protected OnAIWaypointIdleRunning(eventPlayer: mod.Player): void {}
    protected OnAIWaypointIdleSucceeded(eventPlayer: mod.Player): void {}

    // CapturePoint events
    protected OnCapturePointCaptured(
        eventCapturePoint: mod.CapturePoint
    ): void {}
    protected OnCapturePointCapturing(
        eventCapturePoint: mod.CapturePoint
    ): void {}
    protected OnCapturePointLost(eventCapturePoint: mod.CapturePoint): void {}

    // Game mode lifecycle
    protected OnGameModeEnding(): void {}
    protected OnGameModeStarted(): void {}

    // Player state events (undefined-only for "other" player)
    protected OnMandown(
        eventPlayer: mod.Player,
        eventOtherPlayer: mod.Player
    ): void {}

    protected OnPlayerDamaged(
        eventPlayer: mod.Player,
        eventOtherPlayer: mod.Player,
        eventDamageType: mod.DamageType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void {}

    protected OnPlayerDeployed(eventPlayer: mod.Player): void {}

    protected OnPlayerDied(
        eventPlayer: mod.Player,
        eventOtherPlayer: mod.Player,
        eventDeathType: mod.DeathType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void {}

    protected OnPlayerEarnedKill(
        eventPlayer: mod.Player,
        eventOtherPlayer: mod.Player,
        eventDeathType: mod.DeathType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void {}

    protected OnPlayerEarnedKillAssist(
        eventPlayer: mod.Player,
        eventOtherPlayer: mod.Player
    ): void {}

    protected OnRevived(
        eventPlayer: mod.Player,
        eventOtherPlayer: mod.Player
    ): void {}

    // Interaction and triggers
    protected OnPlayerInteract(
        eventPlayer: mod.Player,
        eventInteractPoint: mod.InteractPoint
    ): void {}

    protected OnPlayerEnterAreaTrigger(
        eventPlayer: mod.Player,
        eventAreaTrigger: mod.AreaTrigger
    ): void {}

    protected OnPlayerExitAreaTrigger(
        eventPlayer: mod.Player,
        eventAreaTrigger: mod.AreaTrigger
    ): void {}

    protected OnPlayerEnterCapturePoint(
        eventPlayer: mod.Player,
        eventCapturePoint: mod.CapturePoint
    ): void {}

    protected OnPlayerExitCapturePoint(
        eventPlayer: mod.Player,
        eventCapturePoint: mod.CapturePoint
    ): void {}

    // Vehicles
    protected OnPlayerEnterVehicle(
        eventPlayer: mod.Player,
        eventVehicle: mod.Vehicle
    ): void {}

    protected OnPlayerExitVehicle(
        eventPlayer: mod.Player,
        eventVehicle: mod.Vehicle
    ): void {}

    protected OnPlayerEnterVehicleSeat(
        eventPlayer: mod.Player,
        eventVehicle: mod.Vehicle,
        eventSeat: mod.Object
    ): void {}

    protected OnPlayerExitVehicleSeat(
        eventPlayer: mod.Player,
        eventVehicle: mod.Vehicle,
        eventSeat: mod.Object
    ): void {}

    // Team / UI
    protected OnPlayerSwitchTeam(
        eventPlayer: mod.Player,
        eventTeam: mod.Team
    ): void {}

    protected OnPlayerUIButtonEvent(
        eventPlayer: mod.Player,
        eventUIWidget: mod.UIWidget,
        eventUIButtonEvent: mod.UIButtonEvent
    ): void {}

    // Spawner / raycast / misc
    protected OnSpawnerSpawned(
        eventPlayer: mod.Player,
        eventSpawner: mod.Spawner
    ): void {}

    protected OnRayCastHit(
        eventPlayer: mod.Player,
        eventPoint: mod.Vector,
        eventNormal: mod.Vector
    ): void {}

    protected OnRayCastMissed(eventPlayer: mod.Player): void {}

    // Player join/leave/undeploy
    protected OnPlayerJoinGame(eventPlayer: mod.Player): void {}
    protected OnPlayerLeaveGame(eventNumber: number): void {}
    protected OnPlayerUndeploy(eventPlayer: mod.Player): void {}

    // Ring of Fire / time limit / vehicles / MCOM
    protected OnRingOfFireZoneSizeChange(
        eventRingOfFire: mod.RingOfFire,
        eventNumber: number
    ): void {}

    protected OnTimeLimitReached(): void {}

    protected OnVehicleDestroyed(eventVehicle: mod.Vehicle): void {}
    protected OnVehicleSpawned(eventVehicle: mod.Vehicle): void {}

    protected OnMCOMArmed(eventMCOM: mod.MCOM): void {}
    protected OnMCOMDefused(eventMCOM: mod.MCOM): void {}
    protected OnMCOMDestroyed(eventMCOM: mod.MCOM): void {}

    /*
     *
     */

    protected OnLogicalPlayerJoinGame(lp: CorePlayer_APlayer): void {}

    /* ------------------------------------------------------------
     * Internal router: main.ts -> _internal -> PlayerManager + hooks + emit
     * ------------------------------------------------------------ */

    public readonly _internal = {
        // Ongoing
        OngoingGlobal: (): void => {
            this.OngoingGlobal()
            this.emitEngine('OngoingGlobal')
        },

        OngoingAreaTrigger: (eventAreaTrigger: mod.AreaTrigger): void => {
            this.OngoingAreaTrigger(eventAreaTrigger)
            this.emitEngine('OngoingAreaTrigger', eventAreaTrigger)
        },

        OngoingCapturePoint: (eventCapturePoint: mod.CapturePoint): void => {
            this.OngoingCapturePoint(eventCapturePoint)
            this.emitEngine('OngoingCapturePoint', eventCapturePoint)
        },

        OngoingEmplacementSpawner: (
            eventEmplacementSpawner: mod.EmplacementSpawner
        ): void => {
            this.OngoingEmplacementSpawner(eventEmplacementSpawner)
            this.emitEngine(
                'OngoingEmplacementSpawner',
                eventEmplacementSpawner
            )
        },

        OngoingHQ: (eventHQ: mod.HQ): void => {
            this.OngoingHQ(eventHQ)
            this.emitEngine('OngoingHQ', eventHQ)
        },

        OngoingInteractPoint: (eventInteractPoint: mod.InteractPoint): void => {
            this.OngoingInteractPoint(eventInteractPoint)
            this.emitEngine('OngoingInteractPoint', eventInteractPoint)
        },

        OngoingLootSpawner: (eventLootSpawner: mod.LootSpawner): void => {
            this.OngoingLootSpawner(eventLootSpawner)
            this.emitEngine('OngoingLootSpawner', eventLootSpawner)
        },

        OngoingMCOM: (eventMCOM: mod.MCOM): void => {
            this.OngoingMCOM(eventMCOM)
            this.emitEngine('OngoingMCOM', eventMCOM)
        },

        OngoingPlayer: (eventPlayer: mod.Player): void => {
            if (!this.playerManager) return
            const lp = this.lp(eventPlayer)
            if (lp) {
                this.playerManager.tick(eventPlayer)
            }
            this.OngoingPlayer(eventPlayer)
            this.emitEngine('OngoingPlayer', eventPlayer)
        },

        OngoingRingOfFire: (eventRingOfFire: mod.RingOfFire): void => {
            this.OngoingRingOfFire(eventRingOfFire)
            this.emitEngine('OngoingRingOfFire', eventRingOfFire)
        },

        OngoingSector: (eventSector: mod.Sector): void => {
            this.OngoingSector(eventSector)
            this.emitEngine('OngoingSector', eventSector)
        },

        OngoingSpawner: (eventSpawner: mod.Spawner): void => {
            this.OngoingSpawner(eventSpawner)
            this.emitEngine('OngoingSpawner', eventSpawner)
        },

        OngoingSpawnPoint: (eventSpawnPoint: mod.SpawnPoint): void => {
            this.OngoingSpawnPoint(eventSpawnPoint)
            this.emitEngine('OngoingSpawnPoint', eventSpawnPoint)
        },

        OngoingTeam: (eventTeam: mod.Team): void => {
            this.OngoingTeam(eventTeam)
            this.emitEngine('OngoingTeam', eventTeam)
        },

        OngoingVehicle: (eventVehicle: mod.Vehicle): void => {
            this.OngoingVehicle(eventVehicle)
            this.emitEngine('OngoingVehicle', eventVehicle)
        },

        OngoingVehicleSpawner: (
            eventVehicleSpawner: mod.VehicleSpawner
        ): void => {
            this.OngoingVehicleSpawner(eventVehicleSpawner)
            this.emitEngine('OngoingVehicleSpawner', eventVehicleSpawner)
        },

        OngoingWaypointPath: (eventWaypointPath: mod.WaypointPath): void => {
            this.OngoingWaypointPath(eventWaypointPath)
            this.emitEngine('OngoingWaypointPath', eventWaypointPath)
        },

        OngoingWorldIcon: (eventWorldIcon: mod.WorldIcon): void => {
            this.OngoingWorldIcon(eventWorldIcon)
            this.emitEngine('OngoingWorldIcon', eventWorldIcon)
        },

        // AI movement and waypoint events
        OnAIMoveToFailed: (eventPlayer: mod.Player): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnAIMoveToFailed(lp)
            this.OnAIMoveToFailed(eventPlayer)
            this.emitEngine('OnAIMoveToFailed', eventPlayer)
        },

        OnAIMoveToRunning: (eventPlayer: mod.Player): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnAIMoveToRunning(lp)
            this.OnAIMoveToRunning(eventPlayer)
            this.emitEngine('OnAIMoveToRunning', eventPlayer)
        },

        OnAIMoveToSucceeded: (eventPlayer: mod.Player): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnAIMoveToSucceeded(lp)
            this.OnAIMoveToSucceeded(eventPlayer)
            this.emitEngine('OnAIMoveToSucceeded', eventPlayer)
        },

        OnAIParachuteRunning: (eventPlayer: mod.Player): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnAIParachuteRunning(lp)
            this.OnAIParachuteRunning(eventPlayer)
            this.emitEngine('OnAIParachuteRunning', eventPlayer)
        },

        OnAIParachuteSucceeded: (eventPlayer: mod.Player): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnAIParachuteSucceeded(lp)
            this.OnAIParachuteSucceeded(eventPlayer)
            this.emitEngine('OnAIParachuteSucceeded', eventPlayer)
        },

        OnAIWaypointIdleFailed: (eventPlayer: mod.Player): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnAIWaypointIdleFailed(lp)
            this.OnAIWaypointIdleFailed(eventPlayer)
            this.emitEngine('OnAIWaypointIdleFailed', eventPlayer)
        },

        OnAIWaypointIdleRunning: (eventPlayer: mod.Player): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnAIWaypointIdleRunning(lp)
            this.OnAIWaypointIdleRunning(eventPlayer)
            this.emitEngine('OnAIWaypointIdleRunning', eventPlayer)
        },

        OnAIWaypointIdleSucceeded: (eventPlayer: mod.Player): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnAIWaypointIdleSucceeded(lp)
            this.OnAIWaypointIdleSucceeded(eventPlayer)
            this.emitEngine('OnAIWaypointIdleSucceeded', eventPlayer)
        },

        // CapturePoint events
        OnCapturePointCaptured: (eventCapturePoint: mod.CapturePoint): void => {
            this.OnCapturePointCaptured(eventCapturePoint)
            this.emitEngine('OnCapturePointCaptured', eventCapturePoint)
        },

        OnCapturePointCapturing: (
            eventCapturePoint: mod.CapturePoint
        ): void => {
            this.OnCapturePointCapturing(eventCapturePoint)
            this.emitEngine('OnCapturePointCapturing', eventCapturePoint)
        },

        OnCapturePointLost: (eventCapturePoint: mod.CapturePoint): void => {
            this.OnCapturePointLost(eventCapturePoint)
            this.emitEngine('OnCapturePointLost', eventCapturePoint)
        },

        // Game mode lifecycle
        OnGameModeEnding: (): void => {
            this.OnGameModeEnding()
            this.emitEngine('OnGameModeEnding')
        },

        OnGameModeStarted: (): void => {
            this.OnGameModeStarted()
            this.emitEngine('OnGameModeStarted')
        },

        // Player state events
        OnMandown: (
            eventPlayer: mod.Player,
            eventOtherPlayer: mod.Player
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp) {
                const other = this.lp(eventOtherPlayer)
                this.playerManager.OnMandown(lp, other)
            }
            this.OnMandown(eventPlayer, eventOtherPlayer)
            this.emitEngine('OnMandown', eventPlayer, eventOtherPlayer)
        },

        OnPlayerDamaged: (
            eventPlayer: mod.Player,
            eventOtherPlayer: mod.Player,
            eventDamageType: mod.DamageType,
            eventWeaponUnlock: mod.WeaponUnlock
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp) {
                const other = this.lp(eventOtherPlayer)
                this.playerManager.OnPlayerDamaged(
                    lp,
                    other,
                    eventDamageType,
                    eventWeaponUnlock
                )
            }
            this.OnPlayerDamaged(
                eventPlayer,
                eventOtherPlayer,
                eventDamageType,
                eventWeaponUnlock
            )
            this.emitEngine(
                'OnPlayerDamaged',
                eventPlayer,
                eventOtherPlayer,
                eventDamageType,
                eventWeaponUnlock
            )
        },

        OnPlayerDeployed: (eventPlayer: mod.Player): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnPlayerDeployed(lp)
            this.OnPlayerDeployed(eventPlayer)
            this.emitEngine('OnPlayerDeployed', eventPlayer)
        },

        OnPlayerDied: (
            eventPlayer: mod.Player,
            eventOtherPlayer: mod.Player,
            eventDeathType: mod.DeathType,
            eventWeaponUnlock: mod.WeaponUnlock
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp) {
                const other = this.lp(eventOtherPlayer)
                this.playerManager.OnPlayerDied(
                    lp,
                    other,
                    eventDeathType,
                    eventWeaponUnlock
                )
            }
            this.OnPlayerDied(
                eventPlayer,
                eventOtherPlayer,
                eventDeathType,
                eventWeaponUnlock
            )
            this.emitEngine(
                'OnPlayerDied',
                eventPlayer,
                eventOtherPlayer,
                eventDeathType,
                eventWeaponUnlock
            )
        },

        OnPlayerEarnedKill: (
            eventPlayer: mod.Player,
            eventOtherPlayer: mod.Player,
            eventDeathType: mod.DeathType,
            eventWeaponUnlock: mod.WeaponUnlock
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp) {
                const other = this.lp(eventOtherPlayer)
                this.playerManager.OnPlayerEarnedKill(
                    lp,
                    other,
                    eventDeathType,
                    eventWeaponUnlock
                )
            }
            this.OnPlayerEarnedKill(
                eventPlayer,
                eventOtherPlayer,
                eventDeathType,
                eventWeaponUnlock
            )
            this.emitEngine(
                'OnPlayerEarnedKill',
                eventPlayer,
                eventOtherPlayer,
                eventDeathType,
                eventWeaponUnlock
            )
        },

        OnPlayerEarnedKillAssist: (
            eventPlayer: mod.Player,
            eventOtherPlayer: mod.Player
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp) {
                const other = this.lp(eventOtherPlayer)
                this.playerManager.OnPlayerEarnedKillAssist(lp, other)
            }
            this.OnPlayerEarnedKillAssist(eventPlayer, eventOtherPlayer)
            this.emitEngine(
                'OnPlayerEarnedKillAssist',
                eventPlayer,
                eventOtherPlayer
            )
        },

        OnRevived: (
            eventPlayer: mod.Player,
            eventOtherPlayer: mod.Player
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp) {
                const other = this.lp(eventOtherPlayer)
                this.playerManager.OnRevived(lp, other)
            }
            this.OnRevived(eventPlayer, eventOtherPlayer)
            this.emitEngine('OnRevived', eventPlayer, eventOtherPlayer)
        },

        // MCOM events
        OnMCOMArmed: (eventMCOM: mod.MCOM): void => {
            this.OnMCOMArmed(eventMCOM)
            this.emitEngine('OnMCOMArmed', eventMCOM)
        },

        OnMCOMDefused: (eventMCOM: mod.MCOM): void => {
            this.OnMCOMDefused(eventMCOM)
            this.emitEngine('OnMCOMDefused', eventMCOM)
        },

        OnMCOMDestroyed: (eventMCOM: mod.MCOM): void => {
            this.OnMCOMDestroyed(eventMCOM)
            this.emitEngine('OnMCOMDestroyed', eventMCOM)
        },

        // Interaction and triggers
        OnPlayerInteract: (
            eventPlayer: mod.Player,
            eventInteractPoint: mod.InteractPoint
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnPlayerInteract(lp, eventInteractPoint)
            this.OnPlayerInteract(eventPlayer, eventInteractPoint)
            this.emitEngine('OnPlayerInteract', eventPlayer, eventInteractPoint)
        },

        OnPlayerEnterAreaTrigger: (
            eventPlayer: mod.Player,
            eventAreaTrigger: mod.AreaTrigger
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp)
                this.playerManager.OnPlayerEnterAreaTrigger(
                    lp,
                    eventAreaTrigger
                )
            this.OnPlayerEnterAreaTrigger(eventPlayer, eventAreaTrigger)
            this.emitEngine(
                'OnPlayerEnterAreaTrigger',
                eventPlayer,
                eventAreaTrigger
            )
        },

        OnPlayerExitAreaTrigger: (
            eventPlayer: mod.Player,
            eventAreaTrigger: mod.AreaTrigger
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp)
                this.playerManager.OnPlayerExitAreaTrigger(lp, eventAreaTrigger)
            this.OnPlayerExitAreaTrigger(eventPlayer, eventAreaTrigger)
            this.emitEngine(
                'OnPlayerExitAreaTrigger',
                eventPlayer,
                eventAreaTrigger
            )
        },

        OnPlayerEnterCapturePoint: (
            eventPlayer: mod.Player,
            eventCapturePoint: mod.CapturePoint
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp)
                this.playerManager.OnPlayerEnterCapturePoint(
                    lp,
                    eventCapturePoint
                )
            this.OnPlayerEnterCapturePoint(eventPlayer, eventCapturePoint)
            this.emitEngine(
                'OnPlayerEnterCapturePoint',
                eventPlayer,
                eventCapturePoint
            )
        },

        OnPlayerExitCapturePoint: (
            eventPlayer: mod.Player,
            eventCapturePoint: mod.CapturePoint
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp)
                this.playerManager.OnPlayerExitCapturePoint(
                    lp,
                    eventCapturePoint
                )
            this.OnPlayerExitCapturePoint(eventPlayer, eventCapturePoint)
            this.emitEngine(
                'OnPlayerExitCapturePoint',
                eventPlayer,
                eventCapturePoint
            )
        },

        // Vehicle events
        OnPlayerEnterVehicle: (
            eventPlayer: mod.Player,
            eventVehicle: mod.Vehicle
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnPlayerEnterVehicle(lp, eventVehicle)
            this.OnPlayerEnterVehicle(eventPlayer, eventVehicle)
            this.emitEngine('OnPlayerEnterVehicle', eventPlayer, eventVehicle)
        },

        OnPlayerExitVehicle: (
            eventPlayer: mod.Player,
            eventVehicle: mod.Vehicle
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnPlayerExitVehicle(lp, eventVehicle)
            this.OnPlayerExitVehicle(eventPlayer, eventVehicle)
            this.emitEngine('OnPlayerExitVehicle', eventPlayer, eventVehicle)
        },

        OnPlayerEnterVehicleSeat: (
            eventPlayer: mod.Player,
            eventVehicle: mod.Vehicle,
            eventSeat: mod.Object
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp)
                this.playerManager.OnPlayerEnterVehicleSeat(
                    lp,
                    eventVehicle,
                    eventSeat
                )
            this.OnPlayerEnterVehicleSeat(eventPlayer, eventVehicle, eventSeat)
            this.emitEngine(
                'OnPlayerEnterVehicleSeat',
                eventPlayer,
                eventVehicle,
                eventSeat
            )
        },

        OnPlayerExitVehicleSeat: (
            eventPlayer: mod.Player,
            eventVehicle: mod.Vehicle,
            eventSeat: mod.Object
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp)
                this.playerManager.OnPlayerExitVehicleSeat(
                    lp,
                    eventVehicle,
                    eventSeat
                )
            this.OnPlayerExitVehicleSeat(eventPlayer, eventVehicle, eventSeat)
            this.emitEngine(
                'OnPlayerExitVehicleSeat',
                eventPlayer,
                eventVehicle,
                eventSeat
            )
        },

        OnPlayerJoinGame: (eventPlayer: mod.Player): void => {
            if (!this.playerManager) {
                this.playerManager = this.createPlayerManager()

                this.playerManager.notifyGameModeOnLogicalPlayerJoin = (lp) => {
                    this._internal.OnLogicalPlayerJoinGame(lp)
                }
            }

            // Semantic layer
            this.playerManager.OnPlayerJoinGame(eventPlayer)

            // Gameplay hook
            this.OnPlayerJoinGame(eventPlayer)

            // Observers (VO, UI, debug, etc.)
            this.emitEngine('OnPlayerJoinGame', eventPlayer)
        },

        // ------------------------------------------------------------
        // Player leaves match
        // ------------------------------------------------------------
        OnPlayerLeaveGame: (eventNumber: number): void => {
            // Engine truth only.
            // Core does not attempt to resolve or validate logical players here.
            // GameMode is fully responsible for interpreting this event.
            this.OnPlayerLeaveGame(eventNumber)
            this.emitEngine('OnPlayerLeaveGame', eventNumber)
        },

        // Team / UI
        OnPlayerSwitchTeam: (
            eventPlayer: mod.Player,
            eventTeam: mod.Team
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnPlayerSwitchTeam(lp, eventTeam)
            this.OnPlayerSwitchTeam(eventPlayer, eventTeam)
            this.emitEngine('OnPlayerSwitchTeam', eventPlayer, eventTeam)
        },

        OnPlayerUIButtonEvent: (
            eventPlayer: mod.Player,
            eventUIWidget: mod.UIWidget,
            eventUIButtonEvent: mod.UIButtonEvent
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp)
                this.playerManager.OnPlayerUIButtonEvent(
                    lp,
                    eventUIWidget,
                    eventUIButtonEvent
                )
            this.OnPlayerUIButtonEvent(
                eventPlayer,
                eventUIWidget,
                eventUIButtonEvent
            )
            this.emitEngine(
                'OnPlayerUIButtonEvent',
                eventPlayer,
                eventUIWidget,
                eventUIButtonEvent
            )
        },

        // Undeploy
        OnPlayerUndeploy: (eventPlayer: mod.Player): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnPlayerUndeploy(lp)
            this.OnPlayerUndeploy(eventPlayer)
            this.emitEngine('OnPlayerUndeploy', eventPlayer)
        },

        // Raycast
        OnRayCastHit: (
            eventPlayer: mod.Player,
            eventPoint: mod.Vector,
            eventNormal: mod.Vector
        ): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnRayCastHit(lp, eventPoint, eventNormal)
            this.OnRayCastHit(eventPlayer, eventPoint, eventNormal)
            this.emitEngine(
                'OnRayCastHit',
                eventPlayer,
                eventPoint,
                eventNormal
            )
        },

        OnRayCastMissed: (eventPlayer: mod.Player): void => {
            const lp = this.lp(eventPlayer)
            if (lp) this.playerManager.OnRayCastMissed(lp)
            this.OnRayCastMissed(eventPlayer)
            this.emitEngine('OnRayCastMissed', eventPlayer)
        },

        // Spawner
        OnSpawnerSpawned: (
            eventPlayer: mod.Player,
            eventSpawner: mod.Spawner
        ): void => {
            // PlayerManager owns the spawner-respawn flow and will call back into
            // _notifyOnAIJoinGame / _notifyOnSpawnerSpawned to avoid double-calls.
            this.playerManager.OnSpawnerSpawned(eventPlayer, eventSpawner)
        },

        // Ring of fire / time limit / vehicles
        OnRingOfFireZoneSizeChange: (
            eventRingOfFire: mod.RingOfFire,
            eventNumber: number
        ): void => {
            this.OnRingOfFireZoneSizeChange(eventRingOfFire, eventNumber)
            this.emitEngine(
                'OnRingOfFireZoneSizeChange',
                eventRingOfFire,
                eventNumber
            )
        },

        OnTimeLimitReached: (): void => {
            this.OnTimeLimitReached()
            this.emitEngine('OnTimeLimitReached')
        },

        OnVehicleDestroyed: (eventVehicle: mod.Vehicle): void => {
            this.OnVehicleDestroyed(eventVehicle)
            this.emitEngine('OnVehicleDestroyed', eventVehicle)
        },

        OnVehicleSpawned: (eventVehicle: mod.Vehicle): void => {
            this.OnVehicleSpawned(eventVehicle)
            this.emitEngine('OnVehicleSpawned', eventVehicle)
        },

        /*
         *
         */

        OnLogicalPlayerJoinGame: (lp: CorePlayer_APlayer): void => {
            this.OnLogicalPlayerJoinGame(lp)
            this.emitEngine('OnLogicalPlayerJoinGame', lp)
        },
    }

    /* ------------------------------------------------------------
     * Simple event bus for observers (AI, debug, UI)
     *
     * - Engine events are always available
     * - Custom events are gamemode-specific
     * ------------------------------------------------------------ */

    protected listeners: Array<
        CorePlayer_IGameModeEngineEvents & TCustomEvents
    > = []

    public addListener(
        listener: CorePlayer_IGameModeEngineEvents & TCustomEvents
    ): void {
        this.listeners.push(listener)
    }

    public removeListener(
        listener: CorePlayer_IGameModeEngineEvents & TCustomEvents
    ): void {
        this.listeners = this.listeners.filter((l) => l !== listener)
    }

    protected emitEngine<E extends keyof CorePlayer_IGameModeEngineEvents>(
        event: E,
        ...args: Parameters<NonNullable<CorePlayer_IGameModeEngineEvents[E]>>
    ): void {
        for (const listener of this.listeners) {
            listener[event]?.(...args)
        }
    }

    protected emitCustom<E extends keyof TCustomEvents>(
        event: E,
        ...args: Parameters<NonNullable<TCustomEvents[E]>>
    ): void {
        for (const listener of this.listeners) {
            listener[event]?.(...args)
        }
    }
}

// -------- FILE: src\main.ts --------
/**
 * Core_AGameMode
 *
 * High-level explanation:
 * -----------------------
 * This class is the central event router and base implementation of all
 * game modes. The Battlefield 6 modding API exposes a large set of raw
 * engine events (such as OnPlayerDied, OnPlayerDamaged, OngoingGlobal, etc).
 * Game modes need a safe and structured way to handle these events without
 * directly dealing with low-level engine Player objects.
 *
 * This class provides that structure.
 *
 * Architecture:
 * -------------
 * 1. _internal (router object)
 *    - Public object containing functions that match the exact signature
 *      of the mod EventHandlerSignatures namespace.
 *    - main.ts must call these functions.
 *    - They are public on purpose, but live inside a child object so they do
 *      NOT appear as override options in derived game mode classes.
 *    - Each router function:
 *        a) Receives raw engine parameters.
 *        b) Converts mod.Player into CorePlayer_APlayer using PlayerManager.
 *        c) Notifies PlayerManager of state changes.
 *        d) Forwards the event to the corresponding protected hook method.
 *
 * 2. Protected hook methods
 *    - These methods represent the actual game mode logic.
 *    - They use CorePlayer_APlayer instead of raw mod.Player.
 *    - Game mode classes (such as TDM_GameMode) override these to implement
 *      their own behavior.
 *    - Example:
 *         protected OnPlayerDied(lp: CorePlayer_APlayer, ...)
 *    - These are clean API methods that mod developers should override.
 *
 * 3. PlayerManager integration
 *    - The PlayerManager tracks logical player state across deploy, death,
 *      team switching, mandown, etc.
 *    - The router updates the PlayerManager before calling the hook so
 *      derived game modes always receive correct state.
 *    - The PlayerManager is created lazily on first OnPlayerJoinGame.
 *
 * 4. Event flow summary
 *    Engine -> main.ts -> _internal.OnX -> PlayerManager -> protected OnX
 *
 * Why this design:
 * ----------------
 * - Prevents accidental overriding of internal routing functions.
 * - Keeps the public API for game mode developers small and predictable.
 * - Ensures all events follow the exact lifecycle rules consistently.
 * - Avoids exposing low-level engine Player objects in game mode code.
 * - Prevents autocomplete pollution with dozens of internal methods.
 *
 * What game mode authors should do:
 * ---------------------------------
 * - Override protected hook methods only (OnPlayerDied, OnPlayerJoinGame, etc).
 * - Never call functions inside _internal directly.
 * - Never override or modify _internal, PlayerManager, or routing logic.
 * - Use CorePlayer_APlayer values passed into hooks, never store mod.Player.
 *
 * Summary:
 * --------
 * Core_AGameMode acts as a stable event bridge between the BF6 engine event
 * system and high-level game mode logic. Its purpose is to enforce a clean
 * separation between routing and gameplay code, unify PlayerManager access,
 * and ensure that custom game modes behave consistently with the engine rules.
 */
// import { PRSR_GameMode } from './GameModes/Pressure/PRSR_GameMode'
// import { TPL_GameMode } from './GameModes/Template/TPL_GameMode'
// import { TDM_GameMode } from './GameModes/TDM/TDM_GameMode'

const gameMode: Core_AGameMode = new PG_GameMode()

// This will trigger every engine tick while the gamemode is running.
export function OngoingGlobal(): void {
    gameMode._internal.OngoingGlobal()
}

// This will trigger every tick for each AreaTrigger.
export function OngoingAreaTrigger(eventAreaTrigger: mod.AreaTrigger): void {
    gameMode._internal.OngoingAreaTrigger(eventAreaTrigger)
}

// This will trigger every tick for each CapturePoint.
export function OngoingCapturePoint(eventCapturePoint: mod.CapturePoint): void {
    gameMode._internal.OngoingCapturePoint(eventCapturePoint)
}

// This will trigger every tick for each EmplacementSpawner.
export function OngoingEmplacementSpawner(
    eventEmplacementSpawner: mod.EmplacementSpawner
): void {
    gameMode._internal.OngoingEmplacementSpawner(eventEmplacementSpawner)
}

// This will trigger every tick for the HQ object.
export function OngoingHQ(eventHQ: mod.HQ): void {
    gameMode._internal.OngoingHQ(eventHQ)
}

// This will trigger every tick for each InteractPoint.
export function OngoingInteractPoint(
    eventInteractPoint: mod.InteractPoint
): void {
    gameMode._internal.OngoingInteractPoint(eventInteractPoint)
}

// This will trigger every tick for each LootSpawner.
export function OngoingLootSpawner(eventLootSpawner: mod.LootSpawner): void {
    gameMode._internal.OngoingLootSpawner(eventLootSpawner)
}

// This will trigger every tick for each MCOM.
export function OngoingMCOM(eventMCOM: mod.MCOM): void {
    gameMode._internal.OngoingMCOM(eventMCOM)
}

// This will trigger every tick for each Player.
export function OngoingPlayer(eventPlayer: mod.Player): void {
    gameMode._internal.OngoingPlayer(eventPlayer)
}

// This will trigger every tick for each RingOfFire.
export function OngoingRingOfFire(eventRingOfFire: mod.RingOfFire): void {
    gameMode._internal.OngoingRingOfFire(eventRingOfFire)
}

// This will trigger every tick for each Sector.
export function OngoingSector(eventSector: mod.Sector): void {
    gameMode._internal.OngoingSector(eventSector)
}

// This will trigger every tick for each Spawner.
export function OngoingSpawner(eventSpawner: mod.Spawner): void {
    gameMode._internal.OngoingSpawner(eventSpawner)
}

// This will trigger every tick for each SpawnPoint.
export function OngoingSpawnPoint(eventSpawnPoint: mod.SpawnPoint): void {
    gameMode._internal.OngoingSpawnPoint(eventSpawnPoint)
}

// This will trigger every tick for each Team.
export function OngoingTeam(eventTeam: mod.Team): void {
    gameMode._internal.OngoingTeam(eventTeam)
}

// This will trigger every tick for each Vehicle.
export function OngoingVehicle(eventVehicle: mod.Vehicle): void {
    gameMode._internal.OngoingVehicle(eventVehicle)
}

// This will trigger every tick for each VehicleSpawner.
export function OngoingVehicleSpawner(
    eventVehicleSpawner: mod.VehicleSpawner
): void {
    gameMode._internal.OngoingVehicleSpawner(eventVehicleSpawner)
}

// This will trigger every tick for each WaypointPath.
export function OngoingWaypointPath(eventWaypointPath: mod.WaypointPath): void {
    gameMode._internal.OngoingWaypointPath(eventWaypointPath)
}

// This will trigger every tick for each WorldIcon.
export function OngoingWorldIcon(eventWorldIcon: mod.WorldIcon): void {
    gameMode._internal.OngoingWorldIcon(eventWorldIcon)
}

// This will trigger when an AI Soldier stops moving to a destination.
export function OnAIMoveToFailed(eventPlayer: mod.Player): void {
    gameMode._internal.OnAIMoveToFailed(eventPlayer)
}

// This will trigger when an AI Soldier starts moving to a destination.
export function OnAIMoveToRunning(eventPlayer: mod.Player): void {
    gameMode._internal.OnAIMoveToRunning(eventPlayer)
}

// This will trigger when an AI Soldier reaches its destination.
export function OnAIMoveToSucceeded(eventPlayer: mod.Player): void {
    gameMode._internal.OnAIMoveToSucceeded(eventPlayer)
}

// This will trigger when an AI Soldier parachute action is running.
export function OnAIParachuteRunning(eventPlayer: mod.Player): void {
    gameMode._internal.OnAIParachuteRunning(eventPlayer)
}

// This will trigger when an AI Soldier parachute action succeeds.
export function OnAIParachuteSucceeded(eventPlayer: mod.Player): void {
    gameMode._internal.OnAIParachuteSucceeded(eventPlayer)
}

// This will trigger when an AI Soldier stops following a waypoint.
export function OnAIWaypointIdleFailed(eventPlayer: mod.Player): void {
    gameMode._internal.OnAIWaypointIdleFailed(eventPlayer)
}

// This will trigger when an AI Soldier starts following a waypoint.
export function OnAIWaypointIdleRunning(eventPlayer: mod.Player): void {
    gameMode._internal.OnAIWaypointIdleRunning(eventPlayer)
}

// This will trigger when an AI Soldier finishes following a waypoint.
export function OnAIWaypointIdleSucceeded(eventPlayer: mod.Player): void {
    gameMode._internal.OnAIWaypointIdleSucceeded(eventPlayer)
}

// This will trigger when a team captures a CapturePoint.
export function OnCapturePointCaptured(
    eventCapturePoint: mod.CapturePoint
): void {
    gameMode._internal.OnCapturePointCaptured(eventCapturePoint)
}

// This will trigger when a team starts capturing a CapturePoint.
export function OnCapturePointCapturing(
    eventCapturePoint: mod.CapturePoint
): void {
    gameMode._internal.OnCapturePointCapturing(eventCapturePoint)
}

// This will trigger when a team loses control of a CapturePoint.
export function OnCapturePointLost(eventCapturePoint: mod.CapturePoint): void {
    gameMode._internal.OnCapturePointLost(eventCapturePoint)
}

// This will trigger when the gamemode ends.
export function OnGameModeEnding(): void {
    gameMode._internal.OnGameModeEnding()
}

// This will trigger at the start of the gamemode.
export function OnGameModeStarted(): void {
    gameMode._internal.OnGameModeStarted()
}

// This will trigger when a Player enters mandown state.
export function OnMandown(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player
): void {
    gameMode._internal.OnMandown(eventPlayer, eventOtherPlayer)
}

// This will trigger when a MCOM is armed.
export function OnMCOMArmed(eventMCOM: mod.MCOM): void {
    gameMode._internal.OnMCOMArmed(eventMCOM)
}

// This will trigger when a MCOM is defused.
export function OnMCOMDefused(eventMCOM: mod.MCOM): void {
    gameMode._internal.OnMCOMDefused(eventMCOM)
}

// This will trigger when a MCOM is detonated.
export function OnMCOMDestroyed(eventMCOM: mod.MCOM): void {
    gameMode._internal.OnMCOMDestroyed(eventMCOM)
}

// This will trigger when a Player takes damage.
export function OnPlayerDamaged(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player,
    eventDamageType: mod.DamageType,
    eventWeaponUnlock: mod.WeaponUnlock
): void {
    gameMode._internal.OnPlayerDamaged(
        eventPlayer,
        eventOtherPlayer,
        eventDamageType,
        eventWeaponUnlock
    )
}

// This will trigger whenever a Player deploys.
export function OnPlayerDeployed(eventPlayer: mod.Player): void {
    gameMode._internal.OnPlayerDeployed(eventPlayer)
}

// This will trigger whenever a Player dies.
export function OnPlayerDied(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player,
    eventDeathType: mod.DeathType,
    eventWeaponUnlock: mod.WeaponUnlock
): void {
    gameMode._internal.OnPlayerDied(
        eventPlayer,
        eventOtherPlayer,
        eventDeathType,
        eventWeaponUnlock
    )
}

// This will trigger when a Player earns a kill.
export function OnPlayerEarnedKill(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player,
    eventDeathType: mod.DeathType,
    eventWeaponUnlock: mod.WeaponUnlock
): void {
    gameMode._internal.OnPlayerEarnedKill(
        eventPlayer,
        eventOtherPlayer,
        eventDeathType,
        eventWeaponUnlock
    )
}

// This will trigger when a Player earns a kill assist.
export function OnPlayerEarnedKillAssist(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player
): void {
    gameMode._internal.OnPlayerEarnedKillAssist(eventPlayer, eventOtherPlayer)
}

// This will trigger when a Player enters an AreaTrigger.
export function OnPlayerEnterAreaTrigger(
    eventPlayer: mod.Player,
    eventAreaTrigger: mod.AreaTrigger
): void {
    gameMode._internal.OnPlayerEnterAreaTrigger(eventPlayer, eventAreaTrigger)
}

// This will trigger when a Player enters a CapturePoint.
export function OnPlayerEnterCapturePoint(
    eventPlayer: mod.Player,
    eventCapturePoint: mod.CapturePoint
): void {
    gameMode._internal.OnPlayerEnterCapturePoint(eventPlayer, eventCapturePoint)
}

// This will trigger when a Player enters a Vehicle.
export function OnPlayerEnterVehicle(
    eventPlayer: mod.Player,
    eventVehicle: mod.Vehicle
): void {
    gameMode._internal.OnPlayerEnterVehicle(eventPlayer, eventVehicle)
}

// This will trigger when a Player enters a Vehicle seat.
export function OnPlayerEnterVehicleSeat(
    eventPlayer: mod.Player,
    eventVehicle: mod.Vehicle,
    eventSeat: mod.Object
): void {
    gameMode._internal.OnPlayerEnterVehicleSeat(
        eventPlayer,
        eventVehicle,
        eventSeat
    )
}

// This will trigger when a Player exits an AreaTrigger.
export function OnPlayerExitAreaTrigger(
    eventPlayer: mod.Player,
    eventAreaTrigger: mod.AreaTrigger
): void {
    gameMode._internal.OnPlayerExitAreaTrigger(eventPlayer, eventAreaTrigger)
}

// This will trigger when a Player exits a CapturePoint.
export function OnPlayerExitCapturePoint(
    eventPlayer: mod.Player,
    eventCapturePoint: mod.CapturePoint
): void {
    gameMode._internal.OnPlayerExitCapturePoint(eventPlayer, eventCapturePoint)
}

// This will trigger when a Player exits a Vehicle.
export function OnPlayerExitVehicle(
    eventPlayer: mod.Player,
    eventVehicle: mod.Vehicle
): void {
    gameMode._internal.OnPlayerExitVehicle(eventPlayer, eventVehicle)
}

// This will trigger when a Player exits a Vehicle seat.
export function OnPlayerExitVehicleSeat(
    eventPlayer: mod.Player,
    eventVehicle: mod.Vehicle,
    eventSeat: mod.Object
): void {
    gameMode._internal.OnPlayerExitVehicleSeat(
        eventPlayer,
        eventVehicle,
        eventSeat
    )
}

// This will trigger when a Player interacts with an InteractPoint.
export function OnPlayerInteract(
    eventPlayer: mod.Player,
    eventInteractPoint: mod.InteractPoint
): void {
    gameMode._internal.OnPlayerInteract(eventPlayer, eventInteractPoint)
}

// This will trigger when a Player joins the game.
export function OnPlayerJoinGame(eventPlayer: mod.Player): void {
    gameMode._internal.OnPlayerJoinGame(eventPlayer)
}

// This will trigger when a Player leaves the game.
export function OnPlayerLeaveGame(eventNumber: number): void {
    gameMode._internal.OnPlayerLeaveGame(eventNumber)
}

// This will trigger when a Player switches team.
export function OnPlayerSwitchTeam(
    eventPlayer: mod.Player,
    eventTeam: mod.Team
): void {
    gameMode._internal.OnPlayerSwitchTeam(eventPlayer, eventTeam)
}

// This will trigger when a Player interacts with a UI button.
export function OnPlayerUIButtonEvent(
    eventPlayer: mod.Player,
    eventUIWidget: mod.UIWidget,
    eventUIButtonEvent: mod.UIButtonEvent
): void {
    gameMode._internal.OnPlayerUIButtonEvent(
        eventPlayer,
        eventUIWidget,
        eventUIButtonEvent
    )
}

// This will trigger when a Player undeploys.
export function OnPlayerUndeploy(eventPlayer: mod.Player): void {
    gameMode._internal.OnPlayerUndeploy(eventPlayer)
}

// This will trigger when a Raycast hits a target.
export function OnRayCastHit(
    eventPlayer: mod.Player,
    eventPoint: mod.Vector,
    eventNormal: mod.Vector
): void {
    gameMode._internal.OnRayCastHit(eventPlayer, eventPoint, eventNormal)
}

// This will trigger when a Raycast misses.
export function OnRayCastMissed(eventPlayer: mod.Player): void {
    gameMode._internal.OnRayCastMissed(eventPlayer)
}

// This will trigger when a Player is revived.
export function OnRevived(
    eventPlayer: mod.Player,
    eventOtherPlayer: mod.Player
): void {
    gameMode._internal.OnRevived(eventPlayer, eventOtherPlayer)
}

// This will trigger when a RingOfFire changes size.
export function OnRingOfFireZoneSizeChange(
    eventRingOfFire: mod.RingOfFire,
    eventNumber: number
): void {
    gameMode._internal.OnRingOfFireZoneSizeChange(eventRingOfFire, eventNumber)
}

// This will trigger when an AISpawner spawns an AI Soldier.
export function OnSpawnerSpawned(
    eventPlayer: mod.Player,
    eventSpawner: mod.Spawner
): void {
    gameMode._internal.OnSpawnerSpawned(eventPlayer, eventSpawner)
}

// This will trigger when the time limit is reached.
export function OnTimeLimitReached(): void {
    gameMode._internal.OnTimeLimitReached()
}

// This will trigger when a Vehicle is destroyed.
export function OnVehicleDestroyed(eventVehicle: mod.Vehicle): void {
    gameMode._internal.OnVehicleDestroyed(eventVehicle)
}

// This will trigger when a Vehicle spawns.
export function OnVehicleSpawned(eventVehicle: mod.Vehicle): void {
    gameMode._internal.OnVehicleSpawned(eventVehicle)
}

