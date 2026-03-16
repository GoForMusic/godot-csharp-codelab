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

<svg width="480" height="160" viewBox="0 0 480 160" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="160" fill="#080806" rx="8"/>
  <defs>
    <marker id="ca3" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#78786e"/>
    </marker>
  </defs>
  <!-- Player -->
  <rect x="15" y="65" width="90" height="40" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="60" y="82" fill="#f5c000" font-family="monospace" font-size="10" text-anchor="middle">Player</text>
  <text x="60" y="96" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">CharacterBody3D</text>
  <!-- Yaw arc below player -->
  <ellipse cx="60" cy="105" rx="40" ry="12" fill="none" stroke="#f5c000" stroke-width="1" stroke-dasharray="3,3" opacity="0.5"/>
  <text x="60" y="130" fill="#f5c000" font-family="monospace" font-size="9" text-anchor="middle">Yaw — Y axis</text>
  <text x="60" y="142" fill="#78786e" font-family="monospace" font-size="8" text-anchor="middle">horizontal look</text>
  <!-- Arrow -->
  <line x1="105" y1="85" x2="140" y2="85" stroke="#78786e" stroke-width="1.5" marker-end="url(#ca3)"/>
  <!-- CameraPivot -->
  <rect x="140" y="65" width="100" height="40" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="190" y="82" fill="#f5c000" font-family="monospace" font-size="10" text-anchor="middle">CameraPivot</text>
  <text x="190" y="96" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">Node3D</text>
  <!-- Arrow -->
  <line x1="240" y1="85" x2="275" y2="85" stroke="#78786e" stroke-width="1.5" marker-end="url(#ca3)"/>
  <!-- SpringArm3D -->
  <rect x="275" y="58" width="110" height="54" rx="4" fill="#0f0f0c" stroke="#c8c8be" stroke-width="1.5"/>
  <text x="330" y="76" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">SpringArm3D</text>
  <text x="330" y="90" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">Pitch — X axis</text>
  <text x="330" y="103" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">−70° .. +30°</text>
  <!-- Pitch arc above -->
  <path d="M 305 58 A 25 18 0 0 1 355 58" fill="none" stroke="#c8c8be" stroke-width="1" stroke-dasharray="3,3" opacity="0.6"/>
  <!-- Arrow -->
  <line x1="385" y1="85" x2="418" y2="85" stroke="#78786e" stroke-width="1.5" marker-end="url(#ca3)"/>
  <!-- Camera3D -->
  <rect x="418" y="65" width="52" height="40" rx="4" fill="#0f0f0c" stroke="#78786e" stroke-width="1.5"/>
  <text x="444" y="82" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">Camera</text>
  <text x="444" y="96" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">3D</text>
  <!-- Spring arm line -->
  <line x1="330" y1="112" x2="444" y2="112" stroke="#f5c000" stroke-width="0.8" stroke-dasharray="2,2" opacity="0.25"/>
  <text x="387" y="125" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="middle">SpringLength = 4 m</text>
  <!-- Top label -->
  <text x="240" y="20" fill="#78786e" font-family="monospace" font-size="10" text-anchor="middle">yaw rotates the pivot — pitch rotates only the arm — camera clips nothing</text>
</svg>

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
