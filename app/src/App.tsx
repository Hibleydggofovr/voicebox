import { useState } from 'react';
import { GenerationForm } from '@/components/Generation/GenerationForm';
import { HistoryTable } from '@/components/History/HistoryTable';
import { ConnectionForm } from '@/components/ServerSettings/ConnectionForm';
import { ServerStatus } from '@/components/ServerSettings/ServerStatus';
import { ModelManagement } from '@/components/ServerSettings/ModelManagement';
import { Toaster } from '@/components/ui/toaster';
import { ProfileList } from '@/components/VoiceProfiles/ProfileList';
import { Sidebar } from '@/components/Sidebar';

function App() {
  const [activeTab, setActiveTab] = useState('profiles');

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />
      
      <main className="flex-1 ml-20">
        <div className="container mx-auto px-8 py-8 max-w-7xl">
          {activeTab === 'profiles' && (
            <div className="space-y-4">
              <ProfileList />
            </div>
          )}

          {activeTab === 'generate' && (
            <div className="space-y-4">
              <GenerationForm />
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <HistoryTable />
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <ConnectionForm />
                <ServerStatus />
              </div>
              <ModelManagement />
            </div>
          )}
        </div>
      </main>

      <Toaster />
    </div>
  );
}

export default App;
