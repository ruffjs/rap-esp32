/* eslint-disable camelcase */

'use strict';

const execSync = require('child_process').execSync;
const fs = require('fs');
const util = require('util');

//const LD_FMT = 'arm-none-eabi-ld -Ttext=0x%s --entry=0x%s --just-symbols=Symbol.map %s -o %s';
//const NM_FMT = 'arm-none-eabi-nm %s | grep \' T \' | awk \'{ print $1" "$3}\'';
//const CP_FMT = 'arm-none-eabi-objcopy -j .text -j .rodata -O binary %s %s';

exports.mkapp = mkapp;

function mkapp(origin, modsManifest, rofsManifest) {
    // fix name for windows platform
    rofsManifest.forEach(item => {
        item.name = item.name.replace(/\\/g, '/');
    });

    if (origin !== align4(origin)) {
        throw new Error('app origin must be 4k aligned!');
    }

    let buffer = makeHeader();

//    buffer = appendMods(origin, buffer, null);
    buffer = appendRofs(origin, buffer, rofsManifest);

    return buffer;
}

/////////////
// HELPERS //
/////////////

function makeHeader() {
    let header = Buffer.alloc(4 + 4 + 4);
    header.write('RUFF'); // magic
    return header;
}

function updateUserAppIndex(buf, userapp) {
    let offset = 4;

    if (typeof userapp.mods !== 'undefined' && userapp.mods >= 0) {
        buf.writeUInt32LE(userapp.mods, offset);
    }
    offset += 4;

    if (typeof userapp.rofs !== 'undefined' && userapp.rofs >= 0) {
        buf.writeUInt32LE(userapp.rofs, offset);
    }
    offset += 4;
}

/*
function linkObjects(textAddr, modsManifest) {
    let modBins = [];

    for (let i = 0; i < modsManifest.length; ++i) {
        const modItem = modsManifest[i];
        // console.log('module:', modItem);

        const modName = modItem.name;
        const libName = getLibFileName(modName);
        const binName = getBinFileName(modName);

        // link objects
        {
            const addr = textAddr.toString(16);
            const objs = modItem.objects.join(' ');
            const cmd = util.format(LD_FMT, addr, addr, objs, libName);
            // console.log(cmd);
            execSync(cmd);
        }

        // objcopy
        {
            const cmd = util.format(CP_FMT, libName, binName);
            // console.log(cmd);
            execSync(cmd);
        }

        // record lib/bin info
        {
            const cmd = util.format(NM_FMT, libName);
            const cmdOutput = execSync(cmd);
            const cmdOutputLines = cmdOutput.toString().split(/\r?\n/);

            const symbols = cmdOutputLines.map(line => {
                let [address, name] = line.split(' ');

                if (!address || !name) {
                    return undefined;
                }

                address = parseInt(address, 16);

                return {
                    name,
                    address
                };
            })
            .filter(symbol => !!symbol)
            .sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);

            modBins.push({
                name: modName,
                file: binName,
                symbols
            });
        }

        // update text address
        {
            const stat = fs.statSync(binName);
            textAddr += align4(stat.size);
        }

        printLine();
    }

    return modBins;
}
*/

/*
function appendMods(origin, buffer, modsManifest) {
    if (!(modsManifest instanceof Array) || modsManifest.length === 0) {
        updateUserAppIndex(buffer, { mods: 0 });
        return buffer;
    }

    const relOrigin = buffer.length;

    // compiled object files => linked binary files
    const mods = linkObjects(origin + relOrigin, modsManifest);
    // console.log(util.inspect(mods, false));
    printLine();

    // calcuate offset and total size
    const sizeof = {
        // basic
        char: 1,
        // mods
        mods_t: 4,
        mods_module_t: 4 + 4 + 4,
        mods_symbol_t: 4 + 4
    };

    const relOffsets = {};

    let relOffset = relOrigin;
    mods.forEach(mod => {
        relOffsets[mod.name] = relOffset;
        relOffset += align4(getFileSize(mod.file));
    });
    // mods_t
    relOffsets.mods_t = relOffset;
    relOffset += sizeof.mods_t;
    // mods_module_t
    relOffsets.mods_module_t = relOffset;
    relOffset += sizeof.mods_module_t * mods.length;
    // mods_symbol_t
    relOffsets.mods_symbol_t = relOffset;
    relOffset += sizeof.mods_symbol_t * mods.reduce((acc, elem) => {
        return acc + elem.symbols.length;
    }, 0);
    // chars
    relOffsets.char = relOffset;
    relOffset += sizeof.char * mods.reduce((size, mod) => {
        return size + (mod.name.length + 1) + mod.symbols.reduce((size, symbol) => {
            return size + (symbol.name.length + 1);
        }, 0);
    }, 0);
    // eof
    relOffsets.__eof__ = relOffset;

    // console.log(relOffsets);
    printLine();

    // write to buffer
    buffer = Buffer.concat([buffer, Buffer.alloc(relOffsets.__eof__ - relOrigin, 0)]);
    // mod_t, mods_t.count
    buffer.writeUInt32LE(mods.length, relOffsets.mods_t);
    for (let mod of mods) {
        // binary
        const data = getFileData(mod.file);
        const begin = relOffsets[mod.name];
        const end = begin + data.length;
        buffer.fill(data, begin, end);

        // mods_module_t
        // mods_module_t.name
        buffer.write(mod.name, relOffsets.char, mod.name.length);
        buffer.writeUInt32LE(origin + relOffsets.char, relOffsets.mods_module_t);
        relOffsets.char += mod.name.length + 1;
        relOffsets.mods_module_t += 4;
        // mods_module_t.symbols
        buffer.writeUInt32LE(origin + relOffsets.mods_symbol_t, relOffsets.mods_module_t);
        relOffsets.mods_module_t += 4;
        // mods_module_t.symbol_count
        buffer.writeUInt32LE(mod.symbols.length, relOffsets.mods_module_t);
        relOffsets.mods_module_t += 4;

        // mods_symbol_t
        for (let symbol of mod.symbols) {
            // mods_symbol_t.name
            buffer.write(symbol.name, relOffsets.char, symbol.name.length);
            buffer.writeUInt32LE(origin + relOffsets.char, relOffsets.mods_symbol_t);
            relOffsets.char += symbol.name.length + 1;
            relOffsets.mods_symbol_t += 4;
            // mods_symbol_t.address
            buffer.writeUInt32LE(symbol.address | 1, relOffsets.mods_symbol_t);
            relOffsets.mods_symbol_t += 4;
        }
    }

    // console.log(relOffsets);
    printLine();

    // update userapp_t
    updateUserAppIndex(buffer, { mods: origin + relOffsets.mods_t });

    return buffer;
}
*/

function appendRofs(origin, buffer, rofsManifest) {
    if (!(rofsManifest instanceof Array) || rofsManifest.length === 0) {
        updateUserAppIndex(buffer, { rofs: 0 });
        return buffer;
    }

    // calcuate hash in advance
    const bucketCount = 64;
    const buckets = new Map();
    rofsManifest.forEach(item => {
        const bucketIndex = hashBKDR(item.name) % bucketCount;
        const bucketItems = buckets.get(bucketIndex);
        if (bucketItems) {
            bucketItems.push(item);
        } else {
            buckets.set(bucketIndex, [item]);
        }
    });

    printLine();

    // calcuate offset and total size
    const relOrigin = buffer.length;

    const sizeof = {
        // basic
        char: 1,
        // rofs
        rofs_t: 2 + 2,
        rofs_bucket_t: 4 + 4,
        rofs_entry_t: 4 + 4 + 4
    };

    const relOffsetMap = {};

    let relOffset = relOrigin;
    // rofs_t
    relOffsetMap.rofs_t = relOffset;
    relOffset += sizeof.rofs_t;
    // rofs_bucket_t
    relOffsetMap.rofs_bucket_t = relOffset;
    relOffset += sizeof.rofs_bucket_t * bucketCount;
    // rufs_entry_t
    relOffsetMap.rofs_entry_t = relOffset;
    relOffset += sizeof.rofs_entry_t * rofsManifest.length;
    // chars
    relOffsetMap.char = relOffset;
    buckets.forEach((items, index) => {
        items.forEach(item => {
            relOffset = align8(relOffset + item.name.length + 1) + (getFileSize(item) + 1);
        });
    });
    // eof
    relOffsetMap.__eof__ = relOffset;

    // console.log(relOffsetMap);
    printLine();

    // write to buffer
    buffer = Buffer.concat([buffer, Buffer.alloc(relOffsetMap.__eof__ - relOrigin, 0)]);
    // rofs_t.hash_func
    buffer.writeUInt16LE(1 /* value here does not matter */, relOffsetMap.rofs_t);
    // rofs_t.bucket_count
    buffer.writeUInt16LE(bucketCount, relOffsetMap.rofs_t + 2);
    // rofs_bucket_t
    buckets.forEach((items, index) => {
        let bucketAddr = relOffsetMap.rofs_bucket_t + sizeof.rofs_bucket_t * index;
        // rofs_bucket_t.entry_count
        buffer.writeUInt32LE(items.length, bucketAddr);
        bucketAddr += 4;
        // rofs_bucket_t.entries
        buffer.writeUInt32LE(origin + relOffsetMap.rofs_entry_t, bucketAddr);
        bucketAddr += 4;
        // rofs_entry_t
        items.forEach(item => {
            // rofs_entry_t.key
            buffer.write(item.name, relOffsetMap.char, item.name.length);
            buffer.writeUInt32LE(origin + relOffsetMap.char, relOffsetMap.rofs_entry_t);
            relOffsetMap.char += item.name.length + 1;
            relOffsetMap.rofs_entry_t += 4;
            // rofs_entry_t.data
            const dat = getFileData(item);
            let beginDat = align8(relOffsetMap.char);
            const endDat = beginDat + dat.length;
            buffer.fill(dat, beginDat, endDat);
            buffer.writeUInt32LE(origin + beginDat, relOffsetMap.rofs_entry_t);
            relOffsetMap.char = endDat + 1;
            relOffsetMap.rofs_entry_t += 4;
            // rofs_entry_t.size
            buffer.writeUInt32LE(dat.length, relOffsetMap.rofs_entry_t);
            relOffsetMap.rofs_entry_t += 4;
        });
    });

    // update userapp_t
    updateUserAppIndex(buffer, { rofs: origin + relOffsetMap.rofs_t });

    return buffer;
}

///////////////
// UTILITIES //
///////////////

function printLine() {
    // console.log(Array(80 + 1).join('-'));
}

function getLibFileName(filename) {
    return `${filename}.lib`;
}

function getBinFileName(filename) {
    return `${filename}.bin`;
}

function alignPow2(d, a) {
    return (d + a - 1) & ~(a - 1);
}

function align4(d) {
    return alignPow2(d, 4);
}

function align8(d) {
    return alignPow2(d, 8);
}

function getFileSize(fileInfo) {
    if (typeof fileInfo === 'string') {
        fileInfo = {
            source: fileInfo
        };
    }

    if (fileInfo.content) {
        return fileInfo.content.length;
    } else {
        return fs.statSync(fileInfo.source).size;
    }
}

function getFileData(fileInfo) {
    if (typeof fileInfo === 'string') {
        fileInfo = {
            source: fileInfo
        };
    }

    return fileInfo.content || fs.readFileSync(fileInfo.source);
}

function hashBKDR(str) {
    let seed = 131; // 31 131 1313 13131 131313 etc..
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
        // make sure the hash is a 32-bits unsigned integer
        hash = (hash * seed + str.charCodeAt(i)) & 0x7fffffff;
    }

    return hash;
}
