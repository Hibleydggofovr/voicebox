import { zodResolver } from '@hookform/resolvers/zod';
import { Mic, Monitor, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { useAudioPlayer } from '@/lib/hooks/useAudioPlayer';
import { useAudioRecording } from '@/lib/hooks/useAudioRecording';
import { useAddSample, useProfile } from '@/lib/hooks/useProfiles';
import { useSystemAudioCapture } from '@/lib/hooks/useSystemAudioCapture';
import { useTranscription } from '@/lib/hooks/useTranscription';
import { convertToWav, formatAudioDuration, getAudioDuration } from '@/lib/utils/audio';
import { usePlatform } from '@/platform/PlatformContext';
import { AudioSampleRecording } from './AudioSampleRecording';
import { AudioSampleSystem } from './AudioSampleSystem';
import { AudioSampleUpload } from './AudioSampleUpload';

const MAX_AUDIO_DURATION_SECONDS = 30;

const sampleSchema = z.object({
  file: z.instanceof(File, { message: 'Please select an audio file' }),
  referenceText: z
    .string()
    .min(1, 'Reference text is required')
    .max(1000, 'Reference text must be less than 1000 characters'),
});

type SampleFormValues = z.infer<typeof sampleSchema>;

interface SampleUploadProps {
  profileId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SampleUpload({ profileId, open, onOpenChange }: SampleUploadProps) {
  const platform = usePlatform();
  const addSample = useAddSample();
  const transcribe = useTranscription();
  const { data: profile } = useProfile(profileId);
  const { toast } = useToast();
  const [mode, setMode] = useState<'upload' | 'record' | 'system'>('upload');
  const [audioDuration, setAudioDuration] = useState<number | null>(null);
  const [isValidatingAudio, setIsValidatingAudio] = useState(false);
  const { isPlaying, playPause, cleanup: cleanupAudio } = useAudioPlayer();

  const form = useForm<SampleFormValues>({
    resolver: zodResolver(sampleSchema),
    defaultValues: {
      file: undefined,
      referenceText: '',
    },
  });

  const selectedFile = form.watch('file');
  const isAudioTooLong = audioDuration !== null && audioDuration > MAX_AUDIO_DURATION_SECONDS;

  useEffect(() => {
    let isCurrentValidation = true;

    if (selectedFile && selectedFile instanceof File) {
      const fileToValidate = selectedFile as File & { recordedDuration?: number };
      setIsValidatingAudio(true);
      setAudioDuration(null);
      form.clearErrors('file');

      getAudioDuration(fileToValidate)
        .then((duration) => {
          if (!isCurrentValidation) {
            return;
          }

          setAudioDuration(duration);
          if (duration > MAX_AUDIO_DURATION_SECONDS) {
            form.setError('file', {
              type: 'manual',
              message: `Audio too long (${formatAudioDuration(duration)}). Maximum is ${formatAudioDuration(MAX_AUDIO_DURATION_SECONDS)}.`,
            });
          } else {
            form.clearErrors('file');
          }
        })
        .catch((error) => {
          if (!isCurrentValidation) {
            return;
          }

          console.error('Failed to get audio duration:', error);
          setAudioDuration(null);
          const isRecordedFile =
            fileToValidate.name.startsWith('recording-') ||
            fileToValidate.name.startsWith('system-audio-');
          if (!isRecordedFile) {
            form.setError('file', {
              type: 'manual',
              message: 'Failed to read audio duration. Try a WAV, MP3, M4A, or FLAC file.',
            });
          } else {
            form.clearErrors('file');
          }
        })
        .finally(() => {
          if (isCurrentValidation) {
            setIsValidatingAudio(false);
          }
        });
    } else {
      setAudioDuration(null);
      form.clearErrors('file');
      setIsValidatingAudio(false);
    }

    return () => {
      isCurrentValidation = false;
    };
  }, [selectedFile, form]);

  const {
    isRecording,
    duration,
    error: recordingError,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecording({
    maxDurationSeconds: 29,
    onRecordingComplete: (blob, recordedDuration) => {
      // Convert blob to File object
      const file = new File([blob], `recording-${Date.now()}.webm`, {
        type: blob.type || 'audio/webm',
      }) as File & { recordedDuration?: number };
      // Store the actual recorded duration to bypass metadata reading issues on Windows
      if (recordedDuration !== undefined) {
        file.recordedDuration = recordedDuration;
      }
      form.setValue('file', file, { shouldValidate: true });
      toast({
        title: 'Recording complete',
        description: 'Audio has been recorded successfully.',
      });
    },
  });

  const {
    isRecording: isSystemRecording,
    duration: systemDuration,
    error: systemRecordingError,
    isSupported: isSystemAudioSupported,
    startRecording: startSystemRecording,
    stopRecording: stopSystemRecording,
    cancelRecording: cancelSystemRecording,
  } = useSystemAudioCapture({
    maxDurationSeconds: 29,
    onRecordingComplete: (blob, recordedDuration) => {
      // Convert blob to File object
      const file = new File([blob], `system-audio-${Date.now()}.wav`, {
        type: blob.type || 'audio/wav',
      }) as File & { recordedDuration?: number };
      // Store the actual recorded duration to bypass metadata reading issues on Windows
      if (recordedDuration !== undefined) {
        file.recordedDuration = recordedDuration;
      }
      form.setValue('file', file, { shouldValidate: true });
      toast({
        title: 'System audio captured',
        description: 'Audio has been captured successfully.',
      });
    },
  });

  // Show recording errors
  useEffect(() => {
    if (recordingError) {
      toast({
        title: 'Recording error',
        description: recordingError,
        variant: 'destructive',
      });
    }
  }, [recordingError, toast]);

  // Show system audio recording errors
  useEffect(() => {
    if (systemRecordingError) {
      toast({
        title: 'System audio capture error',
        description: systemRecordingError,
        variant: 'destructive',
      });
    }
  }, [systemRecordingError, toast]);

  async function handleTranscribe() {
    const file = form.getValues('file');
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select an audio file first.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const language = profile?.language as 'en' | 'zh' | undefined;
      const result = await transcribe.mutateAsync({ file, language });

      form.setValue('referenceText', result.text, { shouldValidate: true });
    } catch (error) {
      toast({
        title: 'Transcription failed',
        description: error instanceof Error ? error.message : 'Failed to transcribe audio',
        variant: 'destructive',
      });
    }
  }

  async function onSubmit(data: SampleFormValues) {
    try {
      const duration = await getAudioDuration(data.file as File & { recordedDuration?: number });
      if (duration > MAX_AUDIO_DURATION_SECONDS) {
        form.setError('file', {
          type: 'manual',
          message: `Audio too long (${formatAudioDuration(duration)}). Maximum is ${formatAudioDuration(MAX_AUDIO_DURATION_SECONDS)}.`,
        });
        toast({
          title: 'Invalid audio',
          description: `Sample must be ${formatAudioDuration(MAX_AUDIO_DURATION_SECONDS)} or shorter.`,
          variant: 'destructive',
        });
        return;
      }

      // Match create-profile behavior: normalize browser-supported uploads to WAV
      // before handing them to the backend. This avoids backend decoder failures
      // for formats like WebM/M4A while adding additional samples.
      let fileToUpload: File = data.file;
      if (!data.file.type.includes('wav') && !data.file.name.toLowerCase().endsWith('.wav')) {
        try {
          const wavBlob = await convertToWav(data.file);
          const wavName = data.file.name.replace(/\.[^.]+$/, '.wav');
          fileToUpload = new File([wavBlob], wavName, { type: 'audio/wav' });
        } catch {
          // If the browser can't decode the format, send the original and let the backend try.
        }
      }

      await addSample.mutateAsync({
        profileId,
        file: fileToUpload,
        referenceText: data.referenceText,
      });

      toast({
        title: 'Sample added',
        description: 'Audio sample has been added successfully.',
      });

      handleOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add sample',
        variant: 'destructive',
      });
    }
  }

  function resetSampleForm() {
    form.reset({
      file: undefined,
      referenceText: '',
    });
    setAudioDuration(null);
    setIsValidatingAudio(false);
  }

  function handleOpenChange(newOpen: boolean) {
    if (newOpen) {
      // Each add-sample session should start empty. Without an explicit reset,
      // React Hook Form can keep the previous File object around after the
      // nested dialog closes, making the next upload look stuck on that sample.
      resetSampleForm();
    } else {
      resetSampleForm();
      setMode('upload');
      if (isRecording) {
        cancelRecording();
      }
      if (isSystemRecording) {
        cancelSystemRecording();
      }
      cleanupAudio();
    }
    onOpenChange(newOpen);
  }

  function handleCancelRecording() {
    if (mode === 'record') {
      cancelRecording();
    } else if (mode === 'system') {
      cancelSystemRecording();
    }
    form.resetField('file');
    cleanupAudio();
  }

  function handlePlayPause() {
    const file = form.getValues('file');
    playPause(file);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Audio Sample</DialogTitle>
          <DialogDescription>
            Upload an audio file and provide the reference text that matches the audio.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={(event) => {
              // This dialog is rendered from inside the edit-profile form. React
              // portal submit events still bubble through the React tree, so stop
              // propagation or the parent profile form also submits and closes.
              event.stopPropagation();
              void form.handleSubmit(onSubmit)(event);
            }}
            className="space-y-4"
          >
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'upload' | 'record' | 'system')}>
              <TabsList
                className={`grid w-full ${platform.metadata.isTauri && isSystemAudioSupported ? 'grid-cols-3' : 'grid-cols-2'}`}
              >
                <TabsTrigger value="upload" className="flex items-center gap-2">
                  <Upload className="h-4 w-4 shrink-0" />
                  Upload
                </TabsTrigger>
                <TabsTrigger value="record" className="flex items-center gap-2">
                  <Mic className="h-4 w-4 shrink-0" />
                  Record
                </TabsTrigger>
                {platform.metadata.isTauri && isSystemAudioSupported && (
                  <TabsTrigger value="system" className="flex items-center gap-2">
                    <Monitor className="h-4 w-4 shrink-0" />
                    System Audio
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, name } }) => (
                    <AudioSampleUpload
                      file={selectedFile}
                      onFileChange={onChange}
                      onTranscribe={handleTranscribe}
                      onPlayPause={handlePlayPause}
                      isPlaying={isPlaying}
                      isValidating={isValidatingAudio}
                      isTranscribing={transcribe.isPending}
                      isDisabled={isAudioTooLong}
                      fieldName={name}
                    />
                  )}
                />
              </TabsContent>

              <TabsContent value="record" className="space-y-4">
                <FormField
                  control={form.control}
                  name="file"
                  render={() => (
                    <AudioSampleRecording
                      file={selectedFile}
                      isRecording={isRecording}
                      duration={duration}
                      onStart={startRecording}
                      onStop={stopRecording}
                      onCancel={handleCancelRecording}
                      onTranscribe={handleTranscribe}
                      onPlayPause={handlePlayPause}
                      isPlaying={isPlaying}
                      isTranscribing={transcribe.isPending}
                    />
                  )}
                />
              </TabsContent>

              {platform.metadata.isTauri && isSystemAudioSupported && (
                <TabsContent value="system" className="space-y-4">
                  <FormField
                    control={form.control}
                    name="file"
                    render={() => (
                      <AudioSampleSystem
                        file={selectedFile}
                        isRecording={isSystemRecording}
                        duration={systemDuration}
                        onStart={startSystemRecording}
                        onStop={stopSystemRecording}
                        onCancel={handleCancelRecording}
                        onTranscribe={handleTranscribe}
                        onPlayPause={handlePlayPause}
                        isPlaying={isPlaying}
                        isTranscribing={transcribe.isPending}
                      />
                    )}
                  />
                </TabsContent>
              )}
            </Tabs>

            <FormField
              control={form.control}
              name="referenceText"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reference Text</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter the exact text spoken in the audio..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={addSample.isPending || isValidatingAudio || isAudioTooLong}
              >
                {addSample.isPending ? 'Uploading...' : 'Add Sample'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
