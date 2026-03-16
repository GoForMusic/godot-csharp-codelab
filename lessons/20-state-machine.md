---
title: Generic State Machine
tag: SOLID
sub: Build a reusable, type-safe generic state machine in the domain layer that replaces brittle switch statements for player, enemy, and UI state management.
---

## The Problem with Switch-Based FSMs

In earlier lessons we used C# switch expressions for enemy AI states. That works for three states, but becomes painful at scale:

```csharp
// Grows unwieldy fast — all state logic in one method
private void UpdateState()
{
    _state = _state switch
    {
        State.Idle    => HandleIdle(),
        State.Patrol  => HandlePatrol(),
        State.Alert   => HandleAlert(),
        State.Chase   => HandleChase(),
        State.Attack  => HandleAttack(),
        State.Retreat => HandleRetreat(),
        State.Dead    => HandleDead(),
        _             => State.Idle
    };
}
// + 7 private handler methods + transition logic scattered everywhere
```

Problems:
- All state logic in one class (Single Responsibility violation)
- Adding a new state requires touching existing code (Open/Closed violation)
- Cannot reuse states between enemy types
- Impossible to unit-test individual states

## Generic State Machine Design

The solution is a generic state machine where each state is its own class:

```csharp
// Scripts/Domain/StateMachine/IState.cs
public interface IState<TContext>
{
    void Enter(TContext ctx);
    void Update(TContext ctx, float delta);
    void Exit(TContext ctx);
}
```

```csharp
// Scripts/Domain/StateMachine/StateMachine.cs
using System;
using System.Collections.Generic;

public class StateMachine<TContext>
{
    private readonly TContext _context;
    private readonly Dictionary<Type, IState<TContext>> _states = new();

    private IState<TContext>? _current;

    public Type? CurrentStateType => _current?.GetType();

    public event Action<Type, Type>? StateChanged; // (from, to)

    public StateMachine(TContext context)
    {
        _context = context;
    }

    public StateMachine<TContext> AddState(IState<TContext> state)
    {
        _states[state.GetType()] = state;
        return this; // fluent API for chaining
    }

    public void Start<TState>() where TState : IState<TContext>
    {
        _current = _states[typeof(TState)];
        _current.Enter(_context);
    }

    public void TransitionTo<TState>() where TState : IState<TContext>
    {
        var nextType = typeof(TState);
        if (_current?.GetType() == nextType) return; // already in this state

        var from = _current?.GetType() ?? typeof(TState);
        _current?.Exit(_context);
        _current = _states[nextType];
        _current.Enter(_context);
        StateChanged?.Invoke(from, nextType);
    }

    public void Update(float delta)
    {
        _current?.Update(_context, delta);
    }
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>The fluent AddState pattern</strong> — Returning <code>this</code> from <code>AddState()</code> allows chained initialization: <code>machine.AddState(new IdleState()).AddState(new ChaseState()).AddState(new AttackState())</code>. Clean and readable.</div>
</div>

<svg width="480" height="185" viewBox="0 0 480 185" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="185" fill="#080806" rx="8"/>
  <defs>
    <marker id="sm20" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#f5c000"/>
    </marker>
  </defs>
  <!-- StateMachine outer box -->
  <rect x="10" y="15" width="460" height="90" rx="6" fill="#0f0f0c" stroke="#f5c000" stroke-width="1.5"/>
  <text x="20" y="34" fill="#f5c000" font-family="monospace" font-size="11">StateMachine&lt;TContext&gt;</text>
  <!-- TransitionTo row -->
  <text x="20" y="58" fill="#c8c8be" font-family="monospace" font-size="10">TransitionTo&lt;T&gt;()</text>
  <line x1="150" y1="53" x2="178" y2="53" stroke="#f5c000" stroke-width="1.5" marker-end="url(#sm20)"/>
  <text x="185" y="58" fill="#78786e" font-family="monospace" font-size="10">current.Exit(ctx)</text>
  <line x1="300" y1="53" x2="328" y2="53" stroke="#f5c000" stroke-width="1.5" marker-end="url(#sm20)"/>
  <text x="335" y="58" fill="#78786e" font-family="monospace" font-size="10">next.Enter(ctx)</text>
  <!-- Update row -->
  <text x="20" y="88" fill="#c8c8be" font-family="monospace" font-size="10">Update(delta)</text>
  <line x1="120" y1="83" x2="178" y2="83" stroke="#f5c000" stroke-width="1.5" marker-end="url(#sm20)"/>
  <text x="185" y="88" fill="#78786e" font-family="monospace" font-size="10">current.Update(ctx, delta)</text>
  <!-- IState box -->
  <rect x="10" y="118" width="460" height="55" rx="6" fill="#0f0f0c" stroke="#78786e" stroke-width="1.5"/>
  <text x="20" y="138" fill="#78786e" font-family="monospace" font-size="10">IState&lt;TContext&gt;</text>
  <text x="190" y="138" fill="#c8c8be" font-family="monospace" font-size="10">Enter(ctx)</text>
  <text x="290" y="138" fill="#c8c8be" font-family="monospace" font-size="10">Update(ctx, Δt)</text>
  <text x="400" y="138" fill="#c8c8be" font-family="monospace" font-size="10">Exit(ctx)</text>
  <text x="190" y="158" fill="#3a3a32" font-family="monospace" font-size="9">on enter</text>
  <text x="290" y="158" fill="#3a3a32" font-family="monospace" font-size="9">every tick</text>
  <text x="400" y="158" fill="#3a3a32" font-family="monospace" font-size="9">on leave</text>
  <!-- Arrow from machine to IState -->
  <line x1="240" y1="105" x2="240" y2="118" stroke="#78786e" stroke-width="1" stroke-dasharray="3,2"/>
  <text x="260" y="114" fill="#3a3a32" font-family="monospace" font-size="8">calls</text>
</svg>

## Enemy AI States as Separate Classes

Each state is now isolated, testable, and follows the Single Responsibility Principle:

```csharp
// Domain context — no Godot, just data
public class EnemyContext
{
    public CharacterStats Stats      { get; }
    public float          TargetDist { get; set; }
    public bool           HasLOS     { get; set; }
    public float          DetectRange { get; init; } = 12f;
    public float          AttackRange { get; init; } = 2f;

    // Navigation handled via interface — no NavigationAgent3D here
    public INavigationProvider Nav { get; }
    public IAudioService       Audio { get; }

    public EnemyContext(CharacterStats stats,
                        INavigationProvider nav,
                        IAudioService audio)
    {
        Stats = stats;
        Nav   = nav;
        Audio = audio;
    }
}
```

```csharp
// State: Idle
public class EnemyIdleState : IState<EnemyContext>
{
    private float _waitTimer;

    public void Enter(EnemyContext ctx)
    {
        _waitTimer = 0f;
        ctx.Audio.PlaySfx("enemy_idle");
    }

    public void Update(EnemyContext ctx, float delta)
    {
        _waitTimer += delta;

        // Detect player
        if (ctx.TargetDist < ctx.DetectRange && ctx.HasLOS)
        {
            ctx.Audio.PlaySfx("enemy_alert");
            // Signal the state machine to transition
            OnDetectedPlayer?.Invoke();
        }
    }

    public void Exit(EnemyContext ctx) { }

    public event Action? OnDetectedPlayer;
}
```

```csharp
// State: Chase
public class EnemyChaseState : IState<EnemyContext>
{
    public void Enter(EnemyContext ctx)
    {
        ctx.Audio.PlaySfx("enemy_growl");
    }

    public void Update(EnemyContext ctx, float delta)
    {
        ctx.Nav.RequestPath(ctx.Stats.Id);

        if (ctx.TargetDist <= ctx.AttackRange)
            OnInAttackRange?.Invoke();
        else if (ctx.TargetDist > ctx.DetectRange * 1.5f || !ctx.HasLOS)
            OnLostTarget?.Invoke();
    }

    public void Exit(EnemyContext ctx) { }

    public event Action? OnInAttackRange;
    public event Action? OnLostTarget;
}
```

## Wiring Up the State Machine

The state machine is assembled in the domain, and Godot adapters feed it data:

```csharp
// Scripts/Domain/EnemyBrain.cs — pure domain, no Godot
public class EnemyBrain
{
    private readonly StateMachine<EnemyContext> _sm;
    private readonly EnemyIdleState  _idle;
    private readonly EnemyChaseState _chase;

    public EnemyBrain(EnemyContext ctx)
    {
        _idle  = new EnemyIdleState();
        _chase = new EnemyChaseState();
        var attack = new EnemyAttackState();
        var dead   = new EnemyDeadState();

        // Wire transition events
        _idle.OnDetectedPlayer  += () => _sm.TransitionTo<EnemyChaseState>();
        _chase.OnInAttackRange  += () => _sm.TransitionTo<EnemyAttackState>();
        _chase.OnLostTarget     += () => _sm.TransitionTo<EnemyIdleState>();
        ctx.Stats.Died          +=      () => _sm.TransitionTo<EnemyDeadState>();

        _sm = new StateMachine<EnemyContext>(ctx)
            .AddState(_idle)
            .AddState(_chase)
            .AddState(attack)
            .AddState(dead);

        _sm.Start<EnemyIdleState>();
    }

    public void Update(float delta) => _sm.Update(delta);

    public Type CurrentState => _sm.CurrentStateType!;
}
```

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Events on states for transitions</strong> — Rather than passing the state machine reference into each state (creating a circular dependency), states raise events (<code>OnDetectedPlayer</code>) and the brain wires them to transitions. States remain ignorant of the machine that manages them.</div>
</div>

## Reusing States: Player FSM

The same generic machine works for the player's state:

```csharp
public class PlayerContext
{
    public CharacterStats Stats { get; }
    public IInputProvider Input { get; }
    public bool IsOnFloor { get; set; }
    public float HorizontalSpeed { get; set; }

    public PlayerContext(CharacterStats stats, IInputProvider input)
    {
        Stats = stats;
        Input = input;
    }
}

public class PlayerGroundState : IState<PlayerContext>
{
    public void Enter(PlayerContext ctx) { }

    public void Update(PlayerContext ctx, float delta)
    {
        var move  = ctx.Input.GetMoveInput();
        ctx.HorizontalSpeed = new System.Numerics.Vector2(move.X, move.Y).Length();

        if (ctx.Input.IsJumpPressed())
            OnJumped?.Invoke();
    }

    public void Exit(PlayerContext ctx) { }
    public event Action? OnJumped;
}
```

## Testing States in Isolation

```csharp
[Fact]
public void IdleState_TransitionsToChase_WhenPlayerDetected()
{
    var fakeNav   = new FakeNavigationProvider();
    var fakeAudio = new FakeAudioService();
    var stats     = new CharacterStats("e1", "Grunt", 50f);
    var ctx       = new EnemyContext(stats, fakeNav, fakeAudio)
    {
        DetectRange = 10f
    };

    var idle = new EnemyIdleState();
    bool transitioned = false;
    idle.OnDetectedPlayer += () => transitioned = true;

    idle.Enter(ctx);

    // Simulate player entering detection range with LOS
    ctx.TargetDist = 5f;
    ctx.HasLOS     = true;
    idle.Update(ctx, 0.016f);

    Assert.True(transitioned);
}
```

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">In the generic state machine design, how does a state signal that it wants to transition to another state, without holding a reference to the StateMachine itself?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q20')"><span class="quiz-key">A</span> By returning a new state type from Update()</div>
    <div class="quiz-o" onclick="qz(this,false,'q20')"><span class="quiz-key">B</span> By calling TransitionTo() on the context object</div>
    <div class="quiz-o" onclick="qz(this,true,'q20')"><span class="quiz-key">C</span> By raising a C# event that the brain has subscribed to</div>
    <div class="quiz-o" onclick="qz(this,false,'q20')"><span class="quiz-key">D</span> By modifying a shared static CurrentState variable</div>
  </div>
  <div class="quiz-fb" id="q20"></div>
</div>
