const canvas = document.getElementById('pong');
const ctx = canvas.getContext('2d')


// PAD PARAMS //

const padWidth = 16; const padHeight = 90; //taille pad
const padSpeed = 5;
let pad1 = {x:10, y:255}; // pos pad
let pad2 = {x: 774, y:255};
let direction1 = 0;
let direction2 = 0;


// BALL PARAMS //

const ballWidth = 12; const ballHeight = 12;
const ballSpeed = 5;
let ball = {x: (canvas.width / 2 - ballWidth / 2), y: canvas.height / 2 - ballHeight / 2};
let directionBall = {x:0, y:0}; // faire du random pour choisir un cote pour la premiere ball sinon envoyer ball au perdant


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
	ctx.fillStyle = 'green';
	ctx.fillRect(pad1.x, pad1.y, padWidth, padHeight); //pos x / pos y / taille x/ taille y/
	ctx.fillRect(pad2.x, pad2.y, padWidth, padHeight)

	// Draw Ball //
	ctx.fillStyle = 'red';
	ctx.fillRect(ball.x,ball.y,ballWidth, ballHeight);

	// Pour centrer les éléments
	// ctx.fillStyle = 'blue';
	// ctx.fillRect(0,300, 800, 1);
	// ctx.fillRect(790,0, 1, 600);
}


// BALL //

function updateBall(){
	ball.x += directionBall.x * ballSpeed;
	ball.y += directionBall.y * ballSpeed;

}

function collisionBall(){
	// ball.x = Math.max(0, Math.min(ball.y, canvas.height - ballHeight));
	ball.y = Math.max(0, Math.min(ball.y, canvas.height - ballHeight));
}


function gameLoop(){
	updatePad();
	updateBall();
	draw();
	requestAnimationFrame(gameLoop);
}

gameLoop();
