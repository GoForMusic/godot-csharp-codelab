---
title: Sound & Music System
tag: Audio
sub: Set up audio buses, play positional 3D sound effects, write a singleton SFX manager, and smoothly fade music tracks with Tween.
---

## AudioStreamPlayer vs AudioStreamPlayer3D

Godot has two primary audio player nodes, and choosing the right one matters for immersion:

<div class="grid2">
  <div class="card"><div class="card-title">AudioStreamPlayer</div><p class="card-desc">Plays audio with no 3D position — always full volume regardless of where the player is. Use for music, UI sounds, and voice-over narration.</p></div>
  <div class="card"><div class="card-title">AudioStreamPlayer3D</div><p class="card-desc">Plays audio from a point in 3D space. Volume and panning automatically attenuate based on distance to the listener (Camera3D/AudioListener3D). Use for footsteps, explosions, and ambient sounds in the world.</p></div>
</div>

```csharp
// 2D (non-positional) — attach stream in Inspector or from code
var music = GetNode<AudioStreamPlayer>("MusicPlayer");
music.Stream = GD.Load<AudioStream>("res://Assets/Audio/theme.ogg");
music.Play();

// 3D (positional) — place in scene near the sound source
var footstep = GetNode<AudioStreamPlayer3D>("FootstepPlayer");
footstep.MaxDistance = 20f;     // audible up to 20 meters
footstep.AttenuationModel = AudioStreamPlayer3D.AttenuationModelEnum.Logarithmic;
footstep.Play();
```

## AudioBus Layout

The Audio Bus Layout (Project → Project Settings → Audio → Bus Layout) is your mixer. Create dedicated buses to control volume categories independently:

<svg width="480" height="195" viewBox="0 0 480 195" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="195" fill="#080806" rx="8"/>
  <defs>
    <marker id="ab5m" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#78786e"/>
    </marker>
  </defs>
  <!-- Master -->
  <rect x="185" y="12" width="110" height="40" rx="5" fill="#0f0f0c" stroke="#f5c000" stroke-width="2"/>
  <text x="240" y="29" fill="#f5c000" font-family="monospace" font-size="12" text-anchor="middle">Master</text>
  <text x="240" y="45" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">global volume</text>
  <!-- Branch -->
  <line x1="240" y1="52" x2="240" y2="65" stroke="#78786e" stroke-width="1.5"/>
  <line x1="125" y1="65" x2="355" y2="65" stroke="#78786e" stroke-width="1.5"/>
  <line x1="125" y1="65" x2="125" y2="78" stroke="#78786e" stroke-width="1.5" marker-end="url(#ab5m)"/>
  <line x1="355" y1="65" x2="355" y2="78" stroke="#78786e" stroke-width="1.5" marker-end="url(#ab5m)"/>
  <!-- Music bus -->
  <rect x="65" y="78" width="120" height="38" rx="5" fill="#0f0f0c" stroke="#c8c8be" stroke-width="1.5"/>
  <text x="125" y="95" fill="#c8c8be" font-family="monospace" font-size="12" text-anchor="middle">Music</text>
  <text x="125" y="109" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">AudioStreamPlayer</text>
  <!-- SFX bus -->
  <rect x="295" y="78" width="120" height="38" rx="5" fill="#0f0f0c" stroke="#c8c8be" stroke-width="1.5"/>
  <text x="355" y="95" fill="#c8c8be" font-family="monospace" font-size="12" text-anchor="middle">SFX</text>
  <text x="355" y="109" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">pooled players</text>
  <!-- SFX sub-branches -->
  <line x1="355" y1="116" x2="355" y2="130" stroke="#78786e" stroke-width="1"/>
  <line x1="300" y1="130" x2="410" y2="130" stroke="#78786e" stroke-width="1"/>
  <line x1="300" y1="130" x2="300" y2="142" stroke="#78786e" stroke-width="1" marker-end="url(#ab5m)"/>
  <line x1="410" y1="130" x2="410" y2="142" stroke="#78786e" stroke-width="1" marker-end="url(#ab5m)"/>
  <!-- Sub-buses -->
  <rect x="248" y="142" width="104" height="28" rx="4" fill="#0f0f0c" stroke="#3a3a32" stroke-width="1.5"/>
  <text x="300" y="161" fill="#78786e" font-family="monospace" font-size="10" text-anchor="middle">Footsteps</text>
  <rect x="368" y="142" width="84" height="28" rx="4" fill="#0f0f0c" stroke="#3a3a32" stroke-width="1.5"/>
  <text x="410" y="161" fill="#78786e" font-family="monospace" font-size="10" text-anchor="middle">Weapons</text>
  <!-- Footer -->
  <text x="240" y="185" fill="#3a3a32" font-family="monospace" font-size="9" text-anchor="middle">AudioServer.SetBusVolumeDb(idx, db) — control any bus independently</text>
</svg>

Assign audio player nodes to buses via the **Bus** property in the Inspector, or from code:

```csharp
footstepPlayer.Bus = "SFX";
musicPlayer.Bus    = "Music";
```

Adjust bus volumes at runtime:

```csharp
// Set volume in decibels — 0 db = full, -80 db ≈ silent
int busIdx = AudioServer.GetBusIndex("Music");
AudioServer.SetBusVolumeDb(busIdx, -10f); // slightly quieter
AudioServer.SetBusMute(busIdx, false);
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Linear vs decibel</strong> — Godot's audio volumes are in decibels. To convert: <code>AudioServer.LinearToDb(0.5f)</code> ≈ −6 dB (half perceived loudness). The reverse: <code>AudioServer.DbToLinear(-6f)</code> ≈ 0.5.</div>
</div>

## SFX Manager Singleton Pattern

A singleton (Autoload) SFX manager lets any script in your game play a sound with one line of code, without needing a reference to a specific audio player node.

Create `SfxManager.cs` and register it as an Autoload in **Project → Project Settings → Autoload**:

```csharp
using Godot;
using System.Collections.Generic;

public partial class SfxManager : Node
{
    // Pool of AudioStreamPlayers reused to avoid allocation
    private const int PoolSize = 16;
    private readonly Queue<AudioStreamPlayer> _pool = new();

    public override void _Ready()
    {
        for (int i = 0; i < PoolSize; i++)
        {
            var player = new AudioStreamPlayer();
            player.Bus = "SFX";
            AddChild(player);
            _pool.Enqueue(player);
            // Return to pool when finished
            player.Finished += () => _pool.Enqueue(player);
        }
    }

    /// <summary>Play a sound effect by resource path.</summary>
    public void Play(string path, float volumeDb = 0f, float pitchScale = 1f)
    {
        if (_pool.Count == 0) return; // pool exhausted — skip

        var player = _pool.Dequeue();
        player.Stream     = GD.Load<AudioStream>(path);
        player.VolumeDb   = volumeDb;
        player.PitchScale = pitchScale;
        player.Play();
    }

    /// <summary>Play with slight random pitch variation for variety.</summary>
    public void PlayVaried(string path, float pitchMin = 0.9f, float pitchMax = 1.1f)
    {
        float pitch = (float)GD.RandRange(pitchMin, pitchMax);
        Play(path, pitchScale: pitch);
    }
}
```

Use it from anywhere:

```csharp
// In any script
SfxManager sfx = GetNode<SfxManager>("/root/SfxManager");
sfx.Play("res://Assets/Audio/coin_pickup.wav");
sfx.PlayVaried("res://Assets/Audio/footstep.wav");
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Preload frequently-used sounds</strong> — <code>GD.Load&lt;AudioStream&gt;()</code> reads from disk each call. For sounds that play many times per second (footsteps, gunshots), cache the <code>AudioStream</code> resource in a Dictionary at startup.</div>
</div>

## Fading Music with Tween

`Tween` is Godot's built-in property animator. It's perfect for smooth music crossfades without writing your own lerp loop.

```csharp
using Godot;

public partial class MusicManager : Node
{
    [Export] public AudioStreamPlayer TrackA;
    [Export] public AudioStreamPlayer TrackB;

    private AudioStreamPlayer _current;
    private AudioStreamPlayer _next;

    public override void _Ready()
    {
        _current = TrackA;
        _next    = TrackB;
        _current.Bus = "Music";
        _next.Bus    = "Music";
    }

    /// <summary>Crossfade to a new music track over <paramref name="duration"/> seconds.</summary>
    public void CrossfadeTo(AudioStream newTrack, float duration = 2f)
    {
        _next.Stream   = newTrack;
        _next.VolumeDb = -80f; // start silent
        _next.Play();

        // Fade out current, fade in next
        Tween tween = CreateTween();
        tween.SetParallel(true);
        tween.TweenProperty(_current, "volume_db", -80f, duration);
        tween.TweenProperty(_next,    "volume_db",   0f, duration);

        // After fade, stop the old track and swap references
        tween.Chain()
             .TweenCallback(Callable.From(() =>
             {
                 _current.Stop();
                 (_current, _next) = (_next, _current);
             }));
    }

    public void FadeOut(float duration = 1f)
    {
        Tween tween = CreateTween();
        tween.TweenProperty(_current, "volume_db", -80f, duration);
        tween.Chain().TweenCallback(Callable.From(() => _current.Stop()));
    }
}
```

```csharp
// Trigger from game logic
var music = GetNode<MusicManager>("/root/MusicManager");
var combatTrack = GD.Load<AudioStream>("res://Assets/Audio/combat.ogg");
music.CrossfadeTo(combatTrack, 1.5f);
```

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>OGG vs WAV</strong> — Use <strong>OGG Vorbis</strong> for music and long ambient tracks (smaller file size). Use <strong>WAV</strong> for short sound effects that need to loop seamlessly or play at precise timing. Avoid MP3 — it has encoding delay that breaks seamless loops.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">You want footsteps to sound quieter when the player is far away. Which node should you use?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q5')"><span class="quiz-key">A</span> AudioStreamPlayer with a manual volume calculation</div>
    <div class="quiz-o" onclick="qz(this,true,'q5')"><span class="quiz-key">B</span> AudioStreamPlayer3D placed at the player's feet</div>
    <div class="quiz-o" onclick="qz(this,false,'q5')"><span class="quiz-key">C</span> AudioStreamPlayer with Bus set to SFX</div>
    <div class="quiz-o" onclick="qz(this,false,'q5')"><span class="quiz-key">D</span> AudioBusLayout with distance curve</div>
  </div>
  <div class="quiz-fb" id="q5"></div>
</div>
