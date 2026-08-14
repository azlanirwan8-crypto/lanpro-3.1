/**
 * Konstanta Flowchart.
 *
 * Diekstrak apa adanya dari FlowchartContainer.tsx (Fase 3 — Anti-God-Object).
 */

/** Palet HEX untuk bentuk SVG presisi (Tailwind-equivalent). */
export const colorPaletteHex: Record<string, { bg: string; bgGrad: string; stroke: string }> = {
  yellow: { bg: "#fffbeb", bgGrad: "#fef3c7", stroke: "#eab308" }, // amber-50 / amber-100 / amber-500
  orange: { bg: "#fff7ed", bgGrad: "#ffedd5", stroke: "#f97316" }, // orange-50 / orange-100 / orange-500
  pink: { bg: "#fdf2f8", bgGrad: "#fce7f3", stroke: "#ec4899" },   // pink-50 / pink-100 / pink-500
  blue: { bg: "#eff6ff", bgGrad: "#dbeafe", stroke: "#3b82f6" },   // blue-50 / blue-100 / blue-550
  green: { bg: "#ecfdf5", bgGrad: "#d1fae5", stroke: "#10b981" },  // emerald-50 / emerald-100 / emerald-500
  purple: { bg: "#faf5ff", bgGrad: "#f3e8ff", stroke: "#a855f7" }, // purple-50 / purple-100 / purple-500
  indigo: { bg: "#eef2ff", bgGrad: "#e0e7ff", stroke: "#6366f1" }, // indigo-50 / indigo-100 / indigo-500
  sky: { bg: "#f0f9ff", bgGrad: "#e0f2fe", stroke: "#0ea5e9" },    // sky-50 / sky-100 / sky-500
  amber: { bg: "#fffbeb", bgGrad: "#fef3c7", stroke: "#f59e0b" },  // amber-50 / amber-100 / amber-550
  rose: { bg: "#fff1f2", bgGrad: "#ffe4e6", stroke: "#f43f5e" },   // rose-50 / rose-100 / rose-500
  violet: { bg: "#f5f3ff", bgGrad: "#ede9fe", stroke: "#8b5cf6" }, // violet-50 / violet-100 / violet-500
  slate: { bg: "#f8fafc", bgGrad: "#f1f5f9", stroke: "#64748b" }   // slate-50 / slate-100 / slate-500
};

/** Kelompok bentuk yang tampil di panel pemilih diagram. Data murni. */
export const DIAGRAM_SHAPE_GROUPS = [
  {
    title: "Basic Shapes",
    items: [
      { type: "rect", name: "Rectangle", desc: "Langkah Kerja" },
      { type: "oval", name: "Oval Bounds", desc: "Mulai / Selesai" },
      { type: "circle", name: "Circle Group", desc: "Kategori Bulat" },
      { type: "triangle", name: "Triangle", desc: "Merge / Extract" },
      { type: "pentagon", name: "Pentagon Step", desc: "Segi Lima" },
      { type: "hexagon", name: "Hexagon Prep", desc: "Segi Enam" },
      { type: "octagon", name: "Octagon Stop", desc: "Segi Delapan" },
      { type: "star", name: "Spotlight Star", desc: "Sorotan Utama" },
      { type: "cross", name: "Cross / Plus", desc: "Summing Junction" },
      { type: "trapezoid", name: "Trapezoid", desc: "Manual Input" },
    ]
  },
  {
    title: "Flowchart",
    items: [
      { type: "diamond", name: "Decision Diamond", desc: "Cabang Keputusan" },
      { type: "database", name: "DB Server Table", desc: "Database SQL/NoSQL" },
      { type: "cylinder", name: "Cylinder Storage", desc: "System File/Data" },
      { type: "subprocess", name: "Subprocess Block", desc: "Fungsi Predefined" },
      { type: "document", name: "File Document", desc: "Laporan / Hasil" },
      { type: "multiDocument", name: "Multi-Document", desc: "Stacked Wave Pages" },
      { type: "manualInput", name: "Manual Input", desc: "Form & Manual Data" },
      { type: "manualOperation", name: "Manual Operation", desc: "Manual Intervention" },
      { type: "preparation", name: "Preparation Hex", desc: "Setup & Initialization" },
      { type: "display", name: "Display Screen", desc: "Sistem Informasikan" },
      { type: "summingJunction", name: "Summing Junction", desc: "Circle with Cross" },
      { type: "collate", name: "Collate Step", desc: "Organize Records" },
      { type: "connectorOr", name: "OR Junction", desc: "Alternative Logic Node" },
      { type: "sort", name: "Sort Record", desc: "Arrange Sequence" },
      { type: "merge", name: "Merge Branch", desc: "Combine Data Streams" },
      { type: "folder", name: "Folder Storage", desc: "Penyimpanan Berkas" },
      { type: "cloud", name: "Cloud Architecture", desc: "Infrastruktur Cloud" },
      { type: "card", name: "Backlog Epic Card", desc: "Story Board Task" },
      { type: "predefined", name: "Predefined Process", desc: "Double Border" },
      { type: "parallelogram", name: "Data Parallelogram", desc: "Input / Output" },
    ]
  },
  {
    title: "Callouts",
    items: [
      { type: "callout", name: "Callout Speech", desc: "Anotasi / Komentar" },
      { type: "delay", name: "Delay Step", desc: "Sistem Menunggu" },
      { type: "arrowRight", name: "Arrow Right", desc: "Menunjuk Kanan" },
      { type: "arrowLeft", name: "Arrow Left", desc: "Menunjuk Kiri" },
      { type: "arrowLeftRight", name: "Arrow Left Right", desc: "Dua Arah Hub" },
      { type: "chevron", name: "Chevron Process", desc: "Langkah Beruntun" },
      { type: "curlyLeft", name: "Curly Left", desc: "Grup Awal" },
      { type: "curlyRight", name: "Curly Right", desc: "Grup Akhir" },
    ]
  },
  {
    title: "My Shapes",
    items: [
      { type: "sticky", name: "Sticky Notes", desc: "Miro Post-It" },
      { type: "actor", name: "System Actor", desc: "Aktor Pengguna" },
    ]
  },
  {
    title: "AWS Active Cloud",
    items: [
      { type: "awsLambda", name: "AWS Lambda", desc: "Serverless Function" },
      { type: "awsEc2", name: "AWS EC2", desc: "Virtual Server Node" },
      { type: "awsS3", name: "AWS S3 Bucket", desc: "Object Storage" },
      { type: "awsVpc", name: "AWS VPC", desc: "Virtual Network Area" },
      { type: "awsRds", name: "AWS RDS", desc: "Relational DB Cluster" },
      { type: "awsCloudwatch", name: "AWS CloudWatch", desc: "Monitoring & Stats" },
      { type: "awsDynamo", name: "AWS DynamoDB", desc: "NoSQL Database Table" },
    ]
  },
  {
    title: "Azure Cloud",
    items: [
      { type: "azureUser", name: "Azure Account", desc: "User Directory Profiling" },
      { type: "azureSql", name: "Azure SQL DB", desc: "Relational Cloud DB" },
      { type: "azureFunctions", name: "Azure Functions", desc: "Serverless Computing" },
      { type: "azureKeyVault", name: "Azure Key Vault", desc: "Secrets Key/Vault" },
      { type: "azureCosmos", name: "Cosmos NoSQL", desc: "Distributed Database" },
      { type: "azurePowerBi", name: "PowerBI Report", desc: "Data Analytics Insights" },
      { type: "azureVm", name: "Azure VM Node", desc: "Classic Computes Server" },
      { type: "azureStorage", name: "Azure Storage", desc: "File and Blob Cloud Storage" },
    ]
  },
  {
    title: "UML Modeling",
    items: [
      { type: "umlClass", name: "UML Class", desc: "Class Structure model" },
      { type: "umlInterface", name: "UML Interface", desc: "Interface & Lollipop" },
      { type: "umlUseCase", name: "UML Use Case", desc: "Business Use Case" },
      { type: "umlBoundary", name: "UML Boundary", desc: "Boundary Interface" },
      { type: "umlControl", name: "UML Control", desc: "Controller Logic Node" },
      { type: "umlEntity", name: "UML Entity", desc: "Database Entity Model" },
      { type: "umlNote", name: "UML Note Page", desc: "UML Dog-Ear Comment" },
    ]
  },
  {
    title: "BPMN Diagram",
    items: [
      { type: "bpmnActivity", name: "BPMN Activity", desc: "Enterprise Work Task" },
      { type: "bpmnEvent", name: "Start Event", desc: "Process Launch Point" },
      { type: "bpmnGateway", name: "Flow Gateway", desc: "Logical Split / Merge" },
      { type: "bpmnDataStore", name: "BPMN Storage", desc: "System Datastore" },
      { type: "bpmnDataObject", name: "Data Object Page", desc: "BPMN File Artifact" },
      { type: "bpmnEventEnd", name: "End Event Terminal", desc: "Process Terminus Point" },
    ]
  }
];
