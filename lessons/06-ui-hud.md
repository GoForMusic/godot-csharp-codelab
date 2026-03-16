---
title: UI & HUD System
tag: UI
sub: Build a game HUD with health bars and score labels using Godot's Control nodes, anchors, and signal-driven updates from game state.
---

## Control Node Hierarchy and Anchors

All Godot UI is built from `Control` nodes. The key concept that makes responsive layouts work is the **anchor** system. Each Control has four anchor points (left, top, right, bottom) that define where its edges are relative to the parent, expressed as a 0–1 fraction.

Common anchor presets in the Inspector:

| Preset | Use case |
|--------|----------|
| Top Left | Score counter, minimap corner |
| Top Right | Timer, currency display |
| Bottom Left | Ability cooldowns |
| Center | Crosshair, notification popups |
| Full Rect | Full-screen overlays, menus |

```csharp
// Setting anchors from code (rarely needed, prefer Inspector)
var label = GetNode<Label>("ScoreLabel");
label.AnchorLeft   = 0f;
label.AnchorTop    = 0f;
label.AnchorRight  = 0f;
label.AnchorBottom = 0f;
label.OffsetLeft   = 20f;
label.OffsetTop    = 20f;
```

## CanvasLayer for HUD Overlay

<svg width="480" height="170" viewBox="0 0 480 170" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="170" fill="#080806" rx="8"/>
  <!-- Layer 2: Menus (top) -->
  <rect x="38" y="18" width="404" height="38" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="240" y="34" fill="#f5c000" font-family="monospace" font-size="10" text-anchor="middle">CanvasLayer  layer=2  —  Pause / Menus</text>
  <text x="240" y="49" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">PauseMenu · GameOver · Settings  (rendered on top)</text>
  <!-- Layer 1: HUD -->
  <rect x="20" y="68" width="440" height="38" rx="4" fill="#0f0f0c" stroke="#c8c8be" stroke-width="1.5"/>
  <text x="240" y="84" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">CanvasLayer  layer=1  —  HUD</text>
  <text x="240" y="99" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">HealthBar · ScoreLabel · Crosshair · Minimap</text>
  <!-- Layer 0: 3D World -->
  <rect x="8" y="118" width="464" height="38" rx="4" fill="#0f0f0c" stroke="#3a3a32" stroke-width="1.5"/>
  <text x="240" y="134" fill="#78786e" font-family="monospace" font-size="10" text-anchor="middle">Layer 0  —  3D World</text>
  <text x="240" y="149" fill="#3a3a32" font-family="monospace" font-size="9" text-anchor="middle">Node3D · CharacterBody3D · Lights · Terrain  (rendered behind UI)</text>
  <!-- Depth label -->
  <text x="478" y="90" fill="#3a3a32" font-family="monospace" font-size="8" text-anchor="end" transform="rotate(-90,478,90)">depth ↑</text>
</svg>

Without a `CanvasLayer`, a Control node placed in the scene tree is affected by the 3D camera — it would appear in 3D space rather than on screen. `CanvasLayer` breaks the HUD out of 3D transforms and pins it to screen space.

<div class="scene-tree">
  <div class="st-row"><span class="st-icon">🌐</span> <span class="st-name">World</span> <span class="st-type">Node3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🧍</span> <span class="st-name">Player</span> <span class="st-type">CharacterBody3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🖥️</span> <span class="st-name">HUD</span> <span class="st-type">CanvasLayer</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">📊</span> <span class="st-name">HealthBar</span> <span class="st-type">ProgressBar</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">🏷️</span> <span class="st-name">ScoreLabel</span> <span class="st-type">Label</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">🎯</span> <span class="st-name">Crosshair</span> <span class="st-type">TextureRect</span></div>
</div>

Set `CanvasLayer.Layer` to 1 or higher to ensure it renders on top of the 3D world. Higher values render on top of lower values.

## ProgressBar for Health

`ProgressBar` has `MinValue`, `MaxValue`, and `Value` properties. Styling it requires a custom theme or the **StyleBox** override system:

```csharp
using Godot;

public partial class HUD : CanvasLayer
{
    [Export] public ProgressBar HealthBar;
    [Export] public Label ScoreLabel;
    [Export] public Label AmmoLabel;

    private int _score = 0;

    public void SetHealth(float current, float max)
    {
        HealthBar.MaxValue = max;
        HealthBar.Value    = current;

        // Change bar color based on health level
        float ratio = current / max;
        var fill = HealthBar.GetThemeStylebox("fill") as StyleBoxFlat;
        if (fill != null)
        {
            fill.BgColor = ratio > 0.5f
                ? new Color(0.2f, 0.8f, 0.2f) // green
                : ratio > 0.25f
                    ? new Color(0.9f, 0.7f, 0.1f) // yellow
                    : new Color(0.9f, 0.1f, 0.1f); // red
        }
    }

    public void AddScore(int points)
    {
        _score += points;
        ScoreLabel.Text = $"Score: {_score:N0}";
    }

    public void SetAmmo(int current, int max)
    {
        AmmoLabel.Text = $"{current} / {max}";
        AmmoLabel.Modulate = current == 0
            ? new Color(1f, 0.3f, 0.3f) // red when empty
            : Colors.White;
    }
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Theme overrides</strong> — Rather than modifying StyleBoxes at runtime, create a <code>.tres</code> Theme resource and apply it to your CanvasLayer. This keeps visual style in data, not in code.</div>
</div>

## Connecting Signals to Update UI

The cleanest pattern is to have the game logic emit signals, and the HUD connect to them. The HUD never reaches into the game world; the game world never reaches into the HUD.

```csharp
// PlayerHealth.cs — game logic, no UI dependency
using Godot;

public partial class PlayerHealth : Node
{
    [Signal] public delegate void HealthChangedEventHandler(float current, float max);
    [Signal] public delegate void DiedEventHandler();

    [Export] public float MaxHealth = 100f;
    private float _current;

    public override void _Ready()
    {
        _current = MaxHealth;
        EmitSignal(SignalName.HealthChanged, _current, MaxHealth);
    }

    public void TakeDamage(float amount)
    {
        _current = Mathf.Max(0f, _current - amount);
        EmitSignal(SignalName.HealthChanged, _current, MaxHealth);

        if (_current <= 0f)
            EmitSignal(SignalName.Died);
    }

    public void Heal(float amount)
    {
        _current = Mathf.Min(MaxHealth, _current + amount);
        EmitSignal(SignalName.HealthChanged, _current, MaxHealth);
    }
}
```

```csharp
// HUD.cs — pure presentation, connects to game signals
public partial class HUD : CanvasLayer
{
    [Export] public PlayerHealth PlayerHealthComponent;
    [Export] public ProgressBar HealthBar;

    public override void _Ready()
    {
        // Connect via code — or use the Godot editor Signals dock
        PlayerHealthComponent.HealthChanged += OnHealthChanged;
        PlayerHealthComponent.Died          += OnPlayerDied;
    }

    private void OnHealthChanged(float current, float max)
    {
        HealthBar.MaxValue = max;
        HealthBar.Value    = current;
    }

    private void OnPlayerDied()
    {
        // Show game over screen
        GetNode<Control>("GameOverScreen").Visible = true;
    }
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Signal naming convention</strong> — Godot C# generates a delegate type from your <code>[Signal]</code> declaration. The convention is <code>[SignalName]EventHandler</code>. For <code>HealthChanged</code>, the delegate is <code>HealthChangedEventHandler</code> and the signal name constant is <code>SignalName.HealthChanged</code>.</div>
</div>

## Animating UI Elements

Use `Tween` or `AnimationPlayer` to animate HUD elements for juice. A common effect is a hit-flash on the health bar:

```csharp
private void FlashDamage()
{
    Tween tween = HealthBar.CreateTween();
    tween.TweenProperty(HealthBar, "modulate",
        new Color(1f, 0.3f, 0.3f, 1f), 0.05f);
    tween.TweenProperty(HealthBar, "modulate",
        Colors.White, 0.2f);
}

// Score pop animation
private void PopScore(Label label)
{
    label.Scale = Vector2.One;
    Tween tween = label.CreateTween();
    tween.TweenProperty(label, "scale", new Vector2(1.4f, 1.4f), 0.08f);
    tween.TweenProperty(label, "scale", Vector2.One, 0.15f)
         .SetEase(Tween.EaseType.Out)
         .SetTrans(Tween.TransitionType.Elastic);
}
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Why should you place your HUD Control nodes inside a CanvasLayer?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q6')"><span class="quiz-key">A</span> It makes the UI render faster</div>
    <div class="quiz-o" onclick="qz(this,false,'q6')"><span class="quiz-key">B</span> It is required for ProgressBar to work</div>
    <div class="quiz-o" onclick="qz(this,true,'q6')"><span class="quiz-key">C</span> It detaches the UI from 3D transforms so it stays fixed on screen</div>
    <div class="quiz-o" onclick="qz(this,false,'q6')"><span class="quiz-key">D</span> It allows Control nodes to receive physics events</div>
  </div>
  <div class="quiz-fb" id="q6"></div>
</div>
