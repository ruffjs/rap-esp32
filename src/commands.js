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
        .option('-E, --erase', 'erase entire flash')
        .description('upgrade ruff firmware')
        .action((binPath, options) => {
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
                type: 'firmware',
                binary: {
                    'bootloader': bootloaderBinary,
                    'partition': partitionBinary,
                    'app': appBinary
                },
                address: {
                    'bootloader': 0x1000,
                    'partition': 0x8000,
                    'app': 0x10000
                },
                erase: options.erase
            });

            return Promise.for(cp);
        });
};

function setupCommands(program, commandName, trace) {
    commandMap[commandName](program, trace);
}

exports.setupCommands = setupCommands;
