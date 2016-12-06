"use strict";


/** Builds a level object
  */
function Level(plan){
	
	this.width = plan[0].length;
	this.height = plan.length;
	this.grid = []; // 2D grid of static elements: empty/wall/lava
	this.actors = []; // array of moving actors
	this.player = null; 

	// build the level grid
	for(let y = 0; y < this.height; ++y){
		
		var line = plan[y], gridLine = [];

		for(let x = 0; x < this.width; ++x){
			
			var ch = line[x];
			var fieldType = null;
			var Actor = actorChars[ch];
			
			if(Actor){
				this.actors.push(new Actor(new Vector(x,y), ch));
			}
			else if(ch === 'x'){
				fieldType = 'wall';
			}
			else if(ch === '!'){
				fieldType = 'lava';
			}
			gridLine.push(fieldType);
		}
		this.grid.push(gridLine);
	}

	// filter out the player actor
	this.player = this.actors.filter(function(actor){
		return actor.type === 'player';
	})[0];

	// set level status
	this.status = this.finishDelay = null;
}
Level.prototype.isFinished = function(){
	// 
	return (this.status != null && this.finishDelay < 0);
};
// obstacle collision detection
Level.prototype.obstacleAt = function(pos, size){
	var xStart = Math.floor(pos.x);
	var xEnd = Math.ceil(pos.x + size.x);
	var yStart = Math.floor(pos.y);
	var yEnd = Math.ceil(pos.y + size.y);

	if(xStart < 0 || xEnd > this.width || yStart < 0) {
		return "wall";
	}
	if(yEnd > this.height) {
		return "lava";
	}
	for(var y = yStart; y < yEnd; ++y){
		for(var x = xStart; x < xEnd; ++x){
			var fieldType = this.grid[y][x];
			if(fieldType) return fieldType;
		}
	}
};
// find another actor that overlaps the one given as argument
Level.prototype.actorAt = function(actor){
	
	for(var i = 0; i < this.actors.length; i++){
		var other = this.actors[i];
		if(other != actor &&
			actor.pos.x + actor.size.x > other.pos.x &&
			actor.pos.x < other.pos.x + other.size.x &&
			actor.pos.y + actor.pos.y > other.pos.y &&
			actor.pos.y < other.pos.y + other.size.y){
				return other;
		}
	}
};

var maxStep = 0.01; // max step time in seconds
Level.prototype.animate = function(step, keys){
	
	if(this.status != null){
		this.finishDelay -= step;
	}
	
	while(step > 0){
		var thisStep = Math.min(step, maxStep);
		
		// trigger each actor's act method
		this.actors.forEach(function(actor){
			actor.act(thisStep, this, keys);
		}, this);
		
		step -= thisStep;
	}
};

// handle player collisions
Level.prototype.playerTouched = function(type, actor){

	if(type == 'lava' && this.status == null){ // player touched lava
		this.status = 'lost';
		this.finishDelay = 1;
	}
	else if(type == 'coin'){ // player collected the coin
		
		// remove the collected coin from the actors array
		this.actors = this.actors.filter(function(other){
			return other != actor;
		});

		// check if there are any more coins
		var hasSomeCoins = this.actors.some(function(actor){
			return actor.type == 'coin';
		});

		// no more coins? won the level!
		if(!hasSomeCoins){
			this.status = 'won';
			this.finishDelay = 1;
		}
	}

};


/** Vector and vector operations
  */ 
function Vector(x,y){
	this.x = x;
	this.y = y;
}
Vector.prototype.plus = function(vector){
	return new Vector(
		this.x + vector.x,
		this.y + vector.y
	);
};
Vector.prototype.times = function(factor){
	return new Vector(
		this.x * factor,
		this.y * factor
	);
};



/** 
  * Player
  */
function Player(pos) {
	this.pos = pos.plus(new Vector(0, -0.5));
	this.size = new Vector(0.8, 1.5);
	this.speed = new Vector(0,0);
}
Player.prototype.type = "player";

// handle player's horizontal movement
var playerXSpeed = 7;
Player.prototype.moveX = function(step, level, keys){

	// set the initial x-speed as zero
	this.speed.x = 0;
	
	// handle left/right arrow key presses
	if(keys.left) this.speed.x -= playerXSpeed;
	else if(keys.right) this.speed.x += playerXSpeed;

	// motion vector
	var motion = new Vector(this.speed.x * step, 0);
	
	// calculate new position after movement
	var newPos = this.pos.plus(motion);

	// check if there is an obstacle at new position
	var obstacle = level.obstacleAt(newPos, this.size);
	if(obstacle){
		level.playerTouched(obstacle);
	} else {
		this.pos = newPos;
	}
};

// handle player's vertical movement (gravity/jump)
var gravity = 35, jumpSpeed = 17;
Player.prototype.moveY = function(step, level, keys){
	
	this.speed.y += step * gravity;
	
	var motion = new Vector(0, this.speed.y * step);
	var newPos = this.pos.plus(motion);
	
	var obstacle = level.obstacleAt(newPos, this.size);
	if(obstacle){
		level.playerTouched(obstacle);

		if(keys.up && this.speed.y > 0){
			this.speed.y = -jumpSpeed;
		}
		else {
			this.speed.y = 0;
		}
	} else {
		this.pos = newPos;
	}
};

// player's act method
Player.prototype.act = function(step, level, keys){
		
	// handle X and Y motions
	this.moveX(step, level, keys);
	this.moveY(step, level, keys);

	// handle collisions with other actors
	var otherActor = level.actorAt(this);
	if(otherActor){
		level.playerTouched(otherActor.type, otherActor);
	}

	// losing animation
	if(level.status == 'lost'){
		this.pos.y += step;
		this.size.y -= step;
	}
};



/** Lava
  */
function Lava(pos, ch){
	
	this.pos = pos;
	this.size = new Vector(1,1);
	this.speed = null;
	this.repeatPos = null;

	if(ch == '='){
		// horizontally moving lava
		this.speed = new Vector(2,0);
	}
	else if(ch == '|'){
		// vertically moving lava
		this.speed = new Vector(0,2);
	}
	else if(ch == 'v'){
		// dripping lava
		this.speed = new Vector(0,3);
		this.repeatPos = pos;
	}
}
Lava.prototype.type = "lava";
Lava.prototype.act = function(step, level){

	// calculate new position based on speed vector
	var newPos = this.pos.plus(this.speed.times(step));

	if(!level.obstacleAt(newPos, this.size)){
		this.pos = newPos; // if no obstacle - move actor to the new position
	}
	else if(this.repeatPos){
		this.pos = this.repeatPos; // dripping lava
	}
	else {
		this.speed = this.speed.times(-1); // revert the speed vector
	}
};



/** Coin
  */
function Coin(pos) {
	this.basePos = this.pos = pos.plus(new Vector(0.2, 0.1));
	this.size = new Vector(0.6, 0.6);
	this.wobble = Math.random() * Math.PI * 2; // start position is random
}
Coin.prototype.type = "coin";

var wobbleSpeed = 8, wobbleDist = 0.15;
Coin.prototype.act = function(step) {
	this.wobble += step * wobbleSpeed;
	var wobblePos = Math.sin(this.wobble) * wobbleDist;
	this.pos = this.basePos.plus(new Vector(0, wobblePos));
};



// Helper function creates a new DOM element with a given css class name
function elt(name, className){
	var elt = document.createElement(name);
	if(className) elt.className = className;
	return elt;
}


/**
  * DOM Display
  */
var scale = 30
function DOMDisplay(parent, level){
	this.wrap = parent.appendChild( elt('div','game') );
	this.level = level;

	if(level){
		this.wrap.appendChild( this.drawBackground() );
		this.actorLayer = null;
		this.drawFrame();
	}
}
DOMDisplay.prototype.drawBackground = function(){
	
	var table = elt('table','background');
	table.style.width = this.level.width * scale + 'px';

	this.level.grid.forEach(function(row){
		var rowElt = table.appendChild( elt('tr') );
		rowElt.style.height = scale + 'px';
		
		row.forEach(function(type){
			rowElt.appendChild( elt('td', type) );
		});
	});

	return table;
};
DOMDisplay.prototype.drawActors = function(){

	var wrap = elt('div','actors');

	this.level.actors.forEach(function(actor){
		
		var newActor = elt('div','actor ' + actor.type);
		var rect = wrap.appendChild(newActor);
		rect.style.width = actor.size.x * scale + 'px';
		rect.style.height = actor.size.y * scale + 'px';
		rect.style.left = actor.pos.x * scale + 'px';
		rect.style.top = actor.pos.y * scale + 'px';
	});

	return wrap;
};
DOMDisplay.prototype.drawFrame = function(){
	
	// clear the actor layer if one exists
	if(this.actorLayer){
		this.wrap.removeChild( this.actorLayer );
	}

	// re-draw actors layer
	this.actorLayer = this.wrap.appendChild( this.drawActors() );

	// set class for the wrapping element
	this.wrap.className = "game " + (this.level.status || "");
	
	// scroll view if needed
	this.scrollPlayerIntoView();
};
DOMDisplay.prototype.scrollPlayerIntoView = function(){
	
	var width = this.wrap.clientWidth;
	var height = this.wrap.clientHeight;
	var marginX = width / 3;
	var marginY = height / 3;

	// the viewport
	var left = this.wrap.scrollLeft, right = left + width;
	var top = this.wrap.scrollTop, bottom = top + height;

	// find player center
	var player = this.level.player;
	var center = player.pos.plus(player.size.times(0.5)).times(scale);

	// scroll on the x-axis
	if(center.x < left + marginX){
		this.wrap.scrollLeft = center.x - marginX;
	} else if(center.x > right - marginX){
		this.wrap.scrollLeft = center.x + marginX - width;
	}

	// scroll on the y-axis
	if(center.y < top + marginY){
		this.wrap.scrollTop = center.y - marginY;
	} else if(center.y > bottom - marginY){
		this.wrap.scrollTop = center.y + marginY - height;
	}
};
DOMDisplay.prototype.displayWinMessage = function(){
	var won = elt('div', 'winning');
	var txt = document.createTextNode('You won!');
	won.appendChild(txt);
	this.wrap.appendChild(won);
};
DOMDisplay.prototype.clear = function(){
	this.wrap.parentNode.removeChild(this.wrap);
};



var arrowCodes = {37: "left", 38: "up", 39: "right"};

function trackKeys(codes) {
	var pressed = Object.create(null);
	
	function handler(event) {
		if (codes.hasOwnProperty(event.keyCode)) {
			pressed[codes[event.keyCode]] = (event.type == "keydown");
			event.preventDefault();
		}
	}

	addEventListener("keydown", handler);
	addEventListener("keyup", handler);
	return pressed;
}


function runAnimation(frameFunc) {
	var lastTime = null;

	function frame(time) {
		var stop = false;
	
		if (lastTime != null) {
			var timeStep = Math.min(time - lastTime, 100) / 1000;
			stop = (frameFunc(timeStep) === false);
		}
		lastTime = time;
	
		if (!stop)
		  requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);
}

// track key presses
var arrows = trackKeys(arrowCodes);

// run the level
function runLevel(level, Display, andThen) {
	
	var display = new Display(document.body, level);
	
	runAnimation( function(step){
		level.animate(step, arrows);
		display.drawFrame(step);
		if (level.isFinished()) {
			display.clear();
			if (andThen){
				andThen(level.status);
  			}
  			return false;
		}
	} );
}

// runs the game (series of levels)
function runGame(plans, Display) {
	
	var lives = 3;

	// starts the n-th level
	function startLevel(n){
		
		runLevel( new Level(plans[n]), Display, function(status) {
			if (status == "lost"){
				--lives
				if(lives > 0){
					startLevel(n); // re-start the n-th level	
				} else {
					lives = 3;
					startLevel(0);
				}
			}
			else if (n < plans.length - 1){
				startLevel(n + 1); // run the (n+1)-th level
			}
			else{
				var display = new Display(document.body, null);
				display.displayWinMessage();
			}
		});
	}

	startLevel(0);
}



// types of actors
var actorChars = {
	'@' : Player,
	'o' : Coin,
	'=' : Lava,
	'|' : Lava,
	'v' : Lava,
};

// define level plans
var level0 = [
	"            |        |             ",
	"                                   ",
	"                                   ",
	"                o                  ",
	"                x       x          ",
	"        o       x       x          ",
	"  @    xxx      x       x      o   ",
	"xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
];

var level1 = [     
	"                                           v                 xxxxxxx      ",
	"     @                                                       v     x      ",                                     
	"                                                                   x      ",
	"  xxx                                               o              x      ",  
	"  x              = xxx                           xxxxx             x      ",
	"  x         o o    x           x                                   x      ",
	"  x        xxxxx   x           x         o                      o  x      ",
	"  xxxxx            x     xx    x        xxxx              xxxxxxxxxx      ",
	"      x!!!!!!!!!!!!x           x                                             ",                                  
	"      xxxxxxxxxxxxxx!!!!!!!!!!!xxxxxx!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
	"                                                                             ",
	"                                                                             ",
];

var level2 = [     
	"x                                                                          ",
	"x                                                                          ",
	"x                                                                          ",
	"x                                                                          ",
	"x                                                                          ",
	"x                                    o  o                              o   ",
	"x                                   xxxxxx                         =xxxxxxx",
	"x                                     |        xxx=                        ",
	"x                                                                          ",
	"x                 xx       o                              xxxxxx           ",
	"x                        xxxxxx       o             o                      ",                                     
	"x                                     xx      xxxxxxx                      ",
	"x             o  o                                                         ",  
	"x            =xxxxx                                                        ",
	"x                                       o                                  ",
	"x@                                    xxxxx                                ",
	"xx                                                                         ",
	"!!!!!!!xxxxxxxxxxxx!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!",
];

const GAME_LEVELS = [level0, level1, level2];