import React from "react";
import { Toaster } from "sonner";

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Toaster position="top-right" richColors />
      <div className="flex flex-col h-screen">
        <div className="h-screen flex bg-surface-sunken text-content overflow-hidden">
          {children}
        </div>
      </div>
    </>
  );
};
