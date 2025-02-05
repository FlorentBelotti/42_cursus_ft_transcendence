// import "bot.js"

const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d')
const versus = document.getElementById('versus');
const ia = document.getElementById('ia');
let gameMode = null;
let isGameRunning = false;
let requestID = null;
let ballTouched = false;

// PAD PARAMS //
versus.addEventListener('click', () => {
	gameMode = 'versus';
	startGameLoop();
})

ia.addEventListener('click', ()=>{
	gameMode = 'ia';
	startGameLoop();
})

const padWidth = 20;
const padHeight = 90; //taille pad
const padSpeed = 7;
// Position Pad
let pad1 = {
	x:10,
	y:255
};

let pad2 = {
	x: 770,
	y:255
};

let direction1 = 0;
let direction2 = 0;

let score = {
	score1: 0,
	score2: 0
}

// BALL PARAMS //
const ballHeight = 15;
const ballWidth =  15;

let ball = {
	x: canvas.width / 2 - ballWidth / 2,
	y: canvas.height / 2 - ballHeight / 2,
	ballSpeed: 3
}

let directionBall = {
	x: Math.random() < 0.5 ? -1 : 1,
	y: Math.random() < 0.5 ? -1 : 1,
};

// PAD //
document.addEventListener('keydown', (event) => {
	switch(event.key){
		case 'ArrowUp':
			direction2 = -1;
			break;
		case 'ArrowDown':
			direction2 = 1;
			break;
		case 'z':
			direction1 = -1;
			break;
		case 's':
			direction1 = 1;
	}
})

document.addEventListener('keyup', (event) => {
	switch(event.key){
		case 'ArrowUp':
		case 'ArrowDown':
			direction2 = 0;
			break;
		case 'z':
		case 's':
			direction1 = 0;
			break;
	}
})



function updatePad(){
	pad1.y += direction1 * padSpeed;
	pad2.y += direction2 * padSpeed;

	pad1.y = Math.max(0, Math.min(pad1.y, canvas.height - padHeight));
	pad2.y = Math.max(0, Math.min(pad2.y, canvas.height - padHeight));

}

function draw(){
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Draw Pad //
	ctx.fillStyle = 'white';
	ctx.fillRect(pad1.x, pad1.y, padWidth, padHeight); //pos x / pos y / taille x/ taille y/
	ctx.fillRect(pad2.x, pad2.y, padWidth, padHeight)

	// Draw Ball //
	ctx.fillRect(ball.x,ball.y,ballWidth, ballHeight);

	// Pour centrer les éléments
	// ctx.fillStyle = 'blue';
	// ctx.fillRect(0,300, 800, 1);
	// ctx.fillRect(790,0, 1, 600);
}

// BALL //
let count = 0;

function collisionWall(){
	if (ball.y <= 0 || ball.y >= canvas.height - ballHeight)
		directionBall.y *= -1;
}

function collissionWithPad(){
	// Collision Pad1 //
	if (ball.x <= pad1.x + padWidth && ball.x >= pad1.x &&
		 ball.y + ballHeight >= pad1.y && ball.y <= pad1.y + padHeight)
	{
		let impact = (ball.y + ballHeight / 2) - (pad1.y + padHeight / 2);
		let normalizeImpact = impact / (padHeight / 2);

		let bounceAngle = normalizeImpact * (Math.PI / 3);

		directionBall.x = Math.cos(bounceAngle);
		directionBall.y = Math.sin(bounceAngle);

		if (directionBall.x < 0){
			directionBall.x *= -1;
		}
		console.log(ball.ballSpeed, directionBall.x, directionBall.y);
		let magnitude = Math.sqrt(directionBall.x ** 2 + directionBall.y ** 2);
		directionBall.x /= magnitude;
		directionBall.y /= magnitude;
		count++;
		ball.ballSpeed = 4 + (count * 0.3);
		ball.x = pad1.x + padWidth + 1;

		ball.x = pad1.x + padWidth + Math.abs(directionBall.x) * ball.ballSpeed;

		ballTouched = true;
	}

	// Collision Pad2 //
	if (ball.x + ballWidth >= pad2.x && ball.x <= pad2.x + padWidth &&
		ball.y + ballHeight >= pad2.y && ball.y <= pad2.y + padHeight)
	{
		let impact = (ball.y + ballHeight / 2) - (pad2.y + padHeight / 2);
		let normalizeImpact = impact / (padHeight / 2);

		let bounceAngle = normalizeImpact * (Math.PI / 3);

		directionBall.x = -Math.cos(bounceAngle);
		directionBall.y = Math.sin(bounceAngle);

		let magnitude = Math.sqrt(directionBall.x ** 2 + directionBall.y ** 2);
		directionBall.x /= magnitude;
		directionBall.y /= magnitude;
		count++;
		ball.ballSpeed = 4 + (count * 0.3);
		ball.x = pad2.x - ballWidth - 1;

		ball.x = pad2.x - ballWidth - Math.abs(directionBall.x) * ball.ballSpeed;

		ballTouched = true;
	}
}

function BUTTTTT(){
	if (ball.x <= 0){
		resetBall('right');
		score.score2 += 1;
	}
	if (ball.x >= canvas.width){
		resetBall('left');
		score.score1 += 1;
	}
}

function updateBall(){
	ball.x += directionBall.x * ball.ballSpeed;
	if (ballTouched){
		ball.y += directionBall.y * ball.ballSpeed;
	}
	// collision contre mur
	collisionWall();
	collissionWithPad()

	// but à travailler
	BUTTTTT();
}

function resetBall(scorer){
	ball.x = canvas.width / 2 - ballWidth / 2;
	ball.y = canvas.height / 2 - ballHeight / 2;
	directionBall.x = scorer === 'left' ? -1 : 1;
	directionBall.y = 0;
	ball.ballSpeed = 3;
	count = 0;
	ballTouched = false;
}


//MANAGE SCORE//
function displayScore(){
	ctx.fillStyle = 'white';
	ctx.textAlign = 'center'
	ctx.font = '30px Arial';
	ctx.fillText(score.score1 , canvas.width / 2 - 30, 30); //parametres arbitraire pour le moment
	ctx.fillText(":", canvas.width / 2, 30);
	ctx.fillText(score.score2, canvas.width / 2 + 30, 30);
}

function manageScore(){
	if (score.score1 === 10)
		return ('left');
	if (score.score2 === 10)
		return ('right');
}

function displayWinner(winner){
	if (winner === 'left'){
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.font = '50px Arial';
		ctx.fillText("Player 1 win !", canvas.width / 2, 50);
		stopGame();
	}
	if (winner === 'right'){
		ctx.clearRect(0, 0, canvas.width, canvas.height);
		ctx.font = '50px Arial';
		ctx.fillText("Player 2 win !", canvas.width / 2, 50);
		stopGame();
	}
}

// BOT //
function updatePad1(){
	pad1.y += direction1 * padSpeed;
	pad1.y = Math.max(0, Math.min(pad1.y, canvas.height - padHeight));
}

let targetY = 0;
let botRunning = false;

async function botLoop(){
	botRunning = true;
    while (isGameRunning && gameMode === 'ia') {
        targetY = ball.y - padHeight / 2;
        await new Promise(resolve => setTimeout(resolve, 1000));  // Attends 1 seconde
    }
    botRunning = false;
}

function moveBot() {
    let step = padSpeed; // Pas de déplacement par frame

    if (Math.abs(pad2.y - targetY) < step) {
        pad2.y = targetY; // Si on est très proche, on se positionne directement
    } else if (pad2.y < targetY) {
        pad2.y += step;
    } else if (pad2.y > targetY) {
        pad2.y -= step;
    }
    pad2.y = Math.max(0, Math.min(pad2.y, canvas.height - padHeight)); // Empêche de dépasser les bords
}


//GAME FUNCTIONS//

function stopGame(){
	if (requestID){
		cancelAnimationFrame(requestID);
	}
	isGameRunning = false;
	requestID = null;
}

function gameLoop(){
	if (!isGameRunning)
		return ;
	if (gameMode === 'ia'){
		updatePad1();
		moveBot();
		updateBall();
		draw();
		displayScore();
		let winner = manageScore();
		displayWinner(winner);
	}
	if (gameMode === 'versus'){
		updatePad();
		updateBall();
		draw();
		displayScore();
	}
	requestID = requestAnimationFrame(gameLoop);
}

// gameLoop.hasLogged = false;

function resetGame(){
	pad1.y = 255;
	pad2.y = 255;
	score.score1 = 0;
	score.score2 = 0;
	ball.x = canvas.width / 2 - ballWidth / 2;
	ball.y = canvas.height / 2 - ballHeight / 2;
	directionBall = {
		x: Math.random() < 0.5 ? -1 : 1,
		y: Math.random() < 0.5 ? -1 : 1,
	};
	ball.ballSpeed = 3;
	count = 0;
}

function startGameLoop(){
	if(isGameRunning){
		stopGame();
	}
	resetGame();
	isGameRunning = true;
	if (gameMode === 'ia' && !botRunning) {
        botLoop();  // On démarre la boucle du bot
    }
	gameLoop();
}


