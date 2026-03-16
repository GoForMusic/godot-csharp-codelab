---
title: GUT Testing
tag: Test
sub: Install the GUT addon, write test scripts extending GutTest, use assertion helpers, and mock dependencies with partial doubles.
---

## Installing GUT

GUT (Godot Unit Test) is a free, open-source testing framework available as a Godot addon.

**Installation steps:**
1. Download the latest GUT release from [GitHub](https://github.com/bitwes/Gut) or install via the Asset Library (**AssetLib** tab in Godot → search "GUT")
2. Copy the `addons/gut/` folder into your `res://addons/` directory
3. Enable it: **Project → Project Settings → Plugins → GUT → Enable**
4. A new GUT panel appears at the bottom of the editor

Your project structure:

```
res://
├── addons/
│   └── gut/          ← GUT plugin
├── Scripts/
│   └── Player/
│       └── PlayerHealth.cs
└── Tests/
    └── TestPlayerHealth.cs   ← your test scripts
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>.csproj include for GUT</strong> — GUT 9+ includes a <code>GdUnit4</code> NuGet package for C#. Add it to your project: <code>dotnet add package GdUnit4</code>. This gives you C#-specific assertion helpers and IDE test runner integration.</div>
</div>

## Test Script Structure with GutTest

GUT test scripts extend `GutTest` (or `GdUnit4.GdUnitTestSuite` if using the NuGet package). Each test method starts with `test_` (GDScript convention) or is decorated with `[TestCase]` (C# convention):

```csharp
using Godot;
using GdUnit4;
using static GdUnit4.Assertions;

[TestSuite]
public class TestPlayerHealth
{
    private PlayerHealth _health;

    // Runs before each test method
    [Before]
    public void Setup()
    {
        _health = new PlayerHealth();
        _health.MaxHealth = 100f;
        // _health._Ready() is called automatically when added to scene
    }

    // Runs after each test method
    [After]
    public void Teardown()
    {
        _health.Free();
    }

    [TestCase]
    public void InitialHealthIsMaxHealth()
    {
        AssertFloat(_health.Current).IsEqual(100f);
    }

    [TestCase]
    public void TakeDamageReducesHealth()
    {
        _health.TakeDamage(30f);
        AssertFloat(_health.Current).IsEqual(70f);
    }

    [TestCase]
    public void HealthCannotGoBelowZero()
    {
        _health.TakeDamage(200f);
        AssertFloat(_health.Current).IsEqual(0f);
    }

    [TestCase]
    public void HealCannotExceedMaxHealth()
    {
        _health.TakeDamage(50f);
        _health.Heal(999f);
        AssertFloat(_health.Current).IsEqual(100f);
    }
}
```

## assert_eq, assert_true, and Other Assertions

GdUnit4 / GUT provide a rich set of fluent assertions:

```csharp
// Equality
AssertInt(score).IsEqual(100);
AssertFloat(health).IsEqual(75f);
AssertString(name).IsEqual("Hero");
AssertBool(isAlive).IsTrue();
AssertBool(isDead).IsFalse();

// Comparisons
AssertFloat(health).IsLess(100f);
AssertFloat(health).IsGreater(0f);
AssertFloat(health).IsBetween(0f, 100f);

// Null checks
AssertObject(node).IsNotNull();
AssertObject(nullRef).IsNull();

// Collections
AssertArray(items).HasSize(3);
AssertArray(items).Contains("sword");
AssertArray(items).NotContains("shield");

// Strings
AssertString(message).Contains("Error");
AssertString(path).StartsWith("res://");
```

## Testing Signals

GdUnit4 provides tools to verify that signals were emitted:

```csharp
[TestCase]
public async Task DiedSignalEmittedAtZeroHealth()
{
    var monitor = MonitorSignals(_health);

    _health.TakeDamage(100f);

    // Assert that "Died" signal was emitted exactly once
    await AssertSignal(monitor)
        .IsEmitted("Died")
        .WithCount(1);
}

[TestCase]
public async Task HealthChangedSignalCarriesCorrectValues()
{
    var monitor = MonitorSignals(_health);

    _health.TakeDamage(25f);

    await AssertSignal(monitor)
        .IsEmitted("HealthChanged")
        .WithArgs(75f, 100f); // current, max
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Test signal emission, not internal state</strong> — When testing components that communicate via signals, verify that the correct signals fire with correct arguments. This tests the public contract rather than internal implementation details.</div>
</div>

## Mocking with Partial Doubles

A partial double wraps a real object but lets you override specific methods. This is useful for isolating the unit under test from its dependencies:

```csharp
[TestCase]
public void EnemyDiesWhenHealthZero()
{
    // Create a partial double of NavigationAgent3D
    // so the enemy AI test doesn't require a baked navmesh
    var navAgent = GdUnitMockBuilder.MockGodotObject<NavigationAgent3D>();

    // Stub the method to return a predictable value
    navAgent.MockMethod("GetNextPathPosition")
            .Return(Vector3.Zero);

    var enemy = new Enemy();
    enemy.SetNav(navAgent); // inject via setter or [Export]

    enemy.TakeDamage(enemy.MaxHealth);
    AssertBool(enemy.IsDead).IsTrue();
}
```

For simpler cases, use constructor injection or property injection to swap real dependencies for test doubles:

```csharp
// Production code — accepts an interface
public partial class Enemy : CharacterBody3D
{
    public INavigationProvider Nav { get; set; }

    private void MoveTowardTarget()
    {
        var nextPos = Nav.GetNextPosition(GlobalPosition, _target.GlobalPosition);
        // ...
    }
}

// Test code — inject a fake
[TestCase]
public void EnemyMovesTowardTarget()
{
    var fakeNav = new FakeNavProvider(nextPosition: new Vector3(1, 0, 0));
    var enemy   = new Enemy { Nav = fakeNav };
    // ... assert movement
}
```

## Running Tests

**From the editor**: Open the GUT panel → select your test directory → click **Run All**.

**From the command line** (useful for CI/CD):

```bash
# Run all tests headlessly
godot --headless -s addons/gut/gut_cmdln.gd \
  -gdir=res://Tests \
  -ginclude_subdirs \
  -gexit

# Run a specific test file
godot --headless -s addons/gut/gut_cmdln.gd \
  -gtest=res://Tests/TestPlayerHealth.cs \
  -gexit
```

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>Avoid testing Godot internals</strong> — Don't write tests that verify Godot's own physics, rendering, or node lifecycle. Test your game logic only. The rule: if the test would pass even if Godot were replaced with a mock engine, it's a good unit test.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">What is the main purpose of a "partial double" (mock) in unit testing?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q16')"><span class="quiz-key">A</span> To run only part of a test method</div>
    <div class="quiz-o" onclick="qz(this,false,'q16')"><span class="quiz-key">B</span> To speed up test execution by skipping assertions</div>
    <div class="quiz-o" onclick="qz(this,true,'q16')"><span class="quiz-key">C</span> To replace a real dependency with a controlled fake, isolating the unit under test</div>
    <div class="quiz-o" onclick="qz(this,false,'q16')"><span class="quiz-key">D</span> To duplicate a test case and run it with different inputs</div>
  </div>
  <div class="quiz-fb" id="q16"></div>
</div>
