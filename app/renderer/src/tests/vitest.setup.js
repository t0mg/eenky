import { vi } from 'vitest';

// Mock window.api to simulate the Electron IPC bridge
window.api = {
  send: vi.fn(),
  receive: vi.fn(),
  invoke: vi.fn(),
  fs: {
    readFile: vi.fn().mockResolvedValue('Once upon a time...'),
    writeFile: vi.fn().mockResolvedValue(),
    exists: vi.fn().mockResolvedValue(true),
    unlink: vi.fn().mockResolvedValue(),
    stat: vi.fn().mockResolvedValue({ size: 1024, isFile: () => true }),
    mkdir: vi.fn().mockResolvedValue(),
    watch: vi.fn().mockResolvedValue(),
    unwatch: vi.fn().mockResolvedValue(),
    onWatcherEvent: vi.fn(),
  },
  path: {
    dirname: vi.fn((p) => p.split('/').slice(0, -1).join('/')),
    basename: vi.fn((p) => p.split('/').pop()),
    extname: vi.fn((p) => '.' + p.split('.').pop()),
    join: vi.fn((...args) => args.join('/')),
    relative: vi.fn((from, to) => to.replace(from + '/', '')),
    isAbsolute: vi.fn((p) => p.startsWith('/')),
    format: vi.fn((p) => p),
    parse: vi.fn((p) => ({ base: p })),
  }
};
