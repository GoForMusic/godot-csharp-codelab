---
title: Multiplayer
tag: Net
sub: Set up a peer-to-peer game with ENetMultiplayerPeer, use the [RPC] attribute for remote calls, and spawn networked players with MultiplayerSpawner.
---

## ENetMultiplayerPeer: Server and Client Setup

Godot 4's high-level multiplayer uses `ENetMultiplayerPeer` as the transport layer. One peer acts as server; others connect as clients.

```csharp
using Godot;

public partial class NetworkManager : Node
{
    public static NetworkManager Instance { get; private set; }

    private const int Port       = 7777;
    private const int MaxPlayers = 8;

    public override void _Ready()
    {
        Instance = this;

        // Connect multiplayer signals
        Multiplayer.PeerConnected    += OnPeerConnected;
        Multiplayer.PeerDisconnected += OnPeerDisconnected;
        Multiplayer.ConnectedToServer    += OnConnectedToServer;
        Multiplayer.ConnectionFailed     += OnConnectionFailed;
    }

    public Error HostGame()
    {
        var peer = new ENetMultiplayerPeer();
        var err  = peer.CreateServer(Port, MaxPlayers);
        if (err != Error.Ok)
        {
            GD.PrintErr($"Failed to host: {err}");
            return err;
        }
        Multiplayer.MultiplayerPeer = peer;
        GD.Print($"Server started on port {Port}");
        return Error.Ok;
    }

    public Error JoinGame(string address)
    {
        var peer = new ENetMultiplayerPeer();
        var err  = peer.CreateClient(address, Port);
        if (err != Error.Ok)
        {
            GD.PrintErr($"Failed to connect: {err}");
            return err;
        }
        Multiplayer.MultiplayerPeer = peer;
        GD.Print($"Connecting to {address}:{Port}...");
        return Error.Ok;
    }

    private void OnPeerConnected(long id)
        => GD.Print($"Peer connected: {id}");

    private void OnPeerDisconnected(long id)
        => GD.Print($"Peer disconnected: {id}");

    private void OnConnectedToServer()
        => GD.Print("Connected to server! My ID: " + Multiplayer.GetUniqueId());

    private void OnConnectionFailed()
        => GD.PrintErr("Connection failed.");
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Listen server vs dedicated server</strong> — <code>CreateServer()</code> makes the local peer both a server and a player (listen server). For a dedicated server, create the server peer without spawning a local player. The server always has ID 1; clients get IDs 2+.</div>
</div>

## [RPC] Attribute — Remote Procedure Calls

The `[RPC]` attribute marks a method that can be called on remote peers:

```csharp
public partial class Player : CharacterBody3D
{
    // AnyPeer — any connected peer can call this on us
    // Call Local — also executes on the caller's machine
    [Rpc(MultiplayerApi.RpcMode.AnyPeer, CallLocal = true,
         TransferMode = MultiplayerPeer.TransferModeEnum.Unreliable)]
    public void SyncPosition(Vector3 position, Vector3 velocity)
    {
        GlobalPosition = position;
        Velocity       = velocity;
    }

    // Reliable — guaranteed delivery, ordered (use for important events)
    [Rpc(MultiplayerApi.RpcMode.AnyPeer, CallLocal = true,
         TransferMode = MultiplayerPeer.TransferModeEnum.Reliable)]
    public void TakeDamageRpc(float amount, long attackerId)
    {
        if (!IsMultiplayerAuthority()) return;
        Health -= amount;
    }

    // Authority — only the server can call this
    [Rpc(MultiplayerApi.RpcMode.Authority)]
    public void ForceRespawn(Vector3 spawnPoint)
    {
        GlobalPosition = spawnPoint;
        Health = MaxHealth;
    }
}
```

Calling an RPC:

```csharp
// Call on all peers (broadcast)
Rpc(nameof(SyncPosition), GlobalPosition, Velocity);

// Call on a specific peer by ID
RpcId(targetPeerId, nameof(TakeDamageRpc), 25f, Multiplayer.GetUniqueId());

// Call only on the server (ID 1)
RpcId(1, nameof(ForceRespawn), spawnPos);
```

## SceneMultiplayer + MultiplayerSpawner

`MultiplayerSpawner` automatically spawns objects on all clients when the server creates them:

```csharp
// LobbyManager.cs — runs on server only
public partial class LobbyManager : Node
{
    [Export] public PackedScene  PlayerScene;
    [Export] public MultiplayerSpawner Spawner;
    [Export] public Node         SpawnParent; // where players are added

    public override void _Ready()
    {
        if (!Multiplayer.IsServer()) return;

        Multiplayer.PeerConnected += SpawnPlayerForPeer;

        // Spawn server's own player
        SpawnPlayerForPeer(1);
    }

    private void SpawnPlayerForPeer(long peerId)
    {
        var player = PlayerScene.Instantiate<Player>();
        player.Name = peerId.ToString(); // IMPORTANT: name must match peer ID

        // MultiplayerSpawner uses this name to set authority
        SpawnParent.AddChild(player);
        player.SetMultiplayerAuthority((int)peerId);
        player.GlobalPosition = GetSpawnPoint(peerId);
    }

    private Vector3 GetSpawnPoint(long peerId)
    {
        // Distribute spawn points
        int index = (int)(peerId - 1) % SpawnPoints.Length;
        return SpawnPoints[index].GlobalPosition;
    }
}
```

In the Inspector, configure `MultiplayerSpawner`:
- **Spawn Path**: `/root/World/Players` — where spawned nodes go
- **Auto Spawn List**: add your `Player.tscn` packed scene

## Authority Checks: IsMultiplayerAuthority()

Each node has a multiplayer authority — the peer that "owns" it and should run its authoritative logic. By default, nodes are owned by the server.

```csharp
public partial class Player : CharacterBody3D
{
    public override void _Ready()
    {
        // Only the owning client processes local input
        SetProcess(IsMultiplayerAuthority());
        SetPhysicsProcess(IsMultiplayerAuthority());

        if (!IsMultiplayerAuthority())
        {
            // Other clients show a "ghost" — interpolate received positions
            return;
        }

        // Local player setup: capture mouse, show HUD, etc.
        Input.SetMouseMode(Input.MouseModeEnum.Captured);
    }

    public override void _PhysicsProcess(double delta)
    {
        // This only runs on the authority (local client)
        var inputDir = Input.GetVector("move_left","move_right","move_forward","move_back");
        // ... process movement ...

        // Broadcast position to other peers
        Rpc(nameof(SyncPosition), GlobalPosition, Velocity);
    }
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Unreliable vs Reliable RPCs</strong> — Use <code>Unreliable</code> for position/rotation updates (sent every frame; lost packets are fine — next frame overwrites). Use <code>Reliable</code> for gameplay events (damage, item pickup, death) where missing a packet would break the game.</div>
</div>

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>Never trust clients</strong> — Validate all authority-sensitive RPCs on the server. A malicious client can call any <code>AnyPeer</code> RPC. For damage, health changes, and score, always perform the authoritative calculation on the server side.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">What does <code>SetMultiplayerAuthority(peerId)</code> control on a networked node?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q14')"><span class="quiz-key">A</span> Which peer can see the node in their scene tree</div>
    <div class="quiz-o" onclick="qz(this,true,'q14')"><span class="quiz-key">B</span> Which peer is considered the authoritative owner, affecting IsMultiplayerAuthority() and Authority-mode RPCs</div>
    <div class="quiz-o" onclick="qz(this,false,'q14')"><span class="quiz-key">C</span> Which peer sends physics simulation data</div>
    <div class="quiz-o" onclick="qz(this,false,'q14')"><span class="quiz-key">D</span> Which peer can call QueueFree() on the node</div>
  </div>
  <div class="quiz-fb" id="q14"></div>
</div>
