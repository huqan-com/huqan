import Kernel = require('./kernel');

declare class KernelV2 {
  constructor(opts?: Record<string, unknown>);
  kernel: Kernel;
  learn(text: string, opts?: Record<string, unknown>): ReturnType<Kernel['learn']>;
  learnDocument(text: string, opts?: Record<string, unknown>): any;
  learnFromLLM(text: string, opts?: Record<string, unknown>): any;
  ask(question: string, opts?: Record<string, unknown>): ReturnType<Kernel['ask']>;
  verify(statement: string, opts?: Record<string, unknown>): ReturnType<Kernel['verify']>;
  reason(subject: string, opts?: Record<string, unknown>): ReturnType<Kernel['reason']>;
  compare(left: string, right: string, opts?: Record<string, unknown>): ReturnType<Kernel['compare']>;
  dream(opts?: Record<string, unknown>): ReturnType<Kernel['dream']>;
}

export = KernelV2;
