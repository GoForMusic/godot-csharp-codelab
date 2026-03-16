---
title: Interfaces & Systems
tag: SOLID
sub: Define interface contracts for game services, implement application-layer systems that orchestrate domain logic, and inject dependencies without coupling to Godot.
---

## Why Interfaces?

An interface is a contract. It says: "any class that implements me guarantees these methods exist." The consumer of the interface doesn't care about the implementation — it could be the real audio system, a silent no-op for testing, or a completely different audio library.

Without interfaces, every change to an implementation forces changes to every consumer. With interfaces, you swap implementations freely:

```csharp
// Without interface — tightly coupled
public class CombatSystem
{
    private GodotAudioPlayer _audio; // cannot swap, cannot mock
}

// With interface — loosely coupled
public class CombatSystem
{
    private readonly IAudioService _audio; // any implementation works
}
```

## Defining Interface Contracts

Place interfaces in `Scripts/Domain/Interfaces/` — they belong to the inner layers and define what the domain needs from the outside world.

```csharp
// Scripts/Domain/Interfaces/IAudioService.cs
public interface IAudioService
{
    void PlaySfx(string eventName);
    void PlayMusic(string trackName, float fadeIn = 0f);
    void StopMusic(float fadeOut = 0f);
    void SetBusVolume(string bus, float normalizedVolume);
}

// Scripts/Domain/Interfaces/ISaveRepository.cs
public interface ISaveRepository
{
    void   Save(SaveData data);
    SaveData? Load();
    bool   HasSave();
    void   Delete();
}

// Scripts/Domain/Interfaces/IInputProvider.cs
public interface IInputProvider
{
    System.Numerics.Vector2 GetMoveInput();
    bool IsJumpPressed();
    bool IsAttackPressed();
    bool IsInteractPressed();
    System.Numerics.Vector2 GetLookInput();
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Interface segregation principle</strong> — Keep interfaces small and focused (the "I" in SOLID). A consumer that only needs <code>PlaySfx()</code> should not be forced to implement <code>PlayMusic()</code> and <code>StopMusic()</code>. Split large interfaces into smaller, role-specific ones.</div>
</div>

## Application Layer Systems

Systems live in the application layer. They orchestrate domain entities and call services through interfaces. They do not extend any Godot class.

```csharp
// Scripts/Application/CombatSystem.cs
using System;

public class CombatSystem
{
    private readonly IAudioService   _audio;
    private readonly IVfxService     _vfx;

    public event Action<CharacterStats, DamageResult>? DamageDealt;
    public event Action<CharacterStats>?               CharacterDied;

    public CombatSystem(IAudioService audio, IVfxService vfx)
    {
        _audio = audio;
        _vfx   = vfx;
    }

    public DamageResult Attack(CharacterStats attacker,
                               CharacterStats target,
                               AttackData     attackData)
    {
        // Domain logic — no Godot here
        float rawDamage = attacker.AttackPower * attackData.Multiplier;
        var   result    = target.TakeDamage(rawDamage);

        // Notify services
        _audio.PlaySfx(result.MitigatedDamage > rawDamage * 0.5f
            ? "hit_blocked" : "hit_flesh");
        _vfx.SpawnHitEffect(attackData.ContactPoint, result);

        // Raise events for listeners (HUD, score, etc.)
        DamageDealt?.Invoke(target, result);

        if (result.KilledTarget)
            CharacterDied?.Invoke(target);

        return result;
    }
}
```

```csharp
// Scripts/Application/InventorySystem.cs
public class InventorySystem
{
    private readonly Inventory       _inventory;
    private readonly IAudioService   _audio;

    public event Action<string, int>? ItemPickedUp;
    public event Action<string>?      InventoryFull;

    public InventorySystem(Inventory inventory, IAudioService audio)
    {
        _inventory = inventory;
        _audio     = audio;

        // Forward inventory events
        _inventory.ItemAdded   += (id, qty) => ItemPickedUp?.Invoke(id, qty);
    }

    public bool TryPickUp(string itemId, int quantity = 1)
    {
        bool success = _inventory.TryAdd(itemId, quantity);

        if (success)
            _audio.PlaySfx("pickup");
        else
            InventoryFull?.Invoke(itemId);

        return success;
    }

    public bool TryUseItem(string itemId)
    {
        if (!_inventory.Has(itemId)) return false;

        bool removed = _inventory.TryRemove(itemId);
        if (removed)
            _audio.PlaySfx("use_item");

        return removed;
    }
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Systems raise events; they don't call UI directly</strong> — <code>CombatSystem</code> raises <code>DamageDealt</code> — it doesn't know whether a HUD exists. The adapter layer listens to this event and updates the ProgressBar. This keeps your systems reusable across different UI configurations.</div>
</div>

## Dependency Injection Without a Framework

You don't need a DI container for Godot games. Manual constructor injection is clear and explicit:

```csharp
// Scripts/Adapters/GameBootstrapper.cs
// This Godot Autoload assembles the entire dependency graph once
public partial class GameBootstrapper : Node
{
    public static GameBootstrapper Instance { get; private set; }

    // Public accessors for systems
    public CombatSystem    Combat    { get; private set; }
    public InventorySystem Inventory { get; private set; }

    public override void _Ready()
    {
        Instance = this;

        // Build concrete implementations
        var audio = new GodotAudioService(
            GetNode<SfxManager>("/root/SfxManager"),
            GetNode<MusicManager>("/root/MusicManager"));

        var vfx = new GodotVfxService(
            GetNode<VFXManager>("/root/VFXManager"));

        var save = new JsonSaveRepository();

        // Wire domain objects
        var playerStats = new CharacterStats("player", "Hero", maxHealth: 100f);
        var inventory   = new Inventory("player", maxSlots: 24);

        // Assemble systems
        Combat    = new CombatSystem(audio, vfx);
        Inventory = new InventorySystem(inventory, audio);
    }
}
```

```csharp
// Access systems from any adapter node
var combat = GameBootstrapper.Instance.Combat;
var result = combat.Attack(playerStats, enemyStats, attackData);
```

## The IVfxService and IInputProvider Implementations

Interfaces enable swapping entire subsystems. Here are two concrete Godot implementations:

```csharp
// Scripts/Adapters/GodotInputProvider.cs
using Godot;

public class GodotInputProvider : IInputProvider
{
    public System.Numerics.Vector2 GetMoveInput()
    {
        var v = Input.GetVector("move_left","move_right","move_forward","move_back");
        return new System.Numerics.Vector2(v.X, v.Y);
    }

    public bool IsJumpPressed()   => Input.IsActionJustPressed("jump");
    public bool IsAttackPressed() => Input.IsActionJustPressed("attack");
    public bool IsInteractPressed() => Input.IsActionJustPressed("interact");

    public System.Numerics.Vector2 GetLookInput()
        => System.Numerics.Vector2.Zero; // populated by mouse delta in real impl
}
```

```csharp
// Tests/Fakes/FakeInputProvider.cs — for testing, no Godot needed
public class FakeInputProvider : IInputProvider
{
    public System.Numerics.Vector2 MoveDirection { get; set; }
    public bool JumpPressed   { get; set; }
    public bool AttackPressed { get; set; }
    public bool InteractPressed { get; set; }

    public System.Numerics.Vector2 GetMoveInput()    => MoveDirection;
    public bool IsJumpPressed()   => JumpPressed;
    public bool IsAttackPressed() => AttackPressed;
    public bool IsInteractPressed() => InteractPressed;
    public System.Numerics.Vector2 GetLookInput() => System.Numerics.Vector2.Zero;
}
```

Testing the movement system now requires no Godot:

```csharp
[Fact]
public void PlayerMovesInInputDirection()
{
    var input   = new FakeInputProvider { MoveDirection = new(1f, 0f) };
    var stats   = new CharacterStats("p", "Hero", 100f);
    var mover   = new MovementSystem(stats, input);

    mover.Update(deltaTime: 0.016f);

    Assert.True(mover.Velocity.X > 0f);
}
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Following the Interface Segregation Principle, if a class only needs to play sound effects, which interface should it depend on?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q19')"><span class="quiz-key">A</span> A single IAudioService with all audio methods</div>
    <div class="quiz-o" onclick="qz(this,true,'q19')"><span class="quiz-key">B</span> A small ISfxPlayer interface with only the PlaySfx method</div>
    <div class="quiz-o" onclick="qz(this,false,'q19')"><span class="quiz-key">C</span> The concrete GodotAudioService class directly</div>
    <div class="quiz-o" onclick="qz(this,false,'q19')"><span class="quiz-key">D</span> No interface — use static methods for audio</div>
  </div>
  <div class="quiz-fb" id="q19"></div>
</div>
