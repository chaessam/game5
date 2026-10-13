/// <reference lib="webworker" />
// 밸런스 측정은 오래 걸리므로 화면이 멈추지 않게 워커에서 돌린다.
import { DEFAULT_CONFIG } from '../engine/data';
import { runBattle, formatBattleLog } from '../engine';
import { META_DECKS } from '../sim/decks';
import { buildComp, placements, powerTable, randomField } from '../sim/arena';

export type WorkerRequest =
  | { kind: 'measure'; quick: boolean }
  | { kind: 'battle'; a: string; b: string; showBasic: boolean };

export type WorkerResponse =
  | { kind: 'progress'; label: string; done: number; total: number }
  | { kind: 'power'; report: ReturnType<typeof powerTable> }
  | { kind: 'field'; report: ReturnType<typeof randomField> }
  | { kind: 'done'; seconds: number }
  | { kind: 'battle'; log: string };

const post = (m: WorkerResponse) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const req = ev.data;
  if (req.kind === 'battle') {
    const a = placements(buildComp(META_DECKS[req.a], 8, 50).pieces, 1, 7)[0];
    const b = placements(buildComp(META_DECKS[req.b], 8, 50).pieces, 1, 8)[0];
    const r = runBattle(a, b, { log: true });
    post({ kind: 'battle', log: formatBattleLog(r, { hideBasic: !req.showBasic }) });
    return;
  }
  const t0 = performance.now();
  const p = powerTable(META_DECKS, DEFAULT_CONFIG, 8, 50, req.quick ? 2 : 4, (done, total) =>
    post({ kind: 'progress', label: '대표 덱 파워 지수', done, total }),
  );
  post({ kind: 'power', report: p });
  const f = randomField(DEFAULT_CONFIG, { comps: req.quick ? 150 : 500, opponents: req.quick ? 20 : 40 }, (done, total) => {
    if (done % 10 === 0 || done === total) post({ kind: 'progress', label: '무작위 덱 필드', done, total });
  });
  post({ kind: 'field', report: f });
  post({ kind: 'done', seconds: (performance.now() - t0) / 1000 });
};
