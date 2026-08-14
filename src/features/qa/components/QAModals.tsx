import React from "react";
import { QATestCase, QATestSuite } from "../types";
import { AddSuiteModal } from "../../../components/modals/AddSuiteModal";
import { AddCaseModal } from "../../../components/modals/AddCaseModal";
import { EditSuiteModal } from "../../../components/modals/EditSuiteModal";
import { EditCaseModal } from "../../../components/modals/EditCaseModal";
import { CreateBugTicketModal } from "../../../components/modals/CreateBugTicketModal";
import { DeleteConfirmationModal } from "../../../components/modals/DeleteConfirmationModal";

interface QAModalsProps {
  // Add Suite Modal
  isAddSuiteOpen: boolean;
  setIsAddSuiteOpen: (open: boolean) => void;
  newSuiteNameOnly: string;
  setNewSuiteNameOnly: (name: string) => void;
  newSuitePhaseOnly: "SIT" | "UAT" | "PTR";
  setNewSuitePhaseOnly: (phase: "SIT" | "UAT" | "PTR") => void;
  newSuiteAssignedTo: string;
  setNewSuiteAssignedTo: (assignedTo: string) => void;
  handleAddSuiteOnly: (e: React.FormEvent) => void;

  // Add Case Modal
  isAddCaseOpen: boolean;
  setIsAddCaseOpen: (open: boolean) => void;
  activeAddTab: "single" | "bulk";
  setActiveAddTab: (tab: "single" | "bulk") => void;
  newCaseTitle: string;
  setNewCaseTitle: (title: string) => void;
  newCasePriority: "High" | "Medium" | "Low" | "Critical";
  setNewCasePriority: (priority: "High" | "Medium" | "Low" | "Critical") => void;
  newCaseAssignedTo: string;
  setNewCaseAssignedTo: (assignedTo: string) => void;
  newCaseSteps: string;
  setNewCaseSteps: (steps: string) => void;
  newCaseExpected: string;
  setNewCaseExpected: (expected: string) => void;
  handleCreateManualTestCase: (e: React.FormEvent) => void;
  bulkUploadFile: File | null;
  setBulkUploadFile: (file: File | null) => void;
  handleBulkUploadTestCases: (e: React.FormEvent) => void;

  // Edit Suite Modal
  suiteToEdit: QATestSuite | null;
  setSuiteToEdit: (suite: QATestSuite | null) => void;
  suiteEditName: string;
  setSuiteEditName: (name: string) => void;
  suiteEditAssignedTo: string;
  setSuiteEditAssignedTo: (assignedTo: string) => void;
  submitEditSuite: () => void;

  // Edit Case Modal
  caseToEditInfo: QATestCase | null;
  setCaseToEditInfo: (tc: QATestCase | null) => void;
  caseEditTitle: string;
  setCaseEditTitle: (title: string) => void;
  caseEditSteps: string;
  setCaseEditSteps: (steps: string) => void;
  caseEditExpected: string;
  setCaseEditExpected: (expected: string) => void;
  caseEditPriority: "High" | "Medium" | "Low" | "Critical";
  setCaseEditPriority: (priority: "High" | "Medium" | "Low" | "Critical") => void;
  caseEditAssignedTo: string;
  setCaseEditAssignedTo: (assignedTo: string) => void;
  submitEditTestCaseInfo: () => void;

  // Delete Suite Modal
  suiteToDelete: QATestSuite | null;
  setSuiteToDelete: (suite: QATestSuite | null) => void;
  handleDeleteSuite: (id: string) => void;

  // Delete Case Modal
  caseToDelete: QATestCase | null;
  setCaseToDelete: (tc: QATestCase | null) => void;
  handleDeleteTestCase: (id: string) => void;

  // Create Bug Ticket Modal
  isCreateBugModalOpen: boolean;
  setIsCreateBugModalOpen: (open: boolean) => void;
  bugModalTestCase: QATestCase | null;
  setBugModalTestCase: (tc: QATestCase | null) => void;
  bugTitleInput: string;
  setBugTitleInput: (title: string) => void;
  bugSelectedParentId: string;
  setBugSelectedParentId: (parentId: string) => void;
  parentSearchTerm: string;
  setParentSearchTerm: (term: string) => void;
  bugPriorityInput: string;
  setBugPriorityInput: (priority: string) => void;
  bugAssigneeInput: string;
  setBugAssigneeInput: (assignee: string) => void;
  bugDescriptionInput: string;
  setBugDescriptionInput: (desc: string) => void;
  isSubmittingBug: boolean;
  handleSubmitCreateBugTicket: (e: React.FormEvent) => void;

  // Context & Members
  selectedSuiteId: string;
  suites: QATestSuite[];
  tasks: any[];
  projectMembers: any[];
  selectedProject: any;
}

const handleDownloadTemplateExcel = () => {
  const csvContent =
    "Judul,Deskripsi_Langkah,Hasil_Ekspektasi,Prioritas\n" +
    '"User Login Scenario","1. Buka URL login\n2. Input email & password valid\n3. Klik Tombol Login","Sistem berhasil mengarahkan ke Dashboard Utama","High"\n' +
    '"Filter Task Test","1. Masuk ke halaman daftar task\n2. Pilih status In Progress","Hanya task In Progress yang muncul","Medium"\n';

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Template_QA_Test_Cases.csv";
  a.click();
};

export const QAModals: React.FC<QAModalsProps> = ({
  isAddSuiteOpen,
  setIsAddSuiteOpen,
  newSuiteNameOnly,
  setNewSuiteNameOnly,
  newSuitePhaseOnly,
  setNewSuitePhaseOnly,
  newSuiteAssignedTo,
  setNewSuiteAssignedTo,
  handleAddSuiteOnly,
  isAddCaseOpen,
  setIsAddCaseOpen,
  activeAddTab,
  setActiveAddTab,
  newCaseTitle,
  setNewCaseTitle,
  newCasePriority,
  setNewCasePriority,
  newCaseAssignedTo,
  setNewCaseAssignedTo,
  newCaseSteps,
  setNewCaseSteps,
  newCaseExpected,
  setNewCaseExpected,
  handleCreateManualTestCase,
  bulkUploadFile,
  setBulkUploadFile,
  handleBulkUploadTestCases,
  suiteToEdit,
  setSuiteToEdit,
  suiteEditName,
  setSuiteEditName,
  suiteEditAssignedTo,
  setSuiteEditAssignedTo,
  submitEditSuite,
  caseToEditInfo,
  setCaseToEditInfo,
  caseEditTitle,
  setCaseEditTitle,
  caseEditSteps,
  setCaseEditSteps,
  caseEditExpected,
  setCaseEditExpected,
  caseEditPriority,
  setCaseEditPriority,
  caseEditAssignedTo,
  setCaseEditAssignedTo,
  submitEditTestCaseInfo,
  suiteToDelete,
  setSuiteToDelete,
  handleDeleteSuite,
  caseToDelete,
  setCaseToDelete,
  handleDeleteTestCase,
  isCreateBugModalOpen,
  setIsCreateBugModalOpen,
  bugModalTestCase,
  setBugModalTestCase,
  bugTitleInput,
  setBugTitleInput,
  bugSelectedParentId,
  setBugSelectedParentId,
  parentSearchTerm,
  setParentSearchTerm,
  bugPriorityInput,
  setBugPriorityInput,
  bugAssigneeInput,
  setBugAssigneeInput,
  bugDescriptionInput,
  setBugDescriptionInput,
  isSubmittingBug,
  handleSubmitCreateBugTicket,
  selectedSuiteId,
  suites,
  tasks,
  projectMembers,
  selectedProject,
}) => {
  const activeSuiteObj = suites.find((s) => s.id === selectedSuiteId);

  return (
    <>
      <AddSuiteModal
        isOpen={isAddSuiteOpen}
        onClose={() => setIsAddSuiteOpen(false)}
        suiteName={newSuiteNameOnly}
        onNameChange={setNewSuiteNameOnly}
        phase={newSuitePhaseOnly}
        onPhaseChange={setNewSuitePhaseOnly}
        assignedTo={newSuiteAssignedTo}
        onAssignedToChange={setNewSuiteAssignedTo}
        onSubmit={handleAddSuiteOnly}
      />

      <AddCaseModal
        isOpen={isAddCaseOpen}
        onClose={() => setIsAddCaseOpen(false)}
        activeSuite={activeSuiteObj || null}
        activeTab={activeAddTab}
        onTabChange={setActiveAddTab}
        caseTitle={newCaseTitle}
        onTitleChange={setNewCaseTitle}
        casePriority={newCasePriority}
        onPriorityChange={setNewCasePriority}
        caseAssignedTo={newCaseAssignedTo}
        onAssignedToChange={setNewCaseAssignedTo}
        caseSteps={newCaseSteps}
        onStepsChange={setNewCaseSteps}
        caseExpected={newCaseExpected}
        onExpectedChange={setNewCaseExpected}
        onSubmitSingle={handleCreateManualTestCase}
        uploadFile={bulkUploadFile}
        onFileChange={setBulkUploadFile}
        onSubmitBulk={handleBulkUploadTestCases}
        onDownloadTemplate={handleDownloadTemplateExcel}
      />

      <EditSuiteModal
        suite={suiteToEdit}
        onClose={() => setSuiteToEdit(null)}
        editName={suiteEditName}
        onNameChange={setSuiteEditName}
        editAssignedTo={suiteEditAssignedTo}
        onAssignedToChange={setSuiteEditAssignedTo}
        onSubmit={submitEditSuite}
      />

      <EditCaseModal
        testCase={caseToEditInfo}
        onClose={() => setCaseToEditInfo(null)}
        editTitle={caseEditTitle}
        onTitleChange={setCaseEditTitle}
        editSteps={caseEditSteps}
        onStepsChange={setCaseEditSteps}
        editExpected={caseEditExpected}
        onExpectedChange={setCaseEditExpected}
        editPriority={caseEditPriority}
        onPriorityChange={setCaseEditPriority}
        editAssignedTo={caseEditAssignedTo}
        onAssignedToChange={setCaseEditAssignedTo}
        onSubmit={submitEditTestCaseInfo}
      />

      <CreateBugTicketModal
        isOpen={isCreateBugModalOpen}
        onClose={() => {
          setIsCreateBugModalOpen(false);
          setBugModalTestCase(null);
        }}
        testCase={bugModalTestCase}
        titleInput={bugTitleInput}
        onTitleChange={setBugTitleInput}
        selectedParentId={bugSelectedParentId}
        onParentSelect={setBugSelectedParentId}
        parentSearchTerm={parentSearchTerm}
        onSearchTermChange={setParentSearchTerm}
        priorityInput={bugPriorityInput}
        onPriorityChange={setBugPriorityInput}
        assigneeInput={bugAssigneeInput}
        onAssigneeChange={setBugAssigneeInput}
        descriptionInput={bugDescriptionInput}
        onDescriptionChange={setBugDescriptionInput}
        isSubmitting={isSubmittingBug}
        onSubmit={handleSubmitCreateBugTicket}
        tasks={tasks}
        projectMembers={projectMembers}
        selectedProject={selectedProject}
      />

      <DeleteConfirmationModal
        isOpen={!!suiteToDelete}
        onClose={() => setSuiteToDelete(null)}
        title="Hapus Modul Suite"
        itemName={suiteToDelete?.name || ""}
        onConfirm={() => handleDeleteSuite(suiteToDelete?.id || "")}
      />

      <DeleteConfirmationModal
        isOpen={!!caseToDelete}
        onClose={() => setCaseToDelete(null)}
        title="Hapus Test Case"
        itemName={caseToDelete?.title || ""}
        onConfirm={() => handleDeleteTestCase(caseToDelete?.id || "")}
      />
    </>
  );
};
