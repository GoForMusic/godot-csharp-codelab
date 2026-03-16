---
title: Godot Adapters
tag: SOLID
sub: Write thin adapter classes that implement your domain interfaces using Godot nodes — bridging the pure C# domain layer to the Godot engine without polluting your logic.
---

## What Is an Adapter?

In the context of Clean Architecture, an adapter is the outermost layer — it translates between the external world (Godot's API) and the inner layers (your domain and application code).

An adapter answers: **"How does Godot's AudioStreamPlayer satisfy the IAudioService contract?"**

```
Domain defines: IAudioService.PlaySfx(string event)
                        ↓
Adapter implements: GodotAudioService : IAudioService
                        uses: AudioStreamPlayer3D.Play()
```

The domain never knows that Godot exists. The adapter knows about both.

<svg width="480" height="200" viewBox="0 0 480 200" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="200" fill="#0a0c12" rx="8"/>
  <!-- Domain box -->
  <rect x="20" y="60" width="140" height="80" rx="6" fill="none" stroke="#e8edf8" stroke-width="2"/>
  <text x="90" y="95" fill="#e8edf8" font-family="monospace" font-size="12" text-anchor="middle">Domain</text>
  <text x="90" y="115" fill="#8892aa" font-family="monospace" font-size="10" text-anchor="middle">IAudioService</text>
  <!-- Arrow -->
  <line x1="160" y1="100" x2="200" y2="100" stroke="#3d8ef0" stroke-width="2" marker-end="url(#arr)"/>
  <defs><marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#3d8ef0"/></marker></defs>
  <!-- Adapter box -->
  <rect x="200" y="40" width="140" height="120" rx="6" fill="none" stroke="#3d8ef0" stroke-width="2"/>
  <text x="270" y="75" fill="#3d8ef0" font-family="monospace" font-size="12" text-anchor="middle">Adapter</text>
  <text x="270" y="95" fill="#8892aa" font-family="monospace" font-size="10" text-anchor="middle">GodotAudioService</text>
  <text x="270" y="115" fill="#8892aa" font-family="monospace" font-size="10" text-anchor="middle">: IAudioService</text>
  <!-- Arrow -->
  <line x1="340" y1="100" x2="380" y2="100" stroke="#00e5c0" stroke-width="2" marker-end="url(#arr2)"/>
  <defs><marker id="arr2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#00e5c0"/></marker></defs>
  <!-- Godot box -->
  <rect x="380" y="60" width="80" height="80" rx="6" fill="none" stroke="#00e5c0" stroke-width="2"/>
  <text x="420" y="95" fill="#00e5c0" font-family="monospace" font-size="10" text-anchor="middle">Godot</text>
  <text x="420" y="110" fill="#8892aa" font-family="monospace" font-size="9" text-anchor="middle">AudioStream</text>
  <text x="420" y="124" fill="#8892aa" font-family="monospace" font-size="9" text-anchor="middle">Player3D</text>
</svg>

## GodotAudioService Adapter

```csharp
// Scripts/Adapters/GodotAudioService.cs
using Godot;
using System.Collections.Generic;

public class GodotAudioService : IAudioService
{
    private readonly SfxManager   _sfx;
    private readonly MusicManager _music;

    // Map event names to resource paths — data-driven
    private readonly Dictionary<string, string> _sfxPaths = new()
    {
        ["hit_flesh"]  = "res://Assets/Audio/hit_flesh.wav",
        ["hit_blocked"]= "res://Assets/Audio/hit_blocked.wav",
        ["pickup"]     = "res://Assets/Audio/pickup.wav",
        ["enemy_alert"]= "res://Assets/Audio/enemy_alert.wav",
        ["use_item"]   = "res://Assets/Audio/use_item.wav",
    };

    public GodotAudioService(SfxManager sfx, MusicManager music)
    {
        _sfx   = sfx;
        _music = music;
    }

    public void PlaySfx(string eventName)
    {
        if (_sfxPaths.TryGetValue(eventName, out string path))
            _sfx.Play(path);
        else
            GD.PushWarning($"GodotAudioService: unknown SFX event '{eventName}'");
    }

    public void PlayMusic(string trackName, float fadeIn = 0f)
    {
        var track = GD.Load<AudioStream>($"res://Assets/Audio/Music/{trackName}.ogg");
        if (track != null)
            _music.CrossfadeTo(track, fadeIn);
    }

    public void StopMusic(float fadeOut = 0f) => _music.FadeOut(fadeOut);

    public void SetBusVolume(string bus, float normalizedVolume)
    {
        int idx = AudioServer.GetBusIndex(bus);
        if (idx >= 0)
            AudioServer.SetBusVolumeDb(idx,
                AudioServer.LinearToDb(normalizedVolume));
    }
}
```

## GodotNavigationProvider Adapter

```csharp
// Scripts/Adapters/GodotNavigationProvider.cs
using Godot;
using System.Collections.Generic;

public class GodotNavigationProvider : INavigationProvider
{
    // Map entity IDs to their NavigationAgent3D nodes
    private readonly Dictionary<string, NavigationAgent3D> _agents = new();

    public void Register(string entityId, NavigationAgent3D agent)
    {
        _agents[entityId] = agent;
    }

    public void RequestPath(string entityId)
    {
        // Path is set via TargetPosition — navigation runs automatically
        // This method is a hook if you need to force a refresh
    }

    public System.Numerics.Vector3 GetNextPosition(string entityId,
        System.Numerics.Vector3 currentPos)
    {
        if (!_agents.TryGetValue(entityId, out var agent))
            return currentPos; // no agent — stay put

        if (agent.IsNavigationFinished())
            return currentPos;

        var godotNext = agent.GetNextPathPosition();
        return new System.Numerics.Vector3(godotNext.X, godotNext.Y, godotNext.Z);
    }

    public bool IsPathFinished(string entityId)
        => !_agents.TryGetValue(entityId, out var agent)
           || agent.IsNavigationFinished();

    public void SetTarget(string entityId, System.Numerics.Vector3 target)
    {
        if (_agents.TryGetValue(entityId, out var agent))
            agent.TargetPosition = new Vector3(target.X, target.Y, target.Z);
    }
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>System.Numerics vs Godot math</strong> — The domain layer uses <code>System.Numerics.Vector3</code> to avoid the Godot dependency. Adapters convert between the two. This is a thin cost — the conversion is just field access — and keeps the domain testable without Godot.</div>
</div>

## GodotSaveRepository Adapter

```csharp
// Scripts/Adapters/GodotSaveRepository.cs
using Godot;
using System.Text.Json;

public class GodotSaveRepository : ISaveRepository
{
    private const string Path = "user://save.json";

    private static readonly JsonSerializerOptions Options = new()
    {
        WriteIndented = true
    };

    public void Save(SaveData data)
    {
        string json = JsonSerializer.Serialize(data, Options);
        using var file = FileAccess.Open(Path, FileAccess.ModeFlags.Write);
        if (file == null)
        {
            GD.PrintErr($"SaveRepository: cannot open {Path} — {FileAccess.GetOpenError()}");
            return;
        }
        file.StoreString(json);
    }

    public SaveData? Load()
    {
        if (!FileAccess.FileExists(Path)) return null;
        using var file = FileAccess.Open(Path, FileAccess.ModeFlags.Read);
        if (file == null) return null;
        try
        {
            return JsonSerializer.Deserialize<SaveData>(file.GetAsText(), Options);
        }
        catch (JsonException)
        {
            GD.PrintErr("SaveRepository: corrupt save file");
            return null;
        }
    }

    public bool HasSave() => FileAccess.FileExists(Path);

    public void Delete()
    {
        if (HasSave())
            DirAccess.RemoveAbsolute(ProjectSettings.GlobalizePath(Path));
    }
}
```

## GodotVfxService Adapter

```csharp
// Scripts/Adapters/GodotVfxService.cs
using Godot;

public class GodotVfxService : IVfxService
{
    private readonly VFXManager _vfx;

    public GodotVfxService(VFXManager vfx)
    {
        _vfx = vfx;
    }

    public void SpawnHitEffect(System.Numerics.Vector3 position, DamageResult damage)
    {
        var pos = new Vector3(position.X, position.Y, position.Z);

        if (damage.KilledTarget)
            _vfx.PlayEffect("death_burst", pos);
        else if (damage.MitigatedDamage > damage.RawDamage * 0.5f)
            _vfx.PlayEffect("hit_blocked", pos);
        else
            _vfx.PlayEffect("hit_spark", pos);
    }

    public void SpawnPickupEffect(System.Numerics.Vector3 position, string itemId)
    {
        var pos = new Vector3(position.X, position.Y, position.Z);
        _vfx.PlayEffect("pickup_sparkle", pos);
    }
}
```

## Testing with Fake Adapters

The power of adapters: swap the real Godot implementation for a fake in tests:

```csharp
// Tests/Fakes/FakeAudioService.cs
public class FakeAudioService : IAudioService
{
    public List<string> PlayedSfx  { get; } = new();
    public string?      CurrentMusic { get; private set; }

    public void PlaySfx(string eventName) => PlayedSfx.Add(eventName);
    public void PlayMusic(string t, float f = 0f) => CurrentMusic = t;
    public void StopMusic(float f = 0f) => CurrentMusic = null;
    public void SetBusVolume(string bus, float vol) { }
}

// Test that verifies CombatSystem plays hit sound
[Fact]
public void Attack_PlaysHitSfx()
{
    var audio  = new FakeAudioService();
    var combat = new CombatSystem(audio, new FakeVfxService());

    var attacker = new CharacterStats("a", "Hero",  100f);
    var target   = new CharacterStats("t", "Enemy", 50f);
    combat.Attack(attacker, target, new AttackData(multiplier: 1f));

    Assert.Contains("hit_flesh", audio.PlayedSfx);
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Adapters are thin by design</strong> — An adapter should contain almost no logic. If you find yourself writing game rules inside an adapter, that logic belongs in the domain or application layer. Adapters translate; they do not decide.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Which layer should an adapter class belong to?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q21')"><span class="quiz-key">A</span> The domain layer, next to entities</div>
    <div class="quiz-o" onclick="qz(this,false,'q21')"><span class="quiz-key">B</span> The application layer, next to systems</div>
    <div class="quiz-o" onclick="qz(this,true,'q21')"><span class="quiz-key">C</span> The infrastructure/outermost layer — it depends on both the interface contract and the Godot API</div>
    <div class="quiz-o" onclick="qz(this,false,'q21')"><span class="quiz-key">D</span> A separate project with no access to domain code</div>
  </div>
  <div class="quiz-fb" id="q21"></div>
</div>
