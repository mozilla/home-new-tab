export const TemperatureView = {
  Simple: "simple",
  Detailed: "detailed",
  Extreme: "extreme",
}
export type TemperatureView = (typeof TemperatureView)[keyof typeof TemperatureView] //prettier-ignore

export const TemperatureUnit = {
  Celsius: "Celsius",
  Fahrenheit: "Fahrenheit",
  Kelvin: "Kelvin",
}
export type TemperatureUnit = (typeof TemperatureUnit)[keyof typeof TemperatureUnit] //prettier-ignore

export type Temperature = {
  c: number
  f: number
}

export type Conditions = {
  url: string
  summary: string
  iconId: number
  temperature: Temperature
}

export type Forecast = {
  url: string
  summary: string
  high: Temperature
  low: Temperature
}

export type WeatherData = {
  title: string
  url: string
  provider: string
  isSponsored: boolean
  score: number
  cityName: string
  regionCode: string
  currentConditions: Conditions
  forecast: Forecast
  requestId: string
  source: string
}
