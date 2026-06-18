export interface AgencyInfo {
  id: number; code: string; name: string; city: string
  currentCalled: number; lastServed: number
  waitingCount: number; estimatedWait: number; isActive: boolean
}
export interface GuichetInfo {
  id: number; number: number; label: string; agencyId: number; isActive: boolean
  calledTicket?: TicketData | null
}
export interface TicketData {
  id: number; number: number; label: string; service: string
  status: 'WAITING' | 'CALLED' | 'SERVED' | 'ABSENT'
  agencyId: number; agencyName: string; guichetId?: number | null
  qrCode?: string; createdAt: string; calledAt?: string | null
}
export interface AgencyState {
  agency: AgencyInfo
  guichets: GuichetInfo[]
  queue: TicketData[]
  called: TicketData | null
  history: { label: string; guichet: string; time: string }[]
}
export const SERVICES = [
  { key: 'Caisse',        icon: '💰' },
  { key: 'Virement',      icon: '🔄' },
  { key: 'Crédit',        icon: '💳' },
  { key: 'Renseignement', icon: 'ℹ️' },
  { key: 'Chèque',        icon: '📄' },
  { key: 'Devise',        icon: '💱' },
] as const
