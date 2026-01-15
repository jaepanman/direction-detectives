
export enum Direction {
  STRAIGHT = 'STRAIGHT',
  LEFT = 'LEFT',
  RIGHT = 'RIGHT'
}

export enum GameStatus {
  START = 'START',
  LISTENING = 'LISTENING',
  MOVING = 'MOVING',
  SUCCESS = 'SUCCESS',
  FAIL = 'FAIL'
}

export interface Position {
  x: number;
  z: number;
  rotation: number; // in degrees
}

export interface GameLevel {
  id: number;
  commandCount: number;
  commands: Direction[];
}
