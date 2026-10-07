import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js'

export type PhoneCountry = {
  code: CountryCode
  name: string
  dial: string
  flag: string
}

function countryFlag(code: string) {
  return String.fromCodePoint(...code.toUpperCase().split('').map(letter => 127397 + letter.charCodeAt(0)))
}

const countryNames = new Intl.DisplayNames(['fr'], { type: 'region' })

export const PHONE_COUNTRIES: PhoneCountry[] = getCountries()
  .map(code => ({
    code,
    name: countryNames.of(code) ?? code,
    dial: `+${getCountryCallingCode(code)}`,
    flag: countryFlag(code),
  }))
  .sort((first, second) => {
    if (first.code === 'TN') return -1
    if (second.code === 'TN') return 1
    return first.name.localeCompare(second.name, 'fr')
  })

export function formatInternationalPhone(countryCode: string, localNumber: string) {
  const country = PHONE_COUNTRIES.find(item => item.code === countryCode) ?? PHONE_COUNTRIES.find(item => item.code === 'TN')!
  return `${country.dial}${localNumber.replace(/\D/g, '').replace(/^0+/, '')}`
}
