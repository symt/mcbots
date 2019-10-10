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
var keypress = require('keypress');

const autocompletions = ['loadbots', 'status', 'chat', 'control', 'registerbotevents', 'endbot', 'quit', 'stuck', 'togglechat'];

let bots = [];
let controlling;
let chatToggled = false;
let currentInput = "";

process.stdin.on('keypress', function (ch, key) {
    const autocomplete = (string) => {
        let options = [];
        autocompletions.forEach((completion) => {
            if (completion.toLowerCase().startsWith(string.toLowerCase())) {
                options.push(completion.substr(string.length));
            }
        });
        return (options.length === 1) ? options[0] : '';
    };
    if (key) {
        if (key.name === 'enter' || key.name === 'return') {
            queue.push(currentInput);
            currentInput = "";
        } else if (key.name === 'backspace') {
            if (currentInput.length != 0)
                currentInput = currentInput.slice(0, -1);
        } else if (key.name === 'up') {
            //currentInput = queue[queue.length - --index];
        } else if (key.name === 'down') {
            //currentInput = queue[queue.length - ++index];
        } else if (key.name !== 'tab' && key.name !== 'left' && key.name !== 'right') {
            currentInput += ch;
        } else {
            const autocompleteTab = currentInput.split(" ");
            currentInput += autocomplete(autocompleteTab[autocompleteTab.length - 1]);
        }
    }
});

process.stdin.setRawMode(true);
process.stdin.resume();

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
        chatToggled = false;
        controlling = undefined;
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
                    chatEnabled: false,
                    get registerEvents() {
                        return (() => {
                            this.bot.on('error', (error) => {
                                console.log(chalk.red("An error has occurred with ") + chalk.white(account.bot.username) + chalk.red(`: ${error.message}`));
                            });
                            this.bot.on('kicked', () => {
                                this.active = false;
                            });
                        });
                    },
                    get registerChat() {
                        return (() => {
                            this.bot.on('message', (message) => {
                                process.stdout.clearLine();
                                process.stdout.cursorTo(0);
                                console.log(message.toAnsi());
                                process.stdout.write(` > ${currentInput}`);
                            });
                        });
                    },
                });
            }, 7500 * index);
            /* 
             * This 7.5 second delay is to trick any servers that have anti-spam delays inacted. 
             * A future fix will be to use proxies, but that hasn't been implemented yet.
             */
        });
    }
}

const stuck = () => {
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
        console.log(chalk.green('Events registered for ') + chalk.gray(account.bot.username) + chalk.green('.'));
    });
}

const togglechat = (user) => {
    let foundUser = false;
    for (let account of bots) {
        if (user !== "" && !user.includes(" ")) {
            if (user.toLowerCase() === account.bot.username.toLowerCase()) {
                if (!account.chatEnabled && !chatToggled) {
                    account.registerChat();
                    user = account.bot.username;
                    chatToggled = true;
                } else if (chatToggled && !account.chatEnabled) {
                    console.log(chalk.red('Chat is already toggled.'));
                    return;
                } else if (chatToggled && account.chatEnabled) {
                    console.log(chalk.red('Chat is already toggled for ') + chalk.gray(account.bot.username) + chalk.red('.'));
                    return;
                }
                foundUser = true;
                break;
            }
        }
    }
    if (!foundUser) {
        console.log(chalk.red('Provide a user to toggle chat.'));
    } else {
        console.log(chalk.green('Chat has been enabled for ') + chalk.gray(user) + chalk.green('.'));
    }
}

const endBot = (user) => {
    user = user.trim();
    for (let account of bots) {
        if (user !== "" && !user.includes(" ")) {
            if (user.toLowerCase() === account.bot.username.toLowerCase()) {
                if (controlling && controlling === account) {
                    controlling = undefined;
                }
                if (account.chatEnabled) {
                    chatToggled = false;
                    account.chatEnabled = false;
                }
                account.bot.end();
                account.active = false;
                break;
            }
        } else {
            if (controlling) {
                controlling = undefined;
            }
            account.bot.end();
            account.active = false;
        }
    }
    if (user === "" || user.includes(" ")) {
        chatToggled = false;
    }
}

const status = () => {
    if (bots.length === 0) {
        console.log(chalk.red("There are no users to display. Do ") + chalk.gray("loadbots") + chalk.red(" to load up accounts."))
    } else {
        bots.forEach((account) => {
            console.log(chalk.cyan(account.bot.username) + chalk.blue(": ") + (account.active ? chalk.green("true") : chalk.red("false")));
        });
    }
}

const control = (user) => {
    if (user === "control reset") {
        controlling = null;
        console.log(chalk.green("Control was reset to everyone."))
    } else if (user.split(" ").length === 2) {
        for (let account of bots) {
            if (user.split(" ")[1].toLowerCase() === account.bot.username.toLowerCase()) {
                controlling = account;
                console.log(chalk.green("Now controlling ") + chalk.gray(account.bot.username) + chalk.green("."))
                return;
            }
        }
        console.log(chalk.red("Could not find ") + chalk.gray(user.split(" ")[1].toLowerCase()) + chalk.red(". Please try a different user."));
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
        autoCompletion: autocompletions,
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
            case "stuck":
                stuck();
                break;
            case "togglechat":
                togglechat(response.substr(11));
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