import { History, Mic, Settings, Sparkles } from 'lucide-react';
import { GenerationForm } from '@/components/Generation/GenerationForm';
import { HistoryTable } from '@/components/History/HistoryTable';
import { ConnectionForm } from '@/components/ServerSettings/ConnectionForm';
import { ServerStatus } from '@/components/ServerSettings/ServerStatus';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/toaster';
import { ProfileList } from '@/components/VoiceProfiles/ProfileList';

function App() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">voicebox</h1>
          <p className="text-muted-foreground">
            Production-quality Qwen3-TTS voice cloning and generation
          </p>
        </div>

        <Tabs defaultValue="profiles" className="space-y-4">
          <TabsList>
            <TabsTrigger value="profiles">
              <Mic className="mr-2 h-4 w-4" />
              Profiles
            </TabsTrigger>
            <TabsTrigger value="generate">
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="history">
              <History className="mr-2 h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profiles" className="space-y-4">
            <ProfileList />
          </TabsContent>

          <TabsContent value="generate" className="space-y-4">
            <GenerationForm />
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <HistoryTable />
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <ConnectionForm />
              <ServerStatus />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Toaster />
    </div>
  );
}

export default App;
