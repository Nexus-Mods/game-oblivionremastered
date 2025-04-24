# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## 0.1.2 - 2025-04-24

- Remove plugins button has been changed to reset the plugins file.
- "AltarGymNavigation.esp" and "TamrielLeveledRegion.esp" are no longer added to the plugins file as native.
- Extension requirements are now less restrictive (only installed if needed)
- Allow custom UE4SS installations
- Now uses the mods.json file when installing LUA mods
- Added Binaries modtype for engine injectors.
- Fixed gamebryo stop patterns hijacking binary mods.
- Fixed gamebryo plugins showing as not managed by Vortex (when actually they are, but are using a different mod type)
- Can now order native plugins if needed.
- No longer forcefully re-enabling/re-downloading extension requirements when they're intentionally disabled

## 0.1.1 - 2025-04-23

- Fixed version identification for Xbox Game Pass (Steam will unfortunately display the UE version)

## 0.1.0 - 2025-04-23

- Initial release