# Rap extension for esp32

This project is rap extension, or rap plug-in for ESP32.

It is dependent on Rap extension (plug-in) mechanism, to customize board-specific rap subcommands. This rap extension customize two sub commands `rap deploy` and `rap system`.

The project can be referenced by package.json of Ruff board project. For example, below is [esp32-air-v40](https://github.com/ruff-drivers/esp32-air-v40) board package.json.

```jerryscript
{
    "name": "esp32-air-v40",
    "version": "0.1.2",
    "description": "Ruff ESP32 AIR v4.0 board",
    "author": "Nanchao Inc.",
    "dependencies": {
        "rap-esp32": "*"
    },
    "ruff": {
        "dependencies": {
            "led-gpio": "^2.0.0"
        }
    }
}
```

After you initilize a new Ruff Application for board `esp32-air-v40`, this module `rap-esp32` will be automatically downloaded under the directory of `ruff_modules/esp32-air-v40/node_modules/rap-esp32`. You can execute these customized rap subcommands in the new application root directory.
