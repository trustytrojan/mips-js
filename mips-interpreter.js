const { stdout, argv, exit } = process
const { u32, i32 } = require('./utils')
const utils = require('./utils')
const { input } = require('./input')

const script_name = argv[1].substring(1+argv[1].lastIndexOf('/'))

// command-line argument checking
if(argv.length < 3) {
  console.log(`Usage: node ${script_name} [--debug] <file>`)
  exit(1)
}

let debug = (argv[2] === '--debug')
let source_file = (debug) ? argv[3] : argv[2]

let pc // program counter - cpu reads the instruction at this address
let hi // high 32 bits from multiplication
let lo // low 32 bits from multiplication
let ll_bit // indicates if we are in a read-modify-write (RMW) sequence

/**
 * @param {bigint} product 64-bit product from 32-bit multiplication
 */
function set_hi_lo(product) {
  hi = (product >> 32)
  lo = ((product << 32) >> 32)
}

// entire MIPS memory space
const M = Buffer.alloc(0x100)

// registers
const R = utils.create_register_obj()
R.ra = -1
R.gp = 0
R.sp = R.fp = M.byteLength

const labels = new Map()
const data_labels = new Map()

// read all code into string array
const lines = require('fs').readFileSync(source_file).toString().split('\n')

// trim leading and trailing whitespace
for(let i = 0; i < lines.length; ++i) {
  if(lines[i] === '\n') lines.splice(i, 1)
  lines[i] = lines[i].trim()
}

function store_data(i) {
  for(; lines[i] !== '.text'; ++i) {
    if(!lines[i].length) continue
    let str = lines[i].split(' ')
    const label = str.shift()
    const type = str.shift()
    let value = str.join(' ').replaceAll('"', '')
    data_labels.set(label.replace(':', ''), R.gp)
    switch(type) {
      case '.ascii':
        value = utils.replace_escapes_with_correct_char(value)
        R.gp += M.write(value, R.gp)
        break
      case '.asciiz':
        value = utils.replace_escapes_with_correct_char(value)
        R.gp += M.write(value+'\0', R.gp)
        break
      case '.double':
      case '.word':
      case '.half':
      case '.byte':
        value = Number.parseInt(value)
        if(isNaN(value)) error_and_exit(`Static data label "${label}" is not an integer`)
        R.gp += M.writeInt32BE(value, R.gp)
        break
      case '.float':
        value = Number.parseFloat(value)
        if(isNaN(value)) error_and_exit(`Static data label "${label}" is not a floating point number`)
        R.gp += M.writeFloatBE(value, R.gp)
    }
  }
}

// map all labels appropriately
for(let i = 0; i < lines.length; ++i) {
  const line = lines[i]
  if(!line || line.length === 0 || line.startsWith('#')) continue
  if(line === '.data')
    store_data(i+1)
  if(line === '.text')
    pc = i+1 // set pc to first line of code
  if(line.endsWith(':'))
    labels.set(line.replace(':',''), i)
}

const breakpoints = []

// main instruction processing loop
async function main() {
  for(; pc < lines.length; ++pc) {
    const line = lines[pc]
    if(!line || line.length === 0 || line.includes(':') || line.startsWith('#') || line.startsWith('.')) continue
    const args = line.split(' ')
    const op = args.shift()
    utils.clean_args(args)
    const instr = instructions[op]
    if(!instr) error_and_exit('Unknown instruction')
    await instr(args)
  }
}

async function debug_console() {
  console.log(`Debug mode enabled.`)
  console.log(`Enter "h" for help.`)
  let running = false
  let str
  while(true) {
    str = await input('> ')
    const [ letter, arg ] = str.split(' ')
    switch(letter) {
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
      case 'r':
        running = true
        await debug_loop()
        break
    }
  }
  async function debug_loop() {
    for(; pc < lines.length; ++pc) {
      const line = lines[pc]
      if(breakpoints.includes(pc)) {
        console.log(`Line ${pc+1}:\t ${lines[pc]}`)
        break
      }
      if(!line || line.length === 0 || line.includes(':') || line.startsWith('#') || line.startsWith('.')) continue
      const args = line.split(' ')
      const op = args.shift()
      utils.clean_args(args)
      const instr = instructions[op]
      if(!instr) error_and_exit('Unknown instruction')
      await instr(args)
    }
  }
  function debug_help() {
    console.log(`Enter "b <line>" to create a breakpoint. (before starting program)
Enter "r" to start running the program.
Enter "p <register>" to print register contents.
Enter "n" to execute the next line of code.
Enter "c" to continue to the next breakpoint. (or the end of the program)`)
  }
}

// instruction functions
const instructions = {
  async syscall() {
    switch(R.v0) {
      case 1: stdout.write(R.a0.toString()); break
      case 2:
      case 3: stdout.write(R.f12.toString()); break
      case 4: while(M[R.a0]) stdout.write(String.fromCharCode(M[R.a0++])); break
      case 5: R.v0 = Number.parseInt(await input()); break
      case 6: 
      case 7: R.v0 = Number.parseFloat(await input()); break
      case 8:
        const str = await input()
        for(let i = 0; i < R.a1; ++i)
          M[R.a0+i] = str[i]
        break
      case 9:
        if(R.a0 > 0) { R.v0 = R.gp; R.gp += R.a0 }
        else if(R.a0 < 0) { R.gp += R.a0; R.v0 = R.gp }
        break
      case 10: exit(0)
    }
  },
  la([ rd, label ]) {
    R[rd] = data_labels.get(label)
    if(R[rd] === undefined) error_and_exit('Undefined label')
  },
  jal([ label ]) {
    R.ra = pc
    pc = labels.get(label)
    if(pc === undefined) error_and_exit('Undefined label')
  },
  j([ label ]) {
    pc = labels.get(label)
    if(pc === undefined) error_and_exit('Undefined label')
  },
  jr([ rs ]) {
    if(R[rs] < 0) exit(0)
    pc = R[rs]
  },
  sll([ rd, rs, shamt ]) { R[rd] = R[rs] << u32(shamt) },
  srl([ rd, rs, shamt ]) { R[rd] = R[rs] >>> u32(shamt) },
  slt([ rd, rs, rt ]) { R[rd] = (R[rs] < R[rt]) ? 1 : 0 },
  slti([ rd, rs, imm ]) { R[rd] = (R[rs] < i32(imm)) ? 1 : 0 },
  sltu([ rd, rs, rt ]) { R[rd] = (R[rs] < R[rt]) ? 1 : 0 },
  sltiu([ rd, rs, imm ]) { R[rd] = (R[rs] < u32(imm)) ? 1 : 0 },
  blt([ rs, rt, label ]) { console.log(R[rs],R[rt]);if(R[rs] < R[rt]) pc = labels.get(label) },
  bgt([ rs, rt, label ]) { if(R[rs] > R[rt]) pc = labels.get(label) },
  ble([ rs, rt, label ]) { if(R[rs] <= R[rt]) pc = labels.get(label) },
  bge([ rs, rt, label ]) { if(R[rs] >= R[rt]) pc = labels.get(label) },
  beq([ rs, rt, label ]) { if(R[rs] === R[rt]) pc = labels.get(label) },
  bne([ rs, rt, label ]) { if(R[rs] !== R[rt]) pc = labels.get(label) },
  lbu([ rt, arg2 ]) { R[rt] = M.readUInt8(addr_get(arg2)) },
  lhu([ rt, arg2 ]) { R[rt] = M.readUInt16BE(addr_get(arg2)) },
  ll([ rt, arg2 ]) { R[rt] = M.readInt32BE(addr_get(arg2)); ll_bit = 1 },
  lui([ rt, imm ]) { R[rt] = i32(imm) << 16n },
  lw([ rt, arg2 ]) { R[rt] = M.readInt32BE(addr_get(arg2)) },
  sb([ rs, arg2 ]) { M[addr_get(arg2)] = R[rs] },
  sc([ rt, arg2 ]) {
    if(ll_bit) M.writeInt32BE(R[rt], addr_get(arg2))
    R[rt] = i32(0 | ll_bit)
  },
  sh([ rt, arg2 ]) { M.writeInt16BE(R[rt], addr_get(arg2)) },
  sw([ rt, arg2 ]) { M.writeInt32BE(R[rt], addr_get(arg2)) },
  add([ rd, rs, rt ]) {
    R[rd] = R[rs] + R[rt]
    if(R[rd] > 2**31-1 || R[rd] < -(2**31-2)) error_and_exit('Arithmetic overflow')
  },
  addi([ rd, rs, imm ]) {
    R[rd] = R[rs] + i32(imm)
    if(R[rd] > 2**31-1 || R[rd] < -(2**31-2)) error_and_exit('Arithmetic overflow')
  },
  addu([ rd, rs, rt ]) { R[rd] = u32(R[rs] + R[rt]) },
  addiu([ rd, rs, imm ]) { R[rd] = u32(R[rs] + u32(imm)) },
  sub([ rd, rs, arg3 ]) {
    try { R[rd] = R[rs] - i32(arg3) }
    catch(err) { R[rd] = R[rs] - R[arg3] }
    if(R[rd] > 2**31 - 1 || R[rd] < -(2**31-2)) error_and_exit('Arithmetic overflow')
  },
  subu([ rd, rs, arg3 ]) {
    try { R[rd] = u32(R[rs] - u32(arg3)) }
    catch(err) { R[rd] = u32(R[rs] - R[arg3]) }
  },
  mult([ rd, rs ]) { set_hi_lo( R[rd] * R[rs] ) },
  multu([ rd, rs ]) { set_hi_lo( R[rd] * R[rs] ) },
  mflo([ rd ]) { R[rd] = lo },
  mfhi([ rd ]) { R[rd] = hi },
  nor([ rd, rs, rt ]) { R[rd] = ~(R[rs] | R[rt]) },
  or([ rd, rs, rt ]) { R[rd] = R[rs] | R[rt] },
  ori([ rd, rs, imm ]) { R[rd] = R[rs] | u32(imm) },
  and([ rd, rs, rt ]) { R[rd] = R[rs] & R[rt] },
  andi([ rd, rs, imm ]) { R[rd] = R[rs] & u32(imm) },
  li([ rd, imm ]) { R[rd] = Number.parseInt(imm) },
  move([ rd, rs ]) { R[rd] = R[rs] }
}

function addr_get(arg) {
  if(data_labels.has(arg))
    return data_labels.get(arg)
  else {
    const [ rs, SignExtImm ] = utils.get_address_increment(arg)
    return R[rs]+SignExtImm
  }
}

function error_and_exit(cause) {
  console.log(`ERROR! Cause: ${cause}\nLine ${pc+1}:\t${lines[pc]}`)
  exit(1)
}

if(debug)
  debug_console()
else
  main()
