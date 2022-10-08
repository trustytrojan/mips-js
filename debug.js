const { input } = require('./input')
const MIPS_Instructions = require('./instructions')

const breakpoints = []

function debug_help() {
  console.log(`Enter "b <line>" to create a breakpoint. (before starting program)
Enter "r" to start running the program.
Enter "p <register>" to print register contents.
Enter "n" to execute the next line of code.
Enter "c" to continue to the next breakpoint. (or the end of the program)`)
}

let single_step = false

const cmds = {
  help() { debug_help() },
  h() { debug_help() },
  b()
}

/**
 * @param {{}} R 
 * @param {string[]} lines 
 * @param {MIPS_Instructions} instructions
 * @param {number} pc
 */
module.exports = async function(R, lines, instructions, pc) {
  console.log(`Debug mode enabled.`)
  console.log(`Enter "h" or "help".`)
  let str
  let last_cmd
  while(true) {
    str = await input('> ')
    let [ cmd, arg ] = str.split(' ')
    if(!cmd) cmd = last_cmd
    if(cmd === 'n' || cmd === 'c') last_cmd = cmd
    switch(cmd) {
      case 'h': debug_help(); break
      case 'b':
        const num = Number.parseInt(arg)-1
        if(breakpoints.includes(num))
          { console.log(`Breakpoint already exists!`); continue }
        breakpoints.push(num)
        console.log(`Breakpoint created at line ${arg}`)
        break
      case 'p':
        if(R[arg] === undefined) { console.log('Unknown register'); break }
        console.log(`$${arg} = ${R[arg]}`)
        break
      case 'ss':
        single_step = !single_step
        console.log(`Single step mode ${(single_step) ? 'enabled' : 'disabled'}.`)
        break
      case 'c':
        single_step = false
        await debug_loop()
        single_step = true
        break
      case 'n':
        if(!running)
          { console.log(`Program is not currently running.`); break }
        ++pc
        await debug_loop()
        break
      case 'r':
        running = true
        await debug_loop()
        break
    }
  }
  async function run_line() {
    try { await instructions.parse_and_run(line) }
    catch(err) {
      console.error(err)
    }
  }
  async function debug_loop() {
    for(;;++pc) {
      const line = lines[pc]
      if(!line || line.length === 0 || line.includes(':') || line.startsWith('#') || line.startsWith('.')) continue
      if(breakpoints.includes(pc) || single_step) {
        console.log(`Line ${pc+1}:\t ${lines[pc]}`)
        break
      }
      
    }
  }
}