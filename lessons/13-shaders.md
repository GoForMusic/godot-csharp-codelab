---
title: Custom Shaders
tag: Shaders
sub: Write GLSL-based spatial shaders in Godot 4, use uniforms and the TIME built-in, and implement a dissolve effect driven from C# code.
---

## ShaderMaterial vs StandardMaterial3D

Godot 4 offers two material systems for 3D objects:

<div class="grid2">
  <div class="card"><div class="card-title">StandardMaterial3D</div><p class="card-desc">A node-based PBR material with no code. Covers albedo, metallic, roughness, normal maps, emission, and more. Use this for 95% of surfaces.</p></div>
  <div class="card"><div class="card-title">ShaderMaterial</div><p class="card-desc">Attach a <code>.gdshader</code> file for full custom control. Required for dissolve, water, hologram, outline, and any effect that StandardMaterial3D cannot produce.</p></div>
</div>

Create a ShaderMaterial by selecting a mesh → Material → New ShaderMaterial → Shader → New Shader. Save the shader as `res://Assets/Shaders/dissolve.gdshader`.

## shader_type spatial — Vertex and Fragment

Godot shaders use a GLSL-like syntax. The `spatial` type is for 3D surfaces:

```glsl
shader_type spatial;

// render_mode controls blending, depth, culling
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_burley, specular_schlick_ggx;

// Uniforms — exposed to Inspector and settable from C#
uniform vec4  albedo_color : source_color = vec4(1.0);
uniform sampler2D albedo_texture : source_color, hint_default_white;
uniform float roughness : hint_range(0.0, 1.0) = 0.5;
uniform float metallic  : hint_range(0.0, 1.0) = 0.0;

void vertex()
{
    // VERTEX is in model space — modify to deform the mesh
    // e.g., wave effect: VERTEX.y += sin(VERTEX.x * 2.0 + TIME) * 0.1;
}

void fragment()
{
    // UV is the texture coordinate (0..1)
    vec4 tex = texture(albedo_texture, UV);
    ALBEDO    = tex.rgb * albedo_color.rgb;
    METALLIC  = metallic;
    ROUGHNESS = roughness;
    ALPHA     = tex.a * albedo_color.a;
}
```

## Uniforms and the TIME Built-in

`TIME` is a built-in float that increases with elapsed game time. Use it to create animated effects:

```glsl
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;

uniform float wave_speed     : hint_range(0.1, 5.0) = 1.0;
uniform float wave_amplitude : hint_range(0.0, 0.5) = 0.05;
uniform vec4  water_color    : source_color = vec4(0.1, 0.4, 0.7, 0.8);

void vertex()
{
    // Animate Y position as sine wave
    VERTEX.y += sin(VERTEX.x * 3.0 + TIME * wave_speed) * wave_amplitude;
    VERTEX.y += cos(VERTEX.z * 2.5 + TIME * wave_speed * 0.7) * wave_amplitude;
}

void fragment()
{
    // Animate UV scroll for water normal map
    vec2 scrolled_uv = UV + vec2(TIME * 0.05, TIME * 0.03);
    ALBEDO    = water_color.rgb;
    ROUGHNESS = 0.05;
    ALPHA     = water_color.a;
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Built-in shader variables</strong> — Common built-ins: <code>TIME</code> (seconds), <code>UV</code> (first UV set), <code>UV2</code> (lightmap UV), <code>NORMAL</code> (surface normal), <code>VERTEX</code> (position), <code>CAMERA_POSITION_WORLD</code>, <code>MODEL_MATRIX</code>.</div>
</div>

## Dissolve Effect Example

A dissolve shader erodes the mesh using a noise texture and a threshold uniform. When threshold reaches 1, the object is fully dissolved:

```glsl
// dissolve.gdshader
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back;

uniform sampler2D noise_texture : hint_default_white;
uniform float     dissolve_amount : hint_range(0.0, 1.0) = 0.0;
uniform vec4      edge_color      : source_color = vec4(1.0, 0.4, 0.0, 1.0);
uniform float     edge_width      : hint_range(0.0, 0.2) = 0.05;
uniform vec4      albedo_color    : source_color = vec4(0.2, 0.6, 1.0, 1.0);

void fragment()
{
    float noise = texture(noise_texture, UV).r;

    // Discard pixels below the threshold (creates the dissolve hole)
    if (noise < dissolve_amount)
        discard;

    // Edge glow near the dissolve boundary
    float edge = smoothstep(dissolve_amount,
                            dissolve_amount + edge_width,
                            noise);
    vec3 color = mix(edge_color.rgb, albedo_color.rgb, edge);

    ALBEDO    = color;
    ROUGHNESS = 0.6;
    EMISSION  = edge_color.rgb * (1.0 - edge) * 2.0;
    ALPHA     = 1.0;
}
```

## Setting Uniforms from C#

```csharp
using Godot;

public partial class DissolveController : Node3D
{
    [Export] public MeshInstance3D Mesh;
    [Export] public float DissolveDuration = 1.5f;

    private ShaderMaterial _mat;

    public override void _Ready()
    {
        // Get or duplicate the material so we don't affect other instances
        _mat = Mesh.GetActiveMaterial(0).Duplicate() as ShaderMaterial;
        Mesh.SetSurfaceOverrideMaterial(0, _mat);

        // Assign a noise texture
        var noise = new NoiseTexture2D
        {
            Width  = 256,
            Height = 256,
            Noise  = new FastNoiseLite { Frequency = 0.05f }
        };
        _mat.SetShaderParameter("noise_texture", noise);
        _mat.SetShaderParameter("dissolve_amount", 0f);
    }

    public async void Dissolve()
    {
        Tween tween = CreateTween();
        tween.TweenMethod(
            Callable.From((float v) =>
                _mat.SetShaderParameter("dissolve_amount", v)),
            0f, 1f, DissolveDuration);

        await ToSignal(tween, Tween.SignalName.Finished);
        Mesh.QueueFree();
    }

    public void UndissolveInstant()
    {
        _mat.SetShaderParameter("dissolve_amount", 0f);
    }
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Always duplicate materials</strong> — When you call <code>GetActiveMaterial()</code>, you get the shared resource. Modifying it changes every mesh that uses the same material. Always call <code>Duplicate()</code> before setting per-instance shader parameters.</div>
</div>

## Outline Shader (Post-Process)

A screen-space outline can be added via a full-screen quad on a CanvasLayer using `shader_type canvas_item`:

```glsl
// outline_post.gdshader
shader_type canvas_item;

uniform sampler2D screen_texture : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D depth_texture  : hint_depth_texture, filter_linear_mipmap;
uniform float     outline_thickness = 1.0;
uniform vec4      outline_color : source_color = vec4(0.0, 0.0, 0.0, 1.0);

void fragment()
{
    vec2 uv      = SCREEN_UV;
    vec2 texel   = outline_thickness / vec2(textureSize(screen_texture, 0));

    float d  = texture(depth_texture, uv).r;
    float dn = texture(depth_texture, uv + vec2(0, texel.y)).r;
    float ds = texture(depth_texture, uv - vec2(0, texel.y)).r;
    float de = texture(depth_texture, uv + vec2(texel.x, 0)).r;
    float dw = texture(depth_texture, uv - vec2(texel.x, 0)).r;

    float edge = abs(d - dn) + abs(d - ds) + abs(d - de) + abs(d - dw);
    edge = step(0.001, edge);

    COLOR = mix(texture(screen_texture, uv), outline_color, edge);
}
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">In a Godot spatial shader, which keyword do you use inside <code>fragment()</code> to make a pixel completely invisible (not rendered)?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q13')"><span class="quiz-key">A</span> ALPHA = 0.0;</div>
    <div class="quiz-o" onclick="qz(this,false,'q13')"><span class="quiz-key">B</span> return;</div>
    <div class="quiz-o" onclick="qz(this,true,'q13')"><span class="quiz-key">C</span> discard;</div>
    <div class="quiz-o" onclick="qz(this,false,'q13')"><span class="quiz-key">D</span> VISIBLE = false;</div>
  </div>
  <div class="quiz-fb" id="q13"></div>
</div>
