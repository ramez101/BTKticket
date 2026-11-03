import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import * as Location from 'expo-location'
import { Ionicons } from '@expo/vector-icons'
import { SafeAreaView } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { COLORS, RADIUS, SHADOW, SPACING } from './theme'

const APP_ICON = require('./assets/BTK.png')
const SPLASH_ICON = require('./assets/icon.png')
const MOBILE_BANNER_HEIGHT = 300
const MOBILE_AGENCIES_PER_PAGE = 10

SplashScreen.preventAutoHideAsync().catch(() => undefined)

// Expo Go 57 on Android currently crashes while importing expo-notifications
// because ExpoTopicSubscriptionModule is not registered in that client. Keep
// notifications available in development/release builds, but load the module
// lazily so the app can still be previewed with Expo Go.
let notificationsModule: typeof import('expo-notifications') | null = null

function getNotificationsModule() {
  if (Platform.OS === 'web') return null
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    console.warn('[BTK Easy] Les push distantes nécessitent une APK EAS ou un development build. Expo Go ne les prend pas en charge sur Android.')
    return null
  }
  notificationsModule ??= require('expo-notifications') as typeof import('expo-notifications')
  return notificationsModule
}

const SPLASH_GRAIN = [
  { x: 8, y: 13, s: 2, o: 0.16 }, { x: 22, y: 28, s: 1, o: 0.2 },
  { x: 78, y: 17, s: 2, o: 0.14 }, { x: 91, y: 31, s: 1, o: 0.22 },
  { x: 14, y: 48, s: 1, o: 0.18 }, { x: 86, y: 53, s: 2, o: 0.12 },
  { x: 6, y: 72, s: 1, o: 0.2 }, { x: 28, y: 82, s: 2, o: 0.12 },
  { x: 72, y: 76, s: 1, o: 0.2 }, { x: 94, y: 88, s: 2, o: 0.13 },
  { x: 44, y: 8, s: 1, o: 0.18 }, { x: 57, y: 92, s: 1, o: 0.2 },
  { x: 36, y: 63, s: 1, o: 0.16 }, { x: 66, y: 43, s: 2, o: 0.1 },
]

getNotificationsModule()?.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

function getApiBaseUrl() {
  const configuredUrl = (
    Constants.expoConfig?.extra?.apiUrl
    || process.env.EXPO_PUBLIC_API_URL
    || 'http://192.168.10.92:3000'
  ).replace(/\/$/, '')
  const metroHost = Constants.expoConfig?.hostUri?.split(':')[0]

  // When running from Expo Go or a development build, use the same LAN host
  // that serves Metro. This prevents a stale mobile/.env IP from hiding the
  // agencies and charges on the phone after the router assigns a new address.
  if (Platform.OS !== 'web' && metroHost) {
    const port = configuredUrl.match(/:(\d+)$/)?.[1] || '3000'
    return `http://${metroHost}:${port}`
  }

  return configuredUrl
}

const API_BASE_URL = getApiBaseUrl()
const SERVICES = ['Caisse', 'Virement', 'Crédit', 'Renseignement', 'Chèque', 'Devise']
const SERVICE_ICONS: Record<string, string> = { Caisse: '▥', Virement: '⇄', Crédit: '▣', Renseignement: '≡', Chèque: '✓', Devise: '◈' }

type Tab = 'home' | 'activity' | 'ticket' | 'appointment' | 'screen'

type Agency = {
  id: number
  code: string
  name: string
  city: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  isActive: boolean
  waitingCount: number
  estimatedWait: number
  currentCalled: number
}

type Charge = {
  id: number
  name: string
  code: string
  agencyId: number
  agencyName?: string
  isActive: boolean
}

type Slot = { time: string; available: boolean; reason?: string }

type Ticket = {
  number: number
  label: string
  service: string
  agencyName: string
  waitingCount: number
  estimatedWait: number
}

type ActivityTicket = {
  id: number
  number: number
  service: string
  status: 'WAITING' | 'CALLED' | 'SERVED' | 'ABSENT'
  statusLabel: string
  peopleAhead: number
  progress: number
  estimatedWait: number
  agencyName: string
  agencyCity?: string
  guichet?: string | null
  active: boolean
  lastUpdatedAt: string
}

type ActivityAppointment = {
  id: number
  reference: string
  title: string
  date: string
  time: string
  status: string
  statusLabel: string
  chargeName: string
  agencyName: string
  agencyCity?: string
  subject?: string | null
  upcoming: boolean
}

type ActivityData = {
  tickets: ActivityTicket[]
  appointments: ActivityAppointment[]
  updatedAt: string
}

type Appointment = {
  reference: string
  date: string
  time: string
  customerName: string
}

type ScreenData = {
  agency: Agency
  called?: { number: number; service?: string; guichet?: { label?: string } | null } | null
  queue?: Array<{ number: number; service: string }>
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.')
  return data as T
}

async function registerForPushNotificationsAsync() {
  const Notifications = getNotificationsModule()
  if (!Notifications) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('ticket-updates', {
      name: 'Tickets BTK Easy',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#27C5F5',
    })
    await Notifications.setNotificationChannelAsync('ticket-called', {
      name: 'Appels de tickets',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#27C5F5',
    })
    await Notifications.setNotificationChannelAsync('appointments', {
      name: 'Rendez-vous BTK Easy',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#27C5F5',
    })
  }

  const currentPermissions = await Notifications.getPermissionsAsync()
  const permissions = currentPermissions.granted
    ? currentPermissions
    : await Notifications.requestPermissionsAsync()
  if (!permissions.granted) {
    console.warn('[BTK Easy] Permission de notifications refusée.', permissions)
    return null
  }

  const configuredProjectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID?.trim()
    || Constants.expoConfig?.extra?.eas?.projectId
  const projectId = configuredProjectId && configuredProjectId !== 'replace-with-your-eas-project-id'
    ? configuredProjectId
    : null
  if (!projectId) {
    console.warn('[BTK Easy] Aucun projectId EAS disponible pour générer le token push.')
    return null
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId })
  console.log('[BTK Easy] Token Expo Push obtenu.')
  return token.data
}

async function savePushToken(token: string, context: { ticketId?: number; appointmentId?: number } = {}) {
  try {
    await api('/api/push/register', {
      method: 'POST',
      body: JSON.stringify({ token, platform: Platform.OS, ...context }),
    })
  } catch (error) {
    console.warn(`[BTK Easy] Impossible d'enregistrer le token push sur ${API_BASE_URL}.`, error)
    // The token is retried the next time the app starts or rotates it.
  }
}

async function scheduleAppointmentReminders(appointment: Appointment) {
  const Notifications = getNotificationsModule()
  if (!Notifications) return

  const appointmentAt = new Date(`${appointment.date}T${appointment.time}:00`)
  const reminders = [
    { offset: 24 * 60 * 60 * 1000, title: 'Rappel de votre rendez-vous', body: `N'oubliez pas votre rendez-vous demain à ${appointment.time.replace(':', ' h ')} à l'agence BTK Easy.` },
    { offset: 60 * 60 * 1000, title: 'Rappel de votre rendez-vous', body: `Votre rendez-vous BTK Easy est dans une heure, à ${appointment.time.replace(':', ' h ')}.` },
  ]

  for (const reminder of reminders) {
    const triggerDate = new Date(appointmentAt.getTime() - reminder.offset)
    if (triggerDate.getTime() <= Date.now() + 5000) continue
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminder.title,
        body: reminder.body,
        sound: 'default',
        data: { type: 'appointment-reminder', reference: appointment.reference },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate, channelId: 'appointments' },
    })
  }
}

async function cancelAppointmentReminders(reference: string) {
  const Notifications = getNotificationsModule()
  if (!Notifications) return

  const scheduled = await Notifications.getAllScheduledNotificationsAsync()
  await Promise.all(scheduled
    .filter(item => item.content.data?.reference === reference)
    .map(item => Notifications.cancelScheduledNotificationAsync(item.identifier)))
}

function todayInputDate() {
  const now = new Date()

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Tunis',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now)
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]))
    if (values.year && values.month && values.day) {
      return `${values.year}-${values.month}-${values.day}`
    }
  } catch {
    // Some Android runtimes do not include the full Intl time-zone data.
  }

  // Tunisia is UTC+1. The UTC fallback avoids parsing a localized date string,
  // which can produce an invalid Date on Hermes/Android.
  const fallback = new Date(now.getTime() + 60 * 60 * 1000)
  return `${fallback.getUTCFullYear()}-${String(fallback.getUTCMonth() + 1).padStart(2, '0')}-${String(fallback.getUTCDate()).padStart(2, '0')}`
}

function isValidInputDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function addDays(value: string, days: number) {
  const safeValue = isValidInputDate(value) ? value : todayInputDate()
  const [year, month, day] = safeValue.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

function parseDateValue(value: string | null | undefined) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const isoDate = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDate) {
    const parsed = new Date(Date.UTC(Number(isoDate[1]), Number(isoDate[2]) - 1, Number(isoDate[3]), 12))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const europeanDate = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (europeanDate) {
    const parsed = new Date(Date.UTC(Number(europeanDate[3]), Number(europeanDate[2]) - 1, Number(europeanDate[1]), 12))
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function dateLabel(value: string | null | undefined) {
  const parsed = parseDateValue(value)
  if (!parsed) return 'Date indisponible'
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', timeZone: 'Africa/Tunis',
  }).format(parsed)
}

function Field({ label, value, onChangeText, placeholder, keyboardType = 'default' }: {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  )
}

function PrimaryButton({ label, onPress, disabled = false, leadingIcon, trailingIcon }: { label: string; onPress: () => void; disabled?: boolean; leadingIcon?: string; trailingIcon?: string }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, disabled && styles.disabledButton, pressed && !disabled && styles.pressed]}>
      <View style={styles.primaryButtonContent}>{leadingIcon && <Text style={styles.primaryButtonIcon}>{leadingIcon}</Text>}<Text style={styles.primaryButtonText}>{label}</Text>{trailingIcon && <Text style={styles.primaryButtonTrailing}>{trailingIcon}</Text>}</View>
    </Pressable>
  )
}

function AppHeader({ title, onBack, onMenu }: { title: string; onBack?: () => void; onMenu?: () => void }) {
  return (
    <View style={styles.header}>
      <View pointerEvents="none" style={styles.headerGlow} />
      <View pointerEvents="none" style={styles.headerGlowSmall} />
      {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Retour" onPress={onBack} style={styles.backButton}><Text style={styles.backText}>‹</Text></Pressable> : null}
      <Image source={APP_ICON} style={styles.brandMarkImage} />
      <View style={styles.headerTitle}><Text style={styles.brandName}>BTK Easy</Text><Text style={styles.headerSubtitle}>{title}</Text></View>
      {onMenu ? <Pressable accessibilityRole="button" accessibilityLabel="Ouvrir le menu" onPress={onMenu} style={styles.menuButton}><Text style={styles.menuText}>☰</Text></Pressable> : <View style={styles.headerSpacer} />}
    </View>
  )
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <View style={styles.sectionTitle}><Text style={styles.eyebrow}>{eyebrow}</Text><Text style={styles.sectionHeading}>{title}</Text></View>
}

function AnimatedSplashScreen({ onFinish }: { onFinish: () => void }) {
  const { width, height } = useWindowDimensions()
  const logoOpacity = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.82)).current
  const ringProgress = useRef(new Animated.Value(0)).current
  const pulseProgress = useRef(new Animated.Value(0)).current
  const orbitProgress = useRef(new Animated.Value(0)).current
  const shimmerProgress = useRef(new Animated.Value(0)).current
  const revealProgress = useRef(new Animated.Value(0)).current
  const titleLetters = useRef(Array.from('BTK Easy').map(() => new Animated.Value(0))).current
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined)

    const titleAnimations = titleLetters.map((value, index) => Animated.timing(value, {
      toValue: 1,
      duration: 280,
      delay: 480 + index * 72,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }))

    const ringAnimation = Animated.loop(Animated.sequence([
      Animated.timing(ringProgress, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(ringProgress, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]))
    const pulseAnimation = Animated.loop(Animated.sequence([
      Animated.timing(pulseProgress, { toValue: 1, duration: 1250, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulseProgress, { toValue: 0, duration: 1250, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]))
    const orbitAnimation = Animated.loop(Animated.timing(orbitProgress, {
      toValue: 1, duration: 7200, easing: Easing.linear, useNativeDriver: true,
    }))
    const shimmerAnimation = Animated.loop(Animated.sequence([
      Animated.delay(900),
      Animated.timing(shimmerProgress, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(shimmerProgress, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]))

    Animated.parallel([
      Animated.timing(logoOpacity, { toValue: 1, duration: 650, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, friction: 7, tension: 55, useNativeDriver: true }),
      ...titleAnimations,
    ]).start()
    ringAnimation.start()
    pulseAnimation.start()
    orbitAnimation.start()
    shimmerAnimation.start()

    let currentPercent = 0
    const progressTimer = setInterval(() => {
      currentPercent = Math.min(100, currentPercent + 2)
      setPercent(currentPercent)
    }, 55)

    const finishTimer = setTimeout(() => {
      Animated.timing(revealProgress, {
        toValue: 1,
        duration: 850,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => onFinish())
    }, 3600)

    return () => {
      clearInterval(progressTimer)
      clearTimeout(finishTimer)
      ringAnimation.stop()
      pulseAnimation.stop()
      orbitAnimation.stop()
      shimmerAnimation.stop()
    }
  }, [onFinish, logoOpacity, logoScale, orbitProgress, pulseProgress, revealProgress, ringProgress, shimmerProgress, titleLetters])

  const logoRingScale = ringProgress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.18] })
  const logoRingOpacity = ringProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.75, 0.18, 0] })
  const pulseScale = pulseProgress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.12] })
  const pulseOpacity = pulseProgress.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.08] })
  const orbitRotation = orbitProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const shimmerX = shimmerProgress.interpolate({ inputRange: [0, 1], outputRange: [-180, 180] })
  const revealScale = revealProgress.interpolate({ inputRange: [0, 1], outputRange: [0.15, Math.max(width, height) / 18] })
  const titleChars = Array.from('BTK Easy')

  return (
    <View style={styles.splashRoot}>
      <StatusBar style="light" />
      <View pointerEvents="none" style={styles.splashGlowOne} />
      <View pointerEvents="none" style={styles.splashGlowTwo} />
      <View pointerEvents="none" style={styles.splashGlowThree} />
      <View pointerEvents="none" style={styles.splashGrainLayer}>
        {SPLASH_GRAIN.map((dot, index) => <View key={index} style={[styles.splashGrainDot, { left: `${dot.x}%`, top: `${dot.y}%`, width: dot.s, height: dot.s, opacity: dot.o }]} />)}
      </View>

      <View style={styles.splashCenter}>
        <View style={styles.splashLogoZone}>
          <Animated.View style={[styles.splashRing, styles.splashRingOuter, { opacity: logoRingOpacity, transform: [{ scale: logoRingScale }] }]} />
          <Animated.View style={[styles.splashPulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
          <Animated.View style={[styles.splashOrbit, { transform: [{ rotate: orbitRotation }] }]}>
            <View style={[styles.splashOrbitNode, styles.splashOrbitTop]}><Ionicons name="ticket-outline" size={18} color="#D9F7FF" /></View>
            <View style={[styles.splashOrbitNode, styles.splashOrbitRight]}><Ionicons name="calendar-outline" size={18} color="#D9F7FF" /></View>
            <View style={[styles.splashOrbitNode, styles.splashOrbitBottom]}><Ionicons name="tv-outline" size={18} color="#D9F7FF" /></View>
          </Animated.View>
          <Animated.View style={[styles.splashLogoFrame, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
            <Animated.View style={[styles.splashSpinner, { transform: [{ rotate: orbitRotation }] }]} />
            <View style={styles.splashGlassCard}>
              <Image source={SPLASH_ICON} style={styles.splashLogo} />
              <Animated.View style={[styles.splashReflection, { transform: [{ translateX: shimmerX }, { rotate: '25deg' }] }]} />
            </View>
          </Animated.View>
        </View>

        <View style={styles.splashTitleRow}>
          {titleChars.map((character, index) => <Animated.Text key={`${character}-${index}`} style={[styles.splashTitle, { opacity: titleLetters[index], transform: [{ translateY: titleLetters[index].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>{character === ' ' ? '\u00A0' : character}</Animated.Text>)}
        </View>
        <Text style={styles.splashTagline}>VOTRE BANQUE, PLUS PROCHE DE VOUS</Text>
        <View style={styles.splashProgressArea}>
          <View style={styles.splashProgressTrack}><View style={[styles.splashProgressFill, { width: `${percent}%` }]} /></View>
          <Text style={styles.splashPercent}>{percent}%</Text>
        </View>
      </View>

      <Text style={styles.splashFooter}>BANQUE TUNISO-KOWEITIENNE</Text>
      <Animated.View pointerEvents="none" style={[styles.splashReveal, { transform: [{ scale: revealScale }], opacity: revealProgress }]} />
    </View>
  )
}

export default function App() {
  const [tab, setTab] = useState<Tab>('home')
  const [selectedAgencyForAction, setSelectedAgencyForAction] = useState<Agency | null>(null)
  const [splashVisible, setSplashVisible] = useState(true)
  const [pushToken, setPushToken] = useState<string | null>(null)
  const [activityRefreshKey, setActivityRefreshKey] = useState(0)
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [serviceOpen, setServiceOpen] = useState(true)
  const [loadingHome, setLoadingHome] = useState(true)
  const [connectionError, setConnectionError] = useState('')

  const loadHome = useCallback(async () => {
    try {
      const [agencyData, serviceData] = await Promise.all([
        api<Agency[]>('/api/agency'),
        api<{ open: boolean }>('/api/service-status', { cache: 'no-store' }),
      ])
      setAgencies(agencyData)
      setServiceOpen(Boolean(serviceData.open))
      setConnectionError('')
    } catch (error) {
      setConnectionError(`Connexion impossible avec le serveur (${API_BASE_URL}).`)
      setServiceOpen(false)
    } finally {
      setLoadingHome(false)
    }
  }, [])

  useEffect(() => {
    loadHome()
    const timer = setInterval(loadHome, 15000)
    return () => clearInterval(timer)
  }, [loadHome])

  useEffect(() => {
    const Notifications = getNotificationsModule()
    if (!Notifications) return

    let mounted = true
    registerForPushNotificationsAsync().then(token => {
      if (!mounted || !token) return
      setPushToken(token)
      void savePushToken(token)
    }).catch(error => console.warn('[BTK Easy] Enregistrement push impossible.', error))

    const tokenSubscription = Notifications.addPushTokenListener(token => {
      if (!mounted) return
      setPushToken(token.data)
      void savePushToken(token.data)
    })
    const receivedSubscription = Notifications.addNotificationReceivedListener(notification => {
      const data = notification.request.content.data
      if (typeof data?.type === 'string' && data.type.startsWith('ticket-')) {
        setActivityRefreshKey(value => value + 1)
      }
      if (data?.type === 'appointment-cancelled' && typeof data.reference === 'string') {
        void cancelAppointmentReminders(data.reference)
      }
    })
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      const type = data?.type
      if (typeof type === 'string' && type.startsWith('ticket-')) setActivityRefreshKey(value => value + 1)
      if (data && type === 'appointment-cancelled' && typeof data.reference === 'string') {
        void cancelAppointmentReminders(data.reference)
      }
      if (typeof type === 'string' && (type.startsWith('ticket-') || type.startsWith('appointment-'))) setTab('activity')
    })

    return () => {
      mounted = false
      tokenSubscription.remove()
      receivedSubscription.remove()
      responseSubscription.remove()
    }
  }, [])

  const activeAgencies = useMemo(() => agencies.filter(agency => agency.isActive !== false), [agencies])
  const finishSplash = useCallback(() => setSplashVisible(false), [])
  const navigateFromHome = useCallback((nextTab: Tab, agency?: Agency) => {
    setSelectedAgencyForAction(agency ?? null)
    setTab(nextTab)
  }, [])
  const navigateFromBottomBar = useCallback((nextTab: Tab) => {
    setSelectedAgencyForAction(null)
    setTab(nextTab)
  }, [])

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="light" />
        {tab === 'home' && <HomeScreen agencies={activeAgencies} serviceOpen={serviceOpen} loading={loadingHome} connectionError={connectionError} onNavigate={navigateFromHome} />}
        {tab === 'activity' && <ActivityScreen pushToken={pushToken} refreshKey={activityRefreshKey} />}
        {tab === 'ticket' && <TicketScreen agencies={activeAgencies} serviceOpen={serviceOpen} pushToken={pushToken} initialAgency={selectedAgencyForAction} onBack={() => { setSelectedAgencyForAction(null); setTab('home') }} />}
        {tab === 'appointment' && <AppointmentScreen agencies={activeAgencies} pushToken={pushToken} initialAgency={selectedAgencyForAction} onBack={() => { setSelectedAgencyForAction(null); setTab('home') }} />}
        {tab === 'screen' && <ScreenScreen agencies={activeAgencies} serviceOpen={serviceOpen} onBack={() => setTab('home')} />}
        <BottomNavigationPro tab={tab} onChange={navigateFromBottomBar} />
      </SafeAreaView>
      {splashVisible && <AnimatedSplashScreen onFinish={finishSplash} />}
    </>
  )
}

function HomeScreen({ agencies, serviceOpen, loading, connectionError, onNavigate }: { agencies: Agency[]; serviceOpen: boolean; loading: boolean; connectionError: string; onNavigate: (tab: Tab, agency?: Agency) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null)
  const [liveMode, setLiveMode] = useState<'nearest' | 'wait'>('wait')
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const shortestWaitAgencies = useMemo(() => [...agencies]
    .sort((a, b) => (
      a.waitingCount - b.waitingCount
      || a.estimatedWait - b.estimatedWait
      || a.name.localeCompare(b.name, 'fr')
    ))
    .slice(0, 5), [agencies])
  const nearestAgencies = useMemo(() => {
    if (!position) return []
    return agencies
      .filter(agency => typeof agency.latitude === 'number' && typeof agency.longitude === 'number')
      .map(agency => ({ agency, distance: getDistanceKm(position, agency) }))
      .sort((a, b) => a.distance - b.distance || a.agency.waitingCount - b.agency.waitingCount)
      .slice(0, 5)
      .map(item => item.agency)
  }, [agencies, position])
  const liveAgencies = liveMode === 'nearest' && position ? nearestAgencies : shortestWaitAgencies

  async function showNearestAgencies() {
    setLiveMode('nearest')
    if (position) return

    setLocationLoading(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        Alert.alert('Localisation refusée', 'Autorisez la localisation pour afficher les 5 agences les plus proches.')
        setLiveMode('wait')
        return
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude })
    } catch {
      Alert.alert('Localisation indisponible', 'Vérifiez le GPS de votre téléphone puis réessayez.')
      setLiveMode('wait')
    } finally {
      setLocationLoading(false)
    }
  }

  const navigate = (tab: Tab) => { setMenuOpen(false); onNavigate(tab) }
  const openAgencyActions = (agency: Agency) => setSelectedAgency(agency)
  const chooseAgencyAction = (tab: 'ticket' | 'appointment') => {
    if (!selectedAgency) return
    const agency = selectedAgency
    setSelectedAgency(null)
    onNavigate(tab, agency)
  }
  return (
    <>
      <AppHeader title="Accueil" onMenu={() => setMenuOpen(true)} />
      <ScrollView contentContainerStyle={styles.scrollContent}>
      <HomeHeroCarousel serviceOpen={serviceOpen} onNavigate={navigate} />
      {!serviceOpen && <View accessibilityRole="alert" style={styles.serviceClosedBanner}>
        <View style={styles.serviceClosedIcon}><Ionicons name="time-outline" size={19} color="#FFFFFF" /></View>
        <View style={styles.serviceClosedCopy}><Text style={styles.serviceClosedTitle}>Service fermé</Text><Text style={styles.serviceClosedText}>Le service est disponible de 08:00 à 16:30.</Text></View>
      </View>}
      {connectionError && <Notice text={connectionError} />}

      <SectionTitle eyebrow="MES SERVICES" title="Que souhaitez-vous faire ?" />
      <ActionCard icon="▣" title="Prendre un ticket" description="Consultez l'attente et obtenez votre numéro." onPress={() => navigate('ticket')} primary />
      <ActionCard icon="□" title="Prendre rendez-vous" description="Réservez un créneau avec un chargé." onPress={() => navigate('appointment')} />
      <ActionCard icon="▤" title="Voir les écrans" description="Suivez les numéros appelés en agence." onPress={() => navigate('screen')} />

      <SectionTitle eyebrow="EN DIRECT" title="Situation des agences" />
      <View style={styles.liveFilters}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Afficher les 5 agences les plus proches"
          onPress={showNearestAgencies}
          disabled={locationLoading}
          style={[styles.liveFilterButton, liveMode === 'nearest' && styles.liveFilterButtonActive]}
        >
          <Text style={[styles.liveFilterButtonText, liveMode === 'nearest' && styles.liveFilterButtonTextActive]}>
            {locationLoading ? 'Localisation...' : 'Agences plus proches'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Afficher les 5 agences avec le moins d'attente"
          onPress={() => setLiveMode('wait')}
          style={[styles.liveFilterButton, liveMode === 'wait' && styles.liveFilterButtonActive]}
        >
          <Text style={[styles.liveFilterButtonText, liveMode === 'wait' && styles.liveFilterButtonTextActive]}>Moins d'attente</Text>
        </Pressable>
      </View>
      <View style={styles.agencyList}>
        {liveAgencies.map(agency => <AgencyRow key={agency.id} agency={agency} onPress={() => openAgencyActions(agency)} />)}
        {!loading && agencies.length === 0 && <Text style={styles.emptyText}>Aucune agence ouverte.</Text>}
      </View>
      </ScrollView>
      <Modal visible={Boolean(selectedAgency)} transparent animationType="slide" onRequestClose={() => setSelectedAgency(null)}>
        <Pressable style={styles.agencyActionOverlay} onPress={() => setSelectedAgency(null)}>
          <Pressable style={styles.agencyActionSheet} onPress={event => event.stopPropagation()}>
            <View style={styles.agencyActionHandle} />
            <Text style={styles.agencyActionEyebrow}>AGENCE SÉLECTIONNÉE</Text>
            <Text style={styles.agencyActionTitle}>{selectedAgency?.name}</Text>
            <Text style={styles.agencyActionMeta}>{selectedAgency?.waitingCount} en attente · ~{selectedAgency?.estimatedWait} min</Text>
            <Pressable onPress={() => chooseAgencyAction('ticket')} style={({ pressed }) => [styles.agencyActionButton, styles.agencyActionButtonPrimary, pressed && styles.pressed]}>
              <View style={styles.agencyActionIcon}><Ionicons name="ticket-outline" size={22} color="#FFFFFF" /></View>
              <View style={styles.agencyActionCopy}><Text style={styles.agencyActionButtonTitle}>Prendre un ticket</Text><Text style={styles.agencyActionButtonText}>Choisir le service et obtenir votre numéro.</Text></View>
              <Ionicons name="chevron-forward" size={20} color="#FFFFFF" />
            </Pressable>
            <Pressable onPress={() => chooseAgencyAction('appointment')} style={({ pressed }) => [styles.agencyActionButton, pressed && styles.pressed]}>
              <View style={[styles.agencyActionIcon, styles.agencyActionIconLight]}><Ionicons name="calendar-outline" size={22} color={COLORS.primary} /></View>
              <View style={styles.agencyActionCopy}><Text style={styles.agencyActionButtonTitleSecondary}>Prendre un rendez-vous</Text><Text style={styles.agencyActionButtonTextSecondary}>Choisir un chargé et un créneau.</Text></View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
            </Pressable>
            <Pressable onPress={() => setSelectedAgency(null)} style={styles.agencyActionCancel}><Text style={styles.agencyActionCancelText}>Annuler</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.menuPanel} onPress={event => event.stopPropagation()}>
            <View style={styles.menuPanelHeader}><Image source={APP_ICON} style={styles.menuLogo} /><View><Text style={styles.menuPanelTitle}>BTK Easy</Text><Text style={styles.menuPanelSubtitle}>Services clients</Text></View></View>
            <MenuItem label="Accueil" onPress={() => navigate('home')} />
            <MenuItem label="Prendre un ticket" onPress={() => navigate('ticket')} />
            <MenuItem label="Rendez-vous" onPress={() => navigate('appointment')} />
            <MenuItem label="Voir les écrans" onPress={() => navigate('screen')} />
            <Pressable style={styles.menuClose} onPress={() => setMenuOpen(false)}><Text style={styles.menuCloseText}>Fermer</Text></Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

const HERO_SLIDES = [
  {
    eyebrow: 'BIENVENUE SUR BTK EASY',
    title: 'Votre visite, plus simple.',
    text: 'Prenez un ticket, réservez un rendez-vous et suivez votre agence depuis votre téléphone.',
    symbol: 'BTK',
  },
  {
    eyebrow: 'GAGNEZ DU TEMPS',
    title: 'Préparez votre passage.',
    text: 'Consultez l’attente en direct et choisissez le meilleur moment pour venir en agence.',
    symbol: '01',
  },
  {
    eyebrow: 'RENDEZ-VOUS SIMPLIFIÉ',
    title: 'Un conseiller vous attend.',
    text: 'Réservez un créneau adapté à votre besoin, avec une confirmation claire et rapide.',
    symbol: '✓',
  },
] as const

function HomeHeroCarousel({ serviceOpen, onNavigate }: { serviceOpen: boolean; onNavigate: (tab: Tab) => void }) {
  const { width } = useWindowDimensions()
  const carouselWidth = Math.max(280, width - SPACING.xl * 2)
  const scrollRef = useRef<ScrollView>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveIndex(current => {
        const next = (current + 1) % HERO_SLIDES.length
        scrollRef.current?.scrollTo({ x: next * carouselWidth, animated: true })
        return next
      })
    }, 6000)
    return () => clearInterval(timer)
  }, [carouselWidth])

  return (
    <View style={styles.heroCarousel}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onMomentumScrollEnd={event => {
          const next = Math.round(event.nativeEvent.contentOffset.x / carouselWidth)
          setActiveIndex(Math.max(0, Math.min(HERO_SLIDES.length - 1, next)))
        }}
      >
        {HERO_SLIDES.map((slide, index) => (
          <View key={slide.eyebrow} style={[styles.homeHero, styles.heroSlide, index === 1 && styles.heroSlideDark, index === 2 && styles.heroSlideDeep, { width: carouselWidth }]}>
            <View style={[styles.heroOrb, index === 1 && styles.heroOrbCyan, index === 2 && styles.heroOrbLight]} />
            <View style={styles.heroOrbSmall} />
            <View style={styles.heroContent}>
              <Text style={styles.heroEyebrow}>{slide.eyebrow}</Text>
              <View style={styles.heroAccentLine} />
              <Text style={styles.heroTitle}>{slide.title}</Text>
              <Text style={styles.heroText}>{slide.text}</Text>
              {index === 0 && (
                <View style={styles.statusLine}>
                  <View style={[styles.statusDot, { backgroundColor: serviceOpen ? '#86efac' : '#fbbf24' }]} />
                  <Text style={styles.statusText}>{serviceOpen ? 'Service ouvert' : 'Service fermé'}</Text>
                </View>
              )}
              {index === 1 && (
                <Pressable accessibilityRole="button" accessibilityLabel="Voir les agences" style={styles.heroAction} onPress={() => onNavigate('ticket')}>
                  <Text style={styles.heroActionText}>Voir les agences</Text><Text style={styles.heroActionChevron}>›</Text>
                </Pressable>
              )}
              {index === 2 && (
                <Pressable accessibilityRole="button" accessibilityLabel="Réserver un rendez-vous" style={styles.heroAction} onPress={() => onNavigate('appointment')}>
                  <Text style={styles.heroActionText}>Réserver maintenant</Text><Text style={styles.heroActionChevron}>›</Text>
                </Pressable>
              )}
            </View>
            <View style={styles.heroVisual} accessibilityElementsHidden>
              <View style={styles.heroVisualRing} />
              <View style={styles.heroVisualBadge}><Text style={styles.heroVisualSymbol}>{slide.symbol}</Text><Text style={styles.heroVisualLabel}>EASY</Text></View>
            </View>
          </View>
        ))}
      </ScrollView>
      <View style={styles.heroDots} accessibilityLabel={`Bannière ${activeIndex + 1} sur ${HERO_SLIDES.length}`}>
        {HERO_SLIDES.map((slide, index) => <View key={slide.eyebrow} style={[styles.heroDot, index === activeIndex && styles.heroDotActive]} />)}
      </View>
    </View>
  )
}

function MenuItem({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="menuitem" accessibilityLabel={label} onPress={onPress} style={styles.menuItem}><Text style={styles.menuItemText}>{label}</Text><Text style={styles.menuItemChevron}>›</Text></Pressable>
}

function ActionCard({ icon, title, description, onPress, primary = false }: { icon: string; title: string; description: string; onPress: () => void; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${description}`} onPress={onPress} style={({ pressed }) => [styles.actionCard, primary && styles.primaryCard, pressed && styles.pressed]}><View style={[styles.actionIcon, primary && styles.primaryIcon]}><Text style={[styles.actionIconText, primary && styles.primaryIconText]}>{icon}</Text></View><View style={styles.actionCopy}><Text style={[styles.actionTitle, primary && styles.primaryCardText]}>{title}</Text><Text style={[styles.actionDescription, primary && styles.primaryCardMuted]}>{description}</Text></View><Text style={[styles.chevron, primary && styles.primaryCardText]}>›</Text></Pressable>
}

function Stat({ value, label }: { value: string; label: string }) {
  return <View style={styles.statCard}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>
}

function AgencyRow({ agency, onPress }: { agency: Agency; onPress: () => void }) {
  const busy = agency.waitingCount >= 20
  return <Pressable accessibilityRole="button" accessibilityLabel={`Choisir une action pour l'agence ${agency.name}`} onPress={onPress} style={({ pressed }) => [styles.agencyRow, pressed && styles.pressed]}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{agency.code}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName} numberOfLines={1}>{agency.name}</Text><Text style={[styles.agencyMeta, { color: busy ? COLORS.error : COLORS.success }]}>{agency.waitingCount} en attente · ~{agency.estimatedWait} min</Text></View><Text style={styles.rowChevron}>›</Text></Pressable>
}

function LegacyTicketScreen({ agencies, serviceOpen, onBack }: { agencies: Agency[]; serviceOpen: boolean; onBack: () => void }) {
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(null)
  const [service, setService] = useState('')
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(false)

  async function createTicket() {
    if (!selectedAgency || !service || !serviceOpen) return
    setLoading(true)
    try {
      const data = await api<Ticket>('/api/ticket', { method: 'POST', body: JSON.stringify({ agencyId: selectedAgency.id, service, notificationMode: 'guest' }) })
      setTicket(data)
    } catch (error) {
      Alert.alert('Ticket impossible', error instanceof Error ? error.message : 'Service indisponible.')
    } finally {
      setLoading(false)
    }
  }

  if (ticket) return <ScreenLayout title="Mon ticket" onBack={onBack}><View style={styles.ticketCard}><Text style={styles.cardEyebrow}>{ticket.agencyName}</Text><Text style={styles.ticketNumber}>{ticket.number}</Text><Text style={styles.ticketService}>{ticket.service}</Text><View style={styles.ticketStats}><Stat value={String(Math.max(0, ticket.waitingCount - 1))} label="Avant vous" /><Stat value={`~${ticket.estimatedWait}`} label="Minutes" /></View><Text style={styles.ticketHint}>Présentez ce numéro lorsque votre tour est affiché à l'écran.</Text><PrimaryButton label="Prendre un autre ticket" onPress={() => { setTicket(null); setSelectedAgency(null); setService('') }} /></View></ScreenLayout>

  return <ScreenLayout title="Prendre un ticket" onBack={onBack}>
    {!serviceOpen && <Notice text="Le service est fermé pour le moment." />}
    <SectionTitle eyebrow="1 · AGENCE" title="Choisissez une agence" />
    {agencies.map(agency => <Pressable key={agency.id} onPress={() => setSelectedAgency(agency)} style={[styles.selectRow, selectedAgency?.id === agency.id && styles.selectedRow]}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{agency.code}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName}>{agency.name}</Text><Text style={styles.agencyMeta}>{agency.waitingCount} en attente · ~{agency.estimatedWait} min</Text></View><Text style={styles.radio}>{selectedAgency?.id === agency.id ? '●' : '○'}</Text></Pressable>)}
    {selectedAgency && <><SectionTitle eyebrow="2 · SERVICE" title="Choisissez votre service" /><View style={styles.serviceGrid}>{SERVICES.map(item => <Pressable key={item} onPress={() => setService(item)} style={[styles.serviceChip, service === item && styles.selectedService]}><Text style={[styles.serviceChipText, service === item && styles.selectedServiceText]}>{item}</Text></Pressable>)}</View><PrimaryButton label={loading ? 'Création...' : 'Générer mon ticket'} onPress={createTicket} disabled={!service || loading || !serviceOpen} /></>}
  </ScreenLayout>
}

function TicketResultCard({ ticket, onReset, onRoute }: { ticket: Ticket; onReset: () => void; onRoute?: () => void }) {
  return (
    <View style={styles.ticketCard}>
      <View style={styles.resultHeader}>
        <View>
          <Text style={styles.resultEyebrow}>TICKET CONFIRMÉ</Text>
          <Text style={styles.resultAgency}>{ticket.agencyName}</Text>
        </View>
        <View style={styles.resultStatus}><View style={styles.resultStatusDot} /><Text style={styles.resultStatusText}>En attente</Text></View>
      </View>
      <View style={styles.ticketNumberPanel}>
        <Text style={styles.ticketNumberLabel}>VOTRE NUMÉRO</Text>
        <Text style={styles.ticketNumber}>{ticket.number}</Text>
        <Text style={styles.ticketService}>{ticket.service}</Text>
      </View>
      <View style={styles.ticketStats}>
        <View style={styles.resultStatCard}><Text style={styles.resultStatValue}>{Math.max(0, ticket.waitingCount - 1)}</Text><Text style={styles.resultStatLabel}>Avant vous</Text></View>
        <View style={styles.resultStatCard}><Text style={styles.resultStatValue}>~{ticket.estimatedWait}</Text><Text style={styles.resultStatLabel}>Minutes</Text></View>
      </View>
      <Text style={styles.ticketHint}>Présentez ce numéro lorsque votre tour est affiché à l’écran.</Text>
      {onRoute && <Pressable style={styles.routeButton} onPress={onRoute}><Ionicons name="navigate-outline" size={20} color={COLORS.primary} /><Text style={styles.routeButtonText}>Itinéraire vers l’agence</Text></Pressable>}
      <PrimaryButton label="Prendre un autre ticket" onPress={onReset} />
    </View>
  )
}

function AgencyPagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  if (pageCount <= 1) return null
  return <View style={styles.agencyPagination}>
    <Pressable accessibilityRole="button" accessibilityLabel="Page précédente" disabled={page === 1} onPress={() => onChange(page - 1)} style={[styles.paginationButton, page === 1 && styles.paginationButtonDisabled]}>
      <Text style={[styles.paginationButtonText, page === 1 && styles.paginationButtonTextDisabled]}>‹</Text>
    </Pressable>
    <Text style={styles.paginationLabel}>Page {page} / {pageCount}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Page suivante" disabled={page === pageCount} onPress={() => onChange(page + 1)} style={[styles.paginationButton, page === pageCount && styles.paginationButtonDisabled]}>
      <Text style={[styles.paginationButtonText, page === pageCount && styles.paginationButtonTextDisabled]}>›</Text>
    </Pressable>
  </View>
}

type ActivityFilter = 'all' | 'appointments' | 'tickets'

function formatActivityDate(date: string, time?: string) {
  const parsed = new Date(`${date}T${time || '12:00'}:00`)
  if (Number.isNaN(parsed.getTime())) return `${date}${time ? ` · ${time}` : ''}`
  return `${new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).format(parsed)}${time ? ` · ${time}` : ''}`
}

function ActivityScreen({ pushToken, refreshKey }: { pushToken: string | null; refreshKey: number }) {
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [activity, setActivity] = useState<ActivityData>({ tickets: [], appointments: [], updatedAt: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const cacheLoaded = useRef(false)

  const loadActivity = useCallback(async (showLoading = false) => {
    if (!pushToken) {
      setLoading(false)
      return
    }
    if (showLoading) setLoading(true)
    const cacheKey = `btk-easy-activity:${pushToken}`
    try {
      if (!cacheLoaded.current) {
        const cached = await AsyncStorage.getItem(cacheKey)
        if (cached) setActivity(JSON.parse(cached) as ActivityData)
        cacheLoaded.current = true
      }
      const data = await api<ActivityData>(`/api/activity?token=${encodeURIComponent(pushToken)}`)
      setActivity(data)
      setError('')
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Activité indisponible.')
    } finally {
      setLoading(false)
    }
  }, [pushToken])

  useEffect(() => {
    cacheLoaded.current = false
    void loadActivity(true)
    const timer = setInterval(() => void loadActivity(), 10000)
    return () => clearInterval(timer)
  }, [loadActivity, refreshKey])

  async function cancelAppointment(appointment: ActivityAppointment) {
    Alert.alert('Annuler le rendez-vous ?', `${appointment.title} · ${formatActivityDate(appointment.date, appointment.time)}`, [
      { text: 'Garder', style: 'cancel' },
      {
        text: 'Annuler',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/appointments/${appointment.id}`, { method: 'DELETE' })
            await loadActivity()
          } catch (cancelError) {
            Alert.alert('Annulation impossible', cancelError instanceof Error ? cancelError.message : 'Réessayez plus tard.')
          }
        },
      },
    ])
  }

  const activeTickets = activity.tickets.filter(ticket => ticket.active)
  const pastTickets = activity.tickets.filter(ticket => !ticket.active)
  const upcomingAppointments = activity.appointments.filter(appointment => appointment.upcoming)
  const pastAppointments = activity.appointments.filter(appointment => !appointment.upcoming)
  const showTickets = filter === 'all' || filter === 'tickets'
  const showAppointments = filter === 'all' || filter === 'appointments'

  return (
    <>
      <AppHeader title="Activité" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.activityHero}>
          <Text style={styles.activityEyebrow}>SUIVI EN DIRECT</Text>
          <Text style={styles.activityTitle}>Votre activité BTK Easy</Text>
          <Text style={styles.activitySubtitle}>Tickets et rendez-vous réunis au même endroit.</Text>
        </View>

        <View style={styles.activityFilters}>
          {([
            ['all', 'Tous', 'apps-outline'],
            ['appointments', 'Mes RDV', 'calendar-outline'],
            ['tickets', 'Mes tickets', 'ticket-outline'],
          ] as const).map(([key, label, icon]) => (
            <Pressable key={key} onPress={() => setFilter(key)} style={[styles.activityFilter, filter === key && styles.activityFilterActive]}>
              <Ionicons name={icon} size={16} color={filter === key ? '#FFFFFF' : COLORS.primary} />
              <Text style={[styles.activityFilterText, filter === key && styles.activityFilterTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {!pushToken && <Notice text="Activez les notifications pour retrouver vos tickets et rendez-vous sur cet appareil." />}
        {loading && <ActivityIndicator color={COLORS.primary} style={styles.activityLoader} />}
        {!!error && <Notice text={error} />}

        {showTickets && <>
          <View style={styles.activitySectionHeader}><View><Text style={styles.eyebrow}>TICKETS</Text><Text style={styles.sectionHeading}>Mes tickets</Text></View><View style={styles.activityCount}><Text style={styles.activityCountText}>{activeTickets.length}</Text></View></View>
          {activeTickets.length === 0 && !loading
            ? <View style={styles.activityEmpty}><Ionicons name="ticket-outline" size={28} color={COLORS.primary} /><Text style={styles.activityEmptyTitle}>Aucun ticket actif</Text><Text style={styles.activityEmptyText}>Vos tickets en cours apparaîtront ici.</Text></View>
            : activeTickets.map(ticket => <ActivityTicketCard key={ticket.id} ticket={ticket} />)}
          {pastTickets.length > 0 && <>
            <Text style={styles.activitySubheading}>Historique des tickets</Text>
            {pastTickets.map(ticket => <ActivityTicketCard key={ticket.id} ticket={ticket} />)}
          </>}
        </>}

        {showAppointments && <>
          <View style={styles.activitySectionHeader}><View><Text style={styles.eyebrow}>RENDEZ-VOUS</Text><Text style={styles.sectionHeading}>Mes rendez-vous</Text></View><View style={styles.activityCount}><Text style={styles.activityCountText}>{upcomingAppointments.length}</Text></View></View>
          {upcomingAppointments.length === 0 && !loading
            ? <View style={styles.activityEmpty}><Ionicons name="calendar-outline" size={28} color={COLORS.primary} /><Text style={styles.activityEmptyTitle}>Aucun rendez-vous à venir</Text><Text style={styles.activityEmptyText}>Vos prochaines réservations apparaîtront ici.</Text></View>
            : upcomingAppointments.map(appointment => <ActivityAppointmentCard key={appointment.id} appointment={appointment} onCancel={() => cancelAppointment(appointment)} />)}
          {pastAppointments.length > 0 && <>
            <Text style={styles.activitySubheading}>Rendez-vous passés</Text>
            {pastAppointments.map(appointment => <ActivityAppointmentCard key={appointment.id} appointment={appointment} />)}
          </>}
        </>}
      </ScrollView>
    </>
  )
}

function ActivityTicketCard({ ticket }: { ticket: ActivityTicket }) {
  const progress = useRef(new Animated.Value(ticket.progress)).current
  useEffect(() => {
    Animated.timing(progress, { toValue: ticket.progress, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [progress, ticket.progress])
  const progressWidth = progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
  const called = ticket.status === 'CALLED'
  const closed = !ticket.active

  return <View style={[styles.activityTicketCard, called && styles.activityTicketCardCalled, closed && styles.activityTicketCardClosed]}>
    <View style={styles.activityTicketHeader}>
      <View><Text style={styles.activityCardEyebrow}>{ticket.agencyName}</Text><Text style={styles.activityTicketNumber}>TICKET #{String(ticket.number).padStart(3, '0')}</Text><Text style={styles.activityTicketService}>{ticket.service}</Text></View>
      <View style={[styles.activityStatusPill, called && styles.activityStatusPillCalled, closed && styles.activityStatusPillClosed]}><View style={[styles.activityLiveDot, called && styles.activityLiveDotCalled, closed && styles.activityLiveDotClosed]} /><Text style={styles.activityStatusText}>{ticket.statusLabel}</Text></View>
    </View>
    <Text style={styles.activityTicketLead}>{called ? 'C’EST VOTRE TOUR !' : closed ? ticket.statusLabel : ticket.peopleAhead <= 3 ? 'VOTRE TOUR APPROCHE' : 'SUIVI EN TEMPS RÉEL'}</Text>
    <View style={styles.activityTicketStats}><Text style={styles.activityPeopleAhead}>{ticket.peopleAhead} <Text style={styles.activityPeopleAheadLabel}>personne{ticket.peopleAhead === 1 ? '' : 's'} avant vous</Text></Text><Text style={styles.activityProgressText}>{ticket.progress}%</Text></View>
    <View style={styles.activityProgressTrack}><Animated.View style={[styles.activityProgressFill, { width: progressWidth }]} /></View>
    <View style={styles.activityTicketFooter}><View><Text style={styles.activityMetaLabel}>ATTENTE ESTIMÉE</Text><Text style={styles.activityMetaValue}>{ticket.estimatedWait} min</Text></View><View style={styles.activityFooterRight}><Text style={styles.activityMetaLabel}>DERNIÈRE MISE À JOUR</Text><Text style={styles.activityMetaValue}>{new Date(ticket.lastUpdatedAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text></View></View>
    {ticket.guichet && <Text style={styles.activityGuichet}>Présentez-vous au {ticket.guichet}</Text>}
  </View>
}

function ActivityAppointmentCard({ appointment, onCancel }: { appointment: ActivityAppointment; onCancel?: () => void }) {
  return <View style={styles.activityAppointmentCard}>
    <View style={styles.activityAppointmentHeader}><View style={styles.activityAppointmentIcon}><Ionicons name="calendar-outline" size={22} color="#FFFFFF" /></View><View style={styles.activityAppointmentCopy}><Text style={styles.activityCardEyebrow}>{appointment.agencyName}</Text><Text style={styles.activityAppointmentTitle}>{appointment.title}</Text></View><View style={styles.activityConfirmedBadge}><Text style={styles.activityConfirmedText}>{appointment.statusLabel}</Text></View></View>
    <Text style={styles.activityAppointmentDate}>{formatActivityDate(appointment.date, appointment.time)}</Text>
    <Text style={styles.activityAppointmentMeta}>{appointment.chargeName} · {appointment.agencyCity || 'Agence BTK'}</Text>
    {appointment.subject && <Text style={styles.activityAppointmentSubject}>{appointment.subject}</Text>}
    <Text style={styles.activityReference}>Référence {appointment.reference}</Text>
    {appointment.upcoming && onCancel && <Pressable onPress={onCancel} style={styles.activityCancelButton}><Text style={styles.activityCancelButtonText}>Annuler le rendez-vous</Text></Pressable>}
  </View>
}

function TicketScreen({ agencies, serviceOpen, pushToken, initialAgency, onBack }: { agencies: Agency[]; serviceOpen: boolean; pushToken: string | null; initialAgency?: Agency | null; onBack: () => void }) {
  const [stage, setStage] = useState<'agency' | 'service'>(initialAgency ? 'service' : 'agency')
  const [selectedAgency, setSelectedAgency] = useState<Agency | null>(initialAgency ?? null)
  const [service, setService] = useState('')
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [loading, setLoading] = useState(false)
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null)
  const [locationLoading, setLocationLoading] = useState(false)
  const [agencySearch, setAgencySearch] = useState('')
  const [agencyPage, setAgencyPage] = useState(1)

  const visibleAgencies = useMemo(() => {
    const query = agencySearch.trim().toLowerCase()
    if (!query) return agencies
    return agencies.filter(item => `${item.name} ${item.city} ${item.code}`.toLowerCase().includes(query))
  }, [agencies, agencySearch])

  const agencyPageCount = Math.max(1, Math.ceil(visibleAgencies.length / MOBILE_AGENCIES_PER_PAGE))
  const paginatedAgencies = useMemo(() => visibleAgencies.slice((agencyPage - 1) * MOBILE_AGENCIES_PER_PAGE, agencyPage * MOBILE_AGENCIES_PER_PAGE), [visibleAgencies, agencyPage])

  useEffect(() => {
    setAgencyPage(1)
  }, [agencySearch])

  useEffect(() => {
    setAgencyPage(page => Math.min(page, agencyPageCount))
  }, [agencyPageCount])

  const nearestAgency = useMemo(() => {
    if (!position) return null
    return agencies
      .filter(item => typeof item.latitude === 'number' && typeof item.longitude === 'number')
      .map(item => ({ item, distance: getDistanceKm(position, item) }))
      .sort((a, b) => a.distance - b.distance)[0] || null
  }, [agencies, position])

  async function locateMe() {
    setLocationLoading(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        Alert.alert('Localisation refusée', 'Autorisez la localisation pour trouver l’agence la plus proche.')
        return
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude })
    } catch {
      Alert.alert('Localisation indisponible', 'Vérifiez le GPS de votre téléphone puis réessayez.')
    } finally {
      setLocationLoading(false)
    }
  }

  async function createTicket() {
    if (!selectedAgency || !service || !serviceOpen) return
    setLoading(true)
    try {
      const data = await api<Ticket>('/api/ticket', { method: 'POST', body: JSON.stringify({ agencyId: selectedAgency.id, service, notificationMode: 'guest', pushToken, pushPlatform: Platform.OS }) })
      setTicket(data)
    } catch (error) {
      Alert.alert('Ticket impossible', error instanceof Error ? error.message : 'Service indisponible.')
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setTicket(null)
    setSelectedAgency(null)
    setService('')
    setStage('agency')
  }

  function openMaps() {
    if (!selectedAgency) return
    const destination = typeof selectedAgency.latitude === 'number' && typeof selectedAgency.longitude === 'number'
      ? `${selectedAgency.latitude},${selectedAgency.longitude}`
      : encodeURIComponent(selectedAgency.address || selectedAgency.name)
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${destination}`)
  }

  if (ticket) return <ScreenLayout title="Mon ticket" onBack={onBack}><TicketResultCard ticket={ticket} onRoute={openMaps} onReset={reset} /></ScreenLayout>

  const goBack = () => stage === 'service' ? setStage('agency') : onBack()
  return <ScreenLayout title="Prendre un ticket" onBack={goBack}>
    {stage === 'agency' && <TicketHeroBanner serviceOpen={serviceOpen} />}
    <StepProgress current={stage === 'agency' ? 1 : 2} total={2} label={stage === 'agency' ? 'Choisir une agence' : 'Choisir un service'} description={stage === 'agency' ? "Sélectionnez l'agence où vous souhaitez vous rendre." : 'Choisissez le service dont vous avez besoin.'} />
    {!serviceOpen && <Notice text="Le service est fermé pour le moment." />}
    {stage === 'agency' && <>
      <SectionTitle eyebrow="1 · AGENCE" title="Choisissez une agence" />
      <View style={styles.ticketToolsRow}>
        <View style={styles.ticketSearchBox}><Text style={styles.ticketSearchIcon}>⌕</Text><TextInput accessibilityLabel="Rechercher une agence" value={agencySearch} onChangeText={setAgencySearch} placeholder="Rechercher une agence..." placeholderTextColor={COLORS.muted} style={styles.ticketSearchInput} /></View>
        <Pressable accessibilityRole="button" accessibilityLabel="Trouver l'agence la plus proche" style={styles.locationButton} onPress={locateMe} disabled={locationLoading}>
          {locationLoading ? <ActivityIndicator color={COLORS.primary} /> : <><Text style={styles.locationIcon}>⌖</Text><Text style={styles.locationButtonText}>Trouver l’agence la plus proche</Text></>}
        </Pressable>
      </View>
      <View style={styles.agencyResultsHeader}><Text style={styles.agencyResultsCount}>{visibleAgencies.length} agence(s)</Text><Text style={styles.agencyResultsHint}>{nearestAgency ? `La plus proche : ${nearestAgency.distance.toFixed(1)} km` : 'Agences disponibles'}</Text></View>
      <View style={styles.ticketAgencyGrid}>
        {paginatedAgencies.map(agency => {
          const isNearest = nearestAgency?.item.id === agency.id
          return <Pressable key={agency.id} accessibilityRole="button" accessibilityLabel={`Choisir l'agence ${agency.name}`} onPress={() => { setSelectedAgency(agency); setStage('service') }} style={[styles.ticketAgencyCard, isNearest && styles.nearestSelectedRow]}>
            <View style={styles.ticketAgencyTop}>
              <View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{agency.code}</Text></View>
              <Text style={styles.rowChevron}>›</Text>
            </View>
            <View style={styles.ticketAgencyCopy}>
              <Text style={styles.ticketAgencyName} numberOfLines={1}>{agency.name}</Text>
              <Text style={styles.ticketAgencyCity} numberOfLines={1}>{agency.city}</Text>
            </View>
            <View style={styles.ticketAgencyMeta}>
              <Text style={[styles.agencyWait, isNearest && styles.nearestWait]}>{agency.waitingCount} en attente</Text>
              <Text style={[styles.agencyWait, isNearest && styles.nearestWait]}>~ {agency.estimatedWait} min</Text>
            </View>
          </Pressable>
        })}
      </View>
      {visibleAgencies.length === 0 && <Text style={styles.emptyText}>Aucune agence ne correspond à votre recherche.</Text>}
      <AgencyPagination page={agencyPage} pageCount={agencyPageCount} onChange={setAgencyPage} />
    </>}
    {stage === 'service' && <>
      <View style={styles.selectedAgencyCard}><View style={styles.selectedAgencyIcon}><Text style={styles.selectedAgencyIconText}>⌖</Text></View><View style={styles.selectedAgencyCopy}><Text style={styles.selectedAgencyLabel}>AGENCE SÉLECTIONNÉE</Text><Text style={styles.selectedAgencyName}>{selectedAgency?.name}</Text><Text style={styles.selectedAgencyMeta}>{selectedAgency?.city || selectedAgency?.address || 'Agence BTK'}</Text></View><Text style={styles.selectedAgencyChevron}>›</Text></View>
      <View style={styles.serviceHeading}><View style={styles.serviceStepNumber}><Text style={styles.serviceStepNumberText}>2</Text></View><View style={styles.serviceHeadingCopy}><Text style={styles.eyebrow}>SERVICE</Text><Text style={styles.sectionHeading}>Choisissez votre service</Text></View></View>
      <View style={styles.serviceGrid}>{SERVICES.map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: service === item }} accessibilityLabel={`Service ${item}`} onPress={() => setService(item)} style={[styles.serviceCard, service === item && styles.selectedServiceCard]}><View style={[styles.serviceIcon, service === item && styles.selectedServiceIcon]}><Text style={[styles.serviceIconText, service === item && styles.selectedServiceText]}>{SERVICE_ICONS[item]}</Text></View><Text style={[styles.serviceCardText, service === item && styles.selectedServiceText]}>{item}</Text><Text style={[styles.serviceCardChevron, service === item && styles.selectedServiceText]}>›</Text></Pressable>)}</View>
      <PrimaryButton label={loading ? 'Création...' : 'Générer mon ticket'} leadingIcon={loading ? undefined : '▣'} trailingIcon={loading ? undefined : '→'} onPress={createTicket} disabled={!service || loading || !serviceOpen} />
    </>}
  </ScreenLayout>
}

function getDistanceKm(from: { latitude: number; longitude: number }, agency: Pick<Agency, 'latitude' | 'longitude'>) {
  if (typeof agency.latitude !== 'number' || typeof agency.longitude !== 'number') return Number.POSITIVE_INFINITY
  const toRadians = (value: number) => value * Math.PI / 180
  const dLat = toRadians(agency.latitude - from.latitude)
  const dLon = toRadians(agency.longitude - from.longitude)
  const lat1 = toRadians(from.latitude)
  const lat2 = toRadians(agency.latitude)
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function TicketHeroBanner({ serviceOpen }: { serviceOpen: boolean }) {
  return <View style={styles.ticketHero}>
    <View style={styles.ticketHeroOrb} />
    <View style={styles.ticketHeroOrbSmall} />
    <View style={styles.ticketHeroCopy}><Text style={styles.ticketHeroEyebrow}>BIENVENUE SUR BTK EASY</Text><View style={styles.ticketHeroLine} /><Text style={styles.ticketHeroTitle}>Votre visite, plus simple.</Text><Text style={styles.ticketHeroText}>Prenez un ticket et suivez votre attente depuis votre téléphone.</Text><View style={styles.ticketHeroStatus}><View style={[styles.statusDot, { backgroundColor: serviceOpen ? '#86efac' : '#fbbf24' }]} /><Text style={styles.ticketHeroStatusText}>{serviceOpen ? 'Service ouvert' : 'Service fermé'}</Text></View></View>
    <View style={styles.ticketHeroVisual}><View style={styles.ticketHeroVisualRing} /><View style={styles.ticketHeroBadge}><Text style={styles.ticketHeroBadgeText}>BTK</Text><Text style={styles.ticketHeroBadgeSmall}>EASY</Text></View></View>
  </View>
}

function StepProgress({ current, total, label, description }: { current: number; total: number; label: string; description?: string }) {
  return <View style={styles.stepProgress}><View style={styles.stepProgressHeader}><View style={styles.stepNumber}><Text style={styles.stepNumberText}>{current}</Text></View><View style={styles.stepProgressCopy}><Text style={styles.stepProgressText}>ÉTAPE {current} / {total}</Text><Text style={styles.stepProgressLabel}>{label}</Text>{description && <Text style={styles.stepProgressDescription}>{description}</Text>}</View></View><View style={styles.stepTrack}><View style={[styles.stepFill, { width: `${(current / total) * 100}%` }]} /></View></View>
}

function LegacyAppointmentScreen({ agencies, onBack }: { agencies: Agency[]; onBack: () => void }) {
  const [agency, setAgency] = useState<Agency | null>(null)
  const [charges, setCharges] = useState<Charge[]>([])
  const [charge, setCharge] = useState<Charge | null>(null)
  const [date, setDate] = useState(todayInputDate())
  const [slots, setSlots] = useState<Slot[]>([])
  const [time, setTime] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [result, setResult] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(false)

  async function chooseAgency(value: Agency) {
    setAgency(value); setCharge(null); setSlots([]); setTime(''); setLoading(true)
    try { setCharges((await api<Charge[]>(`/api/charges?agencyId=${value.id}`)).filter(item => item.isActive !== false)) } catch { setCharges([]); Alert.alert('Erreur', 'Impossible de charger les chargés.') } finally { setLoading(false) }
  }

  async function chooseCharge(value: Charge) {
    setCharge(value); setTime(''); setLoading(true)
    try { const data = await api<{ slots: Slot[] }>(`/api/charges/${value.id}/availability?date=${date}`); setSlots(data.slots || []) } catch { setSlots([]); Alert.alert('Calendrier indisponible', 'Réessayez dans quelques instants.') } finally { setLoading(false) }
  }

  async function reloadSlots(nextDate: string) {
    const safeDate = isValidInputDate(nextDate) ? nextDate : todayInputDate()
    setDate(safeDate); setTime('')
    if (!charge) return
    setLoading(true)
    try { const data = await api<{ slots: Slot[] }>(`/api/charges/${charge.id}/availability?date=${safeDate}`); setSlots(data.slots || []) } catch { setSlots([]) } finally { setLoading(false) }
  }

  async function submit() {
    if (!charge || !time || !name.trim() || !phone.trim()) return
    setLoading(true)
    try {
      const data = await api<{ appointment: Appointment }>('/api/appointments', { method: 'POST', body: JSON.stringify({ chargeId: charge.id, date, time, customerName: name, customerPhone: phone, customerEmail: email, subject }) })
      setResult(data.appointment)
    } catch (error) { Alert.alert('Réservation impossible', error instanceof Error ? error.message : 'Créneau indisponible.') } finally { setLoading(false) }
  }

  if (result) return <ScreenLayout title="Rendez-vous confirmé" onBack={onBack}><View style={styles.confirmCard}><Text style={styles.confirmIcon}>✓</Text><Text style={styles.cardEyebrow}>CODE RENDEZ-VOUS</Text><Text style={styles.reference}>{result.reference}</Text><Text style={styles.confirmText}>{dateLabel(result.date)} à {result.time}</Text><Text style={styles.confirmText}>{result.customerName}</Text><Text style={styles.ticketHint}>Conservez ce code pour consulter ou annuler votre rendez-vous.</Text><PrimaryButton label="Nouveau rendez-vous" onPress={() => setResult(null)} /></View></ScreenLayout>

  return <ScreenLayout title="Prendre rendez-vous" onBack={onBack}>
    <SectionTitle eyebrow="1 · AGENCE" title="Choisissez une agence" />
    {agencies.map(item => <Pressable key={item.id} onPress={() => chooseAgency(item)} style={[styles.selectRow, agency?.id === item.id && styles.selectedRow]}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{item.code}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName}>{item.name}</Text><Text style={styles.agencyMeta}>{item.city}</Text></View><Text style={styles.radio}>{agency?.id === item.id ? '●' : '○'}</Text></Pressable>)}
    {agency && <><SectionTitle eyebrow="2 · CONSEILLER" title="Choisissez un chargé" />{loading && !charges.length ? <ActivityIndicator color="#0065a1" /> : charges.map(item => <Pressable key={item.id} onPress={() => chooseCharge(item)} style={[styles.selectRow, charge?.id === item.id && styles.selectedRow]}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{item.code}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName}>{item.name}</Text><Text style={styles.agencyMeta}>{item.agencyName}</Text></View><Text style={styles.radio}>{charge?.id === item.id ? '●' : '○'}</Text></Pressable>)}</>}
    {charge && <><SectionTitle eyebrow="3 · CRÉNEAU" title="Choisissez la date et l'heure" /><View style={styles.dateRow}><Pressable onPress={() => reloadSlots(addDays(date, -1))} style={styles.dateButton}><Text style={styles.dateButtonText}>‹</Text></Pressable><View style={styles.dateCenter}><Text style={styles.dateText}>{dateLabel(date)}</Text><Text style={styles.dateCode}>{date}</Text></View><Pressable onPress={() => reloadSlots(addDays(date, 1))} style={styles.dateButton}><Text style={styles.dateButtonText}>›</Text></Pressable></View><View style={styles.slotGrid}>{slots.filter(slot => slot.available).map(slot => <Pressable key={slot.time} onPress={() => setTime(slot.time)} style={[styles.slot, time === slot.time && styles.selectedSlot]}><Text style={[styles.slotText, time === slot.time && styles.selectedSlotText]}>{slot.time}</Text></Pressable>)}</View>{time && <><Field label="Nom complet" value={name} onChangeText={setName} placeholder="Votre nom" /><Field label="Téléphone" value={phone} onChangeText={setPhone} placeholder="Votre numéro" keyboardType="phone-pad" /><Field label="Email (optionnel)" value={email} onChangeText={setEmail} placeholder="vous@email.com" keyboardType="email-address" /><Field label="Sujet (optionnel)" value={subject} onChangeText={setSubject} placeholder="Motif du rendez-vous" /><PrimaryButton label={loading ? 'Réservation...' : 'Confirmer le rendez-vous'} onPress={submit} disabled={!name.trim() || !phone.trim() || loading} /></>}</>}
  </ScreenLayout>
}

function AppointmentHeroBanner() {
  return <View style={[styles.ticketHero, styles.appointmentHero]}>
    <View style={[styles.ticketHeroOrb, styles.appointmentHeroOrb]} />
    <View style={styles.ticketHeroOrbSmall} />
    <View style={styles.ticketHeroCopy}><Text style={styles.ticketHeroEyebrow}>RENDEZ-VOUS BTK EASY</Text><View style={styles.ticketHeroLine} /><Text style={styles.ticketHeroTitle}>Un rendez-vous, simplement.</Text><Text style={styles.ticketHeroText}>Choisissez votre agence, votre conseiller et le créneau qui vous convient.</Text></View>
    <View style={styles.ticketHeroVisual}><View style={styles.ticketHeroVisualRing} /><View style={styles.ticketHeroBadge}><Text style={styles.ticketHeroBadgeText}>RDV</Text><Text style={styles.ticketHeroBadgeSmall}>EASY</Text></View></View>
  </View>
}

function AppointmentResultCard({ result, onReset }: { result: Appointment; onReset: () => void }) {
  return (
    <View style={styles.confirmCard}>
      <View style={styles.confirmHeader}>
        <View style={styles.confirmIcon}><Ionicons name="checkmark" size={32} color="#FFFFFF" /></View>
        <View style={styles.confirmBadge}><Text style={styles.confirmBadgeText}>CONFIRMÉ</Text></View>
      </View>
      <Text style={styles.confirmEyebrow}>RENDEZ-VOUS CONFIRMÉ</Text>
      <Text style={styles.confirmLead}>Votre rendez-vous est bien enregistré.</Text>
      <View style={styles.referencePanel}>
        <Text style={styles.referenceLabel}>CODE DE RÉSERVATION</Text>
        <Text style={styles.reference}>{result.reference}</Text>
      </View>
      <View style={styles.confirmDetails}>
        <View style={styles.confirmDetail}><Ionicons name="calendar-outline" size={19} color={COLORS.primary} /><View><Text style={styles.confirmDetailLabel}>Date et heure</Text><Text style={styles.confirmDetailValue}>{dateLabel(result.date)} à {result.time}</Text></View></View>
        <View style={styles.confirmDetail}><Ionicons name="person-outline" size={19} color={COLORS.primary} /><View><Text style={styles.confirmDetailLabel}>Client</Text><Text style={styles.confirmDetailValue}>{result.customerName}</Text></View></View>
      </View>
      <Text style={styles.ticketHint}>Conservez ce code pour consulter ou annuler votre rendez-vous.</Text>
      <PrimaryButton label="Nouveau rendez-vous" onPress={onReset} />
    </View>
  )
}

function AppointmentScreen({ agencies, pushToken, initialAgency, onBack }: { agencies: Agency[]; pushToken: string | null; initialAgency?: Agency | null; onBack: () => void }) {
  const [stage, setStage] = useState<string>(initialAgency ? 'charge' : 'agency')
  const [agency, setAgency] = useState<Agency | null>(initialAgency ?? null)
  const [charges, setCharges] = useState<Charge[]>([])
  const [charge, setCharge] = useState<Charge | null>(null)
  const [date, setDate] = useState(todayInputDate())
  const [slots, setSlots] = useState<Slot[]>([])
  const [time, setTime] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [result, setResult] = useState<Appointment | null>(null)
  const [loading, setLoading] = useState(false)
  const [agencyPage, setAgencyPage] = useState(1)

  const agencyPageCount = Math.max(1, Math.ceil(agencies.length / MOBILE_AGENCIES_PER_PAGE))
  const paginatedAgencies = useMemo(() => agencies.slice((agencyPage - 1) * MOBILE_AGENCIES_PER_PAGE, agencyPage * MOBILE_AGENCIES_PER_PAGE), [agencies, agencyPage])

  useEffect(() => {
    setAgencyPage(page => Math.min(page, agencyPageCount))
  }, [agencyPageCount])

  useEffect(() => {
    if (!initialAgency) return
    setAgency(initialAgency)
    setStage('charge')
    setLoading(true)
    api<Charge[]>(`/api/charges?agencyId=${initialAgency.id}`)
      .then(data => setCharges(data.filter(item => item.isActive !== false)))
      .catch(() => {
        setCharges([])
        Alert.alert('Erreur', 'Impossible de charger les chargés.')
      })
      .finally(() => setLoading(false))
  }, [initialAgency])

  async function chooseAgency(value: Agency) {
    setAgency(value); setCharge(null); setSlots([]); setTime(''); setStage('charge'); setLoading(true)
    try { setCharges((await api<Charge[]>(`/api/charges?agencyId=${value.id}`)).filter(item => item.isActive !== false)) } catch { setCharges([]); Alert.alert('Erreur', 'Impossible de charger les chargés.') } finally { setLoading(false) }
  }

  async function chooseCharge(value: Charge) {
    setCharge(value); setTime(''); setStage('calendar'); setLoading(true)
    try { const data = await api<{ slots: Slot[] }>(`/api/charges/${value.id}/availability?date=${date}`); setSlots(data.slots || []) } catch { setSlots([]); Alert.alert('Calendrier indisponible', 'Réessayez dans quelques instants.') } finally { setLoading(false) }
  }

  async function reloadSlots(nextDate: string) {
    const safeDate = isValidInputDate(nextDate) ? nextDate : todayInputDate()
    setDate(safeDate); setTime('')
    if (!charge) return
    setLoading(true)
    try { const data = await api<{ slots: Slot[] }>(`/api/charges/${charge.id}/availability?date=${safeDate}`); setSlots(data.slots || []) } catch { setSlots([]) } finally { setLoading(false) }
  }

  async function submit() {
    if (!charge || !time || !name.trim() || !phone.trim()) return
    setLoading(true)
    try { const data = await api<{ appointment: Appointment }>('/api/appointments', { method: 'POST', body: JSON.stringify({ chargeId: charge.id, date, time, customerName: name, customerPhone: phone, customerEmail: email, subject, pushToken, pushPlatform: Platform.OS }) }); await scheduleAppointmentReminders(data.appointment); setResult(data.appointment) } catch (error) { Alert.alert('Réservation impossible', error instanceof Error ? error.message : 'Créneau indisponible.') } finally { setLoading(false) }
  }

  if (result) return <ScreenLayout title="Rendez-vous confirmé" onBack={onBack}><AppointmentResultCard result={result} onReset={() => { setResult(null); setStage('agency'); setAgency(null); setCharge(null) }} /></ScreenLayout>

  const goBack = () => stage === 'calendar' ? setStage('charge') : stage === 'charge' ? setStage('agency') : onBack()
  const isAgencyStage = stage === 'agency'
  if (isAgencyStage) return <ScreenLayout title="Prendre rendez-vous" onBack={onBack}>
    <AppointmentHeroBanner />
    <StepProgress current={1} total={3} label="Choisir une agence" description="Sélectionnez l'agence où vous souhaitez prendre rendez-vous." />
    <SectionTitle eyebrow="1 · AGENCE" title="Choisissez une agence" />
    <View style={styles.appointmentAgencyGrid}>
      {paginatedAgencies.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Choisir l'agence ${item.name}`} onPress={() => chooseAgency(item)} style={({ pressed }) => [styles.appointmentAgencyCard, pressed && styles.pressed]}>
        <View style={styles.appointmentAgencyHeader}><View style={styles.appointmentAgencyCode}><Text style={styles.appointmentAgencyCodeText}>{item.code}</Text></View><Text style={styles.appointmentAgencyChevron}>›</Text></View>
        <Text style={styles.appointmentAgencyName} numberOfLines={2}>{item.name}</Text>
        <Text style={styles.appointmentAgencyCity} numberOfLines={1}>{item.city}</Text>
        <View style={styles.appointmentAgencyFooter}><View style={styles.appointmentAgencyDot} /><Text style={styles.appointmentAgencyStatus}>Disponible</Text></View>
      </Pressable>)}
    </View>
    {agencies.length === 0 && <Text style={styles.emptyText}>Aucune agence disponible.</Text>}
    <AgencyPagination page={agencyPage} pageCount={agencyPageCount} onChange={setAgencyPage} />
  </ScreenLayout>
  return <ScreenLayout title="Prendre rendez-vous" onBack={goBack}>
    <StepProgress current={stage === 'agency' ? 1 : stage === 'charge' ? 2 : 3} total={3} label={stage === 'agency' ? 'Choisir une agence' : stage === 'charge' ? 'Choisir un chargé' : 'Choisir un créneau'} />
    {stage === 'agency' && <><SectionTitle eyebrow="1 · AGENCE" title="Choisissez une agence" />{agencies.map(item => <Pressable key={item.id} onPress={() => chooseAgency(item)} style={styles.selectRow}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{item.code}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName}>{item.name}</Text><Text style={styles.agencyMeta}>{item.city}</Text></View><Text style={styles.rowChevron}>›</Text></Pressable>)}</>}
    {stage === 'charge' && <><View style={styles.selectedAgencyBanner}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{agency?.code}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName}>{agency?.name}</Text><Text style={styles.agencyMeta}>Agence sélectionnée</Text></View></View><SectionTitle eyebrow="2 · CONSEILLER" title="Choisissez un chargé" />{loading && !charges.length ? <ActivityIndicator color="#0065a1" /> : charges.map(item => <Pressable key={item.id} onPress={() => chooseCharge(item)} style={styles.selectRow}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{item.code}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName}>{item.name}</Text><Text style={styles.agencyMeta}>{item.agencyName || agency?.name}</Text></View><Text style={styles.rowChevron}>›</Text></Pressable>)}</>}
    {stage === 'calendar' && charge && <><View style={styles.selectedAgencyBanner}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{charge.code}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName}>{charge.name}</Text><Text style={styles.agencyMeta}>{agency?.name}</Text></View></View><SectionTitle eyebrow="3 · CRÉNEAU" title="Choisissez la date et l'heure" /><View style={styles.dateRow}><Pressable onPress={() => reloadSlots(addDays(date, -1))} style={styles.dateButton}><Text style={styles.dateButtonText}>‹</Text></Pressable><View style={styles.dateCenter}><Text style={styles.dateText}>{dateLabel(date)}</Text><Text style={styles.dateCode}>{date}</Text></View><Pressable onPress={() => reloadSlots(addDays(date, 1))} style={styles.dateButton}><Text style={styles.dateButtonText}>›</Text></Pressable></View><View style={styles.slotGrid}>{slots.filter(slot => slot.available).map(slot => <Pressable key={slot.time} onPress={() => setTime(slot.time)} style={[styles.slot, time === slot.time && styles.selectedSlot]}><Text style={[styles.slotText, time === slot.time && styles.selectedSlotText]}>{slot.time}</Text></Pressable>)}</View>{!slots.some(slot => slot.available) && !loading && <Text style={styles.emptyText}>Aucun créneau disponible pour cette date.</Text>}{time && <><Field label="Nom complet" value={name} onChangeText={setName} placeholder="Votre nom" /><Field label="Téléphone" value={phone} onChangeText={setPhone} placeholder="Votre numéro" keyboardType="phone-pad" /><Field label="Email (optionnel)" value={email} onChangeText={setEmail} placeholder="vous@email.com" keyboardType="email-address" /><Field label="Sujet (optionnel)" value={subject} onChangeText={setSubject} placeholder="Motif du rendez-vous" /><PrimaryButton label={loading ? 'Réservation...' : 'Confirmer le rendez-vous'} onPress={submit} disabled={!name.trim() || !phone.trim() || loading} /></>}</>}
  </ScreenLayout>
}

function ScreenHeroBanner() {
  return <View style={styles.screenHero}>
    <View style={styles.screenHeroOrb} />
    <View style={styles.screenHeroCopy}>
      <Text style={styles.screenHeroEyebrow}>SUIVI EN DIRECT</Text>
      <Text style={styles.screenHeroTitle}>Suivez votre agence en temps réel.</Text>
      <Text style={styles.screenHeroText}>Consultez le numéro appelé et l’état de la file en quelques secondes.</Text>
    </View>
    <View style={styles.screenHeroBadge}><Text style={styles.screenHeroBadgeText}>LIVE</Text></View>
  </View>
}

function ScreenDisplayWelcome({ agency, serviceOpen }: { agency: Agency; serviceOpen: boolean }) {
  return <View style={styles.screenDisplayWelcome}>
    <View style={styles.screenDisplayOrbTop} />
    <View style={styles.screenDisplayOrbBottom} />
    <View style={styles.screenDisplayBrand}><View style={styles.screenDisplayLogoFrame}><Image source={APP_ICON} style={styles.screenDisplayLogo} /></View><View style={styles.screenDisplayBrandCopy}><Text style={styles.screenDisplayBrandName}>BTK EASY</Text><Text style={styles.screenDisplayAgency}>{agency.name}</Text><Text style={styles.screenDisplayCity}>{agency.city}</Text></View></View>
    <View style={styles.screenDisplayWelcomeTitle}><Text style={styles.screenDisplayWelcomeText}>Bienvenue à</Text><Text style={styles.screenDisplayWelcomeText}>Notre Agence.</Text></View>
    <View style={styles.screenDisplayStatusRow}><View style={[styles.screenDisplayStatusDot, { backgroundColor: serviceOpen ? COLORS.success : COLORS.error }]} /><Text style={[styles.screenDisplayStatusText, { color: serviceOpen ? '#15803D' : '#B91C1C' }]}>{serviceOpen ? 'Service ouvert' : 'Service fermé'}</Text><Text style={styles.screenDisplayStatusHours}>08:00 - 16:30</Text></View>
  </View>
}

function ScreenScreen({ agencies, serviceOpen, onBack }: { agencies: Agency[]; serviceOpen: boolean; onBack: () => void }) {
  const [agency, setAgency] = useState<Agency | null>(null)
  const [data, setData] = useState<ScreenData | null>(null)
  const [agencySearch, setAgencySearch] = useState('')
  const [agencyPage, setAgencyPage] = useState(1)

  const visibleAgencies = useMemo(() => {
    const query = agencySearch.trim().toLowerCase()
    if (!query) return agencies
    return agencies.filter(item => `${item.name} ${item.city} ${item.code}`.toLowerCase().includes(query))
  }, [agencies, agencySearch])

  const agencyPageCount = Math.max(1, Math.ceil(visibleAgencies.length / MOBILE_AGENCIES_PER_PAGE))
  const paginatedAgencies = useMemo(() => visibleAgencies.slice((agencyPage - 1) * MOBILE_AGENCIES_PER_PAGE, agencyPage * MOBILE_AGENCIES_PER_PAGE), [visibleAgencies, agencyPage])

  useEffect(() => {
    setAgencyPage(1)
  }, [agencySearch])

  useEffect(() => {
    setAgencyPage(page => Math.min(page, agencyPageCount))
  }, [agencyPageCount])

  const load = useCallback(async (id: number) => {
    try { setData(await api<ScreenData>(`/api/agency/${id}`)) } catch { setData(null) }
  }, [])

  useEffect(() => {
    if (!agency) return
    load(agency.id)
    const timer = setInterval(() => load(agency.id), 10000)
    return () => clearInterval(timer)
  }, [agency, load])

  if (!agency) return <ScreenLayout title="Écrans en direct" onBack={onBack}>
    <ScreenHeroBanner />
    <SectionTitle eyebrow="EN DIRECT" title="Choisissez une agence" />
    <View style={styles.screenSearchBox}>
      <Text style={styles.screenSearchIcon}>⌕</Text>
      <TextInput accessibilityLabel="Rechercher une agence" value={agencySearch} onChangeText={setAgencySearch} placeholder="Rechercher une agence..." placeholderTextColor={COLORS.muted} style={styles.screenSearchInput} />
    </View>
    <View style={styles.screenResultsHeader}>
      <Text style={styles.screenResultsCount}>{visibleAgencies.length} agences</Text>
      <Text style={styles.screenResultsHint}>Actualisation en direct</Text>
    </View>
    <View style={styles.screenAgencyGrid}>
      {paginatedAgencies.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Voir l'écran de ${item.name}`} onPress={() => setAgency(item)} style={({ pressed }) => [styles.screenAgencyCard, pressed && styles.pressed]}>
        <View style={styles.screenAgencyTop}><View style={styles.screenAgencyCode}><Text style={styles.screenAgencyCodeText}>{item.code}</Text></View><Text style={styles.screenAgencyChevron}>›</Text></View>
        <Text style={styles.screenAgencyName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.screenAgencyCity} numberOfLines={1}>{item.city}</Text>
        <View style={styles.screenAgencyStatus}><View style={styles.screenAgencyDot} /><Text style={styles.screenAgencyStatusText}>Voir l’écran</Text></View>
      </Pressable>)}
    </View>
    {visibleAgencies.length === 0 && <Text style={styles.emptyText}>Aucune agence ne correspond à votre recherche.</Text>}
    <AgencyPagination page={agencyPage} pageCount={agencyPageCount} onChange={setAgencyPage} />
  </ScreenLayout>

  const queue = data?.queue || []
  const waitingCount = data?.queue?.length ?? agency.waitingCount
  const hasCalledTicket = Boolean(data?.called?.number)

  return <ScreenLayout title={agency.name} onBack={() => { setAgency(null); setData(null) }}>
    <ScreenDisplayWelcome agency={agency} serviceOpen={serviceOpen} />
    {serviceOpen ? <>
    <View style={styles.liveCard}>
      <View style={styles.liveCardHeader}>
        <View><Text style={styles.liveCardEyebrow}>TICKET APPELÉ</Text><Text style={styles.liveCardSubtitle}>Dernier passage appelé</Text></View>
        <View style={styles.liveStatusBadge}><View style={[styles.liveStatusDot, { backgroundColor: hasCalledTicket ? COLORS.success : COLORS.alert }]} /><Text style={styles.liveStatusText}>{hasCalledTicket ? 'EN COURS' : 'EN ATTENTE'}</Text></View>
      </View>
      <View style={styles.liveNumberPanel}><Text style={styles.liveNumber}>{data?.called?.number ?? '—'}</Text></View>
      <Text style={styles.liveGuichet}>{data?.called?.guichet?.label || 'En attente d’un appel'}</Text>
    </View>

    <View style={styles.queueSectionHeader}><View><Text style={styles.liveSectionEyebrow}>FILE D'ATTENTE</Text><Text style={styles.liveSectionTitle}>{waitingCount} ticket(s) en attente</Text></View><View style={styles.queueCountBadge}><Text style={styles.queueCountBadgeText}>{waitingCount}</Text></View></View>
    <View style={styles.queueCard}>
      {queue.slice(0, 10).map((item, index) => <View key={item.number} style={[styles.queueRow, index === Math.min(queue.length, 10) - 1 && styles.queueRowLast]}>
        <View style={styles.queuePosition}><Text style={styles.queuePositionText}>{index + 1}</Text></View>
        <Text style={styles.queueNumber}>{item.number}</Text>
        <View style={styles.queueCopy}><Text style={styles.queueService}>{item.service}</Text><Text style={styles.queueMeta}>En attente</Text></View>
        <Text style={styles.queueChevron}>›</Text>
      </View>)}
      {queue.length === 0 && <View style={styles.queueEmpty}><Ionicons name="checkmark-circle-outline" size={28} color={COLORS.success} /><Text style={styles.queueEmptyTitle}>Aucun ticket en attente</Text><Text style={styles.queueEmptyText}>La file est actuellement vide.</Text></View>}
    </View>
    <View style={styles.liveHintRow}><Ionicons name="time-outline" size={15} color={COLORS.muted} /><Text style={styles.liveHint}>Mise à jour automatique toutes les 10 secondes.</Text></View>
    </> : <View style={styles.screenClosedCard}>
      <Text style={styles.screenClosedEyebrow}>HORS HORAIRES DE TRAVAIL</Text>
      <View style={styles.screenClosedLabel}><Ionicons name="lock-closed-outline" size={22} color="#FFFFFF" /><Text style={styles.screenClosedLabelText}>GUICHET FERMÉ</Text></View>
      <Text style={styles.screenClosedText}>Merci de votre confiance.</Text>
      <Text style={styles.screenClosedHours}>Horaires : 08:00 - 16:30</Text>
    </View>}
  </ScreenLayout>
}

function ScreenLayout({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return <><AppHeader title={title} onBack={onBack} /><ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView></>
}

function Notice({ text }: { text: string }) { return <View style={styles.notice}><Text style={styles.noticeText}>{text}</Text></View> }

function BottomNavigation({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ key: Tab; label: string; icon: string }> = [{ key: 'home', label: 'Accueil', icon: '⌂' }, { key: 'ticket', label: 'Ticket', icon: '▣' }, { key: 'appointment', label: 'Rendez-vous', icon: '□' }, { key: 'screen', label: 'Écran', icon: '▤' }]
  return <View style={styles.bottomNav}>{items.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: tab === item.key }} onPress={() => onChange(item.key)} style={({ pressed }) => [styles.navItem, pressed && styles.navPressed]}><View style={[styles.navIconWrap, tab === item.key && styles.navIconWrapActive]}><Text style={[styles.navIcon, tab === item.key && styles.navActive]}>{item.icon}</Text></View><Text style={[styles.navLabel, tab === item.key && styles.navActive]}>{item.label}</Text></Pressable>)}</View>
}

function BottomNavigationPro({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ key: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
    { key: 'home', label: 'Accueil', icon: 'home-outline' },
    { key: 'activity', label: 'Activité', icon: 'pulse-outline' },
    { key: 'ticket', label: 'Ticket', icon: 'ticket-outline' },
    { key: 'appointment', label: 'Rendez-vous', icon: 'calendar-outline' },
    { key: 'screen', label: 'Écran', icon: 'desktop-outline' },
  ]

  return (
    <View style={styles.bottomNavPro}>
      {items.map(item => {
        const active = tab === item.key
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [styles.navItemPro, pressed && styles.navPressedPro]}
          >
            <View style={[styles.navIconWrapPro, active && styles.navIconWrapActivePro]}>
              <Ionicons name={item.icon} size={active ? 23 : 22} color={active ? '#FFFFFF' : '#5E7491'} />
            </View>
            <Text style={[styles.navLabelPro, active && styles.navLabelActivePro]}>{item.label}</Text>
            <View style={[styles.navIndicatorPro, !active && styles.navIndicatorHiddenPro]} />
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  splashRoot: { position: 'absolute', zIndex: 100, top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#061A32' },
  splashGlowOne: { position: 'absolute', width: 390, height: 390, top: -155, right: -105, borderRadius: 195, backgroundColor: 'rgba(0, 102, 164, 0.48)' },
  splashGlowTwo: { position: 'absolute', width: 330, height: 330, bottom: -155, left: -125, borderRadius: 165, backgroundColor: 'rgba(39, 197, 245, 0.18)' },
  splashGlowThree: { position: 'absolute', width: 230, height: 230, top: '36%', left: '38%', borderRadius: 115, backgroundColor: 'rgba(0, 102, 164, 0.16)' },
  splashGrainLayer: StyleSheet.absoluteFill,
  splashGrainDot: { position: 'absolute', borderRadius: 5, backgroundColor: '#D9F7FF' },
  splashCenter: { width: '100%', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  splashLogoZone: { width: 260, height: 260, alignItems: 'center', justifyContent: 'center' },
  splashRing: { position: 'absolute', width: 198, height: 198, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(119, 226, 255, 0.9)' },
  splashRingOuter: { width: 222, height: 222, borderRadius: 111, borderStyle: 'dashed' },
  splashPulse: { position: 'absolute', width: 158, height: 158, borderRadius: 79, backgroundColor: 'rgba(39, 197, 245, 0.3)' },
  splashOrbit: { position: 'absolute', width: 250, height: 250, borderRadius: 125 },
  splashOrbitNode: { position: 'absolute', width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(181, 242, 255, 0.65)', backgroundColor: 'rgba(255, 255, 255, 0.13)', shadowColor: '#27C5F5', shadowOpacity: 0.45, shadowRadius: 12, elevation: 4 },
  splashOrbitTop: { top: 0, left: 103 },
  splashOrbitRight: { right: 3, bottom: 28 },
  splashOrbitBottom: { bottom: 28, left: 3 },
  splashLogoFrame: { width: 168, height: 168, alignItems: 'center', justifyContent: 'center' },
  splashSpinner: { position: 'absolute', width: 168, height: 168, borderRadius: 32, borderWidth: 2, borderTopColor: '#7CE7FF', borderRightColor: 'rgba(124, 231, 255, 0.8)', borderBottomColor: 'rgba(124, 231, 255, 0.12)', borderLeftColor: 'rgba(124, 231, 255, 0.1)' },
  splashGlassCard: { width: 148, height: 148, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.42)', backgroundColor: 'rgba(255, 255, 255, 0.15)', shadowColor: '#27C5F5', shadowOpacity: 0.4, shadowRadius: 22, elevation: 8 },
  splashLogo: { width: 122, height: 122, borderRadius: 24, resizeMode: 'contain' },
  splashReflection: { position: 'absolute', width: 26, height: 190, backgroundColor: 'rgba(255, 255, 255, 0.28)' },
  splashTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  splashTitle: { color: '#FFFFFF', fontSize: 34, lineHeight: 40, fontWeight: '900', letterSpacing: 0.2 },
  splashTagline: { color: '#B9E7F7', fontSize: 10, fontWeight: '800', letterSpacing: 2.2, textAlign: 'center', marginTop: 9 },
  splashProgressArea: { width: '76%', marginTop: 42 },
  splashProgressTrack: { height: 4, overflow: 'hidden', borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.18)' },
  splashProgressFill: { height: 4, borderRadius: 2, backgroundColor: '#72E4FF', shadowColor: '#72E4FF', shadowOpacity: 0.9, shadowRadius: 8, elevation: 3 },
  splashPercent: { color: '#D9F7FF', fontSize: 11, fontWeight: '800', textAlign: 'right', marginTop: 8 },
  splashFooter: { position: 'absolute', bottom: 34, color: 'rgba(217, 247, 255, 0.62)', fontSize: 9, fontWeight: '800', letterSpacing: 1.8 },
  splashReveal: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.background },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  header: { position: 'relative', minHeight: 82, flexDirection: 'row', alignItems: 'center', paddingHorizontal: SPACING.lg, overflow: 'hidden', backgroundColor: COLORS.deep },
  headerGlow: { position: 'absolute', width: 250, height: 150, right: -80, bottom: -105, borderRadius: 125, backgroundColor: 'rgba(39,197,245,0.25)' },
  headerGlowSmall: { position: 'absolute', width: 150, height: 100, right: 60, top: -72, borderRadius: 75, backgroundColor: 'rgba(0,102,164,0.42)' },
  headerSpacer: { width: 40 },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backText: { color: COLORS.surface, fontSize: 38, fontWeight: '300', lineHeight: 38 },
  brandMarkImage: { width: 54, height: 64, borderRadius: 8, resizeMode: 'contain', overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)' },
  brandMark: { width: 40, height: 40, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  brandMarkText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  headerTitle: { flex: 1, marginLeft: SPACING.md },
  brandName: { color: COLORS.surface, fontSize: 20, fontWeight: '900' },
  headerSubtitle: { color: '#C7E5F7', fontSize: 13, marginTop: 3 },
  menuButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', backgroundColor: 'rgba(255,255,255,0.12)' },
  menuText: { color: COLORS.surface, fontSize: 24, fontWeight: '800' },
  menuOverlay: { flex: 1, justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 88, paddingHorizontal: SPACING.lg, backgroundColor: COLORS.overlay },
  menuPanel: { width: '92%', padding: SPACING.lg, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, ...SHADOW.hero },
  menuPanelHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuLogo: { width: 48, height: 48, borderRadius: RADIUS.md, marginRight: SPACING.md },
  menuPanelTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  menuPanelSubtitle: { color: COLORS.muted, fontSize: 12, marginTop: 3 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 58, paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  menuItemText: { color: COLORS.text, fontSize: 16, fontWeight: '800' },
  menuItemChevron: { color: COLORS.primary, fontSize: 25 },
  menuClose: { alignItems: 'center', marginTop: SPACING.lg, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: COLORS.light },
  menuCloseText: { color: COLORS.primary, fontSize: 14, fontWeight: '900' },
  agencyActionOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.overlay },
  agencyActionSheet: { padding: SPACING.xl, paddingBottom: Platform.OS === 'ios' ? 34 : SPACING.xl, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: COLORS.surface, ...SHADOW.hero },
  agencyActionHandle: { alignSelf: 'center', width: 44, height: 5, marginBottom: SPACING.lg, borderRadius: 3, backgroundColor: '#CBD5E1' },
  agencyActionEyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  agencyActionTitle: { color: COLORS.text, fontSize: 23, fontWeight: '900', marginTop: 5 },
  agencyActionMeta: { color: COLORS.success, fontSize: 13, fontWeight: '800', marginTop: 5, marginBottom: SPACING.lg },
  agencyActionButton: { flexDirection: 'row', alignItems: 'center', minHeight: 74, padding: SPACING.md, marginTop: SPACING.sm, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#D7E7F2', backgroundColor: COLORS.surface },
  agencyActionButtonPrimary: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  agencyActionIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)' },
  agencyActionIconLight: { backgroundColor: COLORS.light },
  agencyActionCopy: { flex: 1, marginHorizontal: SPACING.md },
  agencyActionButtonTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  agencyActionButtonText: { color: '#D7F3FF', fontSize: 11, lineHeight: 16, marginTop: 3 },
  agencyActionButtonTitleSecondary: { color: COLORS.text, fontSize: 15, fontWeight: '900' },
  agencyActionButtonTextSecondary: { color: COLORS.muted, fontSize: 11, lineHeight: 16, marginTop: 3 },
  agencyActionCancel: { alignItems: 'center', padding: SPACING.md, marginTop: SPACING.sm },
  agencyActionCancelText: { color: COLORS.muted, fontSize: 13, fontWeight: '900' },
  scrollContent: { padding: SPACING.xl, paddingBottom: 148, backgroundColor: COLORS.background },
  heroCarousel: { marginBottom: SPACING.xxl },
  homeHero: { position: 'relative', width: '100%', height: MOBILE_BANNER_HEIGHT, padding: SPACING.xxl, borderRadius: 30, overflow: 'hidden', backgroundColor: COLORS.primary, ...SHADOW.hero },
  heroSlide: { flexShrink: 0 },
  heroSlideDark: { backgroundColor: COLORS.dark },
  heroSlideDeep: { backgroundColor: COLORS.deep },
  heroContent: { zIndex: 2, maxWidth: '78%' },
  heroEyebrow: { color: '#D7F3FF', fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  heroAccentLine: { width: 48, height: 4, marginTop: 13, borderRadius: 2, backgroundColor: COLORS.accent },
  heroTitle: { color: '#fff', fontSize: 30, lineHeight: 34, fontWeight: '900', marginTop: 13 },
  heroText: { color: '#EAF5FC', fontSize: 14, lineHeight: 21, marginTop: 11 },
  statusLine: { flexDirection: 'row', alignItems: 'center', marginTop: 18 },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  heroAction: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 16, paddingHorizontal: 14, paddingVertical: 9, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.16)' },
  heroActionText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  heroActionChevron: { color: '#fff', fontSize: 20, lineHeight: 17, marginLeft: 8 },
  heroOrb: { position: 'absolute', width: 220, height: 220, right: -74, top: -65, borderRadius: 110, backgroundColor: 'rgba(39,197,245,0.22)' },
  heroOrbCyan: { backgroundColor: 'rgba(39,197,245,0.28)' },
  heroOrbLight: { backgroundColor: 'rgba(255,255,255,0.14)' },
  heroOrbSmall: { position: 'absolute', width: 150, height: 150, right: -45, bottom: -72, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.12)' },
  heroVisual: { position: 'absolute', right: 16, top: 50, width: 104, height: 150, alignItems: 'center', justifyContent: 'center', opacity: 0.88 },
  heroVisualRing: { position: 'absolute', width: 142, height: 142, borderRadius: 71, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', transform: [{ rotate: '25deg' }] },
  heroVisualBadge: { width: 82, height: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 22, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)', backgroundColor: 'rgba(255,255,255,0.16)', transform: [{ rotate: '-8deg' }] },
  heroVisualSymbol: { color: '#fff', fontSize: 25, fontWeight: '900' },
  heroVisualLabel: { color: '#D7F3FF', fontSize: 9, fontWeight: '900', letterSpacing: 2, marginTop: 5 },
  heroDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 },
  heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#C8D8E8' },
  heroDotActive: { width: 22, backgroundColor: COLORS.primary },
  sectionTitle: { marginTop: SPACING.xxl, marginBottom: SPACING.md },
  eyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  sectionHeading: { color: COLORS.text, fontSize: 22, fontWeight: '900', marginTop: SPACING.xs },
  activityHero: { padding: SPACING.xl, marginBottom: SPACING.lg, borderRadius: RADIUS.xl, backgroundColor: COLORS.dark, ...SHADOW.hero },
  activityEyebrow: { color: '#9DEBFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  activityTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 6 },
  activitySubtitle: { color: '#BBD9EB', fontSize: 12, lineHeight: 18, marginTop: 5 },
  activityFilters: { flexDirection: 'row', gap: 8, marginBottom: SPACING.xl },
  activityFilter: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#DCEAF4', backgroundColor: '#FFFFFF' },
  activityFilterActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  activityFilterText: { color: COLORS.primary, fontSize: 11, fontWeight: '900' },
  activityFilterTextActive: { color: '#FFFFFF' },
  activityLoader: { marginVertical: SPACING.lg },
  activitySectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  activityCount: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: COLORS.light },
  activityCountText: { color: COLORS.primary, fontSize: 15, fontWeight: '900' },
  activityEmpty: { alignItems: 'center', padding: SPACING.xl, marginBottom: SPACING.xl, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: '#DCEAF4', backgroundColor: '#FFFFFF' },
  activityEmptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900', marginTop: SPACING.sm },
  activityEmptyText: { color: COLORS.muted, fontSize: 12, textAlign: 'center', marginTop: 4 },
  activitySubheading: { color: COLORS.text, fontSize: 15, fontWeight: '900', marginTop: SPACING.md, marginBottom: SPACING.sm },
  activityTicketCard: { padding: SPACING.lg, marginBottom: SPACING.md, borderRadius: RADIUS.xl, backgroundColor: COLORS.dark, ...SHADOW.hero },
  activityTicketCardCalled: { backgroundColor: '#062C52' },
  activityTicketCardClosed: { backgroundColor: '#64748B' },
  activityTicketHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md },
  activityCardEyebrow: { color: '#9DEBFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  activityTicketNumber: { color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 4 },
  activityTicketService: { color: '#BBD9EB', fontSize: 12, fontWeight: '700', marginTop: 3 },
  activityStatusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.12)', maxWidth: '45%' },
  activityStatusPillCalled: { backgroundColor: 'rgba(39,197,245,0.22)' },
  activityStatusPillClosed: { backgroundColor: 'rgba(255,255,255,0.1)' },
  activityLiveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5, backgroundColor: '#27C5F5' },
  activityLiveDotCalled: { backgroundColor: '#4ADE80' },
  activityLiveDotClosed: { backgroundColor: '#CBD5E1' },
  activityStatusText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', flexShrink: 1 },
  activityTicketLead: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1, marginTop: SPACING.lg },
  activityTicketStats: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: SPACING.md },
  activityPeopleAhead: { color: '#FFFFFF', fontSize: 22, fontWeight: '900' },
  activityPeopleAheadLabel: { fontSize: 12, fontWeight: '700' },
  activityProgressText: { color: '#9DEBFF', fontSize: 18, fontWeight: '900' },
  activityProgressTrack: { height: 11, overflow: 'hidden', marginTop: SPACING.sm, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.16)' },
  activityProgressFill: { height: '100%', borderRadius: 6, backgroundColor: '#149BEF' },
  activityTicketFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: SPACING.lg, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  activityFooterRight: { alignItems: 'flex-end' },
  activityMetaLabel: { color: '#91B7D2', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  activityMetaValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 3 },
  activityGuichet: { color: '#D9F7FF', fontSize: 12, fontWeight: '800', marginTop: SPACING.md },
  activityAppointmentCard: { padding: SPACING.lg, marginBottom: SPACING.md, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: '#CFE3F0', backgroundColor: '#FFFFFF', ...SHADOW.card },
  activityAppointmentHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  activityAppointmentIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: COLORS.primary },
  activityAppointmentCopy: { flex: 1 },
  activityAppointmentTitle: { color: COLORS.text, fontSize: 15, fontWeight: '900', marginTop: 3 },
  activityConfirmedBadge: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: '#ECFDF3' },
  activityConfirmedText: { color: '#15803D', fontSize: 9, fontWeight: '900' },
  activityAppointmentDate: { color: COLORS.primary, fontSize: 15, fontWeight: '900', marginTop: SPACING.lg },
  activityAppointmentMeta: { color: COLORS.muted, fontSize: 12, fontWeight: '700', marginTop: 5 },
  activityAppointmentSubject: { color: COLORS.text, fontSize: 12, fontWeight: '700', marginTop: SPACING.sm },
  activityReference: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.7, marginTop: SPACING.md },
  activityCancelButton: { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 9, marginTop: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#FCA5A5' },
  activityCancelButtonText: { color: '#B91C1C', fontSize: 11, fontWeight: '900' },
  actionCard: { flexDirection: 'row', alignItems: 'center', minHeight: 86, padding: SPACING.md, marginBottom: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, ...SHADOW.card },
  primaryCard: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  actionIcon: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.light },
  primaryIcon: { backgroundColor: 'rgba(255,255,255,.15)' },
  actionIconText: { color: COLORS.primary, fontSize: 22, fontWeight: '800' },
  primaryIconText: { color: '#fff' },
  actionCopy: { flex: 1, marginLeft: SPACING.md },
  actionTitle: { color: COLORS.text, fontSize: 16, fontWeight: '900' },
  actionDescription: { color: COLORS.muted, fontSize: 12, lineHeight: 17, marginTop: SPACING.xs },
  primaryCardText: { color: '#fff' },
  primaryCardMuted: { color: '#dbeafe' },
  chevron: { color: COLORS.primary, fontSize: 27, fontWeight: '300' },
  liveFilters: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.sm },
  liveFilterButton: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  liveFilterButtonActive: { borderColor: COLORS.primary, backgroundColor: COLORS.light },
  liveFilterButtonText: { color: COLORS.muted, fontSize: 11, fontWeight: '800', textAlign: 'center' },
  liveFilterButtonTextActive: { color: COLORS.primary },
  statCard: { flex: 1, padding: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, ...SHADOW.card },
  statValue: { color: COLORS.text, fontSize: 26, fontWeight: '900' },
  statLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '600', marginTop: SPACING.xs },
  agencyList: { marginTop: SPACING.md, overflow: 'hidden', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  agencyRow: { flexDirection: 'row', alignItems: 'center', minHeight: 68, padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  agencyCode: { width: 54, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.light },
  agencyCodeText: { color: COLORS.primary, fontSize: 10, fontWeight: '900' },
  agencyCopy: { flex: 1, marginHorizontal: SPACING.md },
  agencyName: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  agencyMeta: { color: COLORS.muted, fontSize: 12, marginTop: SPACING.xs },
  rowChevron: { color: COLORS.primary, fontSize: 24 },
  selectRow: { flexDirection: 'row', alignItems: 'center', minHeight: 76, padding: SPACING.md, marginBottom: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, ...SHADOW.card },
  selectedRow: { borderColor: COLORS.primary, backgroundColor: COLORS.light },
  radio: { color: COLORS.primary, fontSize: 20 },
  searchLabel: { color: COLORS.text, fontSize: 12, fontWeight: '800', marginBottom: SPACING.sm },
  searchInput: { minHeight: 50, paddingHorizontal: SPACING.md, marginBottom: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text, fontSize: 14, backgroundColor: COLORS.surface },
  stepProgress: { padding: SPACING.lg, marginBottom: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.light },
  stepProgressHeader: { flexDirection: 'row', alignItems: 'center' },
  stepNumber: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: COLORS.primary },
  stepNumberText: { color: COLORS.surface, fontSize: 20, fontWeight: '900' },
  stepProgressCopy: { flex: 1, marginLeft: SPACING.md },
  stepProgressText: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  stepProgressLabel: { color: COLORS.text, fontSize: 15, fontWeight: '800', marginTop: SPACING.xs },
  stepProgressDescription: { color: '#6B8AAE', fontSize: 12, marginTop: 3 },
  stepTrack: { height: 6, marginTop: SPACING.md, overflow: 'hidden', borderRadius: 3, backgroundColor: '#D9E8F3' },
  stepFill: { height: 6, borderRadius: 3, backgroundColor: COLORS.primary },
  screenHero: { position: 'relative', width: '100%', height: MOBILE_BANNER_HEIGHT, padding: SPACING.xl, marginBottom: SPACING.lg, overflow: 'hidden', borderRadius: 28, backgroundColor: COLORS.dark, ...SHADOW.hero },
  screenHeroOrb: { position: 'absolute', width: 210, height: 210, right: -82, top: -78, borderRadius: 105, backgroundColor: 'rgba(39,197,245,0.24)' },
  screenHeroCopy: { zIndex: 2, maxWidth: '78%' },
  screenHeroEyebrow: { color: '#9DEBFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  screenHeroTitle: { color: COLORS.surface, fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 9 },
  screenHeroText: { color: '#D7EDF8', fontSize: 12, lineHeight: 18, marginTop: 8 },
  screenHeroBadge: { position: 'absolute', right: 18, bottom: 18, width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.12)' },
  screenHeroBadgeText: { color: COLORS.surface, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  screenDisplayWelcome: { position: 'relative', minHeight: 228, padding: SPACING.lg, marginBottom: SPACING.lg, overflow: 'hidden', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: '#D5E7F5', backgroundColor: '#EEF7FF', ...SHADOW.card },
  screenDisplayOrbTop: { position: 'absolute', width: 150, height: 150, right: -70, top: -72, borderRadius: 75, backgroundColor: 'rgba(0,102,164,0.10)' },
  screenDisplayOrbBottom: { position: 'absolute', width: 120, height: 120, left: -65, bottom: -70, borderRadius: 60, backgroundColor: 'rgba(0,102,164,0.10)' },
  screenDisplayBrand: { flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  screenDisplayLogoFrame: { width: 68, height: 78, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#D5E7F5', backgroundColor: COLORS.surface, ...SHADOW.card },
  screenDisplayLogo: { width: 54, height: 66, resizeMode: 'contain' },
  screenDisplayBrandCopy: { flex: 1, marginLeft: SPACING.lg },
  screenDisplayBrandName: { color: COLORS.primary, fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },
  screenDisplayAgency: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 5 },
  screenDisplayCity: { color: COLORS.muted, fontSize: 11, fontWeight: '600', marginTop: 3 },
  screenDisplayWelcomeTitle: { paddingLeft: SPACING.md, marginTop: 20, borderLeftWidth: 4, borderLeftColor: COLORS.primary, zIndex: 2 },
  screenDisplayWelcomeText: { color: COLORS.deep, fontSize: 27, lineHeight: 31, fontWeight: '900' },
  screenDisplayStatusRow: { flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.md, marginTop: SPACING.lg, borderTopWidth: 1, borderTopColor: '#D5E7F5', zIndex: 2 },
  screenDisplayStatusDot: { width: 8, height: 8, marginRight: 6, borderRadius: 4 },
  screenDisplayStatusText: { fontSize: 11, fontWeight: '900' },
  screenDisplayStatusHours: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginLeft: 'auto' },
  screenClosedCard: { alignItems: 'center', justifyContent: 'center', minHeight: 265, padding: SPACING.xl, marginBottom: SPACING.lg, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FFF1F2', ...SHADOW.card },
  screenClosedEyebrow: { color: '#EF4444', fontSize: 11, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center' },
  screenClosedLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: SPACING.lg, marginTop: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: '#DC2626', ...SHADOW.card },
  screenClosedLabelText: { color: COLORS.surface, fontSize: 23, fontWeight: '900', marginLeft: SPACING.sm },
  screenClosedText: { color: '#991B1B', fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'center', marginTop: SPACING.lg },
  screenClosedHours: { color: '#B91C1C', fontSize: 12, fontWeight: '800', marginTop: SPACING.md },
  screenSearchBox: { flexDirection: 'row', alignItems: 'center', height: 50, paddingHorizontal: SPACING.md, marginBottom: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  screenSearchIcon: { color: COLORS.primary, fontSize: 24, marginRight: SPACING.sm },
  screenSearchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: COLORS.text, fontSize: 13 },
  screenResultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  screenResultsCount: { color: COLORS.primary, fontSize: 14, fontWeight: '900' },
  screenResultsHint: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  screenAgencyGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  screenAgencyCard: { width: '48.2%', minHeight: 154, marginBottom: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, ...SHADOW.card },
  screenAgencyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  screenAgencyCode: { width: 52, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm, backgroundColor: COLORS.light },
  screenAgencyCodeText: { color: COLORS.primary, fontSize: 10, fontWeight: '900' },
  screenAgencyChevron: { color: COLORS.primary, fontSize: 24, fontWeight: '300' },
  screenAgencyName: { color: COLORS.text, fontSize: 14, fontWeight: '900', marginTop: SPACING.md },
  screenAgencyCity: { color: COLORS.muted, fontSize: 11, marginTop: SPACING.xs },
  screenAgencyStatus: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', paddingTop: SPACING.sm },
  screenAgencyDot: { width: 7, height: 7, marginRight: 5, borderRadius: 4, backgroundColor: COLORS.success },
  screenAgencyStatusText: { color: COLORS.success, fontSize: 10, fontWeight: '800' },
  agencyPagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, marginTop: SPACING.xs, paddingHorizontal: SPACING.xs },
  paginationButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.surface },
  paginationButtonDisabled: { borderColor: COLORS.border, backgroundColor: '#F2F6FA' },
  paginationButtonText: { color: COLORS.primary, fontSize: 25, lineHeight: 28, fontWeight: '700' },
  paginationButtonTextDisabled: { color: '#AAB8C6' },
  paginationLabel: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  ticketHero: { position: 'relative', width: '100%', height: MOBILE_BANNER_HEIGHT, padding: SPACING.xxl, marginBottom: SPACING.lg, overflow: 'hidden', borderRadius: 28, backgroundColor: COLORS.primary, ...SHADOW.hero },
  appointmentHero: { backgroundColor: COLORS.dark },
  appointmentHeroOrb: { backgroundColor: 'rgba(39,197,245,0.22)' },
  ticketHeroCopy: { zIndex: 2, maxWidth: '76%' },
  ticketHeroEyebrow: { color: '#D7F3FF', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  ticketHeroLine: { width: 42, height: 3, marginTop: 10, borderRadius: 2, backgroundColor: COLORS.accent },
  ticketHeroTitle: { color: COLORS.surface, fontSize: 25, lineHeight: 29, fontWeight: '900', marginTop: 10 },
  ticketHeroText: { color: COLORS.light, fontSize: 12, lineHeight: 18, marginTop: 9 },
  ticketHeroStatus: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 14 },
  ticketHeroStatusText: { color: COLORS.surface, fontSize: 11, fontWeight: '900' },
  ticketHeroDivider: { color: '#B7DBF1', fontSize: 16, marginHorizontal: 9 },
  ticketHeroHours: { color: COLORS.surface, fontSize: 11, fontWeight: '800' },
  ticketHeroOrb: { position: 'absolute', width: 220, height: 220, right: -82, top: -70, borderRadius: 110, backgroundColor: 'rgba(39,197,245,0.28)' },
  ticketHeroOrbSmall: { position: 'absolute', width: 150, height: 150, right: -45, bottom: -72, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.14)' },
  ticketHeroVisual: { position: 'absolute', right: 12, top: 42, width: 90, height: 125, alignItems: 'center', justifyContent: 'center', opacity: 0.85 },
  ticketHeroVisualRing: { position: 'absolute', width: 130, height: 130, borderRadius: 65, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)', transform: [{ rotate: '25deg' }] },
  ticketHeroBadge: { width: 70, height: 84, alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', backgroundColor: 'rgba(255,255,255,0.17)', transform: [{ rotate: '-8deg' }] },
  ticketHeroBadgeText: { color: COLORS.surface, fontSize: 22, fontWeight: '900' },
  ticketHeroBadgeSmall: { color: '#D7F3FF', fontSize: 8, fontWeight: '900', letterSpacing: 1.5, marginTop: 3 },
  ticketToolsRow: { flexDirection: 'row', alignItems: 'stretch', gap: SPACING.sm, marginBottom: SPACING.md },
  ticketSearchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 54, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  ticketSearchIcon: { color: '#7892B0', fontSize: 26, marginRight: SPACING.sm },
  ticketSearchInput: { flex: 1, minWidth: 0, paddingVertical: 0, color: COLORS.text, fontSize: 13 },
  locationButton: { flex: 0.72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, minHeight: 54, paddingHorizontal: SPACING.sm, marginBottom: 0, borderRadius: RADIUS.md, backgroundColor: COLORS.light },
  locationIcon: { color: COLORS.primary, fontSize: 21 },
  locationButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: '900' },
  agencyResultsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  agencyResultsCount: { color: COLORS.primary, fontSize: 16, fontWeight: '900' },
  agencyResultsHint: { color: COLORS.muted, fontSize: 11, fontWeight: '700' },
  ticketAgencyGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  ticketAgencyCard: { width: '48%', minHeight: 154, marginBottom: SPACING.md, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, ...SHADOW.card },
  appointmentAgencyGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: SPACING.md },
  appointmentAgencyCard: { width: '48%', minHeight: 150, padding: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, ...SHADOW.card },
  appointmentAgencyHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appointmentAgencyCode: { minWidth: 54, height: 38, paddingHorizontal: SPACING.sm, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm, backgroundColor: COLORS.light },
  appointmentAgencyCodeText: { color: COLORS.primary, fontSize: 10, fontWeight: '900' },
  appointmentAgencyChevron: { color: COLORS.primary, fontSize: 25, fontWeight: '300' },
  appointmentAgencyName: { color: COLORS.text, fontSize: 14, lineHeight: 18, fontWeight: '900', marginTop: SPACING.md },
  appointmentAgencyCity: { color: COLORS.muted, fontSize: 11, marginTop: SPACING.xs },
  appointmentAgencyFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 'auto', paddingTop: SPACING.sm },
  appointmentAgencyDot: { width: 7, height: 7, marginRight: 5, borderRadius: 4, backgroundColor: COLORS.success },
  appointmentAgencyStatus: { color: COLORS.success, fontSize: 10, fontWeight: '800' },
  ticketAgencyTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ticketAgencyCopy: { minWidth: 0, marginTop: SPACING.md },
  ticketAgencyName: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  ticketAgencyCity: { color: COLORS.muted, fontSize: 12, marginTop: SPACING.xs },
  ticketAgencyMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border },
  nearestSelectedRow: { borderWidth: 2, borderColor: COLORS.primary, backgroundColor: '#F1F8FF', shadowColor: COLORS.primary, shadowOpacity: 0.14, shadowRadius: 12, elevation: 4 },
  agencyWait: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginTop: SPACING.xs },
  nearestWait: { color: COLORS.primary },
  nearestCard: { padding: SPACING.lg, marginBottom: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#A8D8BE', backgroundColor: '#F1FBF5', ...SHADOW.card },
  nearestEyebrow: { color: COLORS.success, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  nearestName: { color: COLORS.text, fontSize: 17, fontWeight: '900', marginTop: SPACING.xs },
  nearestMeta: { color: COLORS.success, fontSize: 12, fontWeight: '700', marginTop: SPACING.xs },
  selectedAgencyBanner: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, marginBottom: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.light },
  selectedAgencyCard: { flexDirection: 'row', alignItems: 'center', minHeight: 104, padding: SPACING.lg, marginBottom: SPACING.xl, borderRadius: RADIUS.xl, backgroundColor: COLORS.light },
  selectedAgencyIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, backgroundColor: '#D8ECFF' },
  selectedAgencyIconText: { color: COLORS.primary, fontSize: 29 },
  selectedAgencyCopy: { flex: 1, marginLeft: SPACING.md },
  selectedAgencyLabel: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  selectedAgencyName: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: SPACING.xs },
  selectedAgencyMeta: { color: COLORS.muted, fontSize: 12, marginTop: SPACING.xs },
  selectedAgencyChevron: { color: COLORS.primary, fontSize: 30, fontWeight: '300' },
  serviceHeading: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.sm, marginBottom: SPACING.lg },
  serviceStepNumber: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: COLORS.primary },
  serviceStepNumberText: { color: COLORS.surface, fontSize: 18, fontWeight: '900' },
  serviceHeadingCopy: { flex: 1, marginLeft: SPACING.md },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
  serviceCard: { width: '31%', minHeight: 112, padding: SPACING.md, justifyContent: 'space-between', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, ...SHADOW.card },
  serviceIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: COLORS.light },
  serviceIconText: { color: COLORS.primary, fontSize: 22, fontWeight: '900' },
  selectedServiceCard: { borderColor: COLORS.primary, backgroundColor: COLORS.primary, ...SHADOW.hero },
  selectedServiceIcon: { backgroundColor: 'rgba(255,255,255,0.18)' },
  serviceCardText: { color: COLORS.text, fontSize: 13, fontWeight: '900' },
  serviceCardChevron: { position: 'absolute', right: SPACING.md, top: SPACING.md, color: '#7892B0', fontSize: 25, lineHeight: 24 },
  serviceChip: { width: '31%', minHeight: 58, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xs, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  selectedService: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  serviceChipText: { color: COLORS.text, fontSize: 12, fontWeight: '800', textAlign: 'center' },
  selectedServiceText: { color: '#fff' },
  primaryButton: { minHeight: 58, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.lg, paddingHorizontal: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: COLORS.primary, ...SHADOW.card },
  primaryButtonContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', gap: SPACING.md },
  primaryButtonIcon: { color: COLORS.surface, fontSize: 22 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  primaryButtonTrailing: { color: COLORS.surface, fontSize: 25, lineHeight: 22, marginLeft: 'auto' },
  disabledButton: { opacity: 0.45 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.99 }] },
  ticketCard: { padding: SPACING.xl, alignItems: 'stretch', borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#D7E7F2', ...SHADOW.card },
  resultHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md },
  resultEyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  resultAgency: { color: COLORS.text, fontSize: 17, fontWeight: '900', marginTop: 5 },
  resultStatus: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: '#ECFDF3' },
  resultStatusDot: { width: 7, height: 7, marginRight: 6, borderRadius: 4, backgroundColor: COLORS.success },
  resultStatusText: { color: '#15803D', fontSize: 10, fontWeight: '900' },
  ticketNumberPanel: { alignItems: 'center', paddingVertical: SPACING.lg, marginTop: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: '#EFF7FC' },
  ticketNumberLabel: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  cardEyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center' },
  ticketNumber: { color: COLORS.primary, fontSize: 76, lineHeight: 84, fontWeight: '900', marginTop: SPACING.xs },
  ticketService: { color: COLORS.text, fontSize: 18, fontWeight: '800' },
  ticketStats: { flexDirection: 'row', width: '100%', gap: 10, marginTop: SPACING.md },
  resultStatCard: { flex: 1, padding: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: '#DCEAF4', backgroundColor: '#F8FBFE' },
  resultStatValue: { color: COLORS.text, fontSize: 24, fontWeight: '900' },
  resultStatLabel: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  ticketHint: { color: COLORS.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: SPACING.lg },
  routeButton: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, padding: SPACING.md, marginTop: SPACING.lg, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.surface },
  routeButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: '900' },
  serviceClosedBanner: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, marginBottom: SPACING.lg, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#DC2626', ...SHADOW.card },
  serviceClosedIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.md, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)' },
  serviceClosedCopy: { flex: 1 },
  serviceClosedTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  serviceClosedText: { color: '#FEE2E2', fontSize: 11, fontWeight: '700', marginTop: 3 },
  notice: { padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: '#FFF6E8', marginBottom: SPACING.lg },
  noticeText: { color: '#A76616', fontSize: 12, fontWeight: '700' },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dateButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.light },
  dateButtonText: { color: COLORS.primary, fontSize: 28 },
  dateCenter: { alignItems: 'center' },
  dateText: { color: '#102746', fontSize: 13, fontWeight: '900', textTransform: 'capitalize' },
  dateCode: { color: '#64748b', fontSize: 10, marginTop: 3 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '23%', paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.sm, borderWidth: 1, borderColor: '#B9D8F4', backgroundColor: COLORS.light },
  selectedSlot: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  slotText: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
  selectedSlotText: { color: '#fff' },
  field: { marginTop: 13 },
  fieldLabel: { color: '#334155', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  input: { minHeight: 50, paddingHorizontal: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, color: COLORS.text, fontSize: 14, backgroundColor: COLORS.surface },
  confirmCard: { alignItems: 'stretch', padding: SPACING.xl, borderRadius: RADIUS.xl, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: '#C9ECD6', ...SHADOW.card },
  confirmHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirmIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: 29, backgroundColor: COLORS.success, shadowColor: COLORS.success, shadowOpacity: 0.25, shadowRadius: 10, elevation: 4 },
  confirmBadge: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: '#ECFDF3' },
  confirmBadgeText: { color: '#15803D', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  confirmEyebrow: { color: COLORS.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1.2, textAlign: 'center', marginTop: SPACING.lg },
  confirmLead: { color: COLORS.muted, fontSize: 13, textAlign: 'center', marginTop: 6 },
  referencePanel: { alignItems: 'center', paddingVertical: SPACING.md, marginTop: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: '#EFF7FC' },
  referenceLabel: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  reference: { color: COLORS.text, fontSize: 38, fontWeight: '900', letterSpacing: 4, marginTop: 5 },
  confirmDetails: { gap: 10, marginTop: SPACING.lg },
  confirmDetail: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: SPACING.md, borderRadius: RADIUS.md, backgroundColor: '#F8FBFE' },
  confirmDetailLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '700' },
  confirmDetailValue: { color: COLORS.text, fontSize: 13, fontWeight: '800', marginTop: 2 },
  confirmText: { color: '#334155', fontSize: 14, fontWeight: '700', marginTop: SPACING.sm, textAlign: 'center', textTransform: 'capitalize' },
  liveAgencySummary: { padding: SPACING.lg, marginBottom: SPACING.lg, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: '#DCEAF4', backgroundColor: COLORS.surface, ...SHADOW.card },
  liveAgencySummaryTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md },
  liveAgencySummaryCopy: { flex: 1, minWidth: 0 },
  liveAgencyEyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  liveAgencyName: { color: COLORS.text, fontSize: 21, fontWeight: '900', marginTop: 5 },
  liveAgencyMeta: { color: COLORS.muted, fontSize: 12, fontWeight: '600', marginTop: 3 },
  liveOnlineBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: '#ECFDF3' },
  liveOnlineDot: { width: 7, height: 7, marginRight: 5, borderRadius: 4, backgroundColor: COLORS.success },
  liveOnlineText: { color: '#15803D', fontSize: 9, fontWeight: '900' },
  liveRefreshRow: { flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.md, marginTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  liveRefreshText: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginLeft: 6 },
  liveCard: { padding: SPACING.xl, marginBottom: SPACING.xxl, borderRadius: RADIUS.xl, backgroundColor: COLORS.dark, ...SHADOW.hero },
  liveCardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.md },
  liveCardEyebrow: { color: '#9DEBFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  liveCardSubtitle: { color: '#BBD9EB', fontSize: 11, marginTop: 5 },
  liveStatusBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.12)' },
  liveStatusDot: { width: 7, height: 7, marginRight: 5, borderRadius: 4 },
  liveStatusText: { color: COLORS.surface, fontSize: 9, fontWeight: '900' },
  liveNumberPanel: { minHeight: 112, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.lg, borderRadius: RADIUS.lg, backgroundColor: 'rgba(255,255,255,0.10)' },
  liveNumber: { color: COLORS.surface, fontSize: 68, lineHeight: 76, fontWeight: '900' },
  liveGuichet: { color: '#E2F2FB', fontSize: 15, fontWeight: '800', textAlign: 'center', marginTop: SPACING.md },
  queueSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.md },
  liveSectionEyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  liveSectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: '900', marginTop: 4 },
  queueCountBadge: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: COLORS.light },
  queueCountBadgeText: { color: COLORS.primary, fontSize: 16, fontWeight: '900' },
  queueCard: { overflow: 'hidden', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: '#DCEAF4', backgroundColor: COLORS.surface, ...SHADOW.card },
  queueRow: { flexDirection: 'row', alignItems: 'center', minHeight: 72, paddingHorizontal: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  queueRowLast: { borderBottomWidth: 0 },
  queuePosition: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', marginRight: SPACING.sm, borderRadius: 15, backgroundColor: COLORS.light },
  queuePositionText: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
  queueNumber: { width: 50, color: COLORS.text, fontSize: 21, fontWeight: '900' },
  queueCopy: { flex: 1, minWidth: 0, marginLeft: SPACING.sm },
  queueService: { color: COLORS.text, fontSize: 14, fontWeight: '800' },
  queueMeta: { color: COLORS.muted, fontSize: 11, fontWeight: '600', marginTop: 3 },
  queueChevron: { color: COLORS.primary, fontSize: 24, fontWeight: '300' },
  queueEmpty: { alignItems: 'center', padding: SPACING.xxl },
  queueEmptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '900', marginTop: SPACING.sm },
  queueEmptyText: { color: COLORS.muted, fontSize: 12, marginTop: 4 },
  liveHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: SPACING.lg },
  liveHint: { flex: 1, color: COLORS.muted, fontSize: 11, textAlign: 'center', marginLeft: 6 },
  emptyText: { padding: 18, color: '#94a3b8', fontSize: 12, textAlign: 'center' },
  bottomNav: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', paddingTop: SPACING.sm, paddingBottom: Platform.OS === 'ios' ? 25 : SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.border, backgroundColor: COLORS.surface, ...SHADOW.nav },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 58 },
  navPressed: { opacity: 0.72 },
  navIconWrap: { minWidth: 46, height: 31, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.pill },
  navIconWrapActive: { backgroundColor: COLORS.light },
  navIcon: { color: '#7A8DA3', fontSize: 20 },
  navLabel: { color: '#7A8DA3', fontSize: 11, fontWeight: '800', marginTop: SPACING.xs },
  navActive: { color: COLORS.primary },
  bottomNavPro: { position: 'absolute', left: 12, right: 12, bottom: 8, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', paddingTop: 7, paddingBottom: Platform.OS === 'ios' ? 10 : 8, borderRadius: 24, borderWidth: 1, borderColor: '#EAF0F6', backgroundColor: COLORS.surface, ...SHADOW.nav },
  navItemPro: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', minHeight: 76 },
  navPressedPro: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  navIconWrapPro: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  navIconWrapActivePro: { backgroundColor: '#0D86E8', shadowColor: '#0D86E8', shadowOpacity: 0.25, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  navLabelPro: { color: '#667D99', fontSize: 10, fontWeight: '700', marginTop: 3, textAlign: 'center' },
  navLabelActivePro: { color: '#0B72CE', fontWeight: '900' },
  navIndicatorPro: { width: 38, height: 4, marginTop: 6, borderRadius: 2, backgroundColor: '#0D86E8' },
  navIndicatorHiddenPro: { opacity: 0 },
})
