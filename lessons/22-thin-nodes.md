---
title: Thin Nodes & Wiring
tag: SOLID
sub: Assemble the entire clean architecture — build thin Godot nodes that own no logic, wire domain objects to engine events, and see the complete layered system in action.
---

## What Is a Thin Node?

A **thin node** is a Godot node script whose only job is to:
1. Receive Godot events (physics frame, input, signal)
2. Translate them into domain calls
3. Listen to domain events and update Godot state (visuals, audio)

It contains **no game logic**. No health calculations. No damage formulas. No AI decisions. All of that lives in the domain and application layers.

```csharp
// FAT node — bad
public partial class Player : CharacterBody3D
{
    private float _health = 100f;

    public override void _PhysicsProcess(double delta)
    {
        // input reading, movement, gravity, jump, sound, animation,
        // health check, death, HUD update, save trigger — all here
    }
}

// THIN node — good
public partial class PlayerNode : CharacterBody3D
{
    private PlayerBrain   _brain;   // domain
    private PlayerAnimator _anim;   // domain (no Godot)

    public override void _PhysicsProcess(double delta)
    {
        _brain.Update((float)delta);
        Velocity = _brain.GetGodotVelocity();
        MoveAndSlide();
        _brain.SetGrounded(IsOnFloor());
    }
}
```

## Full Bootstrapper — Wiring Everything Together

The Bootstrapper (an Autoload) builds the complete object graph once at startup:

```csharp
// Scripts/Adapters/GameBootstrapper.cs
using Godot;

public partial class GameBootstrapper : Node
{
    public static GameBootstrapper Instance { get; private set; }

    // Expose assembled systems for adapter nodes to use
    public CombatSystem    Combat       { get; private set; }
    public InventorySystem Inventory    { get; private set; }
    public ISaveRepository SaveRepo     { get; private set; }
    public IAudioService   Audio        { get; private set; }
    public IVfxService     Vfx         { get; private set; }

    public override void _Ready()
    {
        Instance = this;

        // --- Build Godot adapter implementations ---
        var sfx   = GetNode<SfxManager>("/root/SfxManager");
        var music = GetNode<MusicManager>("/root/MusicManager");
        var vfxMgr= GetNode<VFXManager>("/root/VFXManager");

        Audio   = new GodotAudioService(sfx, music);
        Vfx     = new GodotVfxService(vfxMgr);
        SaveRepo= new GodotSaveRepository();

        // --- Assemble application systems ---
        Combat    = new CombatSystem(Audio, Vfx);
        Inventory = new InventorySystem(new Inventory("player"), Audio);

        // --- Wire cross-system events ---
        Combat.CharacterDied += OnCharacterDied;

        GD.Print("GameBootstrapper: all systems online");
    }

    private void OnCharacterDied(CharacterStats stats)
    {
        if (stats.Id == "player")
        {
            Audio.PlayMusic("game_over", fadeIn: 1f);
            GetTree().Paused = true;
        }
    }
}
```

## Thin Player Node

```csharp
// Scripts/Adapters/PlayerNode.cs
using Godot;

public partial class PlayerNode : CharacterBody3D
{
    [Export] public AnimationTree AnimTree;
    [Export] public AudioStreamPlayer3D FootstepPlayer;

    private PlayerBrain           _brain;
    private PlayerStats           _stats;
    private GodotInputProvider    _input;
    private AnimationNodeStateMachinePlayback _animSm;

    public override void _Ready()
    {
        var boot = GameBootstrapper.Instance;

        // Build domain objects
        _stats = new PlayerStats("player", "Hero", maxHealth: 100f, speed: 5f);
        _input = new GodotInputProvider();
        _brain = new PlayerBrain(_stats, _input, boot.Combat, boot.Inventory);

        // Wire domain events to Godot visuals
        _brain.Jumped      += PlayJumpAnimation;
        _brain.Landed      += PlayLandAnimation;
        _stats.HealthChanged += OnHealthChanged;

        // Cache AnimationTree playback
        _animSm = (AnimationNodeStateMachinePlayback)
            AnimTree.Get("parameters/playback");

        AnimTree.Active = true;

        // Register with nav provider if this node has one
        // (enemies do; player may not need it)
    }

    public override void _PhysicsProcess(double delta)
    {
        // Feed Godot physics state into domain
        _brain.SetGrounded(IsOnFloor());
        _brain.SetGlobalPosition(
            new System.Numerics.Vector3(
                GlobalPosition.X,
                GlobalPosition.Y,
                GlobalPosition.Z));

        // Run domain update
        _brain.Update((float)delta);

        // Apply domain velocity to Godot
        var dv = _brain.Velocity;
        Velocity = new Vector3(dv.X, dv.Y, dv.Z);
        MoveAndSlide();

        // Update animations from domain state
        float speed = new Vector2(Velocity.X, Velocity.Z).Length();
        AnimTree.Set("parameters/locomotion/blend_amount", speed / _stats.Speed);
        AnimTree.Set("parameters/conditions/airborne", !IsOnFloor());
    }

    private void PlayJumpAnimation()
        => _animSm.Travel("jump_start");

    private void PlayLandAnimation()
        => _animSm.Travel("jump_land");

    private void OnHealthChanged(float current, float max)
    {
        // Forward to HUD via signal or direct reference
        GetNode<HUD>("/root/World/HUD").SetHealth(current, max);
    }
}
```

## Thin Enemy Node

```csharp
// Scripts/Adapters/EnemyNode.cs
using Godot;

public partial class EnemyNode : CharacterBody3D
{
    [Export] public float DetectRange = 12f;
    [Export] public float AttackRange = 2f;

    private EnemyBrain              _brain;
    private GodotNavigationProvider _nav;
    private Node3D                  _player;

    public override void _Ready()
    {
        var boot = GameBootstrapper.Instance;

        // Register this node's NavigationAgent3D with the nav provider
        _nav = new GodotNavigationProvider();
        var agent = GetNode<NavigationAgent3D>("NavigationAgent3D");
        _nav.Register(Name, agent);

        // Build domain objects
        var stats = new CharacterStats(Name, "Grunt", maxHealth: 50f);
        var ctx   = new EnemyContext(stats, _nav, boot.Audio)
        {
            DetectRange = DetectRange,
            AttackRange = AttackRange
        };

        _brain = new EnemyBrain(ctx);
        _brain.Attacked += OnBrainAttack;

        _player = GetNode<Node3D>("/root/World/Player");
    }

    public override void _PhysicsProcess(double delta)
    {
        // Feed perception data into domain
        float dist = GlobalPosition.DistanceTo(_player.GlobalPosition);
        _brain.SetTargetDistance(dist);
        _brain.SetLineOfSight(CheckLOS());

        // Set nav target
        var pp = _player.GlobalPosition;
        _brain.SetTarget(new System.Numerics.Vector3(pp.X, pp.Y, pp.Z));

        // Update domain
        _brain.Update((float)delta);

        // Apply velocity
        var dv = _brain.Velocity;
        Velocity = new Vector3(dv.X, dv.Y, dv.Z);
        MoveAndSlide();
    }

    private bool CheckLOS()
    {
        var ray = GetNode<RayCast3D>("RayCast3D");
        ray.TargetPosition = ray.ToLocal(
            _player.GlobalPosition + Vector3.Up);
        ray.ForceRaycastUpdate();
        return !ray.IsColliding() || ray.GetCollider() == _player;
    }

    private void OnBrainAttack()
    {
        // Translate domain attack event to a Godot hitbox check
        var area = GetNode<Area3D>("AttackArea");
        foreach (var body in area.GetOverlappingBodies())
        {
            if (body is PlayerNode playerNode)
            {
                // Use the combat system — domain handles damage
                GameBootstrapper.Instance.Combat.Attack(
                    _brain.Context.Stats,
                    GameBootstrapper.Instance.PlayerStats,
                    new AttackData(multiplier: 1f,
                        contactPoint: new System.Numerics.Vector3(
                            body.GlobalPosition.X,
                            body.GlobalPosition.Y,
                            body.GlobalPosition.Z)));
            }
        }
    }
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>The thin node rule</strong> — If you find yourself writing an <code>if</code> statement that evaluates game state inside a Godot node script, ask: does this belong in the domain? Almost always the answer is yes. The node should only translate events, not decide outcomes.</div>
</div>

## The Layered System at a Glance

<svg width="480" height="215" viewBox="0 0 480 215" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="215" fill="#080806" rx="8"/>
  <defs>
    <marker id="tw22d" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#f5c000"/>
    </marker>
    <marker id="tw22u" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#78786e"/>
    </marker>
  </defs>
  <!-- Layer 1: Thin Nodes -->
  <rect x="10" y="10" width="460" height="38" rx="5" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="240" y="26" fill="#f5c000" font-family="monospace" font-size="10" text-anchor="middle">Thin Nodes  (Godot infrastructure)</text>
  <text x="240" y="40" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">PlayerNode · EnemyNode · GameBootstrapper — translate Godot events → domain calls</text>
  <!-- arrows -->
  <line x1="120" y1="48" x2="120" y2="65" stroke="#f5c000" stroke-width="1.5" marker-end="url(#tw22d)"/>
  <line x1="360" y1="65" x2="360" y2="48" stroke="#78786e" stroke-width="1.5" marker-end="url(#tw22u)"/>
  <text x="140" y="60" fill="#3a3a32" font-family="monospace" font-size="8">calls</text>
  <text x="375" y="60" fill="#3a3a32" font-family="monospace" font-size="8">output</text>
  <!-- Layer 2: Domain -->
  <rect x="10" y="65" width="460" height="38" rx="5" fill="#0f0f0c" stroke="#c8c8be" stroke-width="1.5"/>
  <text x="240" y="81" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">Domain Brains + Systems  (application)</text>
  <text x="240" y="96" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">PlayerBrain · EnemyBrain · CombatSystem · InventorySystem — pure C#, zero Godot</text>
  <!-- arrows -->
  <line x1="120" y1="103" x2="120" y2="122" stroke="#f5c000" stroke-width="1.5" marker-end="url(#tw22d)"/>
  <line x1="360" y1="122" x2="360" y2="103" stroke="#78786e" stroke-width="1.5" marker-end="url(#tw22u)"/>
  <text x="140" y="116" fill="#3a3a32" font-family="monospace" font-size="8">uses interfaces</text>
  <text x="375" y="116" fill="#3a3a32" font-family="monospace" font-size="8">implements</text>
  <!-- Layer 3: Interfaces -->
  <rect x="10" y="122" width="460" height="38" rx="5" fill="#0f0f0c" stroke="#78786e" stroke-width="1.5"/>
  <text x="240" y="138" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">Interfaces  (ports)</text>
  <text x="240" y="153" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">IAudioService · INavigationProvider · ISaveRepository · IVfxService</text>
  <!-- arrow -->
  <line x1="240" y1="160" x2="240" y2="178" stroke="#f5c000" stroke-width="1.5" marker-end="url(#tw22d)"/>
  <text x="255" y="173" fill="#3a3a32" font-family="monospace" font-size="8">implemented by</text>
  <!-- Layer 4: Adapters -->
  <rect x="10" y="178" width="460" height="28" rx="5" fill="#0f0f0c" stroke="#3a3a32" stroke-width="1.5"/>
  <text x="240" y="197" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">Godot Adapters  →  GodotAudioService · GodotNavigationProvider · GodotSaveRepository</text>
</svg>

<div class="grid2">
  <div class="card"><div class="card-title">Domain Layer</div><p class="card-desc"><code>CharacterStats</code>, <code>Inventory</code>, <code>DamageResult</code>, <code>EnemyBrain</code>, <code>PlayerBrain</code>, <code>StateMachine&lt;T&gt;</code> — zero Godot imports.</p></div>
  <div class="card"><div class="card-title">Application Layer</div><p class="card-desc"><code>CombatSystem</code>, <code>InventorySystem</code> — orchestrate domain objects, call services through interfaces.</p></div>
  <div class="card"><div class="card-title">Adapter Layer</div><p class="card-desc"><code>GodotAudioService</code>, <code>GodotNavigationProvider</code>, <code>GodotSaveRepository</code> — implement interfaces using Godot APIs.</p></div>
  <div class="card"><div class="card-title">Infrastructure (Thin Nodes)</div><p class="card-desc"><code>PlayerNode</code>, <code>EnemyNode</code>, <code>GameBootstrapper</code> — the entry points from Godot. Own no logic; delegate everything.</p></div>
</div>

## What You've Built

Starting from a single bloated `CharacterBody3D` and ending with a fully layered architecture:

- Domain entities run in `dotnet test` — no Godot needed
- Swap audio, navigation, or save systems by changing one constructor argument
- Add a new enemy type by creating a new `EnemyContext` + registering it — no existing code changes
- Unit test individual states, combat formulas, and inventory logic in isolation
- The Godot scene tree remains clean — thin nodes with clear single responsibilities

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>This architecture scales with your project</strong> — A solo developer can benefit from extractable, testable domain logic in a 10,000-line project. A team benefits even more: programmers work on domain logic without stepping on each other in scene files.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">A thin Godot node script receives a physics frame. What should it do with that event?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q22')"><span class="quiz-key">A</span> Run all game logic directly in _PhysicsProcess for performance</div>
    <div class="quiz-o" onclick="qz(this,false,'q22')"><span class="quiz-key">B</span> Check the game state and decide what animation to play</div>
    <div class="quiz-o" onclick="qz(this,true,'q22')"><span class="quiz-key">C</span> Feed relevant data into the domain brain, call Update(), then apply the brain's output back to Godot properties</div>
    <div class="quiz-o" onclick="qz(this,false,'q22')"><span class="quiz-key">D</span> Emit a signal and let autoloads handle all the logic</div>
  </div>
  <div class="quiz-fb" id="q22"></div>
</div>
