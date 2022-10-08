const { argv, exit } = process
const utils = require('./utils')

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

// entire MIPS memory space
const M = Buffer.alloc(0x10000)

// registers
const R = utils.create_register_obj()
R.ra = -1
R.gp = 0
R.sp = R.fp = M.byteLength-1

// read all code into string array
const lines = require('fs').readFileSync(source_file).toString().split('\n')

// trim leading and trailing whitespace from all lines
utils.trim_whitespace_from_every_line(lines)

// map all labels (text and data) appropriately
const labels = new Map()
const data_labels = new Map()
for(let i = 0; i < lines.length; ++i) {
  const line = lines[i]

  // ignore comments and empty lines
  if(!line || line.length === 0 || line.startsWith('#')) continue

  if(line === '.data')
    // allocate static data in memory and map labels to addresses
    require('./store-static-data')(i, R, M, lines, data_labels)

  if(line === '.text') {
    pc = i+1 // set pc to first line of code
  }
  
  if(line.endsWith(':'))
    labels.set(line.replace(':',''), i)
}

// get MIPS_Instructions object
const instructions = new (require('./instructions'))(R, M, labels, data_labels, hi, lo, pc, ll_bit)

// main instruction processing loop
async function main() {
  for(;;) {
    const line = lines[pc++]
    if(!line || line.length === 0 || line.includes(':') || line.startsWith('#') || line.startsWith('.')) continue
    try { await instructions.parse_and_run(line) }
    catch(err) {
      console.error(err)
    }
  }
}

if(debug)
  require('./debug')(R, lines, instructions, pc)
else
  main()
