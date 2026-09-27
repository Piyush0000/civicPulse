import { gridDisk } from "h3-js";
import { centroidUpdate } from "../ai/embed";
import { cosine } from "../stats";

export type ClusterState = {
  id: string;
  category: string;
  centroid: number[];
  cells: Set<string>;
  count: number;
  reporters: Set<string>;
  firstSeen: Date;
  lastSeen: Date;
  representative: string;
  isNew?: boolean;
  dirty?: boolean;
};

/** Online assignment: nearest same-category cluster touching the request's k-ring(1), else a new one. */
export class ClusterIndex {
  byId = new Map<string, ClusterState>();
  private byCell = new Map<string, Set<string>>();

  constructor(
    public threshold: number,
    private newId: () => string,
  ) {}

  add(c: ClusterState) {
    this.byId.set(c.id, c);
    for (const h of c.cells) this.indexCell(h, c.id);
  }

  private indexCell(h: string, id: string) {
    if (!this.byCell.has(h)) this.byCell.set(h, new Set());
    this.byCell.get(h)!.add(id);
  }

  candidates(category: string, h3: string): ClusterState[] {
    const ids = new Set<string>();
    for (const n of gridDisk(h3, 1)) for (const id of this.byCell.get(n) ?? []) ids.add(id);
    return [...ids].map((id) => this.byId.get(id)!).filter((c) => c.category === category);
  }

  assign(req: { id: string; category: string; h3: string; embedding: number[]; reporter: string | null; at: Date }): {
    cluster: ClusterState;
    similarity: number;
    created: boolean;
  } {
    let best: ClusterState | null = null;
    let bestSim = -1;
    for (const c of this.candidates(req.category, req.h3)) {
      const s = cosine(req.embedding, c.centroid);
      if (s > bestSim) {
        bestSim = s;
        best = c;
      }
    }
    if (best && bestSim >= this.threshold) {
      best.centroid = centroidUpdate(best.centroid, req.embedding, best.count);
      best.count++;
      if (req.reporter) best.reporters.add(req.reporter);
      if (!best.cells.has(req.h3)) {
        best.cells.add(req.h3);
        this.indexCell(req.h3, best.id);
      }
      if (req.at > best.lastSeen) best.lastSeen = req.at;
      best.dirty = true;
      return { cluster: best, similarity: bestSim, created: false };
    }
    const c: ClusterState = {
      id: this.newId(),
      category: req.category,
      centroid: req.embedding,
      cells: new Set([req.h3]),
      count: 1,
      reporters: new Set(req.reporter ? [req.reporter] : []),
      firstSeen: req.at,
      lastSeen: req.at,
      representative: req.id,
      isNew: true,
      dirty: true,
    };
    this.add(c);
    return { cluster: c, similarity: 1, created: true };
  }
}
