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

<svg width="480" height="180" viewBox="0 0 480 180" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="180" fill="#080806" rx="8"/>
  <!-- Node base -->
  <rect x="190" y="8" width="100" height="28" rx="4" fill="#0f0f0c" stroke="#3a3a32" stroke-width="1.5"/>
  <text x="240" y="27" fill="#78786e" font-family="monospace" font-size="11" text-anchor="middle">Node</text>
  <line x1="240" y1="36" x2="240" y2="50" stroke="#3a3a32" stroke-width="1.5"/>
  <!-- Node3D -->
  <rect x="180" y="50" width="120" height="28" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="2"/>
  <text x="240" y="69" fill="#f5c000" font-family="monospace" font-size="12" text-anchor="middle">Node3D</text>
  <!-- Branch line -->
  <line x1="240" y1="78" x2="240" y2="92" stroke="#78786e" stroke-width="1"/>
  <line x1="48" y1="92" x2="432" y2="92" stroke="#78786e" stroke-width="1"/>
  <line x1="48" y1="92" x2="48" y2="106" stroke="#78786e" stroke-width="1"/>
  <line x1="168" y1="92" x2="168" y2="106" stroke="#78786e" stroke-width="1"/>
  <line x1="312" y1="92" x2="312" y2="106" stroke="#78786e" stroke-width="1"/>
  <line x1="432" y1="92" x2="432" y2="106" stroke="#78786e" stroke-width="1"/>
  <!-- Leaf: CharacterBody3D -->
  <rect x="6" y="106" width="84" height="34" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="48" y="121" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">Character</text>
  <text x="48" y="133" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">Body3D</text>
  <!-- Leaf: StaticBody3D -->
  <rect x="118" y="106" width="100" height="34" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="168" y="121" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">StaticBody</text>
  <text x="168" y="133" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">3D</text>
  <!-- Leaf: MeshInstance3D -->
  <rect x="264" y="106" width="96" height="34" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="312" y="121" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">MeshInstance</text>
  <text x="312" y="133" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">3D</text>
  <!-- Leaf: Area3D / Camera3D -->
  <rect x="388" y="106" width="88" height="34" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="432" y="121" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">Area3D /</text>
  <text x="432" y="133" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">Camera3D</text>
  <!-- Purpose labels -->
  <text x="48" y="152" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">player · enemy</text>
  <text x="168" y="152" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">floors · walls</text>
  <text x="312" y="152" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">visuals</text>
  <text x="432" y="152" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">triggers · view</text>
  <text x="240" y="172" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">all inherit Transform3D from Node3D — position, rotation, scale in 3D space</text>
</svg>

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
