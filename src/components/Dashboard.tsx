import React from "react";

const Dashboard = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="flex flex-col h-screen">
      <div className="h-screen flex bg-surface-sunken text-content overflow-hidden">{children}</div>
    </div>
  );
};

export default Dashboard;
