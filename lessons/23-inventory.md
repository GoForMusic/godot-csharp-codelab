---
title: Inventory System
tag: Sys
sub: Build a slot-based inventory with GlobalClass Resources for item definitions, a domain Inventory entity, a signal-driven UI grid, and pickup Area3D nodes.
---

## Design Overview

A solid inventory system separates three concerns:

<svg width="480" height="100" viewBox="0 0 480 100" xmlns="http://www.w3.org/2000/svg">
  <rect width="480" height="100" fill="#080806" rx="8"/>
  <defs>
    <marker id="inv23" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
      <polygon points="0,0 8,3 0,6" fill="#f5c000"/>
    </marker>
  </defs>
  <rect x="8"   y="28" width="104" height="44" rx="4" fill="#0f0f0c" stroke="#78786e" stroke-width="1.5"/>
  <text x="60"  y="47" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">ItemDefinition</text>
  <text x="60"  y="62" fill="#3a3a32" font-family="monospace" font-size="8"  text-anchor="middle">.tres Resource</text>
  <line x1="112" y1="50" x2="138" y2="50" stroke="#f5c000" stroke-width="1.5" marker-end="url(#inv23)"/>
  <rect x="138" y="20" width="110" height="60" rx="4" fill="#0f0f0c" stroke="#f5c000" stroke-width="2"/>
  <text x="193" y="44" fill="#f5c000" font-family="monospace" font-size="10" text-anchor="middle">Inventory</text>
  <text x="193" y="58" fill="#78786e" font-family="monospace" font-size="9"  text-anchor="middle">domain entity</text>
  <text x="193" y="71" fill="#3a3a32" font-family="monospace" font-size="8"  text-anchor="middle">pure C#</text>
  <line x1="248" y1="50" x2="274" y2="50" stroke="#f5c000" stroke-width="1.5" marker-end="url(#inv23)"/>
  <rect x="274" y="20" width="118" height="60" rx="4" fill="#0f0f0c" stroke="#c8c8be" stroke-width="1.5"/>
  <text x="333" y="44" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">Inventory</text>
  <text x="333" y="58" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">Component</text>
  <text x="333" y="71" fill="#3a3a32" font-family="monospace" font-size="8"  text-anchor="middle">Godot adapter</text>
  <line x1="392" y1="50" x2="418" y2="50" stroke="#f5c000" stroke-width="1.5" marker-end="url(#inv23)"/>
  <rect x="418" y="28" width="54" height="44" rx="4" fill="#0f0f0c" stroke="#78786e" stroke-width="1.5"/>
  <text x="445" y="47" fill="#c8c8be" font-family="monospace" font-size="10" text-anchor="middle">UI</text>
  <text x="445" y="61" fill="#3a3a32" font-family="monospace" font-size="8"  text-anchor="middle">Grid</text>
</svg>

- **ItemDefinition** — static data (name, icon, weight) as a `[GlobalClass]` Resource
- **Inventory** — domain logic (add, remove, stacks) — plain C#, no Godot
- **InventoryComponent + UI** — Godot adapter and display driven by events

## ItemDefinition as a GlobalClass Resource

`[GlobalClass]` makes your Resource subclass appear in the editor's "New Resource" menu. No code needed to add new items — just create `.tres` files:

```csharp
using Godot;

[GlobalClass]
public partial class ItemDefinition : Resource
{
    [Export] public string    ItemId      { get; set; } = "undefined";
    [Export] public string    DisplayName { get; set; } = "Unknown Item";
    [Export] public Texture2D Icon        { get; set; }
    [Export] public int       MaxStack    { get; set; } = 1;
    [Export] public float     Weight      { get; set; } = 0.1f;
    [Export] public string    Description { get; set; } = "";

    public enum ItemCategory { Consumable, Weapon, Armor, Quest, Misc }
    [Export] public ItemCategory Category { get; set; } = ItemCategory.Misc;
}
```

Create items: right-click in FileSystem → **New Resource → ItemDefinition**. Fill in fields in the Inspector, save as `res://Data/Items/sword.tres`.

<div class="callout tip">
  <span class="callout-ico">💡</span>
  <div><strong>Separate definition from quantity</strong> — ItemDefinition is static (like a database row). Runtime quantities live only in the Inventory entity. Never store stack counts on ItemDefinition itself.</div>
</div>

## Domain Inventory Class

Zero Godot dependencies — fully unit-testable:

```csharp
// Scripts/Domain/Entities/Inventory.cs
using System;
using System.Collections.Generic;

public class Inventory
{
    public string OwnerId  { get; }
    public int    MaxSlots { get; }

    private readonly Dictionary<string, int> _stacks = new();
    public IReadOnlyDictionary<string, int> Stacks => _stacks;

    public int  UsedSlots => _stacks.Count;
    public bool IsFull    => _stacks.Count >= MaxSlots;

    public event Action<string, int>? ItemAdded;
    public event Action<string, int>? ItemRemoved;
    public event Action?              InventoryFull;

    public Inventory(string ownerId, int maxSlots = 20)
    {
        OwnerId  = ownerId;
        MaxSlots = maxSlots;
    }

    public bool TryAdd(string itemId, int qty = 1, int maxStack = 99)
    {
        if (qty <= 0) return false;
        _stacks.TryGetValue(itemId, out int current);
        bool isNewSlot = current == 0;
        if (isNewSlot && IsFull) { InventoryFull?.Invoke(); return false; }

        int added = Math.Min(qty, maxStack - current);
        if (added <= 0) return false;
        _stacks[itemId] = current + added;
        ItemAdded?.Invoke(itemId, added);
        return true;
    }

    public bool TryRemove(string itemId, int qty = 1)
    {
        if (!_stacks.TryGetValue(itemId, out int current)) return false;
        if (current < qty) return false;
        int remaining = current - qty;
        if (remaining == 0) _stacks.Remove(itemId);
        else _stacks[itemId] = remaining;
        ItemRemoved?.Invoke(itemId, qty);
        return true;
    }

    public int  Count(string itemId) => _stacks.GetValueOrDefault(itemId, 0);
    public bool Has(string itemId, int qty = 1) => Count(itemId) >= qty;
}
```

## Pickup Area3D Node

```csharp
// Scripts/Gameplay/Pickup.cs
using Godot;

public partial class Pickup : Area3D
{
    [Export] public ItemDefinition Definition;
    [Export] public int            Quantity = 1;

    [Signal] public delegate void CollectedEventHandler(
        ItemDefinition item, int qty, Node3D collector);

    public override void _Ready() => BodyEntered += OnBodyEntered;

    private void OnBodyEntered(Node3D body)
    {
        EmitSignal(SignalName.Collected, Definition, Quantity, body);
        QueueFree();
    }
}
```

## InventoryComponent (Godot Adapter)

Bridges the domain inventory to the Godot scene tree, re-emitting domain events as Godot signals:

```csharp
// Scripts/Adapters/InventoryComponent.cs
using Godot;
using System.Collections.Generic;

public partial class InventoryComponent : Node
{
    [Export] public int                MaxSlots = 20;
    [Export] public ItemDefinition[]   AllItems;   // drag all item .tres files here

    private Inventory _inventory;
    private readonly Dictionary<string, ItemDefinition> _defs = new();

    [Signal] public delegate void ItemAddedEventHandler(string itemId, int qty);
    [Signal] public delegate void ItemRemovedEventHandler(string itemId, int qty);
    [Signal] public delegate void InventoryFullEventHandler();

    public override void _Ready()
    {
        _inventory = new Inventory(GetParent().Name, MaxSlots);
        foreach (var def in AllItems)
            _defs[def.ItemId] = def;

        // Bridge domain events → Godot signals
        _inventory.ItemAdded     += (id, qty) => EmitSignal(SignalName.ItemAdded, id, qty);
        _inventory.ItemRemoved   += (id, qty) => EmitSignal(SignalName.ItemRemoved, id, qty);
        _inventory.InventoryFull += ()         => EmitSignal(SignalName.InventoryFull);
    }

    public bool TryPickup(ItemDefinition def, int qty = 1)
        => _inventory.TryAdd(def.ItemId, qty, def.MaxStack);

    public bool TryUse(string itemId, int qty = 1)
        => _inventory.TryRemove(itemId, qty);

    public int  Count(string itemId) => _inventory.Count(itemId);
    public bool Has(string itemId, int qty = 1) => _inventory.Has(itemId, qty);
    public IReadOnlyDictionary<string, int> GetAllStacks() => _inventory.Stacks;
    public ItemDefinition GetDefinition(string id)
        => _defs.TryGetValue(id, out var def) ? def : null;
}
```

## Inventory UI

Reacts to `InventoryComponent` signals and manages slot Controls:

```csharp
// Scripts/UI/InventoryUI.cs
using Godot;
using System.Collections.Generic;

public partial class InventoryUI : Control
{
    [Export] public InventoryComponent Inventory;
    [Export] public PackedScene        SlotScene;   // ItemSlot.tscn
    [Export] public GridContainer      Grid;

    private readonly Dictionary<string, ItemSlot> _slots = new();

    public override void _Ready()
    {
        Inventory.ItemAdded   += OnItemAdded;
        Inventory.ItemRemoved += OnItemRemoved;
        Visible = false;
        // Rebuild from current state on load
        foreach (var (id, qty) in Inventory.GetAllStacks())
            AddOrUpdateSlot(id, qty);
    }

    public override void _UnhandledInput(InputEvent @event)
    {
        if (@event is InputEventKey { Keycode: Key.I, Pressed: true })
            Visible = !Visible;
    }

    private void OnItemAdded(string id, int qty)
        => AddOrUpdateSlot(id, Inventory.Count(id));

    private void OnItemRemoved(string id, int qty)
    {
        int remaining = Inventory.Count(id);
        if (remaining == 0) RemoveSlot(id);
        else AddOrUpdateSlot(id, remaining);
    }

    private void AddOrUpdateSlot(string id, int qty)
    {
        if (!_slots.TryGetValue(id, out var slot))
        {
            slot = SlotScene.Instantiate<ItemSlot>();
            Grid.AddChild(slot);
            _slots[id] = slot;
        }
        slot.Setup(Inventory.GetDefinition(id), qty);
    }

    private void RemoveSlot(string id)
    {
        if (_slots.TryGetValue(id, out var slot))
        { slot.QueueFree(); _slots.Remove(id); }
    }
}
```

## ItemSlot Control

Minimal slot scene: `ItemSlot (PanelContainer) → TextureRect + Label`

```csharp
public partial class ItemSlot : PanelContainer
{
    private TextureRect _icon;
    private Label       _count;

    public override void _Ready()
    {
        _icon  = GetNode<TextureRect>("TextureRect");
        _count = GetNode<Label>("Label");
    }

    public void Setup(ItemDefinition def, int qty)
    {
        _icon.Texture  = def?.Icon;
        _count.Text    = qty > 1 ? $"x{qty}" : "";
        _count.Visible = qty > 1;
        TooltipText    = def != null
            ? $"{def.DisplayName}\n{def.Description}" : "";
    }
}
```

<div class="callout note">
  <span class="callout-ico">📝</span>
  <div><strong>Wiring pickups to the inventory</strong> — In your level scene, connect each <code>Pickup.Collected</code> signal to a method on the player's <code>InventoryComponent</code>. Or better: use an <code>EventBus.EmitItemPickedUp()</code> call so any system can react to loot — see Lesson 25.</div>
</div>

<div class="quiz">
  <div class="quiz-label">Knowledge Check</div>
  <div class="quiz-q">What Godot attribute lets you create new item types as .tres files directly in the editor without writing additional registration code?</div>
  <div class="quiz-opts">
    <div class="quiz-o" onclick="qz(this,false,'q23')"><span class="quiz-key">A</span> [Export] on the ItemDefinition class</div>
    <div class="quiz-o" onclick="qz(this,true,'q23')"><span class="quiz-key">B</span> [GlobalClass] on a class that extends Resource</div>
    <div class="quiz-o" onclick="qz(this,false,'q23')"><span class="quiz-key">C</span> [Tool] on a Node script</div>
    <div class="quiz-o" onclick="qz(this,false,'q23')"><span class="quiz-key">D</span> [Serializable] from System.Runtime</div>
  </div>
  <div class="quiz-fb" id="q23"></div>
</div>
