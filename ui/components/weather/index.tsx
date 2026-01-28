"use client"

import style from "./style.module.css"

import { TemperatureUnit, TemperatureView } from "@common/types"
import { useState } from "react"
import { MenuOverflow, MenuOverflowPosition } from "../menu-overflow"
import { WeatherIcon } from "../weather-icon"
import { weatherState } from "@data/state/weather" // Just a placeholder

import type { Forecast, Temperature } from "@common/types"

/**
 * Weather
 * ---
 * A weather widget to display ... wait for it ... the weather
 */
export function Weather({ weatherId }: { weatherId: string }) {
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>(
    TemperatureUnit.Fahrenheit,
  )
  const [viewMode, setViewMode] = useState<TemperatureView>(
    TemperatureView.Detailed,
  )

  // Pull in data from state (wherever that comes from)
  const {
    forecast,
    currentConditions: conditions,
    isSponsored,
    cityName,
  } = weatherState[weatherId]

  // Process into strings
  const currentTemperature = getTemperature(
    temperatureUnit,
    conditions.temperature,
  )
  const forecastString = getForecast(temperatureUnit, forecast)

  function setView(view: TemperatureView) {
    setViewMode(view)
  }

  function setUnit(unit: TemperatureUnit) {
    setTemperatureUnit(unit)
  }

  return (
    <div className={style.base} data-testid="weather">
      <div className={style.card}>
        <a
          data-l10n-id="newtab-weather-see-forecast"
          data-l10n-args='{"provider": "AccuWeather®"}'
          href={conditions.url}
          className={style.inner}
          title="">
          <WeatherIcon iconId={`iconId${conditions.iconId}`} />
          <div className={style.details}>
            <div className={style.currentTemperature}>{currentTemperature}</div>
            <div className={style.location}>{cityName}</div>
            {viewMode === TemperatureView.Detailed ? (
              <div className={style.forecast}>
                <span className={style.forecastTemp}>{forecastString}</span>
                <span className={style.forecastSummary}>
                  {forecast.summary}
                </span>
              </div>
            ) : null}
          </div>
        </a>
        <ActionMenu
          setUnit={setUnit}
          setViewMode={setView}
          temperatureUnit={temperatureUnit}
          viewMode={viewMode}
        />
      </div>
      {isSponsored ? <div className={style.sponsor}></div> : null}
    </div>
  )
}

/**
 * ActionMenu
 * ---
 * Switch between settings for the weather widget
 */
function ActionMenu({
  setUnit,
  setViewMode,
  temperatureUnit,
  viewMode,
}: {
  setUnit: (view: TemperatureUnit) => void
  setViewMode: (view: TemperatureView) => void
  temperatureUnit: TemperatureUnit
  viewMode: TemperatureView
}) {
  // Local State
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false)

  const altTemperatureUnit =
    temperatureUnit === TemperatureUnit.Fahrenheit
      ? TemperatureUnit.Celsius
      : TemperatureUnit.Fahrenheit

  const altViewMode =
    viewMode === TemperatureView.Detailed
      ? TemperatureView.Simple
      : TemperatureView.Detailed

  const switchFunction = () => {
    setUnit(altTemperatureUnit)
  }
  const switchToKelvin = () => {
    setUnit(TemperatureUnit.Kelvin)
  }
  const viewFunction = () => {
    setViewMode(altViewMode)
  }
  const showMenu = () => setIsMenuOpen(true)

  return (
    <div className={style.actions}>
      <button className={style.more} onClick={showMenu}>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 16 16"
          width="16"
          height="16"
          fill="context-fill"
          fillOpacity="context-fill-opacity">
          <path d="M3 7 1.5 7l-.5.5L1 9l.5.5 1.5 0 .5-.5 0-1.5z" />
          <path d="m8.75 7-1.5 0-.5.5 0 1.5.5.5 1.5 0 .5-.5 0-1.5z" />
          <path d="M14.5 7 13 7l-.5.5 0 1.5.5.5 1.5 0L15 9l0-1.5z" />
        </svg>
      </button>

      <MenuOverflow
        position={MenuOverflowPosition.TOP_RIGHT}
        withTrigger={false}
        isOpen={isMenuOpen}
        onOpenChange={setIsMenuOpen}>
        {({ withClose }) => (
          <>
            <button onClick={withClose(switchToKelvin)}>
              Switch to Kelvin
            </button>
            <button onClick={withClose(switchFunction)}>
              Switch to {altTemperatureUnit}
            </button>
            <button onClick={withClose(viewFunction)}>
              Switch to {altViewMode} view
            </button>
            <button>Hide weather on New Tab</button>
            <button>Learn more</button>
          </>
        )}
      </MenuOverflow>
    </div>
  )
}

function getForecast(temperatureUnit: TemperatureUnit, forecast: Forecast) {
  const high = getTemperature(temperatureUnit, forecast.high)
  const low = getTemperature(temperatureUnit, forecast.low)
  return `${high} • ${low}`
}

function getTemperature(
  temperatureUnit: TemperatureUnit,
  temperature: Temperature,
) {
  switch (temperatureUnit) {
    case TemperatureUnit.Celsius: {
      return `${temperature.c}°C`
    }
    case TemperatureUnit.Fahrenheit: {
      return `${temperature.f}°F`
    }
    case TemperatureUnit.Kelvin: {
      return `${temperature.c + 273.15}K`
    }
  }
}
