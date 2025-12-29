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

// -------- FILE: src\Core\Player\Components\BattleStats\BattleStatsComponent.ts --------
export class CorePlayer_BattleStatsComponent implements CorePlayer_IComponent {
    private kills = 0
    private deaths = 0
    private teamKills = 0
    private score = 0
    private killStreak = 0

    onAttach(ap: CorePlayer_APlayer): void {
        // No-op
    }

    onDetach(ap: CorePlayer_APlayer): void {
        // No-op
    }

    /* ------------------------------------------------------------
     * Kills
     * ------------------------------------------------------------ */

    getKills(): number {
        return this.kills
    }

    addKill(amount = 1): void {
        this.kills += amount
    }

    /* ------------------------------------------------------------
     * Deaths
     * ------------------------------------------------------------ */

    getDeaths(): number {
        return this.deaths
    }

    addDeath(amount = 1): void {
        this.deaths += amount
    }

    /* ------------------------------------------------------------
     * Team kills
     * ------------------------------------------------------------ */

    getTeamKills(): number {
        return this.teamKills
    }

    addTeamKill(amount = 1): void {
        this.teamKills += amount
    }

    /* ------------------------------------------------------------
     * Score
     * ------------------------------------------------------------ */

    getScore(): number {
        return this.score
    }

    setScore(value: number): void {
        this.score = value
    }

    addScore(delta: number): void {
        this.score += delta
    }

    /* ------------------------------------------------------------
     * Killstreak
     * ------------------------------------------------------------ */

    getKillStreak(): number {
        return this.killStreak
    }

    addKillStreak(amount = 1): void {
        this.killStreak += amount
    }

    clearKillStreak(): void {
        this.killStreak = 0
    }
}

// -------- FILE: src\Core\Player\Components\Protection\ProtectionComponent.ts --------
export class CorePlayer_ProtectionComponent implements CorePlayer_IComponent {
    private ap!: CorePlayer_APlayer
    private active: boolean = false
    private deactivateAt: number = 0

    onAttach(ap: CorePlayer_APlayer): void {
        this.ap = ap

        ap.addListener({
            OngoingPlayer: () => {
                if (!this.active) return

                if (this.deactivateAt > 0 && Date.now() >= this.deactivateAt) {
                    this.deactivate()
                }
            },
        })
    }

    onDetach(ap: CorePlayer_APlayer): void {
        this.active = false
        this.deactivateAt = 0
    }

    activate(durationSec?: number): void {
        this.active = true

        mod.SetPlayerIncomingDamageFactor(this.ap.player, 0)

        if (durationSec && durationSec > 0) {
            this.deactivateAt = Date.now() + durationSec * 1000
        } else {
            this.deactivateAt = 0
        }
    }

    deactivate(): void {
        this.active = false
        this.deactivateAt = 0

        // BUG: setting 1 does NOT work
        mod.SetPlayerIncomingDamageFactor(this.ap.player, 0.999)
    }

    isActive(): boolean {
        return this.active
    }
}

// -------- FILE: src\GameModes\TDM\Player\TDM_Player.ts --------
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

// -------- FILE: src\GameModes\TDM\Player\TDM_PlayerManager.ts --------
export class TDM_PlayerManager extends CorePlayer_APlayerManager {
    constructor() {
        super(TDM_Player)
    }
}

// -------- FILE: src\Core\AI\Modules\Memory\MemoryManager.ts --------
/**
 * CoreAI_MemoryManager:
 * Typed TTL-based memory storage for AI.
 *
 * Memory fields are strictly typed via CoreAI_MemoryFields.
 * TTL expiration handled internally via prune().
 */

export type CoreAI_MemoryFields = {
    closestEnemy: mod.Player | null
    closestEnemyPos: mod.Vector | null

    damagedBy: mod.Player | null
    isFiring: boolean

    moveToPos: mod.Vector | null // movement target
    arrivedPos: mod.Vector | null // semantic arrival
}

export class CoreAI_MemoryManager {
    /** Unified tick timestamp updated by the Brain */
    public time: number = 0

    /** All memory values live here */
    public data: CoreAI_MemoryFields = {
        closestEnemy: null,
        closestEnemyPos: null,

        damagedBy: null,
        isFiring: false,

        moveToPos: null,
        arrivedPos: null,
    }

    /** TTL expiration registry */
    private expirations: Map<keyof CoreAI_MemoryFields, number> = new Map()

    /**
     * Set a memory field with optional TTL.
     * TTL <= 0 or value null means no expiration.
     */
    public set<K extends keyof CoreAI_MemoryFields>(
        key: K,
        value: CoreAI_MemoryFields[K],
        ttlMs?: number
    ): void {
        this.data[key] = value

        if (value == null || !ttlMs || ttlMs <= 0) {
            this.expirations.delete(key)
            return
        }

        this.expirations.set(key, this.time + ttlMs)
    }

    /**
     * Return the value of a memory field.
     */
    public get<K extends keyof CoreAI_MemoryFields>(
        key: K
    ): CoreAI_MemoryFields[K] {
        return this.data[key]
    }

    /**
     * Check if a field has a non-null, non-false value.
     */
    public has<K extends keyof CoreAI_MemoryFields>(key: K): boolean {
        const v = this.data[key]
        return v !== null && v !== false && v !== undefined
    }

    /**
     * Clear a memory field and remove expiration.
     */
    public clear<K extends keyof CoreAI_MemoryFields>(key: K): void {
        this.data[key] = null as any
        this.expirations.delete(key)
    }

    /**
     * Get expiration timestamp for a field (0 if unset).
     */
    public expiresAt<K extends keyof CoreAI_MemoryFields>(key: K): number {
        return this.expirations.get(key) ?? 0
    }

    /**
     * Time remaining before expiration (0 if none).
     */
    public getTimeRemaining<K extends keyof CoreAI_MemoryFields>(
        key: K
    ): number {
        const exp = this.expirations.get(key)
        if (exp === undefined) return 0
        const rem = exp - this.time
        return rem > 0 ? rem : 0
    }

    /**
     * Remove all expired memory entries.
     */
    public prune(): void {
        const now = this.time

        for (const [key, exp] of this.expirations) {
            if (now >= exp) {
                this.data[key] = null as any
                this.expirations.delete(key)
            }
        }
    }

    /**
     * Full reset on death or undeploy.
     */
    public reset(): void {
        this.time = 0

        this.data = {
            closestEnemy: null,
            closestEnemyPos: null,

            damagedBy: null,
            isFiring: false,

            moveToPos: null,
            arrivedPos: null,
        }

        this.expirations.clear()
    }
}

// -------- FILE: src\Core\AI\Modules\Perception\Sensors\SensorContext.ts --------
/**
 * CoreAI_SensorContext:
 * Immutable per-tick context passed to all sensors.
 *
 * Sensors must ONLY:
 * - read from ctx.player / world
 * - write into ctx.memory
 *
 * Sensors must NOT:
 * - control behaviors
 * - reference Brain
 * - trigger actions directly
 */
export interface CoreAI_SensorContext {
    /** AI-controlled player */
    player: mod.Player

    /** Shared AI memory for this brain */
    memory: CoreAI_MemoryManager

    /** Unified tick time (copied from memory.time) */
    time: number
}

// -------- FILE: src\Core\AI\Modules\Perception\Sensors\ASensor.ts --------
/**
 * ASensor:
 * Base class for all perception sensors.
 *
 * Responsibilities:
 * - Throttles sensor execution using updateRate (ms) based on ctx.time.
 * - tick(ctx) is called by Perception each tick.
 * - update(ctx) is implemented by concrete sensors.
 *
 * Notes:
 * - Sensors must always check player validity.
 * - Sensors do NOT store Brain internally.
 * - Sensors MUST use ctx.time, not Date.now().
 */
export abstract class CoreAI_ASensor {
    private lastUpdate = 0

    constructor(
        private readonly updateRate: number // milliseconds
    ) {}

    /**
     * Called by Perception each tick.
     * Applies throttling logic and calls update().
     */
    tick(ctx: CoreAI_SensorContext): void {
        const now = ctx.time // unified tick time

        if (now - this.lastUpdate < this.updateRate) {
            return
        }

        if (!mod.IsPlayerValid(ctx.player)) {
            return
        }

        this.lastUpdate = now
        this.update(ctx)
    }

    /**
     * To be implemented by concrete sensors.
     */
    protected abstract update(ctx: CoreAI_SensorContext): void

    /**
     * Optional event hooks for sensors that react to game events.
     * (FightSensor overrides onDamaged)
     */
    onDamaged?(
        ctx: CoreAI_SensorContext,
        eventOtherPlayer: mod.Player,
        eventDamageType: mod.DamageType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void {}

    reset(): void {
        this.lastUpdate = 0
    }
}

// -------- FILE: src\Core\AI\Modules\Perception\Perception.ts --------
// src/Core/AI/Modules/Perception/Perception.ts
/**
 * Perception:
 * Holds sensors, updates them every tick.
 *
 * Sensors are installed dynamically by profiles, squad brain,
 * or any system using Brain.useSensor().
 *
 * replace-sensor architecture:
 * - addSensor(sensor) replaces existing sensor with same constructor
 * - removeSensor() removes by type
 * - clearSensors() wipes all sensors
 */
export class CoreAI_Perception {
    private sensors: CoreAI_ASensor[] = []

    constructor() {}

    /** Called every tick by Brain. */
    update(ctx: CoreAI_SensorContext): void {
        for (const s of this.sensors) {
            s.tick(ctx)
        }
    }

    /** Reset internal sensor tick state. */
    reset(): void {
        for (const s of this.sensors) {
            s.reset()
        }
    }

    /** Return immutable sensor list. */
    getSensors(): readonly CoreAI_ASensor[] {
        return this.sensors
    }

    /**
     * Add or replace a sensor instance.
     * If a sensor of the same type already exists, it is replaced.
     */
    addSensor(sensor: CoreAI_ASensor): void {
        const ctor = sensor.constructor as Function

        const idx = this.sensors.findIndex((s) => s.constructor === ctor)
        if (idx !== -1) {
            this.sensors[idx] = sensor
        } else {
            this.sensors.push(sensor)
        }
    }

    /** Remove all sensors of a given constructor. */
    removeSensor(ctor: Function): void {
        this.sensors = this.sensors.filter((s) => s.constructor !== ctor)
    }

    /** Find first sensor instance of a given type. */
    getSensor<T extends CoreAI_ASensor>(
        ctor: new (...args: any[]) => T
    ): T | undefined {
        return this.sensors.find((s) => s instanceof ctor) as T | undefined
    }

    /** Remove all sensors from this brain. */
    clearSensors(): void {
        this.sensors = []
    }
}

// -------- FILE: src\Core\AI\Modules\Behavior\Behaviors\ABehavior.ts --------
/**
 * CoreAI_ABehavior:
 * Base class for all AI behaviors.
 *
 * - enter(): called once when behavior becomes active
 * - update(): called when throttling allows
 * - exit(): called once when behavior is replaced
 *
 * Throttling:
 * - If intervalMs > 0, update() is called no more often than intervalMs
 * - If intervalMs <= 0, update() is called every tick
 */
export abstract class CoreAI_ABehavior {
    protected brain: CoreAI_Brain

    public abstract name: string

    // Throttling interval. Zero means no throttling.
    protected intervalMs: number = 5000

    private lastUpdateTime: number = 0

    constructor(brain: CoreAI_Brain) {
        this.brain = brain
    }

    /** Called by BehaviorController once per tick. */
    tick(): void {
        const now = this.brain.memory.time

        if (this.intervalMs > 0) {
            if (now - this.lastUpdateTime < this.intervalMs) {
                return
            }
            this.lastUpdateTime = now
        }

        this.update()
    }

    enter(): void {}
    update(): void {}
    exit(): void {}
}

// -------- FILE: src\Core\AI\Modules\Behavior\Behaviors\IdleBehavior.ts --------
/**
 * IdleBehavior:
 * Infinite fallback behavior issued when nothing else has score.
 * Simply triggers AIIdleBehavior and lets the engine handle animations.
 */
export class CoreAI_IdleBehavior extends CoreAI_ABehavior {
    public name = 'idle'

    constructor(brain: CoreAI_Brain) {
        super(brain)
    }

    override enter(): void {
        const player = this.brain.player
        if (mod.IsPlayerValid(player)) {
            // mod.AIIdleBehavior(player)
        }
    }

    override update(): void {
        // No logic needed.
        // Engine handles stance + idle behavior.
    }

    override exit(): void {
        // No cleanup required.
    }
}

// -------- FILE: src\Core\AI\Modules\Behavior\BehaviorController.ts --------
// src/Core/AI/Modules/Behavior/BehaviorController.ts
/**
 * BehaviorController:
 *
 * - Always holds exactly one active behavior instance.
 * - TaskSelector constructs new behaviors when chosen.
 * - Controller simply switches and runs them.
 *
 * Notes:
 * - Behaviors no longer own lifecycle state.
 * - Behaviors do NOT decide completion.
 * - Switching happens every tick based on scoring.
 */
export class CoreAI_BehaviorController {
    private current: CoreAI_ABehavior

    constructor(private readonly brain: CoreAI_Brain) {
        // Start with Idle behavior
        this.current = new CoreAI_IdleBehavior(brain)
        this.current.enter()
    }

    /**
     * Switch to a new behavior instance.
     * Called by CoreAI_Brain.tick() after TaskSelector picks behavior.
     */
    change(next: CoreAI_ABehavior): void {
        // If it's the exact same instance, do nothing.
        // (May happen temporarily if TaskSelector picks same behavior two ticks in a row.)
        if (this.current === next) return

        // Exit previous behavior
        this.current.exit()

        // Enter the new behavior
        this.current = next
        this.current.enter()
    }

    /** Returns current active behavior */
    currentBehavior(): CoreAI_ABehavior {
        return this.current
    }

    /** Called every tick by the brain */
    update(): void {
        this.current.tick()
    }

    /**
     * Reset everything (on undeploy or profile switch).
     * Returns to pure Idle behavior.
     */
    resetAll(): void {
        this.current.exit()
        this.current = new CoreAI_IdleBehavior(this.brain)
        this.current.enter()
    }
}

// -------- FILE: src\Core\AI\Modules\Task\ITaskScoringEntry.ts --------
// src/Core/AI/Modules/Task/ITaskScoringEntry.ts
/**
 * CoreAI_ITaskScoringEntry:
 * - score(brain): returns utility score for this behavior.
 * - factory(brain): creates a ready-to-run behavior instance.
 *
 * TaskSelector:
 * - picks the entry with highest score
 * - calls factory(brain) to get the behavior instance
 */
export interface CoreAI_ITaskScoringEntry {
    score: (brain: CoreAI_Brain) => number
    factory: (brain: CoreAI_Brain) => CoreAI_ABehavior
}

// -------- FILE: src\Core\AI\Profiles\AProfile.ts --------
/**
 * CoreAI_AProfile:
 * Base AI profile.
 *
 * Contains:
 *  - scoring: list of behavior scoring entries
 *  - sensors: list of sensor factory functions
 *
 * Each sensor factory returns a new sensor instance:
 *    () => new SomeSensor(...)
 *
 * This ensures every AI brain receives fresh, isolated sensors.
 */
export abstract class CoreAI_AProfile {
    /** Task scoring table for behaviors. */
    scoring: CoreAI_ITaskScoringEntry[] = []

    /** Sensor factories. Each returns a new CoreAI_ASensor instance. */
    sensors: (() => CoreAI_ASensor)[] = []
}

// -------- FILE: src\Core\AI\Modules\Task\TaskSelector.ts --------
export class CoreAI_TaskSelector {
    private brain: CoreAI_Brain
    private profile: CoreAI_AProfile

    constructor(brain: CoreAI_Brain, profile: CoreAI_AProfile) {
        this.brain = brain
        this.profile = profile
    }

    setProfile(profile: CoreAI_AProfile): void {
        this.profile = profile
    }

    chooseNextBehavior() {
        const current = this.brain.behaviorController.currentBehavior()

        let bestEntry: CoreAI_ITaskScoringEntry | null = null
        let bestScore = -Infinity

        // Evaluate profile scoring
        for (const entry of this.profile.scoring) {
            const score = entry.score(this.brain)
            if (score > bestScore) {
                bestScore = score
                bestEntry = entry
            }
        }

        // If nothing scores above zero -> idle
        if (!bestEntry || bestScore <= 0) {
            if (current instanceof CoreAI_IdleBehavior) {
                return current
            }
            return new CoreAI_IdleBehavior(this.brain)
        }

        // TEMP instance only to inspect class
        const temp = bestEntry.factory(this.brain)
        const nextClass = temp.constructor

        // If same class -> never switch (no restarts)
        if (current && current.constructor === nextClass) {
            return current
        }

        // Switch to new class
        return bestEntry.factory(this.brain)
    }
}

// -------- FILE: src\Core\AI\Modules\Debug\DebugWI.ts --------
export interface CoreAI_IDebugWI {
    index: number
    worldIcon: mod.WorldIcon
}

export class CoreAI_DebugWI {
    private behaviorWI: CoreAI_IDebugWI
    private distanceWI: CoreAI_IDebugWI
    private battleWI: CoreAI_IDebugWI
    private moveWI: CoreAI_IDebugWI

    constructor(private receiver: mod.Player, private brain: CoreAI_Brain) {
        this.behaviorWI = { index: 0, worldIcon: this.spawnWI(receiver) }
        this.distanceWI = { index: 1, worldIcon: this.spawnWI(receiver) }
        this.battleWI = { index: 2, worldIcon: this.spawnWI(receiver) }
        this.moveWI = { index: 3, worldIcon: this.spawnWI(receiver) }
    }

    update() {
        if (
            !mod.IsPlayerValid(this.brain.player) ||
            !mod.GetSoldierState(
                this.brain.player,
                mod.SoldierStateBool.IsAlive
            )
        ) {
            mod.EnableWorldIconText(this.behaviorWI.worldIcon, false)
            mod.EnableWorldIconText(this.distanceWI.worldIcon, false)
            mod.EnableWorldIconText(this.battleWI.worldIcon, false)
            mod.EnableWorldIconText(this.moveWI.worldIcon, false)
            return
        }

        mod.EnableWorldIconText(this.behaviorWI.worldIcon, true)
        mod.EnableWorldIconText(this.distanceWI.worldIcon, true)
        mod.EnableWorldIconText(this.battleWI.worldIcon, true)
        mod.EnableWorldIconText(this.moveWI.worldIcon, true)

        // @stringkeys core.ai.debug.brain.behaviors: fight, closestenemy, defend, idle, moveto, follow

        this.updateWI(
            this.behaviorWI,
            mod.Message(
                `core.ai.debug.brain.behaviors.${
                    this.brain.behaviorController.currentBehavior().name
                }`
            )
        )
        switch (this.brain.behaviorController.currentBehavior().name) {
            case 'fight':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(1, 0, 0)
                )
                break
            case 'closestenemy':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(1, 0, 1)
                )
                break
            case 'defend':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(0, 1, 1)
                )
                break
            case 'moveto':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(0, 1, 0)
                )
                break
            case 'follow':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(1, 1, 0)
                )
                break
            case 'idle':
                mod.SetWorldIconColor(
                    this.behaviorWI.worldIcon,
                    mod.CreateVector(1, 1, 1)
                )
                break
        }
        this.updateWI(
            this.distanceWI,
            mod.Message(
                `core.ai.debug.brain.distance`,
                Math.floor(
                    mod.DistanceBetween(
                        mod.GetObjectPosition(this.brain.player),
                        mod.GetObjectPosition(this.receiver)
                    )
                ),
                mod.GetObjId(mod.GetTeam(this.brain.player))
            )
        )
        this.updateWI(
            this.battleWI,
            mod.Message(
                `core.ai.debug.brain.memory.battle`,
                this.brain.memory.getTimeRemaining('isFiring'),
                this.brain.memory.getTimeRemaining('damagedBy'),
                this.brain.memory.getTimeRemaining('closestEnemy')
            )
        )
        this.updateWI(
            this.moveWI,
            mod.Message(
                `core.ai.debug.brain.memory.calm`,
                this.brain.memory.getTimeRemaining('moveToPos'),
                this.brain.memory.getTimeRemaining('arrivedPos')
            )
        )
    }

    private round2decimal(num: number): number {
        const factor = 10 /* * 10 // 100 */
        return Math.round(num * factor) / factor
    }

    private getIconOffset(d: number): number {
        const base = 1.9
        const upStart = 2
        const upEnd = 40
        const downEnd = 70
        const peakDelta = 0.9 // 2.8 - 1.9

        if (d <= upStart) return base
        if (d >= downEnd) return base

        // rising part: 2..40
        if (d < upEnd) {
            const t = (d - upStart) / (upEnd - upStart) // 0..1
            const bump = Math.pow(t, 0.5) // sqrt: fast early rise
            return base + peakDelta * bump
        }

        // falling part: 40..70
        const t = (d - upEnd) / (downEnd - upEnd) // 0..1
        const bump = Math.pow(1 - t, 0.8) // slower fall
        return base + peakDelta * bump
    }

    /**
     * Returns the vertical world offset for stacked icons.
     *
     * index = 0 -> base icon
     * index = 1 -> first icon above it
     * index = 2 -> second icon above it
     *
     * The gap is scaled by distance so icons appear visually snapped.
     */
    private getStackedIconOffset(d: number, index: number, gap = 0.4): number {
        // Base icon offset using your existing curve
        const baseOffset = this.getIconOffset(d)

        // Reference distance at which gap looks correct visually.
        // 20m is a good default for human-readable marker stacking.
        const reference = 20

        // Scale gap according to distance to compensate for perspective shrinking
        const scale = d / reference

        // Index=0 gives base offset
        if (index === 0) return baseOffset

        // Each stacked icon sits on top of the previous one
        return baseOffset + index * gap * scale
    }

    private spawnWI(receiver: mod.Player): mod.WorldIcon {
        const wi = mod.SpawnObject(
            mod.RuntimeSpawn_Common.WorldIcon,
            mod.CreateVector(0, 0, 0),
            mod.CreateVector(0, 0, 0)
        )
        mod.SetWorldIconOwner(wi, receiver)
        mod.SetWorldIconColor(wi, mod.CreateVector(1, 1, 1))
        mod.SetWorldIconText(wi, mod.Message(''))
        mod.EnableWorldIconText(wi, true)

        return wi
    }

    private updateWI(wi: CoreAI_IDebugWI, mes: mod.Message): void {
        mod.SetWorldIconPosition(
            wi.worldIcon,
            mod.CreateVector(
                mod.XComponentOf(mod.GetObjectPosition(this.brain.player)),
                mod.YComponentOf(mod.GetObjectPosition(this.brain.player)) +
                    this.getStackedIconOffset(
                        mod.DistanceBetween(
                            mod.GetObjectPosition(this.brain.player),
                            mod.GetObjectPosition(this.receiver)
                        ),
                        wi.index,
                        0.6
                    ),
                mod.ZComponentOf(mod.GetObjectPosition(this.brain.player))
            )
        )
        mod.SetWorldIconText(wi.worldIcon, mes)
    }
}

// -------- FILE: src\Core\AI\IBrainEvents.ts --------
export interface CoreAI_IBrainEvents {
    // Lifecycle
    OnMoveFinished?(success: boolean): void
    OnBehaviorChanged?(previous: CoreAI_ABehavior, next: CoreAI_ABehavior): void
}

// -------- FILE: src\Core\AI\Modules\Perception\Sensors\FightSensor.ts --------
/**
 * FightSensor:
 * Detects weapon firing.
 *
 * Writes:
 * - memory.isFiring (TTL-based boolean)
 *
 * Notes:
 * - Damage events are handled directly by the Brain.
 * - No POIs.
 * - No behaviors spawned.
 * - TaskSelector checks memory.isFiring to understand combat state.
 */
export class CoreAI_FightSensor extends CoreAI_ASensor {
    constructor(
        intervalMs: number = 50,
        private readonly ttlMs: number = 5000
    ) {
        super(intervalMs)
    }

    protected update(ctx: CoreAI_SensorContext): void {
        const player = ctx.player
        if (!mod.IsPlayerValid(player)) return

        const isFiring = mod.GetSoldierState(
            player,
            mod.SoldierStateBool.IsFiring
        )

        if (!isFiring) return

        // TTL-based firing flag
        ctx.memory.set('isFiring', true, this.ttlMs)
    }

    override onDamaged?(
        ctx: CoreAI_SensorContext,
        eventOtherPlayer: mod.Player,
        eventDamageType: mod.DamageType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void {
        // Set damagedBy with configured TTL
        ctx.memory.set('damagedBy', eventOtherPlayer, this.ttlMs)
    }
}

// -------- FILE: src\Core\AI\Brain.ts --------
/**
 * CoreAI_Brain
 *
 * Pure AI logic unit.
 *
 * Responsibilities:
 * - Perception
 * - Memory
 * - Behavior selection
 * - Behavior execution
 *
 * Does NOT:
 * - Attach itself to players
 * - Listen to player events directly
 * - Manage lifecycle bindings
 *
 * All player integration is handled by BrainComponent.
 */

// @stringkeys core.ai.bots: 1..32

export class CoreAI_Brain {
    public player: mod.Player

    public perception: CoreAI_Perception
    public memory: CoreAI_MemoryManager
    public behaviorController: CoreAI_BehaviorController
    public taskSelector: CoreAI_TaskSelector

    private debugWI: CoreAI_DebugWI | null = null
    private listeners: CoreAI_IBrainEvents[] = []

    constructor(player: mod.Player, profile: CoreAI_AProfile) {
        this.player = player

        this.memory = new CoreAI_MemoryManager()
        this.perception = new CoreAI_Perception()
        this.behaviorController = new CoreAI_BehaviorController(this)
        this.taskSelector = new CoreAI_TaskSelector(this, profile)

        // this.debugWI = new CoreAI_DebugWI(mod.FirstOf(mod.AllPlayers()), this)

        this.installProfile(profile)
    }

    /* ------------------------------------------------------------
     * Profile installation
     * ------------------------------------------------------------ */

    installProfile(profile: CoreAI_AProfile): void {
        this.taskSelector.setProfile(profile)

        this.perception.clearSensors()

        for (const factory of profile.sensors) {
            this.perception.addSensor(factory())
        }
    }

    /* ------------------------------------------------------------
     * Sensor API
     * ------------------------------------------------------------ */

    useSensor<T extends CoreAI_ASensor>(sensor: T): T {
        const ctor = sensor.constructor as Function
        this.perception.removeSensor(ctor)
        this.perception.addSensor(sensor)
        return sensor
    }

    removeSensor(ctor: Function): void {
        this.perception.removeSensor(ctor)
    }

    getSensor<T extends CoreAI_ASensor>(
        ctor: new (...args: any[]) => T
    ): T | undefined {
        return this.perception.getSensor(ctor)
    }

    getSensors(): readonly CoreAI_ASensor[] {
        return this.perception.getSensors()
    }

    /* ------------------------------------------------------------
     * Player lifecycle hooks (called by BrainComponent)
     * ------------------------------------------------------------ */

    onDeployed(): void {}

    onDied(): void {
        this.perception.reset()
        this.memory.reset()
        this.behaviorController.resetAll()
    }

    onUndeploy(): void {}

    /* ------------------------------------------------------------
     * Movement finished
     * ------------------------------------------------------------ */

    onMoveFinished(success: boolean): void {
        this.memory.set('moveToPos', null)
        this.emit('OnMoveFinished', success)
    }

    /* ------------------------------------------------------------
     * Damage event
     * ------------------------------------------------------------ */

    onDamaged(
        eventOtherPlayer: mod.Player,
        eventDamageType: mod.DamageType,
        eventWeaponUnlock: mod.WeaponUnlock
    ): void {
        const fightSensor = this.getSensor(CoreAI_FightSensor)
        if (!fightSensor) return

        const sensorCtx: CoreAI_SensorContext = {
            player: this.player,
            memory: this.memory,
            time: this.memory.time,
        }

        fightSensor.onDamaged?.(
            sensorCtx,
            eventOtherPlayer,
            eventDamageType,
            eventWeaponUnlock
        )
    }

    /* ------------------------------------------------------------
     * Tick (called by BrainComponent)
     * ------------------------------------------------------------ */

    tick(): void {
        this.debugWI?.update()

        this.memory.time = Date.now()
        this.memory.prune()

        if (
            !mod.IsPlayerValid(this.player) ||
            !mod.GetSoldierState(this.player, mod.SoldierStateBool.IsAlive)
        ) {
            return
        }

        const sensorCtx: CoreAI_SensorContext = {
            player: this.player,
            memory: this.memory,
            time: this.memory.time,
        }

        this.perception.update(sensorCtx)

        const before = this.behaviorController.currentBehavior()
        const next = this.taskSelector.chooseNextBehavior()

        this.behaviorController.change(next)

        const after = this.behaviorController.currentBehavior()
        if (after !== before) {
            this.emit('OnBehaviorChanged', before, after)
        }

        this.behaviorController.update()
    }

    /* ------------------------------------------------------------
     * Cleanup
     * ------------------------------------------------------------ */

    destroy(): void {
        this.memory.reset()
        this.behaviorController.resetAll()
        this.perception.clearSensors()
    }

    /* ------------------------------------------------------------
     * Brain event system
     * ------------------------------------------------------------ */

    addListener(listener: CoreAI_IBrainEvents): void {
        this.listeners.push(listener)
    }

    removeListener(listener: CoreAI_IBrainEvents): void {
        this.listeners = this.listeners.filter((l) => l !== listener)
    }

    emit<E extends keyof CoreAI_IBrainEvents>(
        event: E,
        ...args: Parameters<NonNullable<CoreAI_IBrainEvents[E]>>
    ): void {
        for (const listener of this.listeners) {
            const fn = listener[event]
            if (typeof fn === 'function') {
                ;(fn as (...a: any[]) => void)(...args)
            }
        }
    }
}

// -------- FILE: src\Core\AI\Modules\Behavior\Behaviors\FightBehavior.ts --------
/**
 * FightBehavior:
 * Activated when the threat is high enough for combat.
 *
 * Engine handles all dynamic combat: aiming, targeting, firing, strafing, cover.
 * This behavior does not end by itself; TaskSelector decides when to exit.
 */
export class CoreAI_FightBehavior extends CoreAI_ABehavior {
    public name = 'fight'

    constructor(brain: CoreAI_Brain) {
        super(brain)
    }

    override enter(): void {
        const player = this.brain.player
        if (mod.IsPlayerValid(player)) {
            mod.AIBattlefieldBehavior(player)
        }
    }

    override update(): void {
        // Engine handles combat; nothing to update
    }

    override exit(): void {
        // No cleanup required for fight mode in this architecture
    }
}

// -------- FILE: src\Core\AI\Modules\Behavior\Behaviors\ClosestEnemyBehavior.ts --------
/**
 * ClosestEnemyBehavior:
 * Moves toward an enemy detected by ClosestEnemySensor.
 *
 * - Snapshots enemy position once (no tracking)
 * - Aiming only if enemy valid at enter()
 * - Movement is engine-driven
 */
export class CoreAI_ClosestEnemyBehavior extends CoreAI_ABehavior {
    public name = 'closestenemy'

    private readonly enemy: mod.Player
    private readonly speed: mod.MoveSpeed

    constructor(brain: CoreAI_Brain, enemy: mod.Player, speed: mod.MoveSpeed) {
        super(brain)
        this.enemy = enemy
        this.speed = speed
    }

    override enter(): void {
        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) return

        // Aim at enemy if valid
        if (mod.IsPlayerValid(this.enemy)) {
            mod.AISetTarget(player, this.enemy)
        } else {
            mod.AISetTarget(player)
        }

        // Snapshot enemy position
        const pos = mod.GetObjectPosition(this.enemy)
        if (!pos) return

        mod.AISetMoveSpeed(player, this.speed)
        mod.AIValidatedMoveToBehavior(player, pos)
    }

    override update(): void {
        // Movement is handled by engine; behavior has nothing to update
    }

    override exit(): void {
        // Clear target on behavior exit
        const player = this.brain.player
        if (mod.IsPlayerValid(player)) {
            mod.AISetTarget(player)
        }
    }
}

// -------- FILE: src\Core\AI\Modules\Behavior\Behaviors\DefendBehavior.ts --------
/**
 * DefendBehavior:
 * Triggered when memory.defendPos has a value (set by DefendSensor or game logic).
 *
 * Behavior:
 * - Executes AIDefendPositionBehavior
 * - Continues as long as memory.defendPos exists
 * - Ends naturally when TTL clears defendPos and selector chooses another behavior
 *
 * NOTE:
 * - No internal timers
 * - No cleanup of memory.defendPos
 * - Pure execution-only behavior
 */
export class CoreAI_DefendBehavior extends CoreAI_ABehavior {
    public name = 'defend'

    private readonly defendPos: mod.Vector
    private readonly minDist: number
    private readonly maxDist: number

    constructor(
        brain: CoreAI_Brain,
        defendPos: mod.Vector,
        minDist: number,
        maxDist: number
    ) {
        super(brain)
        this.defendPos = defendPos
        this.minDist = minDist
        this.maxDist = maxDist
    }

    override enter(): void {
        super.enter()

        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) return

        mod.AIDefendPositionBehavior(
            player,
            this.defendPos,
            this.minDist,
            this.maxDist
        )
    }

    override update(): void {
        // NOTHING NEEDED.
        // TTL expiration in memory.defendPos decides when this behavior stops.
    }

    override exit(): void {
        super.exit()
        // No cleanup needed.
    }
}

// -------- FILE: src\Core\AI\Modules\Behavior\Behaviors\MoveToBehavior.ts --------
/**
 * MoveToBehavior:
 * - Starts movement in enter()
 * - Runs as long as memory.moveToPos exists
 * - Stopped automatically when TTL clears moveToPos
 *
 * TTL-driven memory replaces durationMs logic.
 */
export class CoreAI_MoveToBehavior extends CoreAI_ABehavior {
    public name = 'moveto'

    private readonly targetPos: mod.Vector
    private readonly speed: mod.MoveSpeed

    constructor(brain: CoreAI_Brain, pos: mod.Vector, speed: mod.MoveSpeed) {
        super(brain)
        this.targetPos = pos
        this.speed = speed
    }

    override enter(): void {
        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) return

        mod.AISetMoveSpeed(player, this.speed)
        mod.AIValidatedMoveToBehavior(player, this.targetPos)
    }

    override update(): void {
        // Nothing needed here anymore.
        // TTL in memory determines when this behavior stops being selected.
    }

    override exit(): void {
        // No cleanup needed
    }
}

// -------- FILE: src\Core\AI\Modules\Perception\Sensors\ClosestEnemySensor.ts --------
/**
 * ClosestEnemySensor:
 * Detects the closest visible enemy and writes raw data into memory.
 *
 * Writes:
 * - memory.closestEnemy
 * - memory.closestEnemyPos
 *
 * Notes:
 * - No POIs are created.
 * - No behaviors are spawned.
 * - TaskSelector evaluates this memory to decide behavior.
 */
export class CoreAI_ClosestEnemySensor extends CoreAI_ASensor {
    constructor(
        private readonly sensitivity: number = 1,
        intervalMs: number = 2000,
        private readonly ttlMs: number = 8000 // parametric TTL
    ) {
        super(intervalMs)
    }

    protected update(ctx: CoreAI_SensorContext): void {
        const player = ctx.player
        if (!mod.IsPlayerValid(player)) return

        const myPos = mod.GetObjectPosition(player)

        // Determine enemy team
        const myTeam = mod.GetObjId(mod.GetTeam(player))
        const enemyTeamId = myTeam === 1 ? 2 : 1
        const enemyTeamObj = mod.GetTeam(enemyTeamId)

        // Find closest visible enemy
        const newEnemy = mod.ClosestPlayerTo(myPos, enemyTeamObj)
        if (!mod.IsPlayerValid(newEnemy)) {
            // Clear enemy memory (TTL = immediate)
            ctx.memory.set('closestEnemy', null)
            ctx.memory.set('closestEnemyPos', null)
            return
        }

        // Same enemy -> nothing to update
        if (ctx.memory.get('closestEnemy') === newEnemy) {
            return
        }

        // Probabilistic detection
        const enemyPos = mod.GetObjectPosition(newEnemy)

        const dist = mod.DistanceBetween(myPos, enemyPos)
        const prob = Math.exp(-0.12 * dist * (1.0 / this.sensitivity))
        if (Math.random() > prob) return

        // Write memory with TTL
        ctx.memory.set('closestEnemy', newEnemy, this.ttlMs)
        ctx.memory.set('closestEnemyPos', enemyPos, this.ttlMs)
    }
}

// -------- FILE: src\Core\AI\Modules\Perception\Sensors\ArrivalSensor.ts --------
/**
 * ArrivalSensor:
 *
 * Detects when AI arrives inside ONE OR MORE special semantic points:
 * - defend positions
 * - objective markers
 * - interact zones
 * - rally points
 *
 * This DOES NOT handle MoveTo arrival.
 * MoveToSensor handles movement arrival internally.
 *
 * This sensor is for high-level AI logic only.
 */
export class ArrivalSensor extends CoreAI_ASensor {
    private lastTriggerTime = 0

    constructor(
        private readonly getPoints: () => mod.Vector[],
        intervalMs: number = 500,
        private readonly distanceThreshold: number = 3.0, // arrival radius
        private readonly ttl: number = 2000, // arrival memory duration
        private readonly cooldownMs: number = 4000 // prevent spam-triggering
    ) {
        super(intervalMs)
    }

    protected update(ctx: CoreAI_SensorContext): void {
        const memory = ctx.memory
        const player = ctx.player

        if (!mod.IsPlayerValid(player)) return

        const now = ctx.time
        const myPos = mod.GetObjectPosition(player)

        const points = this.getPoints()
        if (!points || points.length === 0) return

        // ------------------------------------------------------------
        // Cooldown - do not retrigger too frequently
        // ------------------------------------------------------------
        if (this.lastTriggerTime > 0) {
            if (now - this.lastTriggerTime < this.cooldownMs) {
                return
            }
        }

        // ------------------------------------------------------------
        // Only detect new arrival if arrival memory expired
        // ------------------------------------------------------------
        if (memory.get('arrivedPos')) {
            return
        }

        // ------------------------------------------------------------
        // MAIN ARRIVAL CHECK
        // ------------------------------------------------------------
        for (const p of points) {
            const dist = mod.DistanceBetween(myPos, p)

            if (dist <= this.distanceThreshold) {
                // AI arrived to a special semantic point
                memory.set('arrivedPos', p, this.ttl)
                this.lastTriggerTime = now
                return
            }
        }
    }
}

// -------- FILE: src\Core\AI\Modules\Perception\Sensors\MoveToSensor.ts --------
/**
 * MoveToSensor:
 * Picks a movement target from a list of points.
 *
 * Design:
 * - Direction-driven, no historical recents.
 * - While moving, backward targets are forbidden.
 * - Velocity is preferred when speed > threshold.
 * - Intent direction stabilizes steering across replans.
 */
export class MoveToSensor extends CoreAI_ASensor {
    private readonly ttlMs: number

    private coldStart: boolean = true

    // Cached movement intent direction
    private lastIntentDir: mod.Vector | null = null

    constructor(
        private readonly getPoints: () => mod.Vector[],
        intervalMs: number = 750,
        ttlMs: number = 6000
    ) {
        super(intervalMs)
        this.ttlMs = ttlMs
    }

    override reset(): void {
        this.coldStart = true
        this.lastIntentDir = null
    }

    protected update(ctx: CoreAI_SensorContext): void {
        const player = ctx.player
        if (!mod.IsPlayerValid(player)) return

        // Do not reselect while intent exists
        if (ctx.memory.get('moveToPos')) return

        const points = this.getPoints()
        if (!points || points.length === 0) return

        const myPos = mod.GetObjectPosition(player)

        // ------------------------------------------------------------
        // Resolve forward direction
        // ------------------------------------------------------------

        const speed = mod.GetSoldierState(player, mod.SoldierStateNumber.Speed)

        let forward: mod.Vector | null = null

        // 1. True movement direction
        if (speed > 0.3) {
            const vel = mod.GetSoldierState(
                player,
                mod.SoldierStateVector.GetLinearVelocity
            )
            const lenSq = mod.DotProduct(vel, vel)

            if (lenSq > 0.1) {
                forward = mod.Normalize(vel)
                this.lastIntentDir = forward
            }
        }

        // 2. Cached intent
        if (!forward && this.lastIntentDir) {
            forward = this.lastIntentDir
        }

        // 3. Facing fallback
        if (!forward) {
            const face = mod.GetSoldierState(
                player,
                mod.SoldierStateVector.GetFacingDirection
            )
            forward = mod.Normalize(face)
            this.lastIntentDir = forward
        }

        // ------------------------------------------------------------
        // Build candidates
        // ------------------------------------------------------------

        const candidates: {
            pos: mod.Vector
            dist: number
            dot: number
        }[] = []

        const ARRIVAL_EXCLUDE_DIST = 3.0

        for (const pos of points) {
            const dist = mod.DistanceBetween(myPos, pos)

            // Already here, do not reselect
            if (dist < ARRIVAL_EXCLUDE_DIST) {
                continue
            }

            const dir = mod.DirectionTowards(myPos, pos)
            const dot = mod.DotProduct(forward, dir)

            candidates.push({ pos, dist, dot })
        }

        if (candidates.length === 0) return

        // ------------------------------------------------------------
        // While moving, forbid backward choices
        // ------------------------------------------------------------

        let usable = candidates

        if (speed > 0.5) {
            usable = candidates.filter((c) => c.dot > 0)
        }

        if (usable.length === 0) return

        // ------------------------------------------------------------
        // Pick best candidate
        // ------------------------------------------------------------

        let best = usable[0]
        let bestScore = -Infinity

        for (const c of usable) {
            const score = this.scoreCandidate(c)
            if (score > bestScore) {
                bestScore = score
                best = c
            }
        }

        // ------------------------------------------------------------
        // Commit
        // ------------------------------------------------------------

        ctx.memory.set('moveToPos', best.pos, this.ttlMs)
        this.lastIntentDir = mod.DirectionTowards(myPos, best.pos)
        this.coldStart = false
    }

    private scoreCandidate(c: {
        pos: mod.Vector
        dist: number
        dot: number
    }): number {
        // Distance band scoring
        let distScore = 0
        if (c.dist <= 15) {
            distScore = c.dist / 15
        } else if (c.dist <= 40) {
            distScore = 1
        } else {
            const over = c.dist - 40
            distScore = over >= 20 ? 0 : 1 - over / 20
        }

        const dirScore = Math.max(0, c.dot)

        const jitterMax = this.coldStart ? 0.8 : 0.4
        const jitter = Math.random() * jitterMax

        return distScore * 0.7 + dirScore * 0.3 + jitter
    }
}

// -------- FILE: src\Core\AI\Modules\Perception\Sensors\MoveToCapturePointSensor.ts --------
/**
 * MoveToCapturePointSensor
 *
 * Purpose:
 * - Selects a movement target from a set of capture points.
 * - Chooses only capture points not owned by the player's team.
 *
 * Behavior:
 * - Evaluates distance to all valid capture points.
 * - Keeps the two closest candidates.
 * - Randomly selects between the closest and second-closest target
 *   to reduce AI clustering.
 *
 * Memory:
 * - Writes `moveToPos` intent with a TTL.
 * - Does not reselect while a valid `moveToPos` intent exists.
 *
 * Notes:
 * - No pathfinding or movement logic (sensor-only).
 * - Selection is distance-based only; higher-level pressure or
 *   role-based logic can be layered later.
 */
export class MoveToCapturePointSensor extends CoreAI_ASensor {
    private readonly ttlMs: number

    constructor(
        private readonly getCapturePoints: () => mod.CapturePoint[],
        intervalMs: number = 750,
        ttlMs: number = 6000
    ) {
        super(intervalMs)
        this.ttlMs = ttlMs
    }

    override reset(): void {}

    protected update(ctx: CoreAI_SensorContext): void {
        const player = ctx.player
        if (!mod.IsPlayerValid(player)) return

        // Do not reselect while intent exists
        if (ctx.memory.get('moveToPos')) return

        const capturePoints = this.getCapturePoints()
        if (!capturePoints || capturePoints.length === 0) return

        // ------------------------------------------------------------
        //
        // ------------------------------------------------------------

        const playerPos = mod.GetObjectPosition(player)

        const playerTeamId = mod.GetObjId(mod.GetTeam(player))

        // store up to two closest
        let closest: { pos: mod.Vector; dist: number } | null = null
        let secondClosest: { pos: mod.Vector; dist: number } | null = null

        for (const cp of capturePoints) {
            const owner = mod.GetCurrentOwnerTeam(cp)

            // exclude CPs already owned by player team
            if (mod.GetObjId(owner) === playerTeamId) {
                continue
            }

            const cpPos = mod.GetObjectPosition(cp)
            const dist = mod.DistanceBetween(playerPos, cpPos)

            if (!closest || dist < closest.dist) {
                secondClosest = closest
                closest = { pos: cpPos, dist }
            } else if (!secondClosest || dist < secondClosest.dist) {
                secondClosest = { pos: cpPos, dist }
            }
        }

        if (!closest) {
            return
        }

        // only one candidate
        if (!secondClosest) {
            ctx.memory.set('moveToPos', closest.pos, this.ttlMs)
            return
        }

        // ------------------------------------------------------------
        // Commit
        // ------------------------------------------------------------

        ctx.memory.set(
            'moveToPos',
            Math.random() < 1 ? closest.pos : secondClosest.pos,
            this.ttlMs
        )
    }
}

// -------- FILE: src\Core\AI\Profiles\CombatantProfile.ts --------
export class CoreAI_CombatantProfile extends CoreAI_AProfile {
    constructor(
        private readonly getDefendWPs: () => mod.Vector[],
        private readonly getRoamWPs: () => mod.Vector[],
        private readonly getCapturePoints: () => mod.CapturePoint[]
    ) {
        super()

        this.scoring = [
            {
                score: (brain) => {
                    const m = brain.memory
                    return m.get('isFiring') || m.get('damagedBy') ? 200 : 0
                },
                factory: (brain) => new CoreAI_FightBehavior(brain),
            },

            {
                score: (brain) => (brain.memory.get('closestEnemy') ? 150 : 0),
                factory: (brain) =>
                    new CoreAI_ClosestEnemyBehavior(
                        brain,
                        brain.memory.get('closestEnemy')!,
                        mod.MoveSpeed.InvestigateRun
                    ),
            },

            {
                score: (brain) => (brain.memory.get('arrivedPos') ? 120 : 0),
                factory: (brain) =>
                    new CoreAI_DefendBehavior(
                        brain,
                        brain.memory.get('arrivedPos')!,
                        2.0,
                        8.0
                    ),
            },

            {
                score: (brain) => (brain.memory.get('moveToPos') ? 20 : 0),
                factory: (brain) =>
                    new CoreAI_MoveToBehavior(
                        brain,
                        brain.memory.get('moveToPos')!,
                        Math.random() < 0.3
                            ? mod.MoveSpeed.Sprint
                            : mod.MoveSpeed.Run
                    ),
            },
        ] as CoreAI_ITaskScoringEntry[]

        this.sensors = [
            () => new CoreAI_FightSensor(),
            () => new CoreAI_ClosestEnemySensor(),

            () =>
                new ArrivalSensor(
                    () => this.getDefendWPs(),
                    500,
                    6.0,
                    10000,
                    15000
                ),

            () => new MoveToCapturePointSensor(() => this.getCapturePoints()),
            () => new MoveToSensor(() => this.getRoamWPs()),
        ]
    }
}

// -------- FILE: src\Core\AI\Components\BrainComponent.ts --------
// src/Core/AI/Components/BrainComponent.ts
/**
 * BrainComponent
 *
 * AI behavior component attached to a logical player.
 * Created and configured by GameMode.
 */
export class BrainComponent implements CorePlayer_IComponent {
    public readonly brain: CoreAI_Brain

    private ap!: CorePlayer_APlayer

    constructor(brain: CoreAI_Brain) {
        this.brain = brain
    }

    onAttach(ap: CorePlayer_APlayer): void {
        this.ap = ap

        // Hook brain tick into player ongoing tick
        ap.addListener({
            OngoingPlayer: () => {
                this.brain.tick()
            },
            OnPlayerDamaged: (other, damageType, weapon) => {
                if (!other) return
                this.brain.onDamaged(other.player, damageType, weapon)
            },
            OnAIMoveToSucceeded: () => {
                this.brain.onMoveFinished(true)
            },
            OnAIMoveToFailed: () => {
                this.brain.onMoveFinished(false)
            },
        })
    }

    onDetach(ap: CorePlayer_APlayer): void {
        this.brain.destroy()
    }

    /**
     * Called automatically by APlayer.rebindTo()
     * when the soldier object changes.
     */
    onRebind(newPlayer: mod.Player): void {
        this.brain.player = newPlayer
    }
}

// -------- FILE: src\Core\AI\Modules\Behavior\Behaviors\FollowBehavior.ts --------
export class CoreAI_FollowBehavior extends CoreAI_ABehavior {
    public name = 'follow'

    private readonly getPos: () => mod.Vector | null
    private lastPos: mod.Vector | null = null

    constructor(
        brain: CoreAI_Brain,
        getPos: () => mod.Vector | null,
        intervalMs: number = 5000 // safe, avoids engine stutter
    ) {
        super(brain)
        this.getPos = getPos
        this.intervalMs = intervalMs
    }

    override enter(): void {
        this.lastPos = this.getPos()
        this.issueMove()
    }

    override update(): void {
        const pos = this.getPos()
        if (!pos) return

        if (pos !== this.lastPos) {
            this.lastPos = pos
            this.issueMove()
        }
    }

    private issueMove(): void {
        const pos = this.lastPos
        if (!pos) return

        const player = this.brain.player
        if (!mod.IsPlayerValid(player)) return

        const myPos = mod.GetObjectPosition(player)
        const dist = mod.DistanceBetween(myPos, pos)

        // dynamic speed logic
        let speed: mod.MoveSpeed
        if (dist > 20) speed = mod.MoveSpeed.Sprint
        else if (dist > 10) speed = mod.MoveSpeed.Run
        else speed = mod.MoveSpeed.InvestigateRun

        mod.AISetMoveSpeed(player, speed)
        mod.AIValidatedMoveToBehavior(player, pos)
    }
}

// -------- FILE: src\Core\AI\Profiles\FollowerProfile.ts --------
export class CoreAI_FollowerProfile extends CoreAI_AProfile {
    constructor(private readonly getPoint: () => mod.Vector | null) {
        super()

        this.scoring = [
            // Fight has top priority
            {
                score: (brain) => {
                    return brain.memory.get('isFiring') ||
                        brain.memory.get('damagedBy')
                        ? 200
                        : 0
                },
                factory: (brain) => new CoreAI_FightBehavior(brain),
            },

            // Closest enemy
            {
                score: (brain) => {
                    return brain.memory.get('closestEnemy') ? 150 : 0
                },
                factory: (brain) =>
                    new CoreAI_ClosestEnemyBehavior(
                        brain,
                        brain.memory.get('closestEnemy')!,
                        mod.MoveSpeed.InvestigateRun
                    ),
            },

            // Defend when arrived
            {
                score: (brain) => (brain.memory.get('arrivedPos') ? 100 : 0),
                factory: (brain) =>
                    new CoreAI_DefendBehavior(
                        brain,
                        brain.memory.get('arrivedPos')!,
                        1.0,
                        6.0
                    ),
            },

            // Follow (always enabled)
            {
                score: (brain) => {
                    const target = this.getPoint()
                    if (!target) return 0

                    const myPos = mod.GetObjectPosition(brain.player)
                    const dist = mod.DistanceBetween(myPos, target)

                    // If far from leader, high priority
                    if (
                        dist > 8.0 &&
                        dist < 40.0 &&
                        !brain.memory.get('closestEnemy')
                    ) {
                        return 250
                    }

                    // If close, normal follow priority
                    return 50
                },
                factory: (brain) => {
                    return new CoreAI_FollowBehavior(brain, this.getPoint, 4000)
                },
            },

            {
                score: () => 1,
                factory: (brain) => new CoreAI_IdleBehavior(brain),
            },
        ] as CoreAI_ITaskScoringEntry[]

        this.sensors = [
            () => new CoreAI_FightSensor(),
            () => new CoreAI_ClosestEnemySensor(),

            // Arrival sensor only
            () =>
                new ArrivalSensor(
                    () => {
                        const p = this.getPoint()
                        return p ? [p] : []
                    },
                    1000,
                    6.0,
                    4000,
                    0
                ),
        ]
    }
}

// -------- FILE: src\Core\Squad\Squad.ts --------
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
        const profile = new CoreAI_FollowerProfile(() => this.getSquadPoint())
        brainComp.brain.installProfile(profile)
    }

    /* ------------------------------------------------------------
     * Squad follow point
     * ------------------------------------------------------------ */

    private getSquadPoint(): mod.Vector | null {
        if (this.leader) {
            return mod.GetObjectPosition(this.leader.player)
        }
        return null
    }
}

// -------- FILE: src\Core\Squad\SquadManager.ts --------
export class Core_SquadManager {
    private gameMode: Core_AGameMode
    private squads: CoreAI_Squad[] = []
    private maxSlots: number

    constructor(gameMode: Core_AGameMode, maxSlots: number = 4) {
        this.gameMode = gameMode
        this.maxSlots = maxSlots
    }

    /* ------------------------------------------------------------
     * Player Join
     * ------------------------------------------------------------ */
    async addToSquad(ap: CorePlayer_APlayer): Promise<CoreAI_Squad> {
        const teamId = mod.GetObjId(mod.GetTeam(ap.player))

        // Find squad with same team + free slots
        let squad = this.squads.find(
            (s) => s.getTeamId() === teamId && s.freeSlots() > 0
        )

        // Create new squad if no free one exists
        if (!squad) {
            squad = new CoreAI_Squad(this.gameMode, teamId, this.maxSlots)
            this.squads.push(squad)
        }

        squad.addMember(ap)
        return squad
    }

    /* ------------------------------------------------------------
     * Player Leave
     * ------------------------------------------------------------ */
    removeFromSquad(ap: CorePlayer_APlayer): void {
        for (const squad of this.squads) {
            squad.removeMember(ap)
        }

        // Remove empty squads
        this.squads = this.squads.filter((s) => s.getMembers().length > 0)
    }

    /* ------------------------------------------------------------
     * Helpers
     * ------------------------------------------------------------ */
    getSquad(ap: CorePlayer_APlayer): CoreAI_Squad | undefined {
        return this.squads.find((s) => s.getMembers().includes(ap))
    }

    getSquadsByTeam(teamId: number): CoreAI_Squad[] {
        return this.squads.filter((s) => s.getTeamId() === teamId)
    }

    getAllSquads(): CoreAI_Squad[] {
        return this.squads
    }
}

// -------- FILE: src\GameModes\TDM\TDM_GameMode.ts --------
export class TDM_GameMode extends Core_AGameMode {
    protected override createPlayerManager(): CorePlayer_APlayerManager {
        return new TDM_PlayerManager()
    }

    private AI_UNSPAWN_DELAY = 10
    private AI_COUNT_TEAM_1 = 3
    private AI_COUNT_TEAM_2 = 8

    private squadManager: Core_SquadManager | null = null
    private teamScores = new Map<number, number>()

    protected override OnGameModeStarted(): void {
        mod.SetAIToHumanDamageModifier(2)

        mod.SetGameModeTargetScore(100)

        mod.SetScoreboardType(mod.ScoreboardType.CustomTwoTeams)
        mod.SetScoreboardColumnNames(
            mod.Message(`gamemodes.PRSR.scoreboard.score`),
            mod.Message(`gamemodes.PRSR.scoreboard.kills`),
            mod.Message(`gamemodes.PRSR.scoreboard.deaths`),
            mod.Message(`gamemodes.PRSR.scoreboard.teamKills`),
            mod.Message(`gamemodes.PRSR.scoreboard.killStreak`)
        )
        mod.SetScoreboardColumnWidths(1, 0.5, 0.5, 0.5, 0.5)

        mod.Wait(5).then(() => {
            for (let i = 1; i <= this.AI_COUNT_TEAM_1; i++) {
                mod.Wait(0.5).then(() =>
                    this.playerManager.spawnLogicalBot(
                        mod.SoldierClass.Assault,
                        1,
                        mod.GetObjectPosition(mod.GetHQ(1)),
                        mod.Message(`core.ai.bots.${i}`),
                        this.AI_UNSPAWN_DELAY
                    )
                )
            }

            for (let j = 1; j <= this.AI_COUNT_TEAM_2; j++) {
                mod.Wait(0.5).then(() =>
                    this.playerManager.spawnLogicalBot(
                        mod.SoldierClass.Assault,
                        2,
                        mod.GetObjectPosition(mod.GetHQ(2)),
                        mod.Message(`core.ai.bots.${this.AI_COUNT_TEAM_1 + j}`),
                        this.AI_UNSPAWN_DELAY
                    )
                )
            }
        })
    }

    protected override OnLogicalPlayerJoinGame(lp: CorePlayer_APlayer): void {
        // Set AI Brain
        if (lp.isLogicalAI()) {
            const brain = new CoreAI_Brain(
                lp.player,
                new CoreAI_CombatantProfile(
                    () => [],
                    () => this.getRoamWps(1000, 1010),
                    () => []
                )
            )

            lp.addComponent(new BrainComponent(brain))
        }

        if (!this.squadManager) {
            this.squadManager = new Core_SquadManager(this, 2)
        }

        this.squadManager.addToSquad(lp)
    }

    protected override OnPlayerLeaveGame(eventNumber: number): void {
        const lp = this.playerManager.getById(eventNumber)
        if (!lp) return

        // Respawn persistent bot
        if (lp.isLogicalAI()) {
            this.playerManager.respawnLogicalBot(
                lp,
                mod.GetObjectPosition(mod.GetHQ(lp.teamId)),
                this.AI_UNSPAWN_DELAY
            )
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

    private getRoamWps(from: number, to: number): mod.Vector[] {
        const out: mod.Vector[] = []

        for (let id = from; id <= to; id++) {
            const wp = mod.GetSpatialObject(id)
            out.push(mod.GetObjectPosition(wp))
        }

        return out
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
const gameMode: Core_AGameMode = new TDM_GameMode()

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

