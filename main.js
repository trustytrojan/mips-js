const { argv, exit, stdin } = process
const utils = require('./utils')

const script_name = argv[1].substring(1+argv[1].lastIndexOf('/'))

// command-line argument checking
if(argv.length < 3) {
  console.log(`Usage: node ${script_name} [--debug] <file>`)
  exit(1)
}
let debug = (argv[2] === '--debug')
let source_file = (debug) ? argv[3] : argv[2]

const _ = {
  pc: 0, // program counter - cpu reads the instruction at this address
  hi: 0, // high 32 bits from multiplication
  lo: 0, // low 32 bits from multiplication
  text: 0 // start of text section (code)
}

// entire MIPS memory space
const M = Buffer.alloc(0x10000)

// registers
const R = utils.create_register_obj()
R.gp = 0
R.sp = R.fp = M.byteLength-4

// read all code into string array
const lines = require('fs').readFileSync(source_file).toString().split('\n')

R.ra = lines.length

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
    _.text = i // set _.pc to first line of code
  }
  
  if(line.endsWith(':'))
    labels.set(line.replace(':',''), i)
}

// get MIPS_Instructions object
const instructions = new (require('./instructions'))(_, R, M, labels, data_labels)

// main instruction processing loop
async function main() {
  _.pc = _.text
  do {
    if(_.pc >= lines.length) exit(0)
    const line = lines[_.pc]
    if(!line || line.length === 0 || line.startsWith('#') || line.startsWith('.') || line.endsWith(':')) continue
    // console.log(`${_.pc+1}:`, line)
    try { await instructions.parse_and_run(line) }
    catch(err) { console.error(err); utils.error_and_exit(err, _.pc+1, line) }
  } while(_.pc++ > 0)
}

main()
