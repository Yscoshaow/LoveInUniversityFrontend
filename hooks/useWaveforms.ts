import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { waveformApi } from '../lib/api';
import type {
  CustomWaveform,
  CustomWaveformListResponse,
  SaveCustomWaveformRequest,
  WaveformSection,
  PreviewWaveformResponse,
} from '../types';

// Query keys
export const waveformKeys = {
  all: ['waveforms'] as const,
  myList: () => [...waveformKeys.all, 'my'] as const,
  detail: (id: number) => [...waveformKeys.all, 'detail', id] as const,
  public: (params?: { limit?: number; offset?: number }) => [...waveformKeys.all, 'public', params] as const,
  defaultSection: () => [...waveformKeys.all, 'defaultSection'] as const,
};

// Get user's custom waveforms
export function useMyWaveforms() {
  return useQuery<CustomWaveformListResponse>({
    queryKey: waveformKeys.myList(),
    queryFn: () => waveformApi.getMyWaveforms(),
  });
}

// Get single waveform
export function useWaveform(id: number | null) {
  return useQuery<CustomWaveform>({
    queryKey: waveformKeys.detail(id!),
    queryFn: () => waveformApi.getWaveform(id!),
    enabled: id !== null,
  });
}

// Get public waveforms
export function usePublicWaveforms(params?: { limit?: number; offset?: number }) {
  return useQuery<CustomWaveformListResponse>({
    queryKey: waveformKeys.public(params),
    queryFn: () => waveformApi.getPublicWaveforms(params),
  });
}

// Get default section
export function useDefaultSection() {
  return useQuery<WaveformSection>({
    queryKey: waveformKeys.defaultSection(),
    queryFn: () => waveformApi.getDefaultSection(),
    staleTime: Infinity, // Default section doesn't change
  });
}

// Save waveform mutation
export function useSaveWaveform() {
  const queryClient = useQueryClient();

  return useMutation<CustomWaveform, Error, SaveCustomWaveformRequest>({
    mutationFn: (request) => waveformApi.saveWaveform(request),
    onSuccess: (data) => {
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: waveformKeys.myList() });
      // Update cache for this waveform
      queryClient.setQueryData(waveformKeys.detail(data.id), data);
    },
  });
}

// Delete waveform mutation
export function useDeleteWaveform() {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean; message: string }, Error, number>({
    mutationFn: (id) => waveformApi.deleteWaveform(id),
    onSuccess: (_, id) => {
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: waveformKeys.myList() });
      // Remove from cache
      queryClient.removeQueries({ queryKey: waveformKeys.detail(id) });
    },
  });
}

// Preview waveform mutation (no caching needed)
export function usePreviewWaveform() {
  return useMutation<PreviewWaveformResponse, Error, { sections: WaveformSection[] }>({
    mutationFn: (request) => waveformApi.previewWaveform(request),
  });
}
