'use strict';

const which = require('which');
const chalk = require('chalk');
const { spawn, exec } = require('child_process');

exports.flash = flash;

/* options format
 *
 * {
 *     type: 'erase-flash'
 * }
 *
 * {
 *     type: 'erase-region',
 *     address: 0x300000,
 *     size: 0x100000,
 * }
 *
 * {
 *     type: 'flash-firmware',
 *     binary: {
 *         'bootloader': bootloaderBinary,
 *         'partition': partitionBinary,
 *         'app': appBinary
 *     },
 *     address: {
 *         'bootloader': parseInt('0x1000', 16),
 *         'partition': parseInt('0x8000', 16),
 *         'app': parseInt('0x10000', 16)
 *     }
 * }
 *
 * {
 *     type: 'flash-application',
 *     binary: appBinary,
 *     address:  parseInt('0x10000', 16)
 * }
 *
 */

let flashTool = 'esptool.py';

let arglst = [];
arglst.push('--chip', 'esp32');
arglst.push('--port', '__PORT__');
arglst.push('--baud', '200000');
arglst.push('__COMMAND__');

function flash (options) {
    // construct flash command
    let cmd = (() => {
        let platform = process.platform;
        switch (platform) {
            case 'darwin':
                arglst = arglst.replaceItem('__PORT__', '/dev/cu.SLAB_USBtoUART');
            // TODO: support to configure port outside
            case 'linux':
                arglst = arglst.replaceItem('__PORT__', '/dev/ttyUSB0');
            case 'win32':
                arglst = arglst.replaceItem('__PORT__', 'COM1');

                if (options.type === 'erase-flash') {
                    arglst = arglst.replaceItem('__COMMAND__', 'erase_flash');
                } else if (options.type === 'erase-region') {
                    // XXX: this subcommand is unstable
                    arglst = arglst.replaceItem('__COMMAND__', 'erase_region');
                    arglst.push(`0x${options.address.toString(16)}`);
                    arglst.push(`0x${options.size.toString(16)}`);
                } else if (options.type === 'flash-firmware') {
                    arglst = arglst.replaceItem('__COMMAND__', 'write_flash');
                    arglst.push('--flash_mode', 'dio');
                    arglst.push('--flash_freq', '40m');
                    arglst.push('--flash_size', '4MB');
                    // bootloader
                    arglst.push(`0x${options.address.bootloader.toString(16)}`);
                    arglst.push(`${options.binary.bootloader}`);
                    // partition
                    arglst.push(`0x${options.address.partition.toString(16)}`);
                    arglst.push(`${options.binary.partition}`);
                    // app
                    arglst.push(`0x${options.address.app.toString(16)}`);
                    arglst.push(`${options.binary.app}`);
                } else if (options.type === 'flash-application') {
                    arglst = arglst.replaceItem('__COMMAND__', 'write_flash');
                    arglst.push('--flash_mode', 'dio');
                    arglst.push('--flash_freq', '40m');
                    arglst.push('--flash_size', '4MB');
                    arglst.push(`0x${options.address.toString(16)}`);
                    arglst.push(`${options.binary}`);
                } else {
                    console.error('Invalid option type `' + options.type + '`');
                    process.exit(1);
                }

                return buildCommand({
                    cmd: flashTool,
                    args: arglst
                });

            default: {
                console.log(`Unknown platform ${platform}!`);
                process.exit(1);
            }
        }
    })();

    // flash it
    return cmd();
}

function buildCommand (options) {
    // check command
    let cmd = findCommand(options.cmd);
    if (!cmd) {
        console.log(chalk.red(`Could not find "${options.cmd}" in $PATH, please install it first.`));
        process.exit(1);
    }
    options.cmd = cmd;

    // build command
    return () => {
        return spawn(
            options.cmd,
            options.args,
            {
                stdio: 'inherit'
            }
        );
    };
}

function findCommand (cmd) {
    try {
        return which.sync(cmd);
    } catch (e) {
        return '';
    }
}

Array.prototype.replaceItem = function (src, dst) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === src) {
            this[i] = dst;
        }
    }
    return this;
};
