#!/usr/bin/env node

const {
    PathPrompt
} = require('inquirer-path');
const inquirer = require("inquirer");
const chalk = require("chalk");
const figlet = require("figlet");
const shell = require("shelljs");
const mineflayer = require("mineflayer");
const Vec3 = require("vec3").Vec3;

let bots = [];
let controlling;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

const init = () => {
    console.log();
    console.log(
        chalk.rgb(Math.floor(Math.random() * 255), Math.floor(Math.random() * 255), Math.floor(Math.random() * 255))(
            figlet.textSync("MCBots", {
                horizontalLayout: "default",
                verticalLayout: "default"
            })
        )
    );
}

const askQuestions = () => {
    const questions = [{
            name: "FILEPATH",
            type: "path",
            message: "What is the full path of the file with bot login information?"
        },
        {
            name: "SERVER",
            type: "input",
            message: "What IP would you like to connect to?"
        },
        {
            name: "PORT",
            type: "input",
            message: "What port would you like to use for connecting to the server?"
        },
        {
            name: "VERSION",
            message: "Pick a version:",
            type: "list",
            choices: ['1.8.9'],
        },
    ];
    return inquirer.prompt(questions);
};

const loadBots = async () => {
    const {
        FILEPATH,
        SERVER,
        PORT,
        VERSION,
    } = await askQuestions();

    if (bots.length != 0) {
        bots.forEach((account) => {
            account.bot.end();
        });
        bots = [];
    }

    const botsFile = shell.exec(`cat ${FILEPATH}`, {
        silent: true
    });
    if (botsFile.code !== 0) {
        console.log(chalk.red("An error has occurred when reading the bots file."))
    } else {
        let preBotFormatting = botsFile.stdout.split("\n");
        for (let val of preBotFormatting) {
            // Validation
            let botInfo = val.split(" ");
            if (botInfo.length != 2 || botInfo[0].length == 0 || botInfo[1].length == 0) {
                console.log(chalk.red("Your bots file isn't formatted correctly"));
                return;
            }
        }
        preBotFormatting.forEach((val, index) => {
            setTimeout(() => {
                let botInfo = val.split(" ");
                bots.push({
                    bot: mineflayer.createBot({
                        host: SERVER,
                        port: PORT,
                        username: botInfo[0],
                        password: botInfo[1],
                        version: VERSION,
                    }),
                    active: true,
                    get registerEvents() {
                        return (() => {
                            this.bot.on('chat', (username, message) => {
                                console.log(`${username}: ${message}`);
                            });
                            this.bot.on('error', (error) => {
                                console.log(chalk.red("An error has occurred with ") + chalk.white(account.bot.username) + chalk.red(`: ${error.message}`));
                            });
                            this.bot.on('kicked', () => {
                                this.active = false;
                            });
                            // Of course, this doesn't work...
                            this.bot._client.on('entity_velocity', v => {
                                if (this.bot.entity.id !== v.entityId) return;
                                this.bot.entity.velocity = new Vec3(v.velocityX / 256, v.velocityY / 512 * 1.5, v.velocityZ / 256);
                            });
                        });
                    }
                });
            }, 10000 * index);
            /* 
             * This 10 second delay is to trick any servers that have anti-spam delays inacted. 
             * A future fix will be to use proxies, but that hasn't been implemented yet.
             */
        });
    }
}

const unFloat = () => {
    if (controlling && controlling.active) {
        controlling.bot.setControlState('jump', true);
        controlling.bot.setControlState('jump', false)
    } else {
        bots.forEach((account) => {
            account.bot.setControlState('jump', true)
            account.bot.setControlState('jump', false)
        })
    }
}

const registerBotEvents = () => {
    bots.forEach((account) => {
        account.registerEvents();
        console.log(chalk.green(`Events registered for ${account.bot.username}`));
    });
}

const endBot = (user) => {
    user = user.trim();
    for (let account of bots) {
        if (user !== "" && !user.includes(" ")) {
            if (user === account.bot.username) {
                account.bot.end();
                account.active = false;
            }
        } else {
            account.bot.end();
            account.active = false;
        }
    }
}

const status = () => {
    bots.forEach((account) => {
        console.log(chalk.cyan(account.bot.username) + chalk.blue(": ") + (account.active ? chalk.green("true") : chalk.red("false")));
    });
}

const control = (user) => {
    if (user === "control reset") {
        controlling = null;
    } else if (user.split(" ").length === 2) {
        for (let account of bots) {
            if (user.split(" ")[1].toLowerCase() === account.bot.username.toLowerCase()) {
                controlling = account;
                break;
            }
        }
    } else {
        console.log(chalk.red("Please provide a username to control."));
    }
}

const chat = (action) => {
    if (controlling && controlling.active) {
        controlling.bot.chat(action);
    } else {
        bots.forEach((account) => {
            account.bot.chat(action);
        })
    }
}

const cmd = () => {
    return inquirer.prompt([{
        type: 'command',
        name: 'cmd',
        prefix: '',
        message: '>',
        autoCompletion: ['loadbots', 'status', 'chat', 'control', 'registerBotEvents', 'endbot', 'quit', 'unfloat'],
        context: 0,
        short: false
    }]).then(answers => {
        return Promise.resolve(answers.cmd)
    }).catch(err => {
        console.error(err.stack)
    })
}

const run = async () => {
    init();
    inquirer.registerPrompt(
        'command',
        require('inquirer-command-prompt')
    );
    inquirer.registerPrompt('path', PathPrompt);

    let response;
    commandLoop: while (true) {
        response = await cmd();
        switch (response.split(" ")[0].toLowerCase()) {
            case "loadbots":
                await loadBots();
                break;
            case "status":
                status();
                break;
            case "control":
                control(response);
                break;
            case "chat":
                chat(response.substr(5));
                break;
            case "registerbotevents":
                registerBotEvents();
                break;
            case "endbot":
                endBot(response.substr(7));
                break;
            case "unfloat":
                unFloat();
                break;
            case "quit":
            case "exit":
                break commandLoop;
            default:
                console.log(chalk.red("Please enter a valid command."))
        }
    }
    process.exit(0);
};

run();