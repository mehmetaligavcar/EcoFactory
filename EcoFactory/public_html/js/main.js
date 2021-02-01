/* 
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
import * as THREE from './three.module.js';
import { GLTFLoader } from './GLTFLoader.js';
import { PointerLockControls } from './PointerLockControls.js';

var mesh;
var leftDoor = [];
var rightDoor = [];
var intersections;
let objects = [];
let pickableObjects = [];
let carryingObject;
let fallingObjects = [];
let hitableObjects = [];
let raycaster;
var onObject;
var carrying = false;
var carryingLight = false;
var lampOn = false;
var flashLightOn = false;

var newDir = new THREE.Vector3();
var pos = new THREE.Vector3();

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let tilting = false;
let running = false;
let leftDoorOpened = false;
let leftDoorMoving = false;
let rightDoorOpened = false;
let rightDoorMoving = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
const vertex = new THREE.Vector3();
const color = new THREE.Color();

const delay = ms => new Promise(res => setTimeout(res, ms));

async function main()
{
    const canvas = document.querySelector('#c');
    
    const renderer = new THREE.WebGLRenderer({canvas});
    renderer.antialias = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    const clock = new THREE.Clock();

    const fov = 75;
    const aspect = 2;  // the canvas default
    const near = 0.1;
    const far = 300;
    
    const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    const controls = new PointerLockControls(camera, document.body);
    //camera.position.set(10,0,60);
    camera.position.set(-50,0,80);
    
    const scene = new THREE.Scene();
    
    scene.background = new THREE.Color(0x85C1E9);
    
    const listener = new THREE.AudioListener();
    camera.add( listener );
    
    const sunLight = new THREE.PointLight(0xFFFFFF, 12, 200, 2);
    sunLight.position.set(-120, 40, 70);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    scene.add(sunLight);
    
    const bulbLight = new THREE.PointLight(0xCAAE24, 0);
    bulbLight.position.set(-30, 17, 2);
    bulbLight.castShadow = true;
    scene.add(bulbLight);
    
    var loader = new GLTFLoader();
    
    loader.load('./models/factory.gltf',function(gltf){handleLoad(gltf,0,-4,0);});
    loader.load('./models/plane.gltf',function(gltf){handleLoad(gltf,0,-4,0);});
    loader.load('./models/leftDoor.gltf',function(gltf){handleLoadWithList(gltf,0,-4,0,leftDoor);});
    loader.load('./models/rightDoor.gltf',function(gltf){handleLoadWithList(gltf,0,-4,0,rightDoor);});
    await delay(3000);
    
    var flashLight = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 1),new THREE.MeshStandardMaterial());
    flashLight.material.color = new THREE.Color(0.2, 0.2, 0.2);
    flashLight.position.set(-30,-3.5,0);
    flashLight.castShadow = true;
    flashLight.receiveShadow  = true;
    pickableObjects.push(flashLight);
    scene.add(flashLight);
    
    var crosshair = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01),new THREE.MeshBasicMaterial());
    crosshair.material.color = new THREE.Color(1, 0, 0);
    crosshair.position.set(0,0,0);
    scene.add(crosshair);
    
    var ball = new THREE.Mesh(new THREE.SphereGeometry(0.5, 64, 64),new THREE.MeshStandardMaterial());
    ball.material.color = new THREE.Color(0, 0, 1);
    ball.position.set(-30,-3,50);
    ball.castShadow = true;
    ball.receiveShadow = true;
    pickableObjects.push(ball);
    scene.add(ball);
    
    const spotLight = new THREE.SpotLight(0xFFFFFF);
    spotLight.angle = Math.PI/6;
    spotLight.position.set(flashLight.position.x, flashLight.position.y, flashLight.position.z);
    spotLight.target.position.set(flashLight.position.x, flashLight.position.y, flashLight.position.z);
    spotLight.intensity = 0;
    spotLight.castShadow = true;
    scene.add(spotLight);
    scene.add(spotLight.target);
    
    const blocker = document.getElementById( 'blocker' );
    const instructions = document.getElementById( 'instructions' );
    
    instructions.addEventListener( 'click', function () 
    {
        controls.lock();
    }, false );
    controls.addEventListener( 'lock', function () 
    {
        instructions.style.display = 'none';
	blocker.style.display = 'none';
    } );
    controls.addEventListener( 'unlock', function () {
        blocker.style.display = 'block';
	instructions.style.display = '';
    } );
    scene.add( controls.getObject() );
    
    const onKeyDown = function ( event ) {
        switch ( event.keyCode ) 
        {
            case 38: // up
            case 87: // w
                moveForward = true;
                break;
            case 37: // left
            case 65: // a
		moveLeft = true;
		break;

            case 40: // down
            case 83: // s
		moveBackward = true;
		break;

            case 39: // right
            case 68: // d
		moveRight = true;
		break;

            case 32: // space
		if ( canJump === true ) velocity.y += 20;
                    canJump = false;
                    break;
        }
    };

    const onKeyUp = function ( event ) {
        switch ( event.keyCode ) 
        {
            case 38: // up
            case 87: // w
		moveForward = false;
		break;
            case 37: // left
            case 65: // a
		moveLeft = false;
		break;
            case 40: // down
            case 83: // s
		moveBackward = false;
		break;
            case 39: // right
            case 68: // d
		moveRight = false;
		break;
        }
    };

    document.addEventListener( 'keydown', onKeyDown, false );
    document.addEventListener( 'keyup', onKeyUp, false );
    
    raycaster = new THREE.Raycaster();
    
    render();
    
    function render()
    {
        console.log(camera.position);
        const time = performance.now();
        const delta = ( time - prevTime ) / 1000;
        spotLight.position.set(flashLight.position.x, flashLight.position.y, flashLight.position.z);
        
        var cameraPosition = new THREE.Vector3();
        var cameraDirection = new THREE.Vector3();
        camera.getWorldPosition(cameraPosition);
        camera.getWorldDirection(cameraDirection);
        
        crosshair.position.set(cameraPosition.x+cameraDirection.x,cameraPosition.y+cameraDirection.y,cameraPosition.z+cameraDirection.z);
        
        pos.addVectors(newDir, crosshair.position);
        crosshair.lookAt(pos);
        
        if ( controls.isLocked === true ) 
        {
            var cameraPosition = new THREE.Vector3();
            var cameraDirection = new THREE.Vector3();
            camera.getWorldPosition(cameraPosition);
            camera.getWorldDirection(cameraDirection);
            raycaster.set(cameraPosition, cameraDirection);
            
            intersections = raycaster.intersectObjects( pickableObjects );

            onObject = intersections.length > 0;
            
            if(running)
            {
                velocity.x -= velocity.x * 5.0 * delta;
                velocity.z -= velocity.z * 5.0 * delta;
            }
            else
            {
                velocity.x -= velocity.x * 10.0 * delta;
                velocity.z -= velocity.z * 10.0 * delta;
            }

            velocity.y -= 9.8 * 10.0 * delta; // 10.0 = mass

            direction.z = Number( moveForward ) - Number( moveBackward );
            direction.x = Number( moveRight ) - Number( moveLeft );
            direction.normalize(); // this ensures consistent movements in all directions

            if ( moveForward || moveBackward ) velocity.z -= direction.z * 100.0 * delta;
            if ( moveLeft || moveRight ) velocity.x -= direction.x * 100.0 * delta;
            
            controls.moveRight( - velocity.x * delta );
            controls.moveForward( - velocity.z * delta );
            controls.getObject().position.y += ( velocity.y * delta ); // new behavior
            if ( controls.getObject().position.y < 0.2 ) 
            {
                velocity.y = 0;
		controls.getObject().position.y = 0.2;
                canJump = true;
            }
        }
        for(var i=0; i<pickableObjects.length; i++)
        {
            if(pickableObjects[i].position.x > -45 && pickableObjects[i].position.x < -41 && pickableObjects[i].position.z < 2.5 && pickableObjects[i].position.z > -22)
            {
                for(var j=0; j<fallingObjects.length; j++)
                {
                    if(pickableObjects[i] === fallingObjects[j][0])
                    {
                        fallingObjects.splice(j,1);
                        newDir = new THREE.Vector3(0, 0, -1);
                        pos.addVectors(newDir, pickableObjects[i].position);
                        pickableObjects[i].lookAt(pos);
                        pickableObjects[i].rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), Math.PI/2);
                    }
                }
                pickableObjects[i].position.y = 0.2;
                pickableObjects[i].position.z -= 5 * delta;
            }
            else if(pickableObjects[i].position.x > -45 && pickableObjects[i].position.x < -15.5 && pickableObjects[i].position.z <= -22 && pickableObjects[i].position.z > -24)
            {
                for(var j=0; j<fallingObjects.length; j++)
                {
                    if(pickableObjects[i] === fallingObjects[j][0])
                    {
                        fallingObjects.splice(j,1);
                        newDir = new THREE.Vector3(1, 0, 0);
                        pos.addVectors(newDir, pickableObjects[i].position);
                        pickableObjects[i].lookAt(pos);
                        pickableObjects[i].rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), Math.PI/2);
                    }
                }
                pickableObjects[i].position.y = 0.2;
                pickableObjects[i].position.x += 5 * delta;
            }
            else if(pickableObjects[i].position.x >= -15.5 && pickableObjects[i].position.x < -14 && pickableObjects[i].position.z <= -13 && pickableObjects[i].position.z > -24)
            {
                for(var j=0; j<fallingObjects.length; j++)
                {
                    if(pickableObjects[i] === fallingObjects[j][0])
                    {
                        fallingObjects.splice(j,1);
                        newDir = new THREE.Vector3(0, 0, 1);
                        pos.addVectors(newDir, pickableObjects[i].position);
                        pickableObjects[i].lookAt(pos);
                        pickableObjects[i].rotateOnWorldAxis(new THREE.Vector3(0, 0, -1), Math.PI/2);
                    }
                }
                pickableObjects[i].position.y = 0.2;
                pickableObjects[i].position.z += 5 * delta;
            }
            else if(pickableObjects[i].position.x >= -15.5 && pickableObjects[i].position.x < -14 && pickableObjects[i].position.z < -11 && pickableObjects[i].position.z > -13 && pickableObjects[i].position.y === 0.2)
            {
                fallingObjects.push([pickableObjects[i], new THREE.Vector3(0, 0, 0)]);
            }
            else if(pickableObjects[i].position.x >= -15.5 && pickableObjects[i].position.x < -14 && pickableObjects[i].position.z < -11 && pickableObjects[i].position.z > -13 && pickableObjects[i].position.y <= -3.2)
            {
                scene.remove(pickableObjects[i]);
                pickableObjects.splice(i,1);
            }
        }
        if(carrying)
        {
            if(carryingObject === flashLight)
            {
                newDir = new THREE.Vector3(cameraDirection.x, cameraDirection.y, cameraDirection.z);
                var flashLightVector = new THREE.Vector3();
                flashLightVector = cameraDirection;
                flashLightVector.applyAxisAngle(new THREE.Vector3( 0.0, -1.0, 0.0 ),2*Math.PI / 3);
                flashLight.position.set(flashLightVector.x+cameraPosition.x+newDir.x,flashLightVector.y+cameraPosition.y+newDir.y,flashLightVector.z+cameraPosition.z+newDir.z);
                spotLight.position.set(flashLight.position.x+(newDir.x*0.2),flashLight.position.y+(newDir.y*0.2),flashLight.position.z+(newDir.z*0.2));
                spotLight.target.position.set(flashLight.position.x+(newDir.x*5),flashLight.position.y+(newDir.y*5),flashLight.position.z+(newDir.z*5));
                pos.addVectors(newDir, flashLight.position);
                flashLight.lookAt(pos);
            }
            else
            {
                newDir = new THREE.Vector3(cameraDirection.x, cameraDirection.y, cameraDirection.z);
                var objectVector = new THREE.Vector3();
                objectVector = cameraDirection;
                objectVector.applyAxisAngle(new THREE.Vector3( 0.0, -1.0, 0.0 ),2*Math.PI / 3);
                carryingObject.position.set(objectVector.x+cameraPosition.x+newDir.x,objectVector.y+cameraPosition.y+newDir.y,objectVector.z+cameraPosition.z+newDir.z);
                pos.addVectors(newDir, carryingObject.position);
                carryingObject.lookAt(pos);
            }
        }
        if(flashLightOn)
        {
            spotLight.position.set(flashLight.position.x+(newDir.x*0.2),flashLight.position.y+(newDir.y*0.2),flashLight.position.z+(newDir.z*0.2));
            spotLight.target.position.set(flashLight.position.x+(newDir.x*5),flashLight.position.y+(newDir.y*5),flashLight.position.z+(newDir.z*5));
        }
        if(fallingObjects.length > 0)
        {
            for(var i=0; i<fallingObjects.length; i++)
            {
                fallingObjects[i][0].position.y += ( fallingObjects[i][1].y * delta );
                fallingObjects[i][1].y -= 9.8 * 2 * delta;
                if(fallingObjects[i][0].position.y < -3.2)
                {
                    fallingObjects[i][0].position.y = -3.2;
                    fallingObjects.splice(i,1);
                }
            }
        }
        if(leftDoorMoving)
        {
            if(!leftDoorOpened)
            {
                for(var i=0; i<leftDoor.length; i++)
                {
                    if(leftDoor[i].position.x > -8)
                        leftDoor[i].position.x -= 4 * delta;
                    else
                    {
                        leftDoor[i].position.x = -8;
                        leftDoorMoving = false;
                        leftDoorOpened = true;
                    }
                } 
            }
            else
            {
                for(var i=0; i<leftDoor.length; i++)
                {
                    if(leftDoor[i].position.x < 0)
                        leftDoor[i].position.x += 4 * delta;
                    else
                    {
                        leftDoor[i].position.x = 0;
                        leftDoorMoving = false;
                        leftDoorOpened = false;
                    }
                }
            }
        }
        if(rightDoorMoving)
        {
            if(!rightDoorOpened)
            {
                for(var i=0; i<rightDoor.length; i++)
                {
                    if(rightDoor[i].position.x > -16)
                        rightDoor[i].position.x -= 6 * delta;
                    else
                    {
                        rightDoor[i].position.x = -16;
                        rightDoorMoving = false;
                        rightDoorOpened = true;
                    }
                } 
            }
            else
            {
                for(var i=0; i<leftDoor.length; i++)
                {
                    if(rightDoor[i].position.x < 0)
                        rightDoor[i].position.x += 6 * delta;
                    else
                    {
                        rightDoor[i].position.x = 0;
                        rightDoorMoving = false;
                        rightDoorOpened = false;
                    }
                }
            }
        }
        window.onkeydown = function(event)
        {
            if(event.keyCode === 89)  //y
            { 
                bubbleSort(-16,0,18,0.8);
            }
            else if(event.keyCode === 70) //f
            {
                if(!carrying && onObject)
                {
                    if(intersections[0].distance < 6)
                    {
                        carryingObject = intersections[0].object;
                        carrying = true;
                        if(carryingObject === flashLight)
                            carryingLight = true;
                    }    
                } 
                else if(carrying)
                {
                    carrying = false;
                    carryingLight = false;
                    fallingObjects.push([carryingObject, new THREE.Vector3(0, 0, 0)]);
                    carryingObject = null;
                }  
            }
            else if(event.keyCode === 84) //t
            {
                if(lampOn)
                {
                    bulbLight.intensity = 0;
                    lampOn = false;
                }
                else
                {
                    bulbLight.intensity = 1;
                    lampOn = true;
                }
            }
            else if(event.keyCode ===81) // q
            {
                var cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);
                if(!tilting)
                    camera.rotateOnWorldAxis(new THREE.Vector3(-cameraDirection.x, -cameraDirection.y, -cameraDirection.z), Math.PI/12);
                tilting = true;
            }
              
            else if(event.keyCode ===69) // e
            {
                var cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);
                if(!tilting)
                    camera.rotateOnWorldAxis(new THREE.Vector3(cameraDirection.x, cameraDirection.y, cameraDirection.z), Math.PI/12);
                tilting = true;
            }
            else if(event.keyCode === 86) // v
            {
                if(flashLightOn && carryingLight)
                {
                    spotLight.intensity = 0;
                    flashLightOn = false;
                }
                else if (!flashLightOn && carryingLight)
                {
                    spotLight.intensity = 1;
                    flashLightOn = true;
                }
            }
            else if(event.keyCode === 16) //shift
            {
                running = true;
            }
            else if(event.keyCode === 90) // z
            {
                if(!leftDoorMoving)
                    leftDoorMoving = true;
            }
            else if(event.keyCode === 88) // x
            {
                if(!rightDoorMoving)
                    rightDoorMoving = true;
            }
            else if(event.keyCode === 49) // 1
            {
                for(var i=0; i<objects.length; i++)
                {
                    var tempColor;
                    tempColor = objects[i].material.color;
                    objects[i].material = new THREE.MeshStandardMaterial();
                    objects[i].material.color = tempColor;
                }
            }
            else if(event.keyCode === 50) // 2
            {
                for(var i=0; i<objects.length; i++)
                {
                    var tempColor;
                    tempColor = objects[i].material.color;
                    objects[i].material = new THREE.MeshToonMaterial();
                    objects[i].material.color = tempColor;
                }
            }
            else if(event.keyCode === 51) // 3
            {
                for(var i=0; i<objects.length; i++)
                {
                    var tempColor;
                    tempColor = objects[i].material.color;
                    objects[i].material = new THREE.MeshLambertMaterial();
                    objects[i].material.color = tempColor;
                }
            }
            else if(event.keyCode === 52) // 4
            {
                for(var i=0; i<objects.length; i++)
                {
                    var tempColor;
                    tempColor = objects[i].material.color;
                    objects[i].material = new THREE.MeshPhongMaterial();
                    objects[i].material.color = tempColor;
                }
            }
        };
        window.onkeyup = function(event)
        {
            if(event.keyCode ===81) // q
            {
                var cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);
                camera.rotateOnWorldAxis(new THREE.Vector3(cameraDirection.x, cameraDirection.y, cameraDirection.z), Math.PI/12);
                tilting = false;
            }
              
            else if(event.keyCode ===69) // e
            {
                var cameraDirection = new THREE.Vector3();
                camera.getWorldDirection(cameraDirection);
                camera.rotateOnWorldAxis(new THREE.Vector3(-cameraDirection.x, -cameraDirection.y, -cameraDirection.z), Math.PI/12);
                tilting = false;
            }
            else if(event.keyCode === 16) //shift
            {
                running = false;
            }
        };
        
        prevTime = time;
        renderer.render(scene, camera);
        requestAnimationFrame(render);
    }
    function handleLoad(gltf,x,y,z)
    {
        gltf.scene.traverse(function (node){
           if(node.isMesh)
           {
               node.castShadow = true;
               node.receiveShadow = true;
               var tempColor = node.material.color;
               node.material = new THREE.MeshPhongMaterial();
               node.material.color = tempColor;
               objects.push(node);
           }
        });
        mesh = gltf.scene;
        mesh.position.x = x;
        mesh.position.y = y;
        mesh.position.z = z;
        scene.add(mesh);
    }
    function handleLoadWithList(gltf,x,y,z,list)
    {
        gltf.scene.traverse(function (node){
           if(node.isMesh)
           {
               node.castShadow = true;
               node.receiveShadow = true;
               var tempColor = node.material.color;
               node.material = new THREE.MeshPhongMaterial();
               node.material.color = tempColor;
               objects.push(node);
           }
        });
        mesh = gltf.scene;
        mesh.position.x = x;
        mesh.position.y = y;
        mesh.position.z = z;
        list.push(mesh);
        scene.add(mesh);
        console.log("Model Load Finished");
    }
    async function bubbleSort(x,y,z,scale)
    {
        const boxWidth = scale*1;
        var boxHeight;
        const boxDepth = scale*1;
        var geometry;

        const loader = new THREE.TextureLoader();
        var cubes = [];
        for(var i=0; i<9; i++)
        {
            var material = new THREE.MeshStandardMaterial({
                map: loader.load('./textures/cardboard.jpg')
            });
            var cube;
            boxHeight = scale*(Math.random()+0.5)*2;
            geometry = new THREE.BoxGeometry(boxWidth, boxHeight, boxDepth);
            cube = new THREE.Mesh(geometry,material);
            cube.position.set(x, y+(boxHeight/2),(((i*2)-8)*scale)+z);
            cube.name = "cube"+i;
            cube.castShadow = true;
            cube.receiveShadow  = true;
            cubes.push(cube);
            pickableObjects.push(cube);
            scene.add(cube);
        }
        renderer.render(scene, camera);

        var changed = true;

        while(changed)
        {
            changed = false;
            for(var i=0; i<(cubes.length-1); i++)
            {
                if(cubes[i].geometry.parameters.height > cubes[i+1].geometry.parameters.height)
                {
                    swapAnim(i, i+1, 1, cubes[i].position.z);
                    await delay(1000);
                    changed = true;
                }
            }
            if(!changed)
                clearInterval();
        }
        for(var i=0; i<9; i++)
        {
            cubes[i].material.color = new THREE.Color(i/8, 1-(i/8), 0);
            //scene.remove(cubes[i]);
        }
        function swapAnim(i1,i2,step,temp){
            const time = performance.now();
            const delta = ( time - prevTime ) / 1000;
            var finished = false;
            switch(step)
            {
                case 1:
                    goForward(i2, (scale*1.5)+x);
                    break;
                case 2:
                    goRight(i1, cubes[i2].position.z);
                    break;
                case 3:
                    goLeft(i2, temp);
                    break;
                case 4:
                    goBackward(i2, x);
                    break;
                default:
                    finished = true;
            }
            function goForward(i,pos)
            {
                step = 1;
                cubes[i].position.x += scale*delta*60;
                if(cubes[i].position.x >= pos)
                {
                    cubes[i].position.x = pos;
                    step++;
                    return;
                }
            }
            function goBackward(i,pos)
            {
                cubes[i].position.x -= scale*delta*60;
                if(cubes[i].position.x <= pos)
                {
                    cubes[i].position.x = pos;
                    step++;
                    return;
                }
            }
            function goRight(i,pos)
            {
                cubes[i].position.z += scale*delta*60;
                if(cubes[i].position.z >= pos)
                {
                    cubes[i].position.z = pos;
                    step++;
                    return;
                }
            }
            function goLeft(i,pos)
            {
                cubes[i].position.z -= scale*delta*60;
                if(cubes[i].position.z <= pos)
                {
                    cubes[i].position.z = pos;
                    step++;
                    return;
                }
            }
            if(!finished)
            {
                requestAnimationFrame(function() {
                    swapAnim(i1, i2, step, temp);
                });
                return finished;
            }
            else
            {
                var tempCube = cubes[i1];
                cubes[i1] = cubes[i2];
                cubes[i2] = tempCube;
                return finished;
            }
        }
    }
}

main();