import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// --- Mocks ---

vi.mock('./registry.js', () => ({ registerChannel: vi.fn() }));
vi.mock('../env.js', () => ({ readEnvFile: vi.fn(() => ({})) }));
vi.mock('../config.js', () => ({
  ASSISTANT_NAME: 'Andy',
  TRIGGER_PATTERN: /^@Andy\b/i,
}));
vi.mock('../logger.js', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// --- googleapis mock ---

const mockMessagesCreate = vi.fn().mockResolvedValue({});
const mockMessagesList = vi.fn().mockResolvedValue({ data: { messages: [] } });
const mockMembersList = vi.fn().mockResolvedValue({
  data: { memberships: [] },
});

vi.mock('googleapis', () => ({
  google: {
    auth: {
      GoogleAuth: class MockGoogleAuth {
        async getClient() {
          return { type: 'mock-auth-client' };
        }
      },
    },
    options: vi.fn(),
    chat: vi.fn(() => ({
      spaces: {
        messages: {
          create: mockMessagesCreate,
          list: mockMessagesList,
        },
        members: {
          list: mockMembersList,
        },
      },
    })),
  },
}));

import { GChatChannel, GChatChannelOpts } from './gchat.js';

// --- Test helpers ---

function createTestOpts(
  overrides?: Partial<GChatChannelOpts>,
): GChatChannelOpts {
  return {
    onMessage: vi.fn(),
    onChatMetadata: vi.fn(),
    registeredGroups: vi.fn(() => ({
      'gchat:SPACE123': {
        name: 'Engineering',
        folder: 'gchat_engineering',
        trigger: '@Andy',
        added_at: '2024-01-01T00:00:00.000Z',
      },
    })),
    ...overrides,
  };
}

// --- Tests ---

describe('GChatChannel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --- Connection lifecycle ---

  describe('connection lifecycle', () => {
    it('resolves connect() and sets connected state', async () => {
      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);

      await channel.connect();

      expect(channel.isConnected()).toBe(true);
    });

    it('isConnected() returns false before connect', () => {
      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);

      expect(channel.isConnected()).toBe(false);
    });

    it('disconnects cleanly', async () => {
      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);

      await channel.connect();
      expect(channel.isConnected()).toBe(true);

      await channel.disconnect();
      expect(channel.isConnected()).toBe(false);
    });
  });

  // --- ownsJid ---

  describe('ownsJid', () => {
    it('owns gchat: JIDs', () => {
      const channel = new GChatChannel('/path/to/key.json', createTestOpts());
      expect(channel.ownsJid('gchat:SPACE123')).toBe(true);
    });

    it('does not own tg: JIDs', () => {
      const channel = new GChatChannel('/path/to/key.json', createTestOpts());
      expect(channel.ownsJid('tg:123456')).toBe(false);
    });

    it('does not own WhatsApp JIDs', () => {
      const channel = new GChatChannel('/path/to/key.json', createTestOpts());
      expect(channel.ownsJid('12345@g.us')).toBe(false);
    });

    it('does not own unknown formats', () => {
      const channel = new GChatChannel('/path/to/key.json', createTestOpts());
      expect(channel.ownsJid('random-string')).toBe(false);
    });
  });

  // --- sendMessage ---

  describe('sendMessage', () => {
    it('sends message via Chat API', async () => {
      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      await channel.sendMessage('gchat:SPACE123', 'Hello world');

      expect(mockMessagesCreate).toHaveBeenCalledWith({
        parent: 'spaces/SPACE123',
        requestBody: { text: 'Hello world' },
      });
    });

    it('strips gchat: prefix and formats as spaces/<id>', async () => {
      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      await channel.sendMessage('gchat:ABC_DEF_123', 'Test');

      expect(mockMessagesCreate).toHaveBeenCalledWith({
        parent: 'spaces/ABC_DEF_123',
        requestBody: { text: 'Test' },
      });
    });

    it('splits messages exceeding 4096 characters', async () => {
      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      const longText = 'x'.repeat(5000);
      await channel.sendMessage('gchat:SPACE123', longText);

      expect(mockMessagesCreate).toHaveBeenCalledTimes(2);
      expect(mockMessagesCreate).toHaveBeenNthCalledWith(1, {
        parent: 'spaces/SPACE123',
        requestBody: { text: 'x'.repeat(4096) },
      });
      expect(mockMessagesCreate).toHaveBeenNthCalledWith(2, {
        parent: 'spaces/SPACE123',
        requestBody: { text: 'x'.repeat(904) },
      });
    });

    it('sends exactly one message at 4096 characters', async () => {
      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      await channel.sendMessage('gchat:SPACE123', 'y'.repeat(4096));

      expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
    });

    it('handles send failure gracefully', async () => {
      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      mockMessagesCreate.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        channel.sendMessage('gchat:SPACE123', 'Will fail'),
      ).resolves.toBeUndefined();
    });

    it('does nothing when API is not initialized', async () => {
      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);

      await channel.sendMessage('gchat:SPACE123', 'No API');

      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });
  });

  // --- Message polling ---

  describe('message polling', () => {
    it('polls registered gchat spaces for new messages', async () => {
      const timestamp = '2024-06-01T12:00:00.000Z';
      mockMessagesList.mockResolvedValueOnce({
        data: {
          messages: [
            {
              name: 'spaces/SPACE123/messages/msg001',
              createTime: timestamp,
              text: 'Hello from Google Chat',
              sender: {
                type: 'HUMAN',
                displayName: 'Alice',
                name: 'users/alice123',
              },
              thread: { name: 'spaces/SPACE123/threads/thread001' },
            },
          ],
        },
      });

      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      // Wait for initial poll to fire
      await vi.advanceTimersByTimeAsync(0);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'gchat:SPACE123',
        expect.objectContaining({
          id: 'msg001',
          chat_jid: 'gchat:SPACE123',
          sender: 'users/alice123',
          sender_name: 'Alice',
          content: 'Hello from Google Chat',
          timestamp,
          is_from_me: false,
          thread_id: 'thread001',
        }),
      );

      await channel.disconnect();
    });

    it('skips bot messages', async () => {
      mockMessagesList.mockResolvedValueOnce({
        data: {
          messages: [
            {
              name: 'spaces/SPACE123/messages/msg002',
              createTime: '2024-06-01T12:01:00.000Z',
              text: 'I am the bot response',
              sender: { type: 'BOT', displayName: 'Andy' },
              thread: { name: 'spaces/SPACE123/threads/thread001' },
            },
          ],
        },
      });

      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      await vi.advanceTimersByTimeAsync(0);

      expect(opts.onMessage).not.toHaveBeenCalled();
      await channel.disconnect();
    });

    it('skips messages without text', async () => {
      mockMessagesList.mockResolvedValueOnce({
        data: {
          messages: [
            {
              name: 'spaces/SPACE123/messages/msg003',
              createTime: '2024-06-01T12:02:00.000Z',
              text: undefined,
              sender: { type: 'HUMAN', displayName: 'Bob' },
            },
          ],
        },
      });

      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      await vi.advanceTimersByTimeAsync(0);

      expect(opts.onMessage).not.toHaveBeenCalled();
      await channel.disconnect();
    });

    it('emits chat metadata on each message', async () => {
      mockMessagesList.mockResolvedValueOnce({
        data: {
          messages: [
            {
              name: 'spaces/SPACE123/messages/msg004',
              createTime: '2024-06-01T12:03:00.000Z',
              text: 'Test',
              sender: { type: 'HUMAN', displayName: 'Carol' },
              thread: { name: 'spaces/SPACE123/threads/t1' },
            },
          ],
        },
      });

      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      await vi.advanceTimersByTimeAsync(0);

      expect(opts.onChatMetadata).toHaveBeenCalledWith(
        'gchat:SPACE123',
        '2024-06-01T12:03:00.000Z',
        'Engineering',
        'gchat',
        true,
      );

      await channel.disconnect();
    });

    it('translates bot @mention into trigger format', async () => {
      mockMessagesList.mockResolvedValueOnce({
        data: {
          messages: [
            {
              name: 'spaces/SPACE123/messages/msg005',
              createTime: '2024-06-01T12:04:00.000Z',
              text: '@Andy Bot what is the status?',
              sender: { type: 'HUMAN', displayName: 'Dave' },
              thread: { name: 'spaces/SPACE123/threads/t2' },
              annotations: [
                {
                  type: 'USER_MENTION',
                  startIndex: 0,
                  length: 9,
                  userMention: { type: 'BOT' },
                },
              ],
            },
          ],
        },
      });

      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      await vi.advanceTimersByTimeAsync(0);

      expect(opts.onMessage).toHaveBeenCalledWith(
        'gchat:SPACE123',
        expect.objectContaining({
          content: expect.stringContaining('@Andy'),
        }),
      );

      await channel.disconnect();
    });

    it('only polls registered gchat groups, ignoring other channels', async () => {
      const opts = createTestOpts({
        registeredGroups: vi.fn(() => ({
          'gchat:SPACE123': {
            name: 'Engineering',
            folder: 'gchat_engineering',
            trigger: '@Andy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
          'tg:999': {
            name: 'Telegram Group',
            folder: 'telegram_main',
            trigger: '@Andy',
            added_at: '2024-01-01T00:00:00.000Z',
          },
        })),
      });

      mockMessagesList.mockResolvedValue({ data: { messages: [] } });

      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      await vi.advanceTimersByTimeAsync(0);

      // Should only poll for the gchat space, not telegram
      expect(mockMessagesList).toHaveBeenCalledWith(
        expect.objectContaining({ parent: 'spaces/SPACE123' }),
      );
      expect(mockMessagesList).toHaveBeenCalledTimes(1);

      await channel.disconnect();
    });

    it('handles poll errors gracefully', async () => {
      mockMessagesList.mockRejectedValueOnce(new Error('API quota exceeded'));

      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      // Should not throw
      await vi.advanceTimersByTimeAsync(0);

      expect(opts.onMessage).not.toHaveBeenCalled();
      await channel.disconnect();
    });
  });

  // --- setTyping ---

  describe('setTyping', () => {
    it('is a no-op (Google Chat does not support typing indicators)', async () => {
      const opts = createTestOpts();
      const channel = new GChatChannel('/path/to/key.json', opts);
      await channel.connect();

      // Should not throw
      await expect(
        channel.setTyping('gchat:SPACE123', true),
      ).resolves.toBeUndefined();
    });
  });

  // --- Channel properties ---

  describe('channel properties', () => {
    it('has name "gchat"', () => {
      const channel = new GChatChannel('/path/to/key.json', createTestOpts());
      expect(channel.name).toBe('gchat');
    });
  });
});
