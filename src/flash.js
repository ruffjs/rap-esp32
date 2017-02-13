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

function flash(options) {
    // Construct flash
    let cmd = (() => {
        let platform = process.platform;
        switch (platform) {
            case 'darwin':
            case 'linux':
            case 'freebsd': {
                let arglst = [];
                if (!options.erase) {
                    arglst.push('-S', `0x${options.address.toString(16)}`);
                }
                arglst = arglst.concat([
                    options.binary
                ]);
                return buildCommand({
                    cmd: 'lm4flash',
                    args: arglst
                });
            }

            case 'win32': {
                let arglst = [];
                if (options.erase) {
                    arglst.push('-e', 'all');
                }
                arglst = arglst.concat([
                    '-r',
                    '-i', 'ICDI',
                    '-o', `0x${options.address.toString(16)}`,
                    options.binary
                ]);
                return buildCommand({
                    cmd: 'LMFlash.exe',
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
