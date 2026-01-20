import React, { useState, useEffect, useCallback, useRef } from 'react';
import Town from './components/Town';
import { Direction, GameStatus, Position } from './types';
import { GRID_SIZE, TURN_ANGLE, AUDIO_FILES, DIRECTION_PHRASES, LEVEL_CONFIGS } from './constants';

const App: React.FC = () => {
  const [level, setLevel] = useState(1);
  const [status, setStatus] = useState<GameStatus>(GameStatus.START);
  const [playerPos, setPlayerPos] = useState<Position>({ x: 0, z: 0, rotation: 0 });
  const [targetPos, setTargetPos] = useState({ x: 0, z: -GRID_SIZE });
  const [showHelp, setShowHelp] = useState(false);
  
  const [fullPath, setFullPath] = useState<Direction[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [commandsForCurrentStep, setCommandsForCurrentStep] = useState<Direction[]>([]);
  const [movesMadeInStep, setMovesMadeInStep] = useState(0);
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
      utterance.rate = 0.75;
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
        audio.addEventListener('canplaythrough', () => { clearTimeout(timer); audioAvailability.current[dir] = true; resolve(); }, { once: true });
        audio.addEventListener('error', () => { clearTimeout(timer); audioAvailability.current[dir] = false; resolve(); }, { once: true });
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
    const path: Direction[] = [];
    let simX = 0, simZ = 0, simRot = 0;

    for (let i = 0; i < config.totalSteps; i++) {
      const possible: Direction[] = [Direction.STRAIGHT, Direction.STRAIGHT, Direction.LEFT, Direction.RIGHT];
      const move = possible[Math.floor(Math.random() * possible.length)];
      path.push(move);
      if (move === Direction.STRAIGHT) {
        const rad = (simRot * Math.PI) / 180;
        simX -= Math.sin(rad) * GRID_SIZE;
        simZ -= Math.cos(rad) * GRID_SIZE;
      } else if (move === Direction.LEFT) simRot += TURN_ANGLE;
      else if (move === Direction.RIGHT) simRot -= TURN_ANGLE;
    }

    setFullPath(path);
    setTargetPos({ x: Math.round(simX) + 2.5, z: Math.round(simZ) + 2.5 });
    setPlayerPos({ x: 0, z: 0, rotation: 0 });
    setCurrentStep(0);
    setMovesMadeInStep(0);
    await Promise.all([checkAudioFiles(), new Promise(r => setTimeout(r, 1000))]);
    setIsPreloadingLevel(false);
  }, []);

  useEffect(() => { generateLevel(level); }, [level, generateLevel]);

  const startStep = async () => {
    if (isPreloadingLevel) return;
    setStatus(GameStatus.LISTENING);
    const config = LEVEL_CONFIGS.find(c => c.id === level)!;
    const startIndex = currentStep * config.commandCountPerStep;
    const stepCommands = fullPath.slice(startIndex, startIndex + config.commandCountPerStep);
    setCommandsForCurrentStep(stepCommands);
    setMovesMadeInStep(0);
    await playSequence(stepCommands);
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
        } else if (inputDir === Direction.LEFT) return { ...prev, rotation: rotation + TURN_ANGLE };
        else return { ...prev, rotation: rotation - TURN_ANGLE };
      });
      const nextMovesCount = movesMadeInStep + 1;
      setMovesMadeInStep(nextMovesCount);
      if (nextMovesCount === commandsForCurrentStep.length) {
        const config = LEVEL_CONFIGS.find(c => c.id === level)!;
        if (currentStep + 1 === config.totalSteps) setTimeout(() => setStatus(GameStatus.SUCCESS), 500);
        else { setCurrentStep(prev => prev + 1); setStatus(GameStatus.LISTENING); setTimeout(startStep, 800); }
      }
    } else setStatus(GameStatus.FAIL);
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowUp') executeMove(Direction.STRAIGHT);
    else if (e.key === 'ArrowLeft') executeMove(Direction.LEFT);
    else if (e.key === 'ArrowRight') executeMove(Direction.RIGHT);
  }, [status, commandsForCurrentStep, movesMadeInStep]);

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

  const nextLevel = () => { if (level < 3) setLevel(prev => prev + 1); else setLevel(1); };

  const currentConfig = LEVEL_CONFIGS.find(c => c.id === level)!;

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none bg-[#f0fdf4] font-sans">
      <Town playerPos={playerPos} targetPos={targetPos} status={status} />

      {/* Stats UI */}
      <div className="absolute top-4 left-4 pointer-events-none">
        <div className="bg-white/95 p-4 rounded-3xl shadow-xl border-4 border-green-500 min-w-[200px] pointer-events-auto">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">🌟</span>
            <span className="text-2xl font-black text-green-700">Level {level}</span>
          </div>
          <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-2 flex justify-between">
            <span>Step {currentStep + 1} / {currentConfig.totalSteps}</span>
            <span>{movesMadeInStep} / {commandsForCurrentStep.length} moves</span>
          </div>
          <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden border border-gray-300">
            <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${((currentStep) / currentConfig.totalSteps) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Help Toggle */}
      <button onClick={() => setShowHelp(true)} className="absolute bottom-4 left-4 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center text-blue-500 border-2 border-blue-200 active:scale-90 transition-all">
        <i className="fas fa-question text-xl"></i>
      </button>

      {/* Help Modal */}
      {showHelp && (
        <div className="absolute inset-0 bg-black/60 z-[100] flex items-center justify-center p-6 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
          <div className="bg-white p-8 rounded-[40px] max-w-md w-full shadow-2xl border-4 border-blue-400" onClick={e => e.stopPropagation()}>
            <h2 className="text-3xl font-black text-blue-600 mb-4 text-center">HOW TO PLAY</h2>
            <div className="space-y-4 text-gray-700">
              <div className="flex items-center gap-4 bg-green-50 p-3 rounded-2xl">
                <i className="fas fa-ear-listen text-2xl text-green-500"></i>
                <p className="font-bold">1. Listen to the teacher's voice.</p>
              </div>
              <div className="flex items-center gap-4 bg-blue-50 p-3 rounded-2xl">
                <i className="fas fa-hand-pointer text-2xl text-blue-500"></i>
                <p className="font-bold">2. Press the buttons in order.</p>
              </div>
              <div className="flex items-center gap-4 bg-red-50 p-3 rounded-2xl">
                <i className="fas fa-home text-2xl text-red-500"></i>
                <p className="font-bold">3. Find the Red House!</p>
              </div>
            </div>
            <button onClick={() => setShowHelp(false)} className="w-full mt-6 bg-blue-500 text-white font-black py-4 rounded-full text-xl shadow-lg active:translate-y-1">CLOSE</button>
          </div>
        </div>
      )}

      {/* On-Screen Controls */}
      {status === GameStatus.MOVING && (
        <div className="absolute bottom-10 left-0 w-full flex justify-center items-end gap-4 px-4">
          <button onClick={() => executeMove(Direction.LEFT)} className="w-24 h-24 bg-blue-500 rounded-3xl border-b-[10px] border-blue-700 flex flex-col items-center justify-center active:translate-y-2 active:border-b-0 transition-all text-white shadow-lg">
            <i className="fas fa-arrow-left text-4xl mb-1"></i>
            <span className="text-[10px] font-black uppercase">Turn Left</span>
            <span className="text-[8px] opacity-90 italic">Hidari</span>
          </button>
          <button onClick={() => executeMove(Direction.STRAIGHT)} className="w-32 h-32 bg-green-500 rounded-3xl border-b-[10px] border-green-700 flex flex-col items-center justify-center active:translate-y-2 active:border-b-0 transition-all text-white shadow-lg">
            <i className="fas fa-arrow-up text-5xl mb-1"></i>
            <span className="text-sm font-black uppercase">Straight</span>
            <span className="text-[10px] opacity-90 italic">Massugu</span>
          </button>
          <button onClick={() => executeMove(Direction.RIGHT)} className="w-24 h-24 bg-blue-500 rounded-3xl border-b-[10px] border-blue-700 flex flex-col items-center justify-center active:translate-y-2 active:border-b-0 transition-all text-white shadow-lg">
            <i className="fas fa-arrow-right text-4xl mb-1"></i>
            <span className="text-[10px] font-black uppercase">Turn Right</span>
            <span className="text-[8px] opacity-90 italic">Migi</span>
          </button>
        </div>
      )}

      {/* Replay Audio */}
      {status === GameStatus.MOVING && (
        <button onClick={replayStepAudio} disabled={isReplaying} className={`absolute top-4 right-4 w-20 h-20 bg-yellow-400 rounded-full border-b-4 border-yellow-600 flex flex-col items-center justify-center active:scale-90 transition-all shadow-lg ${isReplaying ? 'opacity-50 grayscale' : ''}`}>
          <i className="fas fa-volume-up text-3xl text-yellow-900"></i>
          <span className="text-[8px] font-black uppercase text-yellow-900 mt-1">Listen Again</span>
        </button>
      )}

      {/* Status Overlays */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {isPreloadingLevel && (
          <div className="bg-white/90 p-12 rounded-[50px] shadow-2xl flex flex-col items-center z-50">
            <div className="w-20 h-20 border-8 border-green-200 border-t-green-600 rounded-full animate-spin mb-6"></div>
            <h2 className="text-3xl font-black text-green-800 italic">Building Town...</h2>
          </div>
        )}
        {status === GameStatus.START && !isPreloadingLevel && (
          <div className="bg-white p-12 rounded-[50px] shadow-2xl border-8 border-yellow-400 text-center pointer-events-auto transform hover:scale-105 transition-transform">
            <div className="text-8xl mb-6">🗺️</div>
            <h2 className="text-5xl font-black text-yellow-600 mb-4 italic">READY?</h2>
            <p className="text-xl text-gray-600 mb-10 font-bold max-w-xs">Listen to the directions and find the <span className="text-red-500">Red House</span>!</p>
            <button onClick={startStep} className="bg-yellow-500 text-white font-black py-5 px-16 rounded-full text-3xl shadow-[0_10px_0_rgb(180,130,0)] active:translate-y-2 active:shadow-none transition-all">START!</button>
          </div>
        )}
        {status === GameStatus.LISTENING && (
          <div className="bg-white/95 p-12 rounded-full shadow-2xl border-4 border-blue-400 animate-bounce flex flex-col items-center">
            <i className="fas fa-ear-listen text-7xl text-blue-500 mb-4"></i>
            <span className="text-4xl font-black text-blue-800 uppercase italic">Listen...</span>
          </div>
        )}
        {status === GameStatus.SUCCESS && (
          <div className="bg-white p-12 rounded-[50px] shadow-2xl border-8 border-green-400 text-center pointer-events-auto">
            <div className="text-8xl mb-6">🏆</div>
            <h2 className="text-5xl font-black text-green-600 mb-4">AMAZING!</h2>
            <p className="text-xl text-gray-500 mb-10 font-bold italic">You are a Direction Detective!</p>
            <button onClick={nextLevel} className="bg-green-500 text-white font-black py-5 px-16 rounded-full text-3xl shadow-[0_10px_0_rgb(20,100,20)] active:translate-y-2 active:shadow-none transition-all">NEXT LEVEL</button>
          </div>
        )}
        {status === GameStatus.FAIL && (
          <div className="bg-white p-12 rounded-[50px] shadow-2xl border-8 border-red-400 text-center pointer-events-auto">
            <div className="text-8xl mb-6">😵</div>
            <h2 className="text-5xl font-black text-red-600 mb-4">OH NO!</h2>
            <p className="text-xl text-gray-500 mb-10 font-bold">Try one more time!</p>
            <button onClick={() => generateLevel(level)} className="bg-red-500 text-white font-black py-5 px-16 rounded-full text-3xl shadow-[0_10px_0_rgb(150,20,20)] active:translate-y-2 active:shadow-none transition-all">RETRY</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;