import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function TimerPage() {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [inputHours, setInputHours] = useState('');
  const [inputMinutes, setInputMinutes] = useState('');
  const [inputSeconds, setInputSeconds] = useState('');
  const [initialTime, setInitialTime] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Preload audio
    if (audioRef.current) {
      audioRef.current.load();
      audioRef.current.onerror = () => {
        console.error('Failed to load audio file');
        setAudioError(true);
      };
    }
  }, []);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTime((prevTime) => {
          if (prevTime <= 0) {
            setIsRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            // Play alarm sound when timer reaches zero
            if (audioRef.current && !audioError) {
              audioRef.current.play().catch(err => {
                console.error('Failed to play audio:', err);
                setAudioError(true);
              });
            }
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, audioError]);

  const handleStart = () => {
    const hours = parseInt(inputHours) || 0;
    const minutes = parseInt(inputMinutes) || 0;
    const seconds = parseInt(inputSeconds) || 0;
    const totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
    
    if (totalSeconds > 0) {
      setInitialTime(totalSeconds);
      setTime(totalSeconds);
      setIsRunning(true);
      setInputHours('');
      setInputMinutes('');
      setInputSeconds('');
    }
  };

  const handleStop = () => {
    setIsRunning(false);
  };

  const handleReset = () => {
    setIsRunning(false);
    setTime(0);
    setInitialTime(0);
    setInputHours('');
    setInputMinutes('');
    setInputSeconds('');
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calculate progress percentage for the circle
  const progress = initialTime > 0 ? ((initialTime - time) / initialTime) * 100 : 0;
  const circumference = 2 * Math.PI * 120; // radius = 120
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <>
      <Head>
        <title>timer | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8 rounded-2xl">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">timer</h1>
          </div>

          <div className="flex flex-col items-center space-y-8">
            <div className="relative w-48 h-48 sm:w-64 sm:h-64 rounded-full overflow-hidden">
              {/* Circular progress indicator */}
              <svg className="w-full h-full -rotate-90">
                {/* Background circle */}
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-200 dark:text-gray-800"
                />
                {/* Progress circle */}
                <circle
                  cx="128"
                  cy="128"
                  r="120"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="none"
                  className="text-gray-500 dark:text-gray-400"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              {/* Time display */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl sm:text-4xl">{formatTime(time)}</span>
              </div>
            </div>
            
            <div className="flex flex-col items-center space-y-4 w-full max-w-xs">
              <div className="flex space-x-2 w-full">
                <input
                  type="number"
                  value={inputHours}
                  onChange={(e) => setInputHours(e.target.value)}
                  placeholder="hours"
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isRunning}
                  min="0"
                />
                <input
                  type="number"
                  value={inputMinutes}
                  onChange={(e) => setInputMinutes(e.target.value)}
                  placeholder="minutes"
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isRunning}
                  min="0"
                  max="59"
                />
                <input
                  type="number"
                  value={inputSeconds}
                  onChange={(e) => setInputSeconds(e.target.value)}
                  placeholder="seconds"
                  className="w-full h-12 px-4 border border-outline bg-transparent hover:opacity-80 transition-opacity rounded-xl text-[var(--foreground)]"
                  disabled={isRunning}
                  min="0"
                  max="59"
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2 w-full">
                <button
                  onClick={handleStart}
                  disabled={isRunning || (!inputHours && !inputMinutes && !inputSeconds)}
                  className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  start
                </button>
                <button
                  onClick={handleStop}
                  disabled={!isRunning}
                  className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  stop
                </button>
                <button
                  onClick={handleReset}
                  className="px-6 py-3 border border-outline bg-transparent text-[var(--foreground)] hover:opacity-80 hover:bg-[var(--hover-bg,rgba(0,0,0,0.04))] hover:scale-105 hover:shadow-lg transition-all duration-150 rounded-xl text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* Hidden audio element for alarm sound */}
      <audio 
        ref={audioRef} 
        src="/alarmbeep.mp3" 
        preload="auto"
        onError={() => setAudioError(true)}
      />
    </>
  );
} 