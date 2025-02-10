// let socket;


// function init_canvas(){
// 	const canvas = document.getElementById('pongServer');
// 	let ctx = canvas.getContext('2d');
// 	let match = document.getElementById('matchmaking');
// }

// init_canvas();

// match.addEventListener('click', () => {
// 	if (window.gameMode === 'ia' || window.gameMode === 'versus'){
// 		stopGame()
// 	}
// 	// gameMode = 'server';
//     if (!socket || socket.readyState === WebSocket.CLOSED) {
//         initWebSocket();
//     }
// });

// // function initWebSocket() {
// //     socket = new WebSocket('ws://localhost:8000/ws/pongserver/');

// //     socket.addEventListener('open', (event) => {
// //         console.log('WebSocket connected');
// //     });

// //     socket.addEventListener('message', (event) => {
// //         const gameState = JSON.parse(event.data);
// //         if (gameState && gameState.pads) {
// //             draw(gameState);
// //         }
// //         // if (gameState.waiting) {
// //         //     document.getElementById('status-message').innerText = "Vous êtes en attente d'un adversaire...";
// //         // } else if (gameState.waiting === false) {
// //         //     document.getElementById('status-message').innerText = "Vous avez trouvé votre adversaire";
// //         //     if (!countdownStarted) {
// //         //         countdownStarted = true; // Éviter d'appeler `startCountdown` plusieurs fois
// //         //         startCountdown();
// //         //     }
// //         // }
// //     });

// //     socket.addEventListener('close', () => {
// //         console.log("WebSocket closed.");
// //         if (!isPageUnloading) {
// //             console.log("Reconnecting...");
// //             reconnectTimeout = setTimeout(initWebSocket, 1000); // Reconnexion automatique après 1 seconde
// //         }
// //     });
// // }

// window.initWebSocket = function() {
//     socket = new WebSocket('ws://localhost:8000/ws/pongserver/');

//     socket.addEventListener('open', (event) => {
//         console.log('WebSocket connected');
//     });

//     socket.addEventListener('message', (event) => {
//         const gameState = JSON.parse(event.data);
//         if (gameState && gameState.pads) {
//             draw(gameState);
//         }
//     });

//     socket.addEventListener('close', () => {
//         console.log("WebSocket closed.");
//         if (!isPageUnloading) {
//             console.log("Reconnecting...");
//             reconnectTimeout = setTimeout(initWebSocket, 1000);
//         }
//     });

//     socket.addEventListener('error', (error) => {
//         console.error('WebSocket error:', error);
//     });
// };

// let countdownStarted = false;
// let isPageUnloading = false;

// // function startCountdown() {
// //     let countdown = 3;
// //     const countdownInterval = setInterval(() => {
// //         ctx.clearRect(0, 0, 800, 550); // Efface tout le canvas
// //         draw(); // Redessine les éléments du jeu pour éviter un écran vide
// //         document.getElementById('status-message').innerText = `La partie va commencer dans ${countdown}...`;
// //         countdown--;
// //         if (countdown < 0) {
// //             clearInterval(countdownInterval);
// //             countdownStarted = false; // Réinitialiser pour une prochaine partie
// //         }
// //     }, 1000);
// // }

// function draw(gameState) {
//     // if (!gameState || !gameState.pads || !gameState.ball) {
//     //     console.error("Invalid game state:", gameState);
//     //     return;
//     // }

//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     // Dessiner les raquettes
//     ctx.fillStyle = 'white';
//     ctx.fillRect(gameState.pads.player1.x, gameState.pads.player1.y, 20, 90);
//     ctx.fillRect(gameState.pads.player2.x, gameState.pads.player2.y, 20, 90);

//     // Dessiner la balle
//     ctx.beginPath();
//     ctx.fillRect(gameState.ball.x, gameState.ball.y, 15, 15);
//     ctx.fill();
// }

// function sendMessage(data) {
//     if (socket && socket.readyState === WebSocket.OPEN) {
//         socket.send(JSON.stringify(data));
//     }
// }

// document.addEventListener('keydown', (event) => {
// 	// if (window.gameMode === 'server'){
// 		let input = 0;
// 		if (event.key === 'ArrowUp') {
// 			input = -1;
// 		} else if (event.key === 'ArrowDown') {
// 			input = 1;
// 		}
// 		sendMessage({ input: input });
// 	// }
// });

// document.addEventListener('keyup', (event) => {
// 	// if (gameMode === 'server'){
// 		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
// 			sendMessage({ input: 0 });
//    		}
// 	// }
// });

// window.addEventListener('beforeunload', () => {
//     isPageUnloading = true; // Indique que la page est en train de se décharger
//     if (socket && socket.readyState === WebSocket.OPEN) {
//         socket.close();
//         console.log("WebSocket closed.");
//     }
//     if (reconnectTimeout) {
//         clearTimeout(reconnectTimeout); // Annule la reconnexion automatique
//     }
// });

function initPongGame() {
    // Variables
    let socket;
    let canvas, ctx, match;
    let isPageUnloading = false;
    let reconnectTimeout;

    // Initialisation du canvas et des éléments DOM
    function initCanvas() {
        canvas = document.getElementById('pongServer');
        if (!canvas) {
            console.error("Canvas 'pongServer' non trouvé.");
            return;
        }
        ctx = canvas.getContext('2d');

        match = document.getElementById('matchmaking');
        if (!match) {
            console.error("Bouton 'matchmaking' non trouvé.");
            return;
        }

        // Ajouter l'écouteur d'événements
        match.addEventListener('click', handleMatchClick);
    }

    // Gestion du clic sur le bouton matchmaking
    function handleMatchClick() {
        if (!socket || socket.readyState === WebSocket.CLOSED) {
            initWebSocket();
        }
    }

    // Initialisation de la WebSocket
    function initWebSocket() {
        socket = new WebSocket('ws://localhost:8000/ws/pongserver/');

        socket.onopen = () => {
            console.log('WebSocket connecté.');
        };

        socket.addEventListener('message', (event) => {
            const gameState = JSON.parse(event.data);
            if (gameState && gameState.pads && gameState.ball) {
                draw(gameState);
            }
        });

        socket.onclose = () => {
            console.log("WebSocket fermé.");
        };

        socket.addEventListener('error', (error) => {
            console.error('Erreur WebSocket:', error);
        });
    }

    // Dessiner l'état du jeu
    function draw(gameState) {
        if (!gameState || !gameState.pads || !gameState.ball) {
            console.error("État du jeu invalide:", gameState);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Dessiner les raquettes
        ctx.fillStyle = 'white';
        ctx.fillRect(gameState.pads.player1.x, gameState.pads.player1.y, 20, 90);
        ctx.fillRect(gameState.pads.player2.x, gameState.pads.player2.y, 20, 90);

        // Dessiner la balle
        ctx.beginPath();
        ctx.fillRect(gameState.ball.x, gameState.ball.y, 15, 15);
        ctx.fill();
    }

    // Envoyer un message via WebSocket
    function sendMessage(data) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(data));
        }
    }

    // Gestion des événements clavier
    function initKeyboardEvents() {
        document.addEventListener('keydown', (event) => {
            let input = 0;
            if (event.key === 'ArrowUp') {
                input = -1;
            } else if (event.key === 'ArrowDown') {
                input = 1;
            }
            sendMessage({ input: input });
        });

        document.addEventListener('keyup', (event) => {
            if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                sendMessage({ input: 0 });
            }
        });
    }

    // Nettoyage avant déchargement de la page
    function initCleanup() {
        window.addEventListener('beforeunload', () => {
            isPageUnloading = true;
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.close();
                console.log("WebSocket fermé.");
            }
            if (reconnectTimeout) {
                clearTimeout(reconnectTimeout);
            }
        });
    }

    // Initialisation publique
    function init() {
        initCanvas();
        initKeyboardEvents();
        // initCleanup();
        console.log('PongGame initialisé.');
    }

    // Exposer les méthodes publiques
    return {
        init,
    };
}

// Démarrer l'application une fois le DOM chargé
document.addEventListener('DOMContentLoaded', () => {
    const pongGame = initPongGame();
    pongGame.init();
});
