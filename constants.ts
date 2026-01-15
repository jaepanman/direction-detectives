
import { Direction } from './types';

export const GRID_SIZE = 5; // Distance of one block
export const TURN_ANGLE = 90;

export const DIRECTION_PHRASES: Record<Direction, string> = {
  [Direction.STRAIGHT]: "Go straight.",
  [Direction.LEFT]: "Turn left.",
  [Direction.RIGHT]: "Turn right."
};

export const AUDIO_FILES: Record<Direction, string> = {
  [Direction.STRAIGHT]: "./go-straight.mp3",
  [Direction.LEFT]: "./turn-left.mp3",
  [Direction.RIGHT]: "./turn-right.mp3"
};

export const LEVEL_CONFIGS = [
  { id: 1, commandCountPerStep: 1, totalSteps: 8 },
  { id: 2, commandCountPerStep: 2, totalSteps: 10 },
  { id: 3, commandCountPerStep: 3, totalSteps: 12 }
];
