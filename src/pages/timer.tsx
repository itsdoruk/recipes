import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function TimerPage() {
  const [time, setTime] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [inputHours, setInputHours] = useState('');
  const [inputMinutes, setInputMinutes] = useState('');
  const [initialTime, setInitialTime] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTime((prevTime) => {
          if (prevTime <= 0) {
            setIsRunning(false);
            if (timerRef.current) clearInterval(timerRef.current);
            // Play alarm sound when timer reaches zero
            if (audioRef.current) {
              audioRef.current.play();
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
  }, [isRunning]);

  const handleStart = () => {
    const hours = parseInt(inputHours) || 0;
    const minutes = parseInt(inputMinutes) || 0;
    const totalSeconds = (hours * 3600) + (minutes * 60);
    
    if (totalSeconds > 0) {
      setInitialTime(totalSeconds);
      setTime(totalSeconds);
      setIsRunning(true);
      setInputHours('');
      setInputMinutes('');
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
        <title>Timer | [recipes]</title>
      </Head>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl">timer</h1>
          </div>

          <div className="flex flex-col items-center space-y-8">
            <div className="relative w-48 h-48 sm:w-64 sm:h-64">
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
                  className="text-blue-500 dark:text-blue-400"
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
              <div className="flex space-x-4 w-full">
                <input
                  type="number"
                  value={inputHours}
                  onChange={(e) => setInputHours(e.target.value)}
                  placeholder="hours"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
                  disabled={isRunning}
                  min="0"
                />
                <input
                  type="number"
                  value={inputMinutes}
                  onChange={(e) => setInputMinutes(e.target.value)}
                  placeholder="minutes"
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-800 bg-transparent"
                  disabled={isRunning}
                  min="0"
                />
              </div>
              <div className="flex flex-wrap justify-center gap-2 w-full">
                <button
                  onClick={handleStart}
                  disabled={isRunning || (!inputHours && !inputMinutes)}
                  className="flex-1 min-w-[100px] px-4 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  start
                </button>
                <button
                  onClick={handleStop}
                  disabled={!isRunning}
                  className="flex-1 min-w-[100px] px-4 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  stop
                </button>
                <button
                  onClick={handleReset}
                  className="flex-1 min-w-[100px] px-4 py-2 border border-gray-200 dark:border-gray-800 hover:opacity-80 transition-opacity"
                >
                  reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
      {/* Hidden audio element for alarm sound */}
      <audio ref={audioRef} src="/alarmbeep.mp3" />
    </>
  );
} 