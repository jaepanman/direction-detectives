
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Town from './components/Town';
import { Direction, GameStatus, Position } from './types';
import { GRID_SIZE, TURN_ANGLE, AUDIO_FILES, DIRECTION_PHRASES, LEVEL_CONFIGS } from './constants';

const App: React.FC = () => {
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [playerPos, setPlayerPos] = useState<Position>({ x: 0, z: 0, rotation: 0 });
  const [targetPos, setTargetPos] = useState({ x: 0, z: -GRID_SIZE });
  
  const [fullPath, setFullPath] = useState<Direction[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [commandsForCurrentStep, setCommandsForCurrentStep] = useState<Direction[]>([]);
  const [movesMadeInStep, setMovesMadeInStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isPreloadingLevel, setIsPreloadingLevel] = useState(true);
  const [isReplaying, setIsReplaying] = useState(false);

  // Track if MP3s are actually available
  const audioAvailability = useRef<Record<Direction, boolean>>({
    [Direction.STRAIGHT]: false,
    [Direction.LEFT]: false,
    [Direction.RIGHT]: false
  });

  // Fallback TTS logic
  const speakFallback = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  };

  // Improved audio player with fallback
  const playAudioWithFallback = async (direction: Direction): Promise<void> => {
    const url = AUDIO_FILES[direction];
    const phrase = DIRECTION_PHRASES[direction];

    if (!audioAvailability.current[direction]) {
      return speakFallback(phrase);
    }

    return new Promise((resolve) => {
      const audio = new Audio(url);
      audio.onended = () => resolve();
      audio.onerror = () => {
        console.warn(`Audio failed for ${direction}, falling back to TTS`);
        audioAvailability.current[direction] = false;
        speakFallback(phrase).then(resolve);
      };
      
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          audioAvailability.current[direction] = false;
          speakFallback(phrase).then(resolve);
        });
      }
    });
  };

  const playSequence = async (commands: Direction[]) => {
    for (const cmd of commands) {
      await playAudioWithFallback(cmd);
      await new Promise(r => setTimeout(r, 600));
    }
  };

  const checkAudioFiles = async () => {
    const directions = [Direction.STRAIGHT, Direction.LEFT, Direction.RIGHT];
    const checks = directions.map(dir => {
      return new Promise<void>((resolve) => {
        const audio = new Audio();
        // Use a small timeout for the network check
        const timer = setTimeout(() => {
          audioAvailability.current[dir] = false;
          resolve();
        }, 1500);

        audio.addEventListener('canplaythrough', () => {
          clearTimeout(timer);
          audioAvailability.current[dir] = true;
          resolve();
        }, { once: true });

        audio.addEventListener('error', () => {
          clearTimeout(timer);
          audioAvailability.current[dir] = false;
          resolve();
        }, { once: true });

        audio.src = AUDIO_FILES[dir];
        audio.load();
      });
    });
    await Promise.all(checks);
  };

  const generateLevel = useCallback(async (lvl: number) => {
    setIsPreloadingLevel(true);
    setStatus(GameStatus.START);
    
    const config = LEVEL_CONFIGS.find(c => c.id === lvl) || LEVEL_CONFIGS[0];
    const totalCommands = config.commandCountPerStep * config.totalSteps;
    const path: Direction[] = [];
    
    let simX = 0;
    let simZ = 0;
    let simRot = 0;

    for (let i = 0; i < totalCommands; i++) {
      const possible: Direction[] = [Direction.STRAIGHT, Direction.STRAIGHT, Direction.LEFT, Direction.RIGHT];
      const move = possible[Math.floor(Math.random() * possible.length)];
      path.push(move);

      if (move === Direction.STRAIGHT) {
        const rad = (simRot * Math.PI) / 180;
        simX -= Math.sin(rad) * GRID_SIZE;
        simZ -= Math.cos(rad) * GRID_SIZE;
      } else if (move === Direction.LEFT) {
        simRot += TURN_ANGLE;
      } else if (move === Direction.RIGHT) {
        simRot -= TURN_ANGLE;
      }
    }

    setFullPath(path);
    setTargetPos({ x: Math.round(simX) + 2.5, z: Math.round(simZ) + 2.5 });
    setPlayerPos({ x: 0, z: 0, rotation: 0 });
    setCurrentStep(0);
    setMovesMadeInStep(0);

    // parallel check
    await Promise.all([
        checkAudioFiles(),
        new Promise(r => setTimeout(r, 2000)) // ensure 3D scene settles
    ]);

    setIsPreloadingLevel(false);
  }, []);

  useEffect(() => {
    generateLevel(level);
  }, [level, generateLevel]);

  const startStep = async () => {
    if (isPreloadingLevel) return;
    setLoading(true);
    setStatus(GameStatus.LISTENING);
    
    const config = LEVEL_CONFIGS.find(c => c.id === level)!;
    const startIndex = currentStep * config.commandCountPerStep;
    const stepCommands = fullPath.slice(startIndex, startIndex + config.commandCountPerStep);
    
    setCommandsForCurrentStep(stepCommands);
    setMovesMadeInStep(0);

    await playSequence(stepCommands);
    
    setLoading(false);
    setStatus(GameStatus.MOVING);
  };

  const replayStepAudio = async () => {
    if (isReplaying || status !== GameStatus.MOVING) return;
    setIsReplaying(true);
    await playSequence(commandsForCurrentStep);
    setIsReplaying(false);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (status !== GameStatus.MOVING) return;

    let inputDir: Direction | null = null;
    if (e.key === 'ArrowUp') inputDir = Direction.STRAIGHT;
    else if (e.key === 'ArrowLeft') inputDir = Direction.LEFT;
    else if (e.key === 'ArrowRight') inputDir = Direction.RIGHT;

    if (!inputDir) return;

    const expectedMove = commandsForCurrentStep[movesMadeInStep];

    if (inputDir === expectedMove) {
      setPlayerPos(prev => {
        let { x, z, rotation } = prev;
        if (inputDir === Direction.STRAIGHT) {
          const rad = (rotation * Math.PI) / 180;
          return { ...prev, x: x - Math.sin(rad) * GRID_SIZE, z: z - Math.cos(rad) * GRID_SIZE };
        } else if (inputDir === Direction.LEFT) {
          return { ...prev, rotation: rotation + TURN_ANGLE };
        } else {
          return { ...prev, rotation: rotation - TURN_ANGLE };
        }
      });

      const nextMovesCount = movesMadeInStep + 1;
      setMovesMadeInStep(nextMovesCount);

      if (nextMovesCount === commandsForCurrentStep.length) {
        const config = LEVEL_CONFIGS.find(c => c.id === level)!;
        if (currentStep + 1 === config.totalSteps) {
          setTimeout(() => setStatus(GameStatus.SUCCESS), 500);
        } else {
          setCurrentStep(prev => prev + 1);
          setStatus(GameStatus.LISTENING);
          setTimeout(startStep, 800);
        }
      }
    } else {
      setStatus(GameStatus.FAIL);
    }
  }, [status, commandsForCurrentStep, movesMadeInStep, level, currentStep]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const nextLevel = () => {
    if (level < 3) setLevel(prev => prev + 1);
    else setLevel(1);
  };

  const restartLevel = () => {
    generateLevel(level);
  };

  const currentConfig = LEVEL_CONFIGS.find(c => c.id === level)!;

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#f0fdf4]">
      <Town playerPos={playerPos} targetPos={targetPos} status={status} />

      {/* Progress UI */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
        <div className="bg-white/95 p-4 rounded-2xl shadow-xl border-4 border-green-500 pointer-events-auto min-w-[200px]">
          <h1 className="text-2xl font-black text-green-700 flex items-center justify-between">
            Level {level}
            <span className="text-sm font-bold bg-green-100 px-2 py-1 rounded-lg">Step {currentStep + 1}/{currentConfig.totalSteps}</span>
          </h1>
          <div className="w-full bg-gray-200 h-3 rounded-full mt-3 overflow-hidden border border-gray-300">
            <div 
              className="bg-green-500 h-full transition-all duration-500" 
              style={{ width: `${((currentStep) / currentConfig.totalSteps) * 100}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-2 font-bold uppercase tracking-wider">Goal: Red House</p>
        </div>

        <div className="flex flex-col gap-3 pointer-events-auto">
          {status === GameStatus.MOVING && (
            <button 
              onClick={replayStepAudio}
              disabled={isReplaying}
              className={`bg-white/95 p-4 rounded-2xl shadow-xl border-4 border-blue-500 flex flex-col items-center transition-all active:scale-95 ${isReplaying ? 'opacity-50 grayscale' : 'hover:bg-blue-50'}`}
              title="Listen Again"
            >
              <div className={`text-2xl text-blue-600 ${isReplaying ? 'animate-bounce' : ''}`}>
                <i className="fas fa-volume-up"></i>
              </div>
              <span className="text-[10px] text-blue-800 font-black uppercase mt-1">Listen Again</span>
            </button>
          )}

          <div className="bg-white/95 p-4 rounded-2xl shadow-xl border-4 border-blue-500 flex flex-col items-center">
            <div className="flex gap-2 mb-1">
              <kbd className="px-2 py-1 bg-gray-100 rounded border-b-4 border-gray-400 font-bold text-sm">↑</kbd>
              <kbd className="px-2 py-1 bg-gray-100 rounded border-b-4 border-gray-400 font-bold text-sm">←</kbd>
              <kbd className="px-2 py-1 bg-gray-100 rounded border-b-4 border-gray-400 font-bold text-sm">→</kbd>
            </div>
            <span className="text-[10px] text-blue-800 font-black uppercase">Move / Turn</span>
          </div>
        </div>
      </div>

      {/* Loading Screen Overlay */}
      {isPreloadingLevel && (
        <div className="absolute inset-0 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center z-50 pointer-events-auto">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 border-8 border-gray-200 rounded-full"></div>
            <div className="absolute inset-0 border-8 border-green-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          <h3 className="text-4xl font-black text-green-800 tracking-widest uppercase italic mb-2">Town Explorer</h3>
          <p className="text-lg text-green-600 font-bold uppercase tracking-widest animate-pulse">
            Checking sounds & path...
          </p>
          <p className="text-xs text-gray-400 mt-8 uppercase font-bold tracking-[0.2em]">Preparing the adventure</p>
        </div>
      )}

      {/* Overlays */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {status === GameStatus.START && !isPreloadingLevel && (
          <div className="bg-white p-10 rounded-[40px] shadow-2xl border-8 border-yellow-400 text-center pointer-events-auto max-w-sm transform hover:scale-105 transition-transform">
            <div className="text-6xl mb-4">🏠</div>
            <h2 className="text-5xl font-black text-yellow-600 mb-2 uppercase italic">Ready?</h2>
            <p className="text-lg text-gray-600 mb-8 font-bold leading-tight">
              Listen to the directions.<br/>Reach the red house in {currentConfig.totalSteps} steps!
            </p>
            <button 
              onClick={startStep}
              disabled={loading || isPreloadingLevel}
              className="bg-yellow-500 hover:bg-yellow-400 text-white font-black py-5 px-12 rounded-full text-3xl transition transform active:scale-95 shadow-[0_10px_0_rgb(202,138,4)] disabled:opacity-50"
            >
              GO!
            </button>
          </div>
        )}

        {status === GameStatus.LISTENING && (
          <div className="bg-white/95 p-12 rounded-[50px] shadow-2xl flex flex-col items-center border-4 border-blue-400 animate-pulse">
            <div className="text-8xl text-blue-500 mb-6 drop-shadow-lg">
              <i className="fas fa-volume-up"></i>
            </div>
            <p className="text-4xl font-black text-blue-800 tracking-tighter uppercase italic">Listening...</p>
            <p className="text-xl text-blue-400 mt-2 font-black uppercase tracking-widest">Pay Attention!</p>
          </div>
        )}

        {status === GameStatus.MOVING && movesMadeInStep < commandsForCurrentStep.length && (
           <div className="absolute bottom-20 flex flex-col items-center">
              <div className="bg-white/90 px-8 py-4 rounded-full shadow-2xl border-4 border-blue-500 flex gap-4">
                {Array.from({ length: commandsForCurrentStep.length }).map((_, i) => (
                  <div 
                    key={i} 
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-black border-2 transition-all ${
                      i < movesMadeInStep ? 'bg-green-500 border-green-700 text-white' : 'bg-gray-200 border-gray-400 text-gray-400'
                    }`}
                  >
                    {i < movesMadeInStep ? '✓' : '?'}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-white font-black text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] uppercase italic">Your turn to move!</p>
           </div>
        )}

        {status === GameStatus.SUCCESS && (
          <div className="bg-white p-12 rounded-[50px] shadow-2xl border-8 border-green-400 text-center pointer-events-auto animate-bounce">
            <div className="text-8xl mb-4">🏆</div>
            <h2 className="text-5xl font-black text-green-600 mb-2 uppercase italic">PERFECT!</h2>
            <p className="text-xl text-gray-600 mb-8 font-bold">You arrived at the house safely!</p>
            <button 
              onClick={nextLevel}
              className="bg-green-500 hover:bg-green-400 text-white font-black py-5 px-14 rounded-full text-3xl transition transform active:scale-95 shadow-[0_10px_0_rgb(22,101,52)]"
            >
              LEVEL {level === 3 ? 1 : level + 1}
            </button>
          </div>
        )}

        {status === GameStatus.FAIL && (
          <div className="bg-white p-10 rounded-[40px] shadow-2xl border-8 border-red-400 text-center pointer-events-auto">
            <div className="text-8xl mb-4 text-red-500">❌</div>
            <h2 className="text-5xl font-black text-red-600 mb-2 uppercase italic">WRONG WAY!</h2>
            <p className="text-xl text-gray-600 mb-8 font-bold italic">Listen carefully and try again.</p>
            <button 
              onClick={restartLevel}
              className="bg-red-500 hover:bg-red-400 text-white font-black py-5 px-14 rounded-full text-3xl transition transform active:scale-95 shadow-[0_10px_0_rgb(153,27,27)]"
            >
              RETRY
            </button>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 right-4 pointer-events-none opacity-40 text-white font-black italic text-xl uppercase tracking-tighter">
        Direction Detective
      </div>
    </div>
  );
};

export default App;
