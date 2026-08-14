/**
 * Tipe data domain Flowchart.
 *
 * Diekstrak dari FlowchartContainer.tsx (Fase 3 — Anti-God-Object).
 * Berisi tipe murni: tanpa React, tanpa efek samping, tanpa dependensi runtime.
 */

export type FlowNodeType =
  | "oval" | "rect" | "diamond" | "cylinder" | "text" | "sticky" | "cloud"
  | "circle" | "card" | "parallelogram" | "document" | "subprocess" | "actor"
  | "folder" | "decision" | "predefined" | "database" | "triangle" | "pentagon"
  | "hexagon" | "octagon" | "star" | "arrowRight" | "arrowLeft" | "arrowLeftRight"
  | "trapezoid" | "cross" | "curlyLeft" | "curlyRight" | "chevron" | "delay"
  | "callout" | "awsLambda" | "awsEc2" | "awsS3" | "awsVpc" | "awsRds"
  | "awsCloudwatch" | "awsDynamo" | "umlClass" | "umlInterface" | "umlUseCase"
  | "umlBoundary" | "umlControl" | "umlEntity" | "umlNote" | "multiDocument"
  | "manualInput" | "manualOperation" | "preparation" | "display"
  | "summingJunction" | "collate" | "connectorOr" | "sort" | "merge"
  | "azureUser" | "azureSql" | "azureFunctions" | "azureKeyVault" | "azureCosmos"
  | "azurePowerBi" | "azureVm" | "azureStorage" | "bpmnActivity" | "bpmnEvent"
  | "bpmnGateway" | "bpmnDataStore" | "bpmnDataObject" | "bpmnEventEnd";

/** Tema kanvas yang tersedia. */
export type CanvasTheme = "miro" | "blueprint";

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  x: number;
  y: number;
  label: string;
  /** "yellow", "orange", "pink", "blue", "green", "purple", "slate", "indigo", "emerald", "sky", "amber", "rose", "violet" */
  color: string;
  /** ID task Workspace yang tertaut. */
  taskId?: string;
  width?: number;
  height?: number;
  fontSize?: number;
  fontStyle?: "sans" | "serif" | "mono";
  align?: "left" | "center" | "right";
  borderStyle?: "solid" | "dashed" | "none";
  strokeWidth?: number;
}

export interface FlowEdge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
}

export interface FlowchartDocument {
  id: string;
  name: string;
  fileData?: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number;
  createdAt: string;
  createdBy: string;
}

export interface FlowchartData {
  id: string;
  name: string;
  category?: string;
  externalUrl?: string;
  documents?: FlowchartDocument[];
  epicTaskId?: string;
  description: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  theme: CanvasTheme;
  createdAt: string;
  createdBy?: string;
  lastEditedAt?: string;
}

// --- Tipe pendukung auto-routing ---

export interface Point {
  x: number;
  y: number;
}

export interface Obstacle {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}
