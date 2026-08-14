/**
 * Auto-routing garis penghubung antar node.
 *
 * Diekstrak apa adanya dari FlowchartContainer.tsx (Fase 3 — Anti-God-Object).
 * Seluruh fungsi di sini murni: tidak menyentuh React, DOM, jaringan, maupun
 * state global. Input sama menghasilkan output sama.
 */

import type { FlowNode, Point, Obstacle } from '../types';

/** Apakah dua ruas garis saling berpotongan (termasuk kasus kolinear/bersentuhan). */
export function isSegmentIntersectingSegment(p1: Point, p2: Point, q1: Point, q2: Point): boolean {
  const crossProduct = (a: Point, b: Point, c: Point) => {
    return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  };

  const onSegment = (p: Point, q: Point, r: Point) => {
    return q.x >= Math.min(p.x, r.x) && q.x <= Math.max(p.x, r.x) &&
           q.y >= Math.min(p.y, r.y) && q.y <= Math.max(p.y, r.y);
  };

  const d1 = crossProduct(p1, p2, q1);
  const d2 = crossProduct(p1, p2, q2);
  const d3 = crossProduct(q1, q2, p1);
  const d4 = crossProduct(q1, q2, p2);

  // General intersection where vectors cross
  if (((d1 > 0.001 && d2 < -0.001) || (d1 < -0.001 && d2 > 0.001)) &&
      ((d3 > 0.001 && d4 < -0.001) || (d3 < -0.001 && d4 > 0.001))) {
    return true;
  }

  // Endpoints touch or collinear overlap
  if (Math.abs(d1) < 0.001 && onSegment(p1, q1, p2)) return true;
  if (Math.abs(d2) < 0.001 && onSegment(p1, q2, p2)) return true;
  if (Math.abs(d3) < 0.001 && onSegment(q1, p1, q2)) return true;
  if (Math.abs(d4) < 0.001 && onSegment(q1, p2, q2)) return true;

  return false;
}

/** Apakah sebuah ruas garis memotong atau berada di dalam sebuah persegi. */
export function isSegmentIntersectingRect(p1: Point, p2: Point, rect: { x1: number, y1: number, x2: number, y2: number }) {
  // Check if either point is strictly inside the obstacle rectangle with a small inset for safety
  const buffer = 1;
  const isPointInside = (p: Point) => {
    return p.x >= rect.x1 + buffer && p.x <= rect.x2 - buffer &&
           p.y >= rect.y1 + buffer && p.y <= rect.y2 - buffer;
  };

  if (isPointInside(p1) || isPointInside(p2)) {
    return true;
  }

  // Check if the segment intersects any of the 4 borders
  const tl = { x: rect.x1, y: rect.y1 };
  const tr = { x: rect.x2, y: rect.y1 };
  const br = { x: rect.x2, y: rect.y2 };
  const bl = { x: rect.x1, y: rect.y2 };

  if (isSegmentIntersectingSegment(p1, p2, tl, tr)) return true;
  if (isSegmentIntersectingSegment(p1, p2, tr, br)) return true;
  if (isSegmentIntersectingSegment(p1, p2, br, bl)) return true;
  if (isSegmentIntersectingSegment(p1, p2, bl, tl)) return true;

  // Handles cases where the line is inside or fully crosses from collinear lines
  const midPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  if (isPointInside(midPoint)) {
    return true;
  }

  return false;
}

/**
 * Mencari jalur terpendek antar dua titik sambil menghindari node lain.
 * Memakai Dijkstra di atas graf sudut-sudut rintangan, dengan penalti belokan
 * agar garis tetap rapi dan tidak bergelombang.
 */
export function findSmartRoute(
  start: Point & { dir?: { x: number; y: number } },
  end: Point & { dir?: { x: number; y: number } },
  fromNodeId: string,
  toNodeId: string,
  nodes: FlowNode[]
): Point[] {
  // Filter out from/to nodes, define safety boundary margin for shapes
  const padding = 26;
  const obstacles: Obstacle[] = [];

  for (const n of nodes) {
    if (n.id === fromNodeId || n.id === toNodeId) continue;
    const w = n.width || 130;
    const h = n.height || 70;
    obstacles.push({
      id: n.id,
      x1: n.x - padding,
      y1: n.y - padding,
      x2: n.x + w + padding,
      y2: n.y + h + padding,
    });
  }

  const isBlocked = (p1: Point, p2: Point) => {
    for (const o of obstacles) {
      if (isSegmentIntersectingRect(p1, p2, o)) {
        return true;
      }
    }
    return false;
  };

  // Quick check: If there's an unobstructed direct line, return it immediately
  if (!isBlocked(start, end)) {
    return [start, end];
  }

  // Create outward stub waypoints to force lines to begin/end with clean orthogonal segments
  const stubOffset = 25;
  const startStub: Point = {
    x: start.x + (start.dir?.x || 0) * stubOffset,
    y: start.y + (start.dir?.y || 0) * stubOffset
  };
  const endStub: Point = {
    x: end.x + (end.dir?.x || 0) * stubOffset,
    y: end.y + (end.dir?.y || 0) * stubOffset
  };

  // Build vertices (Start, Stubs, Corner waypoints of obstacle layout, End)
  interface Vertex extends Point {
    id: string;
  }
  const vertices: Vertex[] = [
    { x: start.x, y: start.y, id: "start" },
    { x: startStub.x, y: startStub.y, id: "startStub" }
  ];

  for (const o of obstacles) {
    vertices.push(
      { x: o.x1, y: o.y1, id: `${o.id}_tl` },
      { x: o.x2, y: o.y1, id: `${o.id}_tr` },
      { x: o.x2, y: o.y2, id: `${o.id}_br` },
      { x: o.x1, y: o.y2, id: `${o.id}_bl` }
    );
  }

  vertices.push(
    { x: endStub.x, y: endStub.y, id: "endStub" },
    { x: end.x, y: end.y, id: "end" }
  );

  // Dijkstra Shortest Path Search
  const dists: Record<string, number> = {};
  const prevs: Record<string, string | null> = {};
  const unvisited = new Set<string>();

  for (const v of vertices) {
    dists[v.id] = Infinity;
    prevs[v.id] = null;
    unvisited.add(v.id);
  }
  dists["start"] = 0;

  while (unvisited.size > 0) {
    let uId: string | null = null;
    let minDist = Infinity;
    for (const vId of unvisited) {
      if (dists[vId] < minDist) {
        minDist = dists[vId];
        uId = vId;
      }
    }

    if (uId === null || uId === "end") {
      break;
    }

    unvisited.delete(uId);
    if (dists[uId] === Infinity) continue;

    const u = vertices.find(v => v.id === uId)!;

    // Explore neighbors
    for (const vId of unvisited) {
      const v = vertices.find(v2 => v2.id === vId)!;

      // Check direct visibility
      if (!isBlocked(u, v)) {
        const d = Math.sqrt((u.x - v.x) ** 2 + (u.y - v.y) ** 2);

        // Add a slight turn penalty to discourage unnecessary diagonal bends and maintain beautiful rectangular styling
        let penalty = 0;
        if (prevs[uId]) {
          const prevU = vertices.find(v2 => v2.id === prevs[uId])!;
          // Direction vectors
          const dx1 = u.x - prevU.x;
          const dy1 = u.y - prevU.y;
          const dx2 = v.x - u.x;
          const dy2 = v.y - u.y;

          const mag1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
          const mag2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
          if (mag1 > 0.1 && mag2 > 0.1) {
            const dot = (dx1 * dx2 + dy1 * dy2) / (mag1 * mag2);
            if (dot < 0.95) {
              penalty = 35; // 35px distance penalty to prevent wavy routing
            }
          }
        }

        const alt = dists[uId] + d + penalty;
        if (alt < dists[vId]) {
          dists[vId] = alt;
          prevs[vId] = uId;
        }
      }
    }
  }

  // Reconstruct Path
  if (dists["end"] === Infinity) {
    return [start, startStub, endStub, end];
  }

  const path: Point[] = [];
  let currId: string | null = "end";
  while (currId) {
    const v = vertices.find(v2 => v2.id === currId)!;
    path.unshift({ x: v.x, y: v.y });
    currId = prevs[currId];
  }

  return path;
}
