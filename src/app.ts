import express from 'express'
import cors from 'cors'
import path from 'path'
import http from 'http'
import { Server, Socket } from 'socket.io'
import { Player, Game } from './interfaces'
import { createLogger, format, transports } from 'winston'

const PORT = process.env.PORT || 3000
const MAX_RANGE_NUMBER = 56
const MIN_RANGE_NUMBER = 2

const playerState = {
    WAITING: -1,
    firstPlayer: 0,
    secondPlayer: 1,
}

const emitEvents = {
    GAME: 'game',
    INFO: 'info',
    WAITING: 'waiting',
    PLAYERNUMBER: 'playerNumber',
}

const clientMessages = {
    WAITING: 'Waiting for other player join...',
    BLOCKED: 'Please wait, game already running',
    GAMEWAITING: 'Wait, other Player is moving',
}
/**
 * Logger
 */
const logger = createLogger({
    transports: [new transports.Console()],
    level: 'debug', //TODO move to .env
    format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => {
            return `[${timestamp}] ${level}: ${message}`
        })
    ),
})

const app = express()
app.use(cors())

const server = http.createServer(app)
const io = new Server(server)

app.use(express.static(path.join(__dirname, 'public')))

let game: Game = {
    playerOne: undefined,
    playerTwo: undefined,
    movingPlayerId: undefined,
    operations: [],
}

const handleUpdate = {
    /**
     * Sends game to connected client
     * @param  {Socket} socket
     * @param {Game} game
     */
    emitGame: (socket: Socket, game: Game) => {
        socket.emit(emitEvents.GAME, game)
    },
    /**
     * Sends game to connected clients but sender
     * @param  {Socket} socket
     * @param {Game} game
     */
    broadcastGame: (socket: Socket, game: Game) => {
        socket.broadcast.emit(emitEvents.GAME, game)
    },
    /**
     * Sends info text to all connected clients but sender
     * @param {Socket} socket
     * @param {string} text
     */
    othersInfo: (socket: Socket, text: string) => {
        socket.broadcast.emit(emitEvents.INFO, text)
    },
    /**
     * Sends info text to connected client
     * @param {Socket} socket
     * @param {string} text
     */
    clientInfo: (socket: Socket, text: string) => {
        socket.emit(emitEvents.INFO, text)
    },
    /**
     * Sends waiting text to all connected client but sender
     * @param {Socket} socket
     * @param {string} text
     */
    othersWaiting: (socket: Socket, text: string) => {
        socket.broadcast.emit(emitEvents.WAITING, text)
    },

    /**
     * Sends waiting text to connected client
     * @param {Socket} socket
     * @param {string} text
     */
    clientWaiting: (socket: Socket, text: string) => {
        socket.emit(emitEvents.WAITING, text)
    },
}

const gameLogic = {
    /**
     * Initialises the game object with random start number
     * @param {Number} playerId
     * @returns {Game} new Game
     */
    startGame: (playerId: number): Game => {
        const game: Game = {
            playerOne: {
                id: playerId,
                numbers: [],
            },
            playerTwo: {
                id: null,
                numbers: [
                    gameLogic.randomNumber(MAX_RANGE_NUMBER, MIN_RANGE_NUMBER),
                ],
            },
            movingPlayerId: playerId,
            operations: [],
        }
        return game
    },
    /**
     * Calculates next game number and moving player, checks for winner and emits game update messages
     * @param {Player} movingPlayer
     * @param {Player} otherPlayer
     * @param {Socket} socket
     * @returns
     */
    nextMove: (movingPlayer: Player, otherPlayer: Player, socket: Socket) => {
        const actualNumber =
            movingPlayer.numbers[movingPlayer.numbers.length - 1]
        const operations = game.operations[game.operations.length - 1]
        const newNumber = gameLogic.calcNewNumber(actualNumber, operations)

        if (newNumber === 1) {
            const winner = movingPlayer.id + 1
            io.sockets.emit(emitEvents.INFO, `Player ${winner} is the winner`)
            handleUpdate.othersWaiting(socket, '')
            return
        }
        otherPlayer.numbers.push(newNumber)
        game.movingPlayerId = otherPlayer.id
        handleUpdate.clientWaiting(socket, clientMessages.GAMEWAITING)
        handleUpdate.clientInfo(
            socket,
            `your move: ${operations} --> new mumber: ${newNumber}`
        )
        handleUpdate.broadcastGame(socket, game)
    },
    /**
     * Calculates new number by adding operator and divided by 3
     * @param {number} number
     * @param {number} operator
     * @returns {number}
     */
    calcNewNumber: (number: number, operator: number): number => {
        return Math.round((number + operator) / 3)
    },
    /**
     * Calculates whole new number beween maxNumber and minNumber
     * @param {number} maxNumber
     * @param {number} minNumber
     * @returns {number}
     */
    randomNumber: (maxNumber: number, minNumber: number): number => {
        return (
            Math.floor(Math.random() * (maxNumber - minNumber + 1)) + minNumber
        )
    },
}

const connections: number[] = [null, null]

io.on('connection', (socket: Socket) => {
    let playerIndex = -1
    for (const i in connections) {
        if (connections[i] === null) {
            playerIndex = Number(i)
            break
        }
    }
    socket.emit(emitEvents.PLAYERNUMBER, playerIndex)
    //connection check
    if (playerIndex === playerState.WAITING) {
        handleUpdate.clientWaiting(socket, clientMessages.BLOCKED)
        return
    } else if (playerIndex === playerState.firstPlayer) {
        logger.debug('first Player')
        game = gameLogic.startGame(playerIndex)
        handleUpdate.clientWaiting(socket, clientMessages.WAITING)
    } else {
        logger.debug('second')
        game.playerTwo.id = playerState.secondPlayer
        game.movingPlayerId = playerState.secondPlayer
        //start game
        handleUpdate.emitGame(socket, game)
        handleUpdate.othersWaiting(socket, clientMessages.GAMEWAITING)
    }

    connections[playerIndex] = playerIndex

    if (connections.includes(null)) {
        handleUpdate.clientWaiting(socket, clientMessages.WAITING)
    }

    socket.on('next-move', (data: number) => {
        logger.debug(`next move: ${data}`)
        game.operations.push(Number(data))
        logger.debug(`game: ${game}`)
        if (game.movingPlayerId === game.playerOne.id) {
            gameLogic.nextMove(game.playerOne, game.playerTwo, socket)
        } else {
            gameLogic.nextMove(game.playerTwo, game.playerOne, socket)
        }
    })

    socket.on('disconnect', () => {
        logger.info(`player ${playerIndex} disconnected`)
        connections[playerIndex] = null
    })
})

server.listen(PORT, () => {
    //Umgebungsvariable Nutzen
    logger.info(`Application listen at: http://localhost:${PORT}`)
})
