document.addEventListener('DOMContentLoaded', () => {
    const title = document.querySelector('.title')
    const info = document.querySelector('.info')
    const waiting = document.querySelector('.waiting')
    const allbuttons = document.querySelectorAll('.field .button')
    const numberField = document.querySelector('.number')
    let socket = null
    let playerNumber = 0
    let currentPlayer = 'Player 1'

    const uiControl = {
        setTitle: (text) => {
            title.innerHTML = text
        },
        setInfo: (text) => {
            info.innerHTML = text
        },
        setWaiting: (text) => {
            waiting.innerHTML = text
        },
        setNumber: (number) => {
            numberField.innerHTML = number
        },
        showButtons: (show) => {
            let display = 'none'
            if (show === true) {
                display = ''
            }
            allbuttons.forEach((button) => {
                button.style.display = display
            })
        },
    }

    const getNumber = (game) => {
        if (game.playerOne.id === game.movingPlayerId) {
            return game.playerOne.numbers[game.playerOne.numbers.length - 1]
        }
        return game.playerTwo.numbers[game.playerTwo.numbers.length - 1]
    }

    uiControl.showButtons(false)

    socket = io()
    socket.on('playerNumber', (number) => {
        if (number === -1) {
            uiControl.setTitle('')
        } else {
            playerNumber = parseInt(number)
            if (playerNumber === 1) currentPlayer = 'Player 2'
            uiControl.setTitle(currentPlayer)
        }
    })

    socket.on('info', (text) => {
        uiControl.setInfo(text)
    })

    socket.on('waiting', (text) => {
        uiControl.setWaiting(text)
    })

    socket.on('game', (newGame) => {
        const game = newGame
        if (playerNumber === game.movingPlayerId) {
            uiControl.setInfo('')
            uiControl.setWaiting('')
            uiControl.setNumber(getNumber(game))
            uiControl.showButtons(true)
        }
    })

    document.addEventListener('click', (event) => {
        socket.emit('next-move', event.target.value)
        uiControl.showButtons(false)
        uiControl.setNumber('')
    })
})
