---
title: Animations & AnimationTree
tag: Anim
sub: Create animation clips in AnimationPlayer, wire them into an AnimationTree state machine, and drive transitions from C# movement logic.
---

## AnimationPlayer: Creating Clips

`AnimationPlayer` is the recording system — it stores named animation clips (idle, walk, jump) as tracks of keyframed property changes. Add it as a child of your player root node.

<div class="scene-tree">
  <div class="st-row"><span class="st-icon">🧍</span> <span class="st-name">Player</span> <span class="st-type">CharacterBody3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🎬</span> <span class="st-name">AnimationPlayer</span> <span class="st-type">AnimationPlayer</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🌲</span> <span class="st-name">AnimationTree</span> <span class="st-type">AnimationTree</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">📦</span> <span class="st-name">Rig</span> <span class="st-type">Node3D</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">💀</span> <span class="st-name">Skeleton3D</span> <span class="st-type">Skeleton3D</span></div>
</div>

Common clips to create for a third-person character:

| Clip Name | Loop | Description |
|-----------|------|-------------|
| `idle` | Yes | Standing still, subtle breathing |
| `walk` | Yes | Walking cycle |
| `run` | Yes | Running cycle |
| `jump_start` | No | Leaving the ground |
| `jump_fall` | Yes | Airborne loop |
| `jump_land` | No | Landing impact |

When importing a `.glb` with pre-made animations, Godot splits them into individual clips automatically. Check the **Import** tab and enable **Animation → Import** for each clip.

## AnimationTree + State Machine

`AnimationTree` is the playback system that blends and transitions between clips. Set its **Anim Player** property to point to your `AnimationPlayer`.

The most useful tree root type is `AnimationNodeStateMachine`. Create one and wire up states:

```
[idle] ──(speed > 0.1)──► [walk]
[walk] ──(speed < 0.1)──► [idle]
[idle] ──(jump)──────────► [jump_start]
[jump_start] ──(finished)─► [jump_fall]
[jump_fall] ──(on_floor)──► [jump_land]
[jump_land] ──(finished)──► [idle]
```

Each arrow is a **Transition** — you can set:
- **Switch Mode**: Immediate, Sync, or AtEnd
- **Advance Condition**: the name of a boolean parameter that triggers the transition
- **Auto Advance**: trigger automatically when the source clip ends

## Reading AnimationNodeStateMachinePlayback from C#

The playback object lets you travel to states programmatically:

```csharp
using Godot;

public partial class PlayerAnimator : Node
{
    [Export] public AnimationTree AnimTree;
    [Export] public CharacterBody3D Body;

    private AnimationNodeStateMachinePlayback _stateMachine;

    public override void _Ready()
    {
        _stateMachine = (AnimationNodeStateMachinePlayback)
            AnimTree.Get("parameters/playback");

        AnimTree.Active = true;
    }

    public override void _Process(double delta)
    {
        float speed = new Vector2(Body.Velocity.X, Body.Velocity.Z).Length();

        // Set blend parameters
        AnimTree.Set("parameters/blend_speed/blend_amount",
            Mathf.Clamp(speed / 5f, 0f, 1f)); // 0 = idle, 1 = run

        // Trigger jump
        if (Input.IsActionJustPressed("jump") && Body.IsOnFloor())
        {
            AnimTree.Set("parameters/conditions/jump", true);
        }
        else
        {
            AnimTree.Set("parameters/conditions/jump", false);
        }

        // Land
        AnimTree.Set("parameters/conditions/on_floor", Body.IsOnFloor());
    }
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Parameter paths</strong> — The string paths like <code>"parameters/blend_speed/blend_amount"</code> match exactly how the node is named in the AnimationTree editor. Hover over any parameter in the editor to see its full path.</div>
</div>

## BlendSpace2D for Directional Movement

For a character that leans in their movement direction, use a `BlendSpace2D` node inside the AnimationTree. Place your clips at positions corresponding to movement direction:

```
          walk_forward (0, -1)
               |
walk_left ─── idle ─── walk_right
(-1, 0)     (0, 0)     (1, 0)
               |
          walk_back (0, 1)
```

Drive the blend position from code:

```csharp
public override void _PhysicsProcess(double delta)
{
    // Local velocity relative to character facing
    Vector3 localVel = GlobalTransform.Basis.Inverse() * Body.Velocity;
    Vector2 blendPos = new Vector2(localVel.X, -localVel.Z) / 5f;

    AnimTree.Set("parameters/walk_blend/blend_position",
        blendPos.Clamp(Vector2.One * -1f, Vector2.One));
}
```

## Connecting AnimationTree to Physics State

Keep animation and physics logic decoupled. The cleanest pattern is a dedicated animator script that reads from the physics body rather than putting animation code inside the movement controller:

```csharp
public partial class PlayerAnimator : Node
{
    [Export] public AnimationTree Tree;
    [Export] public CharacterBody3D Body;

    // Expose a simple API for the rest of the game
    public void PlayOneShot(string stateName)
        => _stateMachine.Travel(stateName);

    public void SetSpeed(float normalizedSpeed)
        => Tree.Set("parameters/locomotion/blend_amount", normalizedSpeed);

    public void SetAirborne(bool airborne)
        => Tree.Set("parameters/conditions/airborne", airborne);

    public override void _Process(double delta)
    {
        float hSpeed = new Vector2(Body.Velocity.X, Body.Velocity.Z).Length();
        SetSpeed(hSpeed / 5f);
        SetAirborne(!Body.IsOnFloor());
    }
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Separate movement from animation</strong> — Your movement controller should not know anything about clips or the AnimationTree. Pass data through exported references or signals. This makes it easy to swap animation systems without touching physics code.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Which class do you cast the <code>"parameters/playback"</code> object to in order to call <code>Travel()</code>?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q4')"><span class="quiz-key">A</span> AnimationPlayer</div>
    <div class="quiz-o" onclick="qz(this,false,'q4')"><span class="quiz-key">B</span> AnimationNodeStateMachine</div>
    <div class="quiz-o" onclick="qz(this,true,'q4')"><span class="quiz-key">C</span> AnimationNodeStateMachinePlayback</div>
    <div class="quiz-o" onclick="qz(this,false,'q4')"><span class="quiz-key">D</span> AnimationMixer</div>
  </div>
  <div class="quiz-fb" id="q4"></div>
</div>
