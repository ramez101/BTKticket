import { Server as IOServer } from 'socket.io'
declare global { var _io: IOServer | undefined }
export const getIO = (): IOServer | null => global._io ?? null
export const setIO = (io: IOServer) => { global._io = io }
