'use client'
import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null
const SOCKET_INIT_ENDPOINT = '/api/socket'
const SOCKET_PATH = '/api/socket/io/'

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: SOCKET_PATH })
  }
  return socket
}

export function useAgencySocket(agencyId: number | null, handlers: {
  onTicketUpdate?: (data: any) => void
  onNewTicket?: (data: any) => void
  onNumberCalled?: (data: any) => void
}) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!agencyId) return
    const onUpdate = (d: any) => handlersRef.current.onTicketUpdate?.(d)
    const onNew = (d: any) => handlersRef.current.onNewTicket?.(d)
    const onCalled = (d: any) => handlersRef.current.onNumberCalled?.(d)
    let active = true
    let s: Socket | null = null

    const joinAgency = () => {
      if (active) s?.emit('join-agency', agencyId)
    }

    fetch(`${SOCKET_INIT_ENDPOINT}?t=${Date.now()}`, { cache: 'no-store' })
      .catch(() => null)
      .then(() => {
        if (!active) return
        s = getSocket()
        s.on('ticket-update', onUpdate)
        s.on('new-ticket', onNew)
        s.on('number-called', onCalled)
        s.on('connect', joinAgency)
        if (s.connected) joinAgency()
      })

    return () => {
      active = false
      if (!s) return
      s.emit('leave-agency', agencyId)
      s.off('connect', joinAgency)
      s.off('ticket-update', onUpdate)
      s.off('new-ticket', onNew)
      s.off('number-called', onCalled)
    }
  }, [agencyId])
}
