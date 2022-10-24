export interface Player {
    id: number
    numbers: number[]
}

export interface Game {
    playerOne: Player
    playerTwo: Player
    movingPlayerId: number
    operations: number[]
}
