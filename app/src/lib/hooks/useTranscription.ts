import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export function useTranscription() {
  return useMutation({
    mutationFn: ({ file, language }: { file: File; language?: 'en' | 'zh' }) =>
      apiClient.transcribeAudio(file, language),
  });
}
