---
title: Visual Effects & Particles
tag: VFX
sub: Create GPU-accelerated particle systems in Godot 4, configure emission shapes and material properties, and trigger burst effects from C# code.
---

## GPUParticles3D Overview

`GPUParticles3D` runs the entire particle simulation on the GPU, allowing thousands of particles with minimal CPU cost. It replaces the CPU-based `Particles` node from Godot 3.

<div class="scene-tree">
  <div class="st-row"><span class="st-icon">✨</span> <span class="st-name">HitEffect</span> <span class="st-type">GPUParticles3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🎨</span> <span class="st-name">(ProcessMaterial)</span> <span class="st-type">ParticleProcessMaterial</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🖼️</span> <span class="st-name">(DrawPass1)</span> <span class="st-type">QuadMesh + SpriteMaterial</span></div>
</div>

Key `GPUParticles3D` node properties:

| Property | Description |
|----------|-------------|
| `Amount` | Total particle count (shared between alive particles) |
| `Lifetime` | Seconds each particle lives |
| `OneShot` | If true, burst fires once then stops |
| `Explosiveness` | 0 = trickle, 1 = all at once |
| `Emitting` | Set to true to start emitting |

## ParticleProcessMaterial Key Properties

All particle behavior is defined in a `ParticleProcessMaterial` resource:

```csharp
public partial class ExplosionVFX : GPUParticles3D
{
    public override void _Ready()
    {
        var mat = new ParticleProcessMaterial();

        // Emission shape — sphere radius 0.3m
        mat.EmissionShape    = ParticleProcessMaterial.EmissionShapeEnum.Sphere;
        mat.EmissionSphereRadius = 0.3f;

        // Initial velocity
        mat.InitialVelocityMin = 3f;
        mat.InitialVelocityMax = 8f;

        // Gravity — none (explosion floats outward)
        mat.Gravity = Vector3.Zero;

        // Scale over lifetime — start big, end small
        mat.ScaleMin = 0.5f;
        mat.ScaleMax = 1.2f;
        // Use a curve for scale over lifetime:
        var scaleCurve = new Curve();
        scaleCurve.AddPoint(new Vector2(0f, 1f));
        scaleCurve.AddPoint(new Vector2(1f, 0f));
        mat.ScaleCurve = scaleCurve;

        // Color over lifetime — orange → transparent
        var gradient = new Gradient();
        gradient.SetColor(0, new Color(1f, 0.5f, 0.1f, 1f)); // orange
        gradient.SetColor(1, new Color(0.3f, 0.1f, 0f, 0f));  // dark red, faded
        mat.ColorRamp = new GradientTexture1D { Gradient = gradient };

        ProcessMaterial = mat;
    }
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Resource sharing</strong> — If multiple GPUParticles3D nodes share the same <code>ParticleProcessMaterial</code> resource, changing it on one changes all of them. Use <code>mat.Duplicate()</code> if you need per-instance variation.</div>
</div>

## One-Shot Burst vs Looping

**Looping** (fire/smoke/magic aura): `OneShot = false`, `Emitting = true` — particles continuously emit. Just add the node to your scene.

**One-shot burst** (explosion, hit spark, pickup): `OneShot = true`. Set `Explosiveness = 1` so all particles fire at once.

```csharp
public partial class HitSpark : GPUParticles3D
{
    public override void _Ready()
    {
        OneShot       = true;
        Explosiveness = 1f;
        Amount        = 20;
        Lifetime      = 0.4f;
        Emitting      = false; // start off
    }

    /// <summary>Trigger the burst at the given world position.</summary>
    public void Burst(Vector3 worldPos)
    {
        GlobalPosition = worldPos;
        Restart();       // resets lifetime counter and fires
    }
}
```

```csharp
// Auto-free the node after the burst finishes
public override void _Process(double delta)
{
    // Finished fires after all particles have lived out their lifetime
    if (OneShot && !Emitting)
        QueueFree();
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Connect to the finished signal instead of polling</strong> — <code>GPUParticles3D</code> emits a <code>finished</code> signal when a one-shot effect is complete. Connect to it in <code>_Ready()</code>: <code>Finished += QueueFree;</code> — much cleaner than checking <code>Emitting</code> every frame.</div>
</div>

## Calling Restart() to Trigger Bursts

`Restart()` is the key method for retriggering a one-shot effect:

```csharp
public partial class PickupEffect : GPUParticles3D
{
    public override void _Ready()
    {
        OneShot       = true;
        Explosiveness = 0.9f;
        // Connect auto-cleanup
        Finished += QueueFree;
    }
}

// From your Pickup script
private void OnCollected()
{
    // Detach the particles from the pickup so they outlive it
    var vfx = GetNode<PickupEffect>("PickupEffect");
    RemoveChild(vfx);
    GetTree().Root.AddChild(vfx);
    vfx.GlobalPosition = GlobalPosition;
    vfx.Restart();

    QueueFree(); // free the pickup, particles continue
}
```

## Pooling Particle Effects

For effects that fire frequently (gunshots, footsteps), use a pool rather than instantiate/free every time:

```csharp
public partial class VFXManager : Node
{
    public static VFXManager Instance { get; private set; }

    [Export] public PackedScene HitSparkScene;

    private readonly Queue<GPUParticles3D> _sparkPool = new();
    private const int PoolSize = 16;

    public override void _Ready()
    {
        Instance = this;
        for (int i = 0; i < PoolSize; i++)
        {
            var spark = HitSparkScene.Instantiate<GPUParticles3D>();
            spark.Emitting = false;
            AddChild(spark);
            _sparkPool.Enqueue(spark);
            spark.Finished += () => ReturnToPool(spark);
        }
    }

    public void PlayHitSpark(Vector3 worldPos)
    {
        if (_sparkPool.Count == 0) return;
        var spark = _sparkPool.Dequeue();
        spark.GlobalPosition = worldPos;
        spark.Restart();
    }

    private void ReturnToPool(GPUParticles3D spark)
    {
        spark.Emitting = false;
        _sparkPool.Enqueue(spark);
    }
}
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Which method should you call on a GPUParticles3D node to fire a one-shot burst effect again after it has already played once?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q12')"><span class="quiz-key">A</span> Play()</div>
    <div class="quiz-o" onclick="qz(this,false,'q12')"><span class="quiz-key">B</span> Emitting = true</div>
    <div class="quiz-o" onclick="qz(this,true,'q12')"><span class="quiz-key">C</span> Restart()</div>
    <div class="quiz-o" onclick="qz(this,false,'q12')"><span class="quiz-key">D</span> Reset()</div>
  </div>
  <div class="quiz-fb" id="q12"></div>
</div>
