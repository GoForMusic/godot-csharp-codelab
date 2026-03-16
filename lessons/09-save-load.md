---
title: Save & Load System
tag: Sys
sub: Persist player progress using FileAccess, serialize game state to JSON with System.Text.Json, and implement auto-save on scene transitions.
---

## FileAccess.Open() — Reading and Writing

Godot wraps OS file I/O in the `FileAccess` class. Always use `user://` for save files — it's writable in both the editor and exported builds.

```csharp
// Writing a file
using var writer = FileAccess.Open("user://save.json",
    FileAccess.ModeFlags.Write);

if (writer == null)
{
    GD.PrintErr($"Failed to open save file: {FileAccess.GetOpenError()}");
    return;
}

writer.StoreString(jsonContent);
// File is closed automatically when 'using' block exits
```

```csharp
// Reading a file
if (!FileAccess.FileExists("user://save.json"))
{
    GD.Print("No save file found — starting fresh");
    return null;
}

using var reader = FileAccess.Open("user://save.json",
    FileAccess.ModeFlags.Read);
string json = reader.GetAsText();
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Always check for null</strong> — <code>FileAccess.Open()</code> returns <code>null</code> on failure (permissions error, disk full, etc.) rather than throwing. Check the return value and use <code>FileAccess.GetOpenError()</code> for diagnostics.</div>
</div>

## SaveData Record Class

Use a C# `record` as your data container — it gives you value equality and a clean syntax for initialization:

```csharp
using System.Collections.Generic;
using System.Text.Json.Serialization;

public record SaveData
{
    [JsonPropertyName("version")]      public int Version         { get; init; } = 1;
    [JsonPropertyName("player_name")]  public string PlayerName   { get; init; } = "Hero";
    [JsonPropertyName("level")]        public string CurrentLevel { get; init; } = "res://Scenes/Levels/Level01.tscn";
    [JsonPropertyName("health")]       public float Health        { get; init; } = 100f;
    [JsonPropertyName("position")]     public SavedVector3 Position { get; init; } = new();
    [JsonPropertyName("score")]        public int Score           { get; init; } = 0;
    [JsonPropertyName("inventory")]    public Dictionary<string, int> Inventory { get; init; } = new();
    [JsonPropertyName("flags")]        public HashSet<string> CompletedFlags { get; init; } = new();
}

// Godot's Vector3 is not JSON-serializable — use a plain DTO
public record SavedVector3(float X = 0f, float Y = 0f, float Z = 0f)
{
    public Vector3 ToGodot() => new(X, Y, Z);
    public static SavedVector3 FromGodot(Vector3 v) => new(v.X, v.Y, v.Z);
}
```

## JSON Serialization with System.Text.Json

.NET 8's built-in JSON library requires no extra NuGet packages:

```csharp
using System.Text.Json;
using System.Text.Json.Serialization;
using Godot;

public partial class SaveSystem : Node
{
    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented      = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private const string SavePath = "user://save.json";

    public void Save(SaveData data)
    {
        string json = JsonSerializer.Serialize(data, Options);

        using var file = FileAccess.Open(SavePath, FileAccess.ModeFlags.Write);
        if (file == null)
        {
            GD.PrintErr("SaveSystem: Cannot open file for writing");
            return;
        }

        file.StoreString(json);
        GD.Print("Game saved.");
    }

    public SaveData? Load()
    {
        if (!FileAccess.FileExists(SavePath))
            return null;

        using var file = FileAccess.Open(SavePath, FileAccess.ModeFlags.Read);
        if (file == null) return null;

        string json = file.GetAsText();

        try
        {
            return JsonSerializer.Deserialize<SaveData>(json, Options);
        }
        catch (JsonException ex)
        {
            GD.PrintErr($"SaveSystem: Corrupt save file — {ex.Message}");
            return null;
        }
    }

    public void DeleteSave()
    {
        if (FileAccess.FileExists(SavePath))
            DirAccess.RemoveAbsolute(ProjectSettings
                .GlobalizePath(SavePath));
    }
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Source-generated JSON</strong> — For AOT-compatible (Web/NativeAOT) exports, use <code>[JsonSerializable]</code> source generation instead of reflection-based serialization. Create a <code>JsonSerializerContext</code> class and pass it to the serializer options.</div>
</div>

## Applying Loaded Data to the Game

```csharp
public partial class GameManager : Node
{
    [Export] public SaveSystem SaveSystem;
    [Export] public PlayerController Player;
    [Export] public PlayerHealth PlayerHealth;

    private SaveData? _currentSave;

    public void StartNewGame()
    {
        _currentSave = new SaveData();
        ApplySaveData(_currentSave);
    }

    public void LoadGame()
    {
        _currentSave = SaveSystem.Load() ?? new SaveData();
        ApplySaveData(_currentSave);

        // Change to saved level
        GetTree().ChangeSceneToFile(_currentSave.CurrentLevel);
    }

    private void ApplySaveData(SaveData data)
    {
        Player.GlobalPosition = data.Position.ToGodot();
        PlayerHealth.SetHealth(data.Health);
        // ...restore inventory, flags, etc.
    }

    private SaveData BuildSaveData() => new SaveData
    {
        CurrentLevel = GetTree().CurrentScene.SceneFilePath,
        Health       = PlayerHealth.Current,
        Position     = SavedVector3.FromGodot(Player.GlobalPosition),
        Score        = ScoreSystem.Score,
        // ...capture inventory, completed flags, etc.
    };
}
```

## Auto-Save on Scene Change

Hook into Godot's scene change signal to auto-save before transitioning:

```csharp
public partial class GameManager : Node
{
    public override void _Ready()
    {
        // SceneTree fires this before unloading the current scene
        GetTree().NodeRemoved += OnNodeRemoved;
    }

    // Better approach: connect to your own scene-change wrapper
    public void TransitionToScene(string path)
    {
        // Save before leaving
        SaveSystem.Save(BuildSaveData());

        // Then change scene
        GetTree().ChangeSceneToFile(path);
    }
}
```

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>Never save mid-combat</strong> — Auto-save at safe checkpoints (scene transitions, rest areas) rather than on every frame. Frequent disk writes can cause stutters and wear on SSDs if called every second.</div>
</div>

## Save File Versioning

Always include a version number in your save file. Check it when loading and migrate old saves:

```csharp
public SaveData? Load()
{
    var raw = LoadRaw();
    if (raw == null) return null;

    return raw.Version switch
    {
        1    => MigrateV1ToV2(raw),
        2    => raw,
        _    => null  // unknown version — discard
    };
}

private SaveData MigrateV1ToV2(SaveData v1)
{
    // Version 2 added the "inventory" field — provide a default
    return v1 with { Version = 2, Inventory = new() };
}
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Why is Godot's Vector3 not directly JSON-serializable with System.Text.Json?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q9')"><span class="quiz-key">A</span> System.Text.Json only supports primitive types</div>
    <div class="quiz-o" onclick="qz(this,true,'q9')"><span class="quiz-key">B</span> Vector3 is a Godot engine struct without JSON property attributes, and its internal layout is opaque to the serializer</div>
    <div class="quiz-o" onclick="qz(this,false,'q9')"><span class="quiz-key">C</span> You must use Newtonsoft.Json for all Godot types</div>
    <div class="quiz-o" onclick="qz(this,false,'q9')"><span class="quiz-key">D</span> 3D vectors cannot be represented in JSON format</div>
  </div>
  <div class="quiz-fb" id="q9"></div>
</div>
