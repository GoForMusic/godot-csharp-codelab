---
title: Enemy AI & Behavior
tag: AI
sub: Build a navigation-based enemy with NavigationAgent3D, bake a NavMesh, implement a three-state FSM, and add line-of-sight detection with RayCast3D.
---

## NavigationRegion3D Setup

Before enemies can path-find, you need to bake a navigation mesh. Add a `NavigationRegion3D` to your level scene and assign a `NavigationMesh` resource to it. In the Inspector, click **Bake NavigationMesh** — Godot analyzes your static geometry and generates the walkable surface.

<div class="scene-tree">
  <div class="st-row"><span class="st-icon">🌐</span> <span class="st-name">Level</span> <span class="st-type">Node3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">🗺️</span> <span class="st-name">NavRegion</span> <span class="st-type">NavigationRegion3D</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">🏔️</span> <span class="st-name">Terrain</span> <span class="st-type">StaticBody3D</span></div>
  <div class="st-row" style="padding-left:1.5rem"><span class="st-icon">👾</span> <span class="st-name">Enemy</span> <span class="st-type">CharacterBody3D</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">🧭</span> <span class="st-name">NavigationAgent3D</span> <span class="st-type">NavigationAgent3D</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">🔷</span> <span class="st-name">CollisionShape3D</span> <span class="st-type">CollisionShape3D</span></div>
  <div class="st-row" style="padding-left:3rem"><span class="st-icon">🔦</span> <span class="st-name">RayCast3D</span> <span class="st-type">RayCast3D</span></div>
</div>

Key `NavigationMesh` properties:
- **Agent Radius**: match your enemy capsule radius (e.g., 0.4 m)
- **Agent Height**: match enemy capsule height (e.g., 1.8 m)
- **Cell Size**: smaller = more precise but slower bake (0.25 is a good default)

## NavigationAgent3D for Pathfinding

`NavigationAgent3D` handles all the path calculation. You give it a target position; it gives you the next step along the path.

```csharp
using Godot;

public partial class Enemy : CharacterBody3D
{
    [Export] public float MoveSpeed  = 3.5f;
    [Export] public float StopDist   = 0.5f;

    private NavigationAgent3D _nav;
    private Node3D            _target;

    public override void _Ready()
    {
        _nav    = GetNode<NavigationAgent3D>("NavigationAgent3D");
        _target = GetNode<Node3D>("/root/World/Player");

        // Configure agent
        _nav.PathDesiredDistance   = 0.5f;
        _nav.TargetDesiredDistance = StopDist;
    }

    private void UpdatePath()
    {
        if (_target != null)
            _nav.TargetPosition = _target.GlobalPosition;
    }

    public override void _PhysicsProcess(double delta)
    {
        if (_nav.IsNavigationFinished()) return;

        Vector3 nextPos   = _nav.GetNextPathPosition();
        Vector3 direction = (nextPos - GlobalPosition).Normalized();

        Velocity = direction * MoveSpeed;
        MoveAndSlide();

        // Face movement direction
        if (direction.LengthSquared() > 0.01f)
        {
            var targetBasis = Basis.LookingAt(direction, Vector3.Up);
            Basis = Basis.Slerp(targetBasis, 8f * (float)delta);
        }
    }
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Path refresh rate</strong> — Calling <code>TargetPosition</code> every physics frame re-requests the path every frame, which is expensive. Use a timer (e.g., every 0.25s) to refresh the path when chasing a moving target.</div>
</div>

## Simple Finite State Machine: Idle → Chase → Attack

<svg width="480" height="220" viewBox="0 0 480 220" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="220" fill="#080806" rx="8"/>
  <defs>
    <marker id="fsm8" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#f5c000"/>
    </marker>
    <marker id="fsm8b" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#78786e"/>
    </marker>
  </defs>
  <!-- IDLE -->
  <rect x="25" y="85" width="110" height="50" rx="6" fill="#0f0f0c" stroke="#f5c000" stroke-width="2"/>
  <text x="80" y="106" fill="#f5c000" font-family="monospace" font-size="13" text-anchor="middle" font-weight="bold">IDLE</text>
  <text x="80" y="122" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">stand still</text>
  <!-- CHASE -->
  <rect x="185" y="85" width="110" height="50" rx="6" fill="#0f0f0c" stroke="#f5c000" stroke-width="2"/>
  <text x="240" y="106" fill="#f5c000" font-family="monospace" font-size="13" text-anchor="middle" font-weight="bold">CHASE</text>
  <text x="240" y="122" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">pathfind to player</text>
  <!-- ATTACK -->
  <rect x="345" y="85" width="110" height="50" rx="6" fill="#0f0f0c" stroke="#f5c000" stroke-width="2"/>
  <text x="400" y="106" fill="#f5c000" font-family="monospace" font-size="13" text-anchor="middle" font-weight="bold">ATTACK</text>
  <text x="400" y="122" fill="#78786e" font-family="monospace" font-size="9" text-anchor="middle">swing + cooldown</text>
  <!-- IDLE → CHASE -->
  <line x1="135" y1="103" x2="185" y2="103" stroke="#f5c000" stroke-width="1.5" marker-end="url(#fsm8)"/>
  <text x="160" y="96" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">inRange</text>
  <text x="160" y="107" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">&amp;&amp; LOS</text>
  <!-- CHASE → ATTACK -->
  <line x1="295" y1="103" x2="345" y2="103" stroke="#f5c000" stroke-width="1.5" marker-end="url(#fsm8)"/>
  <text x="320" y="96" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">dist &lt;</text>
  <text x="320" y="107" fill="#c8c8be" font-family="monospace" font-size="8" text-anchor="middle">attackRange</text>
  <!-- CHASE → IDLE (arc below) -->
  <path d="M 240 135 Q 160 185 80 135" fill="none" stroke="#78786e" stroke-width="1.5" marker-end="url(#fsm8b)"/>
  <text x="160" y="178" fill="#78786e" font-family="monospace" font-size="8" text-anchor="middle">lost target / no LOS</text>
  <!-- ATTACK → CHASE (arc above) -->
  <path d="M 400 85 Q 320 38 240 85" fill="none" stroke="#78786e" stroke-width="1.5" marker-end="url(#fsm8b)"/>
  <text x="320" y="45" fill="#78786e" font-family="monospace" font-size="8" text-anchor="middle">dist &gt; attackRange</text>
  <!-- Start arrow -->
  <line x1="6" y1="110" x2="25" y2="110" stroke="#f5c000" stroke-width="2" marker-end="url(#fsm8)"/>
  <!-- Footer -->
  <text x="240" y="210" fill="#3a3a32" font-family="monospace" font-size="9" text-anchor="middle">transitions evaluated every physics frame via switch expression</text>
</svg>

A three-state FSM covers most enemy behaviors. Implement it with a C# enum and a switch expression:

```csharp
public partial class Enemy : CharacterBody3D
{
    private enum State { Idle, Chase, Attack }

    [Export] public float DetectionRange  = 12f;
    [Export] public float AttackRange     = 2f;
    [Export] public float AttackCooldown  = 1.5f;
    [Export] public float PathRefreshRate = 0.25f;

    private State             _state     = State.Idle;
    private NavigationAgent3D _nav;
    private RayCast3D         _los;       // line of sight
    private Node3D            _player;
    private float             _attackTimer   = 0f;
    private float             _pathTimer     = 0f;

    public override void _Ready()
    {
        _nav    = GetNode<NavigationAgent3D>("NavigationAgent3D");
        _los    = GetNode<RayCast3D>("RayCast3D");
        _player = GetNode<Node3D>("/root/World/Player");
    }

    public override void _PhysicsProcess(double delta)
    {
        _attackTimer -= (float)delta;
        _pathTimer   -= (float)delta;

        float distToPlayer = GlobalPosition.DistanceTo(_player.GlobalPosition);

        _state = _state switch
        {
            State.Idle   => distToPlayer < DetectionRange && HasLineOfSight()
                                ? State.Chase : State.Idle,
            State.Chase  => distToPlayer < AttackRange
                                ? State.Attack
                                : distToPlayer > DetectionRange * 1.5f
                                    ? State.Idle : State.Chase,
            State.Attack => distToPlayer > AttackRange
                                ? State.Chase : State.Attack,
            _            => State.Idle
        };

        switch (_state)
        {
            case State.Idle:
                // Play idle animation, stand still
                Velocity = Vector3.Zero;
                break;

            case State.Chase:
                ChasePlayer(delta);
                break;

            case State.Attack:
                AttackPlayer(delta);
                break;
        }

        MoveAndSlide();
    }

    private void ChasePlayer(double delta)
    {
        if (_pathTimer <= 0f)
        {
            _nav.TargetPosition = _player.GlobalPosition;
            _pathTimer = PathRefreshRate;
        }

        if (!_nav.IsNavigationFinished())
        {
            Vector3 next = _nav.GetNextPathPosition();
            Vector3 dir  = (next - GlobalPosition).Normalized();
            Velocity     = dir * 3.5f;
        }
    }

    private void AttackPlayer(double delta)
    {
        Velocity = Vector3.Zero;
        // Face the player
        Vector3 toPlayer = (_player.GlobalPosition - GlobalPosition).Normalized();
        toPlayer.Y = 0;
        if (toPlayer.LengthSquared() > 0.01f)
            Basis = Basis.Slerp(Basis.LookingAt(toPlayer, Vector3.Up),
                                10f * (float)delta);

        if (_attackTimer <= 0f)
        {
            PerformAttack();
            _attackTimer = AttackCooldown;
        }
    }

    private void PerformAttack()
    {
        GD.Print($"{Name} attacks!");
        // Deal damage, play animation, spawn hitbox...
    }
}
```

## Line-of-Sight with RayCast3D

The FSM should only chase/attack when the enemy can actually see the player — not through walls. `RayCast3D` fires a ray and reports the first collider it hits.

```csharp
private bool HasLineOfSight()
{
    // Point the ray from enemy eyes toward player
    _los.GlobalPosition = GlobalPosition + Vector3.Up * 1.5f;
    _los.TargetPosition = _los.ToLocal(_player.GlobalPosition + Vector3.Up * 1f);
    _los.ForceRaycastUpdate();

    if (!_los.IsColliding()) return true; // nothing in the way

    // Check if the collider is the player (not a wall)
    return _los.GetCollider() == _player;
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Collision layers for raycasts</strong> — Set the RayCast3D's <code>CollisionMask</code> to only include the world geometry layer and the player layer. Exclude the enemy's own layer so the ray doesn't immediately hit the enemy who fired it.</div>
</div>

<div class="callout warn">
  <span class="callout-ico">⚠️</span>
  <div><strong>ForceRaycastUpdate()</strong> — By default, RayCast3D only updates once per physics frame. If you move the ray's origin/target and need the result immediately in the same frame, call <code>ForceRaycastUpdate()</code> to force a recalculation.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">Which method on NavigationAgent3D gives you the immediate next waypoint to move toward along the calculated path?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q8')"><span class="quiz-key">A</span> GetTargetPosition()</div>
    <div class="quiz-o" onclick="qz(this,false,'q8')"><span class="quiz-key">B</span> GetFinalPosition()</div>
    <div class="quiz-o" onclick="qz(this,true,'q8')"><span class="quiz-key">C</span> GetNextPathPosition()</div>
    <div class="quiz-o" onclick="qz(this,false,'q8')"><span class="quiz-key">D</span> GetPathPosition(0)</div>
  </div>
  <div class="quiz-fb" id="q8"></div>
</div>
