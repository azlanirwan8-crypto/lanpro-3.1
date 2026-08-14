import { useState, useEffect, useRef } from "react";

/**
 * useFlowchartCanvas
 * Manages canvas viewport state: pan/zoom, theme, grid snapping
 * Handles wheel zoom and pan mechanics
 */
export function useFlowchartCanvas() {
  // Canvas Viewport Pan & Zoom
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [zoomLevel, setZoomLevel] = useState<number>(0.9);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canvas theme and grid options
  const [canvasTheme, setCanvasTheme] = useState<'miro' | 'blueprint'>('miro');
  const [isSnapToGrid, setIsSnapToGrid] = useState<boolean>(true);

  // Canvas container ref for event listeners
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const isPanningRef = useRef(false);

  // Wheel event handler for zoom and pan
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent browser default scroll/zoom
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Ctrl+Wheel = Zoom (constrained between 0.2 and 3.0)
        const zoomDelta = e.deltaY < 0 ? 0.05 : -0.05;
        setZoomLevel(prev => Math.min(3.0, Math.max(0.2, prev + zoomDelta)));
      } else {
        // Regular wheel = Pan canvas
        setPanOffset(prev => ({
          x: prev.x - e.deltaX * 0.8,
          y: prev.y - e.deltaY * 0.8,
        }));
      }
    };

    // Non-passive listener to allow preventDefault
    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, []);

  // Start canvas panning (called from mouse down handlers)
  const startCanvasPanning = (clientX: number, clientY: number) => {
    setIsPanning(true);
    isPanningRef.current = true;
    setPanStart({
      x: clientX - panOffset.x,
      y: clientY - panOffset.y
    });
  };

  // Update pan offset during mouse move
  const updatePanOffset = (clientX: number, clientY: number) => {
    if (!isPanning) return;
    setPanOffset({
      x: clientX - panStart.x,
      y: clientY - panStart.y
    });
  };

  // Stop canvas panning
  const stopCanvasPanning = () => {
    setIsPanning(false);
    isPanningRef.current = false;
  };

  // Toggle canvas theme
  const toggleCanvasTheme = () => {
    setCanvasTheme(prev => prev === 'miro' ? 'blueprint' : 'miro');
  };

  // Toggle grid snapping
  const toggleGridSnap = () => {
    setIsSnapToGrid(prev => !prev);
  };

  // Reset zoom to default
  const resetZoom = () => {
    setZoomLevel(0.9);
  };

  // Reset pan to origin
  const resetPan = () => {
    setPanOffset({ x: 50, y: 50 });
  };

  // Reset both zoom and pan
  const resetCanvas = () => {
    resetZoom();
    resetPan();
  };

  // Apply grid snap to coordinate
  const applyGridSnap = (value: number, gridSize: number = 10): number => {
    if (!isSnapToGrid) return value;
    return Math.round(value / gridSize) * gridSize;
  };

  return {
    // State
    panOffset,
    zoomLevel,
    isPanning,
    canvasTheme,
    isSnapToGrid,

    // Refs
    canvasContainerRef,
    isPanningRef,

    // Setters (for external control)
    setPanOffset,
    setZoomLevel,
    setCanvasTheme,
    setIsSnapToGrid,

    // Handlers
    startCanvasPanning,
    updatePanOffset,
    stopCanvasPanning,
    toggleCanvasTheme,
    toggleGridSnap,
    resetZoom,
    resetPan,
    resetCanvas,
    applyGridSnap
  };
}
