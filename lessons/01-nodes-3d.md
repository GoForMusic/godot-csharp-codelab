---
title: 3D Nodes & Scripts
tag: 3D
sub: Explore the core 3D node types, attach C# scripts with the partial class requirement, and understand the three main lifecycle callbacks.
---

## Core 3D Node Types

Godot's 3D node hierarchy is built around `Node3D` as the base for anything with a position in 3D space. Understanding which node to use is the first step to building any 3D scene.

<div class="grid2">
  <div class="card"><div class="card-title">Node3D</div><p class="card-desc">Base class for all 3D nodes. Provides Transform3D, Position, Rotation, and Scale. Use this as a plain pivot/group node.</p></div>
  <div class="card"><div class="card-title">MeshInstance3D</div><p class="card-desc">Renders a 3D mesh. Assign a Mesh resource (BoxMesh, SphereMesh, or imported .glb) and a Material. This is what the player sees.</p></div>
  <div class="card"><div class="card-title">StaticBody3D</div><p class="card-desc">An immovable physics body — perfect for floors, walls, and platforms. Pair with CollisionShape3D to define the collision boundary.</p></div>
  <div class="card"><div class="card-title">CollisionShape3D</div><p class="card-desc">Defines the physics shape for any physics body. Must be a child of a physics body node. Use BoxShape3D, CapsuleShape3D, etc.</p></div>
</div>

A typical static platform looks like this in the scene tree:

<div class="scene-tree">
  <div class="st-row"><span class="st-icon">🗿</span> <span class="st-name">Platform</span> <span class="st-type">StaticBody3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">📦</span> <span class="st-name">Mesh</span> <span class="st-type">MeshInstance3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🔷</span> <span class="st-name">Shape</span> <span class="st-type">CollisionShape3D</span></div>
</div>

## Attaching C# Scripts — The partial class Requirement

Every Godot C# script must use the `partial` keyword. This is non-negotiable: Godot's source generator creates additional partial class code behind the scenes that wires up signals, exports, and the node registration.

```csharp
using Godot;

// CORRECT — partial is required
public partial class MyNode : Node3D
{
    public override void _Ready()
    {
        GD.Print("Hello from MyNode");
    }
}
```

```csharp
// WRONG — will not compile with Godot's source generator
public class MyNode : Node3D { }
```

The class name **must** match the filename exactly. `MyNode.cs` → `class MyNode`. Godot enforces this mapping to locate scripts.

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Namespace support</strong> — You can wrap your class in a namespace, but then you must include the full namespace in Godot's script metadata. Most projects skip namespaces for simplicity or use a single top-level namespace.</div>
</div>

## _Ready(), _Process(), and _PhysicsProcess()

These three virtual methods cover the vast majority of game logic:

```csharp
public partial class Enemy : Node3D
{
    private float _health = 100f;

    // Called once when the node enters the scene tree
    // All children are guaranteed to be ready at this point
    public override void _Ready()
    {
        _health = 100f;
        GD.Print($"{Name} is ready");
    }

    // Called every rendered frame — delta varies with framerate
    // Use for: visual updates, input polling, UI animation
    public override void _Process(double delta)
    {
        // Rotate visually — not physics-safe
        RotateY((float)delta * 0.5f);
    }

    // Called every physics tick — delta is fixed (default 1/60s)
    // Use for: movement, collision, physics queries
    public override void _PhysicsProcess(double delta)
    {
        // Safe for movement and physics interactions
    }
}
```

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>Never move physics bodies in _Process</strong> — Use <code>_PhysicsProcess</code> for anything that interacts with the physics engine. Mixing them causes jitter and missed collisions.</div>
</div>

| Method | Delta | Frequency | Use for |
|--------|-------|-----------|---------|
| `_Ready()` | — | Once | Initialization |
| `_Process(delta)` | Variable | Every frame | Visual, input |
| `_PhysicsProcess(delta)` | Fixed (1/60s) | Every physics step | Movement, physics |

## GetNode&lt;T&gt;() and the [Export] Attribute

There are two ways to get references to other nodes in your scene.

**GetNode&lt;T&gt;()** — fetch by path relative to the current node:

```csharp
public partial class Player : CharacterBody3D
{
    private AnimationPlayer _anim;
    private MeshInstance3D _mesh;

    public override void _Ready()
    {
        // Path relative to this node
        _anim = GetNode<AnimationPlayer>("AnimationPlayer");
        _mesh = GetNode<MeshInstance3D>("Mesh/MeshInstance3D");

        // Shorthand using $ operator (same as GetNode)
        _anim = GetNode<AnimationPlayer>("AnimationPlayer");
    }
}
```

**[Export]** — expose a field to the Godot Inspector, letting you drag-and-drop node references:

```csharp
public partial class Player : CharacterBody3D
{
    [Export] public float Speed = 5f;
    [Export] public float JumpForce = 8f;
    [Export] public NodePath AnimPlayerPath;

    // Export any Godot type — set it in the Inspector
    [Export] public AudioStreamPlayer3D FootstepSound;
    [Export] public PackedScene BulletScene;

    public override void _Ready()
    {
        // No hardcoded path — set in Inspector
        var anim = GetNode<AnimationPlayer>(AnimPlayerPath);
    }
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Prefer [Export] over hardcoded paths</strong> — Hardcoded node paths break silently when you rename or restructure your scene. <code>[Export]</code> references update automatically in the Inspector and show an error if the node is missing.</div>
</div>

## Practical Example — A Spinning Collectible

Putting it all together: a spinning coin that the player can collect.

```csharp
using Godot;

public partial class Coin : Area3D
{
    [Export] public float RotationSpeed = 2f;
    [Export] public float BobAmplitude = 0.15f;
    [Export] public float BobFrequency = 1.5f;

    private Vector3 _startPosition;

    public override void _Ready()
    {
        _startPosition = GlobalPosition;
        // Connect the area's body_entered signal
        BodyEntered += OnBodyEntered;
    }

    public override void _Process(double delta)
    {
        RotateY(RotationSpeed * (float)delta);
        float bob = Mathf.Sin(Time.GetTicksMsec() * 0.001f * BobFrequency)
                    * BobAmplitude;
        GlobalPosition = _startPosition + Vector3.Up * bob;
    }

    private void OnBodyEntered(Node3D body)
    {
        if (body is Player)
        {
            GD.Print("Coin collected!");
            QueueFree(); // Remove from scene
        }
    }
}
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Why must all Godot C# node classes use the <code>partial</code> keyword?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q1')"><span class="quiz-key">A</span> It makes the class run faster at runtime</div>
    <div class="quiz-o" onclick="qz(this,false,'q1')"><span class="quiz-key">B</span> It is required by the C# language for all classes</div>
    <div class="quiz-o" onclick="qz(this,true,'q1')"><span class="quiz-key">C</span> Godot's source generator adds code to the same class in a separate file</div>
    <div class="quiz-o" onclick="qz(this,false,'q1')"><span class="quiz-key">D</span> It allows the class to be inherited by other scripts</div>
  </div>
  <div class="quiz-fb" id="q1"></div>
</div>
