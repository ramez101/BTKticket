import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Dimensions,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Linking,
  Modal,
  Appearance,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  useColorScheme,
  useWindowDimensions,
  View as NativeView,
} from 'react-native'
import type { AlertButton, ColorValue, TextProps, ViewProps } from 'react-native'
import type { ScrollViewInstance } from 'react-native'
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler'
import Reanimated, {
  Easing as ReanimatedEasing,
  FadeInRight,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { BlurTargetView, BlurView } from 'expo-blur'
import { isRunningInExpoGo } from 'expo'
import Constants from 'expo-constants'
import { getLocales } from 'expo-localization'
import * as Location from 'expo-location'
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { COLORS, RADIUS, SHADOW, SPACING } from './theme'

const APP_ICON = require('./assets/BTK.png')
const SPLASH_ICON = require('./assets/icon.png')
const MOBILE_BANNER_HEIGHT = 240
const MOBILE_AGENCIES_PER_PAGE = 10
const SETTINGS_STORAGE_KEY = 'btk-easy:app-settings'

type ThemePreference = 'light' | 'dark' | 'automatic'
type AppLanguage = 'fr' | 'ar' | 'en'
type AppSettings = {
  theme: ThemePreference
  language: AppLanguage
}

function getSystemLanguage(): AppLanguage {
  const languageCode = getLocales()[0]?.languageCode?.toLowerCase()
  if (languageCode === 'ar' || languageCode === 'en') return languageCode
  return 'fr'
}

const DEFAULT_SETTINGS: AppSettings = { theme: 'automatic', language: getSystemLanguage() }
let activeDarkMode = false
let activeLanguage: AppLanguage = 'fr'
const SettingsContext = createContext({
  settings: DEFAULT_SETTINGS,
  darkMode: false,
  language: 'fr' as AppLanguage,
})

const ARABIC_TRANSLATIONS: Record<string, string> = {
  'BTK Easy': 'BTK Easy',
  'BTK EASY': 'BTK Easy',
  BTK: 'BTK',
  EASY: 'EASY',
  'Services clients': 'خدمات الحرفاء',
  'Service ouvert': 'الخدمة مفتوحة',
  'Service fermé': 'الخدمة مغلقة',
  NAVIGATION: 'التنقّل',
  Accueil: 'الرئيسية',
  Retour: 'رجوع',
  'Ouvrir le menu': 'فتح القائمة',
  'Fermer le menu': 'إغلاق القائمة',
  'Que souhaitez-vous faire ?': 'ماذا تود أن تفعل؟',
  'Situation des agences': 'حالة الوكالات',
  'Prendre rendez-vous': 'حجز موعد',
  'Prenez votre ticket': 'احصل على تذكرتك',
  'Rendez-vous avec votre chargé': 'موعد مع مستشارك',
  'Suivez votre agence': 'تابع وكالتك',
  'Afficher les 5 agences les plus proches': 'عرض أقرب 5 وكالات',
  "Afficher les 5 agences avec le moins d'attente": 'عرض 5 وكالات بأقل وقت انتظار',
  'Afficher les 5 agences avec le moins d’attente': 'عرض 5 وكالات بأقل وقت انتظار',
  'Localisation...': 'جارٍ تحديد الموقع...',
  'Centrale': 'المركزية',
  CENTRALE: 'المركزية',
  '1 avant vous': 'شخص واحد قبلك',
  CALENDRIER: 'التقويم',
  'NUMÉRO APPELÉ': 'الرقم الجاري استدعاؤه',
  'Guichet 3': 'الشباك 3',
  'Fermer les horaires': 'إغلاق أوقات العمل',
  'Mon ticket': 'تذكرتي',
  'Création...': 'جارٍ الإنشاء...',
  'Rechercher une agence': 'ابحث عن وكالة',
  "Trouver l'agence la plus proche": 'اعثر على أقرب وكالة',
  '2 · SERVICE': '2 · الخدمة',
  '1 · AGENCE': '1 · الوكالة',
  '2 · CONSEILLER': '2 · المستشار',
  '3 · CRÉNEAU': '3 · الموعد',
  'C’EST VOTRE TOUR !': 'حان دورك!',
  Référence: 'المرجع',
  'Écrans en direct': 'الشاشات مباشرة',
  'Écran': 'الشاشة',
  'EN COURS': 'قيد التنفيذ',
  'Rappel de votre rendez-vous': 'تذكير بموعدك',
  'Erreur': 'خطأ',
  'Impossible de charger les chargés.': 'تعذر تحميل المستشارين.',
  'Calendrier indisponible': 'التقويم غير متاح',
  'Réessayez dans quelques instants.': 'أعد المحاولة بعد قليل.',
  'Réservation impossible': 'تعذر إتمام الحجز',
  'Annulation impossible': 'تعذر الإلغاء',
  'Ticket impossible': 'تعذر إنشاء التذكرة',
  'Service indisponible.': 'الخدمة غير متاحة.',
  'Créneau indisponible.': 'الموعد غير متاح.',
  'Réessayez plus tard.': 'أعد المحاولة لاحقاً.',
  'Enregistrement impossible': 'تعذر حفظ الإعدادات',
  'Vérifiez le stockage de l’appareil puis réessayez.': 'تحقق من مساحة التخزين في الجهاز ثم أعد المحاولة.',
  'Lien indisponible': 'الرابط غير متاح',
  'Vérifiez votre connexion Internet puis réessayez.': 'تحقق من اتصالك بالإنترنت ثم أعد المحاولة.',
  'Autorisez la localisation pour afficher les 5 agences les plus proches.': 'اسمح بالوصول إلى الموقع لعرض أقرب 5 وكالات.',
  "Autorisez la localisation pour trouver l’agence la plus proche.": 'اسمح بالوصول إلى الموقع للعثور على أقرب وكالة.',
  "Autorisez la localisation pour trouver l'agence la plus proche.": 'اسمح بالوصول إلى الموقع للعثور على أقرب وكالة.',
  'Vérifiez le GPS de votre téléphone puis réessayez.': 'تحقق من نظام تحديد المواقع في هاتفك ثم أعد المحاولة.',
  'N’oubliez pas votre rendez-vous demain': 'لا تنسَ موعدك غداً',
  "N'oubliez pas votre rendez-vous demain": 'لا تنسَ موعدك غداً',
  'Votre rendez-vous BTK Easy est dans une heure': 'موعدك مع بي تي كاي إيزي بعد ساعة',
  TICKET: 'تذكرة',
  'EN DIRECT': 'مباشر',
  'VOTRE TOUR APPROCHE': 'اقترب دورك',
  Tous: 'الكل',
  'Mes RDV': 'مواعيدي',
  'Réservation...': 'جارٍ الحجز...',
  RDV: 'موعد',
  LIVE: 'مباشر',
  '2 avant vous': 'شخصان قبلك',
  '3 avant vous': 'ثلاثة أشخاص قبلك',
  '4 avant vous': 'أربعة أشخاص قبلك',
  '5 avant vous': 'خمسة أشخاص قبلك',
  WAITING: 'في الانتظار',
  CALLED: 'حان دورك',
  SERVED: 'تمت الخدمة',
  ABSENT: 'لم يحضر',
  'Appel en cours': 'جارٍ النداء',
  'Aucun appel en cours': 'لا يوجد نداء حالياً',
  'Statut indisponible': 'الحالة غير متاحة',
  'Connexion impossible': 'تعذر الاتصال',
  'Activité indisponible.': 'النشاط غير متاح.',
  'Une erreur est survenue.': 'حدث خطأ.',
  'Autorisez les notifications pour retrouver vos tickets et rendez-vous sur cet appareil.': 'فعّل الإشعارات لمتابعة تذاكرك ومواعيدك على هذا الجهاز.',
  'Activez les notifications pour retrouver vos tickets et rendez-vous sur cet appareil.': 'فعّل الإشعارات لمتابعة تذاكرك ومواعيدك على هذا الجهاز.',
  'Tickets BTK Easy': 'تذاكر بي تي كاي إيزي',
  'Appels de tickets': 'استدعاء التذاكر',
  'Rendez-vous BTK Easy': 'مواعيد بي تي كاي إيزي',
  'C’est votre tour !': 'حان دورك!',
  'Terminé': 'انتهت الخدمة',
  Absent: 'لم يحضر',
  Confirmé: 'تم التأكيد',
  'Votre visite, plus simple.': 'زيارتكم أصبحت أسهل.',
  'Prendre un ticket': 'الحصول على تذكرة',
  "Consultez l'attente et obtenez votre numéro.": 'تابع وقت الانتظار واحصل على رقمك.',
  Ticket: 'تذكرة',
  'Rendez-vous': 'موعد',
  'Réservez un créneau avec un chargé.': 'احجز موعداً مع مستشار.',
  'Voir les écrans': 'مشاهدة الشاشات',
  'Suivez les numéros appelés en agence.': 'تابع الأرقام التي يتم استدعاؤها في الوكالة.',
  'Mon activité': 'نشاطي',
  'Retrouvez vos tickets et rendez-vous.': 'اعثر على تذاكرك ومواعيدك.',
  Fermer: 'إغلاق',
  'À propos': 'من نحن',
  Contact: 'اتصل بنا',
  Horaires: 'أوقات العمل',
  'Horaires de travail': 'أوقات العمل',
  'BANQUE TUNISO-KOWEITIENNE': 'البنك التونسي الكويتي',
  'Agences plus proches': 'أقرب الوكالات',
  Page: 'الصفحة',
  'SUIVI EN TEMPS RÉEL': 'متابعة مباشرة',
  'TICKET #': 'التذكرة رقم',
  'Présentez-vous au': 'توجّه إلى',
  'Veuillez vous présenter au guichet.': 'يرجى التوجّه إلى الشباك.',
  'Votre position se met à jour automatiquement.': 'يتم تحديث موقعك تلقائياً.',
  'Agence BTK': 'وكالة بي تي كاي',
  'Agences disponibles': 'الوكالات المتاحة',
  'EN ATTENTE': 'في الانتظار',
  'En attente d’un appel': 'في انتظار الاستدعاء',
  'ÉTAPE': 'المرحلة',
  'à': 'في',
  'avant vous': 'قبلك',
  personne: 'شخص',
  agences: 'وكالات',
  'agence(s)': 'وكالات',
  'en attente': 'في الانتظار',
  'en attente · ~': 'في الانتظار · حوالي',
  'ticket(s) en attente': 'تذاكر في الانتظار',
  min: 'دقيقة',
  'RENDEZ-VOUS': 'المواعيد',
  'CONFIRMÉ': 'تم التأكيد',
  Disponible: 'متاح',
  SERVICE: 'الخدمة',
  'Conservez ce code pour consulter ou annuler votre rendez-vous.': 'احتفظ بهذا الرمز للاطلاع على موعدك أو إلغائه.',
  '08:00 - 16:30': '08:00 - 16:30',
  'Rechercher une agence...': 'ابحث عن وكالة...',
  'VOTRE BANQUE, PLUS PROCHE DE VOUS': 'بنككم أقرب إليكم',
  'Moins d’attente': 'انتظار أقل',
  "Moins d'attente": 'انتظار أقل',
  'AGENCE SÉLECTIONNÉE': 'الوكالة المختارة',
  'Choisir le service et obtenir votre numéro.': 'اختر الخدمة واحصل على رقمك.',
  'Choisir un chargé et un créneau.': 'اختر مستشاراً وموعداً.',
  'Présentez ce numéro lorsque votre tour est affiché à l’écran.': 'أظهر هذا الرقم عند ظهوره على الشاشة.',
  "Présentez ce numéro lorsque votre tour est affiché à l'écran.": 'أظهر هذا الرقم عند ظهوره على الشاشة.',
  'TICKET CONFIRMÉ': 'تم تأكيد التذكرة',
  'VOTRE NUMÉRO': 'رقمك',
  'Itinéraire vers l’agence': 'المسار إلى الوكالة',
  'SUIVI EN DIRECT': 'متابعة مباشرة',
  'Votre activité BTK Easy': 'نشاطك في بي تي كاي إيزي',
  'Tickets et rendez-vous réunis au même endroit.': 'تذاكرك ومواعيدك في مكان واحد.',
  TICKETS: 'التذاكر',
  'Mes tickets': 'تذاكري',
  'Aucun ticket actif': 'لا توجد تذاكر نشطة',
  'Vos tickets en cours apparaîtront ici.': 'ستظهر تذاكرك الحالية هنا.',
  'Historique des tickets': 'سجل التذاكر',
  'Supprimer l’historique ?': 'حذف السجل؟',
  'Les tickets actifs ne seront pas supprimés.': 'لن يتم حذف التذاكر النشطة.',
  Supprimer: 'حذف',
  'Suppression impossible': 'تعذر الحذف',
  'Mes rendez-vous': 'مواعيدي',
  'Aucun rendez-vous à venir': 'لا توجد مواعيد قادمة',
  'Vos prochaines réservations apparaîtront ici.': 'ستظهر حجوزاتك القادمة هنا.',
  'Rendez-vous passés': 'المواعيد السابقة',
  'ATTENTE ESTIMÉE': 'الانتظار المتوقع',
  'DERNIÈRE MISE À JOUR': 'آخر تحديث',
  'Annuler le rendez-vous': 'إلغاء الموعد',
  'Trouver l’agence la plus proche': 'اعثر على أقرب وكالة',
  'Aucune agence ne correspond à votre recherche.': 'لا توجد وكالة تطابق بحثك.',
  'BIENVENUE SUR BTK EASY': 'مرحباً بكم في بي تي كاي إيزي',
  'Prenez un ticket et suivez votre attente depuis votre téléphone.': 'احصل على تذكرة وتابع وقت انتظارك من هاتفك.',
  'CODE RENDEZ-VOUS': 'رمز الموعد',
  'RENDEZ-VOUS BTK EASY': 'مواعيد بي تي كاي إيزي',
  'Un rendez-vous, simplement.': 'موعد بكل بساطة.',
  'Choisissez votre agence, votre conseiller et le créneau qui vous convient.': 'اختر وكالتك ومستشارك والموعد المناسب لك.',
  'RENDEZ-VOUS CONFIRMÉ': 'تم تأكيد الموعد',
  'Votre rendez-vous est bien enregistré.': 'تم تسجيل موعدك بنجاح.',
  'CODE DE RÉSERVATION': 'رمز الحجز',
  'Date et heure': 'التاريخ والوقت',
  Client: 'الحريف',
  'Bienvenue à': 'مرحباً بكم في',
  'Notre Agence.': 'وكالتنا.',
  'Actualisation en direct': 'تحديث مباشر',
  'Voir l’écran': 'مشاهدة الشاشة',
  'TICKET APPELÉ': 'التذكرة المستدعاة',
  'Dernier passage appelé': 'آخر رقم تم استدعاؤه',
  "FILE D'ATTENTE": 'قائمة الانتظار',
  'Aucun ticket en attente': 'لا توجد تذاكر في الانتظار',
  'La file est actuellement vide.': 'قائمة الانتظار فارغة حالياً.',
  'Aucun numéro appelé pour le moment': 'لم يتم استدعاء أي رقم بعد',
  'Mise à jour impossible': 'تعذّر التحديث',
  'Actualisation...': 'جارٍ التحديث...',
  'HORS HORAIRES DE TRAVAIL': 'خارج أوقات العمل',
  'GUICHET FERMÉ': 'الشباك مغلق',
  'Merci de votre confiance.': 'شكراً لثقتكم.',
  Apparence: 'المظهر',
  'Thème de l’application': 'مظهر التطبيق',
  Clair: 'فاتح',
  Sombre: 'داكن',
  Automatique: 'تلقائي',
  Langue: 'اللغة',
  Français: 'الفرنسية',
  العربية: 'العربية',
  Ouvert: 'مفتوح',
  Fermé: 'مغلق',
  Lundi: 'الاثنين',
  Mardi: 'الثلاثاء',
  Mercredi: 'الأربعاء',
  Jeudi: 'الخميس',
  Vendredi: 'الجمعة',
  Samedi: 'السبت',
  Dimanche: 'الأحد',
  'Choisissez une agence': 'اختر وكالة',
  'Choisissez votre service': 'اختر الخدمة',
  'Choisissez un chargé': 'اختر مستشاراً',
  'Choisissez la date et l’heure': 'اختر التاريخ والوقت',
  "Choisissez la date et l'heure": 'اختر التاريخ والوقت',
  'Voir les agences': 'عرض الوكالات',
  'Réserver maintenant': 'احجز الآن',
  'Réserver un rendez-vous': 'حجز موعد',
  'Agence sélectionnée': 'الوكالة المختارة',
  'Prendre un rendez-vous': 'حجز موعد',
  'Choisir une agence': 'اختر وكالة',
  'Choisir un chargé': 'اختر مستشاراً',
  'Rechercher un chargé...': 'ابحث عن مستشار...',
  'Aucun chargé ne correspond à votre recherche.': 'لا يوجد مستشار يطابق بحثك.',
  'Choisir un créneau': 'اختر موعداً',
  'Nom complet': 'الاسم الكامل',
  Téléphone: 'الهاتف',
  'Email (optionnel)': 'البريد الإلكتروني (اختياري)',
  'Sujet (optionnel)': 'الموضوع (اختياري)',
  'Votre nom': 'اسمك',
  'Votre numéro': 'رقمك',
  'Motif du rendez-vous': 'سبب الموعد',
  'Confirmer le rendez-vous': 'تأكيد الموعد',
  'Rendez-vous confirmé': 'تم تأكيد الموعد',
  'Conservez ce code pour consulter ou annuler le rendez-vous.': 'احتفظ بهذا الرمز للاطلاع على الموعد أو إلغائه.',
  'Nouveau rendez-vous': 'موعد جديد',
  Activité: 'النشاط',
  'Suivi en direct': 'متابعة مباشرة',
  'Suivez votre agence en temps réel.': 'تابع وكالتك مباشرة.',
  'Consultez le numéro appelé et l’état de la file en quelques secondes.': 'اطّلع على الرقم الجاري استدعاؤه وحالة الانتظار.',
  'Prendre un autre ticket': 'الحصول على تذكرة أخرى',
  'Votre tour approche': 'اقترب دورك',
  'Aucune agence disponible.': 'لا توجد وكالة متاحة.',
  'Aucune agence ouverte.': 'لا توجد وكالة مفتوحة.',
  'Aucun créneau disponible pour cette date.': 'لا يوجد موعد متاح في هذا التاريخ.',
  'Service indisponible': 'الخدمة غير متاحة',
  'Date indisponible': 'التاريخ غير متاح',
  'Le service est disponible de 08:00 à 16:30.': 'الخدمة متاحة من 08:00 إلى 16:30.',
  'Tickets en attente': 'التذاكر في الانتظار',
  'En attente': 'في الانتظار',
  'Avant vous': 'قبلك',
  Minutes: 'دقائق',
  'Générer mon ticket': 'إنشاء تذكرتي',
  'Aucun rendez-vous prévu.': 'لا يوجد موعد مبرمج.',
  'Page précédente': 'الصفحة السابقة',
  'Page suivante': 'الصفحة التالية',
  'Localisation refusée': 'تم رفض تحديد الموقع',
  'Localisation indisponible': 'تحديد الموقع غير متاح',
  Annuler: 'إلغاء',
  'Annuler le rendez-vous ?': 'إلغاء الموعد؟',
  'Garder': 'الاحتفاظ',
  'Service de rendez-vous': 'خدمة المواعيد',
  'Les détails de votre rendez-vous': 'تفاصيل موعدك',
  'E-mail du client': 'البريد الإلكتروني للحريف',
  'Prise de rendez-vous': 'حجز موعد',
  'Le service est fermé pour le moment.': 'الخدمة مغلقة حالياً.',
  'Services disponibles': 'الخدمات المتاحة',
  'Caisse': 'الصندوق',
  'Virement': 'تحويل',
  'Crédit': 'قرض',
  'Renseignement': 'استعلام',
  'Chèque': 'شيك',
  'Devise': 'عملة',
}

const ENGLISH_TRANSLATIONS: Record<string, string> = {
  'BTK Easy': 'BTK Easy',
  'BTK EASY': 'BTK Easy',
  'Services clients': 'Customer services',
  'Service ouvert': 'Service open',
  'Service fermé': 'Service closed',
  NAVIGATION: 'NAVIGATION',
  Accueil: 'Home',
  Retour: 'Back',
  'Ouvrir le menu': 'Open menu',
  'Fermer le menu': 'Close menu',
  'Que souhaitez-vous faire ?': 'What would you like to do?',
  'MES SERVICES': 'MY SERVICES',
  'Situation des agences': 'Agency status',
  'Prendre rendez-vous': 'Book an appointment',
  'Prenez votre ticket': 'Get your ticket',
  'Rendez-vous avec votre chargé': 'Appointment with your advisor',
  'Suivez votre agence': 'Track your agency',
  "Consultez l'attente et obtenez votre numéro.": 'Check the queue and get your number.',
  'Consultez l’attente et obtenez votre numéro.': 'Check the queue and get your number.',
  'Afficher les 5 agences les plus proches': 'Show the 5 nearest agencies',
  "Afficher les 5 agences avec le moins d'attente": 'Show the 5 agencies with the shortest wait',
  'Afficher les 5 agences avec le moins d’attente': 'Show the 5 agencies with the shortest wait',
  'Localisation...': 'Locating...',
  Centrale: 'Central',
  CENTRALE: 'CENTRAL',
  '1 avant vous': '1 person ahead',
  CALENDRIER: 'CALENDAR',
  'NUMÉRO APPELÉ': 'NOW CALLING',
  'Guichet 3': 'Counter 3',
  'Fermer les horaires': 'Close opening hours',
  'Mon ticket': 'My ticket',
  'Création...': 'Creating...',
  'Rechercher une agence': 'Search for an agency',
  "Trouver l'agence la plus proche": 'Find the nearest agency',
  '2 · SERVICE': '2 · SERVICE',
  '1 · AGENCE': '1 · AGENCY',
  '2 · CONSEILLER': '2 · ADVISOR',
  '3 · CRÉNEAU': '3 · TIME SLOT',
  'C’EST VOTRE TOUR !': 'IT IS YOUR TURN!',
  Référence: 'Reference',
  'Écrans en direct': 'Live screens',
  Écran: 'Screen',
  'EN COURS': 'IN PROGRESS',
  'Rappel de votre rendez-vous': 'Appointment reminder',
  Erreur: 'Error',
  'Impossible de charger les chargés.': 'Could not load advisors.',
  'Calendrier indisponible': 'Calendar unavailable',
  'Réessayez dans quelques instants.': 'Please try again shortly.',
  'Réservation impossible': 'Booking failed',
  'Annulation impossible': 'Cancellation failed',
  'Ticket impossible': 'Could not create ticket',
  'Service indisponible.': 'Service unavailable.',
  'Créneau indisponible.': 'Time slot unavailable.',
  'Réessayez plus tard.': 'Please try again later.',
  'Enregistrement impossible': 'Could not save settings',
  'Vérifiez le stockage de l’appareil puis réessayez.': 'Check your device storage and try again.',
  'Lien indisponible': 'Link unavailable',
  'Vérifiez votre connexion Internet puis réessayez.': 'Check your internet connection and try again.',
  'Autorisez la localisation pour afficher les 5 agences les plus proches.': 'Allow location access to show the 5 nearest agencies.',
  "Autorisez la localisation pour trouver l’agence la plus proche.": 'Allow location access to find the nearest agency.',
  "Autorisez la localisation pour trouver l'agence la plus proche.": 'Allow location access to find the nearest agency.',
  'Vérifiez le GPS de votre téléphone puis réessayez.': 'Check your phone GPS and try again.',
  TICKET: 'TICKET',
  'EN DIRECT': 'LIVE',
  'VOTRE TOUR APPROCHE': 'YOUR TURN IS APPROACHING',
  Tous: 'All',
  'Mes RDV': 'My appointments',
  'Réservation...': 'Booking...',
  RDV: 'APPT',
  LIVE: 'LIVE',
  WAITING: 'WAITING',
  CALLED: 'YOUR TURN',
  SERVED: 'SERVED',
  ABSENT: 'NO-SHOW',
  'Appel en cours': 'Now calling',
  'Aucun appel en cours': 'No active call',
  'Statut indisponible': 'Status unavailable',
  'Connexion impossible': 'Connection failed',
  'Activité indisponible.': 'Activity unavailable.',
  'Une erreur est survenue.': 'Something went wrong.',
  'Autorisez les notifications pour retrouver vos tickets et rendez-vous sur cet appareil.': 'Allow notifications to follow your tickets and appointments on this device.',
  'Activez les notifications pour retrouver vos tickets et rendez-vous sur cet appareil.': 'Enable notifications to follow your tickets and appointments on this device.',
  'Tickets BTK Easy': 'BTK Easy tickets',
  'Appels de tickets': 'Ticket calls',
  'Rendez-vous BTK Easy': 'BTK Easy appointments',
  'C’est votre tour !': 'It is your turn!',
  Terminé: 'Completed',
  Absent: 'No-show',
  Confirmé: 'Confirmed',
  'Votre visite, plus simple.': 'Your visit, made easier.',
  'Prendre un ticket': 'Get a ticket',
  Ticket: 'Ticket',
  'Rendez-vous': 'Appointment',
  'Réservez un créneau avec un chargé.': 'Book a time slot with an advisor.',
  'Voir les écrans': 'View the screens',
  'Suivez les numéros appelés en agence.': 'Follow the numbers being called at the agency.',
  'Mon activité': 'My activity',
  'Retrouvez vos tickets et rendez-vous.': 'View your tickets and appointments.',
  Fermer: 'Close',
  'À propos': 'About',
  Contact: 'Contact',
  Horaires: 'Opening hours',
  'Horaires de travail': 'Opening hours',
  'BANQUE TUNISO-KOWEITIENNE': 'TUNISIAN-KUWAITI BANK',
  'Agences plus proches': 'Nearest agencies',
  'SUIVI EN TEMPS RÉEL': 'LIVE TRACKING',
  'TICKET #': 'TICKET #',
  'Présentez-vous au': 'Please go to',
  'Veuillez vous présenter au guichet.': 'Please go to the counter.',
  'Votre position se met à jour automatiquement.': 'Your position updates automatically.',
  'Agence BTK': 'BTK agency',
  'Agences disponibles': 'Available agencies',
  'EN ATTENTE': 'WAITING',
  'En attente d’un appel': 'Waiting to be called',
  'ÉTAPE': 'STEP',
  'avant vous': 'ahead of you',
  personne: 'person',
  agences: 'agencies',
  'agence(s)': 'agencies',
  'en attente': 'waiting',
  'ticket(s) en attente': 'tickets waiting',
  min: 'min',
  'RENDEZ-VOUS': 'APPOINTMENT',
  'CONFIRMÉ': 'CONFIRMED',
  Disponible: 'Available',
  SERVICE: 'SERVICE',
  'Conservez ce code pour consulter ou annuler votre rendez-vous.': 'Keep this code to view or cancel your appointment.',
  'Rechercher une agence...': 'Search for an agency...',
  'VOTRE BANQUE, PLUS PROCHE DE VOUS': 'YOUR BANK, CLOSER TO YOU',
  'Moins d’attente': 'Shortest wait',
  "Moins d'attente": 'Shortest wait',
  'AGENCE SÉLECTIONNÉE': 'SELECTED AGENCY',
  'Choisir le service et obtenir votre numéro.': 'Choose a service and get your number.',
  'Choisir un chargé et un créneau.': 'Choose an advisor and a time slot.',
  'Présentez ce numéro lorsque votre tour est affiché à l’écran.': 'Show this number when your turn appears on screen.',
  "Présentez ce numéro lorsque votre tour est affiché à l'écran.": 'Show this number when your turn appears on screen.',
  'TICKET CONFIRMÉ': 'TICKET CONFIRMED',
  'VOTRE NUMÉRO': 'YOUR NUMBER',
  'Itinéraire vers l’agence': 'Directions to the agency',
  'Votre activité BTK Easy': 'Your BTK Easy activity',
  'Tickets et rendez-vous réunis au même endroit.': 'Your tickets and appointments, all in one place.',
  TICKETS: 'TICKETS',
  'Mes tickets': 'My tickets',
  'Aucun ticket actif': 'No active tickets',
  'Vos tickets en cours apparaîtront ici.': 'Your active tickets will appear here.',
  'Historique des tickets': 'Ticket history',
  'Supprimer l’historique ?': 'Delete ticket history?',
  'Les tickets actifs ne seront pas supprimés.': 'Active tickets will not be deleted.',
  Supprimer: 'Delete',
  'Suppression impossible': 'Could not delete history',
  'Mes rendez-vous': 'My appointments',
  'Aucun rendez-vous à venir': 'No upcoming appointments',
  'Vos prochaines réservations apparaîtront ici.': 'Your upcoming bookings will appear here.',
  'Rendez-vous passés': 'Past appointments',
  'ATTENTE ESTIMÉE': 'ESTIMATED WAIT',
  'DERNIÈRE MISE À JOUR': 'LAST UPDATED',
  'Annuler le rendez-vous': 'Cancel appointment',
  'Trouver l’agence la plus proche': 'Find the nearest agency',
  'Aucune agence ne correspond à votre recherche.': 'No agencies match your search.',
  'BIENVENUE SUR BTK EASY': 'WELCOME TO BTK EASY',
  'Prenez un ticket et suivez votre attente depuis votre téléphone.': 'Get a ticket and track your wait from your phone.',
  'CODE RENDEZ-VOUS': 'APPOINTMENT CODE',
  'RENDEZ-VOUS BTK EASY': 'BTK EASY APPOINTMENT',
  'Un rendez-vous, simplement.': 'Appointments, made simple.',
  'Choisissez votre agence, votre conseiller et le créneau qui vous convient.': 'Choose your agency, advisor, and a time that suits you.',
  'RENDEZ-VOUS CONFIRMÉ': 'APPOINTMENT CONFIRMED',
  'Votre rendez-vous est bien enregistré.': 'Your appointment has been booked.',
  'CODE DE RÉSERVATION': 'BOOKING CODE',
  'Date et heure': 'Date and time',
  Client: 'Customer',
  'Bienvenue à': 'Welcome to',
  'Notre Agence.': 'Our Agency.',
  'Actualisation en direct': 'Live updates',
  'Voir l’écran': 'View screen',
  'TICKET APPELÉ': 'NOW CALLING',
  'Dernier passage appelé': 'Last number called',
  "FILE D'ATTENTE": 'QUEUE',
  'Aucun ticket en attente': 'No tickets waiting',
  'La file est actuellement vide.': 'The queue is currently empty.',
  'Aucun numéro appelé pour le moment': 'No number called yet',
  'Mise à jour impossible': 'Refresh failed',
  'Actualisation...': 'Updating...',
  'HORS HORAIRES DE TRAVAIL': 'OUTSIDE OPENING HOURS',
  'GUICHET FERMÉ': 'COUNTER CLOSED',
  'Merci de votre confiance.': 'Thank you for choosing us.',
  Apparence: 'Appearance',
  'Thème de l’application': 'App theme',
  Clair: 'Light',
  Sombre: 'Dark',
  Automatique: 'Automatic',
  Langue: 'Language',
  Français: 'French',
  العربية: 'Arabic',
  English: 'English',
  Ouvert: 'Open',
  Fermé: 'Closed',
  Lundi: 'Monday',
  Mardi: 'Tuesday',
  Mercredi: 'Wednesday',
  Jeudi: 'Thursday',
  Vendredi: 'Friday',
  Samedi: 'Saturday',
  Dimanche: 'Sunday',
  'Choisissez une agence': 'Choose an agency',
  'Choisissez votre service': 'Choose a service',
  'Choisissez un chargé': 'Choose an advisor',
  'Choisissez la date et l’heure': 'Choose a date and time',
  "Choisissez la date et l'heure": 'Choose a date and time',
  'Voir les agences': 'View agencies',
  'Réserver maintenant': 'Book now',
  'Réserver un rendez-vous': 'Book an appointment',
  'Agence sélectionnée': 'Selected agency',
  'Prendre un rendez-vous': 'Book an appointment',
  'Choisir une agence': 'Choose an agency',
  'Choisir un chargé': 'Choose an advisor',
  'Rechercher un chargé...': 'Search for an advisor...',
  'Aucun chargé ne correspond à votre recherche.': 'No advisors match your search.',
  'Choisir un créneau': 'Choose a time slot',
  'Nom complet': 'Full name',
  Téléphone: 'Phone',
  'Email (optionnel)': 'Email (optional)',
  'Sujet (optionnel)': 'Subject (optional)',
  'Votre nom': 'Your name',
  'Votre numéro': 'Your phone number',
  'Motif du rendez-vous': 'Appointment reason',
  'Confirmer le rendez-vous': 'Confirm appointment',
  'Rendez-vous confirmé': 'Appointment confirmed',
  'Nouveau rendez-vous': 'New appointment',
  Activité: 'Activity',
  'Suivi en direct': 'Live tracking',
  'Suivez votre agence en temps réel.': 'Track your agency in real time.',
  'Consultez le numéro appelé et l’état de la file en quelques secondes.': 'Check the number being called and queue status at a glance.',
  'Prendre un autre ticket': 'Get another ticket',
  'Votre tour approche': 'Your turn is approaching',
  'Aucune agence disponible.': 'No agencies available.',
  'Aucune agence ouverte.': 'No agencies are open.',
  'Aucun créneau disponible pour cette date.': 'No time slots available for this date.',
  'Service indisponible': 'Service unavailable',
  'Date indisponible': 'Date unavailable',
  'Le service est disponible de 08:00 à 16:30.': 'The service is available from 08:00 to 16:30.',
  'Tickets en attente': 'Tickets waiting',
  'Mes services': 'My services',
  'En attente': 'Waiting',
  'Avant vous': 'Ahead of you',
  Minutes: 'Minutes',
  'Générer mon ticket': 'Get my ticket',
  'Aucun rendez-vous prévu.': 'No appointments scheduled.',
  'Page précédente': 'Previous page',
  'Page suivante': 'Next page',
  'Localisation refusée': 'Location permission denied',
  'Localisation indisponible': 'Location unavailable',
  Annuler: 'Cancel',
  'Annuler le rendez-vous ?': 'Cancel this appointment?',
  Garder: 'Keep',
  'Service de rendez-vous': 'Appointment service',
  'Les détails de votre rendez-vous': 'Your appointment details',
  'E-mail du client': 'Customer email',
  'Prise de rendez-vous': 'Appointment booking',
  'Le service est fermé pour le moment.': 'The service is currently closed.',
  'Services disponibles': 'Available services',
  Caisse: 'Cash desk',
  Virement: 'Transfer',
  Crédit: 'Credit',
  Renseignement: 'Information',
  Chèque: 'Cheque',
  Devise: 'Foreign currency',
}

function translate(value: string, language: AppLanguage) {
  if (language === 'fr') return value
  const leading = value.match(/^\s*/)?.[0] ?? ''
  const trailing = value.match(/\s*$/)?.[0] ?? ''
  const content = value.trim()
  if (language === 'en') {
    const exact = ENGLISH_TRANSLATIONS[content]
    if (exact) return `${leading}${exact}${trailing}`
    const patterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
      [/^Bonjour (.+),?$/, match => `Hello ${match[1]}`],
      [/^(.+) en attente · ~(.+) min$/, match => `${match[1]} waiting · ~${match[2]} min`],
      [/^~(.+) min$/, match => `~${match[1]} min`],
      [/^Page (\d+) \/ (\d+)$/, match => `Page ${match[1]} / ${match[2]}`],
      [/^De (\d{2}:\d{2}) - (\d{2}:\d{2})$/, match => `From ${match[1]} to ${match[2]}`],
      [/^Horaires\s*:\s*(.+)$/, match => `Opening hours: ${match[1]}`],
      [/^(\d+) agences$/, match => `${match[1]} agencies`],
      [/^(\d+) ticket\(s\) en attente$/, match => `${match[1]} tickets waiting`],
      [/^(\d+) en attente$/, match => `${match[1]} waiting`],
      [/^La plus proche : (.+) km$/, match => `Nearest: ${match[1]} km`],
      [/^(\d+) personne$/, match => `${match[1]} ${Number(match[1]) === 1 ? 'person' : 'people'}`],
      [/^Mis à jour il y a (\d+) s$/, match => `Updated ${match[1]} s ago`],
      [/^(.+) · (.+)$/, match => `${translate(match[1], language)} · ${match[2]}`],
      [/^Référence : (.+)$/, match => `Reference: ${match[1]}`],
      [/^Code : (.+)$/, match => `Code: ${match[1]}`],
      [/^Connexion impossible avec le serveur \((.+)\)\.(?: (.+))?$/, match => `Could not connect to server (${match[1]}).${match[2] ? ` ${match[2]}` : ''}`],
    ]
    for (const [pattern, replacement] of patterns) {
      const match = content.match(pattern)
      if (match) return `${leading}${replacement(match)}${trailing}`
    }
    const reminderTomorrow = content.match(/^N['’]oubliez pas votre rendez-vous demain à (.+) à l'agence BTK Easy\.$/)
    if (reminderTomorrow) return `${leading}Your BTK Easy appointment is tomorrow at ${reminderTomorrow[1]}.${trailing}`
    const reminderSoon = content.match(/^Votre rendez-vous BTK Easy est dans une heure, à (.+)\.$/)
    if (reminderSoon) return `${leading}Your BTK Easy appointment is in one hour, at ${reminderSoon[1]}.${trailing}`
    const ahead = content.match(/^(\d+) avant vous$/)
    if (ahead) return `${leading}${ahead[1]} ${Number(ahead[1]) === 1 ? 'person' : 'people'} ahead${trailing}`
    return `${leading}${content}${trailing}`
  }
  const exact = ARABIC_TRANSLATIONS[content]
  if (exact) return `${leading}${exact}${trailing}`
  const dynamicPatterns: Array<[RegExp, (match: RegExpMatchArray) => string]> = [
    [/^Bonjour (.+),?$/, match => `مرحباً ${match[1]}`],
    [/^(.+) en attente · ~(.+) min$/, match => `${match[1]} في الانتظار · حوالي ${match[2]} دقيقة`],
    [/^~(.+) min$/, match => `حوالي ${match[1]} دقيقة`],
    [/^Page (\d+) \/ (\d+)$/, match => `الصفحة ${match[1]} / ${match[2]}`],
    [/^De (\d{2}:\d{2}) - (\d{2}:\d{2})$/, match => `من ${match[1]} إلى ${match[2]}`],
    [/^Horaires\s*:\s*(.+)$/, match => `أوقات العمل: ${match[1]}`],
    [/^(\d+) agences$/, match => `${match[1]} وكالات`],
    [/^(\d+) ticket\(s\) en attente$/, match => `${match[1]} تذاكر في الانتظار`],
    [/^(\d+) en attente$/, match => `${match[1]} في الانتظار`],
    [/^La plus proche : (.+) km$/, match => `الأقرب: ${match[1]} كم`],
    [/^(\d+) personne$/, match => `${match[1]} شخص`],
    [/^Mis à jour il y a (\d+) s$/, match => `تم التحديث منذ ${match[1]} ث`],
    [/^(\d+) agences$/, match => `${match[1]} وكالات`],
    [/^(.+) · (.+)$/, match => `${translate(match[1], language)} · ${match[2]}`],
    [/^Référence : (.+)$/, match => `المرجع: ${match[1]}`],
    [/^Code : (.+)$/, match => `الرمز: ${match[1]}`],
    [/^Horaires\s*:\s*(\d{2}:\d{2}) - (\d{2}:\d{2})$/, match => `أوقات العمل: ${match[1]} - ${match[2]}`],
    [/^Connexion impossible avec le serveur \((.+)\)\.(?: (.+))?$/, match => `تعذر الاتصال بالخادم (${match[1]}).${match[2] ? ` ${match[2]}` : ''}`],
  ]
  for (const [pattern, replacement] of dynamicPatterns) {
    const match = content.match(pattern)
    if (match) return `${leading}${replacement(match)}${trailing}`
  }
  const reminderTomorrow = content.match(/^N['’]oubliez pas votre rendez-vous demain à (.+) à l'agence BTK Easy\.$/)
  if (reminderTomorrow) return `${leading}لا تنسَ موعدك غداً على الساعة ${reminderTomorrow[1]} في وكالة بي تي كاي إيزي.${trailing}`
  const reminderSoon = content.match(/^Votre rendez-vous BTK Easy est dans une heure, à (.+)\.$/)
  if (reminderSoon) return `${leading}موعدك مع بي تي كاي إيزي بعد ساعة، على الساعة ${reminderSoon[1]}.${trailing}`
  const ahead = content.match(/^(\d+) avant vous$/)
  if (ahead) {
    const number = Number(ahead[1])
    const count = ['صفر', 'شخص واحد', 'شخصان', 'ثلاثة أشخاص', 'أربعة أشخاص', 'خمسة أشخاص', 'ستة أشخاص'][number] ?? `${number} أشخاص`
    return `${leading}${count} قبلك${trailing}`
  }
  const minutes = content.match(/^~?(\d+) min$/)
  if (minutes) {
    const amount = Number(minutes[1])
    const label = amount === 1 ? 'دقيقة واحدة' : amount === 2 ? 'دقيقتان' : `${amount} دقائق`
    return `${leading}حوالي ${label}${trailing}`
  }
  return `${leading}${content}${trailing}`
}

function showAlert(title: string, message: string, buttons?: AlertButton[]) {
  Alert.alert(
    translate(title, activeLanguage),
    translate(message, activeLanguage),
    buttons?.map(button => ({
      ...button,
      text: button.text ? translate(button.text, activeLanguage) : undefined,
    })),
  )
}

function themedColor(color: ColorValue | undefined, darkMode: boolean, type: 'text' | 'surface' | 'border') {
  if (!darkMode || typeof color !== 'string') return color
  const colors: Record<string, string> = type === 'text' ? {
    [COLORS.text]: '#E7EEF6',
    [COLORS.muted]: '#A5B5C5',
    [COLORS.primary]: '#70BFF2',
    [COLORS.dark]: '#A9CDE9',
    [COLORS.deep]: '#D7EAF7',
    '#0E2A55': '#C6DAEE',
    '#0A3F9C': '#87B9EF',
    '#526B82': '#A5B5C5',
    '#7892B0': '#A5B5C5',
  } : type === 'surface' ? {
    [COLORS.background]: '#0B1724',
    [COLORS.surface]: '#142638',
    [COLORS.light]: '#1B3448',
    '#F8FBFE': '#1B2E40',
    '#EFF7FC': '#1A3042',
    '#EEF7FF': '#1A3042',
    '#F1F8FF': '#1B3448',
    '#D9E8F3': '#33495D',
    '#D8ECFF': '#28445D',
  } : {
    [COLORS.border]: '#34495D',
    '#D7E7F2': '#34495D',
    '#DCEAF4': '#34495D',
    '#D5E7F5': '#34495D',
    '#CFE3F0': '#34495D',
  }
  return colors[color.toUpperCase()] ?? colors[color] ?? color
}

const View = React.forwardRef<React.ComponentRef<typeof NativeView>, ViewProps>(({ style, ...props }, ref) => {
  const { darkMode } = useContext(SettingsContext)
  const flattenedStyle = StyleSheet.flatten(style)
  const backgroundColor = themedColor(flattenedStyle?.backgroundColor, darkMode, 'surface')
  const borderColor = themedColor(flattenedStyle?.borderColor, darkMode, 'border')
  return (
    <NativeView
      {...props}
      ref={ref}
      style={darkMode ? [style, { backgroundColor, borderColor }] : style}
    />
  )
})

View.displayName = 'ThemedView'

function Text({ children, style, ...props }: TextProps) {
  const { language, darkMode } = useContext(SettingsContext)
  const flattenedStyle = StyleSheet.flatten(style)
  const localizedChildren = React.Children.map(children, child => (
    typeof child === 'string' ? translate(child, language) : child
  ))
  const color = themedColor(flattenedStyle?.color, darkMode, 'text')
  return (
    <NativeText
      {...props}
      accessibilityLabel={props.accessibilityLabel ? translate(props.accessibilityLabel, language) : undefined}
      style={[
        style,
        darkMode && color ? { color } : undefined,
        language === 'ar' ? { writingDirection: 'rtl', textAlign: flattenedStyle?.textAlign ?? 'right' } : undefined,
      ]}
    >
      {localizedChildren}
    </NativeText>
  )
}

function TextInput(props: React.ComponentProps<typeof NativeTextInput>) {
  const { language, darkMode } = useContext(SettingsContext)
  const leftToRightInput = ['email-address', 'phone-pad', 'numeric', 'number-pad', 'decimal-pad'].includes(props.keyboardType ?? '')
  const flattenedStyle = StyleSheet.flatten(props.style)
  const color = themedColor(flattenedStyle?.color, darkMode, 'text')
  const backgroundColor = themedColor(flattenedStyle?.backgroundColor, darkMode, 'surface')
  const borderColor = themedColor(flattenedStyle?.borderColor, darkMode, 'border')
  return (
    <NativeTextInput
      {...props}
      placeholder={props.placeholder ? translate(props.placeholder, language) : undefined}
      accessibilityLabel={props.accessibilityLabel ? translate(props.accessibilityLabel, language) : undefined}
      placeholderTextColor={darkMode ? '#8296AA' : props.placeholderTextColor}
      style={[
        props.style,
        darkMode ? { color, backgroundColor, borderColor } : undefined,
        language === 'ar' ? { writingDirection: leftToRightInput ? 'ltr' : 'rtl', textAlign: leftToRightInput ? 'left' : 'right' } : undefined,
      ]}
    />
  )
}

SplashScreen.preventAutoHideAsync().catch(() => undefined)

// Load notifications lazily so Expo Go can preview the app without remote push support.
let notificationsModule: typeof import('expo-notifications') | null = null

function getNotificationsModule() {
  if (Platform.OS === 'web') return null
  if (isRunningInExpoGo()) {
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
    || 'http://192.168.10.94:3000'
  ).replace(/\/$/, '')
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

function getChargeInitials(name: string) {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase() || '—'
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
  const url = `${API_BASE_URL}${path}`
  let response: Response
  try {
    response = await fetch(url, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(`Connexion impossible à ${url} : ${reason}`)
  }
  const data = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new Error(data?.error || `Erreur HTTP ${response.status} sur ${path}.`)
  if (data === null) throw new Error(`Réponse invalide du serveur sur ${path}.`)
  return data as T
}

async function registerForPushNotificationsAsync() {
  const Notifications = getNotificationsModule()
  if (!Notifications) return null

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('ticket-updates', {
      name: translate('Tickets BTK Easy', activeLanguage),
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#27C5F5',
    })
    await Notifications.setNotificationChannelAsync('ticket-called', {
      name: translate('Appels de tickets', activeLanguage),
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 300, 200, 300],
      lightColor: '#27C5F5',
    })
    await Notifications.setNotificationChannelAsync('appointments', {
      name: translate('Rendez-vous BTK Easy', activeLanguage),
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
    { offset: 24 * 60 * 60 * 1000, title: translate('Rappel de votre rendez-vous', activeLanguage), body: translate(`N'oubliez pas votre rendez-vous demain à ${appointment.time.replace(':', ' h ')} à l'agence BTK Easy.`, activeLanguage) },
    { offset: 60 * 60 * 1000, title: translate('Rappel de votre rendez-vous', activeLanguage), body: translate(`Votre rendez-vous BTK Easy est dans une heure, à ${appointment.time.replace(':', ' h ')}.`, activeLanguage) },
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
  const locale = activeLanguage === 'ar' ? 'ar-TN' : activeLanguage === 'en' ? 'en-GB' : 'fr-FR'
  return new Intl.DateTimeFormat(locale, {
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
  const { language } = useContext(SettingsContext)
  const logoOpacity = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.82)).current
  const ringProgress = useRef(new Animated.Value(0)).current
  const pulseProgress = useRef(new Animated.Value(0)).current
  const orbitProgress = useRef(new Animated.Value(0)).current
  const shimmerProgress = useRef(new Animated.Value(0)).current
  const revealProgress = useRef(new Animated.Value(0)).current
  const titleOpacity = useRef(new Animated.Value(0)).current
  const [percent, setPercent] = useState(0)

  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined)

    const titleAnimation = Animated.timing(titleOpacity, {
      toValue: 1,
      duration: 520,
      delay: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    })

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
      titleAnimation,
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
  }, [onFinish, logoOpacity, logoScale, orbitProgress, pulseProgress, revealProgress, ringProgress, shimmerProgress, titleOpacity])

  const logoRingScale = ringProgress.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.18] })
  const logoRingOpacity = ringProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.75, 0.18, 0] })
  const pulseScale = pulseProgress.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.12] })
  const pulseOpacity = pulseProgress.interpolate({ inputRange: [0, 1], outputRange: [0.42, 0.08] })
  const orbitRotation = orbitProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const shimmerX = shimmerProgress.interpolate({ inputRange: [0, 1], outputRange: [-180, 180] })
  const revealScale = revealProgress.interpolate({ inputRange: [0, 1], outputRange: [0.15, Math.max(width, height) / 18] })
  const appTitle = translate('BTK Easy', language)

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
          <Animated.Text
            style={[
              styles.splashTitle,
              {
                opacity: titleOpacity,
                writingDirection: language === 'ar' ? 'rtl' : 'ltr',
                transform: [{ translateY: titleOpacity.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              },
            ]}
          >
            {appTitle}
          </Animated.Text>
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
  const [menuOpen, setMenuOpen] = useState(false)
  const menuProgress = useSharedValue(0)
  const [hoursVisible, setHoursVisible] = useState(false)
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [languagePreferenceSet, setLanguagePreferenceSet] = useState(false)
  const [selectedAgencyForAction, setSelectedAgencyForAction] = useState<Agency | null>(null)
  const [splashVisible, setSplashVisible] = useState(true)
  const [pushToken, setPushToken] = useState<string | null>(null)
  const [activityRefreshKey, setActivityRefreshKey] = useState(0)
  const [activityBadgeCount, setActivityBadgeCount] = useState(0)
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [serviceOpen, setServiceOpen] = useState(true)
  const [serviceHours, setServiceHours] = useState({ label: 'SERVICE', startTime: '08:00', endTime: '16:30' })
  const [loadingHome, setLoadingHome] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const systemColorScheme = useColorScheme()
  const darkMode = settings.theme === 'dark' || (settings.theme === 'automatic' && systemColorScheme === 'dark')
  const blurTarget = useRef<React.ComponentRef<typeof View>>(null)
  const appSurfaceStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(menuProgress.value, [0, 1], [0, 34]),
    transform: [
      { translateX: interpolate(menuProgress.value, [0, 1], [0, -86]) },
      { scale: interpolate(menuProgress.value, [0, 1], [1, 0.9]) },
    ],
  }))
  const appDimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(menuProgress.value, [0, 1], [0, 0.3]),
  }))
  activeDarkMode = darkMode
  activeLanguage = settings.language

  useEffect(() => {
    menuProgress.value = withTiming(menuOpen ? 1 : 0, {
      duration: menuOpen ? 550 : 380,
      easing: ReanimatedEasing.out(ReanimatedEasing.cubic),
    })
  }, [menuOpen, menuProgress])

  useEffect(() => {
    let active = true
    const loadSettings = async () => {
      try {
        const saved = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
        if (!active || !saved) return
        const parsed = JSON.parse(saved) as Partial<AppSettings> & { languagePreferenceSet?: boolean }
        const hasSavedLanguagePreference = parsed.languagePreferenceSet === true
          || parsed.language === 'ar'
          || parsed.language === 'en'
        setLanguagePreferenceSet(hasSavedLanguagePreference)
        setSettings({
          theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : 'automatic',
          language: hasSavedLanguagePreference && (parsed.language === 'fr' || parsed.language === 'ar' || parsed.language === 'en')
            ? parsed.language
            : getSystemLanguage(),
        })
      } catch (error) {
        console.warn('[BTK Easy] Préférences impossibles à charger.', error)
      }
    }
    void loadSettings()
    return () => { active = false }
  }, [])

  useEffect(() => {
    Appearance.setColorScheme(settings.theme === 'automatic' ? 'unspecified' : settings.theme)
  }, [settings.theme])

  const loadHome = useCallback(async () => {
    try {
      const [agencyData, serviceData] = await Promise.all([
        api<Agency[]>('/api/agency'),
        api<{ open: boolean; hours?: { label: string; startTime: string; endTime: string } }>('/api/service-status', { cache: 'no-store' }),
      ])
      setAgencies(agencyData)
      setServiceOpen(Boolean(serviceData.open))
      if (serviceData.hours) setServiceHours(serviceData.hours)
      setConnectionError('')
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      console.warn('[BTK Easy] Chargement des agences impossible.', error)
      setConnectionError(`Connexion impossible avec le serveur (${API_BASE_URL}). ${reason}`)
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
    let active = true
    if (!pushToken) {
      setActivityBadgeCount(0)
      return () => { active = false }
    }

    const loadActivityBadge = async () => {
      try {
        const activity = await api<ActivityData>(`/api/activity?token=${encodeURIComponent(pushToken)}`)
        if (active) {
          setActivityBadgeCount(
            activity.tickets.filter(ticket => ticket.active).length
            + activity.appointments.filter(appointment => appointment.upcoming).length,
          )
        }
      } catch (error) {
        console.warn('[BTK Easy] Chargement du badge Activité impossible.', error)
      }
    }

    void loadActivityBadge()
    const timer = setInterval(() => void loadActivityBadge(), 15000)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [pushToken, activityRefreshKey])

  const refreshActivityBadge = useCallback(() => {
    setActivityRefreshKey(value => value + 1)
  }, [])

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
        refreshActivityBadge()
      }
      if (data?.type === 'appointment-cancelled' && typeof data.reference === 'string') {
        void cancelAppointmentReminders(data.reference)
      }
    })
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      const type = data?.type
      if (typeof type === 'string' && type.startsWith('ticket-')) refreshActivityBadge()
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
  }, [refreshActivityBadge])

  const activeAgencies = useMemo(() => agencies.filter(agency => agency.isActive !== false), [agencies])
  const finishSplash = useCallback(() => setSplashVisible(false), [])
  const navigateFromHome = useCallback((nextTab: Tab, agency?: Agency) => {
    setSelectedAgencyForAction(agency ?? null)
    setTab(nextTab)
  }, [])
  const navigateFromBottomBar = useCallback((nextTab: Tab) => {
    setSelectedAgencyForAction(null)
    setTab(nextTab)
    setMenuOpen(false)
  }, [])
  const updateSettings = useCallback(async (next: Partial<AppSettings>) => {
    const updated = { ...settings, ...next }
    const updatedLanguagePreferenceSet = languagePreferenceSet || next.language !== undefined
    setSettings(updated)
    setLanguagePreferenceSet(updatedLanguagePreferenceSet)
    try {
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({
        ...updated,
        languagePreferenceSet: updatedLanguagePreferenceSet,
      }))
    } catch (error) {
      setSettings(settings)
      setLanguagePreferenceSet(languagePreferenceSet)
      console.error('[BTK Easy] Préférences impossibles à enregistrer.', error)
      showAlert(
        settings.language === 'ar' ? 'تعذر حفظ الإعدادات' : settings.language === 'en' ? 'Could not save settings' : 'Enregistrement impossible',
        settings.language === 'ar'
          ? 'تحقق من مساحة التخزين ثم أعد المحاولة.'
          : settings.language === 'en'
            ? 'Check your device storage and try again.'
            : 'Vérifiez le stockage de l’appareil puis réessayez.',
      )
      return
    }
  }, [languagePreferenceSet, settings])

  return (
    <GestureHandlerRootView style={styles.appRoot}>
      <SettingsContext.Provider value={{ settings, darkMode, language: settings.language }}>
        <SafeAreaProvider>
          <Reanimated.View style={[styles.appSurface, appSurfaceStyle]}>
            <SafeAreaView style={[styles.safeArea, { direction: settings.language === 'ar' ? 'rtl' : 'ltr' }]}>
              <StatusBar style={darkMode ? 'light' : 'dark'} />
              <BlurTargetView ref={blurTarget} style={styles.appContent}>
                {tab === 'home' && <HomeScreen agencies={activeAgencies} serviceOpen={serviceOpen} loading={loadingHome} connectionError={connectionError} onNavigate={navigateFromHome} onMenu={() => setMenuOpen(true)} />}
                {tab === 'activity' && <ActivityScreen pushToken={pushToken} refreshKey={activityRefreshKey} onActivityUpdate={refreshActivityBadge} />}
                {tab === 'ticket' && <TicketScreen agencies={activeAgencies} serviceOpen={serviceOpen} pushToken={pushToken} initialAgency={selectedAgencyForAction} onActivityUpdate={refreshActivityBadge} onBack={() => { setSelectedAgencyForAction(null); setTab('home') }} />}
                {tab === 'appointment' && <AppointmentScreen agencies={activeAgencies} pushToken={pushToken} initialAgency={selectedAgencyForAction} onActivityUpdate={refreshActivityBadge} onBack={() => { setSelectedAgencyForAction(null); setTab('home') }} />}
                {tab === 'screen' && <ScreenScreen agencies={activeAgencies} serviceOpen={serviceOpen} onBack={() => setTab('home')} />}
                <BottomNavigationPro tab={tab} onChange={navigateFromBottomBar} activityCount={activityBadgeCount} />
              </BlurTargetView>
            </SafeAreaView>
            <Reanimated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.appDim, appDimStyle]} />
          </Reanimated.View>
          <SideMenu
            visible={menuOpen}
            current={tab}
            serviceOpen={serviceOpen}
            theme={settings.theme}
            darkMode={darkMode}
            language={settings.language}
            blurTarget={blurTarget}
            onClose={() => setMenuOpen(false)}
            onSelect={navigateFromBottomBar}
            onSelectTheme={theme => updateSettings({ theme })}
            onSelectLanguage={language => updateSettings({ language })}
            onOpenHours={() => setHoursVisible(true)}
            onOpenLink={async url => {
              try {
                await Linking.openURL(url)
              } catch (error) {
                console.error('[BTK Easy] Impossible d’ouvrir le lien demandé.', error)
                Alert.alert(
                  settings.language === 'ar'
                    ? 'تعذر فتح الرابط'
                    : settings.language === 'en'
                      ? 'Link unavailable'
                      : 'Lien indisponible',
                  settings.language === 'ar'
                    ? 'تحقق من اتصالك بالإنترنت ثم أعد المحاولة.'
                    : settings.language === 'en'
                      ? 'Check your internet connection and try again.'
                      : 'Vérifiez votre connexion Internet puis réessayez.',
                )
              }
            }}
          />
          <ServiceHoursModal visible={hoursVisible} hours={serviceHours} onClose={() => setHoursVisible(false)} />
          {splashVisible && <AnimatedSplashScreen onFinish={finishSplash} />}
        </SafeAreaProvider>
      </SettingsContext.Provider>
    </GestureHandlerRootView>
  )
}

function HomeScreen({ agencies, serviceOpen, loading, connectionError, onNavigate, onMenu }: { agencies: Agency[]; serviceOpen: boolean; loading: boolean; connectionError: string; onNavigate: (tab: Tab, agency?: Agency) => void; onMenu: () => void }) {
  const { language } = useContext(SettingsContext)
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
        showAlert('Localisation refusée', 'Autorisez la localisation pour afficher les 5 agences les plus proches.')
        setLiveMode('wait')
        return
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude })
    } catch {
      showAlert('Localisation indisponible', 'Vérifiez le GPS de votre téléphone puis réessayez.')
      setLiveMode('wait')
    } finally {
      setLocationLoading(false)
    }
  }

  const navigate = (tab: Tab) => onNavigate(tab)
  const openAgencyActions = (agency: Agency) => setSelectedAgency(agency)
  const chooseAgencyAction = (tab: 'ticket' | 'appointment') => {
    if (!selectedAgency) return
    const agency = selectedAgency
    setSelectedAgency(null)
    onNavigate(tab, agency)
  }
  return (
    <>
      <AppHeader title="Accueil" onMenu={onMenu} />
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
      <HomeHeroCarousel key={language} onNavigate={navigate} />
      {!serviceOpen && <View accessibilityRole="alert" style={styles.serviceClosedBanner}>
        <View style={styles.serviceClosedIcon}><Ionicons name="time-outline" size={19} color="#FFFFFF" /></View>
        <View style={styles.serviceClosedCopy}><Text style={styles.serviceClosedTitle}>Service fermé</Text><Text style={styles.serviceClosedText}>Le service est disponible de 08:00 à 16:30.</Text></View>
      </View>}
      {connectionError && <Notice text={connectionError} />}

      <SectionTitle eyebrow="MES SERVICES" title="Que souhaitez-vous faire ?" />
      <ActionCard icon="ticket" title="Prendre un ticket" description="Consultez l'attente et obtenez votre numéro." onPress={() => navigate('ticket')} primary />
      <ActionCard icon="calendar" title="Prendre rendez-vous" description="Réservez un créneau avec un chargé." onPress={() => navigate('appointment')} />
      <ActionCard icon="desktop" title="Voir les écrans" description="Suivez les numéros appelés en agence." onPress={() => navigate('screen')} />

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
    </>
  )
}

const HERO_SLIDES = [
  {
    eyebrow: 'TICKET',
    title: 'Prenez votre ticket',
    text: "Consultez l'attente et obtenez votre numéro.",
    action: 'Prendre un ticket',
    tab: 'ticket',
    kind: 'ticket',
  },
  {
    eyebrow: 'RENDEZ-VOUS',
    title: 'Rendez-vous avec votre chargé',
    text: 'Réservez un créneau avec un chargé.',
    action: 'Prendre rendez-vous',
    tab: 'appointment',
    kind: 'appointment',
  },
  {
    eyebrow: 'EN DIRECT',
    title: 'Suivez votre agence',
    text: 'Suivez les numéros appelés en agence.',
    action: 'Voir les écrans',
    tab: 'screen',
    kind: 'screen',
  },
] as const

function HomeHeroCarousel({ onNavigate }: { onNavigate: (tab: Tab) => void }) {
  const { width } = useWindowDimensions()
  const { language } = useContext(SettingsContext)
  const isRTL = language === 'ar'
  const carouselWidth = Math.max(280, width - SPACING.xl * 2)
  const scrollRef = useRef<ScrollViewInstance>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const progress = useRef(new Animated.Value(0)).current
  const floatProgress = useRef(new Animated.Value(0)).current
  const pulseProgress = useRef(new Animated.Value(0)).current
  const numberProgress = useRef(new Animated.Value(0)).current
  const soundBars = useRef(Array.from({ length: 4 }, () => new Animated.Value(0.35))).current

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = (activeIndex + 1) % HERO_SLIDES.length
      scrollRef.current?.scrollTo({ x: next * carouselWidth, animated: true })
      setActiveIndex(next)
    }, 4600)
    return () => clearTimeout(timer)
  }, [activeIndex, carouselWidth])

  useEffect(() => {
    progress.setValue(0)
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 4600,
      useNativeDriver: false,
    })
    animation.start()
    return () => animation.stop()
  }, [activeIndex, progress])

  useEffect(() => {
    const float = Animated.loop(Animated.sequence([
      Animated.timing(floatProgress, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatProgress, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]))
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(pulseProgress, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(pulseProgress, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]))
    const number = Animated.loop(Animated.sequence([
      Animated.timing(numberProgress, { toValue: 1, duration: 2000, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(numberProgress, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]))
    const equalizer = soundBars.map((bar, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 150),
      Animated.timing(bar, { toValue: 1, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bar, { toValue: 0.35, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ])))
    float.start()
    pulse.start()
    number.start()
    equalizer.forEach(animation => animation.start())
    return () => {
      float.stop()
      pulse.stop()
      number.stop()
      equalizer.forEach(animation => animation.stop())
    }
  }, [floatProgress, numberProgress, pulseProgress, soundBars])

  const floatUp = floatProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -7] })
  const floatDown = floatProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 6] })
  const pulseScale = pulseProgress.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1.18] })
  const pulseOpacity = pulseProgress.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0] })
  const selectedNumberOpacity = numberProgress.interpolate({ inputRange: [0, 0.44, 0.5, 1], outputRange: [1, 1, 0, 0] })
  const selectedNumberY = numberProgress.interpolate({ inputRange: [0, 0.44, 0.5, 1], outputRange: [0, 0, -40, -40] })
  const nextNumberOpacity = numberProgress.interpolate({ inputRange: [0, 0.44, 0.5, 1], outputRange: [0, 0, 1, 1] })
  const nextNumberY = numberProgress.interpolate({ inputRange: [0, 0.44, 0.5, 1], outputRange: [40, 40, 0, 0] })

  return (
    <View style={styles.heroCarousel}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        style={{ direction: 'ltr' }}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        scrollEventThrottle={16}
        onMomentumScrollEnd={event => {
          const next = Math.round(event.nativeEvent.contentOffset.x / carouselWidth)
          setActiveIndex(Math.max(0, Math.min(HERO_SLIDES.length - 1, next)))
        }}
      >
        {HERO_SLIDES.map((slide, index) => (
          <LinearGradient
            key={slide.eyebrow}
            colors={slide.kind === 'ticket'
              ? ['#0A63E8', '#0A3FB8', '#082A8A']
              : slide.kind === 'appointment'
                ? ['#0A2A5E', '#0A4CAE']
                : ['#0AA9EA', '#0A63E8']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.homeBanner, { width: carouselWidth, direction: 'ltr' }]}
          >
            <View style={styles.homeBannerGlow} />
            <View style={styles.homeBannerRing} />
            <View style={[styles.homeBannerCopy, isRTL && styles.homeBannerCopyRTL]}>
              <View style={styles.homeBannerTag}>
                <Animated.View style={[styles.homeBannerTagDot, {
                  opacity: pulseProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 1] }),
                }]} />
                <Text style={styles.homeBannerTagText}>{slide.eyebrow}</Text>
              </View>
              <Text style={styles.homeBannerTitle}>{slide.title}</Text>
              <Text style={styles.homeBannerText}>{slide.text}</Text>
            </View>

            {slide.kind === 'ticket' && (
              <View style={styles.bannerTicketArt} accessibilityElementsHidden>
                <Animated.View style={[styles.bannerTicketRing, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />
                <Animated.View style={[styles.bannerTicketCard, { transform: [{ translateY: floatUp }, { rotate: isRTL ? '-7deg' : '7deg' }] }]}>
                    <Text style={styles.bannerTicketAgency}>CENTRALE</Text>
                    <Text style={styles.bannerTicketNumber}>2</Text>
                    <Text style={styles.bannerTicketService}>Caisse</Text>
                    <View style={styles.bannerTicketDivider} />
                    <Text style={styles.bannerTicketWait}>1 avant vous</Text>
                </Animated.View>
                <Animated.View style={[styles.bannerTicketChip, { transform: [{ translateY: floatDown }] }]}>
                  <MaterialCommunityIcons name="clock-outline" size={14} color="#0A3F9C" />
                  <Text style={styles.bannerTicketChipText}>~3 min</Text>
                </Animated.View>
              </View>
            )}

            {slide.kind === 'appointment' && (
              <View style={styles.bannerCalendarArt} accessibilityElementsHidden>
                <Animated.View style={[styles.bannerCalendarCard, { transform: [{ translateY: floatUp }, { rotate: isRTL ? '6deg' : '-6deg' }] }]}>
                  <View style={styles.bannerCalendarHeader}>
                    <Text style={styles.bannerCalendarHeaderText}>CALENDRIER</Text>
                  </View>
                  <View style={styles.bannerCalendarGrid}>
                    {Array.from({ length: 21 }, (_, day) => (
                      <View key={day} style={styles.bannerCalendarDayWrap}>
                        {day === 9 && <Animated.View style={[styles.bannerCalendarDayPulse, { opacity: pulseOpacity, transform: [{ scale: pulseScale }] }]} />}
                        <Animated.View style={[
                          styles.bannerCalendarDay,
                          day === 9 && styles.bannerCalendarDaySelected,
                          day === 9 && { transform: [{ scale: pulseProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] },
                        ]} />
                      </View>
                    ))}
                  </View>
                </Animated.View>
                <Animated.View style={[styles.bannerCalendarCheck, {
                  opacity: pulseProgress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1, 0.82] }),
                  transform: [{ scale: pulseProgress.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.86, 1, 0.94] }) }],
                }]}>
                  <MaterialCommunityIcons name="check" size={25} color="#FFFFFF" />
                </Animated.View>
              </View>
            )}

            {slide.kind === 'screen' && (
              <View style={styles.bannerScreenArt} accessibilityElementsHidden>
                <View style={styles.bannerSoundWave}>
                  {[10, 20, 14, 24].map((height, bar) => (
                    <Animated.View
                      key={bar}
                      style={[
                        styles.bannerSoundBar,
                        {
                          height,
                          opacity: soundBars[bar].interpolate({ inputRange: [0.35, 1], outputRange: [0.55, 1] }),
                          transform: [{ scaleY: soundBars[bar] }],
                        },
                      ]}
                    />
                  ))}
                </View>
                <Animated.View style={[styles.bannerScreenFrame, { transform: [{ translateY: floatUp }, { rotate: isRTL ? '-5deg' : '5deg' }] }]}>
                  <Text style={styles.bannerScreenLabel}>NUMÉRO APPELÉ</Text>
                  <View style={styles.bannerScreenNumberWindow}>
                    <Animated.Text style={[styles.bannerScreenNumber, { opacity: selectedNumberOpacity, transform: [{ translateY: selectedNumberY }] }]}>1</Animated.Text>
                    <Animated.Text style={[styles.bannerScreenNumber, styles.bannerScreenNextNumber, { opacity: nextNumberOpacity, transform: [{ translateY: nextNumberY }] }]}>2</Animated.Text>
                  </View>
                  <Text style={styles.bannerScreenCounter}>Guichet 3</Text>
                </Animated.View>
                <View style={styles.bannerScreenStand} />
              </View>
            )}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={slide.action}
              style={({ pressed }) => [
                styles.homeBannerAction,
                { left: 18, right: undefined, direction: 'ltr' },
                pressed && styles.homeBannerActionPressed,
              ]}
              onPress={() => onNavigate(slide.tab)}
            >
              {isRTL && <MaterialCommunityIcons name="arrow-left" size={17} color="#0A3F9C" />}
              <Text numberOfLines={1} style={[styles.homeBannerActionText, isRTL && styles.homeBannerActionTextRTL]}>{slide.action}</Text>
              {!isRTL && <MaterialCommunityIcons name="arrow-right" size={17} color="#0A3F9C" />}
            </Pressable>
          </LinearGradient>
        ))}
      </ScrollView>
      <View style={styles.heroDots} accessibilityLabel={`Bannière ${activeIndex + 1} sur ${HERO_SLIDES.length}`}>
        {HERO_SLIDES.map((slide, index) => (
          <View key={slide.eyebrow} style={[styles.heroDot, index === activeIndex && styles.heroDotActive]}>
            {index === activeIndex && (
              <Animated.View
                style={[
                  styles.heroDotProgress,
                  {
                    width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                  },
                ]}
              />
            )}
          </View>
        ))}
      </View>
    </View>
  )
}

const SIDE_MENU_WIDTH = Math.min(318, Dimensions.get('window').width * 0.84)
const SIDE_MENU_ITEMS: Array<{
  key: Tab
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']
  title: string
  subtitle: string
}> = [
  { key: 'home', icon: 'home-outline', title: 'Accueil', subtitle: 'Votre visite, plus simple.' },
  { key: 'ticket', icon: 'ticket-confirmation-outline', title: 'Prendre un ticket', subtitle: "Consultez l'attente et obtenez votre numéro." },
  { key: 'appointment', icon: 'calendar-month-outline', title: 'Rendez-vous', subtitle: 'Réservez un créneau avec un chargé.' },
  { key: 'screen', icon: 'television-play', title: 'Voir les écrans', subtitle: 'Suivez les numéros appelés en agence.' },
]

function SideMenu({
  visible,
  current,
  serviceOpen,
  theme,
  darkMode,
  language,
  blurTarget,
  onClose,
  onSelect,
  onSelectTheme,
  onSelectLanguage,
  onOpenHours,
  onOpenLink,
}: {
  visible: boolean
  current: Tab
  serviceOpen: boolean
  theme: ThemePreference
  darkMode: boolean
  language: AppLanguage
  blurTarget: React.RefObject<React.ComponentRef<typeof View> | null>
  onClose: () => void
  onSelect: (tab: Tab) => void
  onSelectTheme: (theme: ThemePreference) => void
  onSelectLanguage: (language: AppLanguage) => void
  onOpenHours: () => void
  onOpenLink: (url: string) => void
}) {
  const insets = useSafeAreaInsets()
  const [mounted, setMounted] = useState(visible)
  const x = useSharedValue(SIDE_MENU_WIDTH)
  const palette = darkMode ? {
    gradient: ['#0A2A5E', '#0A4CAE', '#0A63E8'] as const,
    title: '#FFFFFF',
    subtitle: '#B9D8FF',
    muted: '#9FC4F5',
    itemTitle: '#FFFFFF',
    itemSubtitle: '#B4D2F7',
    selectedBackground: 'rgba(255,255,255,0.16)',
    selectedBorder: 'rgba(255,255,255,0.24)',
    iconBackground: 'rgba(255,255,255,0.12)',
    iconActive: '#12AEF2',
    sectionBorder: 'rgba(255,255,255,0.18)',
    settingLabel: '#D5E7FF',
    choiceText: '#FFFFFF',
    choiceBorder: 'rgba(255,255,255,0.72)',
    radioSelected: '#FFFFFF',
    quickLinkBorder: 'rgba(255,255,255,0.45)',
    quickLinkBackground: 'rgba(255,255,255,0.1)',
    controlBackground: 'rgba(255,255,255,0.14)',
    controlBorder: 'rgba(255,255,255,0.2)',
    bank: '#8FB6EA',
    scrim: 'rgba(3,12,32,0.55)',
  } : {
    gradient: ['#FFFFFF', '#F3F8FC', '#EAF5FC'] as const,
    title: '#142B45',
    subtitle: '#526B82',
    muted: '#52708A',
    itemTitle: '#142B45',
    itemSubtitle: '#64748B',
    selectedBackground: 'rgba(0,102,164,0.10)',
    selectedBorder: 'rgba(0,102,164,0.24)',
    iconBackground: 'rgba(0,102,164,0.09)',
    iconActive: '#0066A4',
    sectionBorder: '#DFE7EF',
    settingLabel: '#526B82',
    choiceText: '#142B45',
    choiceBorder: '#7890A4',
    radioSelected: '#0066A4',
    quickLinkBorder: 'rgba(0,102,164,0.35)',
    quickLinkBackground: 'rgba(0,102,164,0.05)',
    controlBackground: 'rgba(0,102,164,0.07)',
    controlBorder: 'rgba(0,102,164,0.2)',
    bank: '#64748B',
    scrim: 'rgba(3,12,32,0.55)',
  }

  useEffect(() => {
    if (visible) {
      setMounted(true)
      x.value = withTiming(0, { duration: 480, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) })
    } else {
      x.value = withTiming(SIDE_MENU_WIDTH, { duration: 380, easing: ReanimatedEasing.out(ReanimatedEasing.cubic) }, finished => {
        if (finished) runOnJS(setMounted)(false)
      })
    }
  }, [visible, x])

  useEffect(() => {
    if (!visible) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose()
      return true
    })
    return () => subscription.remove()
  }, [visible, onClose])

  const pan = Gesture.Pan()
    .enabled(visible)
    .activeOffsetX(12)
    .failOffsetY([-14, 14])
    .onUpdate(event => {
      x.value = Math.min(SIDE_MENU_WIDTH, Math.max(0, event.translationX))
    })
    .onEnd(event => {
      if (event.translationX > SIDE_MENU_WIDTH * 0.3 || event.velocityX > 700) {
        runOnJS(onClose)()
      } else {
        x.value = withTiming(0, { duration: 250 })
      }
    })

  const panelStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const scrimStyle = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [0, SIDE_MENU_WIDTH], [1, 0]),
  }))

  if (!mounted) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Reanimated.View style={[StyleSheet.absoluteFill, scrimStyle]}>
        <BlurView
          blurTarget={blurTarget}
          blurMethod="dimezisBlurView"
          tint="dark"
          intensity={24}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: palette.scrim }]} />
        <Pressable style={styles.sideMenuScrimPressable} onPress={onClose} accessibilityLabel="Fermer le menu" />
      </Reanimated.View>

      <GestureDetector gesture={pan}>
        <Reanimated.View
          style={[
            styles.sideMenuPanel,
            {
              width: SIDE_MENU_WIDTH,
              top: insets.top,
              bottom: insets.bottom,
            },
            panelStyle,
          ]}
          accessibilityViewIsModal
        >
          <LinearGradient
            colors={palette.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.4, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.sideMenuHeader, { paddingTop: 24 }]}>
            <Image source={SPLASH_ICON} style={styles.sideMenuLogo} />
            <View style={styles.sideMenuBrand}>
              <Text style={[styles.sideMenuTitle, { color: palette.title }]}>BTK Easy</Text>
              <Text style={[styles.sideMenuSubtitle, { color: palette.subtitle }]}>Services clients</Text>
            </View>
            <Pressable onPress={onClose} style={[styles.sideMenuCloseIcon, { backgroundColor: palette.controlBackground }]} accessibilityRole="button" accessibilityLabel="Fermer le menu">
              <MaterialCommunityIcons name="close" size={20} color={palette.title} />
            </Pressable>
          </View>

          <View style={[styles.sideMenuStatus, !serviceOpen && styles.sideMenuStatusOff]}>
            <View style={[styles.sideMenuStatusDot, !serviceOpen && styles.sideMenuStatusDotOff]} />
            <Text style={[styles.sideMenuStatusText, !serviceOpen && styles.sideMenuStatusTextOff]}>
              {serviceOpen ? 'Service ouvert' : 'Service fermé'}
            </Text>
          </View>

          <Text style={[styles.sideMenuLabel, { color: palette.muted }]}>NAVIGATION</Text>
          <ScrollView
            style={styles.sideMenuScroll}
            contentContainerStyle={styles.sideMenuScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sideMenuItems}>
              {SIDE_MENU_ITEMS.map((item, index) => {
                const active = item.key === current
                return (
                  <Reanimated.View key={item.key} entering={FadeInRight.delay(140 + index * 60).duration(450)}>
                    <Pressable
                      onPress={() => {
                        onSelect(item.key)
                        onClose()
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={item.title}
                      style={({ pressed }) => [
                        styles.sideMenuItem,
                        active && [styles.sideMenuItemActive, { backgroundColor: palette.selectedBackground, borderColor: palette.selectedBorder }],
                        pressed && styles.sideMenuItemPressed,
                      ]}
                    >
                      {active && <View style={styles.sideMenuActiveBar} />}
                      <View style={[styles.sideMenuItemIcon, { backgroundColor: palette.iconBackground }, active && { backgroundColor: palette.iconActive }]}>
                        <MaterialCommunityIcons name={item.icon} size={24} color={active ? '#FFFFFF' : darkMode ? '#FFFFFF' : '#0066A4'} />
                      </View>
                      <View style={styles.sideMenuItemCopy}>
                        <Text style={[styles.sideMenuItemTitle, { color: palette.itemTitle }]}>{item.title}</Text>
                        <Text style={[styles.sideMenuItemSubtitle, { color: palette.itemSubtitle }]}>{item.subtitle}</Text>
                      </View>
                      <MaterialCommunityIcons name="chevron-right" size={20} color={darkMode ? 'rgba(255,255,255,0.55)' : '#7890A4'} />
                    </Pressable>
                  </Reanimated.View>
                )
              })}
            </View>

            <View style={[styles.sideMenuSettings, { borderTopColor: palette.sectionBorder }]}>
              <Text style={[styles.sideMenuSectionTitle, { color: palette.title }]}>Apparence</Text>
              <Text style={[styles.sideMenuSettingLabel, { color: palette.settingLabel }]}>Thème de l’application</Text>
              <View style={styles.sideMenuChoices}>
                {([
                  ['light', 'Clair', 'white-balance-sunny'],
                  ['dark', 'Sombre', 'moon-waning-crescent'],
                  ['automatic', 'Automatique', 'theme-light-dark'],
                ] as const).map(([value, label, icon]) => (
                  <Pressable
                    key={value}
                    onPress={() => onSelectTheme(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: theme === value }}
                    style={[
                      styles.sideMenuChoice,
                      theme === value && [styles.sideMenuChoiceSelected, { backgroundColor: palette.selectedBackground }],
                    ]}
                  >
                    <MaterialCommunityIcons name={icon} size={17} color={palette.choiceText} />
                    <Text style={[styles.sideMenuChoiceText, { color: palette.choiceText }]}>{label}</Text>
                    <View style={[styles.sideMenuRadio, { borderColor: palette.choiceBorder }]}>
                      {theme === value && <View style={[styles.sideMenuRadioSelected, { backgroundColor: palette.radioSelected }]} />}
                    </View>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.sideMenuSettingLabel, styles.sideMenuLanguageLabel, { color: palette.settingLabel }]}>Langue</Text>
              <View style={styles.sideMenuLanguageRow}>
                {([
                  ['fr', 'Français'],
                  ['ar', 'العربية'],
                  ['en', 'English'],
                ] as const).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => onSelectLanguage(value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: language === value }}
                    style={[
                      styles.sideMenuLanguageOption,
                      language === value && [styles.sideMenuLanguageSelected, { backgroundColor: palette.selectedBackground }],
                    ]}
                  >
                    <View style={[styles.sideMenuRadio, { borderColor: palette.choiceBorder }]}>
                      {language === value && <View style={[styles.sideMenuRadioSelected, { backgroundColor: palette.radioSelected }]} />}
                    </View>
                    <Text style={[styles.sideMenuChoiceText, { color: palette.choiceText }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.sideMenuQuickLinks}>
              <Pressable style={[styles.sideMenuQuickLink, { borderColor: palette.quickLinkBorder, backgroundColor: palette.quickLinkBackground }]} onPress={() => { onClose(); onOpenLink('https://www.btkbank.com/') }}>
                <Text style={[styles.sideMenuQuickLinkText, { color: palette.title }]}>À propos</Text>
              </Pressable>
              <Pressable style={[styles.sideMenuQuickLink, { borderColor: palette.quickLinkBorder, backgroundColor: palette.quickLinkBackground }]} onPress={() => { onClose(); onOpenLink('https://www.btkbank.com/site/fr/contact.php?id_article=38&objet=1') }}>
                <Text style={[styles.sideMenuQuickLinkText, { color: palette.title }]}>Contact</Text>
              </Pressable>
              <Pressable style={[styles.sideMenuQuickLink, { borderColor: palette.quickLinkBorder, backgroundColor: palette.quickLinkBackground }]} onPress={() => { onClose(); onOpenHours() }}>
                <Text style={[styles.sideMenuQuickLinkText, { color: palette.title }]}>Horaires</Text>
              </Pressable>
            </View>
          </ScrollView>

          <View style={[styles.sideMenuFooter, { paddingBottom: 18 }]}>
            <Pressable onPress={onClose} style={[styles.sideMenuCloseButton, { backgroundColor: palette.controlBackground, borderColor: palette.controlBorder }]} accessibilityRole="button">
              <Text style={[styles.sideMenuCloseText, { color: palette.title }]}>Fermer</Text>
            </Pressable>
            <Text style={[styles.sideMenuBank, { color: palette.bank }]}>BANQUE TUNISO-KOWEITIENNE</Text>
          </View>
        </Reanimated.View>
      </GestureDetector>
    </View>
  )
}

function ActionCard({ icon, title, description, onPress, primary = false }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; description: string; onPress: () => void; primary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${description}`} onPress={onPress} style={({ pressed }) => [styles.actionCard, primary && styles.primaryCard, pressed && styles.pressed]}>{primary && <LinearGradient colors={['#0878FF', '#0754D8', '#063FB5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />}<View style={[styles.actionIcon, primary && styles.primaryIcon]}><Ionicons name={icon} size={22} color={primary ? '#FFFFFF' : COLORS.primary} /></View><View style={styles.actionCopy}><Text style={[styles.actionTitle, primary && styles.primaryCardText]}>{title}</Text><Text style={[styles.actionDescription, primary && styles.primaryCardMuted]}>{description}</Text></View><Text style={[styles.chevron, primary && styles.primaryCardText]}>›</Text></Pressable>
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
      showAlert('Ticket impossible', error instanceof Error ? error.message : 'Service indisponible.')
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
  const locale = activeLanguage === 'ar' ? 'ar-TN' : activeLanguage === 'en' ? 'en-GB' : 'fr-FR'
  return `${new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' }).format(parsed)}${time ? ` · ${time}` : ''}`
}

function ActivityScreen({ pushToken, refreshKey, onActivityUpdate }: { pushToken: string | null; refreshKey: number; onActivityUpdate: () => void }) {
  const { darkMode } = useContext(SettingsContext)
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [activity, setActivity] = useState<ActivityData>({ tickets: [], appointments: [], updatedAt: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleteHistoryVisible, setDeleteHistoryVisible] = useState(false)
  const [deletingHistory, setDeletingHistory] = useState(false)
  const [deleteHistoryError, setDeleteHistoryError] = useState('')
  const cacheLoaded = useRef(false)
  const requestInFlight = useRef(false)

  const loadActivity = useCallback(async () => {
    if (!pushToken) {
      setLoading(false)
      return
    }
    if (requestInFlight.current) return
    requestInFlight.current = true
    const cacheKey = `btk-easy-activity:${pushToken}`
    try {
      if (!cacheLoaded.current) {
        const cached = await AsyncStorage.getItem(cacheKey)
        if (cached) setActivity(JSON.parse(cached) as ActivityData)
        cacheLoaded.current = true
      }
      const data = await api<ActivityData>(`/api/activity?token=${encodeURIComponent(pushToken)}`, { cache: 'no-store' })
      setActivity(data)
      setError('')
      await AsyncStorage.setItem(cacheKey, JSON.stringify(data))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Activité indisponible.')
    } finally {
      requestInFlight.current = false
      setLoading(false)
    }
  }, [pushToken])

  useEffect(() => {
    cacheLoaded.current = false
  }, [pushToken])

  useEffect(() => {
    void loadActivity()
    const timer = setInterval(() => void loadActivity(), 3000)
    return () => clearInterval(timer)
  }, [loadActivity, refreshKey])

  async function cancelAppointment(appointment: ActivityAppointment) {
    showAlert('Annuler le rendez-vous ?', `${appointment.title} · ${formatActivityDate(appointment.date, appointment.time)}`, [
      { text: 'Garder', style: 'cancel' },
      {
        text: 'Annuler',
        style: 'destructive',
        onPress: async () => {
          try {
            await api(`/api/appointments/${appointment.id}`, { method: 'DELETE' })
            onActivityUpdate()
          } catch (cancelError) {
            showAlert('Annulation impossible', cancelError instanceof Error ? cancelError.message : 'Réessayez plus tard.')
          }
        },
      },
    ])
  }

  function confirmDeleteTicketHistory() {
    if (!pushToken) return
    setDeleteHistoryError('')
    setDeleteHistoryVisible(true)
  }

  async function deleteTicketHistory() {
    if (!pushToken || deletingHistory) return
    setDeletingHistory(true)
    setDeleteHistoryError('')
    try {
      await api(`/api/activity?token=${encodeURIComponent(pushToken)}`, { method: 'DELETE' })
      setDeleteHistoryVisible(false)
      await loadActivity()
      onActivityUpdate()
    } catch (deleteError) {
      setDeleteHistoryError(deleteError instanceof Error ? deleteError.message : 'Réessayez plus tard.')
    } finally {
      setDeletingHistory(false)
    }
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
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
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

        {showTickets && pastTickets.length > 0 && <>
          <View style={styles.activityHistoryHeader}>
            <Text style={styles.activitySubheading}>Historique des tickets</Text>
            <Pressable
              onPress={confirmDeleteTicketHistory}
              accessibilityRole="button"
              accessibilityLabel={translate('Supprimer l’historique ?', activeLanguage)}
              style={styles.activityHistoryDelete}
            >
              <Ionicons name="trash-outline" size={19} color="#DC2626" />
            </Pressable>
          </View>
          {pastTickets.map(ticket => <ActivityTicketCard key={ticket.id} ticket={ticket} />)}
        </>}
      </ScrollView>
      <Modal
        visible={deleteHistoryVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!deletingHistory) setDeleteHistoryVisible(false)
        }}
      >
        <View style={styles.activityConfirmOverlay}>
          <View style={[styles.activityConfirmCard, darkMode && styles.activityConfirmCardDark]}>
            <View style={styles.activityConfirmIcon}>
              <Ionicons name={deleteHistoryError ? 'alert-circle-outline' : 'trash-outline'} size={24} color={deleteHistoryError ? COLORS.alert : COLORS.error} />
            </View>
            <Text style={[styles.activityConfirmTitle, darkMode && styles.activityConfirmTitleDark]}>
              {deleteHistoryError ? 'Suppression impossible' : 'Supprimer l’historique ?'}
            </Text>
            <Text style={[styles.activityConfirmMessage, darkMode && styles.activityConfirmMessageDark]}>
              {deleteHistoryError || 'Les tickets actifs ne seront pas supprimés.'}
            </Text>
            <View style={styles.activityConfirmActions}>
              {!deleteHistoryError && <Pressable
                onPress={() => setDeleteHistoryVisible(false)}
                disabled={deletingHistory}
                style={({ pressed }) => [styles.activityConfirmButton, styles.activityConfirmCancel, darkMode && styles.activityConfirmCancelDark, pressed && styles.pressed]}
              >
                <Text style={[styles.activityConfirmCancelText, darkMode && styles.activityConfirmCancelTextDark]}>Annuler</Text>
              </Pressable>}
              <Pressable
                onPress={deleteHistoryError ? () => setDeleteHistoryVisible(false) : deleteTicketHistory}
                disabled={deletingHistory}
                style={({ pressed }) => [styles.activityConfirmButton, styles.activityConfirmDelete, pressed && styles.pressed, deletingHistory && styles.activityConfirmButtonDisabled]}
              >
                {deletingHistory
                  ? <ActivityIndicator color="#FFFFFF" size="small" />
                  : <Text style={styles.activityConfirmDeleteText}>{deleteHistoryError ? 'Fermer' : 'Supprimer'}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

function ActivityTicketCard({ ticket }: { ticket: ActivityTicket }) {
  const progressValue = Math.max(0, Math.min(100, ticket.progress))
  const progress = useRef(new Animated.Value(progressValue)).current
  const calledPulse = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(progress, { toValue: progressValue, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start()
  }, [progress, progressValue])
  const progressWidth = progress.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] })
  const called = ticket.status === 'CALLED'
  const closed = !ticket.active
  const ticketLabel = `TICKET #${String(ticket.number).padStart(3, '0')}`

  useEffect(() => {
    calledPulse.setValue(0)
    if (!called) return
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(calledPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(calledPulse, { toValue: 0, duration: 900, useNativeDriver: true }),
    ]))
    pulse.start()
    return () => pulse.stop()
  }, [called, calledPulse])

  if (closed) {
    return <View style={[styles.activityTicketCard, styles.activityTicketHistoryCard]}>
      <Text style={styles.activityTicketHistoryNumber}>{ticketLabel}</Text>
      <View style={styles.activityTicketHistoryStatus}>
        <Ionicons name="checkmark-circle" size={16} color="#CBD5E1" />
        <Text style={styles.activityTicketHistoryStatusText}>{ticket.statusLabel}</Text>
      </View>
    </View>
  }

  return <View style={[styles.activityTicketCard, called && styles.activityTicketCardCalled]}>
    <LinearGradient
      colors={called ? ['#061831', '#073B68', '#064A7C'] : ['#061A32', '#082D50', '#073A65']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <View pointerEvents="none" style={styles.activityTicketOrb} />
    <View style={styles.activityTicketHeader}>
      <View style={styles.activityTicketIdentity}>
        <View style={styles.activityTicketAgency}><Ionicons name="location" size={12} color="#48D9FF" /><Text numberOfLines={1} style={styles.activityCardEyebrow}>{ticket.agencyName}</Text></View>
        <Text style={styles.activityTicketNumber}>{ticketLabel}</Text>
        <View style={styles.activityTicketServiceChip}><Ionicons name="briefcase-outline" size={13} color="#A9DFFF" /><Text numberOfLines={1} style={styles.activityTicketService}>{ticket.service}</Text></View>
      </View>
      <View style={[styles.activityStatusPill, called && styles.activityStatusPillCalled]}>
        <View style={[styles.activityLiveDot, called && styles.activityLiveDotCalled]} />
        <Text numberOfLines={2} style={styles.activityStatusText}>{ticket.statusLabel}</Text>
      </View>
    </View>
    <View style={styles.activityTicketCallout}>
      <View style={styles.activityTicketCallIcon}>
        {called && <Animated.View style={[styles.activityTicketCallPulse, {
          opacity: calledPulse.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.75] }),
          transform: [{ scale: calledPulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.25] }) }],
        }]} />}
        <Ionicons name={called ? 'checkmark' : 'pulse-outline'} size={25} color={called ? '#63F2B0' : '#45D9FF'} />
      </View>
      <View style={styles.activityTicketCallCopy}>
        <Text numberOfLines={2} style={[styles.activityTicketLead, called && styles.activityTicketLeadCalled]}>
          {called ? 'C’EST VOTRE TOUR !' : ticket.peopleAhead <= 3 ? 'VOTRE TOUR APPROCHE' : 'SUIVI EN TEMPS RÉEL'}
        </Text>
        <Text numberOfLines={1} style={styles.activityTicketCallHint}>
          {called ? ticket.guichet ? `Présentez-vous au ${ticket.guichet}` : 'Veuillez vous présenter au guichet.' : 'Votre position se met à jour automatiquement.'}
        </Text>
      </View>
    </View>
    <View style={styles.activityTicketProgressPanel}>
      <View style={styles.activityTicketStats}>
        <Text numberOfLines={1} style={styles.activityPeopleAhead}>{ticket.peopleAhead} <Text style={styles.activityPeopleAheadLabel}>personne{ticket.peopleAhead === 1 ? '' : 's'} avant vous</Text></Text>
        <Text style={styles.activityProgressText}>{progressValue}%</Text>
      </View>
      <View style={styles.activityProgressTrack}><Animated.View style={[styles.activityProgressFill, { width: progressWidth }]} /></View>
    </View>
    <View style={styles.activityTicketFooter}>
      <View style={styles.activityTicketMetric}>
        <View style={styles.activityMetricIcon}><Ionicons name="time-outline" size={16} color="#39D7FF" /></View>
        <View><Text style={styles.activityMetaLabel}>ATTENTE ESTIMÉE</Text><Text style={styles.activityMetaValue}>{ticket.estimatedWait} min</Text></View>
      </View>
      <View style={styles.activityMetricDivider} />
      <View style={[styles.activityTicketMetric, styles.activityTicketMetricRight]}>
        <View style={styles.activityMetricIcon}><Ionicons name="refresh-outline" size={16} color="#39D7FF" /></View>
        <View><Text style={styles.activityMetaLabel}>DERNIÈRE MISE À JOUR</Text><Text style={styles.activityMetaValue}>{new Date(ticket.lastUpdatedAt).toLocaleTimeString(activeLanguage === 'ar' ? 'ar-TN' : activeLanguage === 'en' ? 'en-GB' : 'fr-FR', { hour: '2-digit', minute: '2-digit' })}</Text></View>
      </View>
    </View>
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

function TicketScreen({ agencies, serviceOpen, pushToken, initialAgency, onActivityUpdate, onBack }: { agencies: Agency[]; serviceOpen: boolean; pushToken: string | null; initialAgency?: Agency | null; onActivityUpdate: () => void; onBack: () => void }) {
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
        showAlert('Localisation refusée', 'Autorisez la localisation pour trouver l’agence la plus proche.')
        return
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setPosition({ latitude: current.coords.latitude, longitude: current.coords.longitude })
    } catch {
      showAlert('Localisation indisponible', 'Vérifiez le GPS de votre téléphone puis réessayez.')
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
      onActivityUpdate()
    } catch (error) {
      showAlert('Ticket impossible', error instanceof Error ? error.message : 'Service indisponible.')
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

function normalizeSearchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase()
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
    try { setCharges((await api<Charge[]>(`/api/charges?agencyId=${value.id}`)).filter(item => item.isActive !== false)) } catch (error) { setCharges([]); showAlert('Erreur', error instanceof Error ? error.message : 'Impossible de charger les chargés.') } finally { setLoading(false) }
  }

  async function chooseCharge(value: Charge) {
    setCharge(value); setTime(''); setLoading(true)
    try { const data = await api<{ slots: Slot[] }>(`/api/charges/${value.id}/availability?date=${date}`); setSlots(data.slots || []) } catch (error) { setSlots([]); showAlert('Calendrier indisponible', error instanceof Error ? error.message : 'Réessayez dans quelques instants.') } finally { setLoading(false) }
  }

  async function reloadSlots(nextDate: string) {
    const safeDate = isValidInputDate(nextDate) ? nextDate : todayInputDate()
    setDate(safeDate); setTime('')
    if (!charge) return
    setLoading(true)
    try { const data = await api<{ slots: Slot[] }>(`/api/charges/${charge.id}/availability?date=${safeDate}`); setSlots(data.slots || []) } catch (error) { setSlots([]); showAlert('Calendrier indisponible', error instanceof Error ? error.message : 'Réessayez dans quelques instants.') } finally { setLoading(false) }
  }

  async function submit() {
    if (!charge || !time || !name.trim() || !phone.trim()) return
    setLoading(true)
    try {
      const data = await api<{ appointment: Appointment }>('/api/appointments', { method: 'POST', body: JSON.stringify({ chargeId: charge.id, date, time, customerName: name, customerPhone: phone, customerEmail: email, subject }) })
      setResult(data.appointment)
    } catch (error) { showAlert('Réservation impossible', error instanceof Error ? error.message : 'Créneau indisponible.') } finally { setLoading(false) }
  }

  if (result) return <ScreenLayout title="Rendez-vous confirmé" onBack={onBack}><View style={styles.confirmCard}><Text style={styles.confirmIcon}>✓</Text><Text style={styles.cardEyebrow}>CODE RENDEZ-VOUS</Text><Text style={styles.reference}>{result.reference}</Text><Text style={styles.confirmText}>{dateLabel(result.date)} à {result.time}</Text><Text style={styles.confirmText}>{result.customerName}</Text><Text style={styles.ticketHint}>Conservez ce code pour consulter ou annuler votre rendez-vous.</Text><PrimaryButton label="Nouveau rendez-vous" onPress={() => setResult(null)} /></View></ScreenLayout>

  return <ScreenLayout title="Prendre rendez-vous" onBack={onBack}>
    <SectionTitle eyebrow="1 · AGENCE" title="Choisissez une agence" />
    {agencies.map(item => <Pressable key={item.id} onPress={() => chooseAgency(item)} style={[styles.selectRow, agency?.id === item.id && styles.selectedRow]}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{item.code}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName}>{item.name}</Text><Text style={styles.agencyMeta}>{item.city}</Text></View><Text style={styles.radio}>{agency?.id === item.id ? '●' : '○'}</Text></Pressable>)}
    {agency && <><SectionTitle eyebrow="2 · CONSEILLER" title="Choisissez un chargé" />{loading && !charges.length ? <ActivityIndicator color="#0065a1" /> : charges.map(item => <Pressable key={item.id} onPress={() => chooseCharge(item)} style={[styles.selectRow, charge?.id === item.id && styles.selectedRow]}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{getChargeInitials(item.name)}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName}>{item.name}</Text><Text style={styles.agencyMeta}>{item.agencyName}</Text></View><Text style={styles.radio}>{charge?.id === item.id ? '●' : '○'}</Text></Pressable>)}</>}
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

function AppointmentScreen({ agencies, pushToken, initialAgency, onActivityUpdate, onBack }: { agencies: Agency[]; pushToken: string | null; initialAgency?: Agency | null; onActivityUpdate: () => void; onBack: () => void }) {
  const [stage, setStage] = useState<string>(initialAgency ? 'charge' : 'agency')
  const [agency, setAgency] = useState<Agency | null>(initialAgency ?? null)
  const [charges, setCharges] = useState<Charge[]>([])
  const [charge, setCharge] = useState<Charge | null>(null)
  const [chargeSearch, setChargeSearch] = useState('')
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
  const filteredCharges = useMemo(() => {
    const query = chargeSearch.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase()
    if (!query) return charges
    return charges.filter(item => `${item.name} ${item.agencyName || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().includes(query))
  }, [charges, chargeSearch])

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
      .catch(error => {
        setCharges([])
        showAlert('Erreur', error instanceof Error ? error.message : 'Impossible de charger les chargés.')
      })
      .finally(() => setLoading(false))
  }, [initialAgency])

  async function chooseAgency(value: Agency) {
    setAgency(value); setCharge(null); setSlots([]); setTime(''); setStage('charge'); setLoading(true)
    try { setCharges((await api<Charge[]>(`/api/charges?agencyId=${value.id}`)).filter(item => item.isActive !== false)) } catch (error) { setCharges([]); showAlert('Erreur', error instanceof Error ? error.message : 'Impossible de charger les chargés.') } finally { setLoading(false) }
  }

  async function chooseCharge(value: Charge) {
    setCharge(value); setTime(''); setStage('calendar'); setLoading(true)
    try { const data = await api<{ slots: Slot[] }>(`/api/charges/${value.id}/availability?date=${date}`); setSlots(data.slots || []) } catch (error) { setSlots([]); showAlert('Calendrier indisponible', error instanceof Error ? error.message : 'Réessayez dans quelques instants.') } finally { setLoading(false) }
  }

  async function reloadSlots(nextDate: string) {
    const safeDate = isValidInputDate(nextDate) ? nextDate : todayInputDate()
    setDate(safeDate); setTime('')
    if (!charge) return
    setLoading(true)
    try { const data = await api<{ slots: Slot[] }>(`/api/charges/${charge.id}/availability?date=${safeDate}`); setSlots(data.slots || []) } catch (error) { setSlots([]); showAlert('Calendrier indisponible', error instanceof Error ? error.message : 'Réessayez dans quelques instants.') } finally { setLoading(false) }
  }

  async function submit() {
    if (!charge || !time || !name.trim() || !phone.trim()) return
    setLoading(true)
    try { const data = await api<{ appointment: Appointment }>('/api/appointments', { method: 'POST', body: JSON.stringify({ chargeId: charge.id, date, time, customerName: name, customerPhone: phone, customerEmail: email, subject, pushToken, pushPlatform: Platform.OS }) }); await scheduleAppointmentReminders(data.appointment); setResult(data.appointment); onActivityUpdate() } catch (error) { showAlert('Réservation impossible', error instanceof Error ? error.message : 'Créneau indisponible.') } finally { setLoading(false) }
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
    {stage === 'charge' && <>
      <View style={styles.selectedAgencyBanner}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{agency?.code}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName}>{agency?.name}</Text><Text style={styles.agencyMeta}>Agence sélectionnée</Text></View></View>
      <SectionTitle eyebrow="2 · CONSEILLER" title="Choisissez un chargé" />
      <View style={styles.advisorSearchBox}>
        <Ionicons name="search-outline" size={19} color={COLORS.primary} />
        <TextInput accessibilityLabel="Rechercher un chargé" value={chargeSearch} onChangeText={setChargeSearch} placeholder="Rechercher un chargé..." placeholderTextColor={COLORS.muted} style={styles.advisorSearchInput} />
        {chargeSearch.length > 0 && <Pressable onPress={() => setChargeSearch('')} accessibilityRole="button" accessibilityLabel="Effacer la recherche"><Ionicons name="close-circle" size={19} color={COLORS.muted} /></Pressable>}
      </View>
      {loading && !charges.length
        ? <ActivityIndicator color={COLORS.primary} />
        : <View style={styles.advisorGrid}>
          {filteredCharges.map(item => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Choisir ${item.name}`} onPress={() => chooseCharge(item)} style={({ pressed }) => [styles.advisorCard, pressed && styles.pressed]}>
            <View style={styles.advisorCardTop}>
              <View style={styles.advisorInitials}><Text style={styles.advisorInitialsText}>{getChargeInitials(item.name)}</Text></View>
              <Ionicons name="chevron-forward" size={17} color={COLORS.primary} />
            </View>
            <Text numberOfLines={2} style={styles.advisorName}>{item.name}</Text>
            <Text numberOfLines={1} style={styles.advisorAgency}>{item.agencyName || agency?.name}</Text>
          </Pressable>)}
          {filteredCharges.length === 0 && <Text style={styles.advisorEmpty}>{charges.length ? 'Aucun chargé ne correspond à votre recherche.' : 'Aucun chargé disponible.'}</Text>}
        </View>}
    </>}
    {stage === 'calendar' && charge && <><View style={styles.selectedAgencyBanner}><View style={styles.agencyCode}><Text style={styles.agencyCodeText}>{getChargeInitials(charge.name)}</Text></View><View style={styles.agencyCopy}><Text style={styles.agencyName}>{charge.name}</Text><Text style={styles.agencyMeta}>{agency?.name}</Text></View></View><SectionTitle eyebrow="3 · CRÉNEAU" title="Choisissez la date et l'heure" /><View style={styles.dateRow}><Pressable onPress={() => reloadSlots(addDays(date, -1))} style={styles.dateButton}><Text style={styles.dateButtonText}>‹</Text></Pressable><View style={styles.dateCenter}><Text style={styles.dateText}>{dateLabel(date)}</Text><Text style={styles.dateCode}>{date}</Text></View><Pressable onPress={() => reloadSlots(addDays(date, 1))} style={styles.dateButton}><Text style={styles.dateButtonText}>›</Text></Pressable></View><View style={styles.slotGrid}>{slots.filter(slot => slot.available).map(slot => <Pressable key={slot.time} onPress={() => setTime(slot.time)} style={[styles.slot, time === slot.time && styles.selectedSlot]}><Text style={[styles.slotText, time === slot.time && styles.selectedSlotText]}>{slot.time}</Text></Pressable>)}</View>{!slots.some(slot => slot.available) && !loading && <Text style={styles.emptyText}>Aucun créneau disponible pour cette date.</Text>}{time && <><Field label="Nom complet" value={name} onChangeText={setName} placeholder="Votre nom" /><Field label="Téléphone" value={phone} onChangeText={setPhone} placeholder="Votre numéro" keyboardType="phone-pad" /><Field label="Email (optionnel)" value={email} onChangeText={setEmail} placeholder="vous@email.com" keyboardType="email-address" /><Field label="Sujet (optionnel)" value={subject} onChangeText={setSubject} placeholder="Motif du rendez-vous" /><PrimaryButton label={loading ? 'Réservation...' : 'Confirmer le rendez-vous'} onPress={submit} disabled={!name.trim() || !phone.trim() || loading} /></>}</>}
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
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null)
  const [now, setNow] = useState(Date.now())
  const [refreshFailed, setRefreshFailed] = useState(false)
  const livePulse = useRef(new Animated.Value(0)).current

  const visibleAgencies = useMemo(() => {
    const query = normalizeSearchText(agencySearch)
    if (!query) return agencies
    return agencies.filter(item => normalizeSearchText(`${item.name} ${item.city} ${item.code}`).includes(query))
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
    try {
      setData(await api<ScreenData>(`/api/agency/${id}`))
      const updatedAt = Date.now()
      setLastUpdatedAt(updatedAt)
      setNow(updatedAt)
      setRefreshFailed(false)
    } catch {
      setRefreshFailed(true)
    }
  }, [])

  useEffect(() => {
    if (!agency) return
    setData(null)
    setLastUpdatedAt(null)
    setRefreshFailed(false)
    void load(agency.id)
    const timer = setInterval(() => load(agency.id), 10000)
    return () => clearInterval(timer)
  }, [agency, load])

  useEffect(() => {
    if (!agency) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [agency])

  useEffect(() => {
    if (!agency) return
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(livePulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(livePulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]))
    pulse.start()
    return () => pulse.stop()
  }, [agency, livePulse])

  if (!agency) return <ScreenLayout title="Écrans en direct" onBack={onBack} stickyHeaderIndices={[2]}>
    <ScreenHeroBanner />
    <SectionTitle eyebrow="EN DIRECT" title="Choisissez une agence" />
    <View style={[styles.screenSearchBox, styles.screenSearchSticky]}>
      <Ionicons name="search-outline" size={20} color={COLORS.primary} />
      <TextInput
        accessibilityLabel="Rechercher une agence"
        value={agencySearch}
        onChangeText={value => {
          setAgencySearch(value)
          setAgencyPage(1)
        }}
        placeholder="Rechercher une agence..."
        placeholderTextColor={COLORS.muted}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        multiline={false}
        numberOfLines={1}
        underlineColorAndroid="transparent"
        style={styles.screenSearchInput}
      />
      {agencySearch.length > 0 && <Pressable onPress={() => setAgencySearch('')} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
        <Ionicons name="close-circle" size={19} color={COLORS.muted} />
      </Pressable>}
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
  const secondsSinceUpdate = lastUpdatedAt === null ? null : Math.floor((now - lastUpdatedAt) / 1000)

  return <ScreenLayout title={agency.name} onBack={() => { setAgency(null); setData(null) }}>
    <ScreenDisplayWelcome agency={agency} serviceOpen={serviceOpen} />
    {serviceOpen ? <>
    <View style={styles.liveCard}>
      <View style={styles.liveCardHeader}>
        <View><Text style={styles.liveCardEyebrow}>TICKET APPELÉ</Text><Text style={styles.liveCardSubtitle}>Dernier passage appelé</Text></View>
        <View style={styles.liveStatusBadge}><View style={[styles.liveStatusDot, { backgroundColor: hasCalledTicket ? COLORS.success : COLORS.alert }]} /><Text style={styles.liveStatusText}>{hasCalledTicket ? 'EN COURS' : 'EN ATTENTE'}</Text></View>
      </View>
      <View style={[styles.liveNumberPanel, !hasCalledTicket && styles.liveNumberPanelEmpty]}><Text style={[styles.liveNumber, !hasCalledTicket && styles.liveNumberEmptyText]}>{hasCalledTicket ? data?.called?.number : lastUpdatedAt !== null ? 'Aucun numéro appelé pour le moment' : refreshFailed ? 'Mise à jour impossible' : 'Actualisation...'}</Text></View>
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
    <View style={styles.liveHintRow}>
      <Animated.View style={[styles.liveUpdateDot, refreshFailed && styles.liveUpdateDotError, {
        opacity: livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        transform: [{ scale: livePulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.15] }) }],
      }]} />
      <Text style={styles.liveHint}>{refreshFailed ? 'Mise à jour impossible' : secondsSinceUpdate === null ? 'Actualisation...' : `Mis à jour il y a ${secondsSinceUpdate} s`}</Text>
    </View>
    </> : <View style={styles.screenClosedCard}>
      <Text style={styles.screenClosedEyebrow}>HORS HORAIRES DE TRAVAIL</Text>
      <View style={styles.screenClosedLabel}><Ionicons name="lock-closed-outline" size={22} color="#FFFFFF" /><Text style={styles.screenClosedLabelText}>GUICHET FERMÉ</Text></View>
      <Text style={styles.screenClosedText}>Merci de votre confiance.</Text>
      <Text style={styles.screenClosedHours}>Horaires : 08:00 - 16:30</Text>
    </View>}
  </ScreenLayout>
}

function ScreenLayout({ title, onBack, children, stickyHeaderIndices }: { title: string; onBack: () => void; children: React.ReactNode; stickyHeaderIndices?: number[] }) {
  return <><AppHeader title={title} onBack={onBack} /><ScrollView stickyHeaderIndices={stickyHeaderIndices} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.scrollContent}>{children}</ScrollView></>
}

function Notice({ text }: { text: string }) { return <View style={styles.notice}><Text style={styles.noticeText}>{text}</Text></View> }

function ServiceHoursModal({ visible, hours, onClose }: {
  visible: boolean
  hours: { label: string; startTime: string; endTime: string }
  onClose: () => void
}) {
  const { darkMode } = useContext(SettingsContext)
  const weekdays = [
    ['Lundi', true], ['Mardi', true], ['Mercredi', true], ['Jeudi', true],
    ['Vendredi', true], ['Samedi', false], ['Dimanche', false],
  ] as const

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.hoursModalRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer les horaires" />
        <View style={styles.hoursModalPanel}>
          <View style={styles.hoursModalHeader}>
            <View style={styles.hoursModalTitleGroup}>
              <Text style={styles.hoursModalTitle}>Horaires de travail</Text>
              <Text style={styles.hoursModalSubtitle}>{hours.label}</Text>
            </View>
            <Pressable onPress={onClose} style={styles.hoursModalClose} accessibilityRole="button" accessibilityLabel="Fermer">
              <MaterialCommunityIcons name="close" size={21} color={darkMode ? '#A5B5C5' : COLORS.muted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.hoursModalList}>
            {weekdays.map(([day, workingDay]) => {
              const isOpen = workingDay
              const schedule = workingDay
                ? `${hours.startTime} – ${hours.endTime}`
                : 'Fermé'
              const rowTheme = darkMode
                ? isOpen
                  ? { backgroundColor: '#18382D', borderColor: '#2C6A4D', textColor: '#7DE0A8', badgeBackground: '#234A39' }
                  : { backgroundColor: '#3B252A', borderColor: '#70414A', textColor: '#F2A0A0', badgeBackground: '#512F37' }
                : isOpen
                  ? { backgroundColor: '#F0FBF4', borderColor: '#BBE7CB', textColor: '#15803D', badgeBackground: '#FFFFFF' }
                  : { backgroundColor: '#FFF5F5', borderColor: '#F2C8C8', textColor: '#B91C1C', badgeBackground: '#FFFFFF' }
              return (
                <View key={day} style={[styles.hoursModalRow, { backgroundColor: rowTheme.backgroundColor, borderColor: rowTheme.borderColor }]}>
                  <View>
                    <Text style={styles.hoursModalDay}>{day}</Text>
                    <Text style={[styles.hoursModalTime, { color: rowTheme.textColor }]}>{schedule}</Text>
                  </View>
                  <Text style={[styles.hoursModalBadge, { color: rowTheme.textColor, backgroundColor: rowTheme.badgeBackground }]}>
                    {isOpen ? 'Ouvert' : 'Fermé'}
                  </Text>
                </View>
              )
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

function BottomNavigation({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const items: Array<{ key: Tab; label: string; icon: string }> = [{ key: 'home', label: 'Accueil', icon: '⌂' }, { key: 'ticket', label: 'Ticket', icon: '▣' }, { key: 'appointment', label: 'Rendez-vous', icon: '□' }, { key: 'screen', label: 'Écran', icon: '▤' }]
  return <View style={styles.bottomNav}>{items.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected: tab === item.key }} onPress={() => onChange(item.key)} style={({ pressed }) => [styles.navItem, pressed && styles.navPressed]}><View style={[styles.navIconWrap, tab === item.key && styles.navIconWrapActive]}><Text style={[styles.navIcon, tab === item.key && styles.navActive]}>{item.icon}</Text></View><Text style={[styles.navLabel, tab === item.key && styles.navActive]}>{item.label}</Text></Pressable>)}</View>
}

function BottomNavigationPro({ tab, onChange, activityCount }: { tab: Tab; onChange: (tab: Tab) => void; activityCount: number }) {
  const { darkMode } = useContext(SettingsContext)
  const items: Array<{
    key: Tab
    label: string
    icon: React.ComponentProps<typeof Ionicons>['name']
    activeIcon: React.ComponentProps<typeof Ionicons>['name']
  }> = [
    { key: 'home', label: 'Accueil', icon: 'home-outline', activeIcon: 'home' },
    { key: 'activity', label: 'Activité', icon: 'pulse-outline', activeIcon: 'pulse' },
    { key: 'ticket', label: 'Ticket', icon: 'ticket-outline', activeIcon: 'ticket' },
    { key: 'appointment', label: 'Rendez-vous', icon: 'calendar-outline', activeIcon: 'calendar' },
    { key: 'screen', label: 'Écran', icon: 'desktop-outline', activeIcon: 'desktop' },
  ]

  return (
    <View style={[styles.bottomNavPro, darkMode && styles.bottomNavProDark]}>
      <LinearGradient
        colors={darkMode ? ['#07152E', '#0B2C62', '#07152E'] : ['#0A1B3B', '#0B3474', '#0A1B3B']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {items.map(item => {
        const active = tab === item.key
        return (
          <Pressable
            key={item.key}
            accessibilityRole="button"
            accessibilityLabel={item.key === 'activity' && activityCount > 0 ? `Activité, ${activityCount} élément(s) actif(s)` : item.label}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => [styles.navItemPro, pressed && styles.navPressedPro]}
          >
            {active ? (
              <LinearGradient
                colors={['#0878FF', '#0754D8', '#063FB5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.navActiveCapsulePro}
              >
                <View style={styles.navIconContainer}>
                  <Ionicons name={item.activeIcon} size={22} color="#FFFFFF" />
                  {item.key === 'activity' && activityCount > 0 && <View style={styles.activityNavBadge}><Text style={styles.activityNavBadgeText}>{activityCount > 9 ? '9+' : activityCount}</Text></View>}
                </View>
                <Text numberOfLines={1} style={styles.navLabelActivePro}>{item.label}</Text>
                <View style={styles.navActiveGlowPro} />
              </LinearGradient>
            ) : (
              <View style={styles.navInactiveContentPro}>
                <View style={styles.navIconContainer}>
                  <Ionicons name={item.icon} size={22} color="#C4D5F2" />
                  {item.key === 'activity' && activityCount > 0 && <View style={styles.activityNavBadge}><Text style={styles.activityNavBadgeText}>{activityCount > 9 ? '9+' : activityCount}</Text></View>}
                </View>
                <Text numberOfLines={1} style={styles.navLabelPro}>{item.label}</Text>
              </View>
            )}
          </Pressable>
        )
      })}
    </View>
  )
}

const DARK_STYLE_COLORS: Record<string, Record<string, string>> = {
  backgroundColor: {
    '#f7f9fc': '#0b1220',
    '#ffffff': '#111c2e',
    '#fff': '#111c2e',
    '#eaf5fc': '#1b2a40',
    '#f8fafc': '#111c2e',
    '#f1f5f9': '#1b2a40',
    '#f2f6fa': '#1b2a40',
    '#f1f8ff': '#14243a',
    '#f1fbf5': '#14291f',
    '#f4f8fb': '#162338',
    '#f4faff': '#162338',
    '#f0f7fc': '#162338',
    '#f6f9fc': '#162338',
  },
  color: {
    '#142b45': '#e5eef9',
    '#073b68': '#dbeafe',
    '#082d50': '#dbeafe',
    '#64748b': '#b7c5d8',
    '#475569': '#cbd5e1',
    '#334155': '#dbe4f0',
    '#0f172a': '#f1f5f9',
    '#1e293b': '#e2e8f0',
    '#102746': '#dbe4f0',
    '#7a8da3': '#a7b6c8',
    '#667d99': '#b5c5d9',
    '#5e7491': '#b5c5d9',
  },
  borderColor: {
    '#dfe7ef': '#29384d',
    '#eaf0f6': '#29384d',
    '#dceaf4': '#29384d',
    '#d7e7f2': '#34455d',
    '#dbeaf8': '#29384d',
    '#cbd5e1': '#40516a',
  },
}

const styles = new Proxy(StyleSheet.create({
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
  appRoot: { flex: 1 },
  appSurface: { flex: 1, overflow: 'hidden', transformOrigin: 'left center' },
  appDim: { backgroundColor: '#000000' },
  appContent: { flex: 1 },
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
  sideMenuScrim: { backgroundColor: 'rgba(3,12,32,0.55)' },
  sideMenuScrimPressable: { flex: 1 },
  sideMenuPanel: { position: 'absolute', right: 0, overflow: 'hidden', borderTopLeftRadius: 36, borderBottomLeftRadius: 36, elevation: 24, shadowColor: '#000000', shadowOpacity: 0.4, shadowRadius: 30 },
  sideMenuHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingBottom: 16 },
  sideMenuLogo: { width: 56, height: 56, borderRadius: 17 },
  sideMenuBrand: { flex: 1 },
  sideMenuTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '700' },
  sideMenuSubtitle: { color: '#B9D8FF', fontSize: 13 },
  sideMenuCloseIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.12)' },
  sideMenuStatus: { flexDirection: 'row', alignItems: 'center', gap: 9, alignSelf: 'flex-start', marginHorizontal: 22, marginBottom: 14, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(74,222,128,0.35)', backgroundColor: 'rgba(34,197,94,0.16)' },
  sideMenuStatusOff: { borderColor: 'rgba(252,211,77,0.35)', backgroundColor: 'rgba(245,158,11,0.16)' },
  sideMenuStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22C55E' },
  sideMenuStatusDotOff: { backgroundColor: '#F59E0B' },
  sideMenuStatusText: { color: '#86EFAC', fontSize: 12.5, fontWeight: '500' },
  sideMenuStatusTextOff: { color: '#FCD34D' },
  sideMenuLabel: { color: '#9FC4F5', fontSize: 11, fontWeight: '600', letterSpacing: 2, paddingHorizontal: 24, paddingBottom: 10 },
  sideMenuItems: { paddingHorizontal: 14, gap: 8 },
  sideMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11, borderWidth: 1, borderColor: 'transparent', borderRadius: 20 },
  sideMenuItemActive: { borderColor: 'rgba(255,255,255,0.24)', backgroundColor: 'rgba(255,255,255,0.16)' },
  sideMenuItemPressed: { transform: [{ scale: 0.97 }] },
  sideMenuActiveBar: { position: 'absolute', top: 18, bottom: 18, left: -14, width: 4, borderRadius: 4, backgroundColor: '#19D3FF' },
  sideMenuItemIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.12)' },
  sideMenuItemIconActive: { backgroundColor: '#12AEF2' },
  sideMenuItemCopy: { flex: 1 },
  sideMenuItemTitle: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '600' },
  sideMenuItemSubtitle: { color: '#B4D2F7', fontSize: 11, marginTop: 1, lineHeight: 15 },
  sideMenuSpacer: { flex: 1 },
  sideMenuFooter: { paddingHorizontal: 18, paddingTop: 14 },
  sideMenuCloseButton: { height: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)' },
  sideMenuCloseText: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '600' },
  sideMenuBank: { color: '#8FB6EA', fontSize: 10.5, letterSpacing: 1.5, textAlign: 'center', marginTop: 12 },
  sideMenuScroll: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  sideMenuScrollContent: { flexGrow: 1, paddingBottom: 14 },
  sideMenuSettings: { marginHorizontal: 18, marginTop: 22, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.18)' },
  sideMenuSectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  sideMenuSettingLabel: { color: '#D5E7FF', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  sideMenuChoices: { gap: 5 },
  sideMenuChoice: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 34, paddingHorizontal: 9, borderRadius: 11 },
  sideMenuChoiceSelected: { backgroundColor: 'rgba(255,255,255,0.15)' },
  sideMenuChoiceText: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  sideMenuRadio: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.72)', borderRadius: 9 },
  sideMenuRadioSelected: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#FFFFFF' },
  sideMenuLanguageLabel: { marginTop: 13 },
  sideMenuLanguageRow: { flexDirection: 'row', gap: 8 },
  sideMenuLanguageOption: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 38, paddingHorizontal: 8, borderRadius: 11 },
  sideMenuLanguageSelected: { backgroundColor: 'rgba(255,255,255,0.15)' },
  sideMenuQuickLinks: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginHorizontal: 18, marginTop: 15 },
  sideMenuQuickLink: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', minHeight: 38, paddingHorizontal: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.45)', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)' },
  sideMenuQuickLinkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' },
  hoursModalRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3,12,32,0.48)' },
  hoursModalPanel: { maxHeight: '82%', paddingBottom: 24, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: COLORS.surface },
  hoursModalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  hoursModalTitleGroup: { flex: 1 },
  hoursModalTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  hoursModalSubtitle: { color: COLORS.primary, fontSize: 12, fontWeight: '800', marginTop: 4 },
  hoursModalClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12 },
  hoursModalList: { gap: 9, paddingHorizontal: 18, paddingVertical: 16 },
  hoursModalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 63, paddingHorizontal: 15, paddingVertical: 9, borderWidth: 1, borderRadius: 14 },
  hoursModalRowOpen: { borderColor: '#BBE7CB', backgroundColor: '#F0FBF4' },
  hoursModalRowClosed: { borderColor: '#F2C8C8', backgroundColor: '#FFF5F5' },
  hoursModalDay: { color: COLORS.text, fontSize: 14, fontWeight: '900' },
  hoursModalTime: { color: '#15803D', fontSize: 12, fontWeight: '700', marginTop: 3 },
  hoursModalTimeClosed: { color: '#B91C1C' },
  hoursModalBadge: { overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99, backgroundColor: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  hoursModalBadgeOpen: { color: '#15803D' },
  hoursModalBadgeClosed: { color: '#B91C1C' },
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
  homeBanner: { position: 'relative', height: 210, padding: 20, borderRadius: 28, overflow: 'hidden', ...SHADOW.hero },
  homeBannerGlow: { position: 'absolute', width: 260, height: 260, right: -70, top: -70, borderRadius: 130, backgroundColor: 'rgba(25,211,255,0.35)' },
  homeBannerRing: { position: 'absolute', width: 240, height: 240, right: -40, bottom: -90, borderRadius: 120, borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
  homeBannerCopy: { zIndex: 2, width: '64%' },
  homeBannerCopyRTL: { width: '56%', paddingRight: 8 },
  homeBannerTag: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 7, paddingHorizontal: 11, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: RADIUS.pill, backgroundColor: 'rgba(255,255,255,0.16)' },
  homeBannerTagDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#19D3FF' },
  homeBannerTagText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  homeBannerTitle: { color: '#FFFFFF', fontSize: 20, lineHeight: 23, fontWeight: '700', marginTop: 11 },
  homeBannerText: { color: 'rgba(255,255,255,0.84)', fontSize: 11.5, lineHeight: 16, marginTop: 6 },
  homeBannerAction: { position: 'absolute', zIndex: 3, bottom: 18, minHeight: 38, maxWidth: '68%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, borderRadius: RADIUS.pill, backgroundColor: '#FFFFFF', ...SHADOW.card },
  homeBannerActionPressed: { transform: [{ scale: 0.96 }] },
  homeBannerActionText: { color: '#0A3F9C', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  homeBannerActionTextRTL: { textAlign: 'right' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  bannerTicketArt: { position: 'absolute', top: 22, right: 12, width: 150, height: 160 },
  bannerTicketRing: { position: 'absolute', top: 38, right: 30, width: 90, height: 90, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', borderRadius: 45 },
  bannerTicketCard: { position: 'absolute', top: 22, right: 4, width: 118, height: 136, alignItems: 'center', paddingTop: 12, borderRadius: 18, backgroundColor: '#FFFFFF', transform: [{ rotate: '7deg' }], elevation: 10, shadowColor: '#00145A', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 12 } },
  bannerTicketAgency: { color: '#4A78B8', fontSize: 9, fontWeight: '700', letterSpacing: 1.2 },
  bannerTicketNumber: { color: '#0A4FA8', fontSize: 48, lineHeight: 50, fontWeight: '800', marginTop: 5 },
  bannerTicketService: { color: '#0E2A55', fontSize: 11, fontWeight: '700' },
  bannerTicketDivider: { width: '82%', marginTop: 10, borderTopWidth: 2, borderStyle: 'dashed', borderColor: '#CFE0F5' },
  bannerTicketWait: { color: '#4A78B8', fontSize: 9, fontWeight: '600', marginTop: 6 },
  bannerTicketChip: { position: 'absolute', top: 6, left: -6, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.pill, backgroundColor: '#FFFFFF', elevation: 8, shadowColor: '#00145A', shadowOpacity: 0.3, shadowRadius: 12 },
  bannerTicketChipText: { color: '#0A3F9C', fontSize: 10, fontWeight: '700' },
  bannerCalendarArt: { position: 'absolute', top: 22, right: 12, width: 150, height: 160 },
  bannerCalendarCard: { position: 'absolute', top: 20, right: 2, width: 132, overflow: 'hidden', borderRadius: 18, backgroundColor: '#FFFFFF', transform: [{ rotate: '-6deg' }], elevation: 10, shadowColor: '#000A3C', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 12 } },
  bannerCalendarHeader: { height: 32, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A63E8' },
  bannerCalendarHeaderText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  bannerCalendarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 10 },
  bannerCalendarDayWrap: { position: 'relative', width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  bannerCalendarDayPulse: { position: 'absolute', width: 14, height: 14, borderWidth: 1.5, borderColor: '#19D3FF', borderRadius: 7 },
  bannerCalendarDay: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#E4EEFB' },
  bannerCalendarDaySelected: { backgroundColor: '#0A63E8', borderWidth: 2, borderColor: '#19D3FF' },
  bannerCalendarCheck: { position: 'absolute', top: 120, right: -2, width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: '#22C55E', elevation: 8, shadowColor: '#22C55E', shadowOpacity: 0.45, shadowRadius: 12 },
  bannerScreenArt: { position: 'absolute', top: 22, right: 12, width: 150, height: 160 },
  bannerSoundWave: { position: 'absolute', top: 2, right: 112, height: 26, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  bannerSoundBar: { width: 4, borderRadius: 3, backgroundColor: '#FFFFFF', opacity: 0.85 },
  bannerScreenFrame: { position: 'absolute', top: 26, right: 0, width: 146, height: 106, alignItems: 'center', paddingHorizontal: 10, paddingTop: 8, borderWidth: 3, borderColor: '#1C355F', borderRadius: 14, backgroundColor: '#06142F', transform: [{ rotate: '5deg' }], elevation: 10, shadowColor: '#00145A', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 12 } },
  bannerScreenLabel: { color: '#6FB4FF', fontSize: 7, fontWeight: '700', letterSpacing: 1.1 },
  bannerScreenNumberWindow: { position: 'relative', width: '100%', height: 48, overflow: 'hidden', alignItems: 'center' },
  bannerScreenNumber: { position: 'absolute', top: 0, color: '#4ADE80', fontSize: 42, lineHeight: 48, fontWeight: '800' },
  bannerScreenNextNumber: { top: 0 },
  bannerScreenCounter: { color: '#CFE6FF', fontSize: 9, fontWeight: '600' },
  bannerScreenStand: { position: 'absolute', top: 128, right: 46, width: 54, height: 8, borderRadius: 4, backgroundColor: '#1C355F' },
  heroDots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 10 },
  heroDot: { width: 6, height: 6, overflow: 'hidden', borderRadius: RADIUS.pill, backgroundColor: '#C6D6EA' },
  heroDotActive: { width: 30, height: 6, backgroundColor: '#C6D6EA' },
  heroDotProgress: { height: '100%', borderRadius: RADIUS.pill, backgroundColor: '#0A63E8' },
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
  activityHistoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  activityHistoryDelete: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', marginTop: SPACING.md, marginBottom: SPACING.sm, borderRadius: 19, borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  activityConfirmOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: SPACING.xl, backgroundColor: 'rgba(3,12,32,0.64)' },
  activityConfirmCard: { width: '100%', maxWidth: 420, padding: SPACING.xl, borderRadius: 26, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, ...SHADOW.hero },
  activityConfirmCardDark: { borderColor: '#28445D', backgroundColor: '#142638' },
  activityConfirmIcon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md, borderRadius: 16, backgroundColor: '#FEF2F2' },
  activityConfirmTitle: { color: COLORS.text, fontSize: 20, fontWeight: '900' },
  activityConfirmTitleDark: { color: '#E7EEF6' },
  activityConfirmMessage: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: SPACING.sm },
  activityConfirmMessageDark: { color: '#A5B5C5' },
  activityConfirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: SPACING.sm, marginTop: SPACING.xl },
  activityConfirmButton: { minWidth: 104, minHeight: 46, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.lg, borderRadius: RADIUS.md },
  activityConfirmCancel: { borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  activityConfirmCancelDark: { borderColor: '#34495D', backgroundColor: '#1B3448' },
  activityConfirmCancelText: { color: COLORS.primary, fontSize: 13, fontWeight: '800' },
  activityConfirmCancelTextDark: { color: '#70BFF2' },
  activityConfirmDelete: { backgroundColor: COLORS.primary },
  activityConfirmDeleteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  activityConfirmButtonDisabled: { opacity: 0.65 },
  activityTicketCard: { position: 'relative', padding: SPACING.md, marginBottom: SPACING.md, overflow: 'hidden', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(63,185,255,0.42)', backgroundColor: COLORS.dark, ...SHADOW.hero },
  activityTicketCardCalled: { borderColor: 'rgba(45,235,184,0.65)' },
  activityTicketHistoryCard: { minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderRadius: 18, borderColor: 'rgba(203,213,225,0.28)' },
  activityTicketHistoryNumber: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  activityTicketHistoryStatus: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: RADIUS.pill, backgroundColor: 'rgba(100,116,139,0.45)' },
  activityTicketHistoryStatusText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  activityTicketOrb: { position: 'absolute', top: -95, right: -72, width: 205, height: 205, borderRadius: 103, borderWidth: 1, borderColor: 'rgba(39,197,245,0.14)', backgroundColor: 'rgba(39,197,245,0.06)' },
  activityTicketHeader: { zIndex: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm },
  activityTicketIdentity: { flex: 1, minWidth: 0 },
  activityTicketAgency: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  activityCardEyebrow: { color: '#9DEBFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  activityTicketNumber: { color: '#FFFFFF', fontSize: 27, lineHeight: 32, fontWeight: '900', marginTop: 5, letterSpacing: 0.2 },
  activityTicketServiceChip: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, maxWidth: '88%', paddingHorizontal: 10, paddingVertical: 5, marginTop: 5, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: 'rgba(99,177,255,0.22)', backgroundColor: 'rgba(8,52,101,0.72)' },
  activityTicketService: { flexShrink: 1, color: '#D8EDFF', fontSize: 11, fontWeight: '800' },
  activityStatusPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', maxWidth: '46%', paddingHorizontal: 9, paddingVertical: 7, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)', backgroundColor: 'rgba(10,95,137,0.72)' },
  activityStatusPillCalled: { borderColor: 'rgba(45,235,184,0.55)', backgroundColor: 'rgba(5,150,105,0.84)' },
  activityLiveDot: { width: 7, height: 7, borderRadius: 4, marginRight: 6, backgroundColor: '#38D9FF' },
  activityLiveDotCalled: { backgroundColor: '#4ADE80' },
  activityStatusText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900', flexShrink: 1 },
  activityTicketCallout: { zIndex: 1, minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.md },
  activityTicketCallIcon: { position: 'relative', width: 60, height: 60, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 30, borderWidth: 2, borderColor: 'rgba(39,197,245,0.66)', backgroundColor: 'rgba(0,120,195,0.22)', shadowColor: '#10CFFF', shadowOpacity: 0.28, shadowRadius: 12, elevation: 4 },
  activityTicketCallPulse: { position: 'absolute', top: -4, right: -4, bottom: -4, left: -4, borderWidth: 2, borderColor: '#25DFFF', borderRadius: 34 },
  activityTicketCallCopy: { flex: 1, minWidth: 0 },
  activityTicketLead: { color: '#FFFFFF', fontSize: 17, lineHeight: 21, fontWeight: '900', letterSpacing: 0.3 },
  activityTicketLeadCalled: { color: '#39DFFF', fontStyle: 'italic', fontSize: 19, lineHeight: 23 },
  activityTicketCallHint: { color: '#BBD9EB', fontSize: 11, fontWeight: '700', marginTop: 5 },
  activityTicketProgressPanel: { zIndex: 1, padding: SPACING.md, marginTop: SPACING.sm, borderRadius: 21, borderWidth: 1, borderColor: 'rgba(34,130,255,0.32)', backgroundColor: 'rgba(3,27,73,0.55)' },
  activityTicketStats: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: SPACING.sm },
  activityPeopleAhead: { flex: 1, color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  activityPeopleAheadLabel: { color: '#D3E5FF', fontSize: 12, fontWeight: '700' },
  activityProgressText: { color: '#39E4FF', fontSize: 25, fontWeight: '900' },
  activityProgressTrack: { height: 12, overflow: 'hidden', marginTop: SPACING.sm, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(44,196,255,0.45)', backgroundColor: 'rgba(255,255,255,0.13)' },
  activityProgressFill: { height: '100%', borderRadius: 6, backgroundColor: '#10CFFF', shadowColor: '#15D9FF', shadowOpacity: 0.85, shadowRadius: 8, elevation: 2 },
  activityTicketFooter: { zIndex: 1, minHeight: 67, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm, paddingHorizontal: SPACING.sm, marginTop: SPACING.md, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(44,140,255,0.24)', backgroundColor: 'rgba(7,42,83,0.62)' },
  activityTicketMetric: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 7 },
  activityTicketMetricRight: { justifyContent: 'flex-end' },
  activityMetricIcon: { width: 30, height: 30, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: 'rgba(16,207,255,0.12)' },
  activityMetricDivider: { width: 1, height: 36, backgroundColor: 'rgba(118,185,255,0.2)' },
  activityMetaLabel: { color: '#91B7D2', fontSize: 9, fontWeight: '900', letterSpacing: 0.6 },
  activityMetaValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900', marginTop: 3 },
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
  primaryCard: { borderColor: '#0754D8', backgroundColor: '#0754D8', overflow: 'hidden' },
  actionIcon: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.light },
  primaryIcon: { backgroundColor: 'rgba(255,255,255,.15)' },
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
  advisorSearchBox: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, marginBottom: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  advisorSearchInput: { flex: 1, minWidth: 0, paddingVertical: SPACING.sm, color: COLORS.text, fontSize: 14 },
  advisorGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  advisorCard: { width: '48.5%', minHeight: 138, padding: SPACING.md, marginBottom: SPACING.md, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface, ...SHADOW.card },
  advisorCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  advisorInitials: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.md, backgroundColor: COLORS.light },
  advisorInitialsText: { color: COLORS.primary, fontSize: 12, fontWeight: '900' },
  advisorName: { color: COLORS.text, fontSize: 13, lineHeight: 17, fontWeight: '900' },
  advisorAgency: { color: COLORS.muted, fontSize: 10, fontWeight: '700', marginTop: SPACING.xs },
  advisorEmpty: { width: '100%', padding: SPACING.lg, color: COLORS.muted, fontSize: 13, textAlign: 'center' },
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
  screenHero: { position: 'relative', width: '100%', height: 160, padding: SPACING.lg, marginBottom: SPACING.lg, overflow: 'hidden', borderRadius: 28, backgroundColor: COLORS.dark, ...SHADOW.hero },
  screenHeroOrb: { position: 'absolute', width: 210, height: 210, right: -82, top: -78, borderRadius: 105, backgroundColor: 'rgba(39,197,245,0.24)' },
  screenHeroCopy: { zIndex: 2, maxWidth: '78%' },
  screenHeroEyebrow: { color: '#9DEBFF', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  screenHeroTitle: { color: COLORS.surface, fontSize: 22, lineHeight: 27, fontWeight: '900', marginTop: 9 },
  screenHeroText: { color: '#D7EDF8', fontSize: 12, lineHeight: 18, marginTop: 8 },
  screenHeroBadge: { position: 'absolute', right: 18, bottom: 18, width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)', backgroundColor: 'rgba(255,255,255,0.12)' },
  screenHeroBadgeText: { color: COLORS.surface, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  screenDisplayWelcome: { position: 'relative', minHeight: 180, padding: SPACING.md, marginBottom: SPACING.lg, overflow: 'hidden', borderRadius: RADIUS.xl, borderWidth: 1, borderColor: '#D5E7F5', backgroundColor: '#EEF7FF', ...SHADOW.card },
  screenDisplayOrbTop: { position: 'absolute', width: 150, height: 150, right: -70, top: -72, borderRadius: 75, backgroundColor: 'rgba(0,102,164,0.10)' },
  screenDisplayOrbBottom: { position: 'absolute', width: 120, height: 120, left: -65, bottom: -70, borderRadius: 60, backgroundColor: 'rgba(0,102,164,0.10)' },
  screenDisplayBrand: { flexDirection: 'row', alignItems: 'center', zIndex: 2 },
  screenDisplayLogoFrame: { width: 54, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: '#D5E7F5', backgroundColor: COLORS.surface, ...SHADOW.card },
  screenDisplayLogo: { width: 44, height: 48, resizeMode: 'contain' },
  screenDisplayBrandCopy: { flex: 1, marginLeft: SPACING.lg },
  screenDisplayBrandName: { color: COLORS.primary, fontSize: 14, fontWeight: '900', letterSpacing: 0.8 },
  screenDisplayAgency: { color: COLORS.text, fontSize: 18, fontWeight: '900', marginTop: 5 },
  screenDisplayCity: { color: COLORS.muted, fontSize: 11, fontWeight: '600', marginTop: 3 },
  screenDisplayWelcomeTitle: { paddingLeft: SPACING.md, marginTop: SPACING.md, borderLeftWidth: 4, borderLeftColor: COLORS.primary, zIndex: 2 },
  screenDisplayWelcomeText: { color: COLORS.deep, fontSize: 22, lineHeight: 25, fontWeight: '900' },
  screenDisplayStatusRow: { flexDirection: 'row', alignItems: 'center', paddingTop: SPACING.sm, marginTop: SPACING.sm, borderTopWidth: 1, borderTopColor: '#D5E7F5', zIndex: 2 },
  screenDisplayStatusDot: { width: 8, height: 8, marginRight: 6, borderRadius: 4 },
  screenDisplayStatusText: { fontSize: 11, fontWeight: '900' },
  screenDisplayStatusHours: { color: COLORS.muted, fontSize: 11, fontWeight: '700', marginLeft: 'auto' },
  screenClosedCard: { alignItems: 'center', justifyContent: 'center', minHeight: 265, padding: SPACING.xl, marginBottom: SPACING.lg, borderRadius: RADIUS.xl, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FFF1F2', ...SHADOW.card },
  screenClosedEyebrow: { color: '#EF4444', fontSize: 11, fontWeight: '900', letterSpacing: 1.1, textAlign: 'center' },
  screenClosedLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', width: '100%', paddingVertical: SPACING.lg, marginTop: SPACING.lg, borderRadius: RADIUS.md, backgroundColor: '#DC2626', ...SHADOW.card },
  screenClosedLabelText: { color: COLORS.surface, fontSize: 23, fontWeight: '900', marginLeft: SPACING.sm },
  screenClosedText: { color: '#991B1B', fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'center', marginTop: SPACING.lg },
  screenClosedHours: { color: '#B91C1C', fontSize: 12, fontWeight: '800', marginTop: SPACING.md },
  screenSearchBox: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, height: 56, paddingHorizontal: SPACING.md, marginBottom: SPACING.md, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surface },
  screenSearchSticky: { zIndex: 2, elevation: 4 },
  screenSearchInput: { flex: 1, minWidth: 0, height: 48, paddingHorizontal: 0, paddingVertical: 0, includeFontPadding: false, textAlignVertical: 'center', color: COLORS.text, fontSize: 14 },
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
  liveNumberPanelEmpty: { paddingHorizontal: SPACING.md },
  liveNumber: { color: COLORS.surface, fontSize: 68, lineHeight: 76, fontWeight: '900' },
  liveNumberEmptyText: { color: '#D7EDF8', fontSize: 18, lineHeight: 24, textAlign: 'center' },
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
  liveUpdateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.success },
  liveUpdateDotError: { backgroundColor: COLORS.error },
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
  bottomNavPro: { position: 'absolute', left: 12, right: 12, bottom: 8, minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 5, overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: 'rgba(116,177,255,0.72)', backgroundColor: '#0A1B3B', shadowColor: '#006DFF', shadowOpacity: 0.24, shadowRadius: 18, shadowOffset: { width: 0, height: 7 }, elevation: 12 },
  bottomNavProDark: { borderColor: 'rgba(73,154,255,0.78)', shadowOpacity: 0.34 },
  navItemPro: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', minHeight: 60, borderRadius: 23 },
  navPressedPro: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  navInactiveContentPro: { width: '100%', minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 2 },
  navIconContainer: { position: 'relative', width: 26, height: 25, alignItems: 'center', justifyContent: 'center' },
  activityNavBadge: { position: 'absolute', top: -4, right: -9, minWidth: 17, height: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: '#0A1B3B', backgroundColor: '#EF3340' },
  activityNavBadgeText: { color: '#FFFFFF', fontSize: 9, lineHeight: 12, fontWeight: '900', textAlign: 'center' },
  navActiveCapsulePro: { position: 'relative', width: '100%', minHeight: 60, alignItems: 'center', justifyContent: 'center', gap: 2, overflow: 'hidden', borderRadius: 23, shadowColor: '#0988FF', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  navActiveGlowPro: { position: 'absolute', left: '22%', right: '22%', bottom: 2, height: 3, borderRadius: 2, backgroundColor: '#8EEBFF', shadowColor: '#52DFFF', shadowOpacity: 1, shadowRadius: 7, elevation: 4 },
  navLabelPro: { maxWidth: '100%', color: '#C4D5F2', fontSize: 9, fontWeight: '700', marginTop: 2, textAlign: 'center' },
  navLabelActivePro: { maxWidth: '100%', color: '#FFFFFF', fontSize: 9, fontWeight: '900', marginTop: 2, textAlign: 'center' },
}), {
  get(target, property, receiver) {
    const style = Reflect.get(target, property, receiver)
    if (!activeDarkMode || !style || typeof style !== 'object') return style
    return Object.fromEntries(Object.entries(style).map(([key, value]) => {
      if (typeof value !== 'string') return [key, value]
      const replacement = DARK_STYLE_COLORS[key]?.[value.toLowerCase()]
      return [key, replacement ?? value]
    }))
  },
})
