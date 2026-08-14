/**
 * Parser impor diagram: Draw.io (XML) dan Miro (JSON/CSV) → node & edge LanPro.
 *
 * Sebelumnya ketiga fungsi ini hidup sebagai closure di dalam
 * FlowchartContainer, padahal tak satu pun menyentuh state, ref, atau siklus
 * hidup React — keduanya hanya menerima teks dan mengembalikan data. Menaruhnya
 * di sini mengikuti aturan lapisan di ARCHITECTURE.md §2 (fungsi murni → lib/)
 * dan membuatnya bisa diuji tanpa me-mount komponen apa pun.
 *
 * CATATAN soal DOM. Tabel lapisan di ARCHITECTURE.md melarang `lib/` mengakses
 * DOM global. Berkas ini memakai `DOMParser` dan sebuah `<textarea>` lepas
 * (detached) untuk membaca entitas HTML. Keduanya adalah alat parsing yang
 * kebetulan disediakan browser, BUKAN pembacaan atau perubahan DOM aplikasi
 * yang sedang tampil — tidak ada elemen yang pernah disisipkan ke halaman.
 * Larangan itu ada agar `lib/` tidak diam-diam bergantung pada UI; batasan itu
 * tetap dipatuhi di sini.
 *
 * Konsekuensinya: fungsi-fungsi ini butuh lingkungan ber-DOM. Di Jest artinya
 * proyek `jsdom` (berkas `*.test.tsx`), bukan proyek `node`.
 */
import type { FlowNode, FlowEdge } from '../types';

/** Hasil parse yang sama bentuknya untuk semua format asal. */
export interface ParsedDiagram {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/**
 * Mengubah entitas HTML (`&amp;`, `&lt;`, …) menjadi karakter aslinya.
 *
 * Label Draw.io dan Miro tersimpan dalam bentuk ter-encode. Elemen textarea
 * dipakai karena isinya di-parse sebagai teks biasa, bukan markup, dan elemen
 * itu tidak pernah masuk ke halaman sehingga tidak ada yang dieksekusi.
 */
export const decodeHtmlEntity = (htmlText: string): string => {
  if (typeof document === "undefined") return htmlText;
  const txt = document.createElement("textarea");
  txt.innerHTML = htmlText;
  return txt.value;
};

/** Membaca berkas .drawio/.xml dan memetakan tiap <mxCell> ke node atau edge. */
export const parseDrawIoXML = (xmlText: string): ParsedDiagram => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");

  const parseError = xmlDoc.getElementsByTagName("parsererror");
  if (parseError.length > 0) {
    throw new Error("Format XML Draw.io tidak valid atau rusak.");
  }

  const cells = xmlDoc.getElementsByTagName("mxCell");
  if (cells.length === 0) {
    throw new Error("Tidak ditemukan elemen diagram <mxCell> di dalam Draw.io XML.");
  }

  const extractedNodes: FlowNode[] = [];
  const extractedEdges: FlowEdge[] = [];
  const nodeIdsSet = new Set<string>();

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const id = cell.getAttribute("id");
    const vertex = cell.getAttribute("vertex");
    const edge = cell.getAttribute("edge");
    const valueAttr = cell.getAttribute("value") || "";

    if (!id || id === "0" || id === "1") continue;

    if (vertex === "1") {
      const geometry = cell.getElementsByTagName("mxGeometry")[0];
      let x = Math.floor(Math.random() * 150 + 100);
      let y = Math.floor(Math.random() * 150 + 100);
      let width = 125;
      let height = 85;

      if (geometry) {
        x = parseFloat(geometry.getAttribute("x") || `${x}`);
        y = parseFloat(geometry.getAttribute("y") || `${y}`);
        width = parseFloat(geometry.getAttribute("width") || "125");
        height = parseFloat(geometry.getAttribute("height") || "85");
      }

      let decodedLabel = decodeHtmlEntity(valueAttr)
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<[^>]*>/g, "")
        .trim();

      if (!decodedLabel) {
        decodedLabel = "Komponen Alur";
      }

      const style = cell.getAttribute("style") || "";
      let type: FlowNode["type"] = "rect";
      let color = "indigo";

      if (style.includes("ellipse") || style.includes("oval") || style.includes("circle")) {
        type = "oval";
        color = "emerald";
      } else if (style.includes("rhombus") || style.includes("diamond")) {
        type = "diamond";
        color = "orange";
      } else if (style.includes("cylinder") || style.includes("db") || style.includes("database")) {
        type = "cylinder";
        color = "sky";
      } else if (style.includes("cloud")) {
        type = "cloud";
        color = "slate";
      } else if (style.includes("parallelogram")) {
        type = "parallelogram";
        color = "yellow";
      } else if (style.includes("document")) {
        type = "document";
        color = "blue";
      } else if (style.includes("actor")) {
        type = "actor";
        color = "purple";
      } else if (style.includes("lambda")) {
        type = "awsLambda";
        color = "orange";
      } else if (style.includes("class")) {
        type = "umlClass";
        color = "slate";
      }

      extractedNodes.push({
        id: `drawio-${id}`,
        type,
        x,
        y,
        label: decodedLabel,
        color,
        fontSize: 12,
        align: "center",
        width,
        height,
        borderStyle: "solid",
        strokeWidth: 2,
      });
      nodeIdsSet.add(`drawio-${id}`);
    } else if (edge === "1") {
      const sourceId = cell.getAttribute("source");
      const targetId = cell.getAttribute("target");

      if (sourceId && targetId) {
        const edgeId = `drawio-edge-${id}`;
        let labelText = decodeHtmlEntity(valueAttr)
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<[^>]*>/g, "")
          .trim();

        extractedEdges.push({
          id: edgeId,
          fromNodeId: `drawio-${sourceId}`,
          toNodeId: `drawio-${targetId}`,
          label: labelText || undefined,
        });
      }
    }
  }

  const validEdges = extractedEdges.filter(
    (e) => nodeIdsSet.has(e.fromNodeId) && nodeIdsSet.has(e.toNodeId)
  );

  return { nodes: extractedNodes, edges: validEdges };
};

/**
 * Membaca ekspor Miro. Bentuknya dua macam, karena Miro sendiri mengekspor dua
 * macam: CSV bertabel (isCsv = true) dan JSON berisi widget (isCsv = false).
 */
export const parseMiroContent = (fileContent: string, isCsv: boolean): ParsedDiagram => {
  if (isCsv) {
    const lines = fileContent.split(/\r?\n/);
    if (lines.length < 2) {
      throw new Error("File CSV kosong atau tidak memiliki data.");
    }

    const headers = lines[0].split(",").map(h => h.trim().replace(/^["']|["']$/g, "").toLowerCase());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cells: string[] = [];
      let currentCell = "";
      let inQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"' || char === "'") {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          cells.push(currentCell.trim().replace(/^["']|["']$/g, ""));
          currentCell = "";
        } else {
          currentCell += char;
        }
      }
      cells.push(currentCell.trim().replace(/^["']|["']$/g, ""));

      const rowObj: any = {};
      headers.forEach((h, idx) => {
        rowObj[h] = cells[idx] || "";
      });
      rows.push(rowObj);
    }

    const extractedNodes: FlowNode[] = [];
    const extractedEdges: FlowEdge[] = [];
    const nodeIdsSet = new Set<string>();

    rows.forEach((row, idx) => {
      const id = row.id || `miro-row-${idx}`;
      const source = row.from || row["from id"] || row.source;
      const target = row.to || row["to id"] || row.target;

      if (source && target) {
        extractedEdges.push({
          id: `miro-edge-${id}`,
          fromNodeId: `miro-${source}`,
          toNodeId: `miro-${target}`,
          label: row.label || row.text || row.value || undefined,
        });
      } else {
        let x = parseFloat(row.x || row.left || "150") || (idx * 60 + 100);
        let y = parseFloat(row.y || row.top || "150") || (idx * 40 + 120);
        let width = parseFloat(row.width || "120") || 120;
        let height = parseFloat(row.height || "80") || 80;

        let labelText = row.text || row.label || row.content || row.title || `Komponen Miro ${idx + 1}`;
        labelText = decodeHtmlEntity(labelText).replace(/<[^>]*>/g, "").trim();

        let type: FlowNode["type"] = "rect";
        const parsedShape = (row.shape || row.type || "").toLowerCase();
        if (parsedShape.includes("circle") || parsedShape.includes("oval")) {
          type = "oval";
        } else if (parsedShape.includes("rhombus") || parsedShape.includes("diamond")) {
          type = "diamond";
        } else if (parsedShape.includes("cylinder") || parsedShape.includes("database")) {
          type = "cylinder";
        } else if (parsedShape.includes("cloud")) {
          type = "cloud";
        }

        extractedNodes.push({
          id: `miro-${id}`,
          type,
          x,
          y,
          label: labelText,
          color: "indigo",
          fontSize: 12,
          align: "center",
          width,
          height,
          borderStyle: "solid",
          strokeWidth: 2,
        });
        nodeIdsSet.add(`miro-${id}`);
      }
    });

    const validEdges = extractedEdges.filter(
      (e) => nodeIdsSet.has(e.fromNodeId) && nodeIdsSet.has(e.toNodeId)
    );

    return { nodes: extractedNodes, edges: validEdges };

  } else {
    const parsed = JSON.parse(fileContent);
    let items: any[] = [];

    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed.data && Array.isArray(parsed.data)) {
      items = parsed.data;
    } else if (parsed.widgets && Array.isArray(parsed.widgets)) {
      items = parsed.widgets;
    } else if (parsed.items && Array.isArray(parsed.items)) {
      items = parsed.items;
    } else {
      const potentialArray = Object.values(parsed).find((val) => Array.isArray(val));
      if (potentialArray) {
        items = potentialArray as any[];
      } else {
        items = [parsed];
      }
    }

    const extractedNodes: FlowNode[] = [];
    const extractedEdges: FlowEdge[] = [];
    const nodeIdsSet = new Set<string>();

    items.forEach((item: any, idx: number) => {
      if (!item) return;
      const id = item.id || `miro-item-${idx}`;
      const typeStr = (item.type || "").toLowerCase();

      const isConnector = typeStr === "connector" || typeStr === "line" || typeStr === "link" || item.start || item.from;

      if (!isConnector) {
        let x = 150;
        let y = 150;
        if (item.position) {
          x = typeof item.position.x === "number" ? item.position.x : parseFloat(item.position.x || "150");
          y = typeof item.position.y === "number" ? item.position.y : parseFloat(item.position.y || "150");
        } else if (typeof item.x === "number") {
          x = item.x;
          y = item.y ?? 150;
        }

        let width = 120;
        let height = 80;
        if (item.geometry) {
          width = item.geometry.width || 120;
          height = item.geometry.height || 80;
        } else if (item.width) {
          width = item.width;
          height = item.height || 80;
        }

        let text = "";
        if (item.data && typeof item.data.content === "string") {
          text = item.data.content;
        } else if (item.data && typeof item.data.text === "string") {
          text = item.data.text;
        } else if (typeof item.text === "string") {
          text = item.text;
        } else if (typeof item.title === "string") {
          text = item.title;
        } else if (typeof item.content === "string") {
          text = item.content;
        }

        text = decodeHtmlEntity(text)
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/p>/gi, "\n")
          .replace(/<[^>]*>/g, "")
          .trim();

        if (!text) {
          text = `Miro ${item.type || "Bentuk"}`;
        }

        let type: FlowNode["type"] = "rect";
        const shapeStyle = ((item.style && item.style.shapeType) || item.shape || "").toLowerCase();
        if (shapeStyle.includes("circle") || shapeStyle.includes("oval")) {
          type = "oval";
        } else if (shapeStyle.includes("rhombus") || shapeStyle.includes("diamond")) {
          type = "diamond";
        } else if (shapeStyle.includes("cylinder") || shapeStyle.includes("database")) {
          type = "cylinder";
        } else if (shapeStyle.includes("cloud")) {
          type = "cloud";
        }

        extractedNodes.push({
          id: `miro-${id}`,
          type,
          x,
          y,
          label: text,
          color: "indigo",
          fontSize: 12,
          align: "center",
          width,
          height,
          borderStyle: "solid",
          strokeWidth: 2,
        });
        nodeIdsSet.add(`miro-${id}`);
      } else {
        const fromNode = item.start?.id || item.startCell || item.from || item.source;
        const toNode = item.end?.id || item.endCell || item.to || item.target;

        if (fromNode && toNode) {
          let label = "";
          if (item.captions && Array.isArray(item.captions) && item.captions[0]) {
            label = item.captions[0].text || "";
          } else if (item.label) {
            label = item.label;
          }

          extractedEdges.push({
            id: `miro-edge-${id}`,
            fromNodeId: `miro-${fromNode}`,
            toNodeId: `miro-${toNode}`,
            label: label ? decodeHtmlEntity(label).replace(/<[^>]*>/g, "").trim() : undefined,
          });
        }
      }
    });

    const validEdges = extractedEdges.filter(
      (e) => nodeIdsSet.has(e.fromNodeId) && nodeIdsSet.has(e.toNodeId)
    );

    return { nodes: extractedNodes, edges: validEdges };
  }
};
