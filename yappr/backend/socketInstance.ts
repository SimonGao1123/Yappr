import { Server } from 'socket.io'

let _io: Server | undefined

export function setIO(io: Server): void {
  _io = io
}

export function getIO(): Server {
  if (!_io) throw new Error('Socket.io not initialized')
  return _io
}
