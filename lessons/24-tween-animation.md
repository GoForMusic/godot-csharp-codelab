---
title: Tween & Procedural Animation
tag: Anim
sub: Animate any property with Godot 4's fluent Tween API, build a camera shake trauma system, add UI juice with elastic easing, and create floating damage numbers — all from C#.
---

## Tween Basics

`Tween` is Godot 4's fluent property animator. Create one with `CreateTween()` and chain steps:

```csharp
// Move a node up, pause, move back
Tween tween = CreateTween();
tween.TweenProperty(myNode, "position", new Vector3(0, 5, 0), 0.5f);
tween.TweenInterval(0.2f);
tween.TweenProperty(myNode, "position", Vector3.Zero, 0.5f);
```

`TweenProperty` returns a `PropertyTweener` you can further configure:

```csharp
tween.TweenProperty(label, "scale", new Vector2(1.3f, 1.3f), 0.1f)
     .SetEase(Tween.EaseType.Out)
     .SetTrans(Tween.TransitionType.Back);
```

The tween sequence pipeline:

<svg width="480" height="90" viewBox="0 0 480 90" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="90" fill="#080806" rx="8"/>
  <defs>
    <marker id="tw24" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#f5c000"/>
    </marker>
  </defs>
  <rect x="8"   y="24" width="100" height="42" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="58"  y="42" fill="#f5c000" font-family="monospace" font-size="9"  text-anchor="middle">TweenProperty</text>
  <text x="58"  y="56" fill="#78786e" font-family="monospace" font-size="8"  text-anchor="middle">animate value</text>
  <line x1="108" y1="45" x2="130" y2="45" stroke="#f5c000" stroke-width="1.5" marker-end="url(#tw24)"/>
  <rect x="130" y="24" width="100" height="42" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="180" y="42" fill="#f5c000" font-family="monospace" font-size="9"  text-anchor="middle">TweenInterval</text>
  <text x="180" y="56" fill="#78786e" font-family="monospace" font-size="8"  text-anchor="middle">wait N seconds</text>
  <line x1="230" y1="45" x2="252" y2="45" stroke="#f5c000" stroke-width="1.5" marker-end="url(#tw24)"/>
  <rect x="252" y="24" width="110" height="42" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="307" y="42" fill="#f5c000" font-family="monospace" font-size="9"  text-anchor="middle">TweenCallback</text>
  <text x="307" y="56" fill="#78786e" font-family="monospace" font-size="8"  text-anchor="middle">run C# lambda</text>
  <line x1="362" y1="45" x2="384" y2="45" stroke="#f5c000" stroke-width="1.5" marker-end="url(#tw24)"/>
  <rect x="384" y="24" width="88" height="42" rx="4" fill="#0f0f0c" stroke="#c8c8be" stroke-width="1.5"/>
  <text x="428" y="42" fill="#c8c8be" font-family="monospace" font-size="9"  text-anchor="middle">Finished</text>
  <text x="428" y="56" fill="#78786e" font-family="monospace" font-size="8"  text-anchor="middle">auto-freed</text>
  <text x="240" y="80" fill="#3a3a32" font-family="monospace" font-size="8"  text-anchor="middle">steps execute sequentially by default — use SetParallel(true) to run simultaneously</text>
</svg>

## Easing and Transition Types

`TransitionType` sets the mathematical curve shape. `EaseType` sets where acceleration happens:

| Effect | TransitionType | EaseType |
|--------|---------------|----------|
| Snap to position | `Quint` | `Out` |
| Elastic bounce | `Elastic` | `Out` |
| Overshoot & settle | `Back` | `Out` |
| Smooth in/out | `Sine` | `InOut` |
| Natural spring | `Spring` | `Out` |

```csharp
// Pop-in: element appears with a satisfying bounce
private void AnimateIn(Control control)
{
    control.Scale   = Vector2.Zero;
    control.Visible = true;
    Tween tween = control.CreateTween();
    tween.TweenProperty(control, "scale", Vector2.One, 0.35f)
         .SetEase(Tween.EaseType.Out)
         .SetTrans(Tween.TransitionType.Back);
}

// Fade out and remove from tree
private void AnimateOut(Control control)
{
    Tween tween = control.CreateTween();
    tween.TweenProperty(control, "modulate:a", 0f, 0.2f);
    tween.TweenCallback(Callable.From(control.QueueFree));
}
```

## Parallel Tweens

Animate multiple properties simultaneously:

```csharp
// Spawn effect: slide in + rotate + scale all at once
Tween tween = CreateTween().SetParallel(true);

tween.TweenProperty(enemy, "position", spawnPos, 0.4f)
     .SetTrans(Tween.TransitionType.Back)
     .SetEase(Tween.EaseType.Out);

tween.TweenProperty(enemy, "rotation_degrees:y", 360f, 0.4f);

tween.TweenProperty(enemy, "scale", Vector3.One, 0.4f)
     .SetTrans(Tween.TransitionType.Elastic)
     .SetEase(Tween.EaseType.Out);
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Tween lifecycle</strong> — A Tween is freed automatically when it finishes. Stored references become invalid. Use <code>tween.SetLoops(-1)</code> for infinite loops. Use <code>tween.Kill()</code> to cancel early.</div>
</div>

## Camera Shake — Trauma System

Noise-based camera shake feels far better than random jitter. A "trauma" value decays over time and drives offset via simplex noise:

```csharp
// Scripts/Camera/CameraShake.cs
using Godot;

public partial class CameraShake : Camera3D
{
    [Export] public float MaxOffsetMeters = 0.08f;
    [Export] public float MaxRotDeg       = 1.5f;
    [Export] public float TraumaDecay     = 1.5f;   // per second
    [Export] public float NoiseSpeed      = 80f;

    private float          _trauma    = 0f;
    private float          _noiseTime = 0f;
    private Vector3        _basePos;
    private FastNoiseLite  _noise;

    public override void _Ready()
    {
        _basePos = Position;
        _noise   = new FastNoiseLite
        {
            NoiseType = FastNoiseLite.NoiseTypeEnum.Simplex,
            Frequency = 0.5f
        };
    }

    /// <summary>Add camera trauma (0..1). Additive and clamped.</summary>
    public void AddTrauma(float amount)
        => _trauma = Mathf.Clamp(_trauma + amount, 0f, 1f);

    public override void _Process(double delta)
    {
        float dt = (float)delta;
        _trauma    = Mathf.Max(0f, _trauma - TraumaDecay * dt);
        _noiseTime += NoiseSpeed * dt;

        float shake = _trauma * _trauma; // quadratic — feels more "physical"
        if (shake > 0.001f)
        {
            Position = _basePos + new Vector3(
                _noise.GetNoise2D(_noiseTime,       0f) * MaxOffsetMeters * shake,
                _noise.GetNoise2D(_noiseTime + 64f, 0f) * MaxOffsetMeters * shake,
                0f);
            RotationDegrees = new Vector3(
                RotationDegrees.X, RotationDegrees.Y,
                _noise.GetNoise2D(_noiseTime + 128f, 0f) * MaxRotDeg * shake);
        }
        else
        {
            Position = _basePos;
        }
    }
}
```

Use from anywhere:

```csharp
var shake = GetNode<CameraShake>("/root/World/CameraArm/Camera3D");
shake.AddTrauma(0.6f);  // big hit
shake.AddTrauma(0.15f); // small hit
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Trauma squared</strong> — <code>shake = trauma * trauma</code> means small trauma values produce almost no movement, while large values produce strong shake. This non-linear mapping reads as intensity rather than jitter, and feels much more physical.</div>
</div>

## Screen Fade

```csharp
// Scripts/UI/ScreenFade.cs
using Godot;

public partial class ScreenFade : ColorRect
{
    public override void _Ready()
    {
        AnchorsPreset = (int)LayoutPreset.FullRect;
        Color         = new Color(Colors.Black, 0f); // start transparent
        ZIndex        = 100;
        MouseFilter   = MouseFilterEnum.Ignore;
    }

    public Tween FadeOut(float duration = 0.5f)
    {
        Tween t = CreateTween();
        t.TweenProperty(this, "color:a", 1f, duration);
        return t; // caller can .TweenCallback for scene change
    }

    public Tween FadeIn(float duration = 0.5f)
    {
        Tween t = CreateTween();
        t.TweenProperty(this, "color:a", 0f, duration);
        return t;
    }
}
```

```csharp
// Smooth scene transition with fade
public async void TransitionToScene(string scenePath)
{
    var fade  = GetNode<ScreenFade>("/root/ScreenFade");
    var tween = fade.FadeOut(0.4f);
    await ToSignal(tween, Tween.SignalName.Finished);
    GetTree().ChangeSceneToFile(scenePath);
    fade.FadeIn(0.4f);
}
```

## Floating Damage Numbers

```csharp
// Scripts/UI/DamageLabel.cs
using Godot;

public partial class DamageLabel : Label
{
    public static void Spawn(Node parent, Vector3 worldPos,
        float damage, Camera3D camera)
    {
        var label = new DamageLabel();
        label.Text = $"-{(int)damage}";
        label.AddThemeFontSizeOverride("font_size", 22);
        parent.AddChild(label);
        label.GlobalPosition = camera.UnprojectPosition(worldPos);
        label.Animate();
    }

    private void Animate()
    {
        Tween tween = CreateTween().SetParallel(true);

        // Rise upward
        tween.TweenProperty(this, "position:y", Position.Y - 60f, 0.8f)
             .SetEase(Tween.EaseType.Out)
             .SetTrans(Tween.TransitionType.Quad);

        // Fade out
        tween.TweenProperty(this, "modulate:a", 0f, 0.8f)
             .SetEase(Tween.EaseType.In);

        // Remove when done
        tween.Chain().TweenCallback(Callable.From(QueueFree));
    }
}
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">You want a UI element to overshoot its target scale slightly, then settle. Which TransitionType with EaseType.Out produces this effect?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q24')"><span class="quiz-key">A</span> TransitionType.Linear</div>
    <div class="quiz-o" onclick="qz(this,false,'q24')"><span class="quiz-key">B</span> TransitionType.Sine</div>
    <div class="quiz-o" onclick="qz(this,true,'q24')"><span class="quiz-key">C</span> TransitionType.Back or TransitionType.Elastic</div>
    <div class="quiz-o" onclick="qz(this,false,'q24')"><span class="quiz-key">D</span> TransitionType.Quint</div>
  </div>
  <div class="quiz-fb" id="q24"></div>
</div>
