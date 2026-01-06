# Asset Sync

This is a small utility to pull in assets directly from Firefox core repo. We don't want to drift from core production assets, but we also don't want to assume availability in our code. If assets were housed in a consumable package (fingers crossed for the future), this utility would become moot.

## Usage

1. Include this package in your dev-dependencies `"@config/asset-config": "workspace:*"`
2. Create an `asset.manifest.json` next to the `package.json`
3. Add a script in `package.json` — `"sync-assets": "asset-sync"`
4. Run your new script command `pnpm sync-assets`

## Asset Manifest

- repo - git address you want to pull from
- subdir - location inside the repo to pull
- ref - reference to the git hash you should pull the assets (pseudo versioning)
- outDir - where you want the assets to be placed

Example: This pulls assets from public repos. In this example we pull the weather icons out of `mozilla-firefox/firefox` so we can surface them in dev UI.

```
{
  "assets": [
    {
      "repo": "https://github.com/mozilla-firefox/firefox.git",
      "subdir": "browser/themes/shared/weather",
      "ref": "989057eec3a07ce68a15c2bf2eb1e137dd19d5f3",
      "outDir": "weather-icon/icons"
    }
  ]
}
```

## Note

This is not necessarily cheap in terms of speed/time depending on the size of the repo containing your assets. It is recommended you commit the pulled assets to the repo that pulled them (something not typically recommended) and simply update them manually.
