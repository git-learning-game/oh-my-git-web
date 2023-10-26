import {cloneDeep} from "lodash"
import * as YAML from "yaml"
import {gt, gPlural} from "svelte-i18n-lingui"

export class Card {
    constructor(
        public name: string,
        public energy: number,
    ) {}
}

export class CreatureCard extends Card {
    effects: [Trigger, Effect][] = []

    constructor(
        name: string,
        energy: number,
        public attack: number,
        public health: number,
    ) {
        super(name, energy)
    }

    stringify(): string {
        return YAML.stringify({
            name: this.name,
            energy: this.energy,
            attack: this.attack,
            health: this.health,
        })
    }

    static parse(content: string) {
        let result = YAML.parse(content)

        let name = result.name ?? "Unknown"
        let energy = result.energy ?? 0
        let attack = result.attack ?? 0
        let health = result.health ?? 0

        return new CreatureCard(name, energy, attack, health)
    }

    effectDescription(): string {
        const triggerDescriptions: Record<Trigger, string> = {
            [Trigger.Played]: gt`when this card is played`,
        }

        let description = ""
        for (let [trigger, effect] of this.effects) {
            let newEffect = `${triggerDescriptions[trigger]}, ${effect.description}.`
            description +=
                newEffect.charAt(0).toUpperCase() + newEffect.slice(1)
        }
        return description
    }

    addEffect(trigger: Trigger, effect: Effect): CreatureCard {
        this.effects.push([trigger, effect])
        return this
    }

    triggerEffects(battle: Battle, trigger: Trigger, source: Source) {
        for (let [t, effect] of this.effects) {
            if (t === trigger) {
                effect.apply(battle, source)
            }
        }
    }
}

export class CommandCard extends Card {
    constructor(
        name: string,
        energy: number,
        public command: Command,
    ) {
        super(name, energy)
    }
}

class Command {
    // Template can contain the following placeholders:
    // FILE - a file name
    // REF - a Git ref
    constructor(public template: string) {}
}

enum Trigger {
    Played,
}

abstract class Effect {
    constructor(public description: string) {}
    abstract apply(battle: Battle, source: Source): void
}

class Source {}

class CreatureSource extends Source {
    constructor(
        public player: boolean,
        public slot: number,
    ) {
        super()
    }
}

class DeleteRandomEnemyEffect extends Effect {
    constructor() {
        super(gt`delete a random enemy`)
    }

    apply(battle: Battle, source: Source) {
        if (source instanceof CreatureSource) {
            let targetSideCreatures = source.player
                ? battle.enemySlots
                : battle.slots

            let slotsWithCreature = (targetSideCreatures as CreatureCard[])
                .map((card, i) => [card, i])
                .filter((card) => card[0] !== null)
            if (slotsWithCreature.length > 0) {
                let slotToDelete = randomPick(slotsWithCreature)[1] as number
                let card = targetSideCreatures[slotToDelete]
                targetSideCreatures[slotToDelete] = null
                let sourceCreature = source.player
                    ? battle.slots[source.slot]
                    : battle.enemySlots[source.slot]
                console.log({sourceCreature, card})
                if (sourceCreature && card) {
                    battle.log(`${sourceCreature.name} killed ${card.name}.`)
                } else {
                    throw new Error(
                        "Source or target of a random enemy deletion was null.",
                    )
                }
            }
        } else {
            throw new Error(
                "DeleteRandomEnemyEffect can only have a creature as a source.",
            )
        }
    }
}

class DrawCardEffect extends Effect {
    constructor(public count: number) {
        super(
            gPlural(count, {
                one: "draw a card",
                other: "draw # cards",
            }),
        )
    }

    apply(battle: Battle, source: Source) {
        if (source instanceof CreatureSource) {
            if (source.player) {
                for (let i = 0; i < this.count; i++) {
                    battle.drawCard()
                }
            }
        } else {
            throw new Error(
                "DrawCardEffect can only have a creature as a source.",
            )
        }
    }
}

class GiveFriendsEffect extends Effect {
    constructor(
        public attack: number,
        public health: number,
    ) {
        super(gt`give all friends +${attack.toString()}/${health.toString()}`)
    }

    apply(battle: Battle, source: Source) {
        if (source instanceof CreatureSource) {
            let targetSideCreatures = source.player
                ? battle.slots
                : battle.enemySlots
            for (let i = 0; i < targetSideCreatures.length; i++) {
                let card = targetSideCreatures[i]
                if (card) {
                    card.attack += this.attack
                    card.health += this.health
                    let sourceCreature = source.player
                        ? battle.slots[source.slot]
                        : battle.enemySlots[source.slot]
                    if (sourceCreature) {
                        battle.log(
                            `${sourceCreature.name} gave ${card.name} +${this.attack}/${this.health}.`,
                        )
                    } else {
                        throw new Error(
                            "Source of a GiveFriendsEffect was null.",
                        )
                    }
                }
            }
        } else {
            throw new Error(
                "GiveFriendsEffect can only have a creature as a source.",
            )
        }
    }
}

enum CardID {
    GraphGnome,
    BlobEater,
    TimeSnail,
    CloneWarrior,
    MergeMonster,
    DetachedHead,
    RubberDuck,
    CollabCentaur,
    Add,
    AddAll,
    Remove,
    Restore,
    Commit,
    CommitAll,
    MakeCopies,
}

function allCards(): Record<CardID, Card> {
    return {
        [CardID.GraphGnome]: new CreatureCard(gt`Graph Gnome`, 2, 1, 2),
        [CardID.BlobEater]: new CreatureCard(gt`Blob Eater`, 3, 2, 2).addEffect(
            Trigger.Played,
            new DeleteRandomEnemyEffect(),
        ),
        [CardID.TimeSnail]: new CreatureCard(gt`Time Snail`, 1, 1, 1),
        [CardID.CloneWarrior]: new CreatureCard(gt`Clone Warrior`, 4, 2, 5),
        [CardID.MergeMonster]: new CreatureCard(gt`Merge Monster`, 4, 4, 4),
        [CardID.DetachedHead]: new CreatureCard(gt`Detached Head`, 0, 0, 2),
        [CardID.RubberDuck]: new CreatureCard(
            gt`Rubber Duck`,
            1,
            1,
            1,
        ).addEffect(Trigger.Played, new DrawCardEffect(1)),
        [CardID.CollabCentaur]: new CreatureCard(
            gt`Collab Centaur`,
            1,
            1,
            1,
        ).addEffect(Trigger.Played, new GiveFriendsEffect(1, 1)),
        //new CommandCard(gt`Init`, 0, new Command("git init")),
        [CardID.Add]: new CommandCard(gt`Add`, 1, new Command("git add FILE")),
        [CardID.AddAll]: new CommandCard(
            gt`Add all`,
            2,
            new Command("git add ."),
        ),
        [CardID.Remove]: new CommandCard(gt`Remove`, 0, new Command("rm FILE")),
        [CardID.Restore]: new CommandCard(
            gt`Restore`,
            2,
            new Command("git restore FILE"),
        ),
        [CardID.Commit]: new CommandCard(
            gt`Commit`,
            2,
            new Command("git commit -m 'Commit'"),
        ),
        [CardID.CommitAll]: new CommandCard(
            gt`Commit all`,
            3,
            new Command("git add .; git commit -m 'Commit'"),
        ),
        [CardID.MakeCopies]: new CommandCard(
            gt`Make copies`,
            3,
            new Command("cp FILE tmp; cp tmp 1; cp tmp 2; cp tmp 3; rm tmp"),
        ),
        //new CommandCard(gt`Stash`, 3, new Command("git stash")),
        //new CommandCard(gt`Pop stash`, 2, new Command("git stash pop")),
        //new CommandCard(gt`Branch`, 1, new Command("git branch FILE")), // TODO: Allow branch targets
        //new CommandCard(gt`Switch`, 1, new Command("git switch -f FILE")), // TODO: Allow branch targets
        //new CommandCard(gt`Merge`, 2, new Command("git merge FILE")), // TODO: Allow branch targets

        /* TODO:
    cp
    mv
    restore -s
    restore
    */
    }
}

function randomCardID(): CardID {
    // TODO: Make more typesafe?
    const enumValues = Object.values(allCards())
    const index = Math.floor(Math.random() * enumValues.length)
    return index
}

function randomCreatureCardID(): CardID {
    // TODO: Make more elegant...
    let options = [
        CardID.GraphGnome,
        CardID.BlobEater,
        CardID.TimeSnail,
        CardID.CloneWarrior,
        CardID.MergeMonster,
        CardID.DetachedHead,
        CardID.RubberDuck,
        CardID.CollabCentaur,
    ]
    return randomPick(options)
}

function randomCard(): Card {
    return buildCard(randomCardID())
}

function buildCard(id: CardID): Card {
    return cloneDeep(allCards()[id])
}

function randomPick<T>(array: T[], clone = false): T {
    const thing = array[Math.floor(Math.random() * array.length)]
    if (clone) {
        return cloneDeep(thing)
    } else {
        return thing
    }
}

// https://stackoverflow.com/a/12646864/248734
function shuffle(array: any[]) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[array[i], array[j]] = [array[j], array[i]]
    }
}

export class SideEffect {}

export class FileChangeSideEffect extends SideEffect {
    constructor(
        public path: string,
        public content: string,
    ) {
        super()
    }
}

export class FileDeleteSideEffect extends SideEffect {
    constructor(public path: string) {
        super()
    }
}

export class CommandSideEffect extends SideEffect {
    constructor(public command: string) {
        super()
    }
}

class Enemy {
    constructor(public battle: Battle) {}

    makeMove(): void {}

    freeSlots(): number[] {
        return this.battle.enemySlots
            .map((card, i) => [card, i])
            .filter((card) => card[0] === null)
            .map((card) => card[1]) as number[]
    }
}

class AlwaysPassingEnemy extends Enemy {
    makeMove() {
        // pass
    }
}

class SnailEnemy extends Enemy {
    makeMove() {
        if (this.freeSlots().length === 0) {
            return
        }
        let randomSlot = randomPick(this.freeSlots())
        this.battle.playCardAsEnemy(CardID.TimeSnail, randomSlot)
    }
}

let blueprints: CardID[][][] = [
    [[CardID.TimeSnail], [], [CardID.TimeSnail], []],
    [[CardID.TimeSnail], [], [CardID.GraphGnome], [], [CardID.MergeMonster]],
    [[CardID.TimeSnail], [CardID.TimeSnail], [], [CardID.BlobEater]],
    [[CardID.CloneWarrior], [], [], [], [CardID.MergeMonster]],
    [[CardID.DetachedHead], [], [], [], [CardID.MergeMonster]],
]

class BluePrintEnemy extends Enemy {
    turn = -1
    blueprint = randomPick(blueprints, true)

    makeMove() {
        if (this.freeSlots().length === 0) {
            return
        }
        let randomSlot = randomPick(this.freeSlots())

        this.turn += 1

        let nextCard: CardID
        if (this.blueprint.length > this.turn) {
            let nextCardOptions = this.blueprint[this.turn]
            if (nextCardOptions.length === 0) {
                return
            }
            nextCard = randomPick(nextCardOptions)
        } else {
            let nextCardOptions = randomPick(this.blueprint)
            if (nextCardOptions.length === 0) {
                return
            }
            nextCard = randomPick(nextCardOptions)
        }
        this.battle.playCardAsEnemy(nextCard, randomSlot)
    }
}

class OPEnemy extends Enemy {
    makeMove() {
        if (this.freeSlots().length === 0) {
            return
        }
        let randomSlot = randomPick(this.freeSlots())
        let card: CardID
        if (Math.random() < 0.5) {
            card = randomCreatureCardID()
        } else {
            card = CardID.MergeMonster
        }
        this.battle.playCardAsEnemy(card, randomSlot)
    }
}

class RandomEnemy extends Enemy {
    turn = -1
    makeMove() {
        this.turn += 1

        if (this.turn % 2 == 1) {
            return
        }

        if (this.freeSlots().length === 0) {
            return
        }
        let randomCard = randomCreatureCardID()
        let randomSlot = randomPick(this.freeSlots())
        this.battle.playCardAsEnemy(randomCard, randomSlot)
    }
}

//I'm going on an adventure!
export class Adventure {
    deck: Card[] = []
    //battle: Battle
    state: Battle | Decision | null

    path: Event[]

    constructor(public onNextEvent: (e: Battle | Decision | null) => void) {
        let cards = [
            CardID.TimeSnail,
            CardID.TimeSnail,
            CardID.GraphGnome,
            CardID.GraphGnome,
            CardID.DetachedHead,
            CardID.DetachedHead,
            CardID.Add,
            CardID.Add,
            CardID.Restore,
            CardID.Restore,
        ]
        this.deck = cards.map((id) => buildCard(id))
        //let deckSize = 10
        //for (let i = 0; i < deckSize; i++) {
        //    this.deck.push(randomCard())
        //}

        this.state = null

        this.path = [
            //new BattleEvent(SnailEnemy),
            new DecisionEvent(),
            new BattleEvent(BluePrintEnemy),
            new DecisionEvent(),
            new BattleEvent(BluePrintEnemy),
            new DecisionEvent(),
            new BattleEvent(RandomEnemy),
            new DecisionEvent(),
            new BattleEvent(RandomEnemy),
            new DecisionEvent(),
            new BattleEvent(OPEnemy),
        ]

        //this.battle = new Battle(this.deck)
        this.enterNextEvent()
    }

    enterNextEvent() {
        if (this.path.length === 0) {
            alert("You are a beautiful aweome person and you win!")
            return
        }
        let nextEvent = this.path.shift()
        if (nextEvent instanceof BattleEvent) {
            this.state = new Battle(this.deck, nextEvent.enemy, (won) => {
                if (won) {
                    this.enterNextEvent()
                } else {
                    alert("GAME OVER")
                }
            })
        } else if (nextEvent instanceof DecisionEvent) {
            this.startNewDecision()
        } else {
            throw new Error(`Unknown event type: ${nextEvent}`)
        }
        this.onNextEvent(this.state)
    }

    startNewDecision() {
        this.state = new Decision([randomCard(), randomCard()], (card) => {
            this.deck.push(card)
            this.enterNextEvent()
        })
    }
}

export class Decision {
    constructor(
        public choices: Card[],
        public onChoice: (a: Card) => void,
    ) {}

    choose(card: Card) {
        this.onChoice(card)
    }
}

class Event {}

class BattleEvent extends Event {
    constructor(public enemy: typeof Enemy) {
        super()
    }
}

class DecisionEvent extends Event {
    constructor() {
        super()
    }
}

export class Battle {
    eventLog: string[] = []

    health = 10
    energy = 1
    maxEnergy = 1

    enemyHealth = 10

    drawPile: Card[] = []
    hand: Card[] = []
    discardPile: Card[] = []

    slots: (CreatureCard | null)[] = [null, null, null]
    enemySlots: (CreatureCard | null)[] = [null, null, null]

    enemy: Enemy

    constructor(
        deck: Card[],
        enemyType: typeof Enemy,
        public onBattleFinished: (won: boolean) => void,
    ) {
        //for (let i = 0; i < deckSize; i++) {
        //    this.drawPile.push(randomPick(templates, true))
        //}
        for (let card of deck) {
            this.drawPile.push(card)
        }
        shuffle(this.drawPile)
        const handSize = 5
        for (let i = 0; i < handSize; i++) {
            this.drawCard()
        }

        this.enemy = new enemyType(this)
    }

    log(event: string) {
        this.eventLog.push(event)
    }

    async playCardFromHand(i: number, target: number): Promise<SideEffect[]> {
        let effects = []

        if (i < 0 || i >= this.hand.length) {
            throw new Error(`Invalid hand index: ${i}`)
        }

        const card = this.hand[i]

        if (card.energy > this.energy) {
            this.log(`Not enough energy to play ${card.name}.`)
            return []
        } else {
            this.energy -= card.energy
        }

        let success = false
        let output = ""
        if (card instanceof CreatureCard) {
            let newCard = cloneDeep(card)
            this.slots[target - 1] = newCard
            let fileContent = card.stringify()
            effects.push(
                new FileChangeSideEffect(`/root/repo/${target}`, fileContent),
            )
            this.log(`Played ${card.name} to slot ${target}.`)
            newCard.triggerEffects(
                this,
                Trigger.Played,
                new CreatureSource(true, target - 1),
            )
            success = true
        } else if (card instanceof CommandCard) {
            const command = card.command.template.replace("FILE", `${target}`)
            effects.push(new CommandSideEffect(command))
            if (card.command.template.includes("FILE")) {
                this.log(`Played ${card.name} to slot ${target}.`)
            } else {
                this.log(`Played ${card.name}.`)
            }
            success = true
        } else {
            throw new Error(`Unknown card type: ${card}`)
        }
        if (success) {
            this.discardHandCard(i)
        }
        return effects
    }

    playCardAsEnemy(cardID: CardID, slot: number) {
        let card = buildCard(cardID)
        if (!(card instanceof CreatureCard)) {
            throw new Error(`Card ${cardID} is not a creature card.`)
        }
        this.enemySlots[slot] = card
        this.log(`Enemy played ${card.name} to slot ${slot + 1}.`)
        card.triggerEffects(
            this,
            Trigger.Played,
            new CreatureSource(false, slot),
        )
    }

    endTurn() {
        this.log("--- You ended your turn ---")
        let effects = []
        // Fight! Let creatures take damage. If there is no defense, damage goes to players.
        for (let i = 0; i < this.slots.length; i++) {
            const playerCard = this.slots[i]
            const enemyCard = this.enemySlots[i]
            if (playerCard && enemyCard) {
                // Both players have a card in this slot. They fight!
                playerCard.health -= enemyCard.attack
                this.log(
                    `Enemy ${enemyCard.name} dealt ${enemyCard.attack} damage to ${playerCard.name}.`,
                )

                enemyCard.health -= playerCard.attack
                this.log(
                    `Your ${playerCard.name} dealt ${playerCard.attack} damage to ${enemyCard.name}.`,
                )
                if (playerCard.health <= 0) {
                    this.slots[i] = null
                    effects.push(
                        new FileDeleteSideEffect(`/root/repo/${i + 1}`),
                    )
                    this.log(`Your ${playerCard.name} died.`)
                } else {
                    let fileContent = playerCard.stringify()
                    effects.push(
                        new FileChangeSideEffect(
                            `/root/repo/${i + 1}`,
                            fileContent,
                        ),
                    )
                }
                if (enemyCard.health <= 0) {
                    this.enemySlots[i] = null
                    this.log(`Enemy ${enemyCard.name} died.`)
                }
            } else if (playerCard) {
                // Only the player has a card in this slot. It attacks the enemy player.
                this.enemyHealth -= playerCard.attack
                this.log(
                    `${playerCard.name} dealt ${playerCard.attack} damage to the enemy player.`,
                )
                if (this.enemyHealth < 1) {
                    this.onBattleFinished(true)
                }
            } else if (enemyCard) {
                // Only the enemy has a card in this slot. It attacks the player.
                this.health -= enemyCard.attack
                this.log(
                    `Enemy ${enemyCard.name} dealt ${enemyCard.attack} damage to you.`,
                )
                if (this.health < 1) {
                    this.onBattleFinished(false)
                }
            }
        }

        // Let the enemy act.
        this.enemy.makeMove()

        this.drawCard()
        if (this.maxEnergy < 5) {
            this.maxEnergy += 1
        }
        this.energy = this.maxEnergy

        return effects
    }

    drawCard() {
        if (this.drawPile.length === 0) {
            this.drawPile = this.discardPile
            shuffle(this.drawPile)
            this.discardPile = []
            this.log(`Shuffled discard pile into draw pile.`)
        }
        const card = this.drawPile.pop()
        if (card) {
            this.hand.push(card)
            this.log(`You drew ${card.name}.`)
        }
    }

    discardHandCard(i: number) {
        if (i < 0 || i >= this.hand.length) {
            throw new Error(`Invalid hand index: ${i}`)
        }
        const card = this.hand.splice(i, 1)[0]
        this.discardPile.push(card)
    }
}
