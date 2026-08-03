// Custom hook for audio recording
import { useEffect, useRef, useState } from 'react';
import { alert } from '../utils/alert';
import {
  useAudioRecorder as useExpoAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // seconds
  audioUri: string | null;
  isLoading: boolean;
}

export function useAudioRecorder() {
  const recorder = useExpoAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    audioUri: null,
    isLoading: false,
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRecordingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (isRecordingRef.current) {
        recorder.stop().catch(() => {});
      }
    };
  }, [recorder]);

  const requestPermissions = async (): Promise<boolean> => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) {
      alert(
        'Permissão Necessária',
        'O VozDiária precisa acessar o microfone para gravar notas de voz.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  const startRecording = async (): Promise<void> => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    setState((prev) => ({ ...prev, isLoading: true, audioUri: null, duration: 0 }));

    try {
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      await recorder.prepareToRecordAsync();
      recorder.record();
      isRecordingRef.current = true;

      timerRef.current = setInterval(() => {
        setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
      }, 1000);

      setState((prev) => ({
        ...prev,
        isRecording: true,
        isPaused: false,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to start recording:', error);
      setState((prev) => ({ ...prev, isLoading: false }));
      alert('Erro', 'Não foi possível iniciar a gravação. Tente novamente.');
    }
  };

  const pauseRecording = async (): Promise<void> => {
    if (!isRecordingRef.current) return;
    recorder.pause();
    if (timerRef.current) clearInterval(timerRef.current);
    setState((prev) => ({ ...prev, isPaused: true }));
  };

  const resumeRecording = async (): Promise<void> => {
    if (!isRecordingRef.current) return;
    recorder.record();

    timerRef.current = setInterval(() => {
      setState((prev) => ({ ...prev, duration: prev.duration + 1 }));
    }, 1000);

    setState((prev) => ({ ...prev, isPaused: false }));
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!isRecordingRef.current) return null;

    setState((prev) => ({ ...prev, isLoading: true }));
    if (timerRef.current) clearInterval(timerRef.current);

    try {
      await recorder.stop();
      isRecordingRef.current = false;
      const uri = recorder.uri;

      setState((prev) => ({
        ...prev,
        isRecording: false,
        isPaused: false,
        isLoading: false,
        audioUri: uri,
      }));

      return uri;
    } catch (error) {
      console.error('Failed to stop recording:', error);
      isRecordingRef.current = false;
      setState((prev) => ({ ...prev, isLoading: false }));
      return null;
    }
  };

  const resetRecording = () => {
    setState({
      isRecording: false,
      isPaused: false,
      duration: 0,
      audioUri: null,
      isLoading: false,
    });
  };

  return {
    ...state,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    resetRecording,
  };
}
