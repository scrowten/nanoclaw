import { google, chat_v1 } from 'googleapis';
import { GoogleAuth } from 'googleapis-common';

import { ASSISTANT_NAME, TRIGGER_PATTERN } from '../config.js';
import { readEnvFile } from '../env.js';
import { logger } from '../logger.js';
import { registerChannel, ChannelOpts } from './registry.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';

export interface GChatChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

const POLL_INTERVAL_MS = 3000;
const MAX_MESSAGE_LENGTH = 4096;

export class GChatChannel implements Channel {
  name = 'gchat';

  private auth: GoogleAuth;
  private chatApi: chat_v1.Chat | null = null;
  private opts: GChatChannelOpts;
  private connected = false;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private lastMessageTimestamps = new Map<string, string>();
  private botUserId: string | null = null;

  constructor(serviceAccountKeyPath: string, opts: GChatChannelOpts) {
    this.opts = opts;
    this.auth = new google.auth.GoogleAuth({
      keyFile: serviceAccountKeyPath,
      scopes: ['https://www.googleapis.com/auth/chat.bot'],
    });
  }

  async connect(): Promise<void> {
    const authClient = await this.auth.getClient();
    google.options({ auth: authClient as any });

    this.chatApi = google.chat({ version: 'v1' });

    // Get bot identity
    try {
      const me = await this.chatApi.spaces.members.list({
        parent: this.getFirstSpaceName(),
        filter: 'member.type = "BOT"',
        pageSize: 1,
      });
      if (me.data.memberships && me.data.memberships.length > 0) {
        const memberName = me.data.memberships[0].member?.name;
        if (memberName) {
          this.botUserId = memberName;
        }
      }
    } catch {
      logger.debug(
        'Could not resolve bot user ID — will filter by sender type',
      );
    }

    this.connected = true;
    this.startPolling();

    logger.info('Google Chat bot connected');
    console.log(`\n  Google Chat bot: connected`);
    console.log(`  Register a space with JID format: gchat:<space-id>\n`);
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.chatApi) {
      logger.warn('Google Chat API not initialized');
      return;
    }

    try {
      const spaceName = this.jidToSpaceName(jid);

      // Google Chat has a ~4096 char limit — split if needed
      if (text.length <= MAX_MESSAGE_LENGTH) {
        await this.chatApi.spaces.messages.create({
          parent: spaceName,
          requestBody: { text },
        });
      } else {
        for (let i = 0; i < text.length; i += MAX_MESSAGE_LENGTH) {
          await this.chatApi.spaces.messages.create({
            parent: spaceName,
            requestBody: { text: text.slice(i, i + MAX_MESSAGE_LENGTH) },
          });
        }
      }
      logger.info({ jid, length: text.length }, 'Google Chat message sent');
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send Google Chat message');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('gchat:');
  }

  async disconnect(): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.connected = false;
    this.chatApi = null;
    logger.info('Google Chat bot stopped');
  }

  async setTyping(jid: string, _isTyping: boolean): Promise<void> {
    // Google Chat API does not support typing indicators for bots
    void jid;
  }

  private startPolling(): void {
    this.pollTimer = setInterval(() => {
      this.pollMessages().catch((err) => {
        logger.error({ err }, 'Google Chat poll error');
      });
    }, POLL_INTERVAL_MS);
    // Initial poll immediately
    this.pollMessages().catch((err) => {
      logger.error({ err }, 'Google Chat initial poll error');
    });
  }

  private async pollMessages(): Promise<void> {
    if (!this.chatApi) return;

    const groups = this.opts.registeredGroups();
    const gchatGroups = Object.entries(groups).filter(([jid]) =>
      jid.startsWith('gchat:'),
    );

    for (const [chatJid, group] of gchatGroups) {
      try {
        await this.pollSpace(chatJid, group);
      } catch (err) {
        logger.error({ chatJid, err }, 'Failed to poll Google Chat space');
      }
    }
  }

  private async pollSpace(
    chatJid: string,
    group: RegisteredGroup,
  ): Promise<void> {
    if (!this.chatApi) return;

    const spaceName = this.jidToSpaceName(chatJid);
    const lastTimestamp = this.lastMessageTimestamps.get(chatJid);

    let filter = '';
    if (lastTimestamp) {
      filter = `createTime > "${lastTimestamp}"`;
    } else {
      // On first poll, only look at messages from the last 30 seconds to avoid replay
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      filter = `createTime > "${thirtySecondsAgo}"`;
    }

    const response = await this.chatApi.spaces.messages.list({
      parent: spaceName,
      filter,
      pageSize: 50,
      orderBy: 'createTime asc',
    });

    const messages = response.data.messages || [];

    for (const msg of messages) {
      if (!msg.createTime || !msg.text) continue;

      // Skip bot's own messages
      if (msg.sender?.type === 'BOT') continue;

      const timestamp = msg.createTime;
      const msgId = msg.name?.split('/').pop() || `${Date.now()}`;
      const senderName =
        msg.sender?.displayName || msg.sender?.name || 'Unknown';
      const sender = msg.sender?.name || '';
      const threadId = msg.thread?.name?.split('/').pop();
      let content = msg.text;

      // Translate @mentions of the bot into trigger format
      if (msg.annotations) {
        for (const annotation of msg.annotations) {
          if (
            annotation.type === 'USER_MENTION' &&
            annotation.userMention?.type === 'BOT'
          ) {
            if (!TRIGGER_PATTERN.test(content)) {
              content = `@${ASSISTANT_NAME} ${content}`;
            }
            // Remove the @mention text from the content
            if (annotation.startIndex != null && annotation.length != null) {
              const startIdx = annotation.startIndex;
              const len = annotation.length;
              const mentionText = content.substring(startIdx, startIdx + len);
              content = content.replace(mentionText, '').trim();
              content = `@${ASSISTANT_NAME} ${content}`;
            }
            break;
          }
        }
      }

      // Emit chat metadata
      this.opts.onChatMetadata(chatJid, timestamp, group.name, 'gchat', true);

      // Deliver message
      this.opts.onMessage(chatJid, {
        id: msgId,
        chat_jid: chatJid,
        sender,
        sender_name: senderName,
        content,
        timestamp,
        is_from_me: false,
        thread_id: threadId,
      });

      logger.info(
        { chatJid, sender: senderName },
        'Google Chat message stored',
      );

      // Update high-water mark
      this.lastMessageTimestamps.set(chatJid, timestamp);
    }
  }

  private jidToSpaceName(jid: string): string {
    const spaceId = jid.replace(/^gchat:/, '');
    return `spaces/${spaceId}`;
  }

  private getFirstSpaceName(): string {
    const groups = this.opts.registeredGroups();
    const firstGchat = Object.keys(groups).find((jid) =>
      jid.startsWith('gchat:'),
    );
    if (firstGchat) return this.jidToSpaceName(firstGchat);
    return 'spaces/unknown';
  }
}

registerChannel('gchat', (opts: ChannelOpts) => {
  const envVars = readEnvFile(['GOOGLE_CHAT_SERVICE_ACCOUNT_KEY']);
  const keyPath =
    process.env.GOOGLE_CHAT_SERVICE_ACCOUNT_KEY ||
    envVars.GOOGLE_CHAT_SERVICE_ACCOUNT_KEY ||
    '';
  if (!keyPath) {
    logger.warn('Google Chat: GOOGLE_CHAT_SERVICE_ACCOUNT_KEY not set');
    return null;
  }
  return new GChatChannel(keyPath, opts);
});
