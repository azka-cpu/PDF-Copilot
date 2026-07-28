"use client";

import { useRef, useState } from "react";

// Minimal typing for the non-standard SpeechRecognition API
interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike extends Event {
  results: { 0: { 0: SpeechRecognitionResultLike } }[];
}

export function useVoiceInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );
  const recognitionRef = useRef<any>(null);

  function start() {
    if (!supported) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return { listening, supported, start, stop };
}
