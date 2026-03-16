---
title: Signals & Events
tag: Sys
sub: Declare custom signals with the [Signal] attribute, emit and connect them in C#, and use signals to build decoupled communication between game systems.
---

## What Are Signals?

Signals are Godot's built-in observer pattern. They let one object announce that something happened — without knowing or caring who is listening. This is the cornerstone of decoupled game architecture.

Without signals, communication looks like this (tightly coupled):

```csharp
// BAD — Enemy reaches directly into HUD and score system
public partial class Enemy : CharacterBody3D
{
    public override void _Ready()
    {
        // Enemy now depends on HUD and ScoreSystem — hard to reuse
        var hud   = GetNode<HUD>("/root/World/HUD");
        var score = GetNode<ScoreSystem>("/root/World/ScoreSystem");
    }

    private void Die()
    {
        GetNode<HUD>("/root/World/HUD").ShowEnemyKilled();
        GetNode<ScoreSystem>("/root/World/ScoreSystem").Add(100);
        QueueFree();
    }
}
```

With signals, the enemy just announces `Died` — listeners handle the rest.

## Declaring Signals with [Signal]

```csharp
using Godot;

public partial class Enemy : CharacterBody3D
{
    // No-argument signal
    [Signal] public delegate void DiedEventHandler();

    // Signal with parameters — add them to the delegate signature
    [Signal] public delegate void DamageTakenEventHandler(float damage, Vector3 hitPoint);

    // Signal with a custom type
    [Signal] public delegate void DroppedLootEventHandler(string itemId, int quantity);
}
```

Godot's source generator reads the delegate name, strips `EventHandler`, and registers `Died`, `DamageTaken`, and `DroppedLoot` as Godot signals. They appear in the editor's Signals dock automatically.

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Delegate naming rule</strong> — The delegate name must end in <code>EventHandler</code>. The signal name in GDScript/the editor is the delegate name with <code>EventHandler</code> stripped. So <code>DamageTakenEventHandler</code> → signal <code>damage_taken</code> in GDScript, <code>DamageTaken</code> in C#.</div>
</div>

## Emitting Signals

Use `EmitSignal()` with the generated `SignalName` constant for type-safe emission:

```csharp
public partial class Enemy : CharacterBody3D
{
    [Signal] public delegate void DiedEventHandler();
    [Signal] public delegate void DamageTakenEventHandler(float damage, Vector3 hitPoint);

    private float _health = 50f;

    public void TakeDamage(float amount, Vector3 hitPoint)
    {
        _health -= amount;
        EmitSignal(SignalName.DamageTaken, amount, hitPoint);

        if (_health <= 0f)
        {
            EmitSignal(SignalName.Died);
            QueueFree();
        }
    }
}
```

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>Do not emit signals after QueueFree()</strong> — <code>QueueFree()</code> marks the node for deletion at the end of the frame. Any signal emitted after it may arrive at listeners while the sender is being destroyed. Emit first, then free.</div>
</div>

## Connecting Signals

There are three ways to connect signals in Godot C#:

**1. C# event syntax (preferred for same-scene connections):**

```csharp
public partial class ScoreSystem : Node
{
    [Export] public Enemy[] Enemies;

    public override void _Ready()
    {
        foreach (var enemy in Enemies)
        {
            enemy.Died          += OnEnemyDied;
            enemy.DamageTaken   += OnEnemyDamaged;
        }
    }

    private void OnEnemyDied()
    {
        AddScore(100);
    }

    private void OnEnemyDamaged(float damage, Vector3 hitPoint)
    {
        SpawnDamageNumber(damage, hitPoint);
    }
}
```

**2. Connect() method (useful for dynamic connections):**

```csharp
enemy.Connect(Enemy.SignalName.Died,
    Callable.From(OnEnemyDied));

// With flags — CONNECT_ONE_SHOT disconnects after first emission
enemy.Connect(Enemy.SignalName.Died,
    Callable.From(OnEnemyDied),
    (uint)ConnectFlags.OneShot);
```

**3. Editor Signals dock** — drag-and-drop connection, generates a method stub automatically.

## Disconnecting Signals

Always disconnect signals when a listener is about to be freed, to avoid callbacks firing on a dead object:

```csharp
public override void _ExitTree()
{
    // Clean up connections when this node leaves the scene
    foreach (var enemy in _trackedEnemies)
    {
        if (IsInstanceValid(enemy))
            enemy.Died -= OnEnemyDied;
    }
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>IsInstanceValid()</strong> — Always check this before accessing a node stored in a variable. If the node was freed by <code>QueueFree()</code>, the C# object reference still exists but points to a freed Godot object — calling methods on it will crash.</div>
</div>

## Custom Signal Parameters — Full Example

A complete event-driven pickup system:

```csharp
// Pickup.cs
public partial class Pickup : Area3D
{
    [Export] public string ItemId    = "coin";
    [Export] public int    Quantity  = 1;

    [Signal] public delegate void CollectedEventHandler(string itemId, int qty, Node3D collector);

    public override void _Ready()
    {
        BodyEntered += OnBodyEntered;
    }

    private void OnBodyEntered(Node3D body)
    {
        EmitSignal(SignalName.Collected, ItemId, Quantity, body);
        QueueFree();
    }
}
```

```csharp
// Inventory.cs — completely unaware of pickup scene structure
public partial class Inventory : Node
{
    private readonly Dictionary<string, int> _items = new();

    public void RegisterPickup(Pickup pickup)
    {
        pickup.Collected += OnItemCollected;
    }

    private void OnItemCollected(string itemId, int qty, Node3D collector)
    {
        _items.TryGetValue(itemId, out int current);
        _items[itemId] = current + qty;
        GD.Print($"Inventory: {itemId} x{_items[itemId]}");
    }
}
```

## Decoupled Communication Pattern

The golden rule: **emitters never depend on listeners**. Structure your signal flow like a tree:

```
Game Systems (emit signals up)
        ↑
   Game Events (signals)
        ↓
UI / Other Systems (listen and react)
```

Never let a low-level system (physics body, item, enemy) hold a reference to a high-level system (HUD, game manager). Use signals to invert the dependency.

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">What is the correct delegate name for a Godot signal you want to appear as <code>PlayerDied</code> in C#?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q7')"><span class="quiz-key">A</span> delegate void PlayerDied()</div>
    <div class="quiz-o" onclick="qz(this,false,'q7')"><span class="quiz-key">B</span> delegate void PlayerDiedSignal()</div>
    <div class="quiz-o" onclick="qz(this,true,'q7')"><span class="quiz-key">C</span> delegate void PlayerDiedEventHandler()</div>
    <div class="quiz-o" onclick="qz(this,false,'q7')"><span class="quiz-key">D</span> delegate void OnPlayerDied()</div>
  </div>
  <div class="quiz-fb" id="q7"></div>
</div>
