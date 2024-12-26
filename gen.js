const readline = require('readline');
const crypto = require('crypto');
const fs = require('fs');

function getRandomHardwareIdentifier() {
    return crypto.randomBytes(32).toString('hex');
}

function getHardwareIdentifierFromNodeId(nodeId) {
    const cpuArchitecture = 'x64';
    const cpuModel = `Custom CPU Model from Node ID ${nodeId}`;
    const numOfProcessors = 4;
    const totalMemory = 8 * 1024 * 1024 * 1024;

    const cpuInfo = {
        cpuArchitecture: cpuArchitecture,
        cpuModel: cpuModel,
        numOfProcessors: numOfProcessors,
        totalMemory: totalMemory
    };

    return Buffer.from(JSON.stringify(cpuInfo)).toString('base64');
}

async function generateDeviceIdentifier(hardwareIdentifier) {
    const deviceInfo = JSON.stringify({ hardware: hardwareIdentifier });
    const hash = crypto.createHash('sha256');
    hash.update(deviceInfo);
    return hash.digest('hex');
}

function generatePubKey(length = 52) {
    const prefix = "12D3KooW";
    const remainingLength = length - prefix.length;
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let remainingChars = '';

    for (let i = 0; i < remainingLength; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        remainingChars += characters[randomIndex];
    }

    return prefix + remainingChars;
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    const chalk = (await import('chalk')).default;

    console.log(chalk.red.bold('This is only for testing purposes, I do not recommend using it'));

    console.log(chalk.cyan('Select mode:'));
    console.log(chalk.cyan('1. Randomize NodeID and HardwareID using NodeID for HWID seed'));
    console.log(chalk.cyan('2. HardwareID randomness with NodeID'));
    console.log(chalk.cyan('3. Pure Random HardwareID'));
    console.log(chalk.cyan('4. Pure Random NodeID and HardwareID'));

    rl.question(chalk.cyan('Enter the mode number: '), async (mode) => {
        if (mode === '2') {
            rl.question(chalk.cyan('Enter your custom Node ID: '), async (nodeId) => {
                const hardwareIdentifier = getHardwareIdentifierFromNodeId(nodeId);
                const deviceIdentifier = await generateDeviceIdentifier(hardwareIdentifier);
                const publicKey = generatePubKey();

                const logEntry = `Device Identifier: ${chalk.green(deviceIdentifier)}\nNode ID: ${chalk.blue(nodeId)}\n`;
                const formattedEntry = `${nodeId}:${deviceIdentifier}\n`;
                console.log(logEntry);

                fs.writeFileSync('output_2.txt', formattedEntry);
                console.log(chalk.yellow('Data saved to output_2.txt'));

                rl.close();
            });
        } else if (mode === '3') {
            rl.question(chalk.cyan('How many hardware identifiers do you want to generate? '), async (answer) => {
                const total = parseInt(answer);
                let output = '';

                for (let i = 0; i < total; i++) {
                    const hardwareIdentifier = getRandomHardwareIdentifier();
                    const logEntry = `Hardware Identifier ${i + 1}: ${chalk.green(hardwareIdentifier)}\n`;
                    const formattedEntry = `${hardwareIdentifier}\n`;
                    output += formattedEntry;
                    console.log(logEntry);
                }

                fs.writeFileSync('output_3.txt', output);
                console.log(chalk.yellow('Data saved to output_3.txt'));

                rl.close();
            });
        } else if (mode === '4') {
            rl.question(chalk.cyan('How many device identifiers do you want to generate? '), async (answer) => {
                const total = parseInt(answer);
                let output = '';

                for (let i = 0; i < total; i++) {
                    const nodeId = generatePubKey();
                    const hardwareIdentifier = getRandomHardwareIdentifier();
                    const deviceIdentifier = await generateDeviceIdentifier(hardwareIdentifier);

                    const logEntry = `Device Identifier ${i + 1}: ${chalk.green(deviceIdentifier)}\nNode ID ${i + 1}: ${chalk.blue(nodeId)}\n`;
                    const formattedEntry = `${nodeId}:${deviceIdentifier}\n`;
                    output += formattedEntry;
                    console.log(logEntry);
                }

                fs.writeFileSync('output_4.txt', output);
                console.log(chalk.yellow('Data saved to output_4.txt'));

                rl.close();
            });
        } else {
            rl.question(chalk.cyan('How many identifiers do you want to generate? '), async (answer) => {
                const total = parseInt(answer);
                let output = '';

                for (let i = 0; i < total; i++) {
                    const nodeId = generatePubKey();
                    const hardwareIdentifier = getHardwareIdentifierFromNodeId(nodeId);
                    const deviceIdentifier = await generateDeviceIdentifier(hardwareIdentifier);

                    const logEntry = `Device Identifier ${i + 1}: ${chalk.green(deviceIdentifier)}\nNode ID ${i + 1}: ${chalk.blue(nodeId)}\n`;
                    const formattedEntry = `${nodeId}:${deviceIdentifier}\n`;
                    output += formattedEntry;
                    console.log(logEntry);
                }

                fs.writeFileSync('output_1.txt', output);
                console.log(chalk.yellow('Data saved to output_1.txt'));

                rl.close();
            });
        }
    });
}

main();
