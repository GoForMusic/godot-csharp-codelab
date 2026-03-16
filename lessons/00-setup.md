---
title: Setup & Project Structure
tag: 3D
sub: Create a Godot 4 C# project from scratch and understand the folder layout, path system, and scene tree basics.
---

## Creating a Godot 4 C# Project

When you launch Godot 4, click **New Project** and choose a blank template. The critical step is selecting **.NET** as the renderer variant — this enables C# support. Godot will generate a `.csproj` file alongside the project file.

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>SDK Requirement</strong> — You must have the <strong>.NET 8 SDK</strong> (or later) installed before Godot can compile C# scripts. Download it from <code>dotnet.microsoft.com</code>. Run <code>dotnet --version</code> in a terminal to confirm.</div>
</div>

Your project folder after creation will look like this:

```
MyGame/
├── project.godot        ← Godot project settings
├── MyGame.csproj        ← .NET project file
├── MyGame.sln           ← Solution file (optional, for IDEs)
└── .godot/              ← Generated cache (do not edit)
```

## The .csproj File

Godot generates a minimal `.csproj` that references the `Godot.NET.Sdk`:

```xml
<Project Sdk="Godot.NET.Sdk/4.3.0">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <EnableDynamicLoading>true</EnableDynamicLoading>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
  </PropertyGroup>
</Project>
```

You can add NuGet packages here just like any .NET project. Common additions include `System.Text.Json` (already in .NET 8) and testing libraries like `GdUnit4`.

## res:// vs user:// Paths

Godot uses two virtual path prefixes instead of OS-specific paths:

<div class="grid2">
  <div class="card"><div class="card-title">res://</div><p class="card-desc">Maps to your project root. Read-only at runtime in exported builds. Use this for scenes, scripts, textures — anything shipped with the game.</p></div>
  <div class="card"><div class="card-title">user://</div><p class="card-desc">Maps to a writable OS-specific folder (AppData on Windows, ~/.local on Linux). Use this for save files, settings, and logs.</p></div>
</div>

```csharp
// Reading a config shipped with the game
string path = "res://data/enemies.json";

// Writing a save file
string savePath = "user://save.json";
using var file = FileAccess.Open(savePath, FileAccess.ModeFlags.Write);
file.StoreString(jsonData);
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>OS.GetUserDataDir()</strong> — Call this method to find the actual filesystem path behind <code>user://</code>, useful when debugging save file issues.</div>
</div>

## Recommended Folder Structure

Keeping your project organized from day one saves significant refactoring later. A proven layout for Godot 4 C# projects:

```
res://
├── Scripts/
│   ├── Player/
│   ├── Enemies/
│   ├── UI/
│   └── Systems/
├── Scenes/
│   ├── Levels/
│   ├── Player/
│   └── UI/
├── Assets/
│   ├── Models/
│   ├── Textures/
│   ├── Audio/
│   └── Fonts/
└── Addons/          ← third-party plugins go here
```

Each `.cs` script should live next to or near the `.tscn` scene that uses it. This makes refactoring much easier than dumping all scripts in a flat folder.

## Scene Tree Basics

Every Godot game is built from a **scene tree** — a hierarchy of nodes. At runtime `GetTree()` returns the `SceneTree`, and `GetTree().Root` is the topmost `Window` node.

<div class="scene-tree">
  <div class="st-row"><span class="st-icon">🪟</span> <span class="st-name">Root</span> <span class="st-type">Window</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🌐</span> <span class="st-name">World</span> <span class="st-type">Node3D</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">🎮</span> <span class="st-name">Player</span> <span class="st-type">CharacterBody3D</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">🌄</span> <span class="st-name">Environment</span> <span class="st-type">WorldEnvironment</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">💡</span> <span class="st-name">Sun</span> <span class="st-type">DirectionalLight3D</span></div>
</div>

Key node types to know from the start:

| Node | Purpose |
|------|---------|
| `Node` | Base class, no transform |
| `Node3D` | Base for all 3D nodes, has Transform3D |
| `Window` | The root; also used for popup windows |
| `SceneTree` | Runtime manager — pause, change scene, quit |

```csharp
public partial class World : Node3D
{
    public override void _Ready()
    {
        // SceneTree is always available via GetTree()
        GD.Print(GetTree().Root.Name); // "root"
        GD.Print(GetPath());           // /root/World
    }
}
```

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>_Ready() timing</strong> — <code>_Ready()</code> is called after the node <em>and all its children</em> have entered the scene tree. Never try to access child nodes in the constructor — use <code>_Ready()</code> instead.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Which path prefix should you use when writing a player save file at runtime?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q0')"><span class="quiz-key">A</span> res://saves/save.json</div>
    <div class="quiz-o" onclick="qz(this,true,'q0')"><span class="quiz-key">B</span> user://save.json</div>
    <div class="quiz-o" onclick="qz(this,false,'q0')"><span class="quiz-key">C</span> file://save.json</div>
    <div class="quiz-o" onclick="qz(this,false,'q0')"><span class="quiz-key">D</span> C:/saves/save.json</div>
  </div>
  <div class="quiz-fb" id="q0"></div>
</div>
