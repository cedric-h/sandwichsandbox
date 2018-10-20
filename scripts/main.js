var canvas;
var ctx;

var angleToMouse = 0;
var mouseDown = false;
var shiftDown = false;

var bullets = [];
var buildings = [];
var enemies = [];
var particles = [];
var messages = [];

var gameState = "building";
var battleFormation;//this'll be a function from battleFormations
var isPlacing = null;

var score = 0;
var coins = localStorage.getItem("coins")*1 || 0;

var gunActive = true;

var menu = menuLoad;

const TAU = Math.PI*2;

var cameraX = 0;
var cameraY = 0;

var sandwichImage;

var AIAccuracy = 14;
var obstacleMap;

var lastFrameTime = Date.now();
var downTime;

var PF;

requirejs(['jquery', 'helper/pathfinding'], function($, pathfinding){
    PF = pathfinding;

    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext('2d');

    adjustScreen(true);

    loadBuildings();

    messages.push(new message("sandwich sandbox", 15000, 60));


    //EVENT LISTENERS
    //screen resizing
    $(window).on('resize', adjustScreen);
    
    //finger movement tracking
    $(window).on('touchmove', function(event){
        angleToMouse = Math.atan2(event.originalEvent.touches[0].pageY - canvas.height/2 + cameraY, event.originalEvent.touches[0].pageX - canvas.width/2 + cameraX);
    });
    
    //more mouse movement tracking
    $(window).on('mousemove', function(event){
        event.preventDefault();

        let mousePos = getMousePos(event);
        angleToMouse = Math.atan2(mousePos.y - canvas.height/2, mousePos.x - canvas.width/2);

        /*dragon tail cursor
        let newSpurt = new spurt(mousePos.x, mousePos.y, angleToMouse);
        newSpurt.getSize = function(){
            return Math.random() + 1;
        }
        newSpurt.init();
        particles.push(newSpurt);
        */

        return false;
    });
    
    //mouse click tracking
    $(window).on('touchstart mousedown', function(event){
        
        if(isPlacing)
        {
            new Promise(resolve => resolve()).then(() =>
            {
                let savedBuilds = localStorage.getItem("savedBuilds");

                try {
                    localStorage.setItem("savedBuilds", JSON.stringify(buildings));
                }

                catch(err) {
                    alert("storage overflowed! unable to save!");
                }
            });
        }

        else {
            mouseDown = true;
            event.preventDefault();

            if(event.originalEvent.touches)
                angleToMouse = Math.atan2(event.originalEvent.touches[0].pageY - canvas.height/2 + cameraY, event.originalEvent.touches[0].pageX - canvas.width/2 + cameraX);
        }
    });
    
    //mouse click untracking
    $(window).on('touchend mouseup', function(event){
        mouseDown = false;
    });
    
    //keyboard event tracking
    $(window).on('keydown keyup', function(event){
        //FOR WHEN KEYS GO DOWN
        if(event.type === 'keydown'){
            if(gameState === "paused" && event.key === ' '){
                gameState = "fighting";
                lastFrameTime = Date.now();
                gameStart();
            }
            
            if(event.key === 'Escape'){
                if(gameState !== "fighting")return;
                
                gameState = "paused";
            }

            if(event.key === "Shift"){
                shiftDown = true;
            }
        }

        //FOR WHEN KEYS GO UP
        else {
            if(event.key === "Shift"){
                shiftDown = false;
            }
        }
    });

    var mousePos1 = false;
    var mousePos2 = false;
    var directionBool = true;

    function pan(event){
        //if(!shiftDown)return;
        if(event.which == 1){
            if(directionBool){
                if(mousePos2){
                    mousePos1 = {
                        x:event.pageX,
                        y:event.pageY
                    }
                    ctx.translate(mousePos1.x - mousePos2.x, mousePos1.y-mousePos2.y);
                    cameraX = cameraX - (mousePos1.x - mousePos2.x);
                    cameraY = cameraY - (mousePos1.y - mousePos2.y);
                }
            }

            else if(!directionBool){
                mousePos2 = {
                    x:event.pageX,
                    y:event.pageY
                }

                if(mousePos1){
                    ctx.translate(mousePos2.x - mousePos1.x, mousePos2.y-mousePos1.y);
                    cameraX = cameraX - (mousePos2.x - mousePos1.x);
                    cameraY = cameraY - (mousePos2.y - mousePos1.y);
                }
            }

            directionBool = !directionBool;
        }
    }

    //camera panning
    $(window).on("mousedown", event => {
        if(shiftDown){
            gunActive = false;
            $(window).on('mousemove', pan);
        }
    });

    $(window).mouseup(function(){
        gunActive = true;
        $(window).off('mousemove', pan);
        mousePos1 = false;
        mousePos2 = false;
    });


    //image loading

    sandwichImage = new Image();
    sandwichImage.src = "sandwich.png";

    //game starting
    sandwichImage.onload = gameStart;
});


//general purpose functions

function distance(X1MinusX2, Y1MinusY2){
    return Math.sqrt(X1MinusX2*X1MinusX2 + Y1MinusY2*Y1MinusY2);
}

function manhattanDistance(X1MinusX2, Y1MinusY2){
	return Math.abs(X1MinusX2) + Math.abs(Y1MinusY2);
}

function getMousePos(event) {
  return {
    x: event.clientX + cameraX,
    y: event.clientY + cameraY
  };
}


function grabStructureAt(x, y){
    for(let iterator = 0; iterator < buildings.length; iterator++){
        let structureGrabbed = buildings[iterator].grabStructureAt(x, y);
        if(structureGrabbed)return structureGrabbed;
    }
}


function blockNode(x, y, structure, map){
    map.setWalkableAt(x, y, false);

    if(map.nodes[y][x].parents)
        map.nodes[y][x].parents.push(structure);
    else
        map.nodes[y][x].parents = [structure];
}
function getObstacleMap(accuracy=AIAccuracy){
	let width = Math.ceil(1200/AIAccuracy);
	let height = Math.ceil(1200/AIAccuracy);
    let map = new PF.Grid(width, height);
    let structure;

	for(let x = 0; x < width; x++){
		for(let y = 0; y < height; y++){

			for(let i = 0; i < AIAccuracy; i++){
                structure = grabStructureAt(x*AIAccuracy + i, y*AIAccuracy + i);

				if(structure){
					blockNode(x, y, structure, map);

                    /*
                    if(structure.isPost){
                        blockNode(x + 1, y, structure, map);
                        blockNode(x - 1, y, structure, map);
                        blockNode(x, y + 1, structure, map);
                        blockNode(x, y - 1, structure, map);
                    }*/

					break;
				}
			}
		}
	}

	return map;
}

function makeTileCoord(coord){
    return Math.round(coord/AIAccuracy);
}

function renderObstacleMap(obstacleMap){
    ctx.fillStyle = 'grey';

	obstacleMap.nodes.forEach((yValues, x) => {
		yValues.forEach((tileValue, y) => {

			if(tileValue.walkable === false)
                ctx.fillRect(y*AIAccuracy, x*AIAccuracy, AIAccuracy, AIAccuracy);
		})
	})
}


function loadBuildings(){
    buildings = localStorage.getItem("savedBuilds");
    
    //if it can find a string that was stored.
    if(typeof buildings === "string") {
        buildings = JSON.parse(buildings);

        buildings.forEach((existingBuilding, index) => {
            let newBuilding = new building();

            newBuilding.posts = existingBuilding.posts;
            newBuilding.walls = existingBuilding.walls;

            [newBuilding.walls, newBuilding.posts].forEach((structureSet) => {
                structureSet.forEach(function(existingStructure, index){
                    let newStructure = new structure();
                    for(attribute in existingStructure){
                        newStructure[attribute] = existingStructure[attribute];
                    }

                    structureSet[index] = newStructure;
                });
            });
            buildings[index] = newBuilding;
        });
    }
    
    //if it returns null, meaning that it found nothing, or something really weird happens
    else
        buildings = [];

    obstacleMap = getObstacleMap();
}


String.prototype.camelize = function(){
  const [first, ...acc] = this.replace(/[^\w\d]/g, ' ').split(/\s+/);
  return first.toLowerCase() + acc.map(x => x.charAt(0).toUpperCase() 
    + x.slice(1).toLowerCase()).join('');
}


String.prototype.capitalize = function(){
    str = str.toLowerCase().replace(/\b[a-z](?=[a-z]{2})/g, function(letter) {
    return letter.toUpperCase(); } );
};


function adjustScreen(){
    let oldCanvasWidth = canvas.width;
    let oldCanvasHeight = canvas.height;

    canvas.width = $(window).width();
    canvas.height = $(window).height();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    cameraX = 0;
    cameraY = 0;


    enemies.forEach(function(enemy){
        enemy.angle = Math.atan2(enemy.y - canvas.height/2, enemy.x - canvas.width/2);
    });
    buildings.forEach(building => {
        [building.walls, building.posts].forEach(structureSet => {
            structureSet.forEach(structure => {
                structure.x -= (oldCanvasWidth/2 - canvas.width/2);
                structure.y -= (oldCanvasHeight/2 - canvas.height/2);
            });
        });
    });
}

function isWithin(valueToTest, valueToTestAgainst, tolerance){
	return (valueToTest < valueToTestAgainst+tolerance) && (valueToTest > valueToTestAgainst-tolerance);
}

//end of general purpose functions.





//big ole objects
var battleFormations = {
    /*
        Hello! I tried to make the battle formations system as easy as possible.
        Each battle formation is an object comprised of three functions. You can add more if you want; I won't stop you.

        Init is called in the very beginning of the battle. You might use it to deploy an enemy that will find the first path for more enemies.

        Loop is called once an update loop.

        Clear is called when the player dies, and is passed no parameters. You'll want to call clear yourself if the player defeats your formation.

        Most of your battle formations are going to revolve around instantiating enemies and changing them.

        Want to make an enemy that runs towards bullets instead of dodging them?
        Change the dodge() function, the default one in the enemy instantiator might help with the math. (change the - to a +)

        Or perhaps you want to make an enemy revolve around another enemy? Overwrite his defaultMovement(); with a function in the scope of
        your battle formation, so you have access to the other enemy and this enemy in the same scope. defaultMovement is called when your
        enemy isn't dodging or his path isn't blocked, and by default defaultMovement just follows the enemy's path.

        Or perhaps you want to add something to the enemies behavior? You could save a copy of a default function, and then call it in an
        overwrite of that function, or you could overwrite the enemy.extraUpdate function that's called once an update loop per enemy.

        Here I have some examples, if you have any questions or know how to do something better, let me know!
        Good luck!
    */

    column:{
        //In this battle formation, one small enemy appears. When he's killed, 35 of his friends come to avenge him, in one long column.

        init:function(){
            this.scoutDead = false;

            let scout = new enemy();
            scout.speed = 0.25;//Scout will be fast for now

            scout.onMapHandler = () => {
                //onMapHandler gets called each time the enemy's path is updated if he's on the map.

                scout.speed = 0.35;//we'll slow scout back down now that he's on the map

                if(scout.path !== "blocked"){
                    //If the scout found a viable path, push the story forward

                    messages.push(new message("The scout has appeared!", 3000));
                    let slowDude = setTimeout(() => {
                        messages.push(new message("Hmm. He's a bit slow, isn't he?", 8000));
                    }, 7000);

                    //Then, store his path so the rest of the guys can follow it.
                    this.path = scout.path.slice();//the scout path is stored as a reference, slice gets a copy.

                    scout.onMapHandler = () => {};//wipe the handler because we only want the handler to run when he first gets on the map.

                    //Now that the scout has a path that works, let's make some people go onto the path when he dies.
                    scout.deathHandler = () => {//when the scout dies
                        messages.push(new message("Aww. Poor dude.", 3000));
                        clearTimeout(slowDude);
                        
                        score += 20;

                        setTimeout(() => {
                            messages.push(new message("Oh, look. He brought friends.", 15000));
                            this.spawnCount = 45;
                            this.scoutDead = true;
                        }, 2500);//then his friends come to avenge him :D
                    }
                }

                else {
                    //now if the scout can't find a path at first,
                    //the code above should get called when he does.
                    //But if he doesn't, we'll wait until he dies, and then send out a new scout.
                    
                    scout.deathHandler = () => {
                        this.init();
                    }
                }
            }

            enemies.push(scout);//then we put him in the array of enemies
        },
        //https://youtu.be/BjvoyF1o-wU

        loop:function(){

            if(this.spawnCount && (this.path[0][0] !== undefined || this.path[0][1] !== undefined) && this.scoutDead){//each loop, check to see if spawnCount is > 0, if it is
                let newSpawnCount = this.spawnCount - 1;
                //make a variable called newSpawnCount, which will be spawnCount - 1;
                this.spawnCount = 0;
                //and then make spawnCount 0;

                setTimeout(() => {//Then, 225 ms from now,
                    this.spawnCount = newSpawnCount;//set this.spawnCount to the newSpawnCount.
                    //Then, if spawnCount isn't <= 0, the code will go back to the top of this if next loop.
                }, 225);


                let columnMember = new enemy();//then we spawn an enemy. The above code makes it so that a new enemy is spawned every 300 ms.

                //we set the enemy's x and y to the beginning of the path made by the scout.
                columnMember.x = this.path[0][0];
                columnMember.y = this.path[0][1];
                //and then we set the enemy's path to the scout's path.
                columnMember.pathOverwrite = this.path.slice();

                columnMember.deathHandler = () => {
                    //if the enemy dies,
                    score += 1;//increase the score

                    if(enemies.every(enemy => !enemy.alive)){
                        //then check to see if all of his buddies have been killed too. ;o;    
                        messages.push(new message("You've fought them all off!", 5000));//if they have been, let the player know they won
                        messages.push(new message("+75 extra coins!", 5000));
                        battleFormation.clear(true);//clean up our mess, and tell clear() that we won
                        gameState = "won_1000";//and change the gameState.
                    }
                }

                enemies.push(columnMember);
            }
        },

        clear:function(won=false){
            //cleanup of variables
            this.spawnCount = undefined;
            this.path = undefined;

            coins += score + (won ? 75 : 0) - 20;
        }
    },


    trojandwich:{
        init:function(){
            score += 50;
            let trojan = new enemy();
            trojan.size = 50;

            trojan.deathHandler = () => {
                for(let i = 0; i < 20; i++) {
                    let insideTrojan = new enemy();
                    insideTrojan.path = trojan.path.slice();
                    insideTrojan.x = trojan.x + (Math.random() * 50) - 25;
                    insideTrojan.y = trojan.y + (Math.random() * 50) - 25;

                    insideTrojan.deathHandler = () =>
                    {
                        //if the enemy dies,
                        score += 1;//increase the score

                        if(enemies.every(enemy => !enemy.alive)){
                            //then check to see if all of his buddies have been killed too. ;o;    
                            messages.push(new message("You've fought them all off!", 5000));//if they have been, let the player know they won
                            battleFormation.clear(true);//clean up our mess, and tell clear() that we won
                            gameState = "won_1000";//and change the gameState.
                        }
                    };

                    enemies.push(insideTrojan);
                }
            }

            enemies.push(trojan);
        },

        loop:function(){

        },

        clear:function(won=false){
            coins += score + (won ? 50 : 0) - 50;
        }
    }
}






var upgrades = {
    versionNumber:0.1,
    "fire rate":{
        value:300,
        level:0,
        maxLevel:10,
        cost:10,
        onPurchase:function(){
            this.value = 325 - Math.round(300 * (this.level/this.maxLevel));
        }
    },
    "shots fired":{
        value:1,
        level:0,
        maxLevel:5,
        cost:100,
        onPurchase:function(){
            this.value++;
        }
    },
    "accuracy":{
        value:TAU - TAU*(95/100),
        level:95,
        maxLevel:100,
        cost:1,	
        onPurchase:function(){
            this.value = TAU - TAU*(this.level/(this.maxLevel + 1));

            upgrades["inaccuracy"].value = this.value;
            upgrades["inaccuracy"].level++;
        }
    },
    "inaccuracy":{
        value:TAU - TAU*(95/100),
        level:95,
        maxLevel:100,
        cost:1,
        allowMorePurchases:true,
        onPurchase:function(){
        	if(this.level - 2 < 0){
        		this.level--;
        		return;
        	}
        	this.level = this.level - 2;

            this.value = TAU - TAU*(this.level/(this.maxLevel + 1));

            upgrades["accuracy"].value = this.value;
            upgrades["accuracy"].level--;
        }
    },
    "faster ammo":{
        value:75,
        level:15,
        maxLevel:40,
        cost:3,
        onPurchase:function(){
            this.value += 5;

            upgrades["slower ammo"].value = this.value * -1;
            upgrades["slower ammo"].level--;
        }
    },
    "slower ammo":{
        value:-75,
        level:-15,
        maxLevel:-5,
        cost:3,
        onPurchase:function(){
            this.value += 5;

            upgrades["faster ammo"].value = this.value * -1;
            upgrades["faster ammo"].level--;
        }
    }
}
var oldUpgrades = JSON.parse(localStorage.getItem("upgrades"));
if(oldUpgrades !== null && oldUpgrades.versionNumber === upgrades.versionNumber){
    for(let upgradeName in oldUpgrades){
        if(upgrades[upgradeName].onPurchase)
            oldUpgrades[upgradeName].onPurchase = upgrades[upgradeName].onPurchase;
    }
    upgrades = oldUpgrades;
}

var buildables = {
    versionNumber:0.1,
    "post":{
        cost:0,
        timesPurchased:0,
        onPurchase:function(save, firstTime=true){
            gunActive = false;

            let newBuilding = new building();
            let post      = new structure();
            post.isPost   = true;
            post.color    = "rgba(175,175,175,0.7)";
            post.width    = 30;
            post.height   = 30;
            post.children = 0;

            newBuilding.posts.push(post);
            buildings.push(newBuilding);

            if(firstTime){
                messages.push(new message("click to place", 3000));
                messages.push(new message("escape to cancel", 3500));
            }

            let followMouse = function(event){
                let mousePos = getMousePos(event);
                post.x = mousePos.x;
                post.y = mousePos.y;
            }

            let cancel = function(event){
                if(event.key !== "Shift")messages.push(new message("escape to cancel", 2000));
                if(event.key === "Escape"){
                    setTimeout(() => gunActive = true, 100);
                    buildings.splice(buildings.indexOf(newBuilding), 1);
                    cleanUp();
                    save();
                }
            }

            let cleanUp = function(){
                $(window).off("mousedown", click);
                $(window).off("mousemove", followMouse);
                $(window).off("keydown", cancel);
            }

            let click = function(event){
                if(buildings.some(existingBuilding => {
                        return (existingBuilding !== newBuilding) && existingBuilding.posts.some(existingPost => distance(existingPost.x - post.x, existingPost.y - post.y) < 50);
                    }))
                    messages.push(new message("too close", 3000));

                else {
                    //make the post opaque
                    post.color = "rgba(175,175,175,1)";

                    cleanUp();

                    buildables["post"].onPurchase(save, false);
                }
            }

            $(window).on("mousemove touchmove", followMouse);
            $(window).on("mousedown", click);
            $(window).on("keydown", cancel);
        }
    },
    "wall":{
        cost:0,
        timesPurchased:0,
        onPurchase:function(save, firstTime=true, wallPlacedCallback){
            gunActive = false;

            if(firstTime){
                messages.push(new message("select two posts", 3000));
                messages.push(new message("escape to cancel", 3500));
            }

            var firstPost;
            var firstBuilding;
            var firstPostColorCache;

            var secondPost;
            var secondBuilding;

            let cleanUp = function(){
                if(firstPost && firstPostColorCache)firstPost.color = firstPostColorCache;

                $(window).off("mousedown", checkAndSelect);
                $(window).off("keydown", cancel);
            }

            let cancel = function(event){
                if(event.key !== "Shift")
                messages.push(new message("escape to cancel", 2000));
                if(event.key === "Escape"){
                    setTimeout(() => gunActive = true, 100);
                    cleanUp();
                    save();
                }
            }

            let checkAndSelect = function(event){
                let postSelected;
                let buildingSelected;
                let mousePos = getMousePos(event);

                if(!buildings.some(building => {//not(!) because we only want to return if we couldn't find anything.
                    return building.posts.some(post => {
                        if(post.isInside(mousePos.x, mousePos.y)){
                            postSelected = post;
                            buildingSelected = building;
                            return true;
                        }
                    });
                }))return;

                if(!firstPost){
                    firstPost     = postSelected;
                    firstBuilding = buildingSelected;
                    firstPostColorCache = firstPost.color;
                    firstPost.color     = "red";
                }

                else if(!secondPost && postSelected !== firstPost){
                    secondPost     = postSelected;
                    secondBuilding = buildingSelected;

                    let wall      = new structure();
                    wall.x        = (firstPost.x + secondPost.x)/2;
                    wall.y        = (firstPost.y + secondPost.y)/2;
                    wall.height   = 22;
                    wall.width    = distance(firstPost.x - secondPost.x, firstPost.y - secondPost.y);
                    wall.rotation = Math.atan2(firstPost.y - secondPost.y, firstPost.x - secondPost.x);
                    wall.firstParentX  = firstPost.x;
                    wall.firstParentY  = firstPost.y;
                    wall.secondParentX = secondPost.x;
                    wall.secondParentY = secondPost.y;

                    if(firstBuilding.walls.some(existingWall => 
                            existingWall.x === wall.x && 
                            existingWall.y === wall.y &&
                            existingWall.width === wall.width && (
                            existingWall.rotation === wall.rotation ||
                            existingWall.rotation === Math.atan2(secondPost.y - firstPost.y, secondPost.x - firstPost.x))
                        )){
                        messages.push(new message("that already exists", 1000));
                        secondPost = undefined;
                        return false;
                    }

                    else if(firstPost.children >= 2 || secondPost.children >= 2){
                        messages.push(new message("only two walls per pole", 1000));
                        secondPost = undefined;
                        return false;
                    }

                    if(firstBuilding !== secondBuilding)
                        firstBuilding.mergeWith(secondBuilding);

                    secondPost.children++;
                    firstPost.children++;

                    firstBuilding.walls.push(wall);

                    firstBuilding.centerRotations();

                    cleanUp();
                    
                    if(wallPlacedCallback !== undefined)
                        wallPlacedCallback(wall);

                    buildables["wall"].onPurchase(save, false, wallPlacedCallback);
                }

                return false;//to stop event propagation
            }

            $(window).on("keydown", cancel);
            $(window).on("mousedown", checkAndSelect);
        }
    },
    "bouncy_wall": {
        cost: 0,
        timesPurchased: 0,
        onPurchase: function(save, firstTime=true) {
            let wall = buildables["wall"].onPurchase.bind(this)(save, firstTime, function(wall) {
                wall.bouncy = true;
                wall.color = '#cb4154';
        
            });
        }
    },
    "destroy":{
        cost:0,
        timesPurchased:0,
        onPurchase:function(save){
            gunActive = false;
            messages.push(new message("click to remove", 3000));
            messages.push(new message("escape to stop", 3500));

            let cleanUp = function(){
                setTimeout(() => gunActive = true, 100);

                $(window).off("mousedown", destroy);
                $(window).off("keydown", cancel);
            }

            let cancel = function(event){
                if(event.key !== "Shift")messages.push(new message("escape to stop", 2000));
                if(event.key === "Escape"){
                    cleanUp();
                    save();
                }
            }

            let destroy = function(event){
                let mousePos = getMousePos(event);
                buildings.some(building => {
                    [building.posts, building.walls].some(structureSet => {
                        let structureIndex = structureSet.indexOf(building.grabStructureAt(mousePos.x, mousePos.y))
                        if(structureIndex !== -1){

                            //if it's a wall, we need to take out it's parent posts.
                            if(structureSet === building.walls){
                                building.posts.forEach(post => {

                                    if( 
                                        (post.x === structureSet[structureIndex].firstParentX  &&
                                         post.y === structureSet[structureIndex].firstParentY) ||

                                        (post.x === structureSet[structureIndex].secondParentX &&
                                         post.y === structureSet[structureIndex].secondParentY)
                                    )post.children--;
                                });
                            }

                            if(structureSet[structureIndex].children){
                                messages.push(new message("that post is supporting something", 2000));
                            }

                            else structureSet.splice(structureIndex, 1);
                            return true;
                        }
                    });
                });
            }

            $(window).on("keydown", cancel);
            $(window).on("mousedown", destroy);
        }
    }
}
var oldBuildables = JSON.parse(localStorage.getItem("buildables"));
if(oldBuildables !== null && oldBuildables.versionNumber === buildables.versionNumber){
    for(let upgradeName in oldBuildables){
        if(buildables[upgradeName].onPurchase)
            oldBuildables[upgradeName].onPurchase = buildables[upgradeName].onPurchase;
    }
    buildables = oldBuildables;
}c











function message(message, time, size){
    this.message = message;
    this.time = time;
    this.startTime = time;
    this.size = size || 30;
}


function bullet(rotation){
    
    this.rotation = rotation;
    this.color = "grey";
    this.size = 15;
    this.velocity = upgrades["faster ammo"].value/100;
    this.x = canvas.width/2 + Math.cos(rotation) * this.size;
    this.y = canvas.height/2 + Math.sin(rotation) * this.size;

    this.alive = true;
    
    //this.inBarrel = -50;
    this.heatingBarrel = upgrades['fire rate'].value;
    
    this.update = function(){
        this.heatingBarrel = (this.heatingBarrel <= 0) ? 0 : this.heatingBarrel - downTime;
        //this.inBarrel = (this.inBarrel > 0) ? 1 : this.inBarrel + downTime;

        if((this.x > canvas.width || this.x < 0) || (this.y > canvas.height || this.y < 0)){//if outside of the world
            this.alive = false;
        }

        if(!this.alive)return;

        for(let i = 0; i < downTime; i++){
            this.x = this.x + (Math.cos(this.rotation) * this.velocity);
            this.y = this.y + (Math.sin(this.rotation) * this.velocity);
            
            for(buildingIndex in buildings)
            {
                let building = buildings[buildingIndex];
                let structure = building.isInside(this.x, this.y);
                
                if(structure && this.alive)
                {
                    let isPost = (structure.firstParentX === undefined || structure.secondParentX === undefined);
                    let whichSide;

                    if(!isPost) {
                        let whichSide = (this.x - structure.firstParentX) * (structure.secondParentY - structure.firstParentY) - (this.y - structure.firstParentY) * (structure.secondParentX - structure.firstParentX);
                        wallSurfaceRotation = structure.rotation + ((whichSide <= 0) ? -Math.PI/2 : Math.PI/2);
                    }
                    else
                        wallSurfaceRotation = this.rotation - Math.PI;
                    
                    //if it isn't bouncy or it's a post
                    if(!structure.bouncy || isPost) {
                        let deathSpurt = new spurt(this.x, this.y, wallSurfaceRotation);
                        deathSpurt.count = ((bullets.length > 10) ? 1 : 4);
                        deathSpurt.color = this.color;
                        deathSpurt.getSize = function(){
                            return Math.random()*2 + 3;
                        }
                        deathSpurt.expiresAfter = 200;
                        deathSpurt.init();

                        this.alive = false;
                        break;
                    }

                    else {
                        let bulletVector = {
                            x: Math.cos(this.rotation),
                            y: Math.sin(this.rotation)
                        };
                        let wallVector = {
                            x: Math.cos(wallSurfaceRotation),
                            y: Math.sin(wallSurfaceRotation)
                        };
                        
                        let dot = bulletVector.x * wallVector.x + bulletVector.y * wallVector.y;
                        
                        bulletVector.x += -2*dot*wallVector.x;
                        bulletVector.y += -2*dot*wallVector.y;
                        
                        this.rotation = Math.atan2(bulletVector.y, bulletVector.x);
                    }
                }
            }
        }
        
        ctx.fillStyle = this.color;
        drawRotatedRectangle(this.x, this.y, this.size, this.size, this.rotation);
    };
}


function spurt(x, y, rotation){
    this.droplets = [];
    this.x = x;
    this.y = y;

    this.alive = true;

    this.count = 20;
    this.color = "black";
    this.getSize = function(){
        return Math.random()*5 + 2;
    }
    
    this.init = function(){
        for(var iterator = 0; iterator < this.count; iterator++){
            this.droplets.push([
                this.x,                                                        //start x   0
                this.y,                                                        //start y   1
                rotation + (Math.random()*(Math.PI*0.8) - Math.PI*0.4),        //rotation  2
                10,                                                            //velocity  3
                this.getSize(),                                                //size      4
                this.color                                                     //color     5
            ]);

            if(iterator < this.secondaryCount){
                this.droplets[iterator][4] += this.secondarySizeBonus;
                this.droplets[iterator][5] = this.secondaryColor;
            }

            this.droplets[iterator][4] = this.droplets[iterator][4] * 1.25;
        }
        particles.push(this);

        if(this.expiresAfter)setTimeout(() => this.alive = false, this.expiresAfter);
    }
    
    
    this.update = function(){
        
        this.droplets.forEach(function(droplet){
            droplet[0] = droplet[0] + (Math.cos(droplet[2]) * droplet[3] * downTime/35);//this.x = this.x + (Math.cos(this.rotation) * this.velocity);
            droplet[1] = droplet[1] + (Math.sin(droplet[2]) * droplet[3] * downTime/35);//this.y = this.y + (Math.sin(this.rotation) * this.velocity);
            
            droplet[3] = !(droplet[3] > 0) ? 0 : droplet[3] - droplet[4]/10;
            
            ctx.fillStyle = droplet[5];
            drawRotatedRectangle(droplet[0], droplet[1], droplet[4], droplet[4], droplet[2]);//(this.x, this.y, this.size, this.size, this.rotation);
        });
    };
}



function enemy(angle){
    this.angle = angle || Math.random() * TAU;
    this.speed = 0.15;
    this.size = 20;

    this.directionMultiplier = [1, -1][Math.round(Math.random())];
    
    let coordinatesSafe;
    this.x = Math.cos(this.angle) * 750 + canvas.width/2;
    this.y = Math.sin(this.angle) * 500 + canvas.height/2;

    this.alive = true;

    this.distanceFromCenter = 0;

    this.bulletToAvoid = 0;

    this.path = [];
    this.shouldUpdatePath = true;

    this.onMapHandler = () => {};
    this.deathHandler = () => {};
    this.pathOverwrite;
    


    this.isOutOfBounds = function(){
        return  (makeTileCoord(this.x - AIAccuracy/2) > (obstacleMap.width -  1) || makeTileCoord(this.x - AIAccuracy/2) < 0) ||
                (makeTileCoord(this.y - AIAccuracy/2) > (obstacleMap.height - 1) || makeTileCoord(this.y - AIAccuracy/2) < 0);
    }

    this.explode = function(rotation, color){
    	let thisSpurt = new spurt(this.x, this.y, rotation);
        thisSpurt.count = 12;
        thisSpurt.color = color;

        thisSpurt.getSize = function(){
            return Math.random()*3 + 2;
        }

        if(!color){//then we'll do the default spurt, with the chunks of bread
        	thisSpurt.color = "rgb(237,196,116)";
	        thisSpurt.secondaryCount = 3;
	        thisSpurt.secondaryColor = "rgb(237,196,116)";
	        thisSpurt.secondarySizeBonus = this.size/3;
    	}

    	thisSpurt.init();
    }


    this.findPath = function(){
        if(this.isOutOfBounds()){
            this.path = "outside boundaries";
            this.angle = Math.atan2(canvas.height/2 - this.y, canvas.width/2 - this.x);
        }//if this didn't happen, the enemy is on the map!

        else {
            if(this.pathOverwrite){
                this.path = this.pathOverwrite;
            }

            else {
                let finder = new PF.AStarFinder({
                    allowDiagonal:true,
                    dontCrossCorners:true
                });

                this.path = finder.findPath(makeTileCoord(this.x - AIAccuracy/2), makeTileCoord(this.y - AIAccuracy/2), makeTileCoord(canvas.width/2), makeTileCoord(canvas.height/2), obstacleMap.clone());
                
                if(this.path.length > 0){
                    //this.path = PF.Util.smoothenPath(obstacleMap, this.path);
                    this.path.forEach(step => {
                        step[0] *= AIAccuracy;
                        step[1] *= AIAccuracy;
                    });
                }
                else this.path = "blocked";
            }

            this.onMapHandler();
        }
    };


    this.handleBulletToAvoid = function(){
        if(this.bulletToAvoid !== null && this.bulletToAvoid !== 0){
            //make sure it still exists
            if(bullets.indexOf(this.bulletToAvoid) === -1){//if the bullet doesn't exist anymore, let's not bother
                this.bulletToAvoid = 0;
                this.pathOverwrite = null;
                this.findPath();
            }

            //and if neither of those seem to be an issue, let's see if the bullet is still remotely close to us.
            else if(distance(this.x - this.bulletToAvoid.x, this.y - this.bulletToAvoid.y) > this.size*4){
                this.bulletToAvoid = 0;
                this.pathOverwrite = null;
                this.findPath();
            }

            //if it does, make sure we're not close enough to the player to make dodging useless.
            else if(distance(this.x - canvas.width/2, this.y - canvas.height/2) < this.size*2){
                //because if the enemy gets close enough to the person they should just go kamikaze
                this.bulletToAvoid = null;
                this.angle = Math.atan2(canvas.height/2 - this.y, canvas.width/2 - this.x);
            }
        }


        //let's look to see if there's a bullet to dodge
        if(this.bulletToAvoid === 0){//not else because this.bulletToAvoid could have just been deleted || never defined
            let bulletToAvoidCloseness = this.size*2;
            bullets.forEach(projectile => {
                let bulletCloseness = distance(this.x - projectile.x, this.y - projectile.y);
                if(bulletCloseness < bulletToAvoidCloseness){
                    bulletToAvoidCloseness = bulletCloseness;
                    this.bulletToAvoid = projectile;
                }
            });
        }
    };


    this.dodge = function(){
        let angle = Math.atan2(this.bulletToAvoid.y - this.y, this.bulletToAvoid.x - this.x);
        this.x -= Math.cos(angle) * Math.min(this.speed*(score/30), AIAccuracy);
        this.y -= Math.sin(angle) * Math.min(this.speed*(score/30), AIAccuracy);
        //if you remove the AIAccuracy cap on the speed, then
        //make sure they don't dodge so swiftly they clip through walls
    };


    this.makePath = function(){
        this.angle = Math.atan2(canvas.height/2 - this.y, canvas.width/2 - this.x);

        let newX = this.x + (Math.cos(this.angle) * this.speed);
        let newY = this.y + (Math.sin(this.angle) * this.speed);

        let collidedWith = grabStructureAt(newX, newY);
        if(collidedWith)
            collidedWith.damage(0.1);//if a wall is broken, each enemy finds a new path
        else {
            this.x = newX;
            this.y = newY;
        }
    }


    this.defaultMovement = function(){
        if(Array.isArray(this.path) && this.path.length > 0){
            if(isWithin(this.x, this.path[0][0] + AIAccuracy/2, 1) && isWithin(this.y, this.path[0][1] + AIAccuracy/2, 1)){
                this.path.splice(0, 1);
            }

            if(this.path.length > 0){
                this.angle = Math.atan2(this.path[0][1] + AIAccuracy/2 - this.y, this.path[0][0] + AIAccuracy/2 - this.x);

                this.x += (Math.cos(this.angle) * this.speed);
                this.y += (Math.sin(this.angle) * this.speed);
            }
        }
    }


    //this is an empty function that's called each update loop, meant for overwriting.
    this.extraUpdate = function(){

    }


    this.update = function(){

        //if there's a bullet from last update that we think we should dodge,
        this.handleBulletToAvoid();


        //let's see if we know where we're going
        if(this.shouldUpdatePath){
            this.findPath();
            this.shouldUpdatePath = false;
        }


        let startX;
        let startY;
        let buildingHit;
        let currentMapNode;

        //here's the movement loop: the stuff here needs to happen once a millisecond, instead of whenever the hardware gets around to updating us.
        for(let i = 0; i < downTime; i++){
            startX = this.x;
            startY = this.y;

            //if we're outside of the map, then all we have to do is walk towards the player.
            if(this.path === "outside boundaries") {
                this.angle = Math.atan2(canvas.height/2 - this.y, canvas.width/2 - this.x);
                this.x += (Math.cos(this.angle) * this.speed);
                this.y += (Math.sin(this.angle) * this.speed);

                if(!this.isOutOfBounds()){//if it's not outside of the boundaries
                    this.findPath();
                }

                else {
                    this.x = Math.cos(this.angle) * 500 + canvas.width/2;
                    this.y = Math.sin(this.angle) * 333 + canvas.height/2;
                }
            }

            
            //this else if full of things that could potentially getcha stuck in a wall, so there's some code at the bottom to fix that.
            else {

                //if we're inside of the map, let's see if we're in imminent danger. If we are, let's try to dodge
                if(this.bulletToAvoid){//not part of the identical if above because this.bulletToAvoid should be given a chance to change by the time this happens
                    this.dodge();
                }

                //So if we're not in imminent danger, and we're inside of the map,
                // let's see if there is anything we need to get through to attack the player.
                else if(this.path === "blocked"){//LET'S GET EM!
                    this.makePath();
                }

                //if there's nothing in our way, let's follow our path.
                else {
                    this.defaultMovement();
                }

                //if we run into something while we're on the map, let's un-run into something.
                //this could be in a function, but I don't really think it needs to be overwritten.
                buildingHit = grabStructureAt(this.x, this.y);
                currentMapNode = (obstacleMap.nodes[makeTileCoord(this.y - AIAccuracy/2)]) ? obstacleMap.nodes[makeTileCoord(this.y - AIAccuracy/2)][makeTileCoord(this.x - AIAccuracy/2)] : null;
                if(this.path !== "blocked" && (buildingHit || (currentMapNode && !currentMapNode.walkable) || this.isOutOfBounds())){
                    this.x = startX;
                    this.y = startY;
                    this.angle = Math.atan2(this.path[0][1] + AIAccuracy/2 - this.y, this.path[0][0] + AIAccuracy/2 - this.x);
                    this.x += (Math.cos(this.angle) * this.speed);
                    this.y += (Math.sin(this.angle) * this.speed);
                }
            }
        }


        this.extraUpdate();


        //death checking
        bullets.forEach(function(projectile){
            let tolerance = Math.max(this.size - projectile.size, 10);
            if(this.alive && projectile.alive && ((projectile.x > this.x - tolerance) && (projectile.x < this.x + tolerance)) && ((projectile.y > this.y - tolerance) && (projectile.y < this.y + tolerance))){
                
                this.explode(projectile.rotation);
                this.explode(projectile.rotation, ["red", "chartreuse", "purple"][Math.floor(Math.random() * 3)]);
                //        yeah, according to CSS             ^^that                is a color...
                //and according to wikipedia, it's a french liqueur...
                //life's weird.

                projectile.alive = false;
                this.alive = false;

                this.deathHandler();
            }
        }.bind(this));

        //drawing
        drawRotatedSandwich(this.x, this.y, this.size, this.size, this.angle + Math.PI);
    };
}



function structure(){
    //by default the structure is a brown post
    this.color = "saddlebrown";
    this.rotation = 0;
    this.health = 100;

    this.maxHealth = 100;
    this.health = this.maxHealth;
    this.alive = true;

    this.width  = 0;
    this.height = 0;

    this.die = function(){
        if(this.children){
            buildings.forEach(building => {
                if(building.posts.indexOf(this) !== -1){
                    building.walls.forEach((wall) => {
                        if((wall.firstParentX === this.x && wall.firstParentY === this.y) || (wall.secondParentX === this.x && wall.secondParentY === this.y))
                            wall.die();
                    });
                }
            });
        }

        obstacleMap.nodes.forEach(column => {
            column.forEach(tile => {
                if(tile.parents){
                    if(tile.parents.indexOf(this) !== -1){
                        tile.parents.splice(tile.parents.indexOf(this), 1);

                        if(tile.parents.length === 0)
                            tile.walkable = true;
                    }
                }
            });
        });

        this.alive = false;
    }


    this.damage = function(amount){
    	this.health -= amount;

    	if(this.health <= 0){
            this.die();
    	}
    }

    this.isInside = function(x, y){
        if(!this.x || !this.y)return false;

        let cos = Math.cos(TAU - this.rotation);
        let sin = Math.sin(TAU - this.rotation);

        let newX = (cos * (x - this.x) - sin * (y - this.y) + this.x);
        let newY = (sin * (x - this.x) + cos * (y - this.y) + this.y);

        if(
            (newX > this.x - this.width/2 && newX < this.x + this.width/2) && 
            (newY > this.y - this.height/2 && newY < this.y + this.height/2)
        )
            return this;

        else
            return false;
    }

    this.update = function(){
        ctx.fillStyle = this.color;

        if(this.x !== undefined && this.y !== undefined){
        	ctx.globalAlpha = this.health/this.maxHealth;
            drawRotatedRectangle(this.x, this.y, this.width, this.height, this.rotation);
            ctx.globalAlpha = 1;
        }
    }
}

function building(){
    this.posts = [];
    this.walls = [];

    this.centerRotations = function(){
        let numberOfPosts = 0;
        let coordsAddedUpX = 0;
        let coordsAddedUpY = 0;

        this.posts.forEach(post => {
            numberOfPosts++;
            coordsAddedUpX += post.x;
            coordsAddedUpY += post.y;
        });

        let averageX = coordsAddedUpX/numberOfPosts;
        let averageY = coordsAddedUpY/numberOfPosts;

        this.posts.forEach(post => {
            post.rotation = Math.atan2(averageY - post.y, averageX - post.x);
        });
    }

    this.grabStructureAt = function(x, y){
        let structureSets = [this.posts, this.walls];
        for(let structureSetIterator = 0; structureSetIterator < structureSets.length; structureSetIterator++){
            let structureSet = structureSets[structureSetIterator];
            for(let structureIndex = 0; structureIndex < structureSet.length; structureIndex++){
                if(structureSet[structureIndex].isInside(x, y))return structureSet[structureIndex];
            }
        }
    }

    this.isInside = function(x, y){
        let structureSets = [this.posts, this.walls];
        //return structureSets.some(structureSet => structureSet.some(structure => structure.isInside(x, y)));

        for(let structureSetIndex in structureSets)
        {
            let structureSet = structureSets[structureSetIndex];
            
            for(let structureIndex in structureSet)
            {
                let structure = structureSet[structureIndex];

                if(structure.isInside(x, y))
                    return structure;
            }
        }
        
        return false;
    }

    this.mergeWith = function(otherBuilding){
        this.posts = this.posts.concat(otherBuilding.posts);
        this.walls = this.walls.concat(otherBuilding.walls);

        buildings.splice(buildings.indexOf(otherBuilding), 1);
    };

    this.checkForDeaths = function(){
    	let hasStuffDied = false;

    	this.walls.forEach((wall, wallIndex) => {
    		if(!wall.alive){
    			hasStuffDied = true;
    			this.walls.splice(wallIndex, 1);
    		}
    	});
    	this.posts.forEach((post, postIndex) => {
    		if(!post.alive){
    			hasStuffDied = true;
    			this.posts.splice(postIndex, 1);
    		}
    	});

    	return hasStuffDied;
    }

    this.wallsUpdate = function(){
        this.walls.forEach(wall => {
            wall.update();
        });
    }

    this.postsUpdate = function(){
        this.posts.forEach(post => {
            post.update();
        });
    }
}



function drawRotatedRectangle(x, y, width, height, rotation){
    ctx.save();
    
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    ctx.fillRect(width/2 * (-1), height/2 * (-1), width, height);
    
    ctx.restore();
}


function drawRotatedSandwich(x, y, width, height, rotation){
    ctx.save();
    
    ctx.translate(x, y);
    ctx.rotate(rotation);
    
    ctx.drawImage(sandwichImage, width/2 * (-1), height/2 * (-1), width, height);
    
    ctx.restore();
}


function drawCenteredText(text, y){
    let width = ctx.measureText(text).width;
    
    ctx.fillText(text, canvas.width/2 - width/2 + cameraX, y + cameraY);
}




function menuLoadHTML(){
    localStorage.setItem("coins", coins);
    localStorage.setItem("upgrades", JSON.stringify(upgrades));


    let menuDiv = $("#menu");

    menuDiv.append("<h1>menu</h1>");
    menuDiv.append("<hr>");

    ['building', 'gun tweaks', 'tutorial'].forEach(option => {
        menuDiv.append("<div class = submenuOption id = " + option.camelize() + " > " + option + " </div>");
    });


    $(".submenuOption").on("mousedown touchstart", event => {
        localStorage.setItem("menuOpen", event.target.id);

        menuDiv.empty();
        menuDiv.append("<div class = submenuOption id = backButton> back </div>");

        $("#backButton").on("mousedown touchstart", event => {
            localStorage.setItem("menuOpen", undefined);
            menuDiv.empty();
            menuLoadHTML();
            return false;
        });
        return false;
    });


    $("#gunTweaks").on("mousedown touchstart", event => {

        menuDiv.append("<h1>gun tweaks</h1>");
        menuDiv.append("<hr>");

        let counter = 0;
        for(let upgradeName in upgrades){
            let upgrade = upgrades[upgradeName];

            if(!upgrade.value)continue;

            counter++;

            menuDiv.append("<h3 class = upgradeName>" + upgradeName + ":</h3>");
            menuDiv.append("<div class = upgradePurchase id = upgradePurchase" + counter + "> improve </div>");

            $("#upgradePurchase" + counter).mousedown(function(event){
                if(coins - upgrade.cost >= 0 && (upgrade.level < upgrade.maxLevel || upgrade.allowMorePurchases)){

                    coins = coins - upgrade.cost;

                    upgrade.level++;
                    upgrade.onPurchase();

                    menuDiv.empty();
                    menuLoadHTML();
                }

                return false;
            }.bind(this));

            menuDiv.append("<h4 class = infoLeft>improvement level:</h4>");
            if(upgrade.maxLevel !== Infinity && upgrade.maxLevel !== null)menuDiv.append("<h4 class = infoRight>" + upgrade.level + "/" + upgrade.maxLevel + "</h4>");
            else {
                upgrade.maxLevel = Infinity;
                menuDiv.append("<h4 class = infoRight>" + upgrade.level + "</h4>");
            }

            menuDiv.append("<h4 class = infoLeft>cost:</h4>");
            menuDiv.append("<h4 class = infoRight>" + upgrade.cost + "</h4>");
        }
    });


    menuDiv.append("<div id = clearSave> clear save </div>");
    $("#clearSave").on("mousedown touchstart", event => {
        event.preventDefault();
        event.stopPropagation();
        if(confirm("Are you sure that you want to clear all save data?")){
            localStorage.clear();
            window.location.reload();
        }
    });


    $("#building").on("mousedown touchstart", function(){
        menuDiv.append("<h1>building</h1>");
        menuDiv.append("<hr>");

        for(let buildableName in buildables){
            let buildable = buildables[buildableName];
            if(buildable.cost !== undefined && buildable.timesPurchased !== undefined){
                menuDiv.append("<h3 class = upgradeName>" + buildableName + ":</h3>");
                menuDiv.append("<div class = upgradePurchase id = upgradePurchase" + buildableName + "> select </div>");
                menuDiv.append("<h4 class = infoLeft>times purchased:</h4>");
                menuDiv.append("<h4 class = infoRight>" + buildable.timesPurchased + "</h4>");
                menuDiv.append("<h4 class = infoLeft>cost:</h4>");
                menuDiv.append("<h4 class = infoRight>" + buildable.cost + "</h4>");

                $("#upgradePurchase" + buildableName).on("mousedown touchstart", () => {
                    if(gameState === "building"){
                        buildable.onPurchase(function(){//this function is called when the building is complete
                            obstacleMap = getObstacleMap();
                            gameState = "building";
                            isPlacing = null;
                        });
                        gameState = "placing";
                        isPlacing = buildableName;
                    }
                    return false;
                });
            }
        }
    });

    $("#tutorial").on("mousedown touchstart", function(){
        menuDiv.append("<h1>options</h1>");
        menuDiv.append("<hr>");	

        [
        	"Hello, and thanks for trying out Sandwich Sandbox. This game is about using both your brains and your hands to defend yourself from an onslaught of sandwiches. Use walls and your gun to obliterate the sandwiches before they annihilate you.",
        	"REMEMBER: when you're done using a building tool, press escape to stop using it. In order to place a defensive wall, one must first place two posts to support the wall. One may pan about by pressing shift and then dragging.",
        	"I hope you enjoy my little game. The sandwiches aren't exactly the smartest, but then again... they are sandwiches. This game is composed of almost 1800 lines of JavaScript.",
        	"Made by Cedric Hutchings"
        ].forEach(paragraph => {
        	menuDiv.append("<p>" + paragraph + "</p>");
        });
    });


    let menuOpenedBefore = localStorage.getItem("menuOpen");
    if(menuOpenedBefore){
        $("#" + menuOpenedBefore).mousedown();
    }
}

function menuLoad(){
    let menuDiv = $("#menu");
    let battleButtonHTML = $("#battleButton");

    if(!menuDiv.length){
        $("body").append("<div id = menu></div>");
        menuDiv = $("#menu");//go fetch menu again now that it exists.
    }
    if(!battleButtonHTML.length){
        $("body").append("<div id = battleButton> <h2>Battle</h2></div>");

        battleButtonHTML = $("#battleButton");
        battleButtonHTML.on("click mousedown mouseup mousemove touchstart touchend touchmove", function(event){
            event.preventDefault();
        });
    }

    menuDiv.width(menuDiv.width() + Math.ceil(0.4*downTime));

    let nextBattleLeft = battleButtonHTML.position().left + Math.ceil(0.8*downTime);
    battleButtonHTML.css("left", (nextBattleLeft > 40) ? 40 : nextBattleLeft + "px");

    if(menuDiv.width() >= 250){//the one in the if statement has to be the longest animation
        menu = menuUpdate;

        menuDiv.width(250);

        menuLoadHTML();

        battleButtonHTML.css("left", "40px");
        battleButtonHTML.on("mousedown touchstart", event => {
        	if(gameState === "building"){
	            $("#menu").empty();
	            menu = menuUnload;
	            return false;
        	}
        });
    }
}

function menuUpdate(){
}

function menuUnload(){
    let menuDiv = $("#menu");
    let battleButtonHTML = $("#battleButton");

    for(let i = 0; i < downTime; i++)
        particles.splice(0, 1);

    menuDiv.width(menuDiv.width() - Math.ceil(0.4*downTime));
    if(battleButtonHTML.position().left >= -150)battleButtonHTML.css("left", battleButtonHTML.position().left - downTime + "px");
    if(menuDiv.width() <= 0){//the one in the if statement has to be the longest animation

        battleButtonHTML.css("left", "-150px");//ensuring that the other animations took place
        particles = [];                        //ensuring that the other animations took place

        menuDiv.remove();

        score = 0;
        gameState = "fighting";
        battleFormation = undefined;
    }
}



function gameStart(){

    if(gameState === "paused"){
        /*
        ctx.fillStyle = "rgba(155, 155, 155, 0.7)";
        ctx.fillRect(cameraX, cameraY, canvas.width, canvas.height);
        
        ctx.fillStyle = "black";
        
        ctx.font = "35px Inconsolata";
        drawCenteredText("Press Space to Continue", canvas.height - 200);
        
        ctx.font = "100px Inconsolata";
        drawCenteredText("Game Paused", 250);
        */

        renderObstacleMap(obstacleMap);

        ctx.fillStyle = "green";
        if(enemies[0] && Array.isArray(enemies[0].path))enemies[0].path.forEach(step => {
            ctx.fillRect(step[0], step[1], AIAccuracy, AIAccuracy);
        });

        ctx.fillStyle = "red";
        enemies.forEach(enemy => {
            ctx.fillRect(enemy.x, enemy.y, 1, 1);
        });

        return;
    }


    requestAnimationFrame(gameStart);

    //time math
    downTime = Date.now() - lastFrameTime;
    lastFrameTime = Date.now();
    //end of time math


    ctx.fillStyle = "snow";
    ctx.fillRect(cameraX, cameraY, canvas.width, canvas.height);
    
        
    particleLogic();

    bulletLogic();

    enemyLogic();

    playerLogic();

    buildingLogic();

    hudLogic();

    let gameStateFirstFour = gameState.substring(0, 4);
    if(gameStateFirstFour === "dead" || gameStateFirstFour === "won_"){
        let deathCounter = gameState.substring(4, gameState.length) - downTime/2;
        
        if(deathCounter < 1){
            gameState = "building";

            bullets = [];

            loadBuildings();

            menu = menuLoad;
        }
        else gameState = gameStateFirstFour + deathCounter;
        
        ctx.fillStyle = (gameStateFirstFour === "dead" ? "rgba(255, 0, 0, " : "rgba(0, 255, 0, ") + deathCounter/1200 + ")";
        ctx.fillRect(cameraX, cameraY, canvas.width, canvas.height);
    }

    else if(gameState === "building"){
        menu();
    }
}


function bulletLogic(){
    //Bullet logic
    bullets.forEach(function(projectile, index){
        if(!projectile.heatingBarrel && !projectile.alive)bullets.splice(index, 1);
    });

    if(mouseDown && gunActive){
        var goodToGo = true;
        
        bullets.forEach(function(projectile){
            //if(projectile.inBarrel){
                //projectile.rotation = angleToMouse;
                //so the bullet doesn't come out of the side of the gun
            //}
            if(projectile.heatingBarrel)
                goodToGo = false;
        }.bind(this));
        
        if(goodToGo){
            for(let iterator = upgrades["shots fired"].value; iterator > 0; iterator--){
                let rotation = angleToMouse + (Math.random() * upgrades["accuracy"].value) - (upgrades["accuracy"].value/2);
                bullets.push(new bullet(rotation));
            }
        }
    }
    
    bullets.forEach(function(projectile){
        projectile.update();
    });
    //End of bullet logic
}



function buildingLogic(){
    buildings.forEach((building, index) => {
        if(building.health < 1)
            buildings.splice(index, 1);
    });

    let hasStuffDied = false;
    let hasStuffInThisBuildingDied;
    buildings.forEach((building) => {
    	hasStuffInThisBuildingDied = building.checkForDeaths();
    	hasStuffDied = (hasStuffDied) ? hasStuffDied : hasStuffInThisBuildingDied;
    });
    if(hasStuffDied){
        enemies.forEach(enemy => {
            enemy.shouldUpdatePath = true;
        });
    }

    buildings.forEach((building) => {
        building.wallsUpdate();
    });
    buildings.forEach((building) => {
        building.postsUpdate();
    });
}



function playerLogic(){
    //gun code
    ctx.fillStyle = "black";
    drawRotatedRectangle(canvas.width/2, canvas.height/2, 80, 40, angleToMouse);
    
    //kill him if any enemy is too close.t
    if(
        enemies.some(function(enemy){
            return isWithin(enemy.x, canvas.width/2, 25) && isWithin(enemy.y, canvas.height/2, 25);
        })
    ){
        gameState = "dead1000";//number is for death animation

        battleFormation.clear();
        battleFormation = undefined;

        enemies = [];
    }
    //end of gun code
}



function particleLogic(){
    //particle code
    while(particles.length > 50)
        particles.splice(0, 1);
    particles.forEach((particle, index) => {
        if(!particle.alive)particles.splice(index, 1);
    });
    particles.forEach(function(particle){
        particle.update();
    });
    //end of particle code
}



function enemyLogic(){
    //enemy logic 
    enemies.forEach(function(attacker, index){
        if(!attacker.alive){
            enemies.splice(index, 1);
        }
    });
    enemies.forEach(function(enemy){
        enemy.update();
    });
    if(gameState === "fighting"){
        if(battleFormation && battleFormation.loop)
            battleFormation.loop();

        else {
            battleFormation = battleFormations[Object.keys(battleFormations)[Math.floor(Math.random()*Object.keys(battleFormations).length)]];
            battleFormation.init();
        }
    }
    //end of enemy logic

    //BATTLE FORMATIONS:
    /*
    trojandwich: one giant sandwich, creates ton of smaller sandwiches when broken

    sandwich king: one giant sandwich comes on screen and constantly summons smaller sandwiches.
        The sandwiches that he summons revolve around him. In order to defeat this battle formation, you must shoot the king,
        who dies in one hit.

    sandwichmancer: revives dead sandwiches. <- elaborate?

    deceptive: one tiny sandwich, who splits into two bigger sandwiches when killed, who break into bigger sandwiches... you get the picture.
    */

}



function hudLogic(){
    //HUD code
    ctx.fillStyle = "black";

    ctx.font = "20px Inconsolata";
    ctx.fillText("Score: " + score, 15 + cameraX, 30 + cameraY);
    if(gameState !== "fighting"){
        ctx.fillText("Coins: " + coins, 15 + cameraX, 60 + cameraY);
    }
    //ctx.fillText("State: " + gameState, 15 + cameraX, 90 + cameraY);

    let currentY = 0;
    messages.forEach(function(message, index){
        ctx.font = message.size + "px Inconsolata";
        ctx.fillStyle = "rgba(0, 0, 0, " + message.time/message.startTime + ")";

        drawCenteredText(message.message, currentY+=message.size);
        message.time -= downTime;

        if(message.time <= 0){
            messages.splice(index, 1);
        }
    });
    //end of HUD code
}