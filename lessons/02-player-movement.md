---
title: 3D Player Movement
tag: 3D
sub: Build a responsive CharacterBody3D controller with gravity, jumping, and WASD movement using Godot's built-in physics helpers.
---

## Scene Setup for the Player

A 3D player controller requires a specific node hierarchy. The `CharacterBody3D` is the physics body; it must have at least one `CollisionShape3D` child to interact with the world.

<div class="scene-tree">
  <div class="st-row"><span class="st-icon">🧍</span> <span class="st-name">Player</span> <span class="st-type">CharacterBody3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🔷</span> <span class="st-name">CollisionShape3D</span> <span class="st-type">CollisionShape3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">📦</span> <span class="st-name">MeshInstance3D</span> <span class="st-type">MeshInstance3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">📷</span> <span class="st-name">CameraArm</span> <span class="st-type">SpringArm3D</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">🎥</span> <span class="st-name">Camera3D</span> <span class="st-type">Camera3D</span></div>
</div>

For the `CollisionShape3D`, use a `CapsuleShape3D` — it slides over edges and steps far better than a box shape.

## Gravity and Jump Logic

Godot does not apply gravity automatically to `CharacterBody3D` — you must apply it yourself. This gives you full control.

```csharp
using Godot;

public partial class PlayerController : CharacterBody3D
{
    [Export] public float Speed = 5f;
    [Export] public float JumpVelocity = 4.5f;

    // Use Godot's project gravity setting for consistency
    private float _gravity = ProjectSettings
        .GetSetting("physics/3d/default_gravity").AsSingle();

    public override void _PhysicsProcess(double delta)
    {
        Vector3 velocity = Velocity;

        // Apply gravity when airborne
        if (!IsOnFloor())
            velocity.Y -= _gravity * (float)delta;

        // Jump when on floor and jump key pressed
        if (Input.IsActionJustPressed("jump") && IsOnFloor())
            velocity.Y = JumpVelocity;

        // Get horizontal movement input
        Vector2 inputDir = Input.GetVector(
            "move_left", "move_right",
            "move_forward", "move_back");

        // Transform input to world space based on camera direction
        Vector3 direction = (Transform.Basis *
            new Vector3(inputDir.X, 0, inputDir.Y)).Normalized();

        if (direction != Vector3.Zero)
        {
            velocity.X = direction.X * Speed;
            velocity.Z = direction.Z * Speed;
        }
        else
        {
            // Decelerate horizontally when no input
            velocity.X = Mathf.MoveToward(velocity.X, 0, Speed);
            velocity.Z = Mathf.MoveToward(velocity.Z, 0, Speed);
        }

        Velocity = velocity;
        MoveAndSlide();
    }
}
```

## Input Map Configuration

Before the movement code works, you need to define your input actions in **Project → Project Settings → Input Map**:

| Action Name | Default Key |
|-------------|-------------|
| `move_forward` | W |
| `move_back` | S |
| `move_left` | A |
| `move_right` | D |
| `jump` | Space |

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Input.GetVector()</strong> — This method returns a normalized 2D vector from four directional actions. It handles diagonal movement correctly (no speed boost when pressing W+D) and supports gamepad analog sticks automatically.</div>
</div>

## MoveAndSlide() and IsOnFloor()

`MoveAndSlide()` is the workhorse of CharacterBody3D movement. It handles:
- Sliding along walls instead of stopping
- Climbing slopes up to `FloorMaxAngle` (default 45°)
- Detecting floor, ceiling, and wall contacts

After calling `MoveAndSlide()`, you can query the contact state:

```csharp
public override void _PhysicsProcess(double delta)
{
    // ... apply velocity as above ...

    MoveAndSlide();

    // Query results AFTER MoveAndSlide()
    if (IsOnFloor())
        GD.Print("On floor");

    if (IsOnWall())
        GD.Print("Against wall, normal: " + GetWallNormal());

    if (IsOnCeiling())
        velocity.Y = 0; // stop upward momentum on ceiling hit
}
```

## Camera-Relative Movement

When you have a rotating camera, you want the player to move relative to where the camera is facing, not relative to world axes. The cleanest way is to pass the camera's basis:

```csharp
public partial class PlayerController : CharacterBody3D
{
    [Export] public float Speed = 5f;
    [Export] public float JumpVelocity = 4.5f;
    [Export] public Node3D CameraPivot; // assign in Inspector

    private float _gravity = ProjectSettings
        .GetSetting("physics/3d/default_gravity").AsSingle();

    public override void _PhysicsProcess(double delta)
    {
        Vector3 velocity = Velocity;

        if (!IsOnFloor())
            velocity.Y -= _gravity * (float)delta;

        if (Input.IsActionJustPressed("jump") && IsOnFloor())
            velocity.Y = JumpVelocity;

        Vector2 inputDir = Input.GetVector(
            "move_left", "move_right",
            "move_forward", "move_back");

        // Use the camera pivot's horizontal basis
        Vector3 camForward = CameraPivot.GlobalBasis.Z * -1;
        Vector3 camRight   = CameraPivot.GlobalBasis.X;
        camForward.Y = 0;
        camRight.Y   = 0;
        camForward   = camForward.Normalized();
        camRight     = camRight.Normalized();

        Vector3 direction =
            (camForward * -inputDir.Y + camRight * inputDir.X);

        if (direction.LengthSquared() > 0.001f)
        {
            direction = direction.Normalized();
            velocity.X = direction.X * Speed;
            velocity.Z = direction.Z * Speed;

            // Face the movement direction smoothly
            var targetBasis = Basis.LookingAt(direction, Vector3.Up);
            Basis = Basis.Slerp(targetBasis, 10f * (float)delta);
        }
        else
        {
            velocity.X = Mathf.MoveToward(velocity.X, 0, Speed);
            velocity.Z = Mathf.MoveToward(velocity.Z, 0, Speed);
        }

        Velocity = velocity;
        MoveAndSlide();
    }
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Slerp for rotation</strong> — <code>Basis.Slerp()</code> smoothly interpolates rotation between two orientations. Multiplying the factor by <code>delta</code> makes the speed frame-rate independent. A factor of 10 gives snappy but smooth character turning.</div>
</div>

## Coyote Time and Jump Buffering

Two small additions that make jump feel dramatically better:

```csharp
public partial class PlayerController : CharacterBody3D
{
    [Export] public float CoyoteTime = 0.1f;   // seconds of grace after walking off edge
    [Export] public float JumpBuffer = 0.1f;   // seconds to remember jump press before landing

    private float _coyoteTimer = 0f;
    private float _jumpBufferTimer = 0f;

    public override void _PhysicsProcess(double delta)
    {
        Vector3 velocity = Velocity;

        bool onFloor = IsOnFloor();
        if (onFloor)
            _coyoteTimer = CoyoteTime;
        else
            _coyoteTimer -= (float)delta;

        if (Input.IsActionJustPressed("jump"))
            _jumpBufferTimer = JumpBuffer;
        else
            _jumpBufferTimer -= (float)delta;

        bool canJump = _coyoteTimer > 0f && _jumpBufferTimer > 0f;
        if (canJump)
        {
            velocity.Y = 4.5f;
            _coyoteTimer    = 0f;
            _jumpBufferTimer = 0f;
        }

        // ... rest of movement code ...
        Velocity = velocity;
        MoveAndSlide();
    }
}
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Which method should you call to check whether a CharacterBody3D is standing on a surface after movement?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q2')"><span class="quiz-key">A</span> CheckFloorContact()</div>
    <div class="quiz-o" onclick="qz(this,false,'q2')"><span class="quiz-key">B</span> GetCollisionCount() > 0</div>
    <div class="quiz-o" onclick="qz(this,true,'q2')"><span class="quiz-key">C</span> IsOnFloor() after calling MoveAndSlide()</div>
    <div class="quiz-o" onclick="qz(this,false,'q2')"><span class="quiz-key">D</span> Velocity.Y == 0</div>
  </div>
  <div class="quiz-fb" id="q2"></div>
</div>
