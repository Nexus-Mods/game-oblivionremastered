# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/) and this project adheres to [Semantic Versioning](http://semver.org/).

## 0.1.7 - 2025-05-28

- Adding INI merging capability (only altar.ini for now)

## 0.1.6 - 2025-05-22

- Fixed inability to switch profiles on some systems

## 0.1.5 - 2025-05-22

- Added loot support
- Added warning for rules-based system if/when 'altargymnavigation' or 'tamrielleveledregion.esp' are enabled
- Added consent dialog when attempting to download/install requirements.
- Fixed validation errors being raised when removing/re-installing mods.
- Oblivion specific notifications will now get dismissed on game change.
- Fixed some dialog/notification text and formatting.

## 0.1.4 - 2025-05-12

- Added OBSE64 as a requirement for all game variants besides xbox.
- OBSE64 will default to primary tool when found.
- UE4SS requirement is now set to https://www.nexusmods.com/oblivionremastered/mods/32
- Native plugins order test will now check for plugin state too.
- Removed unnecessary UE4SS tests.
- Steam variant will now use the product version of the game executable when resolving the game version.
- Fixed root mod installer hijacking fomod installations.
- Fixed inconsistent plugin state in load order page when purging/deploying.

## 0.1.3 - 2025-04-25

- Improved load order serialization/deserialization process.
- 'altargymnavigation.esp', 'tamrielleveledregion.esp', plugins are now locked and disabled at the bottom of the list.
- Added test to inform user if the order of the native plugins is incorrect.
- Added automatic fix capability for when the native plugin order is jumbled. (will maintain the order of other entries)
- Now sanitizing the plugins.txt file when parsing (sanity check in case the file has been edited externally)

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
- Steam distribution will now launch through the game store rather than the executable (bypasses the custom parameter when launching the game)

## 0.1.1 - 2025-04-23

- Fixed version identification for Xbox Game Pass (Steam will unfortunately display the UE version)

## 0.1.0 - 2025-04-23

- Initial release
