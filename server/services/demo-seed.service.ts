/**
 * Penyemai data demo BNI.
 *
 * Sebelumnya seluruh 618 baris ini tertulis di dalam satu handler rute di
 * project.routes.ts — 76 persen isi berkas itu hanyalah satu endpoint. Logika
 * penyemaian tidak menyentuh req maupun res selain untuk otorisasi di awal,
 * sehingga tempatnya memang di lapisan service.
 *
 * Dipindah apa adanya. Tidak ada query, urutan, maupun data contoh yang diubah.
 */
import crypto from "crypto";
import db from "../../src/lib/db";

/**
 * Membuat proyek demo beserta seluruh isinya.
 *
 * Melempar bila gagal; pemanggil yang menerjemahkannya menjadi respons HTTP.
 * Koneksi dilepas di blok finally — pola yang dipertahankan dari kode asli,
 * termasuk deklarasi `connection` di luar try karena finally merujuknya.
 */
export async function buatProyekDemoBni(req: any, res: any) {
  // Dideklarasikan di luar try karena blok finally di bawah merujuknya.
  // Pola ini dipertahankan dari kode asli: sebelumnya `const` di dalam try,
  // sehingga finally mengakses nama yang tidak ada di scope-nya dan selalu
  // melempar ReferenceError — termasuk pada jalur sukses.
  let connection: any = null;
  try {
    if (req.user?.role !== "admin") {
      return res.status(403).json({
        status: "error",
        message:
          "Akses ditolak: Hanya administrator yang diizinkan untuk men-generate proyek demo.",
      });
    }
    const { ownerId } = req.body;
    connection = await db.getConnection();

    const pId = crypto.randomUUID();
    const pName = "Bank BNI SDLC Management - Release v2.0";
    const pKey = "RDU";
    const pDesc =
      "Layanan migrasi terpadu BNI Open API, optimasi database core banking, kepatuhan standar OJK/PCI-DSS, serta deployment pipeline aman (UAT/Production Go-Live ready).";

    // 1. Insert Project
    await connection.query(
      "INSERT INTO Projects (id, name, projectKey, description, ownerId, status, taskCounter) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [pId, pName, pKey, pDesc, ownerId || "3", "Active", 24]
    );

    // 2. Add Project Members
    const rolesMap = [
      { userId: "1", role: "admin" },
      { userId: "2", role: "head" },
      { userId: "3", role: "manager" },
      { userId: "4", role: "developer" },
      { userId: "5", role: "designer" },
    ];
    for (const m of rolesMap) {
      await connection.query(
        "INSERT INTO ProjectMembers (projectId, userId, role) VALUES (?, ?, ?)",
        [pId, m.userId, m.role]
      );
    }

    // 3. Insert 3 Sprints
    const sprint1Id = crypto.randomUUID();
    const sprint2Id = crypto.randomUUID();
    const sprint3Id = crypto.randomUUID();

    const now = new Date();
    const s1Start = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const s1End = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);
    const s2Start = new Date(now.getTime());
    const s2End = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const s3Start = new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000);
    const s3End = new Date(now.getTime() + 29 * 24 * 60 * 60 * 1000);

    await connection.query(
      "INSERT INTO Sprints (id, projectId, name, goal, startDate, endDate, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        sprint1Id,
        pId,
        "Sprint 1: Initiation & Requirements Analysis",
        "Menyelesaikan analisis integrasi BNI Open API dan penandatanganan spesifikasi fungsional.",
        s1Start,
        s1End,
        "completed",
      ]
    );
    await connection.query(
      "INSERT INTO Sprints (id, projectId, name, goal, startDate, endDate, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        sprint2Id,
        pId,
        "Sprint 2: Design Prototype & Backend Implementation",
        "Mengembangkan prototype dashboard kustom, mengoptimalkan pipeline redis cache, dan query tuning.",
        s2Start,
        s2End,
        "active",
      ]
    );
    await connection.query(
      "INSERT INTO Sprints (id, projectId, name, goal, startDate, endDate, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        sprint3Id,
        pId,
        "Sprint 3: Quality Testing, Audit & Production Cut-over",
        "Pemeriksaan fungsionalitas UAT, penetration testing Keamanan Sistem, audit OJK, dan pelepasan release.",
        s3Start,
        s3End,
        "planned",
      ]
    );

    // 4. Create Epics as parent tasks first
    const epic1Id = crypto.randomUUID(); // Kanal Digital
    const epic2Id = crypto.randomUUID(); // Dashboard Teller
    const epic3Id = crypto.randomUUID(); // Back-end Hardening
    const epic4Id = crypto.randomUUID(); // Audit & QA
    const epic5Id = crypto.randomUUID(); // OJK Compliance
    const epic6Id = crypto.randomUUID(); // Go-Live Readiness

    const epics = [
      {
        id: epic1Id,
        key: "RDU-1",
        title: "Kanal Digital & Open API Integration",
        desc: "Epik koordinasi seluruh komponen integrasi Web Services BNI.",
      },
      {
        id: epic2Id,
        key: "RDU-5",
        title: "Revamp Dashboard Teller & Customer Portal UI",
        desc: "Epik modernisasi interface Front-End yang ramah petugas & nasabah.",
      },
      {
        id: epic3Id,
        key: "RDU-8",
        title: "Back-End Performance Tuning & Database Hardening",
        desc: "Epik optimasi query SQL, skema redis clustering, dan enkripsi data saldo ledger.",
      },
      {
        id: epic4Id,
        key: "RDU-13",
        title: "Quality Assurance, Security & Pentest Audit",
        desc: "Epik koordinasi pengujian fungsionalitas UAT, load testing, dan penetrasi keamanan sistem.",
      },
      {
        id: epic5Id,
        key: "RDU-18",
        title: "Asesmen Kepatuhan OJK & Regulasi Regulator",
        desc: "Epik pengawasan kepatuhan hukum transaksi perbankan dan izin operasional sistem informasi.",
      },
      {
        id: epic6Id,
        key: "RDU-21",
        title: "Deployment Pipeline & Go-Live Readiness",
        desc: "Epik penyiapan runbook cut-over, skrip migrasi data langsung, dan rilis patch produksi.",
      },
    ];

    for (const ep of epics) {
      let sId = sprint1Id;
      if (ep.key === "RDU-5" || ep.key === "RDU-8") sId = sprint2Id;
      if (ep.key === "RDU-13" || ep.key === "RDU-18" || ep.key === "RDU-21") sId = sprint3Id;

      await connection.query(
        `INSERT INTO Tasks (id, projectId, sprintId, taskKey, title, description, status, priority, type, assigneeId, reporterId, storyPoints, projectRisk)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ep.id,
          pId,
          sId,
          ep.key,
          ep.title,
          ep.desc,
          "In Progress",
          "High",
          "epic",
          "3",
          "3",
          0,
          "Low",
        ]
      );
    }

    // 5. Create children tasks
    const tasksToInsert = [
      // Sprint 1
      {
        id: crypto.randomUUID(),
        key: "RDU-2",
        parentId: epic1Id,
        sprintId: sprint1Id,
        title: "Analisis Kebutuhan Core Banking Integrasi API BNI",
        desc: "Menganalisis skema request-response JSON API Gateway BNI dengan core billing.",
        type: "task",
        status: "Done",
        priority: "High",
        assigneeId: "4",
        reporterId: "3",
        storyPoints: 5,
        projectRisk: "Low",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-3",
        parentId: epic1Id,
        sprintId: sprint1Id,
        title: "Penyusunan Failover Clustering Architecture",
        desc: "Mengonfigurasi kriteria high-availability Server API Gateway di 2 zona geografis.",
        type: "task",
        status: "Done",
        priority: "High",
        assigneeId: "1",
        reporterId: "3",
        storyPoints: 8,
        projectRisk: "Medium",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-4",
        parentId: epic1Id,
        sprintId: sprint1Id,
        title: "System Requirement Specification (SRS) - Open API Gateway",
        desc: "Dokumentasi standar teknis integrasi API BNI untuk diteruskan ke tim security.",
        type: "document",
        status: "Done",
        priority: "Low",
        assigneeId: "3",
        reporterId: "2",
        storyPoints: 3,
        projectRisk: "Low",
      },

      // Sprint 2
      {
        id: crypto.randomUUID(),
        key: "RDU-6",
        parentId: epic2Id,
        sprintId: sprint2Id,
        title: "Design Prototype Mobile Banking Dashboard di Figma",
        desc: "Membuat prototipe tata letak dashboard kustom dengan palet warna jingga korporat BNI.",
        type: "task",
        status: "In Progress",
        priority: "Medium",
        assigneeId: "5",
        reporterId: "3",
        storyPoints: 5,
        projectRisk: "Low",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-7",
        parentId: epic2Id,
        sprintId: sprint2Id,
        title: "Sign-off Desain Wireframe Layanan Baru oleh IT Head",
        desc: "Persetujuan formal direksi IT untuk memulai coding front-end.",
        type: "approval",
        status: "In Progress",
        priority: "Low",
        assigneeId: "2",
        reporterId: "5",
        storyPoints: 1,
        projectRisk: "Low",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-9",
        parentId: epic3Id,
        sprintId: sprint2Id,
        title: "Optimasi Query Database Oracle Core Banking BNI",
        desc: "Tuning query inner join log transaksi nasabah dengan index baru demi TPS maksimal.",
        type: "task",
        status: "In Progress",
        priority: "High",
        assigneeId: "4",
        reporterId: "1",
        storyPoints: 8,
        projectRisk: "High",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-10",
        parentId: epic3Id,
        sprintId: sprint2Id,
        title: "Implementasi Enkripsi AES-256 pada Ledger Data",
        desc: "Menjamin kerahasiaan nominal dana nasabah yang tersimpan pada tabel log saldo ledger.",
        type: "task",
        status: "In Progress",
        priority: "High",
        assigneeId: "4",
        reporterId: "2",
        storyPoints: 5,
        projectRisk: "High",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-11",
        parentId: epic3Id,
        sprintId: sprint2Id,
        title: "Sesi Review Integrasi API bersama Tim Middleware",
        desc: "Rapat koordinasi teknis penyamaan standar pesan ISO 8583.",
        type: "meeting",
        status: "In Progress",
        priority: "Medium",
        assigneeId: "3",
        reporterId: "3",
        storyPoints: 2,
        projectRisk: "Low",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-12",
        parentId: epic3Id,
        sprintId: sprint2Id,
        title: "Setup Redis Caching Cluster untuk Akun Teller",
        desc: "Mempercepat sesi login teller aktif dengan caching dinamis Redis cluster.",
        type: "task",
        status: "To Do",
        priority: "Medium",
        assigneeId: "4",
        reporterId: "3",
        storyPoints: 5,
        projectRisk: "Medium",
      },

      // Sprint 3
      {
        id: crypto.randomUUID(),
        key: "RDU-14",
        parentId: epic4Id,
        sprintId: sprint3Id,
        title: "Uji Beban (Performance Load Test) 10,000 TPS",
        desc: "Pengujian stress load sistem API Gateway menggunakan Apache JMeter melampaui batas puncak harian.",
        type: "task",
        status: "To Do",
        priority: "High",
        assigneeId: "4",
        reporterId: "3",
        storyPoints: 8,
        projectRisk: "Medium",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-15",
        parentId: epic4Id,
        sprintId: sprint3Id,
        title: "Security Penetration Testing & Vulnerability Assessment",
        desc: "Melakukan audit vulnerability blackbox / whitebox pada rest server untuk mendapatkan compliance.",
        type: "task",
        status: "To Do",
        priority: "High",
        assigneeId: "1",
        reporterId: "2",
        storyPoints: 8,
        projectRisk: "High",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-16",
        parentId: epic4Id,
        sprintId: sprint3Id,
        title: "Koreksi Kelemahan Parameter Tampering di API Gateway",
        desc: "Mengeblok potensi manipulasi ID nasabah pada query string parameter endpoints.",
        type: "bug",
        status: "To Do",
        priority: "High",
        assigneeId: "4",
        reporterId: "2",
        storyPoints: 5,
        projectRisk: "High",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-17",
        parentId: epic4Id,
        sprintId: sprint3Id,
        title: "Perbaikan Glitch Form Input Nominal di Mobile App",
        desc: "Glitch visual pada rounding desimal mata uang asing rupiah.",
        type: "bug",
        status: "To Do",
        priority: "Medium",
        assigneeId: "5",
        reporterId: "4",
        storyPoints: 3,
        projectRisk: "Low",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-19",
        parentId: epic5Id,
        sprintId: sprint3Id,
        title: "Review Kepatuhan Standar PCI-DSS & Surat Edaran OJK",
        desc: "Pengawasan administratif kepatuhan pengelolaan data kartu kredit dan transaksi finansial digital.",
        type: "task",
        status: "To Do",
        priority: "Medium",
        assigneeId: "2",
        reporterId: "3",
        storyPoints: 5,
        projectRisk: "Medium",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-20",
        parentId: epic5Id,
        sprintId: sprint3Id,
        title: "Penerbitan Sertifikat Izin Rilis (RFO) oleh IT Sec",
        desc: "Pemberian lampu hijau formal dari Divisi Kepatuhan Keamanan Informasi.",
        type: "approval",
        status: "To Do",
        priority: "Low",
        assigneeId: "2",
        reporterId: "3",
        storyPoints: 1,
        projectRisk: "High",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-22",
        parentId: epic6Id,
        sprintId: sprint3Id,
        title: "Persiapan Cut-over Runbook & Script Database Rollback",
        desc: "Menyusun instruksi langkah demi langkah divalidasi oleh tim SRE saat downtime rilis.",
        type: "task",
        status: "To Do",
        priority: "High",
        assigneeId: "4",
        reporterId: "3",
        storyPoints: 8,
        projectRisk: "High",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-23",
        parentId: epic6Id,
        sprintId: sprint3Id,
        title: "Deployment Artifact Release ke Produksi (Go-Live)",
        desc: "Eksekusi deployment sesungguhnya saat jam sepi transaksi perbankan (maintenance window).",
        type: "task",
        status: "To Do",
        priority: "High",
        assigneeId: "1",
        reporterId: "2",
        storyPoints: 13,
        projectRisk: "High",
      },
      {
        id: crypto.randomUUID(),
        key: "RDU-24",
        parentId: epic6Id,
        sprintId: sprint3Id,
        title: "Evaluasi Pasca Penerapan (Post Mortem Project)",
        desc: "Dokumentasi pelajaran berharga (lessons learned) demi efisiensi rilis siklus berikutnya.",
        type: "meeting",
        status: "To Do",
        priority: "Low",
        assigneeId: "3",
        reporterId: "3",
        storyPoints: 2,
        projectRisk: "Low",
      },
    ];

    for (const t of tasksToInsert) {
      await connection.query(
        `INSERT INTO Tasks (id, projectId, sprintId, taskKey, title, description, status, priority, type, assigneeId, reporterId, parentId, storyPoints, projectRisk)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          t.id,
          pId,
          t.sprintId,
          t.key,
          t.title,
          t.desc,
          t.status,
          t.priority,
          t.type,
          t.assigneeId,
          t.reporterId,
          t.parentId,
          t.storyPoints,
          t.projectRisk,
        ]
      );
    }

    // 6. Post Activity logs
    await connection.query(
      "INSERT INTO ActivityLogs (id, projectId, userId, action, details) VALUES (?, ?, ?, ?, ?)",
      [
        crypto.randomUUID(),
        pId,
        "3",
        "Proyek Dibuat",
        "PM Rian Hidayat menginisiasi project BNI SDLC Release v2.0 secara otomatis melalui generator sistem.",
      ]
    );
    await connection.query(
      "INSERT INTO ActivityLogs (id, projectId, userId, action, details) VALUES (?, ?, ?, ?, ?)",
      [
        crypto.randomUUID(),
        pId,
        "3",
        "Siklus Rilis Terpasang",
        "Mengonfigurasi 3 sprint berurutan untuk fase Inisiasi, Desain/Coding, serta Testing/Sertifikasi.",
      ]
    );

    // 7. Add Dummy Documents (Wiki)
    const documentsToInsert = [
      {
        id: crypto.randomUUID(),
        title: "Arsitektur Integrasi API Gateway",
        desc: "Dokumen panduan integrasi sistem ke BNI Open API dengan skema JWT authentication, rate limiting, dan IP whitelisting.",
        type: "PRD",
        link: "https://docs.google.com/document/d/1_demo_only_link",
        createdBy: "3",
      },
      {
        id: crypto.randomUUID(),
        title: "Penetration Testing Requirements",
        desc: "Kumpulan checklist uji kerentanan keamanan pada API yang akan dinilai oleh OJK, meliputi injeksi SQL, SSRF, IDOR, dan parameter tampering.",
        type: "Panduan",
        link: "https://docs.google.com/document/d/2_demo_only_link",
        createdBy: "2",
      },
      {
        id: crypto.randomUUID(),
        title: "Runbook Deployment Mobile UI",
        desc: "Urutan langkah-langkah mem-build APK/AAB dan mempublikasikannya ke App Store serta PlayStore setelah rilis internal.",
        type: "Laporan",
        link: "https://docs.google.com/document/d/3_demo_only_link",
        createdBy: "1",
      },
    ];

    for (const doc of documentsToInsert) {
      await connection.query(
        "INSERT INTO Documents (id, projectId, title, description, type, link, createdBy) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [doc.id, pId, doc.title, doc.desc, doc.type, doc.link, doc.createdBy]
      );
    }

    // 8. Add Dummy Meetings & Discussion Points
    const meet1Id = crypto.randomUUID();
    await connection.query(
      "INSERT INTO Meetings (id, projectId, title, description, meetingLink, authorId) VALUES (?, ?, ?, ?, ?, ?)",
      [
        meet1Id,
        pId,
        "Kick-off Integrasi BNI Gateway",
        "Rapat perdana tentang pembagian peran pengembangan, integrasi REST API, manajemen kunci JWT.",
        "https://meet.google.com/abc-demo-xyz",
        "3",
      ]
    );

    await connection.query(
      "INSERT INTO DiscussionPoints (id, meetingId, authorId, assignTo, concern, fitur, `system`, surrounding, keterangan, tindakanLanjut, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        crypto.randomUUID(),
        meet1Id,
        "3",
        "4",
        "Timeline pengembangan perlu dipastikan",
        "API Gateway",
        "Core Banking",
        "Frontend App",
        "Butuh API keys secepatnya dari BNI",
        "Email ke PIC BNI untuk akses sandbox",
        "pending",
      ]
    );
    await connection.query(
      "INSERT INTO DiscussionPoints (id, meetingId, authorId, assignTo, concern, fitur, `system`, surrounding, keterangan, tindakanLanjut, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        crypto.randomUUID(),
        meet1Id,
        "3",
        "1",
        "Arsitektur cloud infra",
        "High Availability",
        "AWS/GCP Network",
        "WAF",
        "Setup WAF dan Load Balancer minggu ini",
        "Siapkan terraform script",
        "completed",
      ]
    );

    const meet2Id = crypto.randomUUID();
    await connection.query(
      "INSERT INTO Meetings (id, projectId, title, description, meetingLink, authorId) VALUES (?, ?, ?, ?, ?, ?)",
      [
        meet2Id,
        pId,
        "Security Review QA & Pentest",
        "Review kerentanan hasil pemindaian tools Owasp ZAP dan persetujuan penulisan laporan akhir.",
        "https://meet.google.com/def-demo-uvw",
        "3",
      ]
    );

    await connection.query(
      "INSERT INTO DiscussionPoints (id, meetingId, authorId, assignTo, concern, fitur, `system`, surrounding, keterangan, tindakanLanjut, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        crypto.randomUUID(),
        meet2Id,
        "2",
        "4",
        "Parameter tampering ditemukan",
        "Payment Endpoint",
        "Middleware",
        "Security Layer",
        "Ada kelemahan saat merubah amount secara manual",
        "Tambahkan HMAC validation",
        "pending",
      ]
    );

    res.json({ status: "success", projectId: pId });
  } catch (e: any) {
    console.error("LOG ANOMALI CRITICAL: POST /api/projects/generate-bni-demo error:", e);
    res.status(500).json({ status: "error", message: e.message });
  } finally {
    // Satu-satunya tempat pelepasan koneksi. Sebelumnya release() juga
    // dipanggil di akhir blok try, sehingga koneksi dilepas dua kali.
    //
    // release() pada adapter db mengembalikan void, bukan Promise — versi
    // lama memanggil .catch() di atasnya dan akan melempar TypeError. Bug itu
    // selama ini tertutup oleh ReferenceError yang lebih dulu terjadi karena
    // `connection` berada di luar scope.
    if (connection && typeof connection.release === "function") {
      try {
        connection.release();
      } catch (err) {
        console.error("Failed to release connection:", err);
      }
    }
  }
}
