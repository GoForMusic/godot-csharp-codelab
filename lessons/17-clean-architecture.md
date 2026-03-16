---
title: Why Clean Architecture?
tag: SOLID
sub: Understand the problems that grow from tightly coupled Godot code and how separating domain logic from engine nodes makes games testable and maintainable.
---

## The Problem With "Godot-First" Code

Most Godot tutorials show a single script per node that does everything: reads input, updates physics, plays sounds, modifies the HUD, and saves data — all in `_PhysicsProcess`. This works for small prototypes, but as the project grows it becomes a maintainability trap.

Consider a typical "PlayerController" that has grown over time:

```csharp
// The kind of class that emerges organically — 600 lines, does everything
public partial class PlayerController : CharacterBody3D
{
    // Physics
    [Export] public float Speed = 5f;
    // Sound
    [Export] public AudioStreamPlayer3D FootstepSound;
    // UI
    [Export] public ProgressBar HealthBar;
    [Export] public Label       ScoreLabel;
    // Save
    private SaveData _save;

    private float _health = 100f;
    private int   _score  = 0;

    public override void _PhysicsProcess(double delta)
    {
        // movement logic
        // sound logic: if IsOnFloor() && velocity.Length() > 0.5 → FootstepSound.Play()
        // UI update: HealthBar.Value = _health; ScoreLabel.Text = _score.ToString();
        // save logic: if Input.IsActionJustPressed("save") → SaveGame();
        // enemy interaction: if touching enemy → TakeDamage();
        // item interaction: foreach item in area → Collect(item);
    }
}
```

Problems this causes:
- **Untestable** — you can't run `_PhysicsProcess` in a unit test without a full Godot scene
- **Fragile** — changing the HUD layout breaks the player controller
- **Unreusable** — health logic is buried in a CharacterBody3D; enemies can't share it
- **Slow to compile** — every small change recompiles the entire class

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>God objects accumulate silently</strong> — No one writes a 600-line class on day one. It grows one feature at a time, each addition seeming small and reasonable. Recognizing this pattern early is the first step to preventing it.</div>
</div>

## Clean Architecture in a Nutshell

Clean Architecture (Robert C. Martin) organizes code into concentric layers, with a strict dependency rule: **inner layers know nothing about outer layers**.

<svg width="480" height="320" viewBox="0 0 480 320" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="320" fill="#0a0c12" rx="8"/>
  <!-- Outer ring: Infrastructure/Godot -->
  <circle cx="240" cy="160" r="140" fill="none" stroke="#3d8ef0" stroke-width="2"/>
  <text x="240" y="42" fill="#3d8ef0" font-family="monospace" font-size="13" text-anchor="middle">Infrastructure / Godot Nodes</text>
  <!-- Application ring -->
  <circle cx="240" cy="160" r="100" fill="none" stroke="#00e5c0" stroke-width="2"/>
  <text x="240" y="80" fill="#00e5c0" font-family="monospace" font-size="12" text-anchor="middle">Application / Systems</text>
  <!-- Domain ring -->
  <circle cx="240" cy="160" r="60" fill="none" stroke="#e8edf8" stroke-width="2"/>
  <text x="240" y="148" fill="#e8edf8" font-family="monospace" font-size="12" text-anchor="middle">Domain</text>
  <text x="240" y="168" fill="#8892aa" font-family="monospace" font-size="11" text-anchor="middle">Entities &amp; Rules</text>
  <!-- Arrows pointing inward -->
  <text x="240" y="240" fill="#8892aa" font-family="monospace" font-size="11" text-anchor="middle">↑ Dependencies point inward only ↑</text>
  <!-- Labels -->
  <text x="350" y="110" fill="#3d8ef0" font-family="monospace" font-size="10" text-anchor="middle">CharacterBody3D</text>
  <text x="350" y="125" fill="#3d8ef0" font-family="monospace" font-size="10" text-anchor="middle">AnimationPlayer</text>
  <text x="350" y="140" fill="#3d8ef0" font-family="monospace" font-size="10" text-anchor="middle">AudioStreamPlayer</text>
  <text x="110" y="200" fill="#00e5c0" font-family="monospace" font-size="10" text-anchor="middle">ICombatSystem</text>
  <text x="110" y="215" fill="#00e5c0" font-family="monospace" font-size="10" text-anchor="middle">IInventorySystem</text>
</svg>

The layers:

1. **Domain** — Plain C# classes: `PlayerStats`, `InventoryItem`, `DamageResult`. No Godot imports. Fully testable with `dotnet test`.
2. **Application / Systems** — Use-case logic operating on domain objects through interfaces: `CombatSystem.Attack(attacker, target)`.
3. **Infrastructure / Adapters** — Thin Godot nodes that translate between Godot events (physics, signals) and domain calls.

## The Dependency Inversion Principle

The "D" in SOLID. High-level modules should not depend on low-level modules — both should depend on abstractions.

**Without DIP (concrete dependency):**

```csharp
// Bad — CombatSystem knows about Godot's audio system
public class CombatSystem
{
    private AudioStreamPlayer3D _sfx; // Godot dependency!

    public void Attack(Enemy target, float damage)
    {
        target.Health -= damage;
        _sfx.Play(); // cannot test without a real AudioStreamPlayer3D
    }
}
```

**With DIP (depend on abstraction):**

```csharp
// Good — CombatSystem depends on an interface it doesn't implement
public interface IAudioService
{
    void PlaySfx(string eventName);
}

public class CombatSystem
{
    private readonly IAudioService _audio;

    public CombatSystem(IAudioService audio)
    {
        _audio = audio;
    }

    public DamageResult Attack(ICharacter attacker, ICharacter target, float damage)
    {
        var result = new DamageResult(damage, target.Health - damage);
        _audio.PlaySfx("hit");
        return result;
    }
}
```

Now `CombatSystem` can be tested by injecting a fake `IAudioService` that does nothing — no Godot required.

## What Changes in Practice

Adopting clean architecture in a Godot project means:

<div class="grid2">
  <div class="card"><div class="card-title">Before</div><p class="card-desc">One big CharacterBody3D script that directly mutates health, plays sounds, updates the HUD, and writes save files. All tightly coupled to Godot.</p></div>
  <div class="card"><div class="card-title">After</div><p class="card-desc">A thin Godot node that receives input and delegates to a <code>PlayerDomain</code> object. The domain object has no Godot imports — pure C# logic that runs in unit tests.</p></div>
</div>

The remaining lessons in this section build each layer:
- **Lesson 18** — Domain entities and value objects
- **Lesson 19** — Interfaces and system classes
- **Lesson 20** — Generic state machine (domain layer)
- **Lesson 21** — Godot adapter nodes (infrastructure layer)
- **Lesson 22** — Thin node wiring — the final assembly

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>You don't have to go all-in at once</strong> — Start by extracting one domain object (like <code>PlayerHealth</code>) from one bloated script. Clean architecture is a direction, not a destination. Each extracted class is an improvement.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">According to the Dependency Inversion Principle, which layer should define the interfaces (abstractions)?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q17')"><span class="quiz-key">A</span> The infrastructure layer (Godot nodes)</div>
    <div class="quiz-o" onclick="qz(this,false,'q17')"><span class="quiz-key">B</span> The test layer</div>
    <div class="quiz-o" onclick="qz(this,true,'q17')"><span class="quiz-key">C</span> The domain or application layer that consumes the abstraction</div>
    <div class="quiz-o" onclick="qz(this,false,'q17')"><span class="quiz-key">D</span> The highest-level layer (game manager)</div>
  </div>
  <div class="quiz-fb" id="q17"></div>
</div>
