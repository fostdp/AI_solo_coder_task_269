const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const G = 500;
const SCALE = 0.8;
const TIME_STEP = 0.016;
const SPEED_OF_LIGHT = 3000;

const Physics = {
    G: 6.67430e-11,
    
    calculateOrbitalVelocity: function(centralMass, radius) {
        return Math.sqrt(this.G * centralMass / radius);
    },
    
    calculateHohmannTransfer: function(centralMass, r1, r2) {
        const v1 = this.calculateOrbitalVelocity(centralMass, r1);
        const v2 = this.calculateOrbitalVelocity(centralMass, r2);
        
        const a = (r1 + r2) / 2;
        
        const v_transfer1 = Math.sqrt(this.G * centralMass * (2 / r1 - 1 / a));
        const v_transfer2 = Math.sqrt(this.G * centralMass * (2 / r2 - 1 / a));
        
        const deltaV1 = v_transfer1 - v1;
        const deltaV2 = v2 - v_transfer2;
        const totalDeltaV = Math.abs(deltaV1) + Math.abs(deltaV2);
        
        const transferTime = Math.PI * Math.sqrt(a * a * a / (this.G * centralMass));
        
        return {
            initialOrbitVelocity: v1,
            finalOrbitVelocity: v2,
            transferVelocity1: v_transfer1,
            transferVelocity2: v_transfer2,
            deltaV1: deltaV1,
            deltaV2: deltaV2,
            totalDeltaV: totalDeltaV,
            semiMajorAxis: a,
            transferTime: transferTime,
            transferTimeDays: transferTime / 86400
        };
    },
    
    calculateGravitySlingShot: function(planetVelocity, approachVelocity, impactParameter, planetRadius) {
        const v_infinity = Math.abs(approachVelocity - planetVelocity);
        
        const b_max = impactParameter || planetRadius * 2;
        const turnAngle = 2 * Math.asin(Math.min(1, planetRadius / b_max));
        
        const finalSpeed = Math.sqrt(planetVelocity * planetVelocity + 
                                     v_infinity * v_infinity + 
                                     2 * planetVelocity * v_infinity * Math.cos(turnAngle));
        
        const velocityGain = finalSpeed - Math.abs(approachVelocity);
        
        return {
            planetVelocity: planetVelocity,
            approachVelocity: approachVelocity,
            vInfinity: v_infinity,
            turnAngle: turnAngle,
            turnAngleDegrees: turnAngle * 180 / Math.PI,
            finalVelocity: finalSpeed,
            velocityGain: velocityGain
        };
    },
    
    calculateEscapeVelocity: function(centralMass, radius) {
        return Math.sqrt(2 * this.G * centralMass / radius);
    },
    
    checkOrbitalParameters: function(centralMass, radius, velocity) {
        const escapeVelocity = this.calculateEscapeVelocity(centralMass, radius);
        const orbitalVelocity = this.calculateOrbitalVelocity(centralMass, radius);
        
        const specificEnergy = (velocity * velocity) / 2 - this.G * centralMass / radius;
        const eccentricity = 1 + (2 * specificEnergy * radius * radius * velocity * velocity) / 
                              (this.G * this.G * centralMass * centralMass);
        
        return {
            escapeVelocity: escapeVelocity,
            orbitalVelocity: orbitalVelocity,
            specificEnergy: specificEnergy,
            eccentricity: Math.sqrt(Math.max(0, eccentricity)),
            isClosedOrbit: velocity < escapeVelocity,
            isCircular: Math.abs(velocity - orbitalVelocity) < orbitalVelocity * 0.01
        };
    },
    
    calculateFuelConsumption: function(initialMass, deltaV, exhaustVelocity) {
        const massRatio = Math.exp(deltaV / exhaustVelocity);
        const propellantMass = initialMass * (1 - 1 / massRatio);
        const finalMass = initialMass - propellantMass;
        
        return {
            initialMass: initialMass,
            finalMass: finalMass,
            propellantMass: propellantMass,
            massRatio: massRatio,
            deltaV: deltaV,
            exhaustVelocity: exhaustVelocity
        };
    },
    
    calculateMissionDeltaV: function(maneuvers) {
        let totalDeltaV = 0;
        maneuvers.forEach(m => {
            totalDeltaV += Math.abs(m.deltaV);
        });
        return totalDeltaV;
    }
};

const celestialBodies = {
    Sun: { mass: 1.989e30, radius: 6.957e8 },
    Earth: { mass: 5.972e24, radius: 6.371e6 },
    Moon: { mass: 7.342e22, radius: 1.737e6 },
    Mars: { mass: 6.39e23, radius: 3.389e6 },
    Jupiter: { mass: 1.898e27, radius: 6.991e7 },
    Saturn: { mass: 5.683e26, radius: 5.823e7 },
    Venus: { mass: 4.867e24, radius: 6.051e6 },
    Mercury: { mass: 3.285e23, radius: 2.439e6 }
};

const planetaryOrbits = {
    Mercury: { radius: 5.79e10, velocity: 4.74e4 },
    Venus: { radius: 1.082e11, velocity: 3.50e4 },
    Earth: { radius: 1.496e11, velocity: 2.978e4 },
    Mars: { radius: 2.279e11, velocity: 2.41e4 },
    Jupiter: { radius: 7.786e11, velocity: 1.31e4 },
    Saturn: { radius: 1.434e12, velocity: 9.64e3 }
};

const planets = [
    { name: '太阳', x: 0, y: 0, mass: 10000, radius: 40, color: '#FFD700', score: 0, samples: 0 },
    { name: '水星', x: 120, y: 0, mass: 5, radius: 6, color: '#B5B5B5', score: 100, vx: 0, vy: -Math.sqrt(G * 10000 / 120), samples: 3, gravity: 3.7 },
    { name: '金星', x: 180, y: 0, mass: 15, radius: 10, color: '#E6C87A', score: 150, vx: 0, vy: -Math.sqrt(G * 10000 / 180), samples: 3, gravity: 8.87 },
    { name: '地球', x: 250, y: 0, mass: 20, radius: 12, color: '#6B93D6', score: 0, vx: 0, vy: -Math.sqrt(G * 10000 / 250), samples: 3, gravity: 9.81 },
    { name: '火星', x: 340, y: 0, mass: 10, radius: 8, color: '#C1440E', score: 200, vx: 0, vy: -Math.sqrt(G * 10000 / 340), samples: 3, gravity: 3.71 },
    { name: '木星', x: 500, y: 0, mass: 300, radius: 28, color: '#D8CA9D', score: 300, vx: 0, vy: -Math.sqrt(G * 10000 / 500), samples: 3, gravity: 24.79 },
    { name: '土星', x: 650, y: 0, mass: 250, radius: 24, color: '#F4D59E', score: 350, vx: 0, vy: -Math.sqrt(G * 10000 / 650), samples: 3, gravity: 10.44 },
    { name: '天王星', x: 800, y: 0, mass: 100, radius: 18, color: '#D1E7E7', score: 400, vx: 0, vy: -Math.sqrt(G * 10000 / 800), samples: 3, gravity: 8.87 },
    { name: '海王星', x: 950, y: 0, mass: 90, radius: 17, color: '#5B5DDF', score: 500, vx: 0, vy: -Math.sqrt(G * 10000 / 950), samples: 3, gravity: 11.15 }
];

const missions = {
    voyager1: {
        name: '旅行者1号',
        targets: ['木星', '土星'],
        requirements: { flybys: ['木星', '土星'], minSpeed: 1500 },
        reward: 2000
    },
    newhorizons: {
        name: '新视野号',
        targets: ['木星', '海王星'],
        requirements: { flybys: ['木星', '海王星'], landings: [] },
        reward: 2500
    },
    cassini: {
        name: '卡西尼号',
        targets: ['金星', '木星', '土星'],
        requirements: { flybys: ['金星', '木星', '土星'], landings: ['土星'] },
        reward: 3000
    },
    perseverance: {
        name: '毅力号',
        targets: ['火星'],
        requirements: { landings: ['火星'], samples: 3 },
        reward: 3500
    }
};

let spacecraft = {
    x: 250,
    y: 0,
    vx: 0,
    vy: -Math.sqrt(G * 10000 / 250) - 5,
    angle: -Math.PI / 2,
    fuel: 100,
    maxFuel: 100,
    thrustPower: 150,
    rotationSpeed: 3,
    radius: 8,
    shipTime: 0,
    earthTime: 0
};

let gameState = {
    score: 0,
    visitedPlanets: new Set(['地球']),
    landedPlanets: new Set(),
    collectedSamples: {},
    paused: false,
    gameOver: false,
    trail: [],
    relativityEnabled: false,
    orbitPredictEnabled: true,
    trailEnabled: true,
    currentMission: null,
    missionProgress: {},
    inMinigame: false,
    nearPlanet: null
};

let keys = {
    w: false,
    s: false,
    a: false,
    d: false
};

let landingState = null;
let sampleState = null;
let missionFlybys = new Set();

const PhysicsEngine = {
    MAX_SUBSTEPS: 20,
    ERROR_TOLERANCE: 0.01,
    
    calculateAcceleration(body, planets) {
        let ax = 0, ay = 0;
        planets.forEach(planet => {
            const dx = planet.x - body.x;
            const dy = planet.y - body.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance < 10) return;
            const force = G * planet.mass / (distance * distance);
            ax += force * dx / distance;
            ay += force * dy / distance;
        });
        return { ax, ay };
    },
    
    rk4Step(body, dt, planets) {
        const { ax: a1x, ay: a1y } = this.calculateAcceleration(body, planets);
        const k1vx = a1x * dt;
        const k1vy = a1y * dt;
        const k1x = body.vx * dt;
        const k1y = body.vy * dt;
        
        const midBody1 = {
            x: body.x + k1x / 2,
            y: body.y + k1y / 2,
            vx: body.vx + k1vx / 2,
            vy: body.vy + k1vy / 2,
            mass: body.mass
        };
        const { ax: a2x, ay: a2y } = this.calculateAcceleration(midBody1, planets);
        const k2vx = a2x * dt;
        const k2vy = a2y * dt;
        const k2x = (body.vx + k1vx / 2) * dt;
        const k2y = (body.vy + k1vy / 2) * dt;
        
        const midBody2 = {
            x: body.x + k2x / 2,
            y: body.y + k2y / 2,
            vx: body.vx + k2vx / 2,
            vy: body.vy + k2vy / 2,
            mass: body.mass
        };
        const { ax: a3x, ay: a3y } = this.calculateAcceleration(midBody2, planets);
        const k3vx = a3x * dt;
        const k3vy = a3y * dt;
        const k3x = (body.vx + k2vx / 2) * dt;
        const k3y = (body.vy + k2vy / 2) * dt;
        
        const endBody = {
            x: body.x + k3x,
            y: body.y + k3y,
            vx: body.vx + k3vx,
            vy: body.vy + k3vy,
            mass: body.mass
        };
        const { ax: a4x, ay: a4y } = this.calculateAcceleration(endBody, planets);
        const k4vx = a4x * dt;
        const k4vy = a4y * dt;
        const k4x = (body.vx + k3vx) * dt;
        const k4y = (body.vy + k3vy) * dt;
        
        return {
            dx: (k1x + 2 * k2x + 2 * k3x + k4x) / 6,
            dy: (k1y + 2 * k2y + 2 * k3y + k4y) / 6,
            dvx: (k1vx + 2 * k2vx + 2 * k3vx + k4vx) / 6,
            dvy: (k1vy + 2 * k2vy + 2 * k3vy + k4vy) / 6
        };
    },
    
    adaptiveStep(body, dt, planets) {
        let minDistance = Infinity;
        planets.forEach(planet => {
            const dx = planet.x - body.x;
            const dy = planet.y - body.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            minDistance = Math.min(minDistance, distance);
        });
        
        let adaptiveDt = dt;
        if (minDistance < 50) {
            adaptiveDt = dt * (minDistance / 50);
        }
        if (minDistance < 20) {
            adaptiveDt = dt * 0.1;
        }
        
        const subSteps = Math.ceil(dt / Math.max(adaptiveDt, dt / this.MAX_SUBSTEPS));
        const actualDt = dt / subSteps;
        
        let totalDx = 0, totalDy = 0, totalDvx = 0, totalDvy = 0;
        
        for (let i = 0; i < subSteps; i++) {
            const currentBody = {
                x: body.x + totalDx,
                y: body.y + totalDy,
                vx: body.vx + totalDvx,
                vy: body.vy + totalDvy,
                mass: body.mass
            };
            const step = this.rk4Step(currentBody, actualDt, planets);
            totalDx += step.dx;
            totalDy += step.dy;
            totalDvx += step.dvx;
            totalDvy += step.dvy;
        }
        
        return { dx: totalDx, dy: totalDy, dvx: totalDvx, dvy: totalDvy };
    }
};

function calculateLorentzFactor(v) {
    const beta = v / SPEED_OF_LIGHT;
    return 1 / Math.sqrt(1 - Math.min(beta * beta, 0.9999));
}

function calculateGravity(body1, body2) {
    const dx = body2.x - body1.x;
    const dy = body2.y - body1.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 10) return { ax: 0, ay: 0 };
    
    const force = G * body1.mass * body2.mass / (distance * distance);
    const ax = force * dx / distance / body1.mass;
    const ay = force * dy / distance / body1.mass;
    
    return { ax, ay };
}

function updatePhysics() {
    if (gameState.paused || gameState.gameOver || gameState.inMinigame) return;
    
    const speed = Math.sqrt(spacecraft.vx * spacecraft.vx + spacecraft.vy * spacecraft.vy);
    const gamma = calculateLorentzFactor(speed);
    
    let effectiveTimeStep = TIME_STEP;
    if (gameState.relativityEnabled) {
        effectiveTimeStep = TIME_STEP / gamma;
        spacecraft.shipTime += TIME_STEP;
        spacecraft.earthTime += TIME_STEP * gamma;
    } else {
        spacecraft.shipTime += TIME_STEP;
        spacecraft.earthTime += TIME_STEP;
    }
    
    let effectiveThrust = spacecraft.thrustPower;
    if (gameState.relativityEnabled) {
        effectiveThrust = spacecraft.thrustPower / (gamma * gamma * gamma);
    }
    
    const baseFuelConsumption = 0.1;
    const fuelConsumptionPerSecond = baseFuelConsumption / TIME_STEP;
    let thrustUsed = 0;
    
    if (keys.w && spacecraft.fuel > 0) {
        thrustUsed = fuelConsumptionPerSecond * effectiveTimeStep;
    }
    
    if (keys.s && spacecraft.fuel > 0) {
        thrustUsed = fuelConsumptionPerSecond * effectiveTimeStep;
    }
    
    spacecraft.fuel = Math.max(0, spacecraft.fuel - thrustUsed);
    
    if (keys.a) spacecraft.angle -= spacecraft.rotationSpeed * effectiveTimeStep;
    if (keys.d) spacecraft.angle += spacecraft.rotationSpeed * effectiveTimeStep;
    
    const spacecraftBody = {
        x: spacecraft.x,
        y: spacecraft.y,
        vx: spacecraft.vx,
        vy: spacecraft.vy,
        mass: 1
    };
    
    const step = PhysicsEngine.adaptiveStep(spacecraftBody, effectiveTimeStep, planets);
    
    if (keys.w && spacecraft.fuel > 0) {
        step.dvx += effectiveThrust * Math.cos(spacecraft.angle) * effectiveTimeStep;
        step.dvy += effectiveThrust * Math.sin(spacecraft.angle) * effectiveTimeStep;
    }
    
    if (keys.s && spacecraft.fuel > 0) {
        step.dvx -= effectiveThrust * Math.cos(spacecraft.angle) * effectiveTimeStep;
        step.dvy -= effectiveThrust * Math.sin(spacecraft.angle) * effectiveTimeStep;
    }
    
    spacecraft.vx += step.dvx;
    spacecraft.vy += step.dvy;
    spacecraft.x += step.dx;
    spacecraft.y += step.dy;
    
    planets.forEach(planet => {
        if (planet.name !== '太阳') {
            const planetBody = {
                x: planet.x,
                y: planet.y,
                vx: planet.vx,
                vy: planet.vy,
                mass: planet.mass
            };
            const otherPlanets = planets.filter(p => p !== planet);
            const pStep = PhysicsEngine.adaptiveStep(planetBody, TIME_STEP, otherPlanets);
            planet.vx += pStep.dvx;
            planet.vy += pStep.dvy;
            planet.x += pStep.dx;
            planet.y += pStep.dy;
        }
    });
    
    gameState.trail.push({ x: spacecraft.x, y: spacecraft.y });
    if (gameState.trail.length > 500) gameState.trail.shift();
    
    checkPlanetVisit();
    checkNearPlanet();
    updateMissionProgress();
}

function checkPlanetVisit() {
    planets.forEach(planet => {
        if (gameState.visitedPlanets.has(planet.name)) return;
        
        const dx = spacecraft.x - planet.x;
        const dy = spacecraft.y - planet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < planet.radius + spacecraft.radius + 20) {
            gameState.visitedPlanets.add(planet.name);
            gameState.score += planet.score;
            
            missionFlybys.add(planet.name);
            
            const speed = Math.sqrt(spacecraft.vx * spacecraft.vx + spacecraft.vy * spacecraft.vy);
            if (speed > 20) {
                gameState.score += Math.floor(speed * 2);
            }
            
            updateUI();
        }
    });
}

function checkNearPlanet() {
    gameState.nearPlanet = null;
    planets.forEach(planet => {
        const dx = spacecraft.x - planet.x;
        const dy = spacecraft.y - planet.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < planet.radius * 3 && planet.name !== '太阳') {
            gameState.nearPlanet = planet;
        }
    });
    
    const sampleBtn = document.getElementById('sampleBtn');
    if (gameState.nearPlanet && gameState.landedPlanets.has(gameState.nearPlanet.name)) {
        if (!gameState.collectedSamples[gameState.nearPlanet.name]) {
            sampleBtn.style.display = 'block';
        } else {
            sampleBtn.style.display = 'none';
        }
    } else {
        sampleBtn.style.display = 'none';
    }
}

function startLanding() {
    if (!gameState.nearPlanet) {
        alert('需要靠近行星才能着陆！');
        return;
    }
    
    if (gameState.landedPlanets.has(gameState.nearPlanet.name)) {
        alert('已经在这颗行星着陆过了！');
        return;
    }
    
    const planet = gameState.nearPlanet;
    gameState.inMinigame = true;
    
    const dx = spacecraft.x - planet.x;
    const dy = spacecraft.y - planet.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    const relVx = spacecraft.vx - planet.vx;
    const relVy = spacecraft.vy - planet.vy;
    
    const orbitAngle = Math.atan2(-dy, dx);
    const radialSpeed = relVx * (dx / distance) + relVy * (dy / distance);
    const tangentialSpeed = -relVx * (dy / distance) + relVy * (dx / distance);
    
    const initialAltitude = Math.max(1000, (distance - planet.radius) * 20);
    const initialVSpeed = Math.max(10, -radialSpeed * 5);
    const initialHSpeed = tangentialSpeed * 2;
    
    landingState = {
        planet: planet,
        altitude: initialAltitude,
        vSpeed: initialVSpeed,
        hSpeed: initialHSpeed,
        hPosition: 135 + initialHSpeed * 10,
        landed: false,
        crashed: false,
        savedX: spacecraft.x,
        savedY: spacecraft.y,
        savedVx: spacecraft.vx,
        savedVy: spacecraft.vy,
        timeAccum: 0
    };
    
    landingState.hPosition = Math.max(20, Math.min(250, landingState.hPosition));
    
    document.getElementById('landingPlanet').textContent = `目标: ${planet.name}`;
    document.getElementById('landingGame').style.display = 'block';
    
    updateLandingDisplay();
    landingLoop();
}

function landingLoop() {
    if (!gameState.inMinigame || !landingState) return;
    
    const dt = 0.016;
    landingState.timeAccum += dt;
    
    const gravity = landingState.planet.gravity || 5;
    landingState.vSpeed += gravity * dt * 10;
    
    const thrustPower = 150;
    const fuelConsumptionRate = 0.1 / TIME_STEP * dt;
    
    if (keys.w && spacecraft.fuel > 0) {
        landingState.vSpeed -= thrustPower * dt * 0.5;
        spacecraft.fuel -= fuelConsumptionRate;
    }
    
    if (keys.a && spacecraft.fuel > 0) {
        landingState.hSpeed -= 20 * dt;
        spacecraft.fuel -= fuelConsumptionRate * 0.5;
    }
    if (keys.d && spacecraft.fuel > 0) {
        landingState.hSpeed += 20 * dt;
        spacecraft.fuel -= fuelConsumptionRate * 0.5;
    }
    
    spacecraft.fuel = Math.max(0, spacecraft.fuel);
    
    landingState.altitude -= landingState.vSpeed * dt * 50;
    landingState.hPosition += landingState.hSpeed * dt * 2;
    landingState.hPosition = Math.max(20, Math.min(250, landingState.hPosition));
    
    if (landingState.altitude <= 0) {
        landingState.altitude = 0;
        
        const onPad = landingState.hPosition >= 120 && landingState.hPosition <= 180;
        const safeVSpeed = landingState.vSpeed < 30;
        const safeHSpeed = Math.abs(landingState.hSpeed) < 10;
        
        if (onPad && safeVSpeed && safeHSpeed) {
            landingState.landed = true;
            finishLanding(true);
        } else {
            landingState.crashed = true;
            finishLanding(false);
        }
        return;
    }
    
    updateLandingDisplay();
    requestAnimationFrame(landingLoop);
}

function updateLandingDisplay() {
    document.getElementById('landingVSpeed').textContent = landingState.vSpeed.toFixed(1);
    document.getElementById('landingHSpeed').textContent = landingState.hSpeed.toFixed(1);
    document.getElementById('landingAltitude').textContent = Math.max(0, landingState.altitude).toFixed(0);
    
    const ship = document.getElementById('landingShip');
    ship.style.left = landingState.hPosition + 'px';
    ship.style.top = (170 - landingState.altitude / 10) + 'px';
    ship.style.transform = `rotate(${landingState.hSpeed * 2}deg)`;
    
    const vSpeedEl = document.getElementById('landingVSpeed');
    vSpeedEl.style.color = landingState.vSpeed < 30 ? '#00ff88' : '#ff4444';
}

function finishLanding(success) {
    setTimeout(() => {
        if (success) {
            gameState.landedPlanets.add(landingState.planet.name);
            gameState.score += landingState.planet.score * 2;
            
            spacecraft.x = landingState.planet.x + 5;
            spacecraft.y = landingState.planet.y;
            spacecraft.vx = landingState.planet.vx;
            spacecraft.vy = landingState.planet.vy;
            
            alert(`🎉 成功着陆 ${landingState.planet.name}！获得 ${landingState.planet.score * 2} 分！`);
        } else {
            spacecraft.x = landingState.savedX;
            spacecraft.y = landingState.savedY;
            spacecraft.vx = landingState.savedVx;
            spacecraft.vy = landingState.savedVy;
            spacecraft.fuel = Math.max(0, spacecraft.fuel - 20);
            
            alert(`💥 坠毁！已返回轨道，燃料损失20%。`);
        }
        
        document.getElementById('landingGame').style.display = 'none';
        gameState.inMinigame = false;
        landingState = null;
        updateUI();
    }, 500);
}

function startSampling() {
    if (!gameState.nearPlanet) return;
    if (!gameState.landedPlanets.has(gameState.nearPlanet.name)) {
        alert('需要先着陆才能收集样本！');
        return;
    }
    if (gameState.collectedSamples[gameState.nearPlanet.name]) {
        alert('已经收集过这颗行星的样本了！');
        return;
    }
    
    const planet = gameState.nearPlanet;
    gameState.inMinigame = true;
    
    const samplePositions = new Set();
    while (samplePositions.size < 3) {
        samplePositions.add(Math.floor(Math.random() * 25));
    }
    
    sampleState = {
        planet: planet,
        samples: Array.from(samplePositions),
        found: 0,
        drillCount: 5,
        drilled: new Set()
    };
    
    document.getElementById('samplePlanet').textContent = `正在钻探: ${planet.name}`;
    document.getElementById('sampleGame').style.display = 'block';
    
    const grid = document.getElementById('sampleGrid');
    grid.innerHTML = '';
    for (let i = 0; i < 25; i++) {
        const cell = document.createElement('div');
        cell.className = 'sample-cell';
        cell.textContent = '⛏️';
        cell.dataset.index = i;
        cell.onclick = () => drillCell(i, cell);
        grid.appendChild(cell);
    }
    
    updateSampleDisplay();
}

function drillCell(index, cell) {
    if (sampleState.drilled.has(index) || sampleState.drillCount <= 0) return;
    
    sampleState.drilled.add(index);
    sampleState.drillCount--;
    
    if (sampleState.samples.includes(index)) {
        sampleState.found++;
        cell.className = 'sample-cell found';
        cell.textContent = '💎';
    } else {
        cell.className = 'sample-cell empty';
        cell.textContent = '❌';
    }
    
    updateSampleDisplay();
    
    if (sampleState.found >= 3) {
        finishSampling(true);
    } else if (sampleState.drillCount <= 0) {
        finishSampling(false);
    }
}

function updateSampleDisplay() {
    document.getElementById('drillCount').textContent = sampleState.drillCount;
    document.getElementById('samplesFound').textContent = sampleState.found;
}

function finishSampling(success) {
    setTimeout(() => {
        if (success) {
            gameState.collectedSamples[sampleState.planet.name] = true;
            gameState.score += 500;
            alert(`🎉 成功收集所有样本！获得 500 分！`);
        } else {
            alert(`钻探次数用完！只找到了 ${sampleState.found}/3 个样本。`);
        }
        
        document.getElementById('sampleGame').style.display = 'none';
        gameState.inMinigame = false;
        sampleState = null;
        updateUI();
    }, 500);
}

function selectMission(missionId) {
    gameState.currentMission = missionId;
    
    document.querySelectorAll('.mission-item').forEach(el => {
        el.classList.remove('active');
    });
    document.getElementById('mission' + (Object.keys(missions).indexOf(missionId) + 1)).classList.add('active');
    
    updateUI();
}

function updateMissionProgress() {
    if (!gameState.currentMission) return;
    
    const mission = missions[gameState.currentMission];
    let progress = 0;
    let totalChecks = 0;
    
    if (mission.requirements.flybys) {
        totalChecks += mission.requirements.flybys.length;
        mission.requirements.flybys.forEach(planet => {
            if (missionFlybys.has(planet)) progress++;
        });
    }
    
    if (mission.requirements.landings) {
        totalChecks += mission.requirements.landings.length;
        mission.requirements.landings.forEach(planet => {
            if (gameState.landedPlanets.has(planet)) progress++;
        });
    }
    
    if (mission.requirements.samples) {
        totalChecks++;
        const sampleCount = Object.keys(gameState.collectedSamples).length;
        progress += Math.min(sampleCount, mission.requirements.samples) / mission.requirements.samples;
    }
    
    const progressPercent = totalChecks > 0 ? (progress / totalChecks * 100) : 0;
    
    const missionIndex = Object.keys(missions).indexOf(gameState.currentMission) + 1;
    const progressBar = document.querySelector(`#mission${missionIndex} .progress-fill`);
    if (progressBar) {
        progressBar.style.width = progressPercent + '%';
    }
    
    if (progressPercent >= 100 && !gameState.missionProgress[gameState.currentMission]) {
        gameState.missionProgress[gameState.currentMission] = true;
        gameState.score += mission.reward;
        alert(`🎊 任务 "${mission.name}" 完成！获得 ${mission.reward} 分奖励！`);
        updateUI();
    }
}

function draw() {
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 200; i++) {
        const x = (i * 137.5) % canvas.width;
        const y = (i * 251.3) % canvas.height;
        ctx.fillRect(x, y, 1, 1);
    }
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const speed = Math.sqrt(spacecraft.vx * spacecraft.vx + spacecraft.vy * spacecraft.vy);
    const gamma = calculateLorentzFactor(speed);
    const lengthScale = gameState.relativityEnabled ? (1 / gamma) : 1;
    
    if (gameState.trailEnabled && gameState.trail.length > 1) {
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        gameState.trail.forEach((point, i) => {
            const sx = centerX + (point.x - spacecraft.x) * SCALE * lengthScale;
            const sy = centerY + (point.y - spacecraft.y) * SCALE * lengthScale;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        });
        ctx.stroke();
    }
    
    planets.forEach(planet => {
        const px = centerX + (planet.x - spacecraft.x) * SCALE * lengthScale;
        const py = centerY + (planet.y - spacecraft.y) * SCALE * lengthScale;
        
        if (!isFinite(px) || !isFinite(py)) return;
        
        const gradient = ctx.createRadialGradient(px, py, 0, px, py, planet.radius * SCALE * 1.5);
        gradient.addColorStop(0, planet.color);
        gradient.addColorStop(0.5, planet.color + '80');
        gradient.addColorStop(1, 'transparent');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(px, py, planet.radius * SCALE * 1.5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = planet.color;
        ctx.beginPath();
        ctx.arc(px, py, planet.radius * SCALE, 0, Math.PI * 2);
        ctx.fill();
        
        if (gameState.visitedPlanets.has(planet.name) && planet.name !== '太阳' && planet.name !== '地球') {
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, planet.radius * SCALE + 5, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        if (gameState.landedPlanets.has(planet.name)) {
            ctx.fillStyle = '#00ff88';
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('✓', px, py - planet.radius * SCALE - 10);
        }
        
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(planet.name, px, py + planet.radius * SCALE + 15);
    });
    
    const shipX = centerX;
    const shipY = centerY;
    
    ctx.save();
    ctx.translate(shipX, shipY);
    ctx.rotate(spacecraft.angle);
    ctx.scale(Math.min(1, lengthScale + 0.5), 1);
    
    if (keys.w && spacecraft.fuel > 0) {
        ctx.fillStyle = '#ff6600';
        ctx.beginPath();
        ctx.moveTo(-8, -3);
        ctx.lineTo(-20, 0);
        ctx.lineTo(-8, 3);
        ctx.closePath();
        ctx.fill();
    }
    
    ctx.fillStyle = '#00ffff';
    ctx.beginPath();
    ctx.moveTo(15, 0);
    ctx.lineTo(-10, -8);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-10, 8);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
    
    if (gameState.orbitPredictEnabled && !gameState.inMinigame) {
        const orbitPoints = predictOrbit(100);
        ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        orbitPoints.forEach((point, i) => {
            const px = centerX + (point.x - spacecraft.x) * SCALE * lengthScale;
            const py = centerY + (point.y - spacecraft.y) * SCALE * lengthScale;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    if (gameState.relativityEnabled && speed > 500) {
        ctx.strokeStyle = `rgba(255, 100, 100, ${Math.min(0.5, (speed - 500) / 1000)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(shipX, shipY, 30, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function predictOrbit(steps) {
    const points = [];
    let simX = spacecraft.x;
    let simY = spacecraft.y;
    let simVx = spacecraft.vx;
    let simVy = spacecraft.vy;
    
    for (let i = 0; i < steps; i++) {
        let totalAx = 0, totalAy = 0;
        planets.forEach(planet => {
            const dx = planet.x - simX;
            const dy = planet.y - simY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 10) {
                const force = G * planet.mass / (distance * distance);
                totalAx += force * dx / distance;
                totalAy += force * dy / distance;
            }
        });
        
        simVx += totalAx * TIME_STEP;
        simVy += totalAy * TIME_STEP;
        simX += simVx * TIME_STEP;
        simY += simVy * TIME_STEP;
        
        points.push({ x: simX, y: simY });
    }
    
    return points;
}

function updateUI() {
    const speed = Math.sqrt(spacecraft.vx * spacecraft.vx + spacecraft.vy * spacecraft.vy);
    const gamma = calculateLorentzFactor(speed);
    
    document.getElementById('velocity').textContent = speed.toFixed(1) + ' km/s';
    document.getElementById('lightSpeedPercent').textContent = (speed / SPEED_OF_LIGHT * 100).toFixed(2) + '%';
    document.getElementById('fuelBar').style.width = (spacecraft.fuel / spacecraft.maxFuel * 100) + '%';
    document.getElementById('fuelValue').textContent = spacecraft.fuel.toFixed(1) + '%';
    document.getElementById('totalScore').textContent = gameState.score;
    document.getElementById('planetsVisited').textContent = (gameState.visitedPlanets.size - 1) + '/8';
    document.getElementById('planetsLanded').textContent = gameState.landedPlanets.size + '/8';
    
    const totalSamples = Object.keys(gameState.collectedSamples).length * 3;
    document.getElementById('samplesCollected').textContent = totalSamples + '/24';
    
    if (gameState.relativityEnabled) {
        document.getElementById('relativityDisplay').style.display = 'block';
        document.getElementById('timeDilation').textContent = gamma.toFixed(3) + 'x';
        document.getElementById('lengthContraction').textContent = ((1 / gamma) * 100).toFixed(1) + '%';
        document.getElementById('earthTime').textContent = spacecraft.earthTime.toFixed(1) + 's';
        
        const warning = document.getElementById('relativityWarning');
        if (speed > SPEED_OF_LIGHT * 0.5) {
            warning.style.display = 'block';
            warning.textContent = `⚠️ 警告: 时间膨胀 ${gamma.toFixed(2)}x！`;
        } else {
            warning.style.display = 'none';
        }
    } else {
        document.getElementById('relativityDisplay').style.display = 'none';
    }
    
    const planetList = document.getElementById('planetList');
    planetList.innerHTML = '';
    planets.slice(1).forEach(planet => {
        const div = document.createElement('div');
        let className = 'planet-item';
        if (gameState.visitedPlanets.has(planet.name)) className += ' visited';
        if (gameState.landedPlanets.has(planet.name)) className += ' landed';
        if (gameState.collectedSamples[planet.name]) className += ' collected';
        div.className = className;
        
        let status = '';
        if (gameState.collectedSamples[planet.name]) status = ' 💎';
        else if (gameState.landedPlanets.has(planet.name)) status = ' 🛬';
        else if (gameState.visitedPlanets.has(planet.name)) status = ' ✓';
        
        div.innerHTML = `<div class="planet-dot" style="background: ${planet.color}"></div>${planet.name} (+${planet.score})${status}`;
        planetList.appendChild(div);
    });
}

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
    if (key === 'r') resetGame();
    if (key === ' ') {
        e.preventDefault();
        gameState.paused = !gameState.paused;
    }
    if (key === 'l' && !gameState.inMinigame) startLanding();
    if (key === 'e' && !gameState.inMinigame) startSampling();
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

document.getElementById('thrustBtn').addEventListener('mousedown', () => keys.w = true);
document.getElementById('thrustBtn').addEventListener('mouseup', () => keys.w = false);
document.getElementById('retroBtn').addEventListener('mousedown', () => keys.s = true);
document.getElementById('retroBtn').addEventListener('mouseup', () => keys.s = false);
document.getElementById('leftBtn').addEventListener('mousedown', () => keys.a = true);
document.getElementById('leftBtn').addEventListener('mouseup', () => keys.a = false);
document.getElementById('rightBtn').addEventListener('mousedown', () => keys.d = true);
document.getElementById('rightBtn').addEventListener('mouseup', () => keys.d = false);
document.getElementById('resetBtn').addEventListener('click', resetGame);
document.getElementById('landBtn').addEventListener('click', startLanding);
document.getElementById('sampleBtn').addEventListener('click', startSampling);

document.getElementById('relativityToggle').addEventListener('change', (e) => {
    gameState.relativityEnabled = e.target.checked;
    updateUI();
});

document.getElementById('orbitPredictToggle').addEventListener('change', (e) => {
    gameState.orbitPredictEnabled = e.target.checked;
});

document.getElementById('trailToggle').addEventListener('change', (e) => {
    gameState.trailEnabled = e.target.checked;
});

document.getElementById('abortLanding').addEventListener('click', () => {
    if (landingState) {
        spacecraft.x = landingState.savedX;
        spacecraft.y = landingState.savedY;
        spacecraft.vx = landingState.savedVx;
        spacecraft.vy = landingState.savedVy;
        spacecraft.fuel = Math.max(0, spacecraft.fuel - 5);
    }
    document.getElementById('landingGame').style.display = 'none';
    gameState.inMinigame = false;
    landingState = null;
    updateUI();
    alert('⚠️ 着陆中止，已返回轨道，损失5%燃料。');
});

document.getElementById('finishSampling').addEventListener('click', () => {
    document.getElementById('sampleGame').style.display = 'none';
    gameState.inMinigame = false;
    sampleState = null;
});

document.getElementById('submitScore').addEventListener('click', async () => {
    const name = document.getElementById('playerName').value.trim() || '匿名玩家';
    try {
        const response = await fetch('/api/highscores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                playerName: name,
                score: gameState.score,
                planetsVisited: gameState.visitedPlanets.size - 1,
                fuelUsed: spacecraft.maxFuel - spacecraft.fuel
            })
        });
        const result = await response.json();
        alert(`分数提交成功！排名: 第${result.rank}名`);
    } catch (e) {
        alert('提交失败，请稍后重试');
    }
});

document.getElementById('playAgain').addEventListener('click', resetGame);

function resetGame() {
    spacecraft.x = 250;
    spacecraft.y = 0;
    spacecraft.vx = 0;
    spacecraft.vy = -Math.sqrt(G * 10000 / 250) - 5;
    spacecraft.angle = -Math.PI / 2;
    spacecraft.fuel = 100;
    spacecraft.shipTime = 0;
    spacecraft.earthTime = 0;
    
    gameState.score = 0;
    gameState.visitedPlanets = new Set(['地球']);
    gameState.landedPlanets = new Set();
    gameState.collectedSamples = {};
    gameState.paused = false;
    gameState.gameOver = false;
    gameState.trail = [];
    gameState.currentMission = null;
    gameState.missionProgress = {};
    gameState.inMinigame = false;
    missionFlybys = new Set();
    
    planets[1].x = 120; planets[1].y = 0; planets[1].vx = 0; planets[1].vy = -Math.sqrt(G * 10000 / 120);
    planets[2].x = 180; planets[2].y = 0; planets[2].vx = 0; planets[2].vy = -Math.sqrt(G * 10000 / 180);
    planets[3].x = 250; planets[3].y = 0; planets[3].vx = 0; planets[3].vy = -Math.sqrt(G * 10000 / 250);
    planets[4].x = 340; planets[4].y = 0; planets[4].vx = 0; planets[4].vy = -Math.sqrt(G * 10000 / 340);
    planets[5].x = 500; planets[5].y = 0; planets[5].vx = 0; planets[5].vy = -Math.sqrt(G * 10000 / 500);
    planets[6].x = 650; planets[6].y = 0; planets[6].vx = 0; planets[6].vy = -Math.sqrt(G * 10000 / 650);
    planets[7].x = 800; planets[7].y = 0; planets[7].vx = 0; planets[7].vy = -Math.sqrt(G * 10000 / 800);
    planets[8].x = 950; planets[8].y = 0; planets[8].vx = 0; planets[8].vy = -Math.sqrt(G * 10000 / 950);
    
    document.getElementById('gameOver').style.display = 'none';
    document.getElementById('landingGame').style.display = 'none';
    document.getElementById('sampleGame').style.display = 'none';
    
    document.querySelectorAll('.mission-item').forEach(el => {
        el.classList.remove('active');
        el.querySelector('.progress-fill').style.width = '0%';
    });
    
    updateUI();
}

function gameLoop() {
    updatePhysics();
    draw();
    requestAnimationFrame(gameLoop);
}

window.selectMission = selectMission;

updateUI();
gameLoop();
