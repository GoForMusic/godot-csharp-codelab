---
title: Camera & Mouse Input
tag: 3D
sub: Set up a third-person camera with SpringArm3D, capture mouse input, and implement smooth look-around with clamped vertical rotation.
---

## Camera3D + SpringArm3D Setup

The `SpringArm3D` node is a spring-arm mechanism: it keeps the camera at a set distance from the player, but automatically shortens the arm if something is in the way (a wall, ceiling, etc.). This prevents the camera from clipping through geometry without any extra code.

<div class="scene-tree">
  <div class="st-row"><span class="st-icon">🧍</span> <span class="st-name">Player</span> <span class="st-type">CharacterBody3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🔷</span> <span class="st-name">CollisionShape3D</span> <span class="st-type">CollisionShape3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🔄</span> <span class="st-name">CameraPivot</span> <span class="st-type">Node3D</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">🦾</span> <span class="st-name">SpringArm3D</span> <span class="st-type">SpringArm3D</span></div>
  <div class="st-row" style="padding-left:4.5rem"><span class="st-icon">🎥</span> <span class="st-name">Camera3D</span> <span class="st-type">Camera3D</span></div>
</div>

Key `SpringArm3D` properties to set in the Inspector:
- **SpringLength**: 4.0 — arm length in meters
- **Margin**: 0.3 — extra gap between camera and collision surface
- **CollisionMask**: match it to your world geometry layer

Position the `Camera3D` at `(0, 0, 0)` — it sits at the end of the arm. Rotate `SpringArm3D` to aim the arm backward (negative Z).

## Capturing the Mouse

Before reading mouse motion, you need to switch Godot's mouse mode so it doesn't show the OS cursor or leave the window:

```csharp
using Godot;

public partial class CameraController : Node3D
{
    public override void _Ready()
    {
        // Hide cursor and lock it to center of window
        Input.SetMouseMode(Input.MouseModeEnum.Captured);
    }
}
```

Mouse mode options:

| Mode | Cursor | Can Leave Window |
|------|--------|-----------------|
| `Visible` | Shown | Yes |
| `Hidden` | Hidden | Yes |
| `Captured` | Hidden, centered | No |
| `ConfinedHidden` | Hidden | No (but cursor moves) |

Always provide a way for the player to release the mouse:

```csharp
public override void _UnhandledInput(InputEvent @event)
{
    if (@event is InputEventKey key &&
        key.Keycode == Key.Escape &&
        key.Pressed)
    {
        Input.SetMouseMode(Input.MouseModeEnum.Visible);
    }
}
```

## Reading Mouse Delta with _Input()

Mouse motion arrives as `InputEventMouseMotion`. The `Relative` property gives you the pixel delta since the last event:

```csharp
public partial class CameraController : Node3D
{
    [Export] public float Sensitivity = 0.002f; // radians per pixel

    private Node3D _cameraPivot;
    private float _pitchAngle = 0f; // current vertical angle

    public override void _Ready()
    {
        _cameraPivot = GetParent<Node3D>();
        Input.SetMouseMode(Input.MouseModeEnum.Captured);
    }

    public override void _Input(InputEvent @event)
    {
        if (@event is InputEventMouseMotion motion &&
            Input.GetMouseMode() == Input.MouseModeEnum.Captured)
        {
            HandleMouseLook(motion.Relative);
        }
    }

    private void HandleMouseLook(Vector2 delta)
    {
        // Horizontal rotation: rotate the entire player (or pivot) on Y axis
        _cameraPivot.RotateY(-delta.X * Sensitivity);

        // Vertical rotation: rotate only the spring arm on X axis
        _pitchAngle += -delta.Y * Sensitivity;
        _pitchAngle = Mathf.Clamp(_pitchAngle,
            Mathf.DegToRad(-70f),  // looking down limit
            Mathf.DegToRad(30f));  // looking up limit

        Rotation = new Vector3(_pitchAngle, Rotation.Y, 0f);
    }
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Use _Input not _Process for mouse look</strong> — Mouse motion events fire at the display's poll rate (often higher than 60 fps). Reading them in <code>_Input()</code> ensures you capture every micro-movement; polling in <code>_Process</code> can miss fast flicks.</div>
</div>

## Clamping Vertical Rotation

Without clamping the pitch, the camera can flip upside-down, which is disorienting. The standard limits are roughly −70° (looking mostly down) to +30° (looking slightly up). Adjust based on your game feel.

```csharp
// Convert degrees to radians for Godot's math
const float MinPitch = -70f * Mathf.Pi / 180f; // ≈ -1.22 rad
const float MaxPitch =  30f * Mathf.Pi / 180f; // ≈  0.52 rad

_pitchAngle = Mathf.Clamp(_pitchAngle, MinPitch, MaxPitch);
// or using the helper:
_pitchAngle = Mathf.Clamp(_pitchAngle,
    Mathf.DegToRad(-70f), Mathf.DegToRad(30f));
```

## Full Camera Controller

Here is the complete, production-ready camera script:

```csharp
using Godot;

public partial class CameraController : Node3D
{
    [Export] public float Sensitivity   = 0.002f;
    [Export] public float MinPitchDeg   = -70f;
    [Export] public float MaxPitchDeg   =  30f;
    [Export] public NodePath PivotPath;   // the Node3D that rotates horizontally

    private Node3D   _pivot;
    private float    _pitch = 0f;

    public override void _Ready()
    {
        _pivot = GetNode<Node3D>(PivotPath);
        Input.SetMouseMode(Input.MouseModeEnum.Captured);
    }

    public override void _Input(InputEvent @event)
    {
        if (@event is not InputEventMouseMotion motion) return;
        if (Input.GetMouseMode() != Input.MouseModeEnum.Captured) return;

        // Yaw — rotate pivot horizontally
        _pivot.RotateY(-motion.Relative.X * Sensitivity);

        // Pitch — rotate this arm node vertically, clamped
        _pitch -= motion.Relative.Y * Sensitivity;
        _pitch  = Mathf.Clamp(_pitch,
                    Mathf.DegToRad(MinPitchDeg),
                    Mathf.DegToRad(MaxPitchDeg));

        Rotation = new Vector3(_pitch, Rotation.Y, 0f);
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (@event is InputEventKey { Keycode: Key.Escape, Pressed: true })
            Input.SetMouseMode(Input.MouseModeEnum.Visible);

        if (@event is InputEventMouseButton { ButtonIndex: MouseButton.Left, Pressed: true })
            Input.SetMouseMode(Input.MouseModeEnum.Captured);
    }
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Left-click to re-capture</strong> — The <code>_UnhandledInput</code> handler above re-captures the mouse when the player clicks the window. This is standard behavior in PC games — essential when Alt-tabbing back to the game.</div>
</div>

## FOV and Camera Smoothing

A few extra properties that improve camera feel:

```csharp
public override void _Ready()
{
    var camera = GetNode<Camera3D>("SpringArm3D/Camera3D");

    // Field of view — narrower feels zoomed in, wider feels faster
    camera.Fov = 75f;

    // Depth of field (requires environment asset)
    // camera.DofBlurFarEnabled = true;
}

// Optional: smoothly follow the player with a lerp
public override void _Process(double delta)
{
    // If the camera pivot is a separate node from the player,
    // lerp its global position toward the player
    GlobalPosition = GlobalPosition.Lerp(
        _player.GlobalPosition + Vector3.Up * 1.5f,
        (float)delta * 10f);
}
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Which <code>InputEvent</code> subclass carries the mouse movement delta each frame?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q3')"><span class="quiz-key">A</span> InputEventMouseButton</div>
    <div class="quiz-o" onclick="qz(this,false,'q3')"><span class="quiz-key">B</span> InputEventAction</div>
    <div class="quiz-o" onclick="qz(this,true,'q3')"><span class="quiz-key">C</span> InputEventMouseMotion</div>
    <div class="quiz-o" onclick="qz(this,false,'q3')"><span class="quiz-key">D</span> InputEventJoypadMotion</div>
  </div>
  <div class="quiz-fb" id="q3"></div>
</div>
