import { Server } from 'socket.io'

let _io: Server | undefined

export function setIO(io: Server): void {
  _io = io
}

export function getIO(): Server {
  if (!_io) throw new Error('Socket.io not initialized')
  return _io
}

// Tell the listed users that a resource changed so they refetch it. Never throws:
// a missing socket server (tests, or a push during startup) must not fail the
// request that triggered it.
function notify(event: string, userIds: Array<number | null | undefined>): void {
  if (!_io) return
  const seen = new Set<number>()
  for (const id of userIds) {
    if (typeof id !== 'number' || seen.has(id)) continue
    seen.add(id)
    try {
      _io.to(`user:${id}`).emit(event)
    } catch {
      // a broken room must not break the caller
    }
  }
}

export function notifyChatsChanged(userIds: Array<number | null | undefined>): void {
  notify('chats:changed', userIds)
}

export function notifyFriendsChanged(userIds: Array<number | null | undefined>): void {
  notify('friends:changed', userIds)
}
