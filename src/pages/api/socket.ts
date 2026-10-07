import type { NextApiRequest, NextApiResponse } from 'next'
import type { Server as HTTPServer } from 'http'
import type { Socket as NetSocket } from 'net'
import { Server as IOServer } from 'socket.io'
import { getIO, setIO } from '@/lib/socket-server'

type NextApiResponseWithSocket = NextApiResponse & {
  socket: NetSocket & {
    server: HTTPServer & {
      io?: IOServer
    }
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}

export default function handler(_req: NextApiRequest, res: NextApiResponseWithSocket) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')

  if (!res.socket.server.io) {
    const io = new IOServer(res.socket.server, {
      path: '/api/socket/io',
      cors: { origin: '*' },
    })

    io.on('connection', socket => {
      socket.on('join-agency', (id: number) => socket.join(`agency-${id}`))
      socket.on('leave-agency', (id: number) => socket.leave(`agency-${id}`))
    })

    res.socket.server.io = io
    setIO(io)
  } else if (!getIO()) {
    setIO(res.socket.server.io)
  }

  res.status(200).json({ ok: true })
}
