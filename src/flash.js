'use strict';

const which = require('which');
const chalk = require('chalk');
const { spawn, exec } = require('child_process');

exports.flash = flash;

/* options format
 *
 * {
 *     type: 'firmware',
 *     binary: {
 *         'bootloader': bootloaderBinary,
 *         'partition': partitionBinary,
 *         'app': appBinary
 *     },
 *     address: {
 *         'bootloader': parseInt('0x1000', 16),
 *         'partition': parseInt('0x8000', 16),
 *         'app': parseInt('0x10000', 16)
 *     },
 *     erase: ture | false
 * }
 *
 * {
 *     type: 'application',
 *     binary: appBinary,
 *     address:  parseInt('0x10000', 16)
 *     erase: ture | false
 * }
 *
 */

let flashTool = 'esptool.py';

let arglst = [];
arglst.push('--chip', 'esp32');
arglst.push('--port', '__PORT__');
arglst.push('--baud', '200000');
arglst.push('write_flash');
arglst.push('--flash_mode', 'dio');
arglst.push('--flash_freq', '40m');
arglst.push('--flash_size', '4MB');

function flash (options) {
    // construct flash command
    let cmd = (() => {
        let platform = process.platform;
        switch (platform) {
            case 'darwin':
                arglst = arglst.replaceItem('__PORT__', '/dev/cu.SLAB_USBtoUART');
                if (options.type === 'firmware') {
                    // bootloader
                    arglst.push(`0x${options.address.bootloader.toString(16)}`);
                    arglst.push(`${options.binary.bootloader}`);
                    // partition
                    arglst.push(`0x${options.address.partition.toString(16)}`);
                    arglst.push(`${options.binary.partition}`);
                    // app
                    arglst.push(`0x${options.address.app.toString(16)}`);
                    arglst.push(`${options.binary.app}`);
                } else if (options.type === 'application') {
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
