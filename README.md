# Vortex Extension for Oblivion Remastered

This is an extension for [Vortex](https://www.nexusmods.com/about/vortex/) to add support for Oblivion Remaster. The [Steam](https://store.steampowered.com/app/2623190/The_Elder_Scrolls_IV_Oblivion_Remastered/) and [Xbox](https://www.xbox.com/en-gb/games/store/the-elder-scrolls-iv-oblivion-remastered/9nqr437k7pqh) versions of Oblivion Remastered are both supported. There is currently no implementation difference between the two, but that is bound to change once a script extender is released.

# Development

Clone repo and run `yarn install`

### Main Scripts

- `yarn build` will copy assets to the `/dist` folder, create the `/dist/info.json` from info within `/package.json` and pack the contents of `/dist` into `/out/oblivion-remastered-x.x.x.zip`
- `yarn copyplugin` will copy contents of `/dist` to the plugins folder of the production build of Vortex. Normally located at `%APPDATA/Roaming/Vortex/plugins`
- `yarn copyplugindev` will copy contents of `/dist` to the plugins folder of the development build of Vortex. Normally located at `%APPDATA/Roaming/vortex_devel/plugins`
- `yarn buildcopydev` will build and contents of `/dist` to the plugins folder of the development build of Vortex. Normally located at `%APPDATA/Roaming/vortex_devel/plugins`

# Features

- Automatic game detection for Steam and Xbox
- Downloads and installs UE4SS if it doesn't exist
- Support for classic .esp mods - drag and drop load order management is currently being used.
- Support for PAK mods
- Support for Lua\UE4SS mods
- Support for Blueprint\Logic mods

# Installation

This extension requires Vortex **1.13.7** or greater.

To install, click the Vortex button at the top of the [Oblivion Remastered Extension page on Nexus Mods](https://www.nexusmods.com/site/mods/1270), and then click Install.

You can also manually install it by click the Manual button at the top of the page and dragging it into the drop target labelled Drop File(s) in the Extensions page at the bottom right.

Afterwards, restart Vortex and you can begin installing supported Oblivion Remastered mods with Vortex.

If you've already got a previous version, the extension should auto update on a Vortex restart.

# Game detection

The Oblivion Remastered game extension enables Vortex to automatically locate installs from the Steam and Xbox apps.

It is also possible to manually set the game folder if the auto detection doesn't find the correct installation. A valid Oblivion Remastered game folder contains:

- `./OblivionRemastered/Content/Dev/ObvData/Data/Oblivion.esm`

If your game lacks this file then it is likely that your installation has become corrupted somehow.

# Setup & Dependencies

There are 2 tools which are automatically downloaded and installed to help with modding this game.

- [UE4SS](https://github.com/UE4SS-RE/RE-UE4SS) - a generic mod loading and scripting system for Unreal Engine games

# Mod Management

By default, Vortex will deploy files to the game's root folder and extracts the archive while preserving it's folder structure.

## Gamebryo plugin mods

If a .esp or .esm file is detected, it will be deployed to the game's datapath `./Content/Dev/ObvData/Data/`

## PAK mods

If a PAK mod is detected, it's deployment folder is `./OblivionRemastered/Content/Paks/~mods`.

## Lua\UE4SS mods

If a LUA mod is detected, it's deployment folder is `./OblivionRemastered/Binaries/Win64/ue4ss/Mods`.

Lua mods are added to the `./OblivionRemastered/Binaries/Win64/ue4ss/Mods/mods.txt` as the primary method for UE4SS detecting that the mod is installed and enabled.

## Blueprint\Logic mods

Automatic Blueprint/Logic mod detection relies on the mod archive to include the `LogicMods` folder within its structure. Alternatively if the archive structure does not include it, the user can select the `Blueprint Mod` mod type by double clicking on the respective mod inside the mods page, and changing the mod type via the dropdown button in the mod panel.

## Unsupported mods

Vortex doesn't officially support managing of mods that are reshades, save game\config edits or require external tools (apart from UE4SS). 

# See also

- [Download the Extension (Nexus Mods)](https://www.nexusmods.com/site/mods/1270)
- [Mods for Oblivion Remastered (Nexus Mods)](https://www.nexusmods.com/oblivionremastered)
- [Vortex Forum (Nexus Mods)](https://forums.nexusmods.com/index.php?/forum/4306-vortex-support/)
- [Download Vortex (Nexus Mods)](https://www.nexusmods.com/about/vortex/)

# Thanks

- The [UE4SS](https://github.com/UE4SS-RE/RE-UE4SS) team for doing an amazing job.

# Changelog

Please check out [CHANGELOG.md](/CHANGELOG.md)
