'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const admZip = require('adm-zip');

const { spawn } = require('child_process');
const { Promise } = require('thenfail');
const { flash } = require('./flash');

var bootloaderName = 'bootloader.bin';
var partitionName = 'partition.bin';
var appName = 'app.bin';

let commandMap = Object.create({});

commandMap.system = function (program, trace) {
    program
        .command('upgrade <firmware-binary-file>')
        .description('upgrade ruff firmware')
        .action((binPath) => {
            trace.push('upgrade');

            if (!fs.existsSync(binPath)) {
                console.error('The binary file specified does not exist.');
                process.exit(1);
            }

            var tmpdir = os.tmpdir();
            var unzip = new admZip(binPath);
            unzip.extractAllTo(tmpdir);

            var bootloaderBinary = path.join(tmpdir, bootloaderName);
            var partitionBinary= path.join(tmpdir, partitionName);
            var appBinary = path.join(tmpdir, appName);

            let cp = flash({
                type: 'flash-firmware',
                binary: {
                    'bootloader': bootloaderBinary,
                    'partition': partitionBinary,
                    'app': appBinary
                },
                address: {
                    'bootloader': 0x1000,
                    'partition': 0x8000,
                    'app': 0x10000
                }
            });

            return Promise.for(cp);
        });
    program
        .command('erase')
        .option('-A, --all', 'erase all the flash [default]')
        .option('-F, --firmware', 'erase only the firmware flash region')
        .option('-P, --application', 'erase only the application flash region')
        .description('erase flash')
        .action((options) => {
            trace.push('erase');

            var cp;

            if (options.firmware) {
                cp = flash({
                    type: 'erase-region',
                    address: 0x0,
                    size: 0x300000
                });
            } else if (options.application) {
                cp = flash({
                    type: 'erase-region',
                    address: 0x300000,
                    size: 0x100000
                });
            } else {
                cp = flash({
                    type: 'erase-flash'
                });
            }

            return Promise.for(cp);
        });
};

function setupCommands(program, commandName, trace) {
    commandMap[commandName](program, trace);
}

exports.setupCommands = setupCommands;
