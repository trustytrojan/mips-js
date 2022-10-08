// Author: github.com/trustytrojan

const readline = require('readline')
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

/**
 * Mimicking Python's input().
 * @param {string} query string to print before user input
 * @returns {Promise<string>} resolves when user hits enter
 */
function input(query) {
  return new Promise(resolve => rl.question(query ?? '', (answer) => resolve(answer)))
}

// Save yourself a few lines of code and pass the entire readline module and the interface!!!
module.exports = { readline, rl, input }