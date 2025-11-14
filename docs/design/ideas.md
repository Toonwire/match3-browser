# General

- Browser game
- Goal: destroy worlds
- Deck builder
- Match3 mechanics
- Element based
- As much as possible should be configured in yaml files for things like cards, worlds, loot

# Elements

Fire, Water, Grass, Dark, Light, Healing

## Basic elements

- Fire, Water, Grass

## Exotic elements

Dark, Light

## Misc elements

Healing

## Weapon triangles

- Fire --> Grass, Grass --> Water, Water --> Fire
- Dark <--> Light

# Layers

3 game layers

- Base
- World
- Battle

## Base (Outer)

- The base is in space on a mothership
- Establishes motivation
  - Rebelious worlds
  - Destroy worlds

### Features

- World picker (planets)
- Shop
- Armory (deck builer)

### Visual

- Top-down view of mothership
- Layout

```
---------------------------
|                         |
| Shop             Armory |
|                         |
|                         |
 \                       /
  \                     /
   \                   /
    \     Worlds      /
     -----------------
```

#### World picker

- Choose which world to

##### Visual

Window which

- Shows the planet
- Shows known attributes of the world
  - Level; Easy, Medium, Hard
  - Primary element
  - World name

```
----------------------------------------------------------------
|           /                                                  |
|          /                                                   |
-----------                                                    |
|                                                              |
| Name:     Earth                                              |
| Level:    Medium                    <  Planet.svg  >         |
| Element:  Fire                                               |
|                                                              |
|                                                              |
|                                                              |
|                                                              |
|                                                              |
----------------------------------------------------------------
```

#### Shop

- Shows player currencies
- Sells rank 1 basic elements cards (fire, water, grass)
- Does not sell exotic element cards (dark, light)

##### Visual

```
----------------------------------------------------------------
|           /                                                  |
| NPC icon /                   Plovmand: 2    Gold: 123g       |
-----------                                                    |
|                                                              |
|            NAME              ELEMENT            COST         |
|                                                              |
|            Whelp             Fire                 5g         |
|            Slime             Water                5g         |
|            Wisp              Grass                5g         |
|                                                              |
|                                                              |
|                                                              |
|            Mutagen           ???                1 plovmand   |
|                                                              |
|                                                              |
----------------------------------------------------------------
```

#### Armory

- Deck builder
- Card gallery

##### Loadout

- n card slots
  - 1 leader slot
  - n-1 regular slots

##### Cards

- Name
- Attributes

  - Attack stat
  - HP stat
  - Element type (can be multiple)
  - Leader ability

- Rank (1-n)

##### Gallery

- Shows all obtained cards
- Shows ? for all unobtained cards
- Can choose which cards from the gallery to use in loadout
-

##### Visual

```
----------------------------------------------------------------
|                Leader                                        |
|                -------     -------  -------  -------         |
|                |     |     |     |  |     |  |     |         |
|  Loadout       |     |     |     |  |     |  |     |         |
|                -------     -------  -------  -------         |
|                                                              |
|                                                              |
|                                                              |
|  Gallery                                                     |
|                                                              |
|                --------------------------------------        |
|                |     |     |     |     |     |      |        |
|                |  1  |  2  |  3  |  ?  |  ?  |      |        |
|                |------------------------------------|        |
|                |     |     |     |     |     |      |        |
|                |     |     |     |     |     |      |        |
|                --------------------------------------        |
|                |     |     |     |     |     |      |        |
|                |     |     |     |     |     |      |        |
|				         -------------------------------------|        |
|                |     |     |     |     |     |      |        |
|                |     |     |     |     |     |      |        |
|                --------------------------------------        |
|                                                              |
|                                                              |
----------------------------------------------------------------
```

## World

- Is a tower like enemy progression structure, but downwards.
- Establishes reason for battle
  - Defeat restistance
- Goal: Get to the planet core

### Features

- Levels
- Advance/retreat

## Battle

- Turn based
- 5x5 tile grid for match3 to take place
- 1-4 enemies
- Timer bar
- Player HP bar
- Individual enemy HP

### Visual

```
------------------------------------------------------------
|                                                          |
|            -------  -------  -------  -------            |
| Enemies    |     |  |     |  |     |  |     |            |
|            |     |  |     |  |     |  |     |            |
|            -------  -------  -------  -------            |
| Enemy HP   -------  -------  -------  -------            |
|                                                          |
|                                                          |
|           -------------------------------------          |
| Timer     |                                   |          |
|           -------------------------------------          |
| Player HP |                                   |          |
|           -------------------------------------          |
|           -------------------------------------          |
|           |     |     |     |     |     |     |          |
|           |     |     |     |     |     |     |          |
|           |-----------------------------------|          |
|           |     |     |     |     |     |     |          |
|           |     |     |     |     |     |     |          |
|           |-----------------------------------|          |
| Match3    |     |     |     |     |     |     |          |
| Grid      |     |     |     |     |     |     |          |
|           |-----------------------------------|          |
|           |     |     |     |     |     |     |          |
|           |     |     |     |     |     |     |          |
|           |-----------------------------------|          |
|           |     |     |     |     |     |     |          |
|           |     |     |     |     |     |     |          |
|           -------------------------------------          |
|                                                          |
------------------------------------------------------------
```

### Turns

#### Player turn

- Match3 until timer ends
- Calculate dmg and effect of attack based on match3

#### Dmg calculation

- Has to align 3+ of same element to make it match
- KISS for starters

  - 1:1 dmg for matched elements

- Matching any element

  - Deal element matched dmg. E.g. matching 3 fire tiles = fire dmg
  - Deal dmg based on number of matched elements
  - Deal dmg to random enemy

- Matching "L" or "T" pattern

  - Dmg becomes AoE

- Can only deal dmg if loadout has a card with the matching element

  - E.g. loadout of only fire cards and matching 3+ water elements; no dmg (no one can cast that type)

- Each card in loadout deals dmg if matching element

  - E.g. loadout of two fire cards and one water card and matching 3 fire elements and 4 water elements:
    Deal 2x 3 fire dmg and 1x 4 water dmg

- If a card in loadout has multiple types it deals that fraction of element dmg
  - E.g. A fire and water card will deal 50 % of the matched water dmg and 50 % of the matched fire dmg.

#### Enemy turn

- Deals dmg to player

### Rewards

- On enemy defeat, roll for loot
- Loot table needs to be easily configured, both loot and percentage chance of drop
- Can drop cards (rare)
- Can drop coins (common)

## Leader passives examples

- Deals 2x boss dmg
- 1.5x of specific element dmg
- Deals full dmg of every element
  - Only relevant for multi typed cards
