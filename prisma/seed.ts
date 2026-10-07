import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const AGENCIES = [
  { code: '00000', name: 'CENTRALE', address: '10 Bis, Avenue Mohamed V 1001 Tunis', latitude: 36.8017081, longitude: 10.1858175 },
  { code: '00101', name: 'ENNASR', address: 'Residence Said, Avenue Hedi Nouira 2001 Ennasr', latitude: 36.8620169, longitude: 10.1656258 },
  { code: '00202', name: 'LIBERTE', address: '110, Avenue de la Liberte, Tunis Belvedere 1002 Tunis', latitude: 36.81838, longitude: 10.17842 },
  { code: '00303', name: 'ARIANA', address: '76, Avenue Habib Bourguiba 2080 Ariana', latitude: 36.8543854, longitude: 10.1866034 },
  { code: '00404', name: 'PALMARIUM', address: 'Local 16, Centre Commercial le Palmarium, Avenue Habib Bourguiba 1001 Tunis', latitude: 36.7993585, longitude: 10.1812363 },
  { code: '00505', name: 'CENTRE URBAIN', address: 'Avenue de la Terre, Centre Urbain Nord 1003 Cite El Khadra', latitude: 36.8403909, longitude: 10.1992071 },
  { code: '00606', name: 'MEGRINE', address: '15, Avenue Habib Bourguiba 2033 Megrine', latitude: 36.7682055, longitude: 10.2394751 },
  { code: '00707', name: 'BERGES DU LAC', address: 'Rue du Lac Constance, Imm El Majd B1 1053 Les Berges du Lac', latitude: 36.8317396, longitude: 10.2321553 },
  { code: '00808', name: 'SOUKRA', address: 'Avenue Union du Maghreb Arabe, Route de la Soukra, Imm Imen, bloc C 2036 La Soukra', latitude: 36.86551, longitude: 10.21885 },
  { code: '00909', name: 'SOUSSE', address: '97, Avenue Habib Bourguiba 4000 Sousse', latitude: 35.832384, longitude: 10.6399959 },
  { code: '01010', name: 'BARDO', address: '37, Avenue Habib Bourguiba, Le Bardo 2000', latitude: 36.8101952, longitude: 10.1400322 },
  { code: '01111', name: 'LA MARSA', address: '2 Bis, Avenue Taieb Mhiri 2070 La Marsa', latitude: 36.8811417, longitude: 10.3254345 },
  { code: '01212', name: 'SFAX', address: '33, Avenue Hedi Chaker 3000 Sfax', latitude: 34.7333557, longitude: 10.7633561 },
  { code: '01313', name: 'SFAX 2', address: 'Immeuble City Centre 2, Boulevard Majida Boulila, Sfax', latitude: 34.7424941, longitude: 10.7543921 },
  { code: '01414', name: 'BEN AROUS', address: '45, Avenue de France 2013 Ben Arous', latitude: 36.7477329, longitude: 10.2401832 },
  { code: '01515', name: 'HAMMEM SOUSSE', address: 'Avenue du 14 Janvier, Sindbad Center 4011 Hammam Sousse', latitude: 35.8656608, longitude: 10.6068814 },
  { code: '01616', name: 'ALAIN SAVARY', address: '31 Bis, Avenue Alain Savary 1002 Tunis', latitude: 36.8253783, longitude: 10.1825935 },
  { code: '01717', name: 'BIZERTE', address: '10 Bis, Avenue Habib Bourguiba 7000 Bizerte', latitude: 37.2741979, longitude: 9.8742735 },
  { code: '01818', name: 'NABEUL', address: 'Avenue Hedi Nouira, Centre Medical Eya 8000 Nabeul', latitude: 36.4459177, longitude: 10.7172275 },
  { code: '01919', name: 'GABES', address: 'Rue Bechir Jaziri 6000 Gabes', latitude: 33.8836164, longitude: 10.0925732 },
  { code: '02020', name: 'MONASTIR', address: 'Avenue Taieb Mhiri 5000 Monastir', latitude: 35.7543139, longitude: 10.8105469 },
  { code: '02121', name: 'LE KRAM', address: 'Residence Emna, Avenue Mohamed V 2089 Le Kram', latitude: 36.8330234, longitude: 10.3103471 },
  { code: '02222', name: 'MENZAH 9', address: '39, Avenue Tahar Ben Ammar 1013 El Menzah 9', latitude: 36.8428637, longitude: 10.1548004 },
  { code: '02323', name: 'GROMBALIA', address: 'Avenue Habib Bourguiba, Elyes Center 8030 Grombalia', latitude: 36.6009426, longitude: 10.4974043 },
  { code: '02424', name: 'MGHIRA', address: '10, Angle Avenue Ben Arous et Rue Khledia 2082 ZI Meghira', latitude: 36.715895, longitude: 10.180865 },
  { code: '02525', name: 'MOUROUJ6', address: '10 Residence Mabrouka 1, Lot EHC33 2074 El Mourouj 6', latitude: 36.7128389, longitude: 10.2153694 },
  { code: '02626', name: 'DJERBA', address: '75, Avenue Habib Bourguiba 4180 Houmt Souk Djerba', latitude: 33.8076, longitude: 10.84515 },
  { code: '02727', name: 'SFAX 3', address: 'Rue Jameleddine El Afghani, Immeuble Tricomode, ZI Poudriere 1 3002 Sfax', latitude: 34.7528055, longitude: 10.7747968 },
  { code: '02828', name: 'MONTPLAISIR', address: 'Immeuble 45, Rue du Japon 1002 Montplaisir Tunis', latitude: 36.8170146, longitude: 10.18676121 },
  { code: '02929', name: 'El Ghazella', address: 'Residence Donia, Angle Route de Raoued et Rue Omar Ben Abdelaziz 2083 Cite El Ghazella', latitude: 36.8875806, longitude: 10.1826668 },
  { code: '03030', name: 'RADES', address: 'Rue de Marseille, Zone portuaire de Rades 2040 Rades', latitude: 36.7995653, longitude: 10.2753264 },
  { code: '03131', name: 'BEJA', address: '75, Avenue Habib Bourguiba 9000 Beja', latitude: 36.7227014, longitude: 9.1823199 },
  { code: '03232', name: 'MOUROUJ1', address: 'Residence Elysee Medical, Angle des rues Mahdia et Sousse 2074 El Mourouj 1', latitude: 36.7350192, longitude: 10.2113498 },
  { code: '03333', name: 'SFAX4', address: "Residence Arridha, Route d'El Ain Km 4, Merkez Walha 3051 Sfax", latitude: 34.7573878, longitude: 10.7211187 },
  { code: '03434', name: 'LAC 2', address: 'Immeuble Equinoxe, Avenue de la Bourse, Les Jardins du Lac 2 Tunis', latitude: 36.84859, longitude: 10.26508 },
  { code: '03636', name: 'HAMMAMET', address: '46, Avenue Habib Bourguiba 8050 Hammamet', latitude: 36.398288, longitude: 10.6119577 },
  { code: '03737', name: 'SOUSSE 3', address: 'Avenue Commandant Bejaoui, Route Kalaa Sghira, Cite Bouhssina, Sousse', latitude: 35.824364, longitude: 10.628328 },
  { code: '03838', name: 'Menzah 6', address: 'Centre Commercial Cite Jamil 15, 2091 Menzah 6 Ariana', latitude: 36.847534, longitude: 10.166793 },
  { code: '03939', name: 'MAHDIA', address: 'Immeuble Imededdine, Rue Ibn Al Jazzar, Route de Tunis 5111 Mahdia', latitude: 35.506371, longitude: 11.03506 },
  { code: '04040', name: 'Zaghouan Hammam Zriba', address: 'Centre de Vie, Zone Industrielle Zaghouan - Hammam Zriba', latitude: 36.35791, longitude: 10.20692 },
  { code: '04141', name: 'SFAX 5', address: 'Residence les Jasmins, Km 5 Route de Mahdia, Sakiet Eddaier, Sfax', latitude: 34.78828, longitude: 10.77899 },
  { code: '04242', name: 'AGBA', address: 'Centre de vie et affaires, Zone Industrielle El Agba', latitude: 36.79235, longitude: 10.07394 },
  { code: '04343', name: 'BIZERTE 2', address: 'Residence Taim, Avenue 14 Janvier 7000 Bizerte', latitude: 37.286649, longitude: 9.86425 },
  { code: '04444', name: 'LE KEF', address: 'A01 Centre Commercial Taoufik, Rue Hedi Chaker Hached 7100 El Kef', latitude: 36.179689, longitude: 8.7092294 },
  { code: '04545', name: 'Kasserine', address: 'Avenue Habib Bourguiba, local commercial 01, Kasserine 1200', latitude: 35.1676, longitude: 8.8365 },
]

const CHARGE_ROWS = `
SANA JELLALI                   05757
AMIRA ROMDHANI                 00101
CHEMSEDDINE BEN GBILA          05757
AYMEN LAARIBI                  04040
MOHAMED ALI ALOUI              05757
RABAA CHAABANE                 01818
MERIAM ABDELAZIZ               01919
MABROUKA ALI                   01919
SAWSSEN ABIDA                  02727
HANEN BEN ATIA                 02121
ANIS GHANNAY                   03737
EYETOLLAH SFAXI                09991
AYMEN BAGGA                    03939
MALEK AMARA                    00000
SEIFEDDINE MOKHTARI            02424
YOSRA TAHARI                   02222
AHLEM KHAY                     01818
RAWEN YAAKOUBI                 02323
AHMED KHAY                     04040
IKHLAS DAOUD                   04141
RAFIK LATROUS                  01818
IMEN FARHAT                    00303
NADIA TAKTAK                   01010
SABRINE OUERGHI                00101
HAFEDH EL GHALI                04141
AMIRA MAMLOUK                  05757
RIHAB LADJIMI                  03232
FADWA ZAKRAOUI                 02828
LAROUSSI FASSATOUI             05757
KHADIJA BSAISSA                01616
HAMED ZAYANI                   04343
YOUSSEF ZEKRI                  01414
MOHAMED ELHIF                  09797
NOUREDDINE BEL HAJ AMMAR       05757
RADHOUANE HOURIA               09797
KHAOULA HEDRICHE               01111
SKANDER FAYALA                 05757
JIHENE SABBAGH                 03636
JAMIL MARZOUGUI                01919
LILIA REZGUI                   00404
ZIED ATTABI                    05757
AYMEN ACHOUR                   05757
ABDELKARIM TALBI               09797
KAIS OUERTANI                  01111
ZIED HADJ HMED                 05757
FAOUZI LABESSI                 05757
MOHAMED ALI EL HAFI            02929
MOEZ CHOUAIBI                  05757
SALMA CHELLI                   03333
EMNA DJELLOULI                 00808
ABDELAZIZ TOUATI               02828
HATEM HAMMAMI                  02424
WIDED FARES                    01818
ICHRAK JALLOUL                 02323
HATEM AZAIEZ                   01010
IMEN BEN CHAABANNE             05757
ACHRAF FARHAT                  05757
AMAL MANSOUR                   00202
RIM BEN ROMDHANE               00707
SONIA EL JANI                  00404
AMENI AMMAR                    00909
RANIA MEDDEB                   05757
MOURAD KAMOUN                  03838
JIHENE BELKHIRIA               00909
KHELIL DALLELI                 05151
RANIA LAKHAL SAHLI             05757
MAYSOUN MOBARAK                09991
RIM SADDEM                     01414
CHEDLY DARRAGI                 05757
ALLEM MLIKA                    01515
YOUSSEF KARAOULI               02929
MAHMOUD BEN SASSI              00606
ALYA BRIGUI                    01616
SAMI HABOURIA                  00202
AICHA EL MECHERI               02121
RIDHA JABALLAH                 05757
MOHAMED HEDI RIAHI             00101
SIHEM AISSA                    05757
TAREK MAGOURI                  05757
LAMIA KHADRAOUI                05151
NASSIRA AYED                   02121
FETEN BELLIL LAHMAR            02525
TAREK DJELLOULI                03434
ZIED YAHYAOUI                  05757
GHAZI BEN YOUSSEF              02222
TRAKI ZHANI                    05757
NOUREDDINE CHAABOUNI           01313
MEHREZ BOUDABBOUS              01414
SAWSSEN SOUMMER BELWAFA        03232
LOTFI NABI                     05757
HICHEM BEN YAHIA               09991
RIM BEN HAMIDA                 05757
OLFA REZGUI                    01616
TAREK MAHDHI                   02626
ADEL TRABELSI                  02828
AHMED KRID                     02727
BEN SAID ABDELWAHED            01717
SARAH MIRAOUI                  02222
HANA CHOUIK                    01616
MERIAM BEN MILED               00000
ASMA BEN MNA                   00303
SANA BEN SLAMA                 00606
MOHAMED KAOUECH                02020
FATMA GHARBI                   05757
MOHAMED WIEM BEN FADHEL        00909
BRAHIM TRABELSI                01717
EMNA ADOUANI                   03232
SONIA KRIMI                    00505
KHEMAIS DAGHARI                04545
FAROUK BELHAJ                  00000
HICHEM SFEYHI                  03838
TRABELSI CYRINE                02424
SOFIENE JLIDI                  02626
SARRA BEN JEMAA                02626
MAROUA AYARI                   00000
HAKIM KHOUDI                   01515
SEIFALLAH MOUSLI               09991
FEHMI ELLEFI                   03131
HAIFA KOUKI                    03131
HANI RIAHI                     04444
HAMDA MKAOUER                  01212
AMINE JERJIR                   00808
KHALED MEKNI                   02525
KHOULOUD ABDELKADER            03737
MHAMED RAFRAFI                 00303
ICHRAF GUERMAZI                02727
YASMINE BEN ALAYA              03939
MOHAMED AMINE MOUSCOU          04242
AYMEN KHARRAT                  05757
ATEF BEN SAAD                  03030
DHOUHA ELFERSI                 05757
SLIM MRAIDI                    00808
YASSINE BAHLOUS                03131
IMENE BOUYAHYA                 03232
OUSSAMA FAKHFAKH               03333
HILEL KORBI                    02323
DORRA GHANJOURI                02525
SANA KAROUI                    09797
CHAIMA CHAKCHOUK               03434
NESRINE BEN GHRIB              05757
DOUAA  HAYEK                   00202
YOUSSEF DIOURI                 00202
MOHAMED NEKHILI                05757
HAMADI ZAIDI                   00505
MARIEM LOUGUINI                01414
RANIA BEN AHMED                05757
YASSINE ABDELMOULA             01212
MOLKA MSSEDI                   03333
FATMA MKAOUAR                  00707
HAZAR LAMOURI                  03030
NAOUEL FELEFEL                 09797
SALMA FITOURI                  00000
SKANDER TURKI                  00606
SEDKI MAKERHI                  01919
REBAA DELLA                    02929
SAHAR SMAOUI                   01212
HEND HARZALLAH                 02020
RIHAB JAOUADI                  05757
IHEB CHERNI                    01010
ELYES JABALLAH                 00808
DHOUHA ZHIOU                   01111
FARAH BENLILI                  05757
MARIEM JOUINI                  00000
EMNA SALMI                     00505
MARIEM KHEMIRI                 03333
JIHED DAOUED                   03333
GHAYA BEN HAMADOU              01212
IHEB ABDENADHER                01212
RAHMA JRIDI                    01313
RACEM SMAOUI                   02727
SAHAR BEN SALEM                02727
RABII BEN SAAD                 05757
DHOUHA MEDDEB                  02222
FATMA GHARBI (AG)              00606
EYA ZOUARI                     02626
ZINA DORBEZ                    04343
SARRA AMMORI                   01919
SABER KADDOUR                  05757
WAEL MESSAOUI                  02323
YASSINE DHOUIBI                03232
MOURAD BOUSNINA                00808
AMAL SASSI                     00202
JIHENE BEN JEBARA              02424
AHMED TRIGUI                   03838
EMNA HOSNI                     00303
DOUAA RIAHI                    03131
RANIA CHEKILI                  02828
OUMAIMA CHEMKHI                01818
LEILA DABBEBI                  01212
NADA DHIFALLAH                 04141
BESMA TILOUCH                  05757
SAHAR HICHRI                   01010
HIBA GARGOURI                  02929
ZIED HOBBI                     03030
FERYEL ACHOUR                  00202
MARIEM DRIDI                   00404
RAKIA EL KADHI                 02626
INES BEN MOHAMED               02626
EMNA JEBALI                    05757
FATMA FARHAT                   01919
BADIS ISSAOUI                  05757
NOUHEB MZOUGHI                 05757
MEDALI HANNACHI                00101
SIRINE ZAHMOUL                 00404
EMNA HOSNY                     02929
LAZHER HAJAHMED                02020
OUMAYMA MARZOUK                02020
SOFIENE FRIAA                  00303
MARYEM NAGHMOUCHI              01010
JASSER ASSADI                  02626
RAHMA ERNEZ                    00909
SIRINE CACHIA                  01515
AMIR IKRAM                     03636
EMNA MOKAADI                   04242
GHOFRANE WECHTATI              02424
NADA BOUALLAGUI                01717
HOUSSEM MEJRI                  00606
RIHAB MOUSSI                   01111
YOSRA FAZZENI                  00202
ABDELLATIF KAHLAOUI            00404
MARIEM KHEZAMI                 05757
RIMA SAADI                     02222
NESRINE TITEY                  05757
SIHEM FATNASSI                 01515
MARIEM BEN AMMAR               00000
OUMAYMA BEN ANAYA              01515
SIRINE MBARKI                  01212
MARIAM ROMDHANE                02020
WALID BOUGUERRA                01515
ISLEM BEN KMICHA               01010
HANENE AYARI                   00303
SAFA JAOUADI                   00505
IYED ACHECH                    02020
AIDA MOHAMED                   01313
OUMAIMA BOUARADA               02727
ISRAA BAKHTI                   03636
JIHEN MAKNI                    02121
IMEN MNASRI                    03434
SIRINE MAAMOURI                00000
MARIEM BAHRINI                 02323
ASMA CHTIOUI                   02323
MARAM BEN GARA                 04343
SYRINE KHAMMAR                 02424
SIWAR AOUADI                   03030
SYRINE BOUCHAMI                03838
EYA RAZGALLAH                  00606
KHAWLA KHARDANI                02727
AMAL SIDHOM                    03939
NOURCHENE BEN HAJSALEM         03939
SERI LAATIRI                   01515
MALEK DHOUIB                   00909
CHAIMA BENMOHAMED              00707
JAMILA TRABELSI                01414
WAFA BOUSSETTA                 05757
INES MBAREK                    01818
KENZA ELGHARBI                 01818
MEDAZIZ DEROUICHE              01414
LYES BABBOU                    01515
NOUSSAIBA BENKHELIL            01717
ZIED ELGRAGBA                  01515
HAIFA HADJBRAHIM               03232
NADHIR CHEBBI                  03636
SALMA MNAKBI                   05757
EMNA BEN ROMDHANE              04040
ROUA KSONTINI                  02020
MARWA FTITA                    04242
MOHAMED ALI HAMDANI            05757
WAJIH OUERGHI                  05757
WIDED BOUAZIZ                  00303
YOUSSRI BOULIFI                03131
FIRAS BEN HASSINE              01010
OUMAIMA TRAIDI                 03131
HAMZA BEN HMIDA                01111
SYRINE KHRAIEF                 04242
MARWA KLICHE                   02222
AMEL JEBALI                    00505
SALEM ZGAR                     05757
YASSINE BEZI                   05757
RANIA ZANETI                   00707
NOURHEN HIZAOUI                05757
AHMED AKRIMI                   05757
AMENI CHMENGUI                 05757
AZZA JOUINI                    04343
WEJDENE LASMER                 05757
RABEB HOUIJI                   05757
GHOFRANE CHTIOUI               05757
`

const CHARGES: {
  code: string
  name: string
  agencyCode: string
  email?: string
  phone?: string
}[] = CHARGE_ROWS.trim().split(/\r?\n/).map((line, index) => {
  const match = line.match(/^(.*?)\s+(\d{5})$/)
  if (!match) {
    throw new Error(`Ligne charge invalide ${index + 1}: ${line}`)
  }

  return {
    code: `CH${String(index + 1).padStart(4, '0')}`,
    name: match[1].trim().replace(/\s+/g, ' '),
    agencyCode: match[2],
  }
})

async function resetAppointmentData() {
  // Suppression via Prisma pour rester compatible MySQL/MariaDB et PostgreSQL.
  await prisma.appointment.deleteMany()
  await prisma.chargeAvailability.deleteMany()
  await prisma.chargeDayBlock.deleteMany()
  await prisma.charge.deleteMany()
}

async function resetAgencies() {
  await resetAppointmentData()
  await prisma.ticket.deleteMany()
  await prisma.dailyCounter.deleteMany()
  await prisma.guichet.deleteMany()
  await prisma.agency.deleteMany()
}

async function createDefaultAvailability(chargeId: number) {
  const weekdays = [0, 1, 2, 3, 4, 5, 6]
  for (const weekday of weekdays) {
    await prisma.chargeAvailability.create({
      data: {
        chargeId,
        weekday,
        enabled: weekday >= 1 && weekday <= 5,
        startTime: '08:30',
        endTime: '16:00',
        slotMinutes: 30,
      },
    })
  }
}

async function main() {
  console.log('Seeding BTKticket database...')
  console.log('Resetting old agencies...')

  await resetAgencies()

  const defaultPin = await bcrypt.hash('0000', 10)
  const agencyByCode = new Map<string, number>()

  for (const agencyData of AGENCIES) {
    const agency = await prisma.agency.create({
      data: {
        code: agencyData.code,
        name: agencyData.name,
        city: agencyData.name,
        address: agencyData.address,
        latitude: agencyData.latitude,
        longitude: agencyData.longitude,
        pin: defaultPin,
        isActive: true,
      },
    })

    agencyByCode.set(agencyData.code, agency.id)

    for (let number = 1; number <= 3; number++) {
      await prisma.guichet.create({
        data: {
          number,
          label: `Guichet ${number}`,
          agencyId: agency.id,
          isActive: true,
        },
      })
    }

    console.log(`  ${agencyData.code} - ${agencyData.name}`)
  }

  let createdCharges = 0
  let skippedCharges = 0

  for (const chargeData of CHARGES) {
    const agencyId = agencyByCode.get(chargeData.agencyCode)
    if (!agencyId) {
      console.log(`  Charge ignore: ${chargeData.code} - agence ${chargeData.agencyCode} introuvable`)
      skippedCharges += 1
      continue
    }

    const charge = await prisma.charge.create({
      data: {
        code: chargeData.code,
        name: chargeData.name,
        agencyId,
        email: chargeData.email ?? null,
        phone: chargeData.phone ?? null,
        isActive: true,
      },
    })

    await createDefaultAvailability(charge.id)
    createdCharges += 1
    console.log(`  Charge ${chargeData.code} - ${chargeData.name}`)
  }

  console.log(`Seed complete: ${AGENCIES.length} agencies, 3 guichets each, ${createdCharges} charges, ${skippedCharges} ignored.`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
}).finally(() => prisma.$disconnect())
