/**
 * Render bentuk SVG kustom untuk kanvas Flowchart.
 *
 * Diekstrak apa adanya dari FlowchartContainer.tsx (Fase 3 — Anti-God-Object).
 * Lapisan presentasi murni: menerima data node, mengembalikan markup. Tidak
 * memegang state, tidak memanggil API.
 */

import React from "react";
import type { FlowNode } from "../types";
import { colorPaletteHex } from "../constants";

export const customSvgTypes = [
  "circle",
  "oval",
  "triangle",
  "callout",
  "star",
  "arrowRight",
  "arrowLeft",
  "arrowLeftRight",
  "pentagon",
  "octagon",
  "hexagon",
  "trapezoid",
  "cross",
  "curlyLeft",
  "curlyRight",
  "chevron",
  "delay",
  "awsLambda",
  "awsEc2",
  "awsS3",
  "awsVpc",
  "awsRds",
  "awsCloudwatch",
  "awsDynamo",
  "umlClass",
  "umlInterface",
  "umlUseCase",
  "umlBoundary",
  "umlControl",
  "umlEntity",
  "umlNote",
  "multiDocument",
  "manualInput",
  "manualOperation",
  "preparation",
  "display",
  "summingJunction",
  "collate",
  "connectorOr",
  "sort",
  "merge",
  "azureUser",
  "azureSql",
  "azureFunctions",
  "azureKeyVault",
  "azureCosmos",
  "azurePowerBi",
  "azureVm",
  "azureStorage",
  "bpmnActivity",
  "bpmnEvent",
  "bpmnGateway",
  "bpmnDataStore",
  "bpmnDataObject",
  "bpmnEventEnd",
];

export function renderCustomSvgShape(
  node: FlowNode,
  canvasTheme: "miro" | "blueprint",
  isSelected: boolean,
  isHovered: boolean = false,
  isDragging: boolean = false,
  isSourceOfConnect: boolean = false
) {
  const isBlueprint = canvasTheme === "blueprint";

  // Fallback or exact styling based on blueprint context
  const fillCol = isBlueprint
    ? "rgba(30, 58, 138, 0.4)" // translucent dark blue
    : `url(#grad-${node.color || "indigo"})`;

  const strokeCol = isSelected
    ? "#8b5cf6"
    : isSourceOfConnect
      ? "#f43f5e"
      : isBlueprint
        ? "#60a5fa"
        : colorPaletteHex[node.color]?.stroke || "#6366f1";

  const strokeDash = node.borderStyle === "dashed" ? "5,5" : "none";
  const strokeWidth = node.borderStyle === "none" ? "0" : "2";

  // Compute modern layered drop shadows for maximum softness and 3D feel
  const shadowFilter = isBlueprint
    ? "none"
    : isDragging
      ? "drop-shadow(0 20px 25px rgba(0,0,0,0.18)) drop-shadow(0 10px 10px rgba(0,0,0,0.12))"
      : isSourceOfConnect
        ? "drop-shadow(0 12px 20px rgba(244, 63, 94, 0.45))"
        : isSelected
          ? "drop-shadow(0 12px 20px rgba(139, 92, 246, 0.3))"
          : isHovered
            ? "drop-shadow(0 10px 15px rgba(0,0,0,0.12))"
            : "drop-shadow(0 3px 6px rgba(0,0,0,0.06))";

  // Common props
  const svgProps = {
    className:
      "w-full h-full absolute inset-0 pointer-events-none transition-colors duration-200 overflow-visible",
    viewBox: "0 0 100 100",
    preserveAspectRatio: "none" as const,
    style: { filter: shadowFilter, transition: "filter 0.2s ease-in-out" },
  };

  const elementProps = {
    fill: fillCol,
    stroke: strokeCol,
    strokeWidth: parseFloat(strokeWidth),
    strokeDasharray: strokeDash === "none" ? undefined : strokeDash,
    vectorEffect: "non-scaling-stroke",
    strokeLinejoin: "round" as const,
    className: "transition-colors duration-300",
  };

  switch (node.type) {
    case "circle":
      return (
        <svg {...svgProps}>
          <circle cx="50" cy="50" r="46" {...elementProps} />
        </svg>
      );
    case "oval":
      return (
        <svg {...svgProps}>
          <rect x="4" y="4" width="92" height="92" rx="46" ry="46" {...elementProps} />
        </svg>
      );
    case "decision":
    case "diamond":
      return (
        <svg {...svgProps}>
          <polygon points="50,0 100,50 50,100 0,50" {...elementProps} />
        </svg>
      );
    case "pentagon":
      return (
        <svg {...svgProps}>
          <polygon points="50,0 100,38 81,100 19,100 0,38" {...elementProps} />
        </svg>
      );
    case "triangle":
      return (
        <svg {...svgProps}>
          <polygon points="50,0 100,100 0,100" {...elementProps} />
        </svg>
      );

    case "hexagon":
      return (
        <svg {...svgProps}>
          <polygon points="25,0 75,0 100,50 75,100 25,100 0,50" {...elementProps} />
        </svg>
      );
    case "octagon":
      return (
        <svg {...svgProps}>
          <polygon points="30,0 70,0 100,30 100,70 70,100 30,100 0,70 0,30" {...elementProps} />
        </svg>
      );
    case "star":
      return (
        <svg {...svgProps}>
          <polygon
            points="50,0 63,35 100,35 70,55 79,100 50,70 21,100 30,55 0,35 37,35"
            {...elementProps}
          />
        </svg>
      );
    case "arrowRight":
      return (
        <svg {...svgProps}>
          <polygon points="0,30 65,30 65,0 100,50 65,100 65,70 0,70" {...elementProps} />
        </svg>
      );
    case "arrowLeft":
      return (
        <svg {...svgProps}>
          <polygon points="100,30 35,30 35,0 0,50 35,100 35,70 100,70" {...elementProps} />
        </svg>
      );
    case "arrowLeftRight":
      return (
        <svg {...svgProps}>
          <polygon
            points="0,50 25,25 25,40 75,40 75,25 100,50 75,75 75,60 25,60 25,75"
            {...elementProps}
          />
        </svg>
      );
    case "trapezoid":
      return (
        <svg {...svgProps}>
          <polygon points="20,0 80,0 100,100 0,100" {...elementProps} />
        </svg>
      );
    case "cross":
      return (
        <svg {...svgProps}>
          <polygon
            points="35,0 65,0 65,35 100,35 100,65 65,65 65,100 35,100 35,65 0,65 0,35 35,35"
            {...elementProps}
          />
        </svg>
      );
    case "curlyLeft":
      return (
        <svg {...svgProps}>
          <path
            d="M70,5 Q50,5 50,25 Q50,45 20,50 Q50,55 50,75 Q50,95 70,95"
            fill="none"
            stroke={strokeCol}
            strokeWidth={elementProps.strokeWidth}
            strokeDasharray={elementProps.strokeDasharray}
          />
        </svg>
      );
    case "curlyRight":
      return (
        <svg {...svgProps}>
          <path
            d="M30,5 Q50,5 50,25 Q50,45 80,50 Q50,55 50,75 Q50,95 30,95"
            fill="none"
            stroke={strokeCol}
            strokeWidth={elementProps.strokeWidth}
            strokeDasharray={elementProps.strokeDasharray}
          />
        </svg>
      );
    case "chevron":
      return (
        <svg {...svgProps}>
          <polygon points="5,5 75,5 95,50 75,95 5,95 25,50" {...elementProps} />
        </svg>
      );
    case "delay":
      return (
        <svg {...svgProps}>
          <path d="M5,5 L60,5 A45,45 0 0,1 60,95 L5,95 Z" {...elementProps} />
        </svg>
      );
    case "callout":
      return (
        <svg {...svgProps}>
          <path d="M5,5 L95,5 L95,75 L65,75 L50,95 L45,75 L5,75 Z" {...elementProps} />
        </svg>
      );
    case "awsLambda":
      return (
        <svg {...svgProps}>
          <polygon
            points="50,5 92,27 92,73 50,95 8,73 8,27"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#fff7ed"}
            stroke={isSelected ? "#8b5cf6" : "#f97316"}
          />
          <path
            d="M38,72 L48,48 L41,28 M48,48 L56,28 M48,48 L56,72"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#f97316"}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "awsEc2":
      return (
        <svg {...svgProps}>
          <rect
            x="18"
            y="18"
            width="64"
            height="64"
            rx="8"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#fff7ed"}
            stroke={isSelected ? "#8b5cf6" : "#f97316"}
          />
          <path
            d="M35,35 L65,35 M35,50 L65,50 M35,65 L65,65"
            stroke={isSelected ? "#8b5cf6" : "#f97316"}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <circle cx="28" cy="35" r="2.5" fill={isSelected ? "#8b5cf6" : "#f97316"} />
          <circle cx="28" cy="50" r="2.5" fill={isSelected ? "#8b5cf6" : "#f97316"} />
          <circle cx="28" cy="65" r="2.5" fill={isSelected ? "#8b5cf6" : "#f97316"} />
        </svg>
      );
    case "awsS3":
      return (
        <svg {...svgProps}>
          <ellipse
            cx="50"
            cy="20"
            rx="25"
            ry="10"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#ecfdf5"}
            stroke={isSelected ? "#8b5cf6" : "#10b981"}
          />
          <path
            d="M25,20 L25,65 A25,10 0 0,0 75,65 L75,20"
            {...elementProps}
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#10b981"}
          />
          <path
            d="M25,35 A25,5 0 0,0 75,35 M25,50 A25,5 0 0,0 75,50"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#10b981"}
            strokeWidth="1.5"
          />
          <line
            x1="50"
            y1="30"
            x2="50"
            y2="70"
            stroke={isSelected ? "#8b5cf6" : "#10b981"}
            strokeWidth="2.5"
            strokeDasharray="3,3"
          />
        </svg>
      );
    case "awsVpc":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="12"
            fill={isBlueprint ? "rgba(30, 58, 138, 0.2)" : "#f0f9ff"}
            stroke={isSelected ? "#8b5cf6" : "#0ea5e9"}
            strokeWidth="2.5"
            strokeDasharray="6,4"
          />
          <path
            d="M12,12 L42,12 L42,32 L12,32 Z"
            fill={isSelected ? "#8b5cf6" : "#0ea5e9"}
            opacity="0.15"
          />
          <text
            x="16"
            y="25"
            fill={isSelected ? "#8b5cf6" : "#0ea5e9"}
            fontSize="10"
            fontWeight="black"
            fontFamily="monospace"
          >
            VPC
          </text>
        </svg>
      );
    case "awsRds":
      return (
        <svg {...svgProps}>
          <ellipse
            cx="50"
            cy="18"
            rx="20"
            ry="8"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#eff6ff"}
            stroke={isSelected ? "#8b5cf6" : "#3b82f6"}
          />
          <path
            d="M30,18 L30,50 A20,8 0 0,0 70,50 L70,18"
            {...elementProps}
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#3b82f6"}
          />
          <path
            d="M30,32 A20,6 0 0,0 70,32"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#3b82f6"}
            strokeWidth="2"
          />
          <ellipse
            cx="54"
            cy="58"
            rx="18"
            ry="7"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.3)" : "#e0f2fe"}
            stroke={isSelected ? "#8b5cf6" : "#0284c7"}
          />
          <path
            d="M36,58 L36,88 A18,7 0 0,0 72,88 L72,58"
            {...elementProps}
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#0284c7"}
          />
          <path
            d="M36,72 A18,5 0 0,0 72,72"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#0284c7"}
            strokeWidth="1.5"
          />
          <path
            d="M42,62 Q45,64 50,55"
            fill="none"
            stroke="#2563eb"
            strokeWidth="2"
            strokeDasharray="2,2"
          />
        </svg>
      );
    case "awsCloudwatch":
      return (
        <svg {...svgProps}>
          <circle
            cx="50"
            cy="50"
            r="42"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#fff1f2"}
            stroke={isSelected ? "#8b5cf6" : "#f43f5e"}
          />
          <circle
            cx="50"
            cy="50"
            r="28"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#f43f5e"}
            strokeWidth="1.5"
            strokeDasharray="4,3"
          />
          <polygon points="50,22 55,48 45,48" fill={isSelected ? "#8b5cf6" : "#f43f5e"} />
          <circle cx="50" cy="50" r="6" fill={isSelected ? "#c084fc" : "#ec4899"} />
        </svg>
      );
    case "awsDynamo":
      return (
        <svg {...svgProps}>
          <rect
            x="15"
            y="15"
            width="70"
            height="70"
            rx="8"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#f5f3ff"}
            stroke={isSelected ? "#8b5cf6" : "#a855f7"}
          />
          <path
            d="M30,30 L70,30 M30,50 L70,50 M30,70 L70,70"
            stroke={isSelected ? "#8b5cf6" : "#a855f7"}
            strokeWidth="3"
          />
          <path
            d="M50,15 L50,85"
            stroke={isSelected ? "#8b5cf6" : "#a855f7"}
            strokeWidth="2"
            strokeDasharray="4,4"
          />
        </svg>
      );
    case "umlClass":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="4"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.5)" : "#f8fafc"}
            stroke={isSelected ? "#8b5cf6" : "#64748b"}
          />
          <line
            x1="5"
            y1="30"
            x2="95"
            y2="30"
            stroke={isSelected ? "#8b5cf6" : "#64748b"}
            strokeWidth="2"
          />
          <line
            x1="5"
            y1="65"
            x2="95"
            y2="65"
            stroke={isSelected ? "#8b5cf6" : "#64748b"}
            strokeWidth="2"
          />
        </svg>
      );
    case "umlInterface":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="4"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.5)" : "#f5f3ff"}
            stroke={isSelected ? "#8b5cf6" : "#8b5cf6"}
            strokeWidth="2"
            strokeDasharray="3,3"
          />
          <line
            x1="5"
            y1="35"
            x2="95"
            y2="35"
            stroke={isSelected ? "#8b5cf6" : "#8b5cf6"}
            strokeWidth="2"
          />
          <circle
            cx="50"
            cy="65"
            r="14"
            fill={isBlueprint ? "rgba(30, 58, 138, 0.6)" : "#faf5ff"}
            stroke={isSelected ? "#8b5cf6" : "#a855f7"}
            strokeWidth="2"
          />
          <line
            x1="50"
            y1="35"
            x2="50"
            y2="51"
            stroke={isSelected ? "#8b5cf6" : "#a855f7"}
            strokeWidth="2.5"
          />
        </svg>
      );
    case "umlUseCase":
      return (
        <svg {...svgProps}>
          <ellipse
            cx="50"
            cy="50"
            rx="44"
            ry="32"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#eff6ff"}
            stroke={isSelected ? "#8b5cf6" : "#3b82f6"}
          />
        </svg>
      );
    case "umlBoundary":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="8"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#64748b"}
            strokeWidth="1"
            strokeDasharray="4,2"
          />
          <circle
            cx="55"
            cy="50"
            r="14"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#f8fafc"}
            stroke={isSelected ? "#8b5cf6" : "#64748b"}
          />
          <line
            x1="25"
            y1="20"
            x2="25"
            y2="80"
            stroke={isSelected ? "#8b5cf6" : "#64748b"}
            strokeWidth="3"
          />
          <line
            x1="25"
            y1="50"
            x2="41"
            y2="50"
            stroke={isSelected ? "#8b5cf6" : "#64748b"}
            strokeWidth="3"
          />
        </svg>
      );
    case "umlControl":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="8"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#3b82f6"}
            strokeWidth="1"
            strokeDasharray="4,2"
          />
          <circle
            cx="50"
            cy="50"
            r="26"
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#eff6ff"}
            stroke={isSelected ? "#8b5cf6" : "#3b82f6"}
            strokeWidth="2"
          />
          <path
            d="M52,18 L56,24 L62,16"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#3b82f6"}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "umlEntity":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="8"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#10b981"}
            strokeWidth="1"
            strokeDasharray="4,2"
          />
          <ellipse
            cx="50"
            cy="55"
            rx="25"
            ry="14"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#ecfdf5"}
            stroke={isSelected ? "#8b5cf6" : "#10b981"}
          />
          <line
            x1="18"
            y1="75"
            x2="82"
            y2="75"
            stroke={isSelected ? "#8b5cf6" : "#10b981"}
            strokeWidth="3.5"
          />
          <line
            x1="50"
            y1="55"
            x2="50"
            y2="75"
            stroke={isSelected ? "#8b5cf6" : "#10b981"}
            strokeWidth="2.5"
          />
        </svg>
      );
    case "umlNote":
      return (
        <svg {...svgProps}>
          <polygon
            points="10,10 70,10 90,30 90,90 10,90"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#fffbeb"}
            stroke={isSelected ? "#8b5cf6" : "#eab308"}
          />
          <polygon
            points="70,10 70,30 90,30"
            fill={isSelected ? "#8b5cf6" : "#fef08a"}
            stroke={isSelected ? "#c084fc" : "#eab308"}
            strokeWidth="1.5"
          />
          <line
            x1="22"
            y1="38"
            x2="60"
            y2="38"
            stroke={isSelected ? "#c084fc" : "#ca8a04"}
            strokeWidth="1.5"
          />
          <line
            x1="22"
            y1="52"
            x2="78"
            y2="52"
            stroke={isSelected ? "#c084fc" : "#ca8a04"}
            strokeWidth="1.5"
          />
          <line
            x1="22"
            y1="66"
            x2="78"
            y2="66"
            stroke={isSelected ? "#c084fc" : "#ca8a04"}
            strokeWidth="1.5"
          />
        </svg>
      );
    case "multiDocument":
      return (
        <svg {...svgProps}>
          <path
            d="M15,10 L75,10 L75,60 Q60,50 45,60 Q30,70 15,60 Z"
            {...elementProps}
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "currentColor"}
          />
          <path
            d="M10,15 L70,15 L70,68 Q55,58 40,68 Q25,78 10,68 Z"
            {...elementProps}
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "currentColor"}
          />
          <path d="M5,20 L65,20 L65,75 Q50,65 35,75 Q20,85 5,75 Z" {...elementProps} />
        </svg>
      );
    case "manualInput":
      return (
        <svg {...svgProps}>
          <polygon points="5,25 95,5 95,95 5,95" {...elementProps} />
        </svg>
      );
    case "manualOperation":
      return (
        <svg {...svgProps}>
          <polygon points="5,5 95,5 80,95 20,95" {...elementProps} />
        </svg>
      );
    case "preparation":
      return (
        <svg {...svgProps}>
          <polygon points="20,5 80,5 95,50 80,95 20,95 5,50" {...elementProps} />
        </svg>
      );
    case "display":
      return (
        <svg {...svgProps}>
          <path
            d="M5,50 L25,5 L70,5 C85,5 95,25 95,50 C95,75 85,95 70,95 L25,95 Z"
            {...elementProps}
          />
        </svg>
      );
    case "summingJunction":
      return (
        <svg {...svgProps}>
          <circle cx="50" cy="50" r="42" {...elementProps} />
          <line x1="20" y1="20" x2="80" y2="80" stroke="currentColor" strokeWidth="4" />
          <line x1="80" y1="20" x2="20" y2="80" stroke="currentColor" strokeWidth="4" />
        </svg>
      );
    case "collate":
      return (
        <svg {...svgProps}>
          <polygon points="5,5 95,5 5,95 95,95" {...elementProps} />
        </svg>
      );
    case "connectorOr":
      return (
        <svg {...svgProps}>
          <circle cx="50" cy="50" r="42" {...elementProps} />
          <line x1="50" y1="8" x2="50" y2="92" stroke="currentColor" strokeWidth="4" />
          <line x1="8" y1="50" x2="92" y2="50" stroke="currentColor" strokeWidth="4" />
        </svg>
      );
    case "sort":
      return (
        <svg {...svgProps}>
          <polygon points="50,5 95,50 50,95 5,50" {...elementProps} />
          <line x1="5" y1="50" x2="95" y2="50" stroke="currentColor" strokeWidth="4" />
        </svg>
      );
    case "merge":
      return (
        <svg {...svgProps}>
          <polygon points="5,5 95,5 50,95" {...elementProps} />
        </svg>
      );
    case "azureUser":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="10"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#f0fdf4"}
            stroke={isSelected ? "#8b5cf6" : "#0078d4"}
          />
          <circle
            cx="50"
            cy="40"
            r="18"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#50e6ff"}
            strokeWidth="4"
          />
          <path
            d="M22,78 C22,60 34,58 50,58 C66,58 78,60 78,78"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#0078d4"}
            strokeWidth="5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "azureSql":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="10"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#eff6ff"}
            stroke={isSelected ? "#8b5cf6" : "#0078d4"}
          />
          <ellipse
            cx="50"
            cy="25"
            rx="22"
            ry="7"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#0078d4"}
            strokeWidth="4"
          />
          <path
            d="M28,25 L28,70 A22,7 0 0,0 72,70 L72,25"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#0078d4"}
            strokeWidth="4"
          />
          <path
            d="M28,40 A22,7 0 0,0 72,40 M28,55 A22,7 0 0,0 72,55"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#50e6ff"}
            strokeWidth="3"
          />
          <text
            x="50"
            y="86"
            fill={isSelected ? "#8b5cf6" : "#0078d4"}
            fontSize="11"
            fontWeight="black"
            fontFamily="monospace"
            textAnchor="middle"
          >
            SQL
          </text>
        </svg>
      );
    case "azureFunctions":
      return (
        <svg {...svgProps}>
          <polygon
            points="50,5 92,27 92,73 50,95 8,73 8,27"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.3)" : "#fffbeb"}
            stroke={isSelected ? "#8b5cf6" : "#f1c40f"}
          />
          <polygon
            points="55,20 28,52 48,52 42,80 72,44 50,44"
            fill={isSelected ? "#c084fc" : "#ff8c00"}
          />
        </svg>
      );
    case "azureKeyVault":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="10"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#fdf2f8"}
            stroke={isSelected ? "#8b5cf6" : "#ec4899"}
          />
          <circle
            cx="50"
            cy="38"
            r="16"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#ec4899"}
            strokeWidth="4"
          />
          <path d="M44,52 L44,82 L56,82 L56,52 Z" fill={isSelected ? "#8b5cf6" : "#ec4899"} />
          <circle cx="50" cy="38" r="6" fill="#fff" />
        </svg>
      );
    case "azureCosmos":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="10"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#f0f9ff"}
            stroke={isSelected ? "#8b5cf6" : "#0ea5e9"}
          />
          <circle cx="50" cy="50" r="12" fill={isSelected ? "#8b5cf6" : "#0ea5e9"} />
          <circle cx="30" cy="30" r="6" fill={isSelected ? "#8b5cf6" : "#10b981"} />
          <circle cx="70" cy="70" r="6" fill={isSelected ? "#8b5cf6" : "#ff7800"} />
          <line
            x1="30"
            y1="30"
            x2="50"
            y2="50"
            stroke={isSelected ? "#8b5cf6" : "#0078d4"}
            strokeWidth="3"
          />
          <line
            x1="70"
            y1="70"
            x2="50"
            y2="50"
            stroke={isSelected ? "#8b5cf6" : "#0078d4"}
            strokeWidth="3"
          />
        </svg>
      );
    case "azurePowerBi":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="10"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#fefce8"}
            stroke={isSelected ? "#8b5cf6" : "#eab308"}
          />
          <rect
            x="20"
            y="55"
            width="12"
            height="25"
            rx="2"
            fill={isSelected ? "#8b5cf6" : "#eab308"}
          />
          <rect
            x="38"
            y="35"
            width="12"
            height="45"
            rx="2"
            fill={isSelected ? "#8b5cf6" : "#ca8a04"}
          />
          <rect
            x="56"
            y="20"
            width="12"
            height="60"
            rx="2"
            fill={isSelected ? "#c084fc" : "#854d0e"}
          />
        </svg>
      );
    case "azureVm":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="10"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#eff6ff"}
            stroke={isSelected ? "#8b5cf6" : "#2563eb"}
          />
          <polygon
            points="50,15 80,30 80,65 50,80 20,65 20,30"
            fill="none"
            stroke={isSelected ? "#805cf6" : "#3b82f6"}
            strokeWidth="3"
          />
          <line
            x1="50"
            y1="15"
            x2="50"
            y2="80"
            stroke={isSelected ? "#805cf6" : "#3b82f6"}
            strokeWidth="2.5"
          />
          <line
            x1="50"
            y1="50"
            x2="80"
            y2="30"
            stroke={isSelected ? "#805cf6" : "#3b82f6"}
            strokeWidth="2"
          />
          <line
            x1="50"
            y1="50"
            x2="20"
            y2="30"
            stroke={isSelected ? "#805cf6" : "#3b82f6"}
            strokeWidth="2"
          />
        </svg>
      );
    case "azureStorage":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="10"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#f0fdfa"}
            stroke={isSelected ? "#8b5cf6" : "#0d9488"}
          />
          <rect
            x="25"
            y="25"
            width="40"
            height="40"
            rx="4"
            fill="none"
            stroke={isSelected ? "#815cf6" : "#0d9488"}
            strokeWidth="3"
          />
          <line
            x1="25"
            y1="45"
            x2="65"
            y2="45"
            stroke={isSelected ? "#815cf6" : "#0d9488"}
            strokeWidth="2"
          />
          <circle cx="35" cy="35" r="3" fill={isSelected ? "#815cf6" : "#2dd4bf"} />
          <circle cx="55" cy="35" r="3" fill={isSelected ? "#815cf6" : "#2dd4bf"} />
        </svg>
      );
    case "bpmnActivity":
      return (
        <svg {...svgProps}>
          <rect
            x="5"
            y="5"
            width="90"
            height="90"
            rx="12"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#fafafa"}
            stroke={isSelected ? "#8b5cf6" : "#1e293b"}
            strokeWidth="2.5"
          />
          <path
            d="M44,82 A6,6 0 1,1 54,82"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            {...elementProps}
          />
          <polygon points="54,82 58,78 54,74" fill="currentColor" />
        </svg>
      );
    case "bpmnEvent":
      return (
        <svg {...svgProps}>
          <circle
            cx="50"
            cy="50"
            r="40"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.3)" : "#fdfcf7"}
            stroke={isSelected ? "#8b5cf6" : "#059669"}
            strokeWidth="2"
          />
        </svg>
      );
    case "bpmnGateway":
      return (
        <svg {...svgProps}>
          <polygon
            points="50,5 95,50 50,95 5,50"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.3)" : "#fefdf0"}
            stroke={isSelected ? "#8b5cf6" : "#d97706"}
            strokeWidth="2.5"
          />
          <path
            d="M38,38 L62,62 M62,38 L38,62"
            stroke={isSelected ? "#8b5cf6" : "#d97706"}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "bpmnDataStore":
      return (
        <svg {...svgProps}>
          <ellipse
            cx="50"
            cy="22"
            rx="25"
            ry="9"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#f1f5f9"}
            stroke={isSelected ? "#8b5cf6" : "#475569"}
            strokeWidth="2.5"
          />
          <path
            d="M25,22 L25,75 A25,9 0 0,0 75,75 L75,22"
            {...elementProps}
            stroke={isSelected ? "#8b5cf6" : "#475569"}
            strokeWidth="2.5"
          />
          <path
            d="M25,36 A25,9 0 0,0 75,36 M25,50 A25,9 0 0,0 75,50"
            fill="none"
            stroke={isSelected ? "#8b5cf6" : "#475569"}
            strokeWidth="2"
          />
          <path
            d="M50,57 L50,68 M44,63 L56,63"
            stroke={isSelected ? "#8b5cf6" : "#475569"}
            strokeWidth="2"
          />
        </svg>
      );
    case "bpmnDataObject":
      return (
        <svg {...svgProps}>
          <polygon
            points="15,5 65,5 85,25 85,95 15,95"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.4)" : "#fff"}
            stroke={isSelected ? "#8b5cf6" : "#475569"}
          />
          <polygon
            points="65,5 65,25 85,25"
            fill="#e2e8f0"
            stroke={isSelected ? "#8b5cf6" : "#475569"}
          />
          <path
            d="M25,45 L40,45 M25,55 L55,55"
            stroke="#94a3b8"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      );
    case "bpmnEventEnd":
      return (
        <svg {...svgProps}>
          <circle
            cx="50"
            cy="50"
            r="40"
            {...elementProps}
            fill={isBlueprint ? "rgba(30, 58, 138, 0.3)" : "#fdf1f1"}
            stroke={isSelected ? "#8b5cf6" : "#dc2626"}
            strokeWidth="5.5"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function renderMiniPreviewIcon(type: string) {
  const commonProps = {
    className:
      "w-8 h-8 text-indigo-500 fill-indigo-50 stroke-indigo-400 transition-colors duration-150",
    viewBox: "0 0 100 100",
  };
  const elementProps = {
    fill: "rgba(99, 102, 241, 0.08)",
    stroke: "currentColor",
    strokeWidth: 4,
  };

  switch (type) {
    case "rect":
      return (
        <svg {...commonProps}>
          <rect x="15" y="25" width="70" height="50" rx="6" {...elementProps} />
        </svg>
      );
    case "oval":
      return (
        <svg {...commonProps}>
          <rect x="10" y="30" width="80" height="40" rx="20" {...elementProps} />
        </svg>
      );
    case "circle":
      return (
        <svg {...commonProps}>
          <circle cx="50" cy="50" r="32" {...elementProps} />
        </svg>
      );
    case "triangle":
      return (
        <svg {...commonProps}>
          <polygon points="50,15 85,80 15,80" {...elementProps} />
        </svg>
      );
    case "pentagon":
      return (
        <svg {...commonProps}>
          <polygon points="50,15 85,42 71,85 29,85 15,42" {...elementProps} />
        </svg>
      );
    case "hexagon":
      return (
        <svg {...commonProps}>
          <polygon points="28,20 72,20 88,50 72,80 28,80 12,50" {...elementProps} />
        </svg>
      );
    case "octagon":
      return (
        <svg {...commonProps}>
          <polygon points="32,15 68,15 85,32 85,68 68,85 32,85 15,68 15,32" {...elementProps} />
        </svg>
      );
    case "star":
      return (
        <svg {...commonProps}>
          <polygon
            points="50,15 61,39 88,39 66,55 74,81 50,65 26,81 34,55 12,39 39,39"
            {...elementProps}
          />
        </svg>
      );
    case "arrowRight":
      return (
        <svg {...commonProps}>
          <polygon points="15,35 60,35 60,20 85,50 60,80 60,65 15,65" {...elementProps} />
        </svg>
      );
    case "arrowLeft":
      return (
        <svg {...commonProps}>
          <polygon points="85,35 40,35 40,20 15,50 40,80 40,65 85,65" {...elementProps} />
        </svg>
      );
    case "arrowLeftRight":
      return (
        <svg {...commonProps}>
          <polygon
            points="15,50 32,32 32,41 68,41 68,32 85,50 68,68 68,59 32,59 32,68"
            {...elementProps}
          />
        </svg>
      );
    case "trapezoid":
      return (
        <svg {...commonProps}>
          <polygon points="25,20 75,20 88,80 12,80" {...elementProps} />
        </svg>
      );
    case "cross":
      return (
        <svg {...commonProps}>
          <polygon
            points="38,15 62,15 62,38 85,38 85,62 62,62 62,85 38,85 38,62 15,62 15,38 38,38"
            {...elementProps}
          />
        </svg>
      );
    case "curlyLeft":
      return (
        <svg {...commonProps}>
          <path
            d="M75,15 Q55,15 55,35 Q55,48 25,50 Q55,52 55,65 Q55,85 75,85"
            fill="none"
            stroke="currentColor"
            strokeWidth={5}
          />
        </svg>
      );
    case "curlyRight":
      return (
        <svg {...commonProps}>
          <path
            d="M25,15 Q45,15 45,35 Q45,48 75,50 Q45,52 45,65 Q45,85 25,85"
            fill="none"
            stroke="currentColor"
            strokeWidth={5}
          />
        </svg>
      );
    case "chevron":
      return (
        <svg {...commonProps}>
          <polygon points="15,20 70,20 88,50 70,80 15,80 32,50" {...elementProps} />
        </svg>
      );
    case "delay":
      return (
        <svg {...commonProps}>
          <path d="M15,20 L60,20 A30,30 0 0,1 60,80 L15,80 Z" {...elementProps} />
        </svg>
      );
    case "callout":
      return (
        <svg {...commonProps}>
          <path d="M15,15 L85,15 L85,65 L55,65 L40,82 L38,65 L15,65 Z" {...elementProps} />
        </svg>
      );
    case "diamond":
    case "decision":
      return (
        <svg {...commonProps}>
          <polygon points="50,15 85,50 50,85 15,50" {...elementProps} />
        </svg>
      );
    case "database":
    case "cylinder":
      return (
        <svg {...commonProps}>
          <ellipse cx="50" cy="27" rx="28" ry="10" {...elementProps} />
          <path
            d="M22,27 L22,70 A28,10 0 0,0 78,70 L78,27"
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
          />
          <path
            d="M22,48 A28,10 0 0,0 78,48"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeDasharray="3,3"
          />
        </svg>
      );
    case "subprocess":
      return (
        <svg {...commonProps}>
          <rect x="15" y="25" width="70" height="50" rx="4" {...elementProps} />
          <line x1="25" y1="25" x2="25" y2="75" stroke="currentColor" strokeWidth={4} />
          <line x1="75" y1="25" x2="75" y2="75" stroke="currentColor" strokeWidth={4} />
        </svg>
      );
    case "document":
      return (
        <svg {...commonProps}>
          <path d="M20,15 L65,15 L80,30 L80,85 L20,85 Z" {...elementProps} />
          <path d="M65,15 L65,30 L80,30" fill="none" stroke="currentColor" strokeWidth={4} />
        </svg>
      );
    case "folder":
      return (
        <svg {...commonProps}>
          <path d="M15,20 L40,20 L48,32 L85,32 L85,80 L15,80 Z" {...elementProps} />
        </svg>
      );
    case "cloud":
      return (
        <svg {...commonProps}>
          <path
            d="M25,65 A14,14 0 0,1 25,37 A18,18 0 0,1 60,30 A16,16 0 0,1 78,45 A14,14 0 0,1 75,65 Z"
            {...elementProps}
          />
        </svg>
      );
    case "card":
      return (
        <svg {...commonProps}>
          <rect x="15" y="20" width="70" height="60" rx="6" {...elementProps} />
          <line x1="15" y1="35" x2="85" y2="35" stroke="currentColor" strokeWidth={4} />
        </svg>
      );
    case "sticky":
      return (
        <svg {...commonProps}>
          <rect
            x="20"
            y="20"
            width="60"
            height="60"
            fill="rgba(245, 158, 11, 0.1)"
            stroke="#f59e0b"
            strokeWidth={4}
          />
        </svg>
      );
    case "actor":
      return (
        <svg
          className="w-8 h-8 text-indigo-500 transition-colors duration-150"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case "awsLambda":
      return (
        <svg {...commonProps}>
          <polygon
            points="50,15 85,35 85,65 50,85 15,65 15,35"
            {...elementProps}
            fill="rgba(249, 115, 22, 0.08)"
            stroke="#f97316"
          />
          <path
            d="M42,65 Q48,50 48,35 M48,45 L58,35 M48,45 L58,65"
            fill="none"
            stroke="#f97316"
            strokeWidth={5}
            strokeLinecap="round"
          />
        </svg>
      );
    case "awsEc2":
      return (
        <svg {...commonProps}>
          <rect
            x="20"
            y="20"
            width="60"
            height="60"
            rx="6"
            {...elementProps}
            fill="rgba(249, 115, 22, 0.08)"
            stroke="#f97316"
          />
          <line x1="35" y1="38" x2="65" y2="38" stroke="#f97316" strokeWidth={4} />
          <line x1="35" y1="50" x2="65" y2="50" stroke="#f97316" strokeWidth={4} />
          <line x1="35" y1="62" x2="65" y2="62" stroke="#f97316" strokeWidth={4} />
        </svg>
      );
    case "awsS3":
      return (
        <svg {...commonProps}>
          <ellipse
            cx="50"
            cy="27"
            rx="22"
            ry="7"
            {...elementProps}
            fill="rgba(16, 185, 129, 0.08)"
            stroke="#10b981"
          />
          <path
            d="M28,27 L28,68 A22,7 0 0,0 72,68 L72,27"
            fill="none"
            stroke="#10b981"
            strokeWidth={4}
          />
          <path
            d="M28,45 A22,4 0 0,0 72,45"
            fill="none"
            stroke="#10b981"
            strokeWidth={3}
            strokeDasharray="2,2"
          />
        </svg>
      );
    case "awsVpc":
      return (
        <svg {...commonProps}>
          <rect
            x="15"
            y="15"
            width="70"
            height="70"
            rx="8"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth={4}
            strokeDasharray="4,3"
          />
          <rect
            x="25"
            y="25"
            width="30"
            height="20"
            rx="2"
            fill="rgba(14, 165, 233, 0.1)"
            stroke="#0ea5e9"
            strokeWidth={2}
          />
        </svg>
      );
    case "awsRds":
      return (
        <svg {...commonProps}>
          <ellipse
            cx="42"
            cy="25"
            rx="15"
            ry="5"
            {...elementProps}
            fill="rgba(59, 130, 246, 0.08)"
            stroke="#3b82f6"
          />
          <path
            d="M27,25 L27,50 A15,5 0 0,0 57,50 L57,25"
            fill="none"
            stroke="#3b82f6"
            strokeWidth={3}
          />
          <ellipse
            cx="58"
            cy="62"
            rx="15"
            ry="5"
            {...elementProps}
            fill="rgba(59, 130, 246, 0.08)"
            stroke="#0ea5e9"
          />
          <path
            d="M43,62 L43,82 A15,5 0 0,0 73,82 L73,62"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth={2.5}
          />
        </svg>
      );
    case "awsCloudwatch":
      return (
        <svg {...commonProps}>
          <circle
            cx="50"
            cy="50"
            r="32"
            {...elementProps}
            fill="rgba(244, 63, 94, 0.08)"
            stroke="#f43f5e"
          />
          <circle
            cx="50"
            cy="50"
            r="18"
            fill="none"
            stroke="#f43f5e"
            strokeWidth={2.5}
            strokeDasharray="3,2"
          />
          <line
            x1="50"
            y1="50"
            x2="68"
            y2="32"
            stroke="#f43f5e"
            strokeWidth={4}
            strokeLinecap="round"
          />
        </svg>
      );
    case "awsDynamo":
      return (
        <svg {...commonProps}>
          <rect
            x="20"
            y="20"
            width="60"
            height="60"
            rx="6"
            {...elementProps}
            fill="rgba(168, 85, 247, 0.08)"
            stroke="#a855f7"
          />
          <path d="M35,35 L65,35 M35,50 L65,50 M35,65 L65,65" stroke="#a855f7" strokeWidth={3.5} />
          <line
            x1="50"
            y1="20"
            x2="50"
            y2="80"
            stroke="#a855f7"
            strokeWidth={2}
            strokeDasharray="3,3"
          />
        </svg>
      );
    case "umlClass":
      return (
        <svg {...commonProps}>
          <rect
            x="15"
            y="15"
            width="70"
            height="70"
            rx="4"
            {...elementProps}
            fill="rgba(100, 116, 139, 0.08)"
            stroke="#64748b"
          />
          <line x1="15" y1="36" x2="85" y2="36" stroke="#64748b" strokeWidth={3} />
          <line x1="15" y1="62" x2="85" y2="62" stroke="#64748b" strokeWidth={3} />
        </svg>
      );
    case "umlInterface":
      return (
        <svg {...commonProps}>
          <rect
            x="15"
            y="15"
            width="70"
            height="70"
            rx="4"
            {...elementProps}
            fill="rgba(168, 85, 247, 0.08)"
            stroke="#8b5cf6"
            strokeDasharray="3,2"
          />
          <circle cx="50" cy="52" r="12" fill="none" stroke="#a855f7" strokeWidth={3} />
          <line x1="50" y1="15" x2="50" y2="40" stroke="#a855f7" strokeWidth={3} />
        </svg>
      );
    case "umlUseCase":
      return (
        <svg {...commonProps}>
          <ellipse
            cx="50"
            cy="50"
            rx="38"
            ry="25"
            {...elementProps}
            fill="rgba(59, 130, 246, 0.08)"
            stroke="#3b82f6"
          />
        </svg>
      );
    case "umlBoundary":
      return (
        <svg {...commonProps}>
          <circle
            cx="55"
            cy="50"
            r="18"
            {...elementProps}
            fill="rgba(100, 116, 139, 0.08)"
            stroke="#64748b"
          />
          <line x1="25" y1="25" x2="25" y2="75" stroke="#64748b" strokeWidth={4} />
          <line x1="25" y1="50" x2="37" y2="50" stroke="#64748b" strokeWidth={4} />
        </svg>
      );
    case "umlControl":
      return (
        <svg {...commonProps}>
          <circle
            cx="50"
            cy="50"
            r="22"
            {...elementProps}
            fill="rgba(59, 130, 246, 0.08)"
            stroke="#3b82f6"
          />
          <path d="M52,18 L56,24 L62,16" fill="none" stroke="#3b82f6" strokeWidth={3.5} />
        </svg>
      );
    case "umlEntity":
      return (
        <svg {...commonProps}>
          <ellipse
            cx="50"
            cy="52"
            rx="20"
            ry="12"
            {...elementProps}
            fill="rgba(16, 185, 129, 0.08)"
            stroke="#10b981"
          />
          <line x1="20" y1="72" x2="80" y2="72" stroke="#10b981" strokeWidth={4.5} />
          <line x1="50" y1="52" x2="50" y2="72" stroke="#10b981" strokeWidth={3.5} />
        </svg>
      );
    case "umlNote":
      return (
        <svg {...commonProps}>
          <polygon
            points="18,15 62,15 82,35 82,85 18,85"
            {...elementProps}
            fill="rgba(234, 179, 8, 0.08)"
            stroke="#eab308"
          />
          <polygon points="62,15 62,35 82,35" fill="#fef08a" stroke="#eab308" strokeWidth={2} />
        </svg>
      );
    case "multiDocument":
      return (
        <svg {...commonProps}>
          <path
            d="M22,15 L78,15 L78,65 Q62,55 46,65 Q30,75 22,65 Z"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
          />
          <path d="M14,23 L70,23 L70,73 Q54,63 38,73 Q22,83 14,73 Z" {...elementProps} />
        </svg>
      );
    case "manualInput":
      return (
        <svg {...commonProps}>
          <polygon points="15,40 85,20 85,80 15,80" {...elementProps} />
        </svg>
      );
    case "manualOperation":
      return (
        <svg {...commonProps}>
          <polygon points="15,20 85,20 73,80 27,80" {...elementProps} />
        </svg>
      );
    case "preparation":
      return (
        <svg {...commonProps}>
          <polygon points="25,20 75,20 88,50 75,80 25,80 12,50" {...elementProps} />
        </svg>
      );
    case "display":
      return (
        <svg {...commonProps}>
          <path
            d="M15,50 L30,20 L75,20 C85,20 88,35 88,50 C88,65 85,80 75,80 L30,80 Z"
            {...elementProps}
          />
        </svg>
      );
    case "summingJunction":
      return (
        <svg {...commonProps}>
          <circle cx="50" cy="50" r="32" {...elementProps} />
          <line x1="27" y1="27" x2="73" y2="73" stroke="currentColor" strokeWidth={3.5} />
          <line x1="73" y1="27" x2="27" y2="73" stroke="currentColor" strokeWidth={3.5} />
        </svg>
      );
    case "collate":
      return (
        <svg {...commonProps}>
          <polygon points="15,20 85,20 15,80 85,80" {...elementProps} />
        </svg>
      );
    case "connectorOr":
      return (
        <svg {...commonProps}>
          <circle cx="50" cy="50" r="32" {...elementProps} />
          <line x1="50" y1="18" x2="50" y2="82" stroke="currentColor" strokeWidth={3.5} />
          <line x1="18" y1="50" x2="82" y2="50" stroke="currentColor" strokeWidth={3.5} />
        </svg>
      );
    case "sort":
      return (
        <svg {...commonProps}>
          <polygon points="50,15 85,50 50,85 15,50" {...elementProps} />
          <line x1="15" y1="50" x2="85" y2="50" stroke="currentColor" strokeWidth={3.5} />
        </svg>
      );
    case "merge":
      return (
        <svg {...commonProps}>
          <polygon points="15,20 85,20 50,80" {...elementProps} />
        </svg>
      );
    case "azureUser":
      return (
        <svg {...commonProps}>
          <rect
            x="20"
            y="20"
            width="60"
            height="60"
            rx="6"
            {...elementProps}
            fill="rgba(0, 120, 212, 0.05)"
            stroke="#0078d4"
            strokeWidth={3}
          />
          <circle cx="50" cy="42" r="11" fill="none" stroke="#0078d4" strokeWidth={3} />
          <path
            d="M32,68 C32,56 40,54 50,54 C60,54 68,56 68,68"
            fill="none"
            stroke="#0078d4"
            strokeWidth={3}
          />
        </svg>
      );
    case "azureSql":
      return (
        <svg {...commonProps}>
          <rect
            x="20"
            y="20"
            width="60"
            height="60"
            rx="6"
            {...elementProps}
            fill="rgba(0, 120, 212, 0.05)"
            stroke="#0078d4"
            strokeWidth={3}
          />
          <ellipse
            cx="50"
            cy="34"
            rx="14"
            ry="4.5"
            fill="none"
            stroke="#0078d4"
            strokeWidth={2.5}
          />
          <path
            d="M36,34 L36,60 A14,4.5 0 0,0 64,60 L64,34"
            fill="none"
            stroke="#0078d4"
            strokeWidth="2.5"
          />
          <path
            d="M36,44 A14,4.5 0 0,0 64,44 M36,52 A14,4.5 0 0,0 64,52"
            fill="none"
            stroke="#0078d4"
            strokeWidth={1.5}
          />
        </svg>
      );
    case "azureFunctions":
      return (
        <svg {...commonProps}>
          <polygon
            points="50,15 85,35 85,65 50,85 15,65 15,35"
            {...elementProps}
            fill="rgba(241, 196, 15, 0.05)"
            stroke="#f1c40f"
          />
          <polygon points="54,28 32,52 48,52 44,72 66,46 50,46" fill="#ff8c00" />
        </svg>
      );
    case "azureKeyVault":
      return (
        <svg {...commonProps}>
          <rect
            x="20"
            y="20"
            width="60"
            height="60"
            rx="6"
            {...elementProps}
            fill="rgba(236, 72, 153, 0.05)"
            stroke="#ec4899"
            strokeWidth={3}
          />
          <circle cx="50" cy="42" r="10" fill="none" stroke="#ec4899" strokeWidth={3} />
          <rect x="46" y="52" width="8" height="18" fill="#ec4899" />
        </svg>
      );
    case "azureCosmos":
      return (
        <svg {...commonProps}>
          <rect
            x="20"
            y="20"
            width="60"
            height="60"
            rx="6"
            {...elementProps}
            fill="rgba(14, 165, 233, 0.05)"
            stroke="#0ea5e9"
            strokeWidth={3}
          />
          <circle cx="50" cy="50" r="8" fill="#0ea5e9" />
          <circle cx="36" cy="36" r="4.5" fill="#10b981" />
          <circle cx="64" cy="64" r="4.5" fill="#ff7800" />
          <line x1="36" y1="36" x2="50" y2="50" stroke="#0078d4" strokeWidth="2" />
          <line x1="64" y1="64" x2="50" y2="50" stroke="#0078d4" strokeWidth="2" />
        </svg>
      );
    case "azurePowerBi":
      return (
        <svg {...commonProps}>
          <rect
            x="20"
            y="20"
            width="60"
            height="60"
            rx="6"
            {...elementProps}
            fill="rgba(234, 179, 8, 0.05)"
            stroke="#eab308"
            strokeWidth={3}
          />
          <rect x="30" y="52" width="7" height="16" rx="1.5" fill="#eab308" />
          <rect x="42" y="38" width="7" height="30" rx="1.5" fill="#ca8a04" />
          <rect x="54" y="28" width="7" height="40" rx="1.5" fill="#854d0e" />
        </svg>
      );
    case "azureVm":
      return (
        <svg {...commonProps}>
          <rect
            x="20"
            y="20"
            width="60"
            height="60"
            rx="6"
            {...elementProps}
            fill="rgba(37, 99, 235, 0.05)"
            stroke="#2563eb"
            strokeWidth={3}
          />
          <polygon
            points="50,27 71,37 71,63 50,73 29,63 29,37"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />
          <line x1="50" y1="27" x2="50" y2="73" stroke="#3b82f6" strokeWidth="2" />
          <line x1="50" y1="50" x2="71" y2="37" stroke="#3b82f6" strokeWidth="1.5" />
          <line x1="50" y1="50" x2="29" y2="37" stroke="#3b82f6" strokeWidth="1.5" />
        </svg>
      );
    case "azureStorage":
      return (
        <svg {...commonProps}>
          <rect
            x="20"
            y="20"
            width="60"
            height="60"
            rx="6"
            {...elementProps}
            fill="rgba(13, 148, 136, 0.05)"
            stroke="#0d9488"
            strokeWidth={3}
          />
          <rect
            x="33"
            y="33"
            width="34"
            height="34"
            rx="2"
            fill="none"
            stroke="#0d9488"
            strokeWidth={2.5}
          />
          <line x1="33" y1="50" x2="67" y2="50" stroke="#0d9488" strokeWidth="2" />
          <circle cx="41" cy="41" r="2" fill="#2dd4bf" />
          <circle cx="59" cy="41" r="2" fill="#2dd4bf" />
        </svg>
      );
    case "bpmnActivity":
      return (
        <svg {...commonProps}>
          <rect
            x="18"
            y="18"
            width="64"
            height="64"
            rx="8"
            {...elementProps}
            fill="rgba(30, 41, 59, 0.02)"
            stroke="#1e293b"
            strokeWidth={3}
          />
          <path d="M46,74 A4,4 0 1,1 54,74" fill="none" stroke="currentColor" strokeWidth="2" />
          <polygon points="54,74 57,71 54,68" fill="currentColor" />
        </svg>
      );
    case "bpmnEvent":
      return (
        <svg {...commonProps}>
          <circle
            cx="50"
            cy="50"
            r="30"
            {...elementProps}
            fill="none"
            stroke="#059669"
            strokeWidth={2.5}
          />
        </svg>
      );
    case "bpmnGateway":
      return (
        <svg {...commonProps}>
          <polygon
            points="50,18 82,50 50,82 18,50"
            {...elementProps}
            fill="none"
            stroke="#d97706"
            strokeWidth={3}
          />
          <path
            d="M42,42 L58,58 M58,42 L42,58"
            stroke="#d97706"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "bpmnDataStore":
      return (
        <svg {...commonProps}>
          <ellipse
            cx="50"
            cy="27"
            rx="20"
            ry="7"
            {...elementProps}
            fill="none"
            stroke="#475569"
            strokeWidth={3}
          />
          <path
            d="M30,27 L30,73 A20,7 0 0,0 70,73 L70,27"
            fill="none"
            stroke="#475569"
            strokeWidth={3}
          />
          <path
            d="M30,42 A20,7 0 0,0 70,42 M30,57 A20,7 0 0,0 70,57"
            fill="none"
            stroke="#475569"
            strokeWidth={2}
          />
        </svg>
      );
    case "bpmnDataObject":
      return (
        <svg {...commonProps}>
          <polygon
            points="25,15 63,15 78,30 78,85 25,85"
            {...elementProps}
            fill="none"
            stroke="#475569"
            strokeWidth={3}
          />
          <polygon points="63,15 63,30 78,30" fill="#e2e8f0" stroke="#475569" strokeWidth={2} />
        </svg>
      );
    case "bpmnEventEnd":
      return (
        <svg {...commonProps}>
          <circle
            cx="50"
            cy="50"
            r="30"
            {...elementProps}
            fill="none"
            stroke="#dc2626"
            strokeWidth={5.5}
          />
        </svg>
      );
    default:
      return <div className="w-5 h-5 bg-indigo-500 rounded-sm" />;
  }
}
