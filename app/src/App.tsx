import { useState, useEffect } from 'react';
import { GenerationForm } from '@/components/Generation/GenerationForm';
import { HistoryTable } from '@/components/History/HistoryTable';
import { ConnectionForm } from '@/components/ServerSettings/ConnectionForm';
import { ServerStatus } from '@/components/ServerSettings/ServerStatus';
import { ModelManagement } from '@/components/ServerSettings/ModelManagement';
import { Toaster } from '@/components/ui/toaster';
import { ProfileList } from '@/components/VoiceProfiles/ProfileList';
import { Sidebar } from '@/components/Sidebar';
import { isTauri, startServer, stopServer } from '@/lib/tauri';

// Track if server is starting to prevent duplicate starts
let serverStarting = false;

function App() {
  const [activeTab, setActiveTab] = useState('profiles');
  const [serverReady, setServerReady] = useState(false);

  // Auto-start server when running in Tauri
  useEffect(() => {
    if (!isTauri() || serverStarting) {
      return;
    }

    serverStarting = true;
    console.log('Running in Tauri, starting bundled server...');

    startServer(false)
      .then(() => {
        console.log('Server is ready');
        setServerReady(true);
      })
      .catch((error) => {
        console.error('Failed to auto-start server:', error);
        serverStarting = false;
      });

    // Cleanup: stop server on actual unmount (not StrictMode remount)
    return () => {
      // In production builds, we want to stop the server on unmount
      // In dev mode, React StrictMode causes remounts, so we skip cleanup
      if (import.meta.env?.PROD) {
        stopServer().catch((error) => {
          console.error('Failed to stop server on cleanup:', error);
        });
        serverStarting = false;
      }
    };
  }, []);

  // Show loading screen while server is starting in Tauri
  if (isTauri() && !serverReady) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Starting server...</p>
        </div>
      </div>
    );
  }

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
