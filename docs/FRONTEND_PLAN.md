# Frontend Implementation Plan

Complete plan for building the voicebox frontend with modern React, TypeScript, shadcn/ui, and full type safety.

---

## Technology Stack

### Core
- **React 18** - UI framework with concurrent features
- **TypeScript (strict mode)** - Full type safety
- **Vite** - Fast build tool and dev server
- **Bun** - Package manager

### UI & Styling
- **shadcn/ui** - Headless component primitives (new-york style)
- **Tailwind CSS v4** - Utility-first styling
- **Radix UI** - Accessible primitives (via shadcn/ui)
- **Lucide React** - Icon system
- **class-variance-authority (cva)** - Component variants
- **tailwind-merge** - Smart class merging

### State Management
- **React Query v5** - Server state (API calls, caching)
- **Zustand** - Client state (UI state, modals, selections)
- **React Hook Form** - Form state and validation
- **Zod** - Runtime schema validation

### Audio
- **WaveSurfer.js** - Audio waveform visualization
- **Web Audio API** - Audio recording/playback
- **MediaRecorder API** - Voice recording

### Type Safety
- **OpenAPI TypeScript Codegen** - Generate API client from FastAPI schema
- **Zod** - Runtime validation matching backend Pydantic models
- **TypeScript strict mode** - Compiler enforcement

---

## Architecture Overview

```
app/src/
├── components/
│   ├── ui/                    # shadcn/ui primitives (auto-generated)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── form.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── slider.tsx
│   │   ├── table.tsx
│   │   ├── tabs.tsx
│   │   ├── card.tsx
│   │   ├── badge.tsx
│   │   ├── toast.tsx
│   │   └── ...
│   │
│   ├── VoiceProfiles/         # Voice profile management
│   │   ├── ProfileList.tsx
│   │   ├── ProfileCard.tsx
│   │   ├── ProfileForm.tsx
│   │   ├── SampleUpload.tsx
│   │   └── SampleList.tsx
│   │
│   ├── Generation/            # Voice generation
│   │   ├── GenerationForm.tsx
│   │   ├── GenerationPreview.tsx
│   │   └── GenerationSettings.tsx
│   │
│   ├── History/               # Generation history
│   │   ├── HistoryTable.tsx
│   │   ├── HistoryFilter.tsx
│   │   └── HistoryPlayer.tsx
│   │
│   ├── AudioStudio/           # Audio editing (Phase 3)
│   │   ├── Timeline.tsx
│   │   ├── Waveform.tsx
│   │   ├── Controls.tsx
│   │   └── TrackList.tsx
│   │
│   └── ServerSettings/        # Server connection
│       ├── ConnectionForm.tsx
│       ├── ServerStatus.tsx
│       └── LocalServerToggle.tsx
│
├── lib/
│   ├── api/                   # Generated OpenAPI client
│   │   ├── core/
│   │   ├── models/
│   │   └── services/
│   │       ├── ProfilesService.ts
│   │       ├── GenerationService.ts
│   │       └── HistoryService.ts
│   │
│   ├── hooks/                 # React Query hooks
│   │   ├── useProfiles.ts
│   │   ├── useGeneration.ts
│   │   ├── useHistory.ts
│   │   ├── useTranscription.ts
│   │   └── useServer.ts
│   │
│   ├── schemas/               # Zod schemas (match backend)
│   │   ├── profile.ts
│   │   ├── generation.ts
│   │   └── history.ts
│   │
│   └── utils/
│       ├── cn.ts              # Class name utility (shadcn)
│       ├── audio.ts           # Audio utilities
│       └── format.ts          # Formatting helpers
│
├── stores/                    # Zustand stores
│   ├── uiStore.ts            # UI state (modals, sidebar)
│   ├── playerStore.ts        # Audio player state
│   └── serverStore.ts        # Server connection state
│
├── types/                     # TypeScript types
│   ├── index.ts
│   ├── api.ts                # Augment generated types
│   └── tauri.ts              # Tauri-specific types
│
├── App.tsx                    # Main app component
├── main.tsx                   # Entry point
└── index.css                  # Global styles + Tailwind
```

---

## Setup Steps

### 1. Install shadcn/ui and Dependencies

```bash
cd app

# Core dependencies (if not installed)
bun add @tanstack/react-query zustand react-hook-form zod @hookform/resolvers wavesurfer.js

# shadcn/ui setup
bunx --bun shadcn-ui@latest init

# Select:
# - Style: new-york
# - Base color: slate (or zinc for darker theme)
# - CSS variables: yes
```

This creates:
- `components.json` - shadcn/ui configuration
- `components/ui/` - UI primitives directory
- Installs: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tailwindcss-animate`

### 2. Update Vite Config

**app/vite.config.ts:**
```typescript
import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 3. Update TypeScript Config

**app/tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,

    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### 4. Add Essential shadcn/ui Components

```bash
# Forms and inputs
bunx --bun shadcn-ui@latest add button
bunx --bun shadcn-ui@latest add input
bunx --bun shadcn-ui@latest add form
bunx --bun shadcn-ui@latest add label
bunx --bun shadcn-ui@latest add select
bunx --bun shadcn-ui@latest add textarea
bunx --bun shadcn-ui@latest add slider

# Layout and display
bunx --bun shadcn-ui@latest add card
bunx --bun shadcn-ui@latest add tabs
bunx --bun shadcn-ui@latest add separator
bunx --bun shadcn-ui@latest add badge
bunx --bun shadcn-ui@latest add avatar

# Feedback
bunx --bun shadcn-ui@latest add toast
bunx --bun shadcn-ui@latest add alert
bunx --bun shadcn-ui@latest add progress

# Overlays
bunx --bun shadcn-ui@latest add dialog
bunx --bun shadcn-ui@latest add dropdown-menu
bunx --bun shadcn-ui@latest add popover

# Data display
bunx --bun shadcn-ui@latest add table
bunx --bun shadcn-ui@latest add scroll-area
```

### 5. Setup Providers

**app/src/main.tsx:**
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>,
);
```

### 6. Setup Zustand Stores

**app/src/stores/uiStore.ts:**
```typescript
import { create } from 'zustand';

interface UIStore {
  // Sidebar
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;

  // Modals
  profileDialogOpen: boolean;
  setProfileDialogOpen: (open: boolean) => void;

  generationDialogOpen: boolean;
  setGenerationDialogOpen: (open: boolean) => void;

  // Theme
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  profileDialogOpen: false,
  setProfileDialogOpen: (open) => set({ profileDialogOpen: open }),

  generationDialogOpen: false,
  setGenerationDialogOpen: (open) => set({ generationDialogOpen: open }),

  theme: 'light',
  setTheme: (theme) => set({ theme }),
}));
```

**app/src/stores/serverStore.ts:**
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ServerStore {
  serverUrl: string;
  setServerUrl: (url: string) => void;

  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;

  mode: 'local' | 'remote';
  setMode: (mode: 'local' | 'remote') => void;
}

export const useServerStore = create<ServerStore>()(
  persist(
    (set) => ({
      serverUrl: 'http://localhost:8000',
      setServerUrl: (url) => set({ serverUrl: url }),

      isConnected: false,
      setIsConnected: (connected) => set({ isConnected: connected }),

      mode: 'local',
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'voicebox-server',
    },
  ),
);
```

---

## React Query Hooks

### useProfiles Hook

**app/src/lib/hooks/useProfiles.ts:**
```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProfilesService } from '@/lib/api/services/ProfilesService';
import type { VoiceProfileCreate, VoiceProfileResponse } from '@/lib/api/models';

export function useProfiles() {
  return useQuery({
    queryKey: ['profiles'],
    queryFn: () => ProfilesService.listProfiles(),
  });
}

export function useProfile(profileId: string) {
  return useQuery({
    queryKey: ['profiles', profileId],
    queryFn: () => ProfilesService.getProfile({ profileId }),
    enabled: !!profileId,
  });
}

export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: VoiceProfileCreate) =>
      ProfilesService.createProfile({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, data }: { profileId: string; data: VoiceProfileCreate }) =>
      ProfilesService.updateProfile({ profileId, data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['profiles', variables.profileId] });
    },
  });
}

export function useDeleteProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: string) =>
      ProfilesService.deleteProfile({ profileId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    },
  });
}

export function useAddSample() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      profileId,
      file,
      referenceText
    }: {
      profileId: string;
      file: File;
      referenceText: string;
    }) =>
      ProfilesService.addProfileSample({
        profileId,
        file,
        referenceText,
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['profiles', variables.profileId, 'samples']
      });
    },
  });
}
```

### useGeneration Hook

**app/src/lib/hooks/useGeneration.ts:**
```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GenerationService } from '@/lib/api/services/GenerationService';
import type { GenerationRequest } from '@/lib/api/models';

export function useGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: GenerationRequest) =>
      GenerationService.generateSpeech({ data }),
    onSuccess: () => {
      // Invalidate history to show new generation
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}
```

### useHistory Hook

**app/src/lib/hooks/useHistory.ts:**
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { HistoryService } from '@/lib/api/services/HistoryService';
import type { HistoryQuery } from '@/lib/api/models';

export function useHistory(query?: HistoryQuery) {
  return useQuery({
    queryKey: ['history', query],
    queryFn: () => HistoryService.listHistory(query),
  });
}

export function useGeneration(generationId: string) {
  return useQuery({
    queryKey: ['history', generationId],
    queryFn: () => HistoryService.getGeneration({ generationId }),
    enabled: !!generationId,
  });
}

export function useDeleteGeneration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (generationId: string) =>
      HistoryService.deleteGeneration({ generationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['history'] });
    },
  });
}
```

---

## Component Implementation

### Phase 1: Voice Profiles (Week 1)

#### ProfileList Component

**app/src/components/VoiceProfiles/ProfileList.tsx:**
```typescript
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Mic, Plus, Trash2 } from 'lucide-react';
import { useProfiles, useDeleteProfile } from '@/lib/hooks/useProfiles';
import { useUIStore } from '@/stores/uiStore';
import { ProfileForm } from './ProfileForm';

export function ProfileList() {
  const { data: profiles, isLoading } = useProfiles();
  const deleteProfile = useDeleteProfile();
  const setDialogOpen = useUIStore((state) => state.setProfileDialogOpen);

  if (isLoading) {
    return <div>Loading profiles...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Voice Profiles</h2>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Profile
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {profiles?.map((profile) => (
          <Card key={profile.id}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Mic className="h-5 w-5" />
                  {profile.name}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => deleteProfile.mutate(profile.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {profile.description}
              </p>
              <div className="mt-2 flex gap-2">
                <Badge variant="outline">{profile.language}</Badge>
                <Badge variant="secondary">
                  {profile.sample_count} samples
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <ProfileForm />
    </div>
  );
}
```

#### ProfileForm Component

**app/src/components/VoiceProfiles/ProfileForm.tsx:**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useCreateProfile } from '@/lib/hooks/useProfiles';
import { useUIStore } from '@/stores/uiStore';

const profileSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  language: z.enum(['en', 'zh']),
  tags: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export function ProfileForm() {
  const open = useUIStore((state) => state.profileDialogOpen);
  const setOpen = useUIStore((state) => state.setProfileDialogOpen);
  const createProfile = useCreateProfile();

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: '',
      description: '',
      language: 'en',
      tags: '',
    },
  });

  async function onSubmit(data: ProfileFormValues) {
    const tags = data.tags ? data.tags.split(',').map((t) => t.trim()) : [];

    await createProfile.mutateAsync({
      ...data,
      tags,
    });

    form.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Voice Profile</DialogTitle>
          <DialogDescription>
            Add a new voice profile with samples
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My Voice" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe this voice..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="zh">Chinese</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="tag1, tag2, tag3"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createProfile.isPending}
              >
                {createProfile.isPending ? 'Creating...' : 'Create Profile'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

### Phase 2: Generation (Week 2)

#### GenerationForm Component

**app/src/components/Generation/GenerationForm.tsx:**
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { useGeneration } from '@/lib/hooks/useGeneration';
import { useProfiles } from '@/lib/hooks/useProfiles';
import { useToast } from '@/hooks/use-toast';

const generationSchema = z.object({
  profileId: z.string().min(1, 'Please select a voice profile'),
  text: z.string().min(1, 'Text is required').max(5000),
  language: z.enum(['en', 'zh']),
  seed: z.number().int().optional(),
});

type GenerationFormValues = z.infer<typeof generationSchema>;

export function GenerationForm() {
  const { data: profiles } = useProfiles();
  const generation = useGeneration();
  const { toast } = useToast();

  const form = useForm<GenerationFormValues>({
    resolver: zodResolver(generationSchema),
    defaultValues: {
      profileId: '',
      text: '',
      language: 'en',
      seed: undefined,
    },
  });

  async function onSubmit(data: GenerationFormValues) {
    try {
      const result = await generation.mutateAsync({
        profile_id: data.profileId,
        text: data.text,
        language: data.language,
        seed: data.seed,
      });

      toast({
        title: 'Generation complete!',
        description: `Audio generated (${result.duration.toFixed(2)}s)`,
      });

      form.reset();
    } catch (error) {
      toast({
        title: 'Generation failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Speech</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="profileId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Voice Profile</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a voice" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {profiles?.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="text"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Text to Speak</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the text you want to generate..."
                      className="min-h-[200px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Max 5000 characters
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="language"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Language</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="seed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seed (optional)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Random"
                        {...field}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseInt(e.target.value) : undefined
                          )
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      For reproducible results
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={generation.isPending}
            >
              {generation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Speech'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

### Phase 3: History (Week 2)

#### HistoryTable Component

**app/src/components/History/HistoryTable.tsx:**
```typescript
import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Download, Trash2 } from 'lucide-react';
import { useHistory, useDeleteGeneration } from '@/lib/hooks/useHistory';
import { formatDistance } from 'date-fns';

export function HistoryTable() {
  const [page, setPage] = useState(0);
  const limit = 20;

  const { data: history, isLoading } = useHistory({
    limit,
    offset: page * limit,
  });

  const deleteGeneration = useDeleteGeneration();

  if (isLoading) {
    return <div>Loading history...</div>;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Generation History</h2>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Text</TableHead>
            <TableHead>Profile</TableHead>
            <TableHead>Language</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {history?.map((gen) => (
            <TableRow key={gen.id}>
              <TableCell className="max-w-[300px] truncate">
                {gen.text}
              </TableCell>
              <TableCell>{gen.profile_name}</TableCell>
              <TableCell>
                <Badge variant="outline">{gen.language}</Badge>
              </TableCell>
              <TableCell>{gen.duration.toFixed(2)}s</TableCell>
              <TableCell>
                {formatDistance(new Date(gen.created_at), new Date(), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon">
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteGeneration.mutate(gen.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          onClick={() => setPage((p) => p + 1)}
          disabled={!history || history.length < limit}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Setup, OpenAPI client, basic UI

1. **Day 1-2: Setup**
   - ✅ Install shadcn/ui and dependencies
   - ✅ Generate OpenAPI client
   - ✅ Setup providers (React Query, Toaster)
   - ✅ Create Zustand stores
   - ✅ Setup routing (if needed)

2. **Day 3-4: Voice Profiles**
   - ProfileList component
   - ProfileCard component
   - ProfileForm (create/edit)
   - Profile deletion
   - Sample upload UI

3. **Day 5-7: Testing & Polish**
   - Test all CRUD operations
   - Error handling
   - Loading states
   - Empty states

### Phase 2: Generation & History (Week 2)
**Goal:** Core voice generation functionality

1. **Day 1-3: Generation**
   - GenerationForm component
   - Real-time generation
   - Progress indication
   - Audio preview player
   - Download functionality

2. **Day 4-7: History**
   - HistoryTable component
   - Filtering and search
   - Pagination
   - Audio playback
   - Export functionality

### Phase 3: Audio Studio (Week 3-4)
**Goal:** Timeline editing and advanced features

1. **Week 3: Basic Studio**
   - Waveform visualization (WaveSurfer.js)
   - Timeline component
   - Playback controls
   - Multiple tracks

2. **Week 4: Advanced Features**
   - Word-level timestamps
   - Editing (trim, split)
   - Audio effects
   - Project save/load

### Phase 4: Polish & Features (Week 5+)
**Goal:** Production polish

1. **Server Settings**
   - Connection management
   - Local server toggle
   - Health monitoring

2. **UX Improvements**
   - Keyboard shortcuts
   - Drag and drop
   - Batch operations
   - Export options

---

## Type Safety Best Practices

### 1. OpenAPI Generated Types

```typescript
// Use generated types from @/lib/api/models
import type {
  VoiceProfileResponse,
  GenerationRequest,
  HistoryQuery,
} from '@/lib/api/models';

// Never use `any`
function handleProfile(profile: VoiceProfileResponse) {
  // Fully typed
}
```

### 2. Zod Schemas Match Backend

```typescript
// app/src/lib/schemas/profile.ts
import { z } from 'zod';

// Match backend Pydantic model
export const profileCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  language: z.enum(['en', 'zh']),
  tags: z.array(z.string()).optional(),
});

export type ProfileCreate = z.infer<typeof profileCreateSchema>;
```

### 3. React Hook Form with Zod

```typescript
const form = useForm<ProfileCreate>({
  resolver: zodResolver(profileCreateSchema),
});

// Fully typed, runtime validated
```

### 4. Type-Safe Event Handlers

```typescript
// Good
function handleSubmit(data: ProfileCreate) {
  // data is typed
}

// Bad
function handleSubmit(data: any) {
  // No type safety
}
```

---

## Performance Optimizations

### 1. React Query Configuration

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Don't refetch for 5 minutes
      gcTime: 1000 * 60 * 10,    // Keep unused data for 10 minutes
      retry: 1,                  // Only retry once
    },
  },
});
```

### 2. Component Code Splitting

```typescript
import { lazy } from 'react';

const AudioStudio = lazy(() => import('@/components/AudioStudio'));

// Lazy load heavy components
```

### 3. Virtualized Lists

For large history tables:
```bash
bunx --bun shadcn-ui@latest add table
```

Use with TanStack Virtual for performance.

### 4. Debounced Search

```typescript
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const [search, setSearch] = useState('');
const debouncedSearch = useDebouncedValue(search, 300);

// Use debouncedSearch in query
useHistory({ search: debouncedSearch });
```

---

## Testing Strategy

### Unit Tests (Vitest)

```bash
bun add -D vitest @testing-library/react @testing-library/jest-dom
```

**app/src/components/VoiceProfiles/ProfileCard.test.tsx:**
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileCard } from './ProfileCard';

describe('ProfileCard', () => {
  it('renders profile name', () => {
    render(<ProfileCard profile={{ name: 'Test Voice' }} />);
    expect(screen.getByText('Test Voice')).toBeInTheDocument();
  });
});
```

### Component Tests (Storybook - Optional)

```bash
bunx storybook@latest init
```

---

## Accessibility

shadcn/ui components are built on Radix UI with full accessibility:

- ✅ Keyboard navigation
- ✅ Screen reader support
- ✅ ARIA attributes
- ✅ Focus management

**Additional improvements:**
1. Add `aria-label` to icon buttons
2. Use semantic HTML (`<main>`, `<nav>`, `<section>`)
3. Ensure color contrast meets WCAG AA
4. Add loading announcements for screen readers

---

## Summary

**Tech Stack:**
- React 18 + TypeScript (strict)
- shadcn/ui + Radix UI
- React Query + Zustand
- React Hook Form + Zod
- Tailwind CSS v4
- WaveSurfer.js

**Type Safety:**
- ✅ OpenAPI generated client
- ✅ Zod runtime validation
- ✅ TypeScript strict mode
- ✅ No `any` types

**Implementation:**
- Phase 1: Voice Profiles (Week 1)
- Phase 2: Generation & History (Week 2)
- Phase 3: Audio Studio (Week 3-4)
- Phase 4: Polish (Week 5+)

**Next Steps:**
1. Run `bunx --bun shadcn-ui@latest init`
2. Generate OpenAPI client (`bun run generate:api`)
3. Add essential shadcn/ui components
4. Build ProfileList component
5. Test with backend

Ready to build a production-quality, type-safe voice cloning app! 🚀
