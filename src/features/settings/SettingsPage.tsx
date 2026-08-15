import React, { useState } from 'react';
import { Mail, MessageSquare } from 'lucide-react';
import { EmailConfigForm } from './components/EmailConfigForm';
import { WhatsAppConfigForm } from './components/WhatsAppConfigForm';
import { BroadcastMonitor } from './components/BroadcastMonitor';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email');

  const [emailConfig, setEmailConfig] = useState({
    host: '',
    port: '',
    username: '',
    password: '',
    encryption: 'SSL',
    senderName: '',
    subjectTemplate: '[LanPro] Task Assignment: {{task_key}}',
    bodyTemplate: 'Hi {{user_name}},\n\nYou have been assigned to task {{task_key}}: {{task_title}}.\nStatus: {{status}}\nProject: {{project_name}}\n\nPlease check the dashboard for details.'
  });

  const [waConfig, setWaConfig] = useState({
    provider: 'Local',
    endpoint: '',
    token: '',
    deviceId: '',
    senderNumber: '',
    messageTemplate: '*[LanPro] Task Assignment*\n\nHi {{user_name}},\n\nYou have been assigned to task *{{task_key}}*: {{task_title}}.\n_Status_: {{status}}\n_Project_: {{project_name}}\n\nPlease check the dashboard for details.'
  });

  return (
    <div className="w-full flex-1 flex flex-col p-3 md:p-5 min-h-0 overflow-hidden bg-surface-sunken/60 text-left">
      <div className="flex-1 flex flex-col min-h-0 bg-surface border border-border-subtle/80 rounded-lg shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border-subtle/80 bg-surface-sunken/80 shrink-0 flex items-center justify-between">
          <h1 className="text-xs font-medium text-content-strong uppercase tracking-wide">System Configuration & Integrations</h1>
        </div>
        
        <div className="flex-1 overflow-auto flex flex-col">
          {/* Tabs */}
          <div className="flex border-b border-border-subtle/80 px-5 bg-surface">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-medium transition-all border-b-2 cursor-pointer ${
                  activeTab === 'email' 
                  ? 'text-emerald-600 border-emerald-500 bg-emerald-50/30' 
                  : 'text-content-muted border-transparent hover:text-content-body'
              }`}
            >
              <Mail size={15} />
              Email Configuration
            </button>
            <button
              onClick={() => setActiveTab('whatsapp')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-medium transition-all border-b-2 cursor-pointer ${
                  activeTab === 'whatsapp' 
                  ? 'text-emerald-600 border-emerald-500 bg-emerald-50/30' 
                  : 'text-content-muted border-transparent hover:text-content-body'
              }`}
            >
              <MessageSquare size={15} />
              WhatsApp Gateway
            </button>
          </div>

          {/* Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 p-5">
            <div className="lg:col-span-5">
              {activeTab === 'email' ? (
                <EmailConfigForm formData={emailConfig} setFormData={setEmailConfig} />
              ) : (
                <WhatsAppConfigForm formData={waConfig} setFormData={setWaConfig} />
              )}
            </div>
            <div className="lg:col-span-7 border-l border-border-subtle/80 pl-5">
              <BroadcastMonitor 
                emailTemplate={{ subject: emailConfig.subjectTemplate, body: emailConfig.bodyTemplate }}
                waTemplate={waConfig.messageTemplate}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
