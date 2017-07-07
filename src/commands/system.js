'use strict';

const parametersJS = require('./parameters.js');
const { Promise } = require('thenfail');
const { flash } = require('../lib/flash');

exports.system = function (rap, program, trace) {
    program
        .command('upgrade <firmware-binary-file>')
        .description('upgrade ruff firmware')
        .option('--parameters [port=<port>]', 'designate port')
        .option('--session-parameters []', 'use rap session mechanism')
        .action((binPath, program) => {
            trace.push('upgrade');

            var parameters = parametersJS.getParameters(rap, program);
            program.port = parameters.port;

            const fs = require('fs');
            const os = require('os');
            const path = require('path');

            const admZip = require('adm-zip');

            var bootloaderName = 'bootloader.bin';
            var partitionName = 'partition.bin';
            var appName = 'app.bin';

            if (!fs.existsSync(binPath)) {
                console.error('The binary file specified does not exist.');
                process.exit(1);
            }

            var unzip = new admZip(binPath);
            var tmpdir = os.tmpdir();

            var bootloaderBinary = path.join(tmpdir, bootloaderName);
            var partitionBinary= path.join(tmpdir, partitionName);
            var appBinary = path.join(tmpdir, appName);

            // Remove the existing files
            if (fs.existsSync(bootloaderBinary)) {
                fs.unlinkSync(bootloaderBinary);
            }
            if (fs.existsSync(partitionBinary)) {
                fs.unlinkSync(partitionBinary);
            }
            if (fs.existsSync(appBinary)) {
                fs.unlinkSync(appBinary);
            }

            unzip.extractAllTo(tmpdir);

            let cp = flash({
                type: 'flash-firmware',
                port: program.port,
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
        .option('--parameters [port=<port>]', 'designate port')
        .option('--session-parameters []', 'use rap session mechanism')
        .description('erase flash')
        .action((program) => {
            trace.push('erase');

            var parameters = parametersJS.getParameters(program);
            program.port = parameters.port;

            var cp;

            if (program.firmware) {
                cp = flash({
                    type: 'erase-region',
                    port: program.port,
                    address: 0x0,
                    size: 0x300000
                });
            } else if (program.application) {
                cp = flash({
                    type: 'erase-region',
                    port: program.port,
                    address: 0x300000,
                    size: 0x100000
                });
            } else {
                cp = flash({
                    type: 'erase-flash',
                    port: program.port
                });
            }

            return Promise.for(cp);
        });
};
