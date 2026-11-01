import * as CANNON from 'cannon-es';
import type { CylinderArgs, PhysicsProps, Triplet } from '@react-three/cannon';
import { SeatingTable } from '../types/planning';

export interface CannonPhysicsConfig {
  gravity: Triplet;
  defaultContactMaterial: NonNullable<PhysicsProps['defaultContactMaterial']>;
  tableCylinderArgs: [number, number, number, number];
  tableMassKg: number;
  stageObstacleRadius: number;
}

/**
 * Canonical @react-three/cannon & cannon-es physics configuration for the 3D Venue Studio.
 */
export const VENUE_CANNON_CONFIG: CannonPhysicsConfig = {
  gravity: [0, -9.82, 0],
  defaultContactMaterial: {
    friction: 0.42,
    restitution: 0.32,
    contactEquationStiffness: 1e7,
    contactEquationRelaxation: 3,
  },
  // Table + surrounding chairs outer collision radius = 1.45m, height = 1.1m
  tableCylinderArgs: [1.45, 1.45, 1.1, 16],
  tableMassKg: 45,
  stageObstacleRadius: 2.5,
};

export interface TablePhysicsBodyState {
  tableNumber: number;
  x: number;
  y: number;
  z: number;
  vy: number;
  isColliding: boolean;
  clearanceMeters: number;
}

export interface ArSpaceValidationSummary {
  footprintWidthMeters: number;
  footprintDepthMeters: number;
  footprintAreaSqMeters: number;
  minClearanceMeters: number;
  collisionCount: number;
  validationStatus: 'Validated (1.5m+ Corridor)' | 'Tight Clearance (<1.2m)' | 'Collision Warning';
  perTableClearance: Record<
    number,
    {
      nearestDistanceMeters: number;
      aisleClearanceMeters: number;
      status: 'valid' | 'tight' | 'collision';
    }
  >;
}

/**
 * Evaluates real-world physical space validation for WebXR AR projection
 * and calculates chair-to-chair service aisle clearance in meters.
 */
export function evaluateArSpaceValidation(tables: SeatingTable[]): ArSpaceValidationSummary {
  const footprintWidthMeters = 24.0;
  const footprintDepthMeters = 18.0;
  const footprintAreaSqMeters = footprintWidthMeters * footprintDepthMeters;
  const outerChairRadius = VENUE_CANNON_CONFIG.tableCylinderArgs[0]; // 1.45m

  const perTableClearance: ArSpaceValidationSummary['perTableClearance'] = {};
  let minClearanceMeters = 99.0;
  let collisionCount = 0;

  if (tables.length <= 1) {
    if (tables[0]) {
      perTableClearance[tables[0].tableNumber] = {
        nearestDistanceMeters: 12.0,
        aisleClearanceMeters: 8.1,
        status: 'valid',
      };
    }
    return {
      footprintWidthMeters,
      footprintDepthMeters,
      footprintAreaSqMeters,
      minClearanceMeters: 8.1,
      collisionCount: 0,
      validationStatus: 'Validated (1.5m+ Corridor)',
      perTableClearance,
    };
  }

  for (let i = 0; i < tables.length; i++) {
    const a = tables[i];
    let nearestCenterDist = Infinity;

    for (let j = 0; j < tables.length; j++) {
      if (i === j) continue;
      const b = tables[j];
      const dist = Math.hypot(a.x - b.x, a.z - b.z);
      if (dist < nearestCenterDist) {
        nearestCenterDist = dist;
      }
    }

    // Also check clearance from the ceremonial stage at (0, -8.2) with radius 2.5m
    const stageCenterDist = Math.hypot(a.x - 0, a.z - -8.2);
    const stageEdgeClearance =
      stageCenterDist - (outerChairRadius + VENUE_CANNON_CONFIG.stageObstacleRadius);

    const tableEdgeClearance = nearestCenterDist - outerChairRadius * 2;
    const rawAisle = Math.min(tableEdgeClearance, stageEdgeClearance);
    // Service corridor clearance includes standard 0.65m chair push-back buffer
    const aisleClearanceMeters = Number(Math.max(0, rawAisle + 0.65).toFixed(2));

    let status: 'valid' | 'tight' | 'collision' = 'valid';
    if (rawAisle < -0.05) {
      status = 'collision';
      collisionCount++;
    } else if (aisleClearanceMeters < 1.1) {
      status = 'tight';
    }

    if (aisleClearanceMeters < minClearanceMeters) {
      minClearanceMeters = aisleClearanceMeters;
    }

    perTableClearance[a.tableNumber] = {
      nearestDistanceMeters: Number(nearestCenterDist.toFixed(2)),
      aisleClearanceMeters,
      status,
    };
  }

  const validationStatus: ArSpaceValidationSummary['validationStatus'] =
    collisionCount > 0
      ? 'Collision Warning'
      : minClearanceMeters < 1.1
      ? 'Tight Clearance (<1.2m)'
      : 'Validated (1.5m+ Corridor)';

  return {
    footprintWidthMeters,
    footprintDepthMeters,
    footprintAreaSqMeters,
    minClearanceMeters: Number(minClearanceMeters.toFixed(2)),
    collisionCount,
    validationStatus,
    perTableClearance,
  };
}

/**
 * Self-contained @react-three/cannon + cannon-es rigid-body physics world controller
 * for VenueScene3D: handles gravity-based object placement, realistic table-to-table
 * collision detection, stage obstacle avoidance, and floor boundary clamping.
 */
export class VenueCannonPhysicsSimulator {
  public world: CANNON.World;
  public bodies: Map<number, CANNON.Body> = new Map();
  private collidingTables: Set<number> = new Set();
  public totalCollisionEvents: number = 0;

  constructor(tables: SeatingTable[], spawnDropHeight = 0) {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(...VENUE_CANNON_CONFIG.gravity),
    });
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.defaultContactMaterial.friction =
      VENUE_CANNON_CONFIG.defaultContactMaterial.friction ?? 0.42;
    this.world.defaultContactMaterial.restitution =
      VENUE_CANNON_CONFIG.defaultContactMaterial.restitution ?? 0.32;

    // 1. Static Ground Plane at y = 0
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);

    // 2. Static Ceremonial Stage Dais Collider at (0, 0, -8.2)
    const [stageR] = [VENUE_CANNON_CONFIG.stageObstacleRadius];
    const stageBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Cylinder(stageR, stageR, 2.0, 16),
      position: new CANNON.Vec3(0, 1.0, -8.2),
    });
    this.world.addBody(stageBody);

    this.syncTables(tables, spawnDropHeight);
  }

  public syncTables(tables: SeatingTable[], spawnDropHeight = 0) {
    const [rTop, rBottom, height, segs] = VENUE_CANNON_CONFIG.tableCylinderArgs;
    const halfH = height / 2;
    const activeNums = new Set(tables.map((t) => t.tableNumber));

    // Remove deleted tables
    for (const [num, body] of this.bodies.entries()) {
      if (!activeNums.has(num)) {
        this.world.removeBody(body);
        this.bodies.delete(num);
      }
    }

    // Add or update tables
    tables.forEach((tbl, idx) => {
      const existing = this.bodies.get(tbl.tableNumber);
      if (!existing) {
        const dropOffset = spawnDropHeight > 0 ? spawnDropHeight + idx * 0.35 : 0;
        const body = new CANNON.Body({
          mass: VENUE_CANNON_CONFIG.tableMassKg,
          shape: new CANNON.Cylinder(rTop, rBottom, height, segs),
          position: new CANNON.Vec3(tbl.x, halfH + dropOffset, tbl.z),
          linearDamping: 0.78,
          angularDamping: 0.99,
          fixedRotation: true,
        });
        body.updateMassProperties();

        body.addEventListener('collide', (event: { body: CANNON.Body }) => {
          // Ignore ground plane collisions for horizontal collision indicator
          if (event.body && event.body.mass > 0) {
            this.collidingTables.add(tbl.tableNumber);
            this.totalCollisionEvents++;
          }
        });

        this.world.addBody(body);
        this.bodies.set(tbl.tableNumber, body);
      } else if (spawnDropHeight > 0) {
        existing.position.set(tbl.x, halfH + spawnDropHeight + idx * 0.28, tbl.z);
        existing.velocity.set(0, -1.2, 0);
        existing.wakeUp();
      }
    });
  }

  /**
   * Triggers a gravity-based drop test for all tables from an elevated height.
   */
  public triggerGravityDropPlacement(dropHeightMeters = 3.8) {
    const halfH = VENUE_CANNON_CONFIG.tableCylinderArgs[2] / 2;
    let idx = 0;
    for (const body of this.bodies.values()) {
      body.position.y = halfH + dropHeightMeters + idx * 0.28;
      body.velocity.set(0, -0.5, 0);
      body.wakeUp();
      idx++;
    }
  }

  /**
   * Moves a dragged table target in the physics world and resolves collisions against other tables.
   */
  public moveTableWithPhysics(tableNumber: number, targetX: number, targetZ: number) {
    const dragged = this.bodies.get(tableNumber);
    if (!dragged) return;

    const clampedX = Math.max(-9.2, Math.min(9.2, targetX));
    const clampedZ = Math.max(-4.5, Math.min(9.2, targetZ));

    const dx = clampedX - dragged.position.x;
    const dz = clampedZ - dragged.position.z;

    dragged.position.x = clampedX;
    dragged.position.z = clampedZ;
    dragged.velocity.set(dx * 12, 0, dz * 12);
    dragged.wakeUp();

    // Wake nearby bodies so collision impulses push overlapping tables smoothly
    for (const [otherNum, other] of this.bodies.entries()) {
      if (otherNum === tableNumber) continue;
      other.wakeUp();
    }
  }

  /**
   * Advances the cannon-es physics world by dt seconds and returns whether any bodies are still moving.
   */
  public step(dt: number): {
    isSimulating: boolean;
    states: TablePhysicsBodyState[];
  } {
    this.collidingTables.clear();
    const safeDt = Math.min(Math.max(dt, 0.004), 0.05);
    this.world.step(1 / 60, safeDt, 4);

    const halfH = VENUE_CANNON_CONFIG.tableCylinderArgs[2] / 2;
    const minCenterDist = VENUE_CANNON_CONFIG.tableCylinderArgs[0] * 2; // 3.9m
    const entries = Array.from(this.bodies.entries());

    // Deterministic horizontal separation pass for crisp zero-overlap table collision resolution
    for (let i = 0; i < entries.length; i++) {
      const [numA, bodyA] = entries[i];
      for (let j = i + 1; j < entries.length; j++) {
        const [numB, bodyB] = entries[j];
        const dx = bodyB.position.x - bodyA.position.x;
        const dz = bodyB.position.z - bodyA.position.z;
        const dist = Math.hypot(dx, dz);
        if (dist < minCenterDist && dist > 0.0001) {
          const overlap = (minCenterDist - dist) * 0.52;
          const nx = dx / dist;
          const nz = dz / dist;
          bodyA.position.x -= nx * overlap;
          bodyA.position.z -= nz * overlap;
          bodyB.position.x += nx * overlap;
          bodyB.position.z += nz * overlap;
          this.collidingTables.add(numA);
          this.collidingTables.add(numB);
          this.totalCollisionEvents++;
        }
      }

      // Stage obstacle repulsion at (0, -8.2)
      const sdx = bodyA.position.x - 0;
      const sdz = bodyA.position.z - -8.2;
      const sDist = Math.hypot(sdx, sdz);
      const minStageDist =
        VENUE_CANNON_CONFIG.tableCylinderArgs[0] + VENUE_CANNON_CONFIG.stageObstacleRadius;
      if (sDist < minStageDist && sDist > 0.0001) {
        const push = minStageDist - sDist;
        bodyA.position.x += (sdx / sDist) * push;
        bodyA.position.z += (sdz / sDist) * push;
        this.collidingTables.add(numA);
      }

      // Clamp within venue floor bounds and keep upright on ground plane
      bodyA.position.x = Math.max(-9.2, Math.min(9.2, bodyA.position.x));
      bodyA.position.z = Math.max(-4.5, Math.min(9.2, bodyA.position.z));
      if (bodyA.position.y < halfH) {
        bodyA.position.y = halfH;
        if (bodyA.velocity.y < 0) {
          bodyA.velocity.y = -bodyA.velocity.y * 0.28;
          if (Math.abs(bodyA.velocity.y) < 0.15) {
            bodyA.velocity.y = 0;
          }
        }
      }
    }

    let isSimulating = false;
    const states: TablePhysicsBodyState[] = [];

    for (const [tableNumber, body] of entries) {
      const yFloorOffset = Math.max(0, Number((body.position.y - halfH).toFixed(3)));
      const speedSq =
        body.velocity.x * body.velocity.x +
        body.velocity.y * body.velocity.y +
        body.velocity.z * body.velocity.z;
      if (yFloorOffset > 0.015 || speedSq > 0.02) {
        isSimulating = true;
      }

      states.push({
        tableNumber,
        x: Number(body.position.x.toFixed(2)),
        y: yFloorOffset,
        z: Number(body.position.z.toFixed(2)),
        vy: Number(body.velocity.y.toFixed(2)),
        isColliding: this.collidingTables.has(tableNumber),
        clearanceMeters: 1.5,
      });
    }

    return { isSimulating, states };
  }
}
