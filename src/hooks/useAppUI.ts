import { useState } from "react";

/**
 * useAppUI
 * Manages UI layout toggle states
 * - Sidebar collapsed state
 * - Mobile menu visibility
 * - Quick create form visibility
 */
export const useAppUI = () => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  return {
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isQuickCreateOpen,
    setIsQuickCreateOpen,
  };
};
