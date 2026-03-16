---
title: Scene Management
tag: Sys
sub: Switch scenes with ChangeSceneToFile, load scenes additively, use persistent autoload singletons, and build smooth transitions with CanvasLayer and AnimationPlayer.
---

## ChangeSceneToFile — Basic Scene Switching

The simplest way to move between levels or menus is `GetTree().ChangeSceneToFile()`. It unloads the current scene and loads the new one.

```csharp
// Transition to the main menu
GetTree().ChangeSceneToFile("res://Scenes/UI/MainMenu.tscn");

// Transition to the next level
GetTree().ChangeSceneToFile("res://Scenes/Levels/Level02.tscn");
```

`ChangeSceneToFile` is deferred — it queues the change for the end of the current frame, so it's safe to call from inside any `_Process` or `_PhysicsProcess` callback.

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>Do not call ChangeSceneToFile from _Ready()</strong> — The previous scene may not be fully initialized yet. Use <code>CallDeferred()</code> or trigger the transition from a button press or signal instead.</div>
</div>

## Additive Scene Loading with AddChild()

Sometimes you want to load additional content into an existing scene — for example, spawning a level chunk, a popup menu, or a boss arena without replacing everything:

```csharp
public partial class LevelManager : Node
{
    private Node _loadedChunk;

    public async void LoadChunkAsync(string path)
    {
        // Use ResourceLoader for background loading (non-blocking)
        ResourceLoader.LoadThreadedRequest(path);

        // Poll until done — in a real game, show a spinner
        while (ResourceLoader.LoadThreadedGetStatus(path)
               == ResourceLoader.ThreadLoadStatus.InProgress)
        {
            await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);
        }

        var scene = ResourceLoader.LoadThreadedGet(path) as PackedScene;
        if (scene == null) return;

        _loadedChunk = scene.Instantiate();
        AddChild(_loadedChunk);
    }

    public void UnloadChunk()
    {
        _loadedChunk?.QueueFree();
        _loadedChunk = null;
    }
}
```

For synchronous loading (fine for small scenes):

```csharp
var packed = GD.Load<PackedScene>("res://Scenes/UI/PauseMenu.tscn");
var menu   = packed.Instantiate();
AddChild(menu); // adds to current scene tree
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Instantiate vs AddChild</strong> — <code>PackedScene.Instantiate()</code> creates the node hierarchy in memory. <code>AddChild()</code> adds it to the scene tree and triggers <code>_Ready()</code>. You can do setup on the node between these two calls.</div>
</div>

## Persistent Autoloads (Singletons)

Autoloads are scenes or scripts that Godot loads before your main scene and keeps alive for the entire game session. They're perfect for global managers.

Register them in **Project → Project Settings → Autoload**:

| Name | Script/Scene | Purpose |
|------|-------------|---------|
| `GameManager` | GameManager.cs | Scene transitions, game state |
| `SaveSystem` | SaveSystem.cs | Save/load |
| `SfxManager` | SfxManager.cs | Sound effects pool |
| `MusicManager` | MusicManager.tscn | Music crossfade |

Access them from any script:

```csharp
// By node path — they live under /root/
var game  = GetNode<GameManager>("/root/GameManager");
var sfx   = GetNode<SfxManager>("/root/SfxManager");

// Or via a static accessor pattern (add this to your autoload class)
public partial class GameManager : Node
{
    public static GameManager Instance { get; private set; }

    public override void _Ready()
    {
        Instance = this;
    }
}

// Then access it anywhere without GetNode
GameManager.Instance.TransitionTo("res://Scenes/Levels/Level02.tscn");
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Autoloads are not destroyed on scene change</strong> — This is their whole purpose. All signals, state, and child nodes in an autoload persist across scene transitions. Clean up any scene-specific references in your autoloads to avoid memory leaks.</div>
</div>

## Scene Transition with CanvasLayer + AnimationPlayer

A polished transition fades to black, loads the new scene, then fades back in. Implement this in your `GameManager` autoload:

```csharp
using Godot;

public partial class GameManager : Node
{
    public static GameManager Instance { get; private set; }

    private CanvasLayer      _transitionLayer;
    private ColorRect        _overlay;
    private AnimationPlayer  _anim;
    private string           _pendingScene = "";

    public override void _Ready()
    {
        Instance = this;

        // Build the transition overlay programmatically
        _transitionLayer = new CanvasLayer { Layer = 100 };
        _overlay = new ColorRect
        {
            Color           = Colors.Black,
            AnchorRight     = 1f,
            AnchorBottom    = 1f,
            MouseFilter     = Control.MouseFilterEnum.Ignore,
            Modulate        = new Color(1, 1, 1, 0) // start transparent
        };
        _anim = new AnimationPlayer();

        AddChild(_transitionLayer);
        _transitionLayer.AddChild(_overlay);
        _transitionLayer.AddChild(_anim);

        BuildTransitionAnimations();
    }

    private void BuildTransitionAnimations()
    {
        var lib = new AnimationLibrary();

        // fade_out: alpha 0 → 1
        var fadeOut = new Animation { Length = 0.4f };
        int track = fadeOut.AddTrack(Animation.TrackType.Value);
        fadeOut.TrackSetPath(track, "../../ColorRect:modulate:a");
        fadeOut.TrackInsertKey(track, 0f, 0f);
        fadeOut.TrackInsertKey(track, 0.4f, 1f);
        lib.AddAnimation("fade_out", fadeOut);

        // fade_in: alpha 1 → 0
        var fadeIn = new Animation { Length = 0.4f };
        track = fadeIn.AddTrack(Animation.TrackType.Value);
        fadeIn.TrackSetPath(track, "../../ColorRect:modulate:a");
        fadeIn.TrackInsertKey(track, 0f, 1f);
        fadeIn.TrackInsertKey(track, 0.4f, 0f);
        lib.AddAnimation("fade_in", fadeIn);

        _anim.AddAnimationLibrary("", lib);
    }

    public async void TransitionTo(string scenePath)
    {
        _pendingScene = scenePath;

        _anim.Play("fade_out");
        await ToSignal(_anim, AnimationPlayer.SignalName.AnimationFinished);

        GetTree().ChangeSceneToFile(_pendingScene);

        // Wait one frame for the new scene to initialize
        await ToSignal(GetTree(), SceneTree.SignalName.ProcessFrame);

        _anim.Play("fade_in");
    }
}
```

Usage from any scene:

```csharp
GameManager.Instance.TransitionTo("res://Scenes/Levels/Level02.tscn");
```

## Pausing the Game

Godot's pause system uses `SceneTree.Paused` and node `ProcessMode`:

```csharp
// Pause everything
GetTree().Paused = true;

// Your pause menu must have ProcessMode = Always to receive input while paused
GetNode<Control>("PauseMenu").ProcessMode = ProcessModeEnum.Always;
```

```csharp
// Resume
GetTree().Paused = false;
GetNode<Control>("PauseMenu").Visible = false;
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">An Autoload node registered in Project Settings will be destroyed when you call <code>ChangeSceneToFile()</code>.</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q10')"><span class="quiz-key">A</span> True — all nodes are destroyed on scene change</div>
    <div class="quiz-o" onclick="qz(this,true,'q10')"><span class="quiz-key">B</span> False — Autoloads persist for the entire application lifetime</div>
    <div class="quiz-o" onclick="qz(this,false,'q10')"><span class="quiz-key">C</span> True — unless you call DontFreeOnSceneChange()</div>
    <div class="quiz-o" onclick="qz(this,false,'q10')"><span class="quiz-key">D</span> False — but they are paused during scene transitions</div>
  </div>
  <div class="quiz-fb" id="q10"></div>
</div>
