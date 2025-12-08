import type { Permission } from '../../Types/types';

export interface ChatTags {
  badges?: string;
  'user-id'?: string;
  'room-id'?: string;
  mod?: string | boolean;
  subscriber?: string | boolean;
  'display-name'?: string;
  login?: string;
  [key: string]: unknown;
}

export function isAllowedByPermission(tags: ChatTags | undefined, permission: Permission | Permission[] | undefined, ownerUserId?: string): boolean {
  if (permission === undefined) return true;
  const tagsLocal: ChatTags = tags || {};
  const badgesRaw = tagsLocal.badges ? String(tagsLocal.badges) : '';
  const badges = badgesRaw ? badgesRaw.split(',').map((b: string) => b.split('/')[0]) : [];
  const userId = tagsLocal['user-id'];
  const roomId = tagsLocal['room-id'];
  const isOwner = !!(ownerUserId && String(ownerUserId) === String(userId));
  const isBroadcaster = badges.includes('broadcaster') || (userId && roomId && String(userId) === String(roomId));
  const isMod = badges.includes('moderator') || String(tagsLocal.mod) === '1' || String(tagsLocal.mod) === 'true';
  const isVip = badges.includes('vip');
  const isSubscriber = String(tagsLocal.subscriber) === '1' || badges.includes('subscriber');

  const roleCheck = (r: Permission): boolean => {
    switch (r) {
      case 'owner': return !!isOwner;
      case 'broadcaster': return !!isBroadcaster;
      case 'mod': return !!isMod;
      case 'vip': return !!isVip;
      case 'subscriber': return !!isSubscriber;
      case 'everyone': return true;
    }
  };

  if (typeof permission === 'string') return roleCheck(permission as Permission);
  if (Array.isArray(permission)) return permission.some((p) => roleCheck(p as Permission));
  return false;
}
