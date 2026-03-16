---
title: Domain Entities & Value Objects
tag: SOLID
sub: Model your game's core rules as plain C# classes with no Godot dependency — entities that own their invariants and value objects that represent immutable data.
---

<svg width="480" height="198" viewBox="0 0 480 198" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="198" fill="#080806" rx="8"/>
  <defs>
    <marker id="dm18m" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#78786e"/>
    </marker>
  </defs>
  <!-- CharacterStats (entity) -->
  <rect x="10" y="55" width="132" height="82" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="2"/>
  <text x="76" y="73" fill="#f5c000" font-family="monospace" font-size="10" text-anchor="middle">CharacterStats</text>
  <line x1="10" y1="79" x2="142" y2="79" stroke="#f5c000" stroke-width="1" opacity="0.3"/>
  <text x="76" y="92" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">Id, Name</text>
  <text x="76" y="104" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">Health, Armor</text>
  <text x="76" y="116" fill="#c8c8be" font-family="monospace" font-size="9" text-anchor="middle">TakeDamage()</text>
  <text x="76" y="128" fill="#c8c8be" font-family="monospace" font-size="9" text-anchor="middle">Heal()</text>
  <text x="76" y="148" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">«entity»</text>
  <!-- DamageResult (value object) -->
  <rect x="178" y="15" width="130" height="74" rx="4" fill="#0f0f0c" stroke="#78786e" stroke-width="1.5"/>
  <text x="243" y="33" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">DamageResult</text>
  <line x1="178" y1="39" x2="308" y2="39" stroke="#78786e" stroke-width="1" opacity="0.3"/>
  <text x="243" y="52" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">RawDamage</text>
  <text x="243" y="64" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">MitigatedDamage</text>
  <text x="243" y="76" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">KilledTarget</text>
  <text x="243" y="96" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">«value object»</text>
  <!-- Inventory (entity) -->
  <rect x="178" y="112" width="130" height="74" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="2"/>
  <text x="243" y="130" fill="#f5c000" font-family="monospace" font-size="10" text-anchor="middle">Inventory</text>
  <line x1="178" y1="136" x2="308" y2="136" stroke="#f5c000" stroke-width="1" opacity="0.3"/>
  <text x="243" y="149" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">OwnerId, Items</text>
  <text x="243" y="161" fill="#c8c8be" font-family="monospace" font-size="9" text-anchor="middle">TryAdd() / TryRemove()</text>
  <text x="243" y="178" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">«entity»</text>
  <!-- ItemDefinition (value object) -->
  <rect x="342" y="55" width="130" height="82" rx="4" fill="#0f0f0c" stroke="#78786e" stroke-width="1.5"/>
  <text x="407" y="73" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">ItemDefinition</text>
  <line x1="342" y1="79" x2="472" y2="79" stroke="#78786e" stroke-width="1" opacity="0.3"/>
  <text x="407" y="92" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">Id, DisplayName</text>
  <text x="407" y="104" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">MaxStackSize</text>
  <text x="407" y="116" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">Weight</text>
  <text x="407" y="148" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">«value object»</text>
  <!-- CharacterStats → DamageResult -->
  <line x1="142" y1="75" x2="178" y2="45" stroke="#78786e" stroke-width="1.5" marker-end="url(#dm18m)" stroke-dasharray="4,2"/>
  <text x="155" y="58" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">returns</text>
  <!-- Inventory → ItemDefinition -->
  <line x1="308" y1="148" x2="342" y2="118" stroke="#78786e" stroke-width="1.5" marker-end="url(#dm18m)" stroke-dasharray="4,2"/>
  <text x="325" y="133" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">uses</text>
</svg>

## What Is a Domain Entity?

A **domain entity** is a plain C# object that models a real concept from your game's rules. It has identity (usually an ID), owns its own state, and enforces its invariants (business rules) internally.

Key characteristics:
- No `using Godot;` import
- No `Node`, `Node3D`, or any Godot base class
- Constructor validates preconditions
- Methods return results rather than throwing exceptions when possible
- Fully unit-testable with `dotnet test`

```csharp
// Domain/Entities/CharacterStats.cs
// Zero Godot dependencies — pure C#

public class CharacterStats
{
    public string Id     { get; }
    public string Name   { get; }
    public float  MaxHealth { get; private set; }
    public float  Health    { get; private set; }
    public float  Armor     { get; private set; }
    public bool   IsAlive   => Health > 0f;

    public CharacterStats(string id, string name, float maxHealth, float armor = 0f)
    {
        if (string.IsNullOrWhiteSpace(id))
            throw new ArgumentException("Id cannot be empty", nameof(id));
        if (maxHealth <= 0f)
            throw new ArgumentOutOfRangeException(nameof(maxHealth),
                "MaxHealth must be positive");

        Id        = id;
        Name      = name;
        MaxHealth = maxHealth;
        Health    = maxHealth; // start at full health
        Armor     = Math.Max(0f, armor);
    }

    public DamageResult TakeDamage(float rawDamage)
    {
        if (!IsAlive) return DamageResult.None;

        float mitigated = Math.Max(0f, rawDamage - Armor);
        float before    = Health;
        Health          = Math.Max(0f, Health - mitigated);
        bool died       = before > 0f && Health == 0f;

        return new DamageResult(rawDamage, mitigated, died);
    }

    public void Heal(float amount)
    {
        if (!IsAlive) return;
        Health = Math.Min(MaxHealth, Health + Math.Max(0f, amount));
    }
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Entities own their invariants</strong> — Notice that <code>TakeDamage</code> clamps health to zero internally. No external code needs to check "did health go below zero?" The entity guarantees its own consistency. This is the core of good entity design.</div>
</div>

## Value Objects

A **value object** has no identity — two value objects with the same data are equal. They are immutable. In C#, `record struct` is perfect for this:

```csharp
// A damage result — immutable, compared by value
public readonly record struct DamageResult(
    float RawDamage,
    float MitigatedDamage,
    bool  KilledTarget)
{
    public static readonly DamageResult None = new(0f, 0f, false);
    public float Effective => RawDamage - MitigatedDamage;
}

// An inventory item definition — value object
public readonly record struct ItemDefinition(
    string Id,
    string DisplayName,
    int    MaxStackSize,
    float  Weight)
{
    public bool IsStackable => MaxStackSize > 1;
}

// A 2D grid coordinate — value object
public readonly record struct GridCoord(int X, int Y)
{
    public float DistanceTo(GridCoord other)
        => MathF.Sqrt(MathF.Pow(X - other.X, 2) + MathF.Pow(Y - other.Y, 2));

    public static GridCoord operator +(GridCoord a, GridCoord b)
        => new(a.X + b.X, a.Y + b.Y);
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>record struct vs record class</strong> — Use <code>record struct</code> for small, frequently-created value objects (positions, results, stats deltas) — they live on the stack and avoid heap allocation. Use <code>record class</code> for larger objects where reference semantics are acceptable.</div>
</div>

## Inventory Entity Example

A more complex entity that manages its own collection:

```csharp
public class Inventory
{
    public string OwnerId { get; }

    private readonly Dictionary<string, int> _items = new();
    private readonly int _maxSlots;

    public IReadOnlyDictionary<string, int> Items => _items;

    public event Action<string, int>? ItemAdded;
    public event Action<string, int>? ItemRemoved;

    public Inventory(string ownerId, int maxSlots = 20)
    {
        OwnerId   = ownerId;
        _maxSlots = maxSlots;
    }

    public bool TryAdd(string itemId, int quantity = 1)
    {
        if (quantity <= 0) return false;

        bool isNew   = !_items.ContainsKey(itemId);
        bool atLimit = isNew && _items.Count >= _maxSlots;
        if (atLimit) return false;

        _items.TryGetValue(itemId, out int current);
        _items[itemId] = current + quantity;
        ItemAdded?.Invoke(itemId, quantity);
        return true;
    }

    public bool TryRemove(string itemId, int quantity = 1)
    {
        if (quantity <= 0) return false;
        if (!_items.TryGetValue(itemId, out int current)) return false;
        if (current < quantity) return false;

        int newQty = current - quantity;
        if (newQty == 0)
            _items.Remove(itemId);
        else
            _items[itemId] = newQty;

        ItemRemoved?.Invoke(itemId, quantity);
        return true;
    }

    public int GetQuantity(string itemId)
        => _items.TryGetValue(itemId, out int qty) ? qty : 0;

    public bool Has(string itemId, int quantity = 1)
        => GetQuantity(itemId) >= quantity;
}
```

Notice this class uses standard C# events (`event Action<...>`) rather than Godot signals. The domain layer does not know about Godot at all — it will be the adapter layer's job to bridge these events to Godot signals.

## Testing Domain Entities

Because entities have no Godot dependency, you can test them in a standard .NET test project:

```csharp
// Tests/Domain/TestCharacterStats.cs
using Xunit; // or NUnit, MSTest — any .NET test framework

public class TestCharacterStats
{
    [Fact]
    public void TakeDamage_ReducesHealth()
    {
        var stats = new CharacterStats("p1", "Hero", maxHealth: 100f);
        stats.TakeDamage(30f);
        Assert.Equal(70f, stats.Health);
    }

    [Fact]
    public void Armor_MitigatesDamage()
    {
        var stats = new CharacterStats("p1", "Hero", maxHealth: 100f, armor: 10f);
        var result = stats.TakeDamage(30f);
        Assert.Equal(20f, result.MitigatedDamage);
        Assert.Equal(80f, stats.Health);
    }

    [Fact]
    public void Health_CannotGoNegative()
    {
        var stats = new CharacterStats("p1", "Hero", maxHealth: 50f);
        stats.TakeDamage(9999f);
        Assert.Equal(0f, stats.Health);
        Assert.False(stats.IsAlive);
    }

    [Fact]
    public void Heal_CannotExceedMaxHealth()
    {
        var stats = new CharacterStats("p1", "Hero", maxHealth: 100f);
        stats.TakeDamage(50f);
        stats.Heal(9999f);
        Assert.Equal(100f, stats.Health);
    }
}
```

These tests run in milliseconds with `dotnet test` — no Godot editor required, no scene needed.

## Folder Structure for the Domain Layer

```
res://
└── Scripts/
    ├── Domain/
    │   ├── Entities/
    │   │   ├── CharacterStats.cs
    │   │   ├── Inventory.cs
    │   │   └── QuestLog.cs
    │   ├── ValueObjects/
    │   │   ├── DamageResult.cs
    │   │   ├── ItemDefinition.cs
    │   │   └── GridCoord.cs
    │   └── Interfaces/        ← Ports (next lesson)
    │       ├── ICombatService.cs
    │       └── IInventoryRepository.cs
    ├── Application/           ← Use-case systems (lesson 19)
    ├── Adapters/              ← Godot nodes (lesson 21)
    └── Tests/
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">What makes a C# class a "value object" rather than an "entity"?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q18')"><span class="quiz-key">A</span> It inherits from a base class called ValueObject</div>
    <div class="quiz-o" onclick="qz(this,false,'q18')"><span class="quiz-key">B</span> It stores only numeric data</div>
    <div class="quiz-o" onclick="qz(this,true,'q18')"><span class="quiz-key">C</span> It has no independent identity — two instances with the same data are considered equal, and it is immutable</div>
    <div class="quiz-o" onclick="qz(this,false,'q18')"><span class="quiz-key">D</span> It cannot be serialized to JSON</div>
  </div>
  <div class="quiz-fb" id="q18"></div>
</div>
