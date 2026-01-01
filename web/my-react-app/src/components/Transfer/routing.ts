import type { Env } from './types';

export type Node =
  | { kind: 'evm'; env: Env; label: string; chainId?: number }
  | { kind: 'parachain'; env: Env; parachainId: number; label: string; name?: string };

export type Edge =
  | {
      kind: 'snowbridge';
      from: Node; // evm
      to: Node;   // parachain (typicky AssetHub)
      // tu neskôr doplníme token/asset constraints
    }
  | {
      kind: 'paraspell';
      from: Node; // parachain
      to: Node;   // parachain
      // tu neskôr doplníme token/asset constraints
    };

export type Route = {
  id: string;
  from: Node;
  to: Node;
  steps: Edge[];         // 1 alebo 2 (zat. budeme riešiť 1-2)
  label: string;         // čo zobrazíš v dropdown
  stepCount: number;
};
