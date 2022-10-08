const { readFileSync } = require('fs')
const { randomInt } = require('crypto')
const { execSync } = require('child_process')
const { stdout, argv, exit } = process

const script_name = argv[1].substring(1+argv[1].lastIndexOf('/'))

const M = new Int8Array(0xffff).fill(0)

const R = {
  zero: 0,
  v0: 0,
  v1: 0,
  a0: 0,
  a1: 0,
  a2: 0,
  a3: 0,
  t0: 0,
  t1: 0,
  t2: 0,
  t3: 0,
  t4: 0,
  t5: 0,
  t6: 0,
  t7: 0,
  s0: 0,
  s1: 0,
  s2: 0,
  s3: 0,
  s4: 0,
  s5: 0,
  s6: 0,
  s7: 0,
  t8: 0,
  t9: 0
}

function print_string(addr) {
  while(M[addr]) {
    stdout.write(M[addr++])
  }
}

const instructions = {
  syscall() {
    switch(R.v0) {
      case 1: stdout.write(R.a0.toString()); break
      case 4: print_string(R.a0); break
      case 9: R.v0 = randomInt(0xff); break
    }
  },
  j([ label ]) { line_num = labels.get(label) },
  blt([ rs, rt, label ]) { if(R[rs] < R[rt]) line_num = labels.get(label) },
  bgt([ rs, rt, label ]) { if(R[rs] > R[rt]) line_num = labels.get(label) },
  ble([ rs, rt, label ]) { if(R[rs] <= R[rt]) line_num = labels.get(label) },
  bge([ rs, rt, label ]) { if(R[rs] >= R[rt]) line_num = labels.get(label) },
  beq([ rs, rt, label ]) { if(R[rs] === R[rt]) line_num = labels.get(label) },
  bne([ rs, rt, label ]) { if(R[rs] !== R[rt]) line_num = labels.get(label) },
  lw([ rt, arg2 ]) {
    const [ rs, SignExtImm ] = get_SignExtImm(arg2)
    R[rt] = M[R[rs]+SignExtImm]
  },
  sw([ rt, arg2 ]) {
    const [ rs, SignExtImm ] = get_SignExtImm(arg2)
    M[R[rs]+SignExtImm] = R[rt]
  },
  add([ rd, rs, rt ]) { R[rd] = R[rs] + R[rt] },
  addi([ rd, rs, imm ]) { R[rd] = R[rs] + Number.parseInt(imm) },
  li([ rd, imm ]) { R[rd] = Number.parseInt(imm) },
  move([ rd, rs ]) { R[rd] = R[rs] }
}

function get_SignExtImm(s) {
  if(!/[0-9][0-9]?\([vast][0-9]\)/.test(s)) return null
  return [Number.parseInt(s[0]), s.substring(1+s.indexOf('('),s.indexOf(')'))]
}

function clean_args(args) {
  for(let i = 0; i < args.length; ++i)
    args[i] = args[i].replace(',', '').replace('$', '').replace(' ', '')
}

const labels = new Map()

let line_num;

async function main() {
  if(argv.length < 3) {
    console.log(`Usage: node ${script_name} <file>`)
    exit(1)
  }
  const lines = readFileSync(argv[2]).toString().split('\n')
  for(let i = 0; i < lines.length; ++i)
    lines[i] = lines[i].trim()
  for(line_num = 0; line_num < lines.length; ++line_num) {
    const line = lines[line_num]
    if(line?.includes(':'))
      labels.set(line.trim().replace(':', ''), line_num)
  }
  for(line_num = 0; line_num < lines.length; ++line_num) {
    let line = lines[line_num]
    if(!line) continue
    if(line.includes(':')) continue
    line = line.trim()
    const args = line.split(' ')
    if(args.length === 0) continue
    const op = args.shift()
    if(!op) continue
    clean_args(args)
    instructions[op](args)
  }
}

main()