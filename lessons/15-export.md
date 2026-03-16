---
title: Export & Deploy
tag: Export
sub: Configure export presets for Windows, Linux, Web, and macOS, understand .NET export requirements, and know the difference between PCK and self-contained builds.
---

## Export Presets Overview

Godot exports are configured in **Project → Export**. Each platform needs its own preset with the matching export template installed. Download templates via **Editor → Manage Export Templates**.

<div class="grid2">
  <div class="card"><div class="card-title">Desktop Platforms</div><p class="card-desc">Windows (.exe), Linux (ELF binary), macOS (.app bundle). Straightforward — install the template, set the output path, export.</p></div>
  <div class="card"><div class="card-title">Web (HTML5)</div><p class="card-desc">Exports to an HTML + WASM + PCK bundle. Requires a web server with specific CORS headers to run. Cannot simply open the .html file locally.</p></div>
</div>

## .NET Export Requirements

C# / .NET exports have additional requirements compared to GDScript projects:

**1. .NET SDK must be installed on the build machine.** Godot calls `dotnet publish` internally during export.

**2. Choose Ahead-of-Time (AOT) or JIT:**

| Mode | Compatibility | File size | Startup |
|------|--------------|-----------|---------|
| JIT (default) | Most platforms | Smaller | Slower first run |
| AOT (NativeAOT) | Windows, Linux, macOS, Web | Larger | Faster |

Enable AOT in the export preset → Options → `Use AOT`.

**3. Add to your `.csproj` for Web/NativeAOT:**

```xml
<PropertyGroup Condition="'$(GodotTargetPlatform)' == 'web'">
  <WasmNativeStrip>true</WasmNativeStrip>
  <PublishTrimmed>true</PublishTrimmed>
</PropertyGroup>
```

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>Reflection and trimming</strong> — NativeAOT/trimming removes code that appears unused. If you use <code>System.Text.Json</code> with reflection-based serialization, it will break. Use source-generated serialization (<code>[JsonSerializable]</code> context) for AOT-safe JSON.</div>
</div>

## PCK Files vs Self-Contained

When you export, you get two main distribution options:

**Embed PCK (self-contained / single file):**
- Everything packed into one `.exe` / binary
- Larger file, but simplest distribution
- Enable in Export Preset → Options → **Embed PCK**

**Separate PCK file:**
- `MyGame.exe` + `MyGame.pck` (data file)
- Smaller binary; useful for patches (replace just the .pck)
- Required for web exports (you get `.html`, `.js`, `.wasm`, `.pck`)

```
# Desktop self-contained:
MyGame.exe   (includes all game data)

# Desktop with separate PCK:
MyGame.exe
MyGame.pck

# Web export output:
index.html
index.js
index.wasm
index.pck
index.png       (loading screen)
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Patch workflow</strong> — For live-service games, export with a separate PCK each update. Players download only the new <code>.pck</code>, not the full executable. Versioning the PCK filename (e.g., <code>game_v1.2.pck</code>) avoids browser/OS caching issues.</div>
</div>

## Windows Export

```
1. Add Export Preset → Windows Desktop
2. Set "Export Path" to: builds/windows/MyGame.exe
3. Options:
   - Architecture: x86_64 (recommended)
   - Embed PCK: checked (for simpler distribution)
4. Resources → Filters: exclude dev assets (*.blend, *.psd)
5. Click "Export Project"
```

For code signing (required to avoid Windows SmartScreen warnings), you need a code signing certificate and use `signtool.exe` after export.

## macOS Export

macOS exports require:
- A `.app` bundle structure
- Code signing with an Apple Developer certificate (required for Gatekeeper)
- Notarization for distribution outside the App Store

```
Export Preset → macOS
Output: builds/macos/MyGame.app

Code Signing:
  - Identity: "Developer ID Application: Your Name"
  - Notarization: enabled (requires Apple account)
```

Without signing, users will see "cannot be opened because the developer cannot be verified."

## Web Export + CORS Headers

Web exports require the server to send specific HTTP headers for SharedArrayBuffer (needed for threading):

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**itch.io**: Enable "SharedArrayBuffer" support in your game's upload settings.

**GitHub Pages**: Does not support these headers by default — use a worker-based workaround or a different host.

**Local testing**: Use Python's `http.server` with a custom handler, or use the Godot editor's built-in local server (Run in Browser option).

```python
# Simple Python server with required headers for testing
import http.server

class CORSHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cross-Origin-Opener-Policy", "same-origin")
        self.send_header("Cross-Origin-Embedder-Policy", "require-corp")
        super().end_headers()

http.server.HTTPServer(("", 8080), CORSHandler).serve_forever()
```

## Export Filters

Exclude development assets to keep the build lean:

```
# In Export Preset → Resources → Filters to exclude:
*.blend
*.psd
*.ai
*.xcf
docs/*
*.md
tests/*
```

Include only necessary resources:

```
# Resources → Export Mode:
# "Export all resources in the project" — safest default
# "Export selected scenes and dependencies" — most efficient for large projects
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Debug vs Release export</strong> — Debug exports include the Godot debugger and remote scene inspector (useful for QA). Release exports are stripped and smaller. Always test a Release export before publishing — the behavior can differ slightly from Debug.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Why does a Godot Web export fail to run when you open the HTML file directly in a browser (file:// protocol)?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q15')"><span class="quiz-key">A</span> The WASM file must be compiled before opening</div>
    <div class="quiz-o" onclick="qz(this,true,'q15')"><span class="quiz-key">B</span> The browser blocks SharedArrayBuffer on file:// due to missing CORS security headers, which require a web server</div>
    <div class="quiz-o" onclick="qz(this,false,'q15')"><span class="quiz-key">C</span> Godot Web exports only work in Chrome</div>
    <div class="quiz-o" onclick="qz(this,false,'q15')"><span class="quiz-key">D</span> The PCK file must be on the same domain as the HTML</div>
  </div>
  <div class="quiz-fb" id="q15"></div>
</div>
