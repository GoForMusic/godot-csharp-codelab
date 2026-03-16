---
title: Final Project
tag: 3D
sub: Combine all learned systems into a complete mini-game — player controller, enemy AI, HUD, save system, and scene management wired together.
---

## Project Overview

The final project is a small 3D action game demonstrating every system covered in this course. The player explores an arena, collects coins, defeats enemies, and the game saves progress automatically when transitioning between rooms.

<div class="grid2">
  <div class="card"><div class="card-title">Systems Used</div><p class="card-desc">Player movement, camera, animations, sound, HUD, signals, enemy AI, save/load, and scene transitions — all integrated.</p></div>
  <div class="card"><div class="card-title">Scope</div><p class="card-desc">Two playable levels, three enemy types, a persistent score, health system, and main menu with save/load functionality.</p></div>
</div>

## Scene Structure Diagram

```
res://
├── Scenes/
│   ├── Autoloads/
│   │   ├── GameManager.tscn    ← scene transitions, game state
│   │   ├── SfxManager.tscn     ← sound effects pool
│   │   └── MusicManager.tscn   ← music crossfade
│   ├── Levels/
│   │   ├── MainMenu.tscn
│   │   ├── Level01.tscn
│   │   └── Level02.tscn
│   ├── Player/
│   │   └── Player.tscn         ← CharacterBody3D + camera + HUD
│   ├── Enemies/
│   │   ├── Grunt.tscn
│   │   └── Archer.tscn
│   └── UI/
│       ├── HUD.tscn
│       └── PauseMenu.tscn
```

<div class="scene-tree">
  <div class="st-row"><span class="st-icon">🌐</span> <span class="st-name">Level01</span> <span class="st-type">Node3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🗺️</span> <span class="st-name">NavRegion</span> <span class="st-type">NavigationRegion3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🌄</span> <span class="st-name">Environment</span> <span class="st-type">WorldEnvironment</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🧍</span> <span class="st-name">Player</span> <span class="st-type">CharacterBody3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">👾</span> <span class="st-name">Enemies</span> <span class="st-type">Node3D</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">🤖</span> <span class="st-name">Grunt01</span> <span class="st-type">CharacterBody3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">💰</span> <span class="st-name">Collectibles</span> <span class="st-type">Node3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🖥️</span> <span class="st-name">HUD</span> <span class="st-type">CanvasLayer</span></div>
</div>

## Main Game Loop Pattern

```csharp
using Godot;

public partial class Level01 : Node3D
{
    [Export] public PackedScene EnemyScene;
    [Export] public int EnemiesRequired = 5;

    private int _enemiesDefeated = 0;
    private HUD _hud;

    public override void _Ready()
    {
        _hud = GetNode<HUD>("HUD");

        // Wire up player signals
        var health = GetNode<PlayerHealth>("Player/HealthComponent");
        health.HealthChanged += _hud.SetHealth;
        health.Died          += OnPlayerDied;

        // Wire up each enemy
        foreach (Node3D enemy in GetNode("Enemies").GetChildren())
        {
            if (enemy is Enemy e)
            {
                e.Died     += OnEnemyDefeated;
                e.DroppedLoot += OnLootDropped;
            }
        }

        // Wire up collectibles
        foreach (Node3D coin in GetNode("Collectibles").GetChildren())
        {
            if (coin is Coin c)
                c.Collected += (id, qty, _) => _hud.AddScore(qty * 10);
        }
    }

    private void OnEnemyDefeated()
    {
        _enemiesDefeated++;
        _hud.SetObjective($"Enemies: {_enemiesDefeated}/{EnemiesRequired}");

        if (_enemiesDefeated >= EnemiesRequired)
            LevelComplete();
    }

    private void OnLootDropped(string itemId, int qty)
    {
        GD.Print($"Loot: {itemId} x{qty}");
    }

    private void LevelComplete()
    {
        // Save progress then transition
        GameManager.Instance.SaveAndTransition("res://Scenes/Levels/Level02.tscn");
    }

    private void OnPlayerDied()
    {
        _hud.ShowGameOver();
        GetTree().Paused = true;
    }
}
```

## Wiring It All Together

The `GameManager` autoload holds global state and orchestrates transitions:

```csharp
public partial class GameManager : Node
{
    public static GameManager Instance { get; private set; }

    public int   TotalScore   { get; private set; }
    public float PlayerHealth { get; private set; } = 100f;

    private SaveSystem _save;

    public override void _Ready()
    {
        Instance = this;
        _save    = GetNode<SaveSystem>("SaveSystem");
    }

    public void AddScore(int points)
    {
        TotalScore += points;
    }

    public void SaveAndTransition(string scenePath)
    {
        _save.Save(new SaveData
        {
            Score        = TotalScore,
            Health       = PlayerHealth,
            CurrentLevel = scenePath,
        });
        TransitionTo(scenePath);
    }

    public async void TransitionTo(string scenePath)
    {
        // Play fade-out (implementation from lesson 10)
        await FadeOut();
        GetTree().ChangeSceneToFile(scenePath);
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        await FadeIn();
    }

    private async System.Threading.Tasks.Task FadeOut()
        => await ToSignal(GetNode<AnimationPlayer>("AnimPlayer")
            .PlayAndWaitFinished("fade_out"), "completed");

    private async System.Threading.Tasks.Task FadeIn()
        => await ToSignal(GetNode<AnimationPlayer>("AnimPlayer")
            .PlayAndWaitFinished("fade_in"), "completed");
}
```

## Polish Checklist

Before calling your project "done", work through these common oversights:

<div class="grid2">
  <div class="card"><div class="card-title">Gameplay Feel</div><p class="card-desc">Coyote time for jumps, screenshake on hit, sound variation with random pitch, enemy death animations, and item pickup feedback.</p></div>
  <div class="card"><div class="card-title">UI/UX</div><p class="card-desc">Pause menu with resume/quit, settings screen for audio volume, loading screen between levels, and clear objective text.</p></div>
  <div class="card"><div class="card-title">Stability</div><p class="card-desc">null-check all exported node references in _Ready(), handle corrupt save files gracefully, and set Physics layers correctly on all bodies.</p></div>
  <div class="card"><div class="card-title">Performance</div><p class="card-desc">Pool particle effects and audio players, use NavigationAgent path refresh rate limit, bake lighting, and profile with Godot's built-in Monitor.</p></div>
</div>

## Debugging Helpers

```csharp
// Draw the navmesh in the editor (disable at export)
// Project Settings → Debug → Navigation → Show Navigation Mesh

// Print the full scene tree for debugging
void PrintTree(Node node, int depth = 0)
{
    GD.Print(new string(' ', depth * 2) + node.Name + " [" + node.GetType().Name + "]");
    foreach (Node child in node.GetChildren())
        PrintTree(child, depth + 1);
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Godot Remote Debugger</strong> — While the game is running in the editor, the Remote tab in the Scene dock shows the live scene tree. You can inspect node properties at runtime without adding print statements.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Which autoload should handle scene transitions, ensuring a fade animation plays before the scene changes?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q11')"><span class="quiz-key">A</span> The current level's root node</div>
    <div class="quiz-o" onclick="qz(this,false,'q11')"><span class="quiz-key">B</span> The HUD CanvasLayer</div>
    <div class="quiz-o" onclick="qz(this,true,'q11')"><span class="quiz-key">C</span> A persistent GameManager autoload with its own CanvasLayer overlay</div>
    <div class="quiz-o" onclick="qz(this,false,'q11')"><span class="quiz-key">D</span> The Player node via a static method</div>
  </div>
  <div class="quiz-fb" id="q11"></div>
</div>
