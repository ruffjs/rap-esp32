'use strict';

const which = require('which');
const chalk = require('chalk');
const { spawn } = require('child_process');

exports.flash = flash;

/* option format
 *
 * {
 *     binary : 'abc.bin',
 *     address : 0x500,
 *     erase : true
 * }
 */

let arglst = [];
arglst.push('--chip', 'esp32');
arglst.push('--port', '/dev/cu.SLAB_USBtoUART');
arglst.push('--baud', '1000000');
arglst.push('write_flash');
arglst.push('--flash_mode', 'dio');
arglst.push('--flash_freq', '40m');
arglst.push('--flash_size', '4MB');

function flash(options) {
    // Construct flash
    let cmd = (() => {
        let platform = process.platform;
        switch (platform) {
            case 'darwin':
            case 'linux':
            case 'freebsd': {
                if (!options.erase) {
                    arglst.push(`0x${options.address.toString(16)}`);
                }
                arglst = arglst.concat([
                    options.binary
                ]);
                return buildCommand({
                    cmd: 'esptool.py',
                    args: arglst
                });
            }

            default: {
                console.log(`Unknown platform ${platform}!`);
                process.exit(1);
            }
        }
    })();

    // Flash it
    return cmd();
}

function buildCommand(options) {
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

function findCommand(cmd) {
    try {
        return which.sync(cmd);
    } catch (e) {
        return '';
    }
}
