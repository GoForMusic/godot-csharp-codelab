---
title: Event Bus
tag: Sys
sub: Implement a static C# Event Bus for global decoupled communication across unrelated systems — and know exactly when to use it instead of direct Godot signals.
---

## The Problem — Global Events

Godot signals work great for parent-child communication. But some events are truly global:

- Player dies → HUD, music manager, save system, achievement system all need to react
- Level complete → analytics, leaderboard, scene manager all respond
- Settings changed → audio, graphics, input all update

Connecting direct signals for these cases means every listener needs a reference to the emitter — creating cross-system coupling that's hard to untangle.

<svg width="480" height="175" viewBox="0 0 480 175" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="175" fill="#080806" rx="8"/>
  <defs>
    <marker id="eb25" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#f5c000"/>
    </marker>
    <marker id="eb25g" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#78786e"/>
    </marker>
  </defs>
  <!-- Emitter -->
  <rect x="10" y="68" width="110" height="40" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="2"/>
  <text x="65" y="86" fill="#f5c000" font-family="monospace" font-size="11" text-anchor="middle">PlayerHealth</text>
  <text x="65" y="100" fill="#78786e" font-family="monospace" font-size="9"  text-anchor="middle">emitter</text>
  <!-- Bus -->
  <rect x="168" y="55" width="144" height="66" rx="4" fill="#0f0f0c" stroke="#c8c8be" stroke-width="2"/>
  <text x="240" y="75" fill="#c8c8be" font-family="monospace" font-size="11" text-anchor="middle">EventBus</text>
  <text x="240" y="90" fill="#78786e" font-family="monospace" font-size="9"  text-anchor="middle">static class</text>
  <text x="240" y="104" fill="#3a3a32" font-family="monospace" font-size="8"  text-anchor="middle">PlayerDied event</text>
  <!-- Lines emitter → bus -->
  <line x1="120" y1="88" x2="168" y2="88" stroke="#f5c000" stroke-width="1.5" marker-end="url(#eb25)"/>
  <text x="144" y="82" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">Emit</text>
  <!-- Listeners -->
  <line x1="312" y1="72" x2="348" y2="55" stroke="#78786e" stroke-width="1.5" marker-end="url(#eb25g)"/>
  <line x1="312" y1="88" x2="348" y2="88" stroke="#78786e" stroke-width="1.5" marker-end="url(#eb25g)"/>
  <line x1="312" y1="104" x2="348" y2="121" stroke="#78786e" stroke-width="1.5" marker-end="url(#eb25g)"/>
  <rect x="348" y="30"  width="122" height="34" rx="4" fill="#0f0f0c" stroke="#78786e" stroke-width="1.5"/>
  <text x="409" y="52" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">HUD</text>
  <rect x="348" y="71"  width="122" height="34" rx="4" fill="#0f0f0c" stroke="#78786e" stroke-width="1.5"/>
  <text x="409" y="93" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">MusicManager</text>
  <rect x="348" y="112" width="122" height="34" rx="4" fill="#0f0f0c" stroke="#78786e" stroke-width="1.5"/>
  <text x="409" y="134" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">SaveSystem</text>
  <!-- Footer -->
  <text x="240" y="162" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">PlayerHealth never knows who listens — zero coupling to HUD, Music, or Save</text>
</svg>

## Static Event Bus

```csharp
// Scripts/Systems/EventBus.cs
using System;

/// <summary>
/// Global event bus. Subscribe in _Ready(), unsubscribe in _ExitTree().
/// </summary>
public static class EventBus
{
    // ── Player ─────────────────────────────────────────────────────────────
    public static event Action<float>?  PlayerHealthChanged;  // normalized 0..1
    public static event Action?         PlayerDied;
    public static event Action<int>?    ScoreChanged;

    // ── Level ──────────────────────────────────────────────────────────────
    public static event Action<string>? LevelLoaded;          // scene path
    public static event Action?         LevelCompleted;

    // ── Combat ─────────────────────────────────────────────────────────────
    public static event Action<string, float>? EntityDamaged; // id, amount
    public static event Action<string>?        EntityDied;    // id

    // ── Items ──────────────────────────────────────────────────────────────
    public static event Action<string, int>?   ItemPickedUp;  // id, qty
    public static event Action<string>?        ItemUsed;

    // ── Settings ───────────────────────────────────────────────────────────
    public static event Action<float>? MasterVolumeChanged;

    // ── Emitters (call these to fire; null-safe with ?.Invoke) ─────────────
    public static void EmitPlayerHealthChanged(float pct)
        => PlayerHealthChanged?.Invoke(pct);

    public static void EmitPlayerDied()
        => PlayerDied?.Invoke();

    public static void EmitScoreChanged(int score)
        => ScoreChanged?.Invoke(score);

    public static void EmitEntityDamaged(string id, float dmg)
        => EntityDamaged?.Invoke(id, dmg);

    public static void EmitEntityDied(string id)
        => EntityDied?.Invoke(id);

    public static void EmitItemPickedUp(string id, int qty)
        => ItemPickedUp?.Invoke(id, qty);
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Static class vs Node Autoload</strong> — A <code>static</code> class works perfectly for a pure C# event bus. No scene-tree overhead. If you need GDScript to fire or receive events too, use a <code>Node</code> Autoload with <code>[Signal]</code> declarations instead.</div>
</div>

## Subscribing and Unsubscribing

Always subscribe in `_Ready()` and **always** unsubscribe in `_ExitTree()`. Forgetting to unsubscribe is the most common memory leak in Godot C#:

```csharp
// HUD.cs
public partial class HUD : CanvasLayer
{
    [Export] public ProgressBar HealthBar;
    [Export] public Label       ScoreLabel;

    public override void _Ready()
    {
        EventBus.PlayerHealthChanged += OnHealthChanged;
        EventBus.ScoreChanged        += OnScoreChanged;
        EventBus.PlayerDied          += OnPlayerDied;
    }

    public override void _ExitTree()
    {
        // Critical — prevents callbacks on a freed node
        EventBus.PlayerHealthChanged -= OnHealthChanged;
        EventBus.ScoreChanged        -= OnScoreChanged;
        EventBus.PlayerDied          -= OnPlayerDied;
    }

    private void OnHealthChanged(float pct)
        => HealthBar.Value = pct * HealthBar.MaxValue;

    private void OnScoreChanged(int score)
        => ScoreLabel.Text = $"Score: {score:N0}";

    private void OnPlayerDied()
        => GetNode<Control>("GameOverPanel").Visible = true;
}
```

## Emitting from Game Logic

```csharp
// PlayerHealth.cs — fires events without knowing who listens
public partial class PlayerHealth : Node
{
    [Export] public float MaxHealth = 100f;
    private float _current;

    public override void _Ready() => _current = MaxHealth;

    public void TakeDamage(float amount)
    {
        _current = Mathf.Max(0f, _current - amount);
        EventBus.EmitPlayerHealthChanged(_current / MaxHealth);

        if (_current <= 0f)
            EventBus.EmitPlayerDied();
    }
}
```

```csharp
// ScoreSystem.cs
public partial class ScoreSystem : Node
{
    private int _score = 0;

    public void Add(int points)
    {
        _score += points;
        EventBus.EmitScoreChanged(_score);
    }
}
```

## Event Bus vs Direct Signals

<div class="grid2">
  <div class="card"><div class="card-title">Direct Signals</div><p class="card-desc">Emitter and listener are in the <strong>same scene or have a clear relationship</strong>. Enemy → CombatSystem. Pickup → Inventory. Button → Panel. The emitter knows (or can easily reference) its listener.</p></div>
  <div class="card"><div class="card-title">Event Bus</div><p class="card-desc">Event is <strong>global and cross-cutting</strong>. PlayerDied → HUD + Music + Save + Achievement. The emitter has no business knowing about any of its listeners.</p></div>
</div>

```csharp
// Rule of thumb:
// Does the emitter know (or care) who listens?
//   YES — direct signal / method call
//   NO  — event bus
```

## Typed Event Payloads

For complex events, use a `record struct` payload to avoid a long parameter list:

```csharp
// Typed payload structs
public readonly record struct DamageEvent(
    string  SourceId,
    string  TargetId,
    float   Amount,
    bool    WasCritical);

public readonly record struct LootEvent(
    string  ItemId,
    int     Quantity,
    string  CollectorId);

// Add typed events to EventBus
public static class EventBus
{
    public static event Action<DamageEvent>? DamageDealt;
    public static event Action<LootEvent>?   LootCollected;

    public static void EmitDamage(DamageEvent e) => DamageDealt?.Invoke(e);
    public static void EmitLoot(LootEvent e)     => LootCollected?.Invoke(e);
}

// Usage
EventBus.EmitDamage(new DamageEvent("player", "goblin_01", 25f, true));
EventBus.EmitLoot(new LootEvent("sword_iron", 1, "player"));
```

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>Don't overuse the Event Bus</strong> — If every interaction goes through the bus, tracing data flow becomes a nightmare. Reserve it for truly global concerns. Localized communication should use direct signals or method calls — they're clearer and easier to debug.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">A PlayerDied event needs to trigger the HUD, music manager, save system, and analytics — all in unrelated parts of the scene tree. What is the most appropriate approach?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q25')"><span class="quiz-key">A</span> Direct signals from PlayerHealth to each system with exported NodePath references</div>
    <div class="quiz-o" onclick="qz(this,false,'q25')"><span class="quiz-key">B</span> A GameManager that holds references to all 4 systems and calls them directly</div>
    <div class="quiz-o" onclick="qz(this,true,'q25')"><span class="quiz-key">C</span> An Event Bus — PlayerHealth emits once, each system subscribes independently</div>
    <div class="quiz-o" onclick="qz(this,false,'q25')"><span class="quiz-key">D</span> Static method calls on each manager class</div>
  </div>
  <div class="quiz-fb" id="q25"></div>
</div>
