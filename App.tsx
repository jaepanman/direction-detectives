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

  const audioAvailability = useRef<Record<Direction, boolean>>({
    [Direction.STRAIGHT]: false,
    [Direction.LEFT]: false,
    [Direction.RIGHT]: false
  });

  const speakFallback = (text: string): Promise<void> => {
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.8;
      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();
      window.speechSynthesis.speak(utterance);
    });
  };

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
    const totalCommands = config.totalSteps; // Simplified generation
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

    await Promise.all([
        checkAudioFiles(),
        new Promise(r => setTimeout(r, 1500))
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

  const executeMove = (inputDir: Direction) => {
    if (status !== GameStatus.MOVING) return;

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
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') executeMove(Direction.STRAIGHT);
    else if (e.key === 'ArrowLeft') executeMove(Direction.LEFT);
    else if (e.key === 'ArrowRight') executeMove(Direction.RIGHT);
  }, [status, commandsForCurrentStep, movesMadeInStep, level, currentStep]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const replayStepAudio = async () => {
    if (isReplaying || status !== GameStatus.MOVING) return;
    setIsReplaying(true);
    await playSequence(commandsForCurrentStep);
    setIsReplaying(false);
  };

  const nextLevel = () => {
    if (level < 3) setLevel(prev => prev + 1);
    else setLevel(1);
  };

  const currentConfig = LEVEL_CONFIGS.find(c => c.id === level)!;

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#f0fdf4] font-sans">
      <Town playerPos={playerPos} targetPos={targetPos} status={status} />

      {/* Stats UI */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-white/90 p-4 rounded-3xl shadow-xl border-4 border-green-500 min-w-[180px] pointer-events-auto">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">🌟</span>
            <span className="text-xl font-black text-green-700">Level {level}</span>
          </div>
          <div className="text-xs font-bold text-green-600 uppercase tracking-widest mb-2">
            Step {currentStep + 1} of {currentConfig.totalSteps}
          </div>
          <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden border border-gray-300">
            <div 
              className="bg-green-500 h-full transition-all duration-500" 
              style={{ width: `${((currentStep) / currentConfig.totalSteps) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* On-Screen Controls */}
      {status === GameStatus.MOVING && (
        <div className="absolute bottom-8 left-0 w-full flex justify-center gap-4 px-4">
          <button 
            onClick={() => executeMove(Direction.LEFT)}
            className="w-24 h-24 bg-blue-500 rounded-3xl border-b-8 border-blue-700 flex flex-col items-center justify-center active:translate-y-2 active:border-b-0 transition-all text-white"
          >
            <i className="fas fa-arrow-left text-3xl mb-1"></i>
            <span className="text-[10px] font-black uppercase">Turn Left</span>
            <span className="text-[8px] opacity-80 italic">Hidari</span>
          </button>
          
          <button 
            onClick={() => executeMove(Direction.STRAIGHT)}
            className="w-28 h-28 bg-green-500 rounded-3xl border-b-8 border-green-700 flex flex-col items-center justify-center active:translate-y-2 active:border-b-0 transition-all text-white"
          >
            <i className="fas fa-arrow-up text-4xl mb-1"></i>
            <span className="text-xs font-black uppercase">Straight</span>
            <span className="text-[10px] opacity-80 italic">Massugu</span>
          </button>
          
          <button 
            onClick={() => executeMove(Direction.RIGHT)}
            className="w-24 h-24 bg-blue-500 rounded-3xl border-b-8 border-blue-700 flex flex-col items-center justify-center active:translate-y-2 active:border-b-0 transition-all text-white"
          >
            <i className="fas fa-arrow-right text-3xl mb-1"></i>
            <span className="text-[10px] font-black uppercase">Turn Right</span>
            <span className="text-[8px] opacity-80 italic">Migi</span>
          </button>
        </div>
      )}

      {/* Listen Again Button */}
      {status === GameStatus.MOVING && (
        <button 
          onClick={replayStepAudio}
          disabled={isReplaying}
          className={`absolute top-4 right-4 w-20 h-20 bg-yellow-400 rounded-full border-b-4 border-yellow-600 flex flex-col items-center justify-center active:scale-95 transition-all ${isReplaying ? 'opacity-50 animate-pulse' : ''}`}
        >
          <i className="fas fa-volume-up text-2xl text-yellow-900"></i>
          <span className="text-[8px] font-black uppercase text-yellow-900 mt-1">Listen</span>
        </button>
      )}

      {/* Loading Overlay */}
      {isPreloadingLevel && (
        <div className="absolute inset-0 bg-green-50 flex flex-col items-center justify-center z-50">
          <div className="w-20 h-20 border-8 border-green-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
          <h2 className="text-2xl font-black text-green-800 uppercase italic tracking-widest">Building Town...</h2>
        </div>
      )}

      {/* Game State Overlays */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {status === GameStatus.START && !isPreloadingLevel && (
          <div className="bg-white p-10 rounded-[50px] shadow-2xl border-8 border-yellow-400 text-center pointer-events-auto scale-animation">
            <div className="text-6xl mb-4">🗺️</div>
            <h2 className="text-4xl font-black text-yellow-600 mb-2 italic">READY?</h2>
            <p className="text-gray-600 mb-6 font-bold">Listen to the directions and find the Red House!</p>
            <button 
              onClick={startStep}
              className="bg-yellow-500 text-white font-black py-4 px-12 rounded-full text-2xl shadow-[0_8px_0_rgb(180,130,0)] active:translate-y-2 active:shadow-none transition-all"
            >
              START
            </button>
          </div>
        )}

        {status === GameStatus.LISTENING && (
          <div className="bg-white/90 p-10 rounded-full shadow-2xl border-4 border-blue-400 animate-pulse flex flex-col items-center">
            <i className="fas fa-ear-listen text-6xl text-blue-500 mb-2"></i>
            <span className="text-3xl font-black text-blue-800 uppercase italic">Listening...</span>
          </div>
        )}

        {status === GameStatus.SUCCESS && (
          <div className="bg-white p-10 rounded-[50px] shadow-2xl border-8 border-green-400 text-center pointer-events-auto">
            <div className="text-7xl mb-4">🥇</div>
            <h2 className="text-4xl font-black text-green-600 mb-2">AMAZING!</h2>
            <p className="text-gray-500 mb-6 font-bold">You reached the house!</p>
            <button 
              onClick={nextLevel}
              className="bg-green-500 text-white font-black py-4 px-12 rounded-full text-2xl shadow-[0_8px_0_rgb(20,100,20)] active:translate-y-2 active:shadow-none transition-all"
            >
              NEXT LEVEL
            </button>
          </div>
        )}

        {status === GameStatus.FAIL && (
          <div className="bg-white p-10 rounded-[50px] shadow-2xl border-8 border-red-400 text-center pointer-events-auto">
            <div className="text-7xl mb-4">🌀</div>
            <h2 className="text-4xl font-black text-red-600 mb-2">OH NO!</h2>
            <p className="text-gray-500 mb-6 font-bold">Listen carefully and try again!</p>
            <button 
              onClick={() => generateLevel(level)}
              className="bg-red-500 text-white font-black py-4 px-12 rounded-full text-2xl shadow-[0_8px_0_rgb(150,20,20)] active:translate-y-2 active:shadow-none transition-all"
            >
              RETRY
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes scale-animation {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .scale-animation { animation: scale-animation 2s infinite ease-in-out; }
      `}</style>
    </div>
  );
};

export default App;