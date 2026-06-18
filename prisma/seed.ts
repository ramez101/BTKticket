import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const AGENCIES = [
  { name: "Tunis Centre", city: "Tunis" },
  { name: "Tunis Lafayette", city: "Tunis" },
  { name: "Tunis Lac", city: "Tunis" },
  { name: "Ariana", city: "Ariana" },
  { name: "La Marsa", city: "La Marsa" },
  { name: "Carthage", city: "Carthage" },
  { name: "Manouba", city: "Manouba" },
  { name: "Ben Arous", city: "Ben Arous" },
  { name: "Hammam-Lif", city: "Hammam-Lif" },
  { name: "Nabeul", city: "Nabeul" },
  { name: "Hammamet", city: "Hammamet" },
  { name: "Sousse Centre", city: "Sousse" },
  { name: "Sousse Corniche", city: "Sousse" },
  { name: "Monastir", city: "Monastir" },
  { name: "Mahdia", city: "Mahdia" },
  { name: "El Jem", city: "El Jem" },
  { name: "Sfax Centre", city: "Sfax" },
  { name: "Sfax Sud", city: "Sfax" },
  { name: "Gabès", city: "Gabès" },
  { name: "Gafsa", city: "Gafsa" },
  { name: "Tozeur", city: "Tozeur" },
  { name: "Kairouan", city: "Kairouan" },
  { name: "Kasserine", city: "Kasserine" },
  { name: "Sidi Bouzid", city: "Sidi Bouzid" },
  { name: "Le Kef", city: "Le Kef" },
  { name: "Jendouba", city: "Jendouba" },
  { name: "Béja", city: "Béja" },
  { name: "Siliana", city: "Siliana" },
  { name: "Zaghouan", city: "Zaghouan" },
  { name: "Mornag", city: "Mornag" },
  { name: "Grombalia", city: "Grombalia" },
  { name: "Kelibia", city: "Kelibia" },
  { name: "Korba", city: "Korba" },
  { name: "Menzel Temime", city: "Menzel Temime" },
  { name: "Bizerte Centre", city: "Bizerte" },
  { name: "Bizerte Nord", city: "Bizerte" },
  { name: "Menzel Bourguiba", city: "Menzel Bourguiba" },
  { name: "Tabarka", city: "Tabarka" },
  { name: "Ain Draham", city: "Ain Draham" },
  { name: "Médenine", city: "Médenine" },
  { name: "Djerba", city: "Djerba" },
  { name: "Zarzis", city: "Zarzis" },
  { name: "Tataouine", city: "Tataouine" },
  { name: "Ben Gardane", city: "Ben Gardane" },
]

async function main() {
  console.log('🌱 Seeding BTKticket database...')
  const adminPin = await bcrypt.hash('admin2024', 10)

  for (let i = 0; i < AGENCIES.length; i++) {
    const a = AGENCIES[i]
    const code = `AG${String(i + 1).padStart(2, '0')}`
    const pin = String(1000 + i)
    const hashedPin = await bcrypt.hash(pin, 10)

    const agency = await prisma.agency.upsert({
      where: { code },
      update: { name: a.name, city: a.city },
      create: { code, name: a.name, city: a.city, pin: hashedPin, isActive: true },
    })

    // 3 guichets per agency
    for (let g = 1; g <= 3; g++) {
      await prisma.guichet.upsert({
        where: { agencyId_number: { agencyId: agency.id, number: g } },
        update: {},
        create: { number: g, label: `Guichet ${g}`, agencyId: agency.id, isActive: true },
      })
    }
    console.log(`  ✅ ${code} — ${a.name} (PIN: ${pin})`)
  }
  console.log('\n✅ Seed complete! 44 agencies, 3 guichets each.')
  console.log('📌 PIN format: AG01 = 1000, AG02 = 1001, ..., AG44 = 1043')
}

main().catch(console.error).finally(() => prisma.$disconnect())
