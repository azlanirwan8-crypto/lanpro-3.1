import { useState } from "react";

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
